const mongoose = require('mongoose');

const taskSchema = new mongoose.Schema({
  taskId: { type: String, unique: true }, // TASK-YYYY-MM-NNNN
  title: { type: String, required: true, maxlength: 200 },
  description: { type: String, maxlength: 10000 },

  // Scheduling
  dueDate: { type: Date, required: true },
  dueTime: { type: String }, // HH:mm format e.g. "14:30"

  priority: { type: String, enum: ['Urgent', 'High', 'Medium', 'Low'], default: 'Medium' },
  status: {
    type: String,
    enum: ['To Do', 'In Progress', 'Done', 'Cancelled'],
    default: 'To Do'
  },

  assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },

  // Optional link to Enquiry / Quotation for reference (not required)
  linkedEnquiry: { type: mongoose.Schema.Types.ObjectId, ref: 'Enquiry', default: null },
  linkedQuotation: { type: mongoose.Schema.Types.ObjectId, ref: 'Quotation', default: null },

  // Attachments uploaded for this task
  attachments: [{
    fileName: String,
    fileKey: String,
    originalName: String,
    mimeType: String,
    size: Number,
    uploadedAt: { type: Date, default: Date.now }
  }],

  completedAt: { type: Date, default: null },
  completedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },

  // Comprehensive audit history log
  history: [{
    action: { type: String, required: true }, // 'CREATED', 'ASSIGNED', 'STATUS_CHANGED', 'COMPLETED', 'FILE_ATTACHED', 'EDITED'
    performedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    performedByName: { type: String },
    details: { type: String },
    timestamp: { type: Date, default: Date.now }
  }],
}, { timestamps: true });

// Auto-generate taskId before saving
taskSchema.pre('save', async function(next) {
  if (!this.taskId) {
    const now = new Date();
    const yyyy = now.getFullYear();
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const prefix = `TASK-${yyyy}-${mm}-`;
    try {
      const { getNextSequenceValue } = require('../utils/counter');
      let seq = await getNextSequenceValue(prefix);
      let taskId = `${prefix}${String(seq).padStart(4, '0')}`;
      
      // Self-healing check: loop to bypass any legacy/colliding task IDs
      let exists = await mongoose.model('Task').findOne({ taskId });
      while (exists) {
        seq = await getNextSequenceValue(prefix);
        taskId = `${prefix}${String(seq).padStart(4, '0')}`;
        exists = await mongoose.model('Task').findOne({ taskId });
      }
      
      this.taskId = taskId;
    } catch (err) {
      return next(err);
    }
  }
  next();
});

taskSchema.index({ status: 1 });
taskSchema.index({ assignedTo: 1 });
taskSchema.index({ dueDate: 1 });

module.exports = mongoose.model('Task', taskSchema);
