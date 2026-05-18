/**
 * Seed script: Creates the 9 default roles defined in Petro Valve Phase1 SOW §3.2
 * Run once: node src/scripts/seedRoles.js
 */
require('dotenv').config();
const mongoose = require('mongoose');
const Role = require('../models/Role');

const ROLES = [
  {
    name: 'Super Admin',
    code: 'SA',
    description: 'Full system access. Manage roles, fields, users, settings, audit log. Cannot be deleted or impersonated.',
    department: 'Admin',
    permissions: {
      Enquiry:   { view: true,  create: true,  edit: true,  delete: true,  approve: true,  assign: true  },
      Quotation: { view: true,  create: true,  edit: true,  delete: true,  approve: true,  assign: true  },
      QAP:       { view: true,  create: true,  edit: true,  delete: true,  approve: true,  assign: true  },
      Inventory: { view: true,  create: true,  edit: true,  delete: true,  approve: true,  assign: true  },
      Customers: { view: true,  create: true,  edit: true,  delete: true,  approve: true,  assign: true  },
      Products:  { view: true,  create: true,  edit: true,  delete: true,  approve: true,  assign: true  },
      Admin:     { view: true,  create: true,  edit: true,  delete: true,  approve: true,  assign: true  },
    }
  },
  {
    name: 'Director / Owner',
    code: 'DIR',
    description: 'Full view of all records. Approve quotations, finalise QAP. Override any record. All dashboards.',
    department: 'Management',
    permissions: {
      Enquiry:   { view: true,  create: true,  edit: true,  delete: true,  approve: true,  assign: true  },
      Quotation: { view: true,  create: true,  edit: true,  delete: false, approve: true,  assign: true  },
      QAP:       { view: true,  create: false, edit: true,  delete: false, approve: true,  assign: true  },
      Inventory: { view: true,  create: false, edit: false, delete: false, approve: false, assign: false },
      Customers: { view: true,  create: true,  edit: true,  delete: false, approve: false, assign: false },
      Products:  { view: true,  create: false, edit: false, delete: false, approve: false, assign: false },
      Admin:     { view: true,  create: false, edit: false, delete: false, approve: false, assign: false },
    }
  },
  {
    name: 'Technical Authority',
    code: 'TA',
    description: 'Create/edit technical section of all enquiries and quotations. Approve technical specification. Manage product field config.',
    department: 'Design',
    permissions: {
      Enquiry:   { view: true,  create: true,  edit: true,  delete: false, approve: false, assign: false },
      Quotation: { view: true,  create: true,  edit: true,  delete: false, approve: true,  assign: false },
      QAP:       { view: true,  create: false, edit: false, delete: false, approve: false, assign: false },
      Inventory: { view: true,  create: false, edit: false, delete: false, approve: false, assign: false },
      Customers: { view: true,  create: false, edit: false, delete: false, approve: false, assign: false },
      Products:  { view: true,  create: true,  edit: true,  delete: false, approve: false, assign: false },
      Admin:     { view: false, create: false, edit: false, delete: false, approve: false, assign: false },
    }
  },
  {
    name: 'Sales Executive',
    code: 'SALES',
    description: 'Create enquiries, manage follow-ups, create quotation drafts. Cannot approve own quotations. Cannot edit pricing.',
    department: 'Sales',
    permissions: {
      Enquiry:   { view: true,  create: true,  edit: true,  delete: false, approve: false, assign: false },
      Quotation: { view: true,  create: true,  edit: false, delete: false, approve: false, assign: false },
      QAP:       { view: false, create: false, edit: false, delete: false, approve: false, assign: false },
      Inventory: { view: false, create: false, edit: false, delete: false, approve: false, assign: false },
      Customers: { view: true,  create: true,  edit: true,  delete: false, approve: false, assign: false },
      Products:  { view: true,  create: false, edit: false, delete: false, approve: false, assign: false },
      Admin:     { view: false, create: false, edit: false, delete: false, approve: false, assign: false },
    }
  },
  {
    name: 'Design Engineer',
    code: 'DE',
    description: 'View enquiries and quotations. Upload/manage drawings linked to enquiries. Create design notes on quotations.',
    department: 'Design',
    permissions: {
      Enquiry:   { view: true,  create: false, edit: false, delete: false, approve: false, assign: false },
      Quotation: { view: true,  create: false, edit: true,  delete: false, approve: false, assign: false },
      QAP:       { view: false, create: false, edit: false, delete: false, approve: false, assign: false },
      Inventory: { view: false, create: false, edit: false, delete: false, approve: false, assign: false },
      Customers: { view: true,  create: false, edit: false, delete: false, approve: false, assign: false },
      Products:  { view: true,  create: false, edit: false, delete: false, approve: false, assign: false },
      Admin:     { view: false, create: false, edit: false, delete: false, approve: false, assign: false },
    }
  },
  {
    name: 'QC Engineer',
    code: 'QCE',
    description: 'View quotations linked to their jobs. Create and edit QAP. Upload inspection records. Cannot approve QAP.',
    department: 'QC',
    permissions: {
      Enquiry:   { view: true,  create: false, edit: false, delete: false, approve: false, assign: false },
      Quotation: { view: true,  create: false, edit: false, delete: false, approve: false, assign: false },
      QAP:       { view: true,  create: true,  edit: true,  delete: false, approve: false, assign: false },
      Inventory: { view: false, create: false, edit: false, delete: false, approve: false, assign: false },
      Customers: { view: false, create: false, edit: false, delete: false, approve: false, assign: false },
      Products:  { view: false, create: false, edit: false, delete: false, approve: false, assign: false },
      Admin:     { view: false, create: false, edit: false, delete: false, approve: false, assign: false },
    }
  },
  {
    name: 'QC Supervisor',
    code: 'QCS',
    description: 'All QC Engineer access + approve QAP checklist items. Sign MTC entries. Assign QC jobs.',
    department: 'QC',
    permissions: {
      Enquiry:   { view: true,  create: false, edit: false, delete: false, approve: false, assign: false },
      Quotation: { view: true,  create: false, edit: false, delete: false, approve: false, assign: false },
      QAP:       { view: true,  create: true,  edit: true,  delete: false, approve: true,  assign: true  },
      Inventory: { view: false, create: false, edit: false, delete: false, approve: false, assign: false },
      Customers: { view: false, create: false, edit: false, delete: false, approve: false, assign: false },
      Products:  { view: false, create: false, edit: false, delete: false, approve: false, assign: false },
      Admin:     { view: false, create: false, edit: false, delete: false, approve: false, assign: false },
    }
  },
  {
    name: 'Accounts',
    code: 'ACC',
    description: 'View quotation commercial section, payment terms. Track invoices. No technical or QC access.',
    department: 'Accounts',
    permissions: {
      Enquiry:   { view: true,  create: false, edit: false, delete: false, approve: false, assign: false },
      Quotation: { view: true,  create: false, edit: false, delete: false, approve: false, assign: false },
      QAP:       { view: false, create: false, edit: false, delete: false, approve: false, assign: false },
      Inventory: { view: true,  create: false, edit: false, delete: false, approve: false, assign: false },
      Customers: { view: true,  create: false, edit: false, delete: false, approve: false, assign: false },
      Products:  { view: false, create: false, edit: false, delete: false, approve: false, assign: false },
      Admin:     { view: false, create: false, edit: false, delete: false, approve: false, assign: false },
    }
  },
  {
    name: 'Management Viewer',
    code: 'MGR',
    description: 'Read-only dashboards and reports across all modules. Cannot create or edit any record.',
    department: 'Management',
    permissions: {
      Enquiry:   { view: true,  create: false, edit: false, delete: false, approve: false, assign: false },
      Quotation: { view: true,  create: false, edit: false, delete: false, approve: false, assign: false },
      QAP:       { view: true,  create: false, edit: false, delete: false, approve: false, assign: false },
      Inventory: { view: true,  create: false, edit: false, delete: false, approve: false, assign: false },
      Customers: { view: true,  create: false, edit: false, delete: false, approve: false, assign: false },
      Products:  { view: true,  create: false, edit: false, delete: false, approve: false, assign: false },
      Admin:     { view: false, create: false, edit: false, delete: false, approve: false, assign: false },
    }
  },
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
