/**
 * Seed script: Creates the 9 default roles defined in Petro Valve Phase1 SOW §3.2
 * Run once: node src/scripts/seedRoles.js
 */
require('dotenv').config();
const mongoose = require('mongoose');
const Role = require('../models/Role');

const ROLES = [
  // Super Admin / SA / SUPER_ADMIN / superadmin
  {
    name: 'Super Admin', code: 'SA', department: 'Admin', description: 'System Administrator - Full system access',
    permissions: {
      Enquiry:   { view: true, create: true, edit: true, delete: true, approve: true, assign: true },
      Quotation: { view: true, create: true, edit: true, delete: true, approve: true, assign: true },
      QAP:       { view: true, create: true, edit: true, delete: true, approve: true, assign: true },
      Inventory: { view: true, create: true, edit: true, delete: true, approve: true, assign: true },
      Customers: { view: true, create: true, edit: true, delete: true, approve: true, assign: true },
      Products:  { view: true, create: true, edit: true, delete: true, approve: true, assign: true },
      Admin:     { view: true, create: true, edit: true, delete: true, approve: true, assign: true }
    }
  },
  {
    name: 'SUPER_ADMIN', code: 'SUPER_ADMIN', department: 'Admin', description: 'System Administrator - Full system access',
    permissions: {
      Enquiry:   { view: true, create: true, edit: true, delete: true, approve: true, assign: true },
      Quotation: { view: true, create: true, edit: true, delete: true, approve: true, assign: true },
      QAP:       { view: true, create: true, edit: true, delete: true, approve: true, assign: true },
      Inventory: { view: true, create: true, edit: true, delete: true, approve: true, assign: true },
      Customers: { view: true, create: true, edit: true, delete: true, approve: true, assign: true },
      Products:  { view: true, create: true, edit: true, delete: true, approve: true, assign: true },
      Admin:     { view: true, create: true, edit: true, delete: true, approve: true, assign: true }
    }
  },
  {
    name: 'superadmin', code: 'superadmin', department: 'Admin', description: 'System Administrator - Full system access',
    permissions: {
      Enquiry:   { view: true, create: true, edit: true, delete: true, approve: true, assign: true },
      Quotation: { view: true, create: true, edit: true, delete: true, approve: true, assign: true },
      QAP:       { view: true, create: true, edit: true, delete: true, approve: true, assign: true },
      Inventory: { view: true, create: true, edit: true, delete: true, approve: true, assign: true },
      Customers: { view: true, create: true, edit: true, delete: true, approve: true, assign: true },
      Products:  { view: true, create: true, edit: true, delete: true, approve: true, assign: true },
      Admin:     { view: true, create: true, edit: true, delete: true, approve: true, assign: true }
    }
  },
  // Director / Owner / DIR / DIRECTOR
  {
    name: 'Director / Owner', code: 'DIR', department: 'Management', description: 'Owner / MD - Full view and final approvals',
    permissions: {
      Enquiry:   { view: true, create: true, edit: true, delete: false, approve: true, assign: true },
      Quotation: { view: true, create: true, edit: true, delete: false, approve: true, assign: true },
      QAP:       { view: true, create: false, edit: true, delete: false, approve: true, assign: true },
      Inventory: { view: true, create: false, edit: false, delete: false, approve: false, assign: false },
      Customers: { view: true, create: true, edit: true, delete: false, approve: false, assign: false },
      Products:  { view: true, create: false, edit: false, delete: false, approve: false, assign: false },
      Admin:     { view: true, create: false, edit: false, delete: false, approve: false, assign: false }
    }
  },
  {
    name: 'DIRECTOR', code: 'DIRECTOR', department: 'Management', description: 'Owner / MD - Full view and final approvals',
    permissions: {
      Enquiry:   { view: true, create: true, edit: true, delete: false, approve: true, assign: true },
      Quotation: { view: true, create: true, edit: true, delete: false, approve: true, assign: true },
      QAP:       { view: true, create: false, edit: true, delete: false, approve: true, assign: true },
      Inventory: { view: true, create: false, edit: false, delete: false, approve: false, assign: false },
      Customers: { view: true, create: true, edit: true, delete: false, approve: false, assign: false },
      Products:  { view: true, create: false, edit: false, delete: false, approve: false, assign: false },
      Admin:     { view: true, create: false, edit: false, delete: false, approve: false, assign: false }
    }
  },
  // Technical Authority / TA / TECHNICAL_AUTHORITY
  {
    name: 'Technical Authority', code: 'TA', department: 'Design', description: 'Technical expert - Technical specifications and field config',
    permissions: {
      Enquiry:   { view: true, create: true, edit: true, delete: false, approve: false, assign: false },
      Quotation: { view: true, create: true, edit: true, delete: false, approve: true, assign: false },
      QAP:       { view: true, create: false, edit: false, delete: false, approve: false, assign: false },
      Inventory: { view: true, create: false, edit: false, delete: false, approve: false, assign: false },
      Customers: { view: true, create: false, edit: false, delete: false, approve: false, assign: false },
      Products:  { view: true, create: true, edit: true, delete: false, approve: false, assign: false },
      Admin:     { view: false, create: false, edit: false, delete: false, approve: false, assign: false }
    }
  },
  {
    name: 'TECHNICAL_AUTHORITY', code: 'TECHNICAL_AUTHORITY', department: 'Design', description: 'Technical expert - Technical specifications and field config',
    permissions: {
      Enquiry:   { view: true, create: true, edit: true, delete: false, approve: false, assign: false },
      Quotation: { view: true, create: true, edit: true, delete: false, approve: true, assign: false },
      QAP:       { view: true, create: false, edit: false, delete: false, approve: false, assign: false },
      Inventory: { view: true, create: false, edit: false, delete: false, approve: false, assign: false },
      Customers: { view: true, create: false, edit: false, delete: false, approve: false, assign: false },
      Products:  { view: true, create: true, edit: true, delete: false, approve: false, assign: false },
      Admin:     { view: false, create: false, edit: false, delete: false, approve: false, assign: false }
    }
  },
  // Sales Executive / SALES / SALES_EXECUTIVE
  {
    name: 'Sales Executive', code: 'SALES', department: 'Sales', description: 'Sales team - Enquiries and drafts',
    permissions: {
      Enquiry:   { view: true, create: true, edit: true, delete: false, approve: false, assign: false },
      Quotation: { view: true, create: true, edit: false, delete: false, approve: false, assign: false },
      QAP:       { view: false, create: false, edit: false, delete: false, approve: false, assign: false },
      Inventory: { view: false, create: false, edit: false, delete: false, approve: false, assign: false },
      Customers: { view: true, create: true, edit: true, delete: false, approve: false, assign: false },
      Products:  { view: true, create: false, edit: false, delete: false, approve: false, assign: false },
      Admin:     { view: false, create: false, edit: false, delete: false, approve: false, assign: false }
    }
  },
  {
    name: 'SALES_EXECUTIVE', code: 'SALES_EXECUTIVE', department: 'Sales', description: 'Sales team - Enquiries and drafts',
    permissions: {
      Enquiry:   { view: true, create: true, edit: true, delete: false, approve: false, assign: false },
      Quotation: { view: true, create: true, edit: false, delete: false, approve: false, assign: false },
      QAP:       { view: false, create: false, edit: false, delete: false, approve: false, assign: false },
      Inventory: { view: false, create: false, edit: false, delete: false, approve: false, assign: false },
      Customers: { view: true, create: true, edit: true, delete: false, approve: false, assign: false },
      Products:  { view: true, create: false, edit: false, delete: false, approve: false, assign: false },
      Admin:     { view: false, create: false, edit: false, delete: false, approve: false, assign: false }
    }
  },
  // Design Engineer / DE / DESIGN_ENGINEER
  {
    name: 'Design Engineer', code: 'DE', department: 'Design', description: 'Design team - Drawings and technical notes',
    permissions: {
      Enquiry:   { view: true, create: false, edit: false, delete: false, approve: false, assign: false },
      Quotation: { view: true, create: false, edit: true,  delete: false, approve: false, assign: false },
      QAP:       { view: false, create: false, edit: false, delete: false, approve: false, assign: false },
      Inventory: { view: false, create: false, edit: false, delete: false, approve: false, assign: false },
      Customers: { view: true, create: false, edit: false, delete: false, approve: false, assign: false },
      Products:  { view: true, create: false, edit: false, delete: false, approve: false, assign: false },
      Admin:     { view: false, create: false, edit: false, delete: false, approve: false, assign: false }
    }
  },
  {
    name: 'DESIGN_ENGINEER', code: 'DESIGN_ENGINEER', department: 'Design', description: 'Design team - Drawings and technical notes',
    permissions: {
      Enquiry:   { view: true, create: false, edit: false, delete: false, approve: false, assign: false },
      Quotation: { view: true, create: false, edit: true,  delete: false, approve: false, assign: false },
      QAP:       { view: false, create: false, edit: false, delete: false, approve: false, assign: false },
      Inventory: { view: false, create: false, edit: false, delete: false, approve: false, assign: false },
      Customers: { view: true, create: false, edit: false, delete: false, approve: false, assign: false },
      Products:  { view: true, create: false, edit: false, delete: false, approve: false, assign: false },
      Admin:     { view: false, create: false, edit: false, delete: false, approve: false, assign: false }
    }
  },
  // QC Engineer / QCE / QC_ENGINEER
  {
    name: 'QC Engineer', code: 'QCE', department: 'QC', description: 'QC team - Create and edit QAP',
    permissions: {
      Enquiry:   { view: true, create: false, edit: false, delete: false, approve: false, assign: false },
      Quotation: { view: true, create: false, edit: false, delete: false, approve: false, assign: false },
      QAP:       { view: true, create: true, edit: true,  delete: false, approve: false, assign: false },
      Inventory: { view: false, create: false, edit: false, delete: false, approve: false, assign: false },
      Customers: { view: false, create: false, edit: false, delete: false, approve: false, assign: false },
      Products:  { view: false, create: false, edit: false, delete: false, approve: false, assign: false },
      Admin:     { view: false, create: false, edit: false, delete: false, approve: false, assign: false }
    }
  },
  {
    name: 'QC_ENGINEER', code: 'QC_ENGINEER', department: 'QC', description: 'QC team - Create and edit QAP',
    permissions: {
      Enquiry:   { view: true, create: false, edit: false, delete: false, approve: false, assign: false },
      Quotation: { view: true, create: false, edit: false, delete: false, approve: false, assign: false },
      QAP:       { view: true, create: true, edit: true,  delete: false, approve: false, assign: false },
      Inventory: { view: false, create: false, edit: false, delete: false, approve: false, assign: false },
      Customers: { view: false, create: false, edit: false, delete: false, approve: false, assign: false },
      Products:  { view: false, create: false, edit: false, delete: false, approve: false, assign: false },
      Admin:     { view: false, create: false, edit: false, delete: false, approve: false, assign: false }
    }
  },
  // QC Supervisor / QCS / QC_SUPERVISOR
  {
    name: 'QC Supervisor', code: 'QCS', department: 'QC', description: 'QC Supervisor - Approve QAP and assign jobs',
    permissions: {
      Enquiry:   { view: true, create: false, edit: false, delete: false, approve: false, assign: false },
      Quotation: { view: true, create: false, edit: false, delete: false, approve: false, assign: false },
      QAP:       { view: true, create: true, edit: true,  delete: false, approve: true,  assign: true  },
      Inventory: { view: false, create: false, edit: false, delete: false, approve: false, assign: false },
      Customers: { view: false, create: false, edit: false, delete: false, approve: false, assign: false },
      Products:  { view: false, create: false, edit: false, delete: false, approve: false, assign: false },
      Admin:     { view: false, create: false, edit: false, delete: false, approve: false, assign: false }
    }
  },
  {
    name: 'QC_SUPERVISOR', code: 'QC_SUPERVISOR', department: 'QC', description: 'QC Supervisor - Approve QAP and assign jobs',
    permissions: {
      Enquiry:   { view: true, create: false, edit: false, delete: false, approve: false, assign: false },
      Quotation: { view: true, create: false, edit: false, delete: false, approve: false, assign: false },
      QAP:       { view: true, create: true, edit: true,  delete: false, approve: true,  assign: true  },
      Inventory: { view: false, create: false, edit: false, delete: false, approve: false, assign: false },
      Customers: { view: false, create: false, edit: false, delete: false, approve: false, assign: false },
      Products:  { view: false, create: false, edit: false, delete: false, approve: false, assign: false },
      Admin:     { view: false, create: false, edit: false, delete: false, approve: false, assign: false }
    }
  },
  // Accounts / ACC / ACCOUNTS
  {
    name: 'Accounts', code: 'ACC', department: 'Accounts', description: 'Accounts team - Commercial and payment terms',
    permissions: {
      Enquiry:   { view: true, create: false, edit: false, delete: false, approve: false, assign: false },
      Quotation: { view: true, create: false, edit: false, delete: false, approve: false, assign: false },
      QAP:       { view: false, create: false, edit: false, delete: false, approve: false, assign: false },
      Inventory: { view: true, create: false, edit: false, delete: false, approve: false, assign: false },
      Customers: { view: true, create: false, edit: false, delete: false, approve: false, assign: false },
      Products:  { view: false, create: false, edit: false, delete: false, approve: false, assign: false },
      Admin:     { view: false, create: false, edit: false, delete: false, approve: false, assign: false }
    }
  },
  {
    name: 'ACCOUNTS', code: 'ACCOUNTS', department: 'Accounts', description: 'Accounts team - Commercial and payment terms',
    permissions: {
      Enquiry:   { view: true, create: false, edit: false, delete: false, approve: false, assign: false },
      Quotation: { view: true, create: false, edit: false, delete: false, approve: false, assign: false },
      QAP:       { view: false, create: false, edit: false, delete: false, approve: false, assign: false },
      Inventory: { view: true, create: false, edit: false, delete: false, approve: false, assign: false },
      Customers: { view: true, create: false, edit: false, delete: false, approve: false, assign: false },
      Products:  { view: false, create: false, edit: false, delete: false, approve: false, assign: false },
      Admin:     { view: false, create: false, edit: false, delete: false, approve: false, assign: false }
    }
  },
  // Management Viewer / MGR / MANAGEMENT_VIEWER
  {
    name: 'Management Viewer', code: 'MGR', department: 'Management', description: 'Management read-only dashboards',
    permissions: {
      Enquiry:   { view: true, create: false, edit: false, delete: false, approve: false, assign: false },
      Quotation: { view: true, create: false, edit: false, delete: false, approve: false, assign: false },
      QAP:       { view: true, create: false, edit: false, delete: false, approve: false, assign: false },
      Inventory: { view: true, create: false, edit: false, delete: false, approve: false, assign: false },
      Customers: { view: true, create: false, edit: false, delete: false, approve: false, assign: false },
      Products:  { view: true, create: false, edit: false, delete: false, approve: false, assign: false },
      Admin:     { view: false, create: false, edit: false, delete: false, approve: false, assign: false }
    }
  },
  {
    name: 'MANAGEMENT_VIEWER', code: 'MANAGEMENT_VIEWER', department: 'Management', description: 'Management read-only dashboards',
    permissions: {
      Enquiry:   { view: true, create: false, edit: false, delete: false, approve: false, assign: false },
      Quotation: { view: true, create: false, edit: false, delete: false, approve: false, assign: false },
      QAP:       { view: true, create: false, edit: false, delete: false, approve: false, assign: false },
      Inventory: { view: true, create: false, edit: false, delete: false, approve: false, assign: false },
      Customers: { view: true, create: false, edit: false, delete: false, approve: false, assign: false },
      Products:  { view: true, create: false, edit: false, delete: false, approve: false, assign: false },
      Admin:     { view: false, create: false, edit: false, delete: false, approve: false, assign: false }
    }
  }
];

const seed = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI || process.env.MONGO_URI || 'mongodb://localhost:27017/petro-valve');
    console.log('MongoDB connected');

    let created = 0, skipped = 0;

    for (const role of ROLES) {
      const exists = await Role.findOne({ code: role.code });
      if (exists) {
        console.log(`  SKIP: ${role.name} (${role.code}) already exists`);
        skipped++;
      } else {
        await Role.create(role);
        console.log(`  ✅ Created: ${role.name} (${role.code})`);
        created++;
      }
    }

    console.log(`\nDone. Created: ${created}, Skipped: ${skipped}`);
    process.exit(0);
  } catch (err) {
    console.error('Seed failed:', err.message);
    process.exit(1);
  }
};

seed();
