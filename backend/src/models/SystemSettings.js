const mongoose = require('mongoose');

const systemSettingsSchema = new mongoose.Schema({
  // Singleton — only one doc ever exists
  _singleton: { type: String, default: 'global', unique: true },

  // ─── 4.2 Company Information ──────────────────────────────────
  companyName:       { type: String, default: 'Petro Valve' },
  companyLogo:       { type: String, default: '' },       // URL or base64
  gstin:             { type: String, default: '' },
  pan:               { type: String, default: '' },
  registeredAddress: { type: String, default: '' },

  // ─── Communication / Integrations ─────────────────────────────
  smtpHost:          { type: String, default: '' },
  smtpPort:          { type: Number, default: 587 },
  smtpUser:          { type: String, default: '' },
  smtpPass:          { type: String, default: '' },       // will be left blank
  smtpFromName:      { type: String, default: 'Petro Valve Notifications' },
  whatsappApiKey:    { type: String, default: '' },       // Twilio/Gupshup — blank for now
  firebaseConfig:    { type: String, default: '' },       // FCM server key — blank for now

  // ─── Operational Defaults ──────────────────────────────────────
  defaultGSTRate:    { type: Number, default: 18 },       // 0 / 5 / 12 / 18 / 28
  quotationValidity: { type: Number, default: 30 },       // days
  followupReminderDays:    { type: Number, default: 2 },  // days after enquiry creation
  escalationThresholdDays: { type: Number, default: 5 },  // days of inactivity before alert
  quoteAbandonDays:        { type: Number, default: 60 }, // days — auto-flag as stale

  // ─── Bank Details (printed on quotation PDF) ──────────────────
  bankName:          { type: String, default: '' },
  bankAccountNumber: { type: String, default: '' },
  ifscCode:          { type: String, default: '' },
  upiId:             { type: String, default: '' },

  // ─── Notification Rules ─────────────────────────────────────────
  notificationRules: {
    enquiryCreated: { email: { type: Boolean, default: true }, whatsapp: { type: Boolean, default: false } },
    quotationApproved: { email: { type: Boolean, default: true }, whatsapp: { type: Boolean, default: true } },
    followupDue: { email: { type: Boolean, default: true }, whatsapp: { type: Boolean, default: false } },
    taskAssigned: { email: { type: Boolean, default: true }, whatsapp: { type: Boolean, default: false } },
    lowInventory: { email: { type: Boolean, default: true }, whatsapp: { type: Boolean, default: false } }
  }

}, { timestamps: true });

module.exports = mongoose.model('SystemSettings', systemSettingsSchema);
