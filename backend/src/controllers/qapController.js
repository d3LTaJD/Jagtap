const Qap = require('../models/Qap');
const Quotation = require('../models/Quotation');
const { notifyRoles, sendEmail } = require('../services/notificationService');
const ActivityLog = require('../models/ActivityLog');
const { getNextSequenceValue } = require('../utils/counter');

exports.generateQapFromQuotation = async (req, res, next) => {
  try {
    const quotation = await Quotation.findById(req.body.quotationId).populate('items');
    if (!quotation) return res.status(404).json({ status: 'error', message: 'Quotation not found' });

    let activities = [];
    let docChecklists = [];
    
    quotation.items.forEach((item, index) => {
      // Basic rule engine logic
      if (item.testsRequired.includes('RT')) {
        activities.push({
          activityNo: activities.length + 1,
          stageOfManufacture: 'NDT',
          activityName: 'Radiographic Examination',
          referenceDocument: 'ASME Sec V Art 2',
          inspectionType: 'W',
          status: 'Planned'
        });
        docChecklists.push({ documentType: 'RT Film Register', status: 'Awaited' });
      }
    });

    const year = new Date().getFullYear();
    const month = String(new Date().getMonth() + 1).padStart(2, '0');
    const prefix = `QAP-${year}-${month}-`;
    const seq = await getNextSequenceValue(prefix);
    
    const qapData = {
      qapId: `${prefix}${String(seq).padStart(4, '0')}`,
      quotation: quotation._id,
      customer: quotation.customer,
      preparedBy: req.user._id,
      activities,
      documents: docChecklists
    };

    const qap = await Qap.create(qapData);
    
    await notifyRoles({ 
      roles: ['QC_ENGINEER'], 
      type: 'QAP_APPROVAL', 
      title: 'New QAP Generated', 
      message: `QAP ${qap.qapId} generated and awaits your initial review.`, 
      related_id: qap._id 
    });

    res.status(201).json({ status: 'success', data: { qap } });
  } catch (err) {
    next(err);
  }
};

exports.getQaps = async (req, res, next) => {
  try {
    const qaps = await Qap.find()
      .populate('quotation', 'quotationId')
      .populate('customer', 'companyName')
      .sort('-createdAt');
    res.status(200).json({ status: 'success', results: qaps.length, data: { qaps } });
  } catch (err) {
    next(err);
  }
};

exports.getQap = async (req, res, next) => {
  try {
    const qap = await Qap.findById(req.params.id).populate('quotation').populate('customer');
    if (!qap) return res.status(404).json({ status: 'error', message: 'Not found' });
    res.status(200).json({ status: 'success', data: { qap } });
  } catch (err) {
    next(err);
  }
};

exports.updateQapStatus = async (req, res, next) => {
  try {
    const { status, assignedTo } = req.body;
    const updateData = {};
    if (status) updateData.status = status;
    if (assignedTo) updateData.assignedTo = assignedTo;

    if (status === 'APPROVED') updateData.approvedBy = req.user._id;

    const originalQap = await Qap.findById(req.params.id);
    const qap = await Qap.findByIdAndUpdate(req.params.id, updateData, { new: true });
    
    if (status && status !== originalQap.status) {
      await ActivityLog.create({
        user_id: req.user._id,
        action: 'STATUS_CHANGE',
        module: 'QAP',
        details: `QAP ${qap.qapId} status changed from ${originalQap.status} to ${status}`,
        related_id: qap._id
      });
      
      if (status === 'UNDER_REVIEW') {
        await notifyRoles({ roles: ['DIRECTOR'], type: 'QAP_APPROVAL', title: 'QAP Approval Required', message: `QAP ${qap.qapId} awaits Director approval.`, related_id: qap._id });
        // Email
        const adminUsers = await require('../models/User').find({ role: 'DIRECTOR' });
        adminUsers.forEach(u => {
          sendEmail({ userId: u._id, subject: 'QAP Approval Required', text: `Please approve QAP ${qap.qapId}` });
        });
      }
    }

    if (assignedTo && assignedTo.toString() !== originalQap.assignedTo?.toString()) {
      await ActivityLog.create({
        user_id: req.user._id,
        action: 'ASSIGNMENT',
        module: 'QAP',
        details: `QAP ${qap.qapId} assigned to ${assignedTo}`,
        related_id: qap._id
      });
    }

    res.status(200).json({ status: 'success', data: { qap } });
  } catch (err) {
    next(err);
  }
};
