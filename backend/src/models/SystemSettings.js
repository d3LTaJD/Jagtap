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
  followupIntervals:       { type: [Number], default: [1, 3, 7] }, // D+1, D+3, D+7 days
  escalationThresholdDays: { type: Number, default: 5 },  // days of inactivity before alert
  quoteAbandonDays:        { type: Number, default: 60 }, // days — auto-flag as stale

  // ─── M3 TDS / Drawing Management Defaults ─────────────────────
  drawingDelayThresholdDays: { type: Number, default: 3 }, // days before drawing delay escalates to Director
  vendorDrawingSlaDays:      { type: Number, default: 5 }, // default SLA days for vendor drawing delivery

  // ─── M4 Purchase & BOM Defaults ────────────────────────────────
  piPriceTolerancePercent:   { type: Number, default: 5 }, // % allowable price variation before flagging deviation
  piQuantityTolerancePercent:{ type: Number, default: 0 }, // % allowable quantity variation
  piDeliveryToleranceDays:   { type: Number, default: 2 }, // days of allowable delivery delay before flagging deviation
  defaultVendorLeadTimeDays: { type: Number, default: 15 },// default vendor manufacturing + transit days
  defaultQcInspectionDays:   { type: Number, default: 3 }, // default QC testing days
  defaultMachiningBufferDays:{ type: Number, default: 5 }, // default assembly / buffer days

  // ─── Bank Details (printed on quotation PDF) ──────────────────
  bankName:          { type: String, default: '' },
  bankAccountNumber: { type: String, default: '' },
  ifscCode:          { type: String, default: '' },
  upiId:             { type: String, default: '' },

  // ─── Notification Rules ─────────────────────────────────────────
  notificationRules: {
    enquiryCreated: { email: { type: Boolean, default: true }, whatsapp: { type: Boolean, default: false } },
    quotationApproved: { email: { type: Boolean, default: true }, whatsapp: { type: Boolean, default: true } },
    drawingAssigned: { email: { type: Boolean, default: true }, whatsapp: { type: Boolean, default: true } },
    vendorSlaBreached: { email: { type: Boolean, default: true }, whatsapp: { type: Boolean, default: true } },
    drawingEscalated: { email: { type: Boolean, default: true }, whatsapp: { type: Boolean, default: true } },
    followupDue: { email: { type: Boolean, default: true }, whatsapp: { type: Boolean, default: false } },
    taskAssigned: { email: { type: Boolean, default: true }, whatsapp: { type: Boolean, default: false } },
    lowInventory: { email: { type: Boolean, default: true }, whatsapp: { type: Boolean, default: false } }
  },

  // ─── Auto-Acknowledgement Config per Email Account ──────────────
  emailAccountsConfig: {
    info: {
      autoReply: { type: Boolean, default: true },
      subjectTemplate: { type: String, default: 'Acknowledgement: Enquiries Registered [Ref: {refs}]' },
      bodyTemplate: { type: String, default: 'Dear {contactName},\n\nThank you for your enquiry. We have successfully registered/updated your requests in our system:\n\n{itemsText}\n\nOur sales team is preparing your commercial quotation and will get in touch shortly.\n\nBest regards,\nPetro Valve AI Team' }
    },
    sales: {
      autoReply: { type: Boolean, default: true },
      subjectTemplate: { type: String, default: 'Acknowledgement: Enquiries Registered [Ref: {refs}]' },
      bodyTemplate: { type: String, default: 'Dear {contactName},\n\nThank you for your enquiry. We have successfully registered/updated your requests in our system:\n\n{itemsText}\n\nOur sales team is preparing your commercial quotation and will get in touch shortly.\n\nBest regards,\nPetro Valve AI Team' }
    },
    support: {
      autoReply: { type: Boolean, default: true },
      subjectTemplate: { type: String, default: 'Acknowledgement: Enquiries Registered [Ref: {refs}]' },
      bodyTemplate: { type: String, default: 'Dear {contactName},\n\nThank you for your enquiry. We have successfully registered/updated your requests in our system:\n\n{itemsText}\n\nOur sales team is preparing your commercial quotation and will get in touch shortly.\n\nBest regards,\nPetro Valve AI Team' }
    }
  }

}, { timestamps: true });

module.exports = mongoose.model('SystemSettings', systemSettingsSchema);
