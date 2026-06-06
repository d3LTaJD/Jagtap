const Enquiry = require('../models/Enquiry');
const Customer = require('../models/Customer');
const Task = require('../models/Task');
const FieldDefinition = require('../models/FieldDefinition');
const { createNotification, notifyRoles } = require('../services/notificationService');
const { logActivity } = require('../utils/logger');
const { getNextSequenceValue } = require('../utils/counter');

async function checkEnquiryCompletion(enquiry) {
  try {
    const fields = await FieldDefinition.find({
      formContext: 'Enquiry',
      isDeleted: false,
      isActive: true
    });

    const relevantFields = fields.filter(f => {
      if (!f.productCategory) return true;
      return f.productCategory === enquiry.productCategory;
    });

    let allRequiredFilled = true;
    const missingFields = [];

    for (const field of relevantFields) {
      let isFieldActive = true;
      if (field.conditionalLogic && field.conditionalLogic.dependsOnField) {
        const parentFieldName = field.conditionalLogic.dependsOnField;
        const expectedValue = field.conditionalLogic.requiredValue;

        const actualValue = enquiry.dynamicFields?.[parentFieldName] !== undefined
          ? enquiry.dynamicFields[parentFieldName]
          : enquiry[parentFieldName];

        if (String(actualValue) !== String(expectedValue)) {
          isFieldActive = false;
        }
      }

      if (isFieldActive && field.isRequired) {
        const val = enquiry.dynamicFields?.[field.fieldName];
        const isFilled = val !== undefined && val !== null && val !== '' && (!Array.isArray(val) || val.length > 0);
        if (!isFilled) {
          allRequiredFilled = false;
          missingFields.push(field);
        }
      }
    }

    return {
      isComplete: allRequiredFilled,
      missingFields
    };
  } catch (err) {
    console.error('Error in checkEnquiryCompletion:', err.message);
    return { isComplete: false, missingFields: [] };
  }
}

exports.checkEnquiryCompletion = checkEnquiryCompletion;


exports.createEnquiry = async (req, res, next) => {
  try {
    const { customerData, enquiryData } = req.body;
    
    // Auto-create or find existing customer
    let customer;
    if (customerData._id) {
      customer = await Customer.findById(customerData._id);
    } else {
      // Auto-generate unique customerId
      customerData.customerId = `CUS-${Date.now().toString().slice(-6)}`;
      customer = await Customer.create(customerData);
    }

    enquiryData.customer = customer._id;
    enquiryData.createdBy = req.user._id;
    enquiryData.assignedTo = enquiryData.assignedTo || req.user._id;
    
    // Generate sequential ENQ-YYYY-MM-NNNN ID atomically
    const year = new Date().getFullYear();
    const month = String(new Date().getMonth() + 1).padStart(2, '0');
    const prefix = `ENQ-${year}-${month}-`;
    const seq = await getNextSequenceValue(prefix);
    enquiryData.enquiryId = `${prefix}${String(seq).padStart(4, '0')}`;

    const enquiry = await Enquiry.create(enquiryData);

    await logActivity({
      req,
      action: 'CREATE',
      module: 'ENQUIRY',
      resourceId: enquiry._id,
      resourceName: enquiry.enquiryId,
      newState: enquiry.toObject(),
      details: `Created new enquiry: ${enquiry.enquiryId}`
    });

    if (enquiry.assignedTo) {
      // 1. Notify the user
      if (enquiry.assignedTo.toString() !== req.user._id.toString()) {
        await createNotification({ 
          user_id: enquiry.assignedTo, 
          type: 'ENQUIRY_ASSIGNED', 
          title: 'New Enquiry Assigned', 
          message: `Enquiry ${enquiry.enquiryId} has been assigned to you.`, 
          related_id: enquiry._id 
        });
      }

      // 2. System-generated Task
      const due = new Date();
      due.setDate(due.getDate() + 1); // Due tomorrow
      await Task.create({
        title: `Follow up on New Enquiry ${enquiry.enquiryId}`,
        description: `System generated task to review and contact the customer regarding ${enquiry.productCategory}.`,
        dueDate: due,
        priority: 'High',
        status: 'To Do',
        assignedTo: enquiry.assignedTo,
        createdBy: req.user._id,
        linkedEnquiry: enquiry._id
      });
    }

    // 3. SOW 5.4 — Urgent priority: immediate alert to Director + Sales Head
    if (enquiry.priority === 'Urgent') {
      await notifyRoles({
        roles: ['DIR', 'DIRECTOR', 'SALES'],
        type: 'URGENT_LEAD',
        title: '🚨 Urgent Lead Alert',
        message: `Urgent enquiry ${enquiry.enquiryId} — ${customer.companyName} — ${enquiry.productCategory}. Immediate action required.`,
        related_id: enquiry._id
      });
    }

    // Check completeness and auto-promote to 'Ready for Offer'
    const completion = await checkEnquiryCompletion(enquiry);
    if (completion.isComplete && ['New', 'Contacted', 'Technical Review'].includes(enquiry.status)) {
      enquiry.status = 'Ready for Offer';
      await enquiry.save();
    }

    // Send automated email if contactEmail is present
    if (enquiry.contactEmail) {
      try {
        const emailBotService = require('../services/emailBotService');
        await emailBotService.sendAutomatedReply(
          enquiry.contactEmail,
          enquiry.contactPerson || 'Customer',
          enquiry.enquiryId,
          {
            productDescription: enquiry.productDescription,
            productCategory: enquiry.productCategory,
            quantity: enquiry.quantity,
            unit: enquiry.unit || 'NOS',
            priority: enquiry.priority
          },
          completion.missingFields
        );
      } catch (emailErr) {
        console.error('[Enquiry Controller] Failed to send automated reply for manual enquiry:', emailErr.message);
      }
    }

    res.status(201).json({ status: 'success', data: { enquiry, customer } });
  } catch (err) {
    next(err);
  }
};

exports.getEnquiries = async (req, res, next) => {
  try {
    const enquiries = await Enquiry.find()
      .populate('customer', 'companyName primaryContactName mobileNumber')
      .populate('assignedTo', 'fullName')
      .populate('files')
      .sort('-createdAt');
    res.status(200).json({ status: 'success', results: enquiries.length, data: { enquiries } });
  } catch (err) {
    next(err);
  }
};

exports.getEnquiry = async (req, res, next) => {
  try {
    const enquiry = await Enquiry.findById(req.params.id)
      .populate('customer')
      .populate('assignedTo', 'fullName')
      .populate('createdBy', 'fullName')
      .populate('files');
    
    if (!enquiry) return res.status(404).json({ status: 'error', message: 'Enquiry not found' });
    res.status(200).json({ status: 'success', data: { enquiry } });
  } catch (err) {
    next(err);
  }
};

exports.updateEnquiry = async (req, res, next) => {
  try {
    req.body.lastModifiedBy = req.user._id;
    const originalEnquiry = await Enquiry.findById(req.params.id);
    if (!originalEnquiry) {
      return res.status(404).json({ status: 'error', message: 'Enquiry not found' });
    }

    // Combine dynamicFields with existing to prevent wiping out unprovided keys
    if (req.body.dynamicFields) {
      req.body.dynamicFields = { ...originalEnquiry.dynamicFields, ...req.body.dynamicFields };
    }

    let enquiry = await Enquiry.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });

    // Auto-promote status to 'Ready for Offer' if all required fields are complete
    const completion = await checkEnquiryCompletion(enquiry);
    if (completion.isComplete && ['New', 'Contacted', 'Technical Review'].includes(enquiry.status)) {
      enquiry.status = 'Ready for Offer';
      enquiry = await enquiry.save();

      if (enquiry.assignedTo) {
        await createNotification({ 
          user_id: enquiry.assignedTo, 
          type: 'SYSTEM', 
          title: '🎉 Enquiry Ready for Offer', 
          message: `Enquiry ${enquiry.enquiryId} has all required fields completed and is now Ready for Offer!`, 
          related_id: enquiry._id 
        });
      }
    }

    await logActivity({
      req,
      action: 'UPDATE',
      module: 'ENQUIRY',
      resourceId: enquiry._id,
      resourceName: enquiry.enquiryId,
      previousState: originalEnquiry.toObject(),
      newState: enquiry.toObject(),
      details: `Updated enquiry: ${enquiry.enquiryId}`
    });

    if (req.body.assignedTo && req.body.assignedTo.toString() !== originalEnquiry.assignedTo?.toString()) {
      await createNotification({ 
        user_id: req.body.assignedTo, 
        type: 'ENQUIRY_ASSIGNED', 
        title: 'Enquiry Reassigned', 
        message: `Enquiry ${enquiry.enquiryId} was assigned to you.`, 
        related_id: enquiry._id 
      });
    }

    if (req.body.status && req.body.status !== originalEnquiry.status && enquiry.assignedTo) {
      // Notify the assigned user of status change if they didn't make it
      if (enquiry.assignedTo.toString() !== req.user._id.toString()) {
        await createNotification({ 
          user_id: enquiry.assignedTo, 
          type: 'SYSTEM', 
          title: 'Enquiry Status Changed', 
          message: `Enquiry ${enquiry.enquiryId} is now ${req.body.status}.`, 
          related_id: enquiry._id 
        });
      }

      // SOW 5.4 — Status changed to Lost → notify Director + Sales Head with reason
      if (req.body.status === 'Lost') {
        await notifyRoles({
          roles: ['DIR', 'DIRECTOR', 'SALES'],
          type: 'ENQUIRY_LOST',
          title: 'Enquiry Marked Lost',
          message: `Enquiry ${enquiry.enquiryId} was lost. Reason: ${enquiry.lostReason || 'Not specified'}.`,
          related_id: enquiry._id
        });
      }
    }

    // SOW 5.4 — Priority changed to Urgent
    if (req.body.priority === 'Urgent' && originalEnquiry.priority !== 'Urgent') {
      await notifyRoles({
        roles: ['DIR', 'DIRECTOR', 'SALES'],
        type: 'URGENT_LEAD',
        title: '🚨 Priority Escalated to Urgent',
        message: `Enquiry ${enquiry.enquiryId} escalated to URGENT. Immediate action required.`,
        related_id: enquiry._id
      });
    }

    res.status(200).json({ status: 'success', data: { enquiry } });
  } catch (err) {
    next(err);
  }
};

// DELETE /api/enquiries/:id
exports.deleteEnquiry = async (req, res, next) => {
  try {
    const enquiry = await Enquiry.findById(req.params.id);
    if (!enquiry) {
      return res.status(404).json({ status: 'fail', message: 'Enquiry not found' });
    }

    await Enquiry.findByIdAndDelete(req.params.id);

    await logActivity({
      req,
      action: 'DELETE',
      module: 'ENQUIRY',
      resourceId: enquiry._id,
      resourceName: enquiry.enquiryId,
      previousState: enquiry.toObject(),
      newState: null,
      details: `Permanently deleted enquiry: ${enquiry.enquiryId}`
    });

    res.status(200).json({ status: 'success', message: 'Enquiry deleted' });
  } catch (err) {
    next(err);
  }
};
