const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  userId: { type: String, unique: true, sparse: true },   // USR-NNNN — auto-generated
  name: { type: String, required: true },
  displayName: { type: String },
  initials: { type: String, trim: true },                        // Single/multi-character code e.g. 'J' for Offer No                        // Short name shown in mobile header
  mobile_number: { type: String, required: true, unique: true },
  email: { type: String, required: true, unique: true, lowercase: true },
  password: { type: String },
  role: { type: String, required: true },
  secondaryRole: { type: String, default: null },
  department: {
    type: String,
    enum: ['Sales', 'Design', 'QC', 'Purchase', 'Accounts', 'Production', 'Management', 'Admin', ''],
    default: ''
  },
  profilePhoto: { type: String },                       // URL / base64 path
  loginMethod: {
    type: String,
    enum: ['password', 'otp', 'both'],
    default: 'password'
  },
  is_active: { type: Boolean, default: true },
  is_verified: { type: Boolean, default: false },
  last_login: { type: Date }
}, { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } });

// Hash password before saving
userSchema.pre('save', async function(next) {
  if (!this.isModified('password') || !this.password) return next();
  this.password = await bcrypt.hash(this.password, 12);
  next();
});

// Compare password
userSchema.methods.comparePassword = async function(candidatePassword) {
  if (!this.password) return false;
  return await bcrypt.compare(candidatePassword, this.password);
};

module.exports = mongoose.model('User', userSchema);
