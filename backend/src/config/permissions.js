/**
 * ============================================================================
 * CENTRALIZED RBAC PERMISSION MATRIX — Single Source of Truth
 * ============================================================================
 * This file contains the exact SOW permission matrix for Petro Valve Phase 1.
 * 
 * ALL permission decisions in the backend (middleware, controllers) and
 * frontend (hooks, components) MUST reference this file.
 * 
 * DO NOT hardcode role checks anywhere else.
 * DO NOT duplicate this matrix.
 * 
 * Roles: SA, DIR, TA, SALES, DE, QCE, QCS, ACC, MGR
 * ============================================================================
 */

// ── Role normalization (maps all aliases → short codes) ──────────────────────
const ROLE_ALIASES = {
  'SA':    ['SA', 'SUPER_ADMIN', 'SUPERADMIN', 'super_admin', 'superadmin'],
  'DIR':   ['DIR', 'DIRECTOR', 'director'],
  'TA':    ['TA', 'TECHNICAL_AUTHORITY', 'TECHNICALAUTHORITY', 'technical_authority', 'technicalauthority'],
  'PM':    ['PM', 'PURCHASE_MANAGER', 'PURCHASEMANAGER', 'purchase_manager', 'purchasemanager'],
  'SALES': ['SALES', 'SALES_EXECUTIVE', 'SALESEXECUTIVE', 'sales_executive', 'salesexecutive'],
  'DE':    ['DE', 'DESIGN_ENGINEER', 'DESIGNENGINEER', 'design_engineer', 'designengineer'],
  'QCE':   ['QCE', 'QC_ENGINEER', 'QCENGINEER', 'qc_engineer', 'qcengineer'],
  'QCS':   ['QCS', 'QC_SUPERVISOR', 'QCSUPERVISOR', 'qc_supervisor', 'qcsupervisor'],
  'ACC':   ['ACC', 'ACCOUNTS', 'accounts'],
  'MGR':   ['MGR', 'MANAGEMENT_VIEWER', 'MANAGEMENTVIEWER', 'management_viewer', 'managementviewer', 'manager']
};

const normalizeRole = (role) => {
  if (!role) return '';
  const upper = role.toUpperCase().trim();
  for (const [code, aliases] of Object.entries(ROLE_ALIASES)) {
    if (code === upper || aliases.some(a => a.toUpperCase() === upper)) {
      return code;
    }
  }
  return upper;
};

/**
 * Get all normalized role codes for a user (primary + secondary, deduplicated).
 */
const getUserRoles = (user) => {
  const roles = new Set();
  if (user?.role) roles.add(normalizeRole(user.role));
  if (user?.secondaryRole) roles.add(normalizeRole(user.secondaryRole));
  roles.delete('');
  return [...roles];
};

// ── SOW PERMISSION MATRIX ────────────────────────────────────────────────────
// Format: { ModuleName: { action: [allowed role codes] } }
// Only roles listed have access. All others are denied.

const PERMISSION_MATRIX = {
  // ── MODULE 0: ADMIN & CONFIGURATION ──────────────────────────────────────
  Admin: {
    // Dynamic field builder
    fieldBuilder:        ['SA'],
    // Role & permission management
    roleManageRead:      ['SA', 'DIR'],
    roleManageWrite:     ['SA'],
    // User create / deactivate
    userManageRead:      ['SA', 'DIR'],
    userManageWrite:     ['SA'],
    // Notification template edit
    notificationEdit:    ['SA', 'DIR'],
    // Master data (customers, products) — write
    masterDataWrite:     ['SA', 'DIR', 'TA'],
    // Product category field config
    productCategoryConfig: ['SA', 'DIR', 'TA'],
    // Audit log view
    auditLogView:        ['SA', 'DIR'],
    // Settings
    settingsRead:        ['SA', 'DIR'],
    settingsWrite:       ['SA', 'DIR'],
  },

  // ── MODULE 1: ENQUIRY ────────────────────────────────────────────────────
  Enquiry: {
    view:      ['SA', 'DIR', 'TA', 'SALES', 'DE', 'ACC', 'MGR'],
    create:    ['SA', 'DIR', 'TA', 'SALES'],
    edit:      ['SA', 'DIR', 'TA', 'SALES'],
    assign:    ['SA', 'DIR', 'TA'],
    setPriority: ['SA', 'DIR', 'TA', 'SALES'],
    markStatus:  ['SA', 'DIR', 'TA', 'SALES'],  // Won / Lost / On Hold
    delete:    ['SA', 'DIR'],
    export:    ['SA', 'DIR', 'TA', 'SALES', 'MGR'],
  },

  // ── MODULE 2: FOLLOW-UP ─────────────────────────────────────────────────
  FollowUp: {
    view:           ['SA', 'DIR', 'TA', 'SALES', 'MGR'],
    create:         ['SA', 'DIR', 'TA', 'SALES'],
    edit:           ['SA', 'DIR', 'TA', 'SALES'],
    delete:         ['SA', 'DIR', 'TA'],
    setNextDate:    ['SA', 'DIR', 'TA', 'SALES'],
    escalationRules: ['SA', 'DIR'],
    overrideReminder: ['SA', 'DIR', 'TA'],
  },

  // ── MODULE 3: QUOTATION ──────────────────────────────────────────────────
  Quotation: {
    view:                 ['SA', 'DIR', 'TA', 'SALES', 'DE', 'QCE', 'QCS', 'ACC', 'MGR'],
    create:               ['SA', 'DIR', 'TA', 'SALES'],
    editTechnical:        ['SA', 'DIR', 'TA', 'QCS', 'QCE'],
    editCommercial:       ['SA', 'DIR', 'SALES'],
    routeToQc:            ['SA', 'DIR', 'TA', 'SALES'],
    submitTechnicalReview: ['SA', 'DIR', 'QCS', 'QCE'],
    checkerReview:        ['SA', 'DIR', 'MGR'],
    approve:              ['SA', 'DIR'],
    sendToClient:         ['SA', 'DIR', 'SALES'],
    unlockTechnical:      ['SA', 'DIR'],
    linkDrawing:          ['SA', 'DIR', 'TA', 'DE'],
    viewPricing:          ['SA', 'DIR', 'ACC', 'SALES', 'MGR'],
    export:               ['SA', 'DIR', 'TA', 'SALES', 'DE', 'QCE', 'QCS', 'ACC', 'MGR'],
  },

  // ── MODULE 4: QAP ───────────────────────────────────────────────────────
  QAP: {
    view:             ['SA', 'DIR', 'TA', 'SALES', 'DE', 'QCE', 'QCS', 'MGR'],
    generateDraft:    ['SA', 'DIR', 'QCE', 'QCS'],
    editActivities:   ['SA', 'DIR', 'TA', 'QCE', 'QCS'],
    approveChecklist: ['SA', 'DIR', 'QCS'],
    finalSignOff:     ['SA', 'DIR'],
    sendToClient:     ['SA', 'DIR', 'TA', 'SALES', 'QCS'],
    downloadPdf:      ['SA', 'DIR', 'TA', 'SALES', 'QCE', 'QCS', 'MGR'],
    digitalSignature: ['SA', 'DIR', 'TA', 'QCS'],
  },

  // ── MODULE 5: DASHBOARD ─────────────────────────────────────────────────
  Dashboard: {
    viewOwn:          ['SA', 'DIR', 'TA', 'SALES', 'DE', 'QCE', 'QCS', 'ACC', 'MGR'],
    viewFullPipeline: ['SA', 'DIR', 'TA', 'SALES', 'QCS', 'ACC', 'MGR'],
    viewFinancials:   ['SA', 'DIR', 'ACC', 'MGR'],
    exportReports:    ['SA', 'DIR', 'TA', 'SALES', 'QCE', 'QCS', 'ACC', 'MGR'],
    configureWidgets: ['SA', 'DIR'],
  },

  // ── MODULE 6: TASKS & EMAIL ─────────────────────────────────────────────
  Tasks: {
    view:   ['SA', 'DIR', 'TA', 'SALES', 'DE', 'QCE', 'QCS', 'ACC', 'MGR'],
    create: ['SA', 'DIR', 'TA', 'SALES', 'DE', 'QCE', 'QCS'],
    edit:   ['SA', 'DIR', 'TA', 'SALES', 'DE', 'QCE', 'QCS'],
    delete: ['SA', 'DIR', 'TA'],
  },

  Email: {
    send: ['SA', 'DIR', 'TA', 'SALES'],
  },

  // ── MASTER DATA (Customers, Products, Vendors, MasterData) ──────────────
  Customers: {
    view:   ['SA', 'DIR', 'TA', 'SALES', 'DE', 'QCE', 'QCS', 'ACC', 'MGR'],
    create: ['SA', 'DIR', 'TA'],
    edit:   ['SA', 'DIR', 'TA'],
    delete: ['SA', 'DIR', 'TA'],
  },

  Products: {
    view:   ['SA', 'DIR', 'TA', 'SALES', 'DE', 'QCE', 'QCS', 'ACC', 'MGR'],
    create: ['SA', 'DIR', 'TA'],
    edit:   ['SA', 'DIR', 'TA'],
    delete: ['SA', 'DIR', 'TA'],
  },

  Vendors: {
    view:   ['SA', 'DIR', 'TA', 'SALES', 'DE', 'QCE', 'QCS', 'ACC', 'MGR'],
    create: ['SA', 'DIR', 'TA'],
    edit:   ['SA', 'DIR', 'TA'],
    delete: ['SA', 'DIR', 'TA'],
  },

  MasterData: {
    view:   ['SA', 'DIR', 'TA', 'SALES', 'DE', 'QCE', 'QCS', 'ACC', 'MGR'],
    create: ['SA', 'DIR', 'TA'],
    edit:   ['SA', 'DIR', 'TA'],
    delete: ['SA', 'DIR', 'TA'],
  },

  // ── MODULE 7: TDS / DRAWING MANAGEMENT ────────────────────────────────────
  Drawing: {
    view:    ['SA', 'DIR', 'TA', 'SALES', 'DE', 'QCE', 'QCS', 'ACC', 'MGR'],
    create:  ['SA', 'DIR', 'TA', 'DE', 'SALES'],
    edit:    ['SA', 'DIR', 'TA', 'DE', 'QCS'],
    approve: ['SA', 'DIR', 'TA', 'DE', 'QCS'],
    reject:  ['SA', 'DIR', 'TA', 'DE', 'QCS'],
    delete:  ['SA', 'DIR'],
  },

  // ── MODULE 8: WORK ORDERS & PRODUCTION GATING ────────────────────────────
  WorkOrder: {
    view:    ['SA', 'DIR', 'TA', 'SALES', 'DE', 'QCE', 'QCS', 'ACC', 'MGR'],
    create:  ['SA', 'DIR', 'TA', 'SALES'],
    edit:    ['SA', 'DIR', 'TA', 'QCS'],
    release: ['SA', 'DIR', 'TA', 'QCS'], // subject to authoritative hard backend drawing gate!
    delete:  ['SA', 'DIR'],
  },

  // ── MODULE 9: BILL OF MATERIALS (BOM) ────────────────────────────────────
  BOM: {
    view:    ['SA', 'DIR', 'TA', 'SALES', 'DE', 'QCE', 'QCS', 'ACC', 'MGR'],
    create:  ['SA', 'DIR', 'TA', 'DE', 'SALES'],
    edit:    ['SA', 'DIR', 'TA', 'DE'],
    confirm: ['SA', 'DIR', 'TA'],
    delete:  ['SA', 'DIR'],
  },

  // ── MODULE 10: PURCHASE & VENDOR PROFORMA INVOICES ───────────────────────
  Purchase: {
    view:        ['SA', 'DIR', 'TA', 'PM', 'SALES', 'DE', 'QCE', 'QCS', 'ACC', 'MGR'],
    createPR:    ['SA', 'DIR', 'TA', 'PM', 'DE'],
    createPO:    ['SA', 'DIR', 'TA', 'PM'],
    editPO:      ['SA', 'DIR', 'TA', 'PM'],
    reconcilePI: ['SA', 'DIR', 'TA', 'PM', 'ACC'],
    overridePI:  ['SA', 'DIR', 'TA', 'PM'],
    delete:      ['SA', 'DIR'],
  },
};

// ── HELPER FUNCTIONS ─────────────────────────────────────────────────────────

/**
 * Check if a user has permission for a specific module + action.
 * Evaluates BOTH primary and secondary roles (additive).
 * 
 * @param {Object} user - User object with .role and .secondaryRole
 * @param {string} moduleName - Key from PERMISSION_MATRIX
 * @param {string} action - Action key within the module
 * @returns {boolean}
 */
const hasPermission = (user, moduleName, action) => {
  const userRoles = getUserRoles(user);
  
  // SA always has full access
  if (userRoles.includes('SA')) return true;
  
  const modulePerms = PERMISSION_MATRIX[moduleName];
  if (!modulePerms) return false;
  
  const allowedRoles = modulePerms[action];
  if (!allowedRoles) return false;
  
  return userRoles.some(role => allowedRoles.includes(role));
};

/**
 * Shortcut: can view?
 */
const canView = (user, moduleName) => hasPermission(user, moduleName, 'view');

/**
 * Shortcut: can edit? (uses 'edit' action; for modules with split edit, use hasPermission directly)
 */
const canEdit = (user, moduleName) => hasPermission(user, moduleName, 'edit');

/**
 * Shortcut: can create?
 */
const canCreate = (user, moduleName) => hasPermission(user, moduleName, 'create');

/**
 * Shortcut: can delete?
 */
const canDelete = (user, moduleName) => hasPermission(user, moduleName, 'delete');

/**
 * Shortcut: can approve?
 */
const canApprove = (user, moduleName) => hasPermission(user, moduleName, 'approve');

/**
 * Build a flat permissions object for a user (used in login response / API endpoint).
 * This merges primary + secondary role permissions and returns the full map.
 * Format: { ModuleName: { action: true/false } }
 */
const buildPermissionsForUser = (user) => {
  const userRoles = getUserRoles(user);
  const result = {};

  for (const [moduleName, actions] of Object.entries(PERMISSION_MATRIX)) {
    result[moduleName] = {};
    for (const [action, allowedRoles] of Object.entries(actions)) {
      // SA always true
      if (userRoles.includes('SA')) {
        result[moduleName][action] = true;
      } else {
        result[moduleName][action] = userRoles.some(r => allowedRoles.includes(r));
      }
    }
  }

  return result;
};

module.exports = {
  PERMISSION_MATRIX,
  ROLE_ALIASES,
  normalizeRole,
  getUserRoles,
  hasPermission,
  canView,
  canEdit,
  canCreate,
  canDelete,
  canApprove,
  buildPermissionsForUser,
};
