const FollowUp = require('../models/FollowUp');
const Enquiry = require('../models/Enquiry');

// GET /api/follow-ups?enquiryId=xxx
exports.getFollowUps = async (req, res, next) => {
  try {
    const { enquiryId } = req.query;
    let filter = {};

    if (enquiryId) {
      filter.enquiry = enquiryId;
    } else {
      // Global Tasks View
      const isHighAuth = ['SA', 'SUPER_ADMIN', 'DIR', 'DIRECTOR'].includes(req.user.role?.toUpperCase() || '');
      if (!isHighAuth) {
        // Regular users see tasks they created, escalated to them, or on enquiries assigned to them
        const userEnquiries = await Enquiry.find({ assignedTo: req.user._id }).select('_id');
        const eqIds = userEnquiries.map(e => e._id);
        filter.$or = [
          { addedBy: req.user._id },
          { escalatedTo: req.user._id },
          { enquiry: { $in: eqIds } }
        ];
      }
      // Only get tasks that have a nextFollowUpDate set
      filter.nextFollowUpDate = { $ne: null };
    }

    const followUps = await FollowUp.find(filter)
      .sort(enquiryId ? { createdAt: -1 } : { nextFollowUpDate: 1 })
      .populate('addedBy', 'name role')
      .populate('escalatedTo', 'name role')
      .populate('overriddenBy', 'name role')
      .populate({
        path: 'enquiry',
        select: 'enquiryId status priority customer',
        populate: { path: 'customer', select: 'companyName' }
      });

    res.status(200).json({ status: 'success', data: { followUps } });
  } catch (err) {
    next(err);
  }
};

// POST /api/follow-ups
exports.addFollowUp = async (req, res, next) => {
  try {
    const { enquiryId, type, notes, outcome, followUpDate, nextFollowUpDate, isEscalation, escalatedTo } = req.body;
    
    if (!enquiryId || !notes) {
      return res.status(400).json({ status: 'fail', message: 'enquiryId and notes are required' });
    }

    const finalFollowUpDate = followUpDate ? new Date(followUpDate) : new Date();
    let finalNextFollowUpDate = nextFollowUpDate ? new Date(nextFollowUpDate) : null;

    if (finalNextFollowUpDate && finalNextFollowUpDate < finalFollowUpDate) {
      return res.status(400).json({
        status: 'fail',
        message: 'Next follow-up reminder date cannot be before the follow-up date'
      });
    }

    if (finalNextFollowUpDate && finalNextFollowUpDate < new Date(Date.now() - 60000)) {
      return res.status(400).json({
        status: 'fail',
        message: 'Next follow-up reminder date cannot be in the past'
      });
    }

    if (!finalNextFollowUpDate) {
      // blank -> system sets D+3 reminder automatically
      finalNextFollowUpDate = new Date(finalFollowUpDate);
      finalNextFollowUpDate.setDate(finalNextFollowUpDate.getDate() + 3);
    }

    const followUp = await FollowUp.create({
      enquiry: enquiryId,
      type: type || 'NOTE',
      notes,
      outcome,
      addedBy: req.user._id,
      followUpDate: finalFollowUpDate,
      nextFollowUpDate: finalNextFollowUpDate,
      isEscalation: isEscalation || false,
      escalatedTo: escalatedTo || null,
    });

    // Update nextFollowUpDate and lastFollowUpAt on the Enquiry itself for quick access
    await Enquiry.findByIdAndUpdate(enquiryId, {
      nextFollowUpDate: finalNextFollowUpDate,
      lastFollowUpAt: finalFollowUpDate
    });

    const populated = await followUp.populate('addedBy', 'name role');
    res.status(201).json({ status: 'success', data: { followUp: populated } });
  } catch (err) {
    next(err);
  }
};

// PATCH /api/follow-ups/:id — edit notes/outcome or override reminder
exports.updateFollowUp = async (req, res, next) => {
  try {
    const { type, notes, outcome, nextFollowUpDate, isOverridden, overrideNote } = req.body;

    const followUp = await FollowUp.findById(req.params.id);
    if (!followUp) return res.status(404).json({ status: 'fail', message: 'Follow-up not found' });

    // Only the author, Director, or SA can edit
    const isAuthor = followUp.addedBy.toString() === req.user._id.toString();
    const isHighAuth = ['SA', 'SUPER_ADMIN', 'DIR', 'DIRECTOR'].includes(req.user.role);
    if (!isAuthor && !isHighAuth) {
      return res.status(403).json({ status: 'fail', message: 'Not authorized to edit this follow-up' });
    }

    if (type !== undefined) followUp.type = type;
    if (notes !== undefined) followUp.notes = notes;
    if (outcome !== undefined) followUp.outcome = outcome;
    if (nextFollowUpDate !== undefined) {
      if (nextFollowUpDate) {
        const nextDate = new Date(nextFollowUpDate);
        const refDate = followUp.followUpDate || new Date();
        if (nextDate < refDate) {
          return res.status(400).json({
            status: 'fail',
            message: 'Next follow-up reminder date cannot be before the follow-up date'
          });
        }
        if (nextDate < new Date(Date.now() - 60000)) {
          return res.status(400).json({
            status: 'fail',
            message: 'Next follow-up reminder date cannot be in the past'
          });
        }
      }
      followUp.nextFollowUpDate = nextFollowUpDate || null;
      await Enquiry.findByIdAndUpdate(followUp.enquiry, { nextFollowUpDate: nextFollowUpDate || null });
    }
    if (isOverridden !== undefined && isHighAuth) {
      followUp.isOverridden = isOverridden;
      followUp.overriddenBy = req.user._id;
      followUp.overrideNote = overrideNote || '';
    }

    await followUp.save();
    res.status(200).json({ status: 'success', data: { followUp } });
  } catch (err) {
    next(err);
  }
};

// DELETE /api/follow-ups/:id
exports.deleteFollowUp = async (req, res, next) => {
  try {
    const followUp = await FollowUp.findById(req.params.id);
    if (!followUp) return res.status(404).json({ status: 'fail', message: 'Follow-up not found' });

    const isAuthor = followUp.addedBy.toString() === req.user._id.toString();
    const isHighAuth = ['SA', 'SUPER_ADMIN', 'DIR', 'DIRECTOR'].includes(req.user.role);
    if (!isAuthor && !isHighAuth) {
      return res.status(403).json({ status: 'fail', message: 'Not authorized to delete this follow-up' });
    }

    await followUp.deleteOne();
    res.status(204).json({ status: 'success', data: null });
  } catch (err) {
    next(err);
  }
};
