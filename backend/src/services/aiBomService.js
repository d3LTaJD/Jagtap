const BillOfMaterials = require('../models/BillOfMaterials');
const PurchaseRequisition = require('../models/PurchaseRequisition');
const InventoryStock = require('../models/InventoryStock');
const WorkOrder = require('../models/WorkOrder');
const Vendor = require('../models/Vendor');
const User = require('../models/User');
const Notification = require('../models/Notification');
const { getNextSequenceValue } = require('../utils/counter');

/**
 * DETERMINISTIC ENGINEERING BOM TEMPLATES
 * Valve Type + Size + Class + Standard + MOC -> Component Matrix
 */
const VALVE_BOM_TEMPLATES = {
  'GATE_VALVE': [
    { partName: 'Body Casting', category: 'Raw Casting/Forging', mocField: 'bodyMoc', multiplier: 1, leadTime: 21, estCost: 45000 },
    { partName: 'Bonnet Casting', category: 'Raw Casting/Forging', mocField: 'bodyMoc', multiplier: 1, leadTime: 18, estCost: 28000 },
    { partName: 'Flexible Wedge / Disc', category: 'Machined Trim', mocField: 'trimMoc', multiplier: 1, leadTime: 12, estCost: 16500 },
    { partName: 'Rising Stem', category: 'Machined Trim', defaultMoc: 'ASTM A479 Type 410 / SS 316', multiplier: 1, leadTime: 10, estCost: 9500 },
    { partName: 'Renewable Seat Rings', category: 'Machined Trim', mocField: 'trimMoc', multiplier: 2, leadTime: 10, estCost: 7500 },
    { partName: 'Gland Flange', category: 'Machined Trim', defaultMoc: 'ASTM A105 / WCB', multiplier: 1, leadTime: 7, estCost: 4200 },
    { partName: 'Gland Bush', category: 'Machined Trim', defaultMoc: 'SS 316 / SS 304', multiplier: 1, leadTime: 5, estCost: 2800 },
    { partName: 'Body-Bonnet Studs & Nuts', category: 'Fasteners', defaultMoc: 'ASTM A193 Gr. B7 / A194 Gr. 2H', multiplier: 8, leadTime: 3, estCost: 650 },
    { partName: 'Spiral Wound Gasket', category: 'Gaskets & Seals', defaultMoc: 'SS 316 + Flexible Graphite', multiplier: 1, leadTime: 4, estCost: 1850 },
    { partName: 'Die-Formed Graphite Packing Rings', category: 'Gaskets & Seals', defaultMoc: 'Expanded Pure Graphite with Inconel Wire', multiplier: 5, leadTime: 2, estCost: 450 },
    { partName: 'Handwheel / Gear Operator', category: 'Hardware/Accessories', defaultMoc: 'Malleable Iron / Carbon Steel', multiplier: 1, leadTime: 5, estCost: 3500 }
  ],
  'BALL_VALVE': [
    { partName: 'Body (2-Piece Casting/Forging)', category: 'Raw Casting/Forging', mocField: 'bodyMoc', multiplier: 1, leadTime: 21, estCost: 42000 },
    { partName: 'Floating / Trunnion Ball', category: 'Machined Trim', mocField: 'trimMoc', multiplier: 1, leadTime: 14, estCost: 19500 },
    { partName: 'Blow-out Proof Stem', category: 'Machined Trim', defaultMoc: 'SS 316 / 17-4PH', multiplier: 1, leadTime: 10, estCost: 8800 },
    { partName: 'Primary Soft Seats (RPTFE / PEEK)', category: 'Gaskets & Seals', defaultMoc: 'RPTFE / PEEK', multiplier: 2, leadTime: 7, estCost: 6200 },
    { partName: 'Body Fasteners', category: 'Fasteners', defaultMoc: 'ASTM A193 B7 / A194 2H', multiplier: 6, leadTime: 3, estCost: 550 },
    { partName: 'Stem Packing & O-Rings', category: 'Gaskets & Seals', defaultMoc: 'Viton B / Graphite', multiplier: 3, leadTime: 3, estCost: 750 },
    { partName: 'Lever / Actuator Mounting Kit', category: 'Hardware/Accessories', defaultMoc: 'Carbon Steel / Stainless Steel', multiplier: 1, leadTime: 5, estCost: 2900 }
  ],
  'GLOBE_VALVE': [
    { partName: 'Globe Body Casting', category: 'Raw Casting/Forging', mocField: 'bodyMoc', multiplier: 1, leadTime: 20, estCost: 44000 },
    { partName: 'Globe Bonnet', category: 'Raw Casting/Forging', mocField: 'bodyMoc', multiplier: 1, leadTime: 18, estCost: 26000 },
    { partName: 'Plug / Needle Disc', category: 'Machined Trim', mocField: 'trimMoc', multiplier: 1, leadTime: 12, estCost: 15000 },
    { partName: 'Globe Stem', category: 'Machined Trim', defaultMoc: 'ASTM A479 Type 410 / SS 316', multiplier: 1, leadTime: 10, estCost: 9000 },
    { partName: 'Seat Ring', category: 'Machined Trim', mocField: 'trimMoc', multiplier: 1, leadTime: 8, estCost: 6800 },
    { partName: 'Bonnet Studs & Nuts', category: 'Fasteners', defaultMoc: 'ASTM A193 B7 / A194 2H', multiplier: 8, leadTime: 3, estCost: 650 },
    { partName: 'Spiral Wound Gasket', category: 'Gaskets & Seals', defaultMoc: 'SS 316 + Flexible Graphite', multiplier: 1, leadTime: 4, estCost: 1850 },
    { partName: 'Graphite Gland Packing', category: 'Gaskets & Seals', defaultMoc: 'Flexible Graphite', multiplier: 5, leadTime: 2, estCost: 450 },
    { partName: 'Handwheel Assembly', category: 'Hardware/Accessories', defaultMoc: 'Cast Iron / Carbon Steel', multiplier: 1, leadTime: 5, estCost: 3200 }
  ],
  'CHECK_VALVE': [
    { partName: 'Check Valve Body', category: 'Raw Casting/Forging', mocField: 'bodyMoc', multiplier: 1, leadTime: 20, estCost: 38000 },
    { partName: 'Cover Casting', category: 'Raw Casting/Forging', mocField: 'bodyMoc', multiplier: 1, leadTime: 16, estCost: 22000 },
    { partName: 'Swing Disc / Clapper', category: 'Machined Trim', mocField: 'trimMoc', multiplier: 1, leadTime: 12, estCost: 14000 },
    { partName: 'Hinge Pin', category: 'Machined Trim', defaultMoc: 'SS 316 / SS 410', multiplier: 1, leadTime: 7, estCost: 4500 },
    { partName: 'Seat Ring', category: 'Machined Trim', mocField: 'trimMoc', multiplier: 1, leadTime: 8, estCost: 6200 },
    { partName: 'Cover Fasteners', category: 'Fasteners', defaultMoc: 'ASTM A193 B7 / A194 2H', multiplier: 8, leadTime: 3, estCost: 650 },
    { partName: 'Cover Gasket', category: 'Gaskets & Seals', defaultMoc: 'SS 316 + Graphite', multiplier: 1, leadTime: 4, estCost: 1750 }
  ]
};

const getTemplateKey = (valveType = '') => {
  const norm = valveType.toUpperCase().replace(/\s+/g, '_');
  if (norm.includes('BALL')) return 'BALL_VALVE';
  if (norm.includes('GLOBE')) return 'GLOBE_VALVE';
  if (norm.includes('CHECK')) return 'CHECK_VALVE';
  return 'GATE_VALVE';
};

/**
 * 1. AUTO-SUGGEST BOM FROM WORK ORDER & SPECIFICATIONS (IDEMPOTENT)
 */
exports.generateAiBomForWorkOrder = async ({ workOrderId, user }) => {
  const workOrder = await WorkOrder.findById(workOrderId)
    .populate('quotation customer drawing');
  
  if (!workOrder) {
    throw new Error('Work Order not found.');
  }

  // Idempotency: Check if BOM already generated for this Work Order
  const existingBom = await BillOfMaterials.findOne({ workOrder: workOrder._id });
  if (existingBom) {
    console.log(`[AI BOM Service] Idempotent hit: BOM ${existingBom.bomId} already exists for Work Order ${workOrder.workOrderId}.`);
    return existingBom;
  }

  const primaryItem = workOrder.items?.[0] || {};
  const valveType = primaryItem.valveType || 'Gate Valve';
  const size = primaryItem.size || '150 mm';
  const pressureClass = primaryItem.pressureClass || '300#';
  const bodyMoc = primaryItem.materialGrade || 'ASTM A216 WCB';
  const trimMoc = 'SS 316 / 13% Cr';
  const totalOrderValveQty = workOrder.items?.reduce((sum, it) => sum + (it.quantity || 1), 0) || 1;

  const templateKey = getTemplateKey(valveType);
  const templateComponents = VALVE_BOM_TEMPLATES[templateKey] || VALVE_BOM_TEMPLATES['GATE_VALVE'];

  // Check inventory levels for preview
  const bomComponents = [];
  let itemCounter = 1;

  for (const comp of templateComponents) {
    const materialGrade = comp.mocField ? (comp.mocField === 'bodyMoc' ? bodyMoc : trimMoc) : comp.defaultMoc;
    const requiredQty = comp.multiplier * totalOrderValveQty;

    // Check available warehouse stock (read-only for preview)
    const stockItem = await InventoryStock.findOne({
      partName: new RegExp(comp.partName, 'i'),
      materialGrade: new RegExp(materialGrade.split(' ')[0], 'i')
    });

    const inStock = stockItem ? stockItem.quantityAvailable : 0;
    const shortage = Math.max(0, requiredQty - inStock);

    bomComponents.push({
      itemNo: itemCounter++,
      partName: comp.partName,
      category: comp.category,
      materialGrade,
      dimensions: `${size} ${pressureClass}`,
      bomMultiplier: comp.multiplier,
      totalRequiredQty: requiredQty,
      unit: comp.multiplier > 4 ? 'NOS' : 'NOS',
      inStockQty: inStock,
      reservedStockQty: 0,
      shortageQty: shortage,
      estimatedLeadTimeDays: comp.leadTime,
      estimatedUnitCost: comp.estCost,
      status: 'AUTO_SUGGESTED'
    });
  }

  const now = new Date();
  const prefix = `BOM-${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const seq = await getNextSequenceValue(prefix);
  const bomId = `${prefix}-${String(seq).padStart(4, '0')}`;

  const bom = await BillOfMaterials.create({
    bomId,
    workOrder: workOrder._id,
    quotation: workOrder.quotation?._id || workOrder.quotation,
    drawing: workOrder.drawing?._id || workOrder.drawing,
    customer: workOrder.customer?._id || workOrder.customer,
    valveSpecs: {
      valveType,
      size,
      pressureClass,
      designStandard: 'API 6D',
      bodyMoc,
      trimMoc,
      endConnection: primaryItem.endConnection || 'Flanged RF'
    },
    components: bomComponents,
    status: 'DRAFT_AI_SUGGESTED',
    notes: `AI generated deterministic BOM based on ${valveType} standard template for ${totalOrderValveQty} unit(s).`
  });

  console.log(`[AI BOM Service] ✅ Generated BOM ${bom.bomId} with ${bom.components.length} components for Work Order ${workOrder.workOrderId}.`);

  return bom;
};

/**
 * 2. CONFIRM BOM, ATOMICALLY RESERVE STOCK & AUTO-CREATE PRs (IDEMPOTENT & TRANSACTION-SAFE)
 */
exports.confirmBomAndGeneratePrs = async ({ bomId, user, adjustments = [] }) => {
  const bom = await BillOfMaterials.findById(bomId).populate('workOrder customer');
  if (!bom) {
    throw new Error('Bill of Materials record not found.');
  }

  // Idempotency: If already confirmed / PRs generated, return existing PRs without re-reserving
  if (bom.status === 'PR_GENERATED' && bom.generatedPrs?.length > 0) {
    console.log(`[AI BOM Service] Idempotent hit: BOM ${bom.bomId} already confirmed and PRs generated.`);
    const existingPrs = await PurchaseRequisition.find({ _id: { $in: bom.generatedPrs } });
    return { bom, prs: existingPrs };
  }

  // Apply user adjustments if provided
  if (adjustments && adjustments.length > 0) {
    adjustments.forEach(adj => {
      const comp = bom.components.id(adj._id) || bom.components.find(c => c.itemNo === adj.itemNo);
      if (comp) {
        if (adj.materialGrade) comp.materialGrade = adj.materialGrade;
        if (adj.totalRequiredQty) comp.totalRequiredQty = Number(adj.totalRequiredQty);
        if (adj.suggestedVendor) comp.suggestedVendor = adj.suggestedVendor;
        comp.status = 'ADJUSTED';
      }
    });
  }

  // ATOMIC INVENTORY RESERVATION & SHORTAGE CALCULATION
  const shortageItemsByCategory = {};

  for (const comp of bom.components) {
    // Atomic reserve stock
    const reservationResult = await InventoryStock.reserveStockAtomic({
      partName: comp.partName,
      materialGrade: comp.materialGrade,
      size: comp.dimensions,
      requiredQty: comp.totalRequiredQty,
      bomId: bom._id,
      workOrderId: bom.workOrder?._id
    });

    comp.inStockQty = reservationResult.inStockQty;
    comp.reservedStockQty = reservationResult.allocatedQty;
    comp.shortageQty = reservationResult.shortageQty;
    comp.status = 'CONFIRMED';

    // If shortage exists, collect for PR generation
    if (comp.shortageQty > 0) {
      if (!shortageItemsByCategory[comp.category]) {
        shortageItemsByCategory[comp.category] = [];
      }
      shortageItemsByCategory[comp.category].push({
        partName: comp.partName,
        materialGrade: comp.materialGrade,
        dimensions: comp.dimensions,
        quantity: comp.shortageQty,
        unit: comp.unit,
        estimatedUnitCost: comp.estimatedUnitCost,
        suggestedVendor: comp.suggestedVendor,
        targetDeliveryDate: new Date(Date.now() + (comp.estimatedLeadTimeDays || 14) * 24 * 60 * 60 * 1000)
      });
    }
  }

  // AUTO-CREATE CATEGORIZED PURCHASE REQUISITIONS (PRs)
  const createdPrs = [];
  const now = new Date();
  const prefix = `PR-${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

  for (const [category, items] of Object.entries(shortageItemsByCategory)) {
    const seq = await getNextSequenceValue(prefix);
    const prId = `${prefix}-${String(seq).padStart(4, '0')}`;

    const pr = await PurchaseRequisition.create({
      prId,
      bom: bom._id,
      workOrder: bom.workOrder?._id || bom.workOrder,
      category,
      items,
      priority: category === 'Raw Casting/Forging' ? 'URGENT' : 'HIGH',
      status: 'OPEN',
      createdBy: user._id,
      notes: `Auto-generated PR for ${category} shortage from BOM ${bom.bomId}.`
    });

    createdPrs.push(pr);
  }

  bom.status = 'PR_GENERATED';
  bom.confirmedBy = user._id;
  bom.confirmedAt = new Date();
  bom.generatedPrs = createdPrs.map(p => p._id);
  await bom.save();

  console.log(`[AI BOM Service] ✅ BOM ${bom.bomId} confirmed. Generated ${createdPrs.length} categorized PRs.`);

  // Create notifications for Purchase Team
  try {
    const purchaseUsers = await User.find({ role: { $in: ['SA', 'DIR', 'SALES', 'DE'] } });
    for (const pu of purchaseUsers) {
      await Notification.create({
        user_id: pu._id,
        type: 'PR_CREATED',
        title: `📦 ${createdPrs.length} Purchase Requisition(s) Created`,
        message: `BOM ${bom.bomId} confirmed for Work Order ${bom.workOrder?.workOrderId || ''}. ${createdPrs.length} PRs ready for PO processing.`,
        related_id: bom._id,
        entityType: 'BOM'
      });
    }
  } catch (notifErr) {
    console.warn('[AI BOM Service] Notification dispatch warning:', notifErr.message);
  }

  return { bom, prs: createdPrs };
};
