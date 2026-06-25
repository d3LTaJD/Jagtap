const Enquiry = require('../models/Enquiry');
const Quotation = require('../models/Quotation');
const Qap = require('../models/Qap');
const FollowUp = require('../models/FollowUp');
const Customer = require('../models/Customer');
const { hasPermission } = require('../config/permissions');

// All statuses that mean the enquiry is still alive / active
const ACTIVE_STATUSES = ['New', 'Confirmed', 'Contacted', 'Technical Review', 'Ready for Offer', 'Quoted', 'Negotiating', 'On Hold'];

exports.getDashboardStats = async (req, res, next) => {
  try {
    const hasFullPipeline = hasPermission(req.user, 'Dashboard', 'viewFullPipeline');
    const hasFinancials = hasPermission(req.user, 'Dashboard', 'viewFinancials');

    // Build filters
    const enquiryFilter = {};
    const quotationFilter = {};
    const qapFilter = {};
    const activityFilter = {};

    if (!hasFullPipeline) {
      enquiryFilter.$or = [
        { assignedTo: req.user._id },
        { createdBy: req.user._id }
      ];
      quotationFilter.$or = [
        { preparedBy: req.user._id },
        { createdBy: req.user._id },
        { assignedTo: req.user._id }
      ];
      qapFilter.$or = [
        { preparedBy: req.user._id },
        { assignedTo: req.user._id }
      ];

      const userEnquiries = await Enquiry.find(enquiryFilter).select('_id');
      const eqIds = userEnquiries.map(e => e._id);
      activityFilter.$or = [
        { addedBy: req.user._id },
        { enquiry: { $in: eqIds } }
      ];
    }

    // ── Core counts ─────────────────────────────────────────────
    const totalEnquiries  = await Enquiry.countDocuments(enquiryFilter);
    const activeEnquiries = await Enquiry.countDocuments({ ...enquiryFilter, status: { $in: ACTIVE_STATUSES } });
    const wonEnquiries    = await Enquiry.countDocuments({ ...enquiryFilter, status: 'Won' });
    const lostEnquiries   = await Enquiry.countDocuments({ ...enquiryFilter, status: 'Lost' });
    const activeClients   = await Customer.countDocuments({ isActive: true });

    // Pipeline breakdown by status (for funnel chart)
    const statusGroups = await Enquiry.aggregate([
      { $match: enquiryFilter },
      { $group: { _id: '$status', count: { $sum: 1 } } }
    ]);
    const byStatus = {};
    statusGroups.forEach(sg => { byStatus[sg._id] = sg.count; });

    // Category breakdown (for doughnut chart)
    const categoryGroups = await Enquiry.aggregate([
      { $match: { ...enquiryFilter, status: { $in: ACTIVE_STATUSES } } },
      { $group: { _id: '$productCategory', count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ]);
    const byCategory = categoryGroups.map(cg => ({
      name: cg._id || 'Unspecified',
      value: cg.count
    }));

    // ── Quotation & QAP counts ────────────────────────────────────
    const wonQuotations     = await Quotation.countDocuments({ ...quotationFilter, status: 'Accepted' });
    const pendingQuotations = await Quotation.countDocuments({ ...quotationFilter, status: { $in: ['Draft', 'Pending Technical Review', 'Pending Commercial Review', 'Pending Approval', 'PENDING_APPROVAL', 'TECH_REVIEW', 'Sent to Customer'] } });
    const pendingQaps       = await Qap.countDocuments({ ...qapFilter, status: { $in: ['Pending Director Approval', 'UNDER_REVIEW'] } });

    // ── Pipeline value ────────────────────────────────────────────
    let pipelineValue = 0;
    if (hasFinancials) {
      const pipelineData = await Quotation.aggregate([
        { $match: { ...quotationFilter, status: { $in: ['Pending Technical Review', 'Pending Commercial Review', 'Pending Approval', 'Accepted', 'Sent to Customer'] } } },
        { $group: { _id: null, totalValue: { $sum: '$commercialTotals.grandTotal' } } }
      ]);
      pipelineValue = pipelineData.length > 0 ? pipelineData[0].totalValue : 0;
    }

    // Won value this month
    const startOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
    let wonValue = 0;
    let wonCount = 0;

    const wonValueData = await Enquiry.aggregate([
      { $match: { ...enquiryFilter, status: 'Won', updatedAt: { $gte: startOfMonth } } },
      { $group: { _id: null, total: { $sum: '$winPoValue' }, count: { $sum: 1 } } }
    ]);
    if (hasFinancials) {
      wonValue = wonValueData[0]?.total || 0;
    }
    wonCount = wonValueData[0]?.count || 0;

    const lostValueData = await Enquiry.aggregate([
      { $match: { ...enquiryFilter, status: 'Lost', updatedAt: { $gte: startOfMonth } } },
      { $group: { _id: null, count: { $sum: 1 } } }
    ]);
    const lostCount = lostValueData[0]?.count || 0;

    const conversionRate = (wonCount + lostCount) > 0
      ? Math.round((wonCount / (wonCount + lostCount)) * 100)
      : 0;

    // ── Time Series Data (Leads over last 30 days) ───────────────
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    const timeSeriesAggregation = await Enquiry.aggregate([
      { $match: { ...enquiryFilter, createdAt: { $gte: thirtyDaysAgo } } },
      {
        $group: {
          _id: {
            $dateToString: { format: "%d %b", date: "$createdAt" }
          },
          leads: { $sum: 1 },
          dateRaw: { $first: "$createdAt" }
        }
      },
      { $sort: { dateRaw: 1 } }
    ]);
    
    const timeSeriesData = timeSeriesAggregation.map(item => ({
      name: item._id,
      leads: item.leads
    }));

    // ── Recent Activity ────────────────────────────────────────────
    const recentActivity = await FollowUp.find(activityFilter)
      .populate('enquiry', 'enquiryId')
      .populate('addedBy', 'name')
      .sort('-createdAt')
      .limit(5);

    // ── My Tasks (role-aware) ──────────────────────────────────────
    const myEnquiries = await Enquiry.find({
      assignedTo: req.user._id,
      status: { $in: ['New', 'Confirmed', 'Contacted'] }
    }).populate('customer', 'companyName').limit(5).select('enquiryId productCategory status customer');

    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);

    const myDueEnquiries = await Enquiry.find({
      assignedTo: req.user._id,
      nextFollowUpDate: { $lte: todayEnd, $ne: null },
      status: { $nin: ['Won', 'Lost', 'Abandoned'] }
    })
    .populate('customer', 'companyName')
    .sort({ nextFollowUpDate: 1, priority: -1 });

    const myDueFollowUps = myDueEnquiries.map(enq => ({
      _id: enq._id,
      enquiry: {
        _id: enq._id,
        enquiryId: enq.enquiryId,
        status: enq.status,
        priority: enq.priority,
        customer: enq.customer,
        productCategory: enq.productCategory,
        nextFollowUpDate: enq.nextFollowUpDate,
        lastFollowUpAt: enq.lastFollowUpAt
      },
      nextFollowUpDate: enq.nextFollowUpDate,
      notes: 'Automated follow-up reminder'
    }));

    // Approvals (role-specific)
    let myApprovals = [];
    const { getRoleCode } = require('../middleware/auth');
    const userRoleCode = getRoleCode(req.user.role);
    const userSecRoleCode = getRoleCode(req.user.secondaryRole);
    const userRoles = [userRoleCode, userSecRoleCode].filter(Boolean);

    const canApproveQuotation = hasPermission(req.user, 'Quotation', 'approve');
    const canApproveQap = hasPermission(req.user, 'QAP', 'finalSignOff');
    const canTechReview = userRoles.includes('DE') || userRoles.includes('TA');

    if (canApproveQuotation || canApproveQap) {
      const qQuotes = await Quotation.find({ status: { $in: ['Pending Approval', 'PENDING_APPROVAL'] } }).populate('customer', 'companyName').limit(3);
      const qQaps = await Qap.find({ status: { $in: ['Pending Director Approval', 'UNDER_REVIEW'] } }).populate('customer', 'companyName').limit(3);
      myApprovals = [
        ...qQuotes.map(q => ({ type: 'Quote', id: q.quotationId, _id: q._id })),
        ...qQaps.map(q => ({ type: 'QAP', id: q.qapId, _id: q._id }))
      ];
    } else if (canTechReview) {
      const dQuotes = await Quotation.find({ status: { $in: ['Pending Technical Review', 'TECH_REVIEW'] } }).limit(5);
      myApprovals = dQuotes.map(q => ({ type: 'Quote (Tech)', id: q.quotationId, _id: q._id }));
    }

    res.status(200).json({
      status: 'success',
      data: {
        stats: {
          totalEnquiries,
          activeEnquiries,
          activeClients,
          wonQuotations,
          pendingQuotations,
          pendingQaps,
          pipelineValue: hasFinancials ? pipelineValue : null,
          wonCount,
          lostCount,
          wonValue: hasFinancials ? wonValue : null,
          conversionRate,
          byStatus,
          byCategory,
          timeSeriesData
        },
        recentActivity,
        myTasks: {
          enquiries: myEnquiries,
          followUps: myDueFollowUps,
          approvals: myApprovals
        }
      }
    });
  } catch (err) {
    next(err);
  }
};
