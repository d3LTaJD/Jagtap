const Task = require('../models/Task');
const FollowUp = require('../models/FollowUp');
const { createNotification } = require('../services/notificationService');

// @desc    Create a new task
// @route   POST /api/tasks
exports.createTask = async (req, res) => {
  try {
    const { title, description, dueDate, dueTime, priority, assignedTo, linkedEnquiry, linkedQuotation, status, attachments } = req.body;

    let targetEnquiryId = linkedEnquiry || null;
    if (targetEnquiryId) {
      const mongoose = require('mongoose');
      if (!mongoose.Types.ObjectId.isValid(targetEnquiryId)) {
        const Enquiry = require('../models/Enquiry');
        const foundEnq = await Enquiry.findOne({ enquiryId: targetEnquiryId }).select('_id');
        if (foundEnq) targetEnquiryId = foundEnq._id;
      }
    }

    const initialHistory = [{
      action: 'CREATED',
      performedBy: req.user._id,
      performedByName: req.user.name || req.user.email,
      details: `Task created and assigned. Status: ${status || 'To Do'}.`,
      timestamp: new Date()
    }];

    const task = await Task.create({
      title,
      description,
      dueDate,
      dueTime,
      priority,
      status: status || 'To Do',
      assignedTo: assignedTo || req.user._id,
      linkedEnquiry: targetEnquiryId,
      linkedQuotation: linkedQuotation || null,
      attachments: attachments || [],
      createdBy: req.user._id,
      history: initialHistory
    });

    const populated = await Task.findById(task._id)
      .populate('assignedTo', 'name department')
      .populate('createdBy', 'name')
      .populate('completedBy', 'name');

    // Notify the assigned user (if different from creator)
    const targetUser = assignedTo || req.user._id;
    if (targetUser && targetUser.toString() !== req.user._id.toString()) {
      await createNotification({
        user_id: targetUser,
        type: 'TASK_ASSIGNED',
        title: 'New Task Assigned',
        message: `Task "${title}" has been assigned to you. Due: ${dueDate ? new Date(dueDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) : 'No date'}.`,
        related_id: task._id
      });
    }

    // Auto-create FollowUp entry in linked Enquiry for complete audit trail
    if (targetEnquiryId) {
      try {
        await FollowUp.create({
          enquiryId: targetEnquiryId,
          type: 'NOTE',
          notes: `📌 [Task Created] "${title}" — Assigned to ${populated.assignedTo?.name || 'Unassigned'} (Due: ${dueDate ? new Date(dueDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) : 'N/A'})`,
          outcome: 'Task Opened',
          followUpDate: new Date(),
          createdBy: req.user._id
        });
      } catch (fErr) {
        console.warn('Failed to auto-create FollowUp log for task creation:', fErr.message);
      }
    }

    res.status(201).json({ status: 'success', data: { task: populated } });
  } catch (error) {
    console.error('Create task error:', error);
    res.status(500).json({ status: 'error', message: error.message });
  }
};

// @desc    Get all tasks (with optional filters)
// @route   GET /api/tasks
exports.getTasks = async (req, res) => {
  try {
    const { status, assignedTo, priority, search, linkedEnquiry, linkedQuotation, page = 1, limit = 50, sortBy = 'createdAt', sortOrder = 'desc' } = req.query;
    
    const filter = {};
    if (status) filter.status = status;
    if (assignedTo) filter.assignedTo = assignedTo;
    if (priority) filter.priority = priority;
    if (linkedEnquiry) {
      const mongoose = require('mongoose');
      if (mongoose.Types.ObjectId.isValid(linkedEnquiry)) {
        filter.linkedEnquiry = linkedEnquiry;
      } else {
        const Enquiry = require('../models/Enquiry');
        const foundEnq = await Enquiry.findOne({ enquiryId: linkedEnquiry }).select('_id');
        if (foundEnq) {
          filter.linkedEnquiry = foundEnq._id;
        } else {
          filter.linkedEnquiry = new mongoose.Types.ObjectId();
        }
      }
    }
    if (linkedQuotation) filter.linkedQuotation = linkedQuotation;
    
    if (search) {
      filter.$or = [
        { title: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } }
      ];
    }

    const skip = (page - 1) * limit;
    const sort = { [sortBy]: sortOrder === 'desc' ? -1 : 1 };

    const tasks = await Task.find(filter)
      .populate('assignedTo', 'name department')
      .populate('createdBy', 'name')
      .populate('completedBy', 'name')
      .populate('linkedEnquiry', 'enquiryId')
      .populate('linkedQuotation', 'quotationId')
      .sort(sort)
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Task.countDocuments(filter);

    res.status(200).json({ 
      status: 'success', 
      results: tasks.length,
      total,
      data: { tasks } 
    });
  } catch (error) {
    console.error('Get tasks error:', error);
    res.status(500).json({ status: 'error', message: error.message });
  }
};

// @desc    Get single task
// @route   GET /api/tasks/:id
exports.getTask = async (req, res) => {
  try {
    const task = await Task.findById(req.params.id)
      .populate('assignedTo', 'name department')
      .populate('createdBy', 'name')
      .populate('completedBy', 'name')
      .populate('linkedEnquiry', 'enquiryId')
      .populate('linkedQuotation', 'quotationId');

    if (!task) {
      return res.status(404).json({ status: 'error', message: 'Task not found' });
    }

    res.status(200).json({ status: 'success', data: { task } });
  } catch (error) {
    res.status(500).json({ status: 'error', message: error.message });
  }
};

// @desc    Update a task
// @route   PATCH /api/tasks/:id
exports.updateTask = async (req, res) => {
  try {
    const updates = { ...req.body };
    const originalTask = await Task.findById(req.params.id);
    if (!originalTask) {
      return res.status(404).json({ status: 'error', message: 'Task not found' });
    }

    const historyEntries = originalTask.history || [];

    // Record audit entries for changes
    if (updates.status && updates.status !== originalTask.status) {
      if (updates.status === 'Done') {
        updates.completedAt = new Date();
        updates.completedBy = req.user._id;
        historyEntries.push({
          action: 'COMPLETED',
          performedBy: req.user._id,
          performedByName: req.user.name || req.user.email,
          details: `Marked task as Done.`,
          timestamp: new Date()
        });
      } else {
        updates.completedAt = null;
        updates.completedBy = null;
        historyEntries.push({
          action: 'STATUS_CHANGED',
          performedBy: req.user._id,
          performedByName: req.user.name || req.user.email,
          details: `Status changed from ${originalTask.status} to ${updates.status}.`,
          timestamp: new Date()
        });
      }
    }

    if (updates.assignedTo && updates.assignedTo.toString() !== originalTask.assignedTo?.toString()) {
      historyEntries.push({
        action: 'ASSIGNED',
        performedBy: req.user._id,
        performedByName: req.user.name || req.user.email,
        details: `Reassigned task.`,
        timestamp: new Date()
      });
    }

    updates.history = historyEntries;

    const task = await Task.findByIdAndUpdate(req.params.id, updates, { new: true, runValidators: true })
      .populate('assignedTo', 'name department')
      .populate('createdBy', 'name')
      .populate('completedBy', 'name')
      .populate('linkedEnquiry', 'enquiryId')
      .populate('linkedQuotation', 'quotationId');

    // Notify if task is reassigned to a different user
    if (updates.assignedTo && updates.assignedTo.toString() !== originalTask.assignedTo?.toString()) {
      await createNotification({
        user_id: updates.assignedTo,
        type: 'TASK_ASSIGNED',
        title: 'Task Reassigned to You',
        message: `Task "${task.title}" has been reassigned to you.`,
        related_id: task._id
      });
    }

    // Notify creator when task is marked Done
    if (updates.status === 'Done' && originalTask.status !== 'Done') {
      if (originalTask.createdBy && originalTask.createdBy.toString() !== req.user._id.toString()) {
        await createNotification({
          user_id: originalTask.createdBy,
          type: 'TASK_COMPLETED',
          title: 'Task Completed',
          message: `Task "${task.title}" has been marked as done by ${req.user.name || 'a team member'}.`,
          related_id: task._id
        });
      }

      // Auto-log completion into linked Enquiry follow-ups
      if (task.linkedEnquiry) {
        try {
          const targetEnquiryId = task.linkedEnquiry._id || task.linkedEnquiry;
          await FollowUp.create({
            enquiryId: targetEnquiryId,
            type: 'NOTE',
            notes: `✅ [Task Completed] "${task.title}" was completed by ${req.user.name || 'Super Admin'}`,
            outcome: 'Task Completed',
            followUpDate: new Date(),
            createdBy: req.user._id
          });
        } catch (fErr) {
          console.warn('Failed to auto-create FollowUp log for task completion:', fErr.message);
        }
      }
    }

    res.status(200).json({ status: 'success', data: { task } });
  } catch (error) {
    res.status(500).json({ status: 'error', message: error.message });
  }
};

// @desc    Delete a task
// @route   DELETE /api/tasks/:id
exports.deleteTask = async (req, res) => {
  try {
    const task = await Task.findByIdAndDelete(req.params.id);
    if (!task) {
      return res.status(404).json({ status: 'error', message: 'Task not found' });
    }
    res.status(200).json({ status: 'success', message: 'Task deleted' });
  } catch (error) {
    res.status(500).json({ status: 'error', message: error.message });
  }
};
