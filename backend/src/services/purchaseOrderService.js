const PurchaseOrder = require('../models/PurchaseOrder');
const PurchaseRequisition = require('../models/PurchaseRequisition');
const BillOfMaterials = require('../models/BillOfMaterials');
const WorkOrder = require('../models/WorkOrder');
const Vendor = require('../models/Vendor');
const User = require('../models/User');
const SystemSettings = require('../models/SystemSettings');
const Notification = require('../models/Notification');
const { getNextSequenceValue } = require('../utils/counter');

/**
 * 1. ISSUE PURCHASE ORDER FROM PRs & ASSIGN UNIQUE HIT NUMBER (IDEMPOTENT)
 * HIT Number is strictly formatted: HIT-YYYY-NNNN (No monthly format)
 */
exports.createPurchaseOrderFromPrs = async ({
  vendorId,
  prIds = [],
  customItems = [],
  expectedDeliveryDate,
  cpdDate,
  vendorLeadTimeDays = 15,
  qcInspectionDays = 3,
  machiningBufferDays = 5,
  user,
  notes = ''
}) => {
  const vendor = await Vendor.findById(vendorId);
  if (!vendor) {
    throw new Error('Valid Vendor is required to issue Purchase Order.');
  }

  // Load requisitions
  const requisitions = await PurchaseRequisition.find({ _id: { $in: prIds } }).populate('bom workOrder');
  
  // Aggregate items from PRs
  let poItems = [];
  let itemCounter = 1;
  let linkedWorkOrder = null;
  let linkedBom = null;

  if (requisitions.length > 0) {
    linkedWorkOrder = requisitions[0].workOrder?._id || requisitions[0].workOrder;
    linkedBom = requisitions[0].bom?._id || requisitions[0].bom;

    for (const pr of requisitions) {
      for (const it of pr.items) {
        const rate = it.estimatedUnitCost || 1000;
        const total = rate * it.quantity;
        poItems.push({
          itemNo: itemCounter++,
          description: `${it.partName} - ${it.dimensions || ''}`,
          category: pr.category,
          materialGrade: it.materialGrade,
          size: it.dimensions,
          quantity: it.quantity,
          unit: it.unit || 'NOS',
          unitRate: rate,
          totalAmount: total,
          hsnCode: '8481',
          gstRate: 18
        });
      }
    }
  }

  // Fallback to custom items if provided
  if (customItems.length > 0) {
    poItems = customItems.map((it, idx) => ({
      itemNo: idx + 1,
      description: it.description,
      category: it.category || 'Machined Trim',
      materialGrade: it.materialGrade || 'ASTM A216 WCB',
      size: it.size || '',
      quantity: Number(it.quantity) || 1,
      unit: it.unit || 'NOS',
      unitRate: Number(it.unitRate) || 1000,
      totalAmount: (Number(it.unitRate) || 1000) * (Number(it.quantity) || 1),
      hsnCode: it.hsnCode || '8481',
      gstRate: Number(it.gstRate) || 18
    }));
  }

  if (poItems.length === 0) {
    throw new Error('Purchase Order must contain at least one line item.');
  }

  const totalAmount = poItems.reduce((sum, it) => sum + it.totalAmount, 0);
  const taxAmount = Math.round(totalAmount * 0.18);
  const grandTotal = totalAmount + taxAmount;

  // GENERATE PO ID (PO-YYYY-MM-NNNN)
  const now = new Date();
  const poPrefix = `PO-${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const poSeq = await getNextSequenceValue(poPrefix);
  const poId = `${poPrefix}-${String(poSeq).padStart(4, '0')}`;

  // MANDATORY HIT NUMBER GENERATION: Strictly HIT-YYYY-NNNN
  const hitPrefix = `HIT-${now.getFullYear()}`;
  const hitSeq = await getNextSequenceValue(hitPrefix);
  const hitNumber = `${hitPrefix}-${String(hitSeq).padStart(4, '0')}`;

  // CALCULATE SEPARATE CPD LEAD TIME COMPONENTS
  const vLead = Number(vendorLeadTimeDays) || 15;
  const qcDays = Number(qcInspectionDays) || 3;
  const mBuffer = Number(machiningBufferDays) || 5;
  const totalProcurementLeadDays = vLead + qcDays + mBuffer;

  let targetCpd = cpdDate ? new Date(cpdDate) : null;
  if (!targetCpd && linkedWorkOrder) {
    const wo = await WorkOrder.findById(linkedWorkOrder);
    if (wo?.targetDeliveryDate) {
      targetCpd = new Date(wo.targetDeliveryDate);
    }
  }
  if (!targetCpd) {
    // Default to +45 days if not set
    targetCpd = new Date(now.getTime() + 45 * 24 * 60 * 60 * 1000);
  }

  const latestProcurementStartDate = new Date(targetCpd.getTime() - totalProcurementLeadDays * 24 * 60 * 60 * 1000);
  const daysUntilLatestStart = Math.ceil((latestProcurementStartDate.getTime() - now.getTime()) / (24 * 60 * 60 * 1000));

  let cpdRiskLevel = 'ON_TRACK';
  let isCpdRisk = false;
  let cpdRiskReason = '';

  if (daysUntilLatestStart <= 0) {
    cpdRiskLevel = 'CRITICAL_RISK';
    isCpdRisk = true;
    cpdRiskReason = `CRITICAL: Procurement start date (${latestProcurementStartDate.toLocaleDateString()}) is OVERDUE by ${Math.abs(daysUntilLatestStart)} days relative to CPD (${targetCpd.toLocaleDateString()}).`;
  } else if (daysUntilLatestStart <= 3) {
    cpdRiskLevel = 'MODERATE_RISK';
    isCpdRisk = true;
    cpdRiskReason = `WARNING: Procurement must begin within ${daysUntilLatestStart} days to protect Customer Promised Delivery Date (${targetCpd.toLocaleDateString()}).`;
  }

  const defaultExpDelivery = expectedDeliveryDate 
    ? new Date(expectedDeliveryDate) 
    : new Date(now.getTime() + vLead * 24 * 60 * 60 * 1000);

  const purchaseOrder = await PurchaseOrder.create({
    poId,
    vendor: vendor._id,
    workOrder: linkedWorkOrder,
    bom: linkedBom,
    requisitions: prIds,
    hitNumber,
    items: poItems,
    totalAmount,
    taxAmount,
    grandTotal,
    poDate: now,
    expectedDeliveryDate: defaultExpDelivery,
    cpdDate: targetCpd,
    vendorLeadTimeDays: vLead,
    qcInspectionDays: qcDays,
    machiningBufferDays: mBuffer,
    totalProcurementLeadDays,
    latestProcurementStartDate,
    isCpdRisk,
    cpdRiskLevel,
    cpdRiskReason,
    status: 'ISSUED_TO_VENDOR',
    issuedBy: user._id,
    issuedAt: now,
    notes
  });

  // Update PR statuses to PO_CREATED
  if (prIds.length > 0) {
    await PurchaseRequisition.updateMany(
      { _id: { $in: prIds } },
      { $set: { status: 'PO_CREATED', purchaseOrder: purchaseOrder._id } }
    );
  }

  console.log(`[PO Service] 🚀 Issued Purchase Order ${purchaseOrder.poId} to ${vendor.name}. Assigned HIT Number: ${purchaseOrder.hitNumber}`);

  return purchaseOrder;
};

/**
 * 2. CPD PROCUREMENT RISK EVALUATION CRON TASK
 */
exports.checkCpdProcurementRisks = async () => {
  const now = new Date();
  const openPos = await PurchaseOrder.find({
    status: { $in: ['ISSUED_TO_VENDOR', 'DRAFT'] },
    cpdDate: { $ne: null }
  }).populate('vendor workOrder');

  let riskCount = 0;

  for (const po of openPos) {
    const totalLead = (po.vendorLeadTimeDays || 15) + (po.qcInspectionDays || 3) + (po.machiningBufferDays || 5);
    const latestStart = new Date(po.cpdDate.getTime() - totalLead * 24 * 60 * 60 * 1000);
    const daysRemaining = Math.ceil((latestStart.getTime() - now.getTime()) / (24 * 60 * 60 * 1000));

    if (daysRemaining <= 0 && po.cpdRiskLevel !== 'CRITICAL_RISK') {
      po.isCpdRisk = true;
      po.cpdRiskLevel = 'CRITICAL_RISK';
      po.cpdRiskReason = `CRITICAL: Procurement overdue by ${Math.abs(daysRemaining)} days for CPD ${new Date(po.cpdDate).toLocaleDateString()}.`;
      await po.save();
      riskCount++;

      // Dispatch alert to Director and Purchase Manager
      const managers = await User.find({ role: { $in: ['DIR', 'SA', 'PM'] } });
      for (const m of managers) {
        await Notification.create({
          user_id: m._id,
          type: 'CPD_RISK_ALERT',
          title: `🚨 CPD Procurement Risk: PO ${po.poId} (${po.hitNumber})`,
          message: po.cpdRiskReason,
          related_id: po._id,
          entityType: 'PurchaseOrder'
        });
      }
    }
  }

  return riskCount;
};
