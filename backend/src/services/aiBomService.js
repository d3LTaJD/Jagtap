const BillOfMaterials = require('../models/BillOfMaterials');
const PurchaseRequisition = require('../models/PurchaseRequisition');
const InventoryStock = require('../models/InventoryStock');
const WorkOrder = require('../models/WorkOrder');
const Quotation = require('../models/Quotation');
const Customer = require('../models/Customer');
const Drawing = require('../models/Drawing');
const Vendor = require('../models/Vendor');
const User = require('../models/User');
const Notification = require('../models/Notification');
const { getNextSequenceValue } = require('../utils/counter');
const path = require('path');
const fs = require('fs');

// Load Petro Valves Official Trunnion Mounted Ball Valve BOM Template
let tmbvTemplateData = null;
try {
  const tmbvPath = path.join(__dirname, '../config/petroBOMTemplate_TMBV.json');
  if (fs.existsSync(tmbvPath)) {
    tmbvTemplateData = JSON.parse(fs.readFileSync(tmbvPath, 'utf8'));
  }
} catch (e) {
  console.warn('[AI BOM Service] Warning loading petroBOMTemplate_TMBV.json:', e.message);
}

/**
 * Helper to extract numeric size (e.g. "450 mm" -> "450", "100 mm" -> "100", "4\"" -> "100")
 */
function parseSizeCode(sizeStr = '') {
  const s = String(sizeStr).toLowerCase().replace(/[^0-9]/g, '');
  if (s) return s.padStart(3, '0');
  if (sizeStr.includes('18')) return '450';
  if (sizeStr.includes('12')) return '300';
  if (sizeStr.includes('10')) return '250';
  if (sizeStr.includes('8')) return '200';
  if (sizeStr.includes('6')) return '150';
  if (sizeStr.includes('4')) return '100';
  if (sizeStr.includes('3')) return '080';
  if (sizeStr.includes('2')) return '050';
  return '100';
}

/**
 * Helper to extract class rating code
 */
function parseClassCode(classStr = '') {
  const norm = String(classStr).toUpperCase();
  if (norm.includes('150')) return '01';
  if (norm.includes('300')) return '02';
  if (norm.includes('600')) return '04';
  if (norm.includes('800')) return '05';
  if (norm.includes('900')) return '06';
  if (norm.includes('1500')) return '07';
  if (norm.includes('2500')) return '08';
  return '02'; // default 300#
}

/**
 * Helper to extract end connection code
 */
function parseEndCode(endStr = '') {
  const norm = String(endStr).toUpperCase();
  if (norm.includes('BUTT') || norm.includes('BW')) return 'FBW';
  if (norm.includes('SOCKET') || norm.includes('SW')) return 'FSW';
  if (norm.includes('THREAD') || norm.includes('NPT')) return 'FNPT';
  return 'FFL'; // default Full Flanged RF
}

/**
 * Calculate realistic estimated valve weight based on size and class
 */
function estimateValveWeight(sizeStr = '', classStr = '') {
  const size = parseInt(String(sizeStr).replace(/[^0-9]/g, '')) || 100;
  const cls = parseInt(String(classStr).replace(/[^0-9]/g, '')) || 300;
  
  if (size >= 400 && cls >= 600) return 'APPROX. 2508 KG.';
  if (size >= 300 && cls >= 600) return 'APPROX. 1420 KG.';
  if (size >= 300 && cls >= 300) return 'APPROX. 850 KG.';
  if (size >= 200 && cls >= 300) return 'APPROX. 420 KG.';
  if (size >= 150 && cls >= 300) return 'APPROX. 210 KG.';
  if (size >= 150 && cls <= 150) return 'APPROX. 85 KG.';
  if (size >= 100 && cls >= 600) return 'APPROX. 145 KG.';
  if (size >= 100 && cls >= 300) return 'APPROX. 82 KG.';
  if (size >= 100 && cls <= 150) return 'APPROX. 48 KG.';
  if (size <= 50) return 'APPROX. 18 KG.';
  return 'APPROX. 120 KG.';
}

/**
 * Map raw part name to inventory procurement category
 */
function mapPartCategory(partName = '') {
  const p = partName.toUpperCase();
  if (p.includes('BODY') || p.includes('SIDE P/C') || p.includes('BONNET') || p.includes('COVER')) {
    return 'Raw Casting/Forging';
  }
  if (p.includes('BALL') || p.includes('WEDGE') || p.includes('DISC') || p.includes('STEM') || 
      p.includes('SEAT RING') || p.includes('SEAT HOLDER') || p.includes('TRUNNION') || 
      p.includes('GLAND BUSH') || p.includes('GLAND FOLLOWER')) {
    return 'Machined Trim';
  }
  if (p.includes('STUD') || p.includes('NUT') || p.includes('BOLT') || p.includes('SCREW') || p.includes('RIVET')) {
    return 'Fasteners';
  }
  if (p.includes('GASKET') || p.includes('PACKING') || p.includes('O\' RING') || p.includes('O RING') || p.includes('SEAL')) {
    return 'Gaskets & Seals';
  }
  return 'Hardware/Accessories';
}

/**
 * 1. AUTO-SUGGEST BOM FROM WORK ORDER & SPECIFICATIONS (IDEMPOTENT)
 * Matches 1:1 format of 450MM X 600# FB BW TMBV G.B. OPT.xlsx.pdf
 */
exports.generateAiBomForWorkOrder = async ({ workOrderId, itemIndex = 0, user }) => {
  const workOrder = await WorkOrder.findById(workOrderId)
    .populate('quotation customer drawing');
  
  if (!workOrder) {
    throw new Error('Work Order not found.');
  }

  const items = workOrder.items || [];
  const validIndex = (itemIndex >= 0 && itemIndex < items.length) ? itemIndex : 0;
  const selectedItem = items[validIndex] || items[0] || {};

  const size = selectedItem.size || '450 mm';
  const pressureClass = selectedItem.pressureClass || '600#';
  const valveType = selectedItem.valveType || 'Trunnion Mounted Ball Valve';
  const bodyMoc = selectedItem.materialGrade || 'ASTM A216 Gr. WCB';
  const trimMoc = 'A216 WCB + 75µ ENP / Devlon / 13% Cr';
  const endConnection = selectedItem.endConnection || 'Butt weld';
  const itemQty = selectedItem.quantity || 1;

  // Idempotency: Check if BOM already generated for this Work Order and Item
  const existingBom = await BillOfMaterials.findOne({
    workOrder: workOrder._id,
    itemIndex: validIndex
  });
  if (existingBom) {
    console.log(`[AI BOM Service] Idempotent hit: BOM ${existingBom.bomId} already exists for Work Order ${workOrder.workOrderId} Item #${validIndex + 1}.`);
    return existingBom;
  }

  // Codes for Drawing Number formatting
  const sizeCode = parseSizeCode(size);
  const classCode = parseClassCode(pressureClass);
  const endCode = parseEndCode(endConnection);
  const isTrunnion = valveType.toUpperCase().includes('TRUNNION') || sizeCode >= '150';
  const isGearBox = sizeCode >= '150' || classCode >= '04';

  const bomNo = `BOM/BV02${endCode}${classCode}GTX${sizeCode}A000`;
  const sizeClassEndDetail = `${size.toUpperCase().replace(/\s+/g, '')} ${pressureClass.toUpperCase()} & ${endConnection.toUpperCase().includes('BUTT') ? 'BUTTWELD END' : (endConnection.toUpperCase().includes('SOCKET') ? 'SOCKET WELD' : 'FLANGED RF')}`;
  const typeDesignOpt = `2 P/C ${valveType.toUpperCase()} & ${isGearBox ? 'G.BOX' : 'LEVER'} OPT.`;
  const boreDetail = 'FULL BORE';
  const qtyStr = `${String(itemQty).padStart(2, '0')} NOS`;
  const mfgStd = 'API 6D : 25th ED';
  const testingStd = 'API 6D : 25th ED';
  const weight = estimateValveWeight(size, pressureClass);

  let rawComponents = [];

  // If Trunnion or Ball Valve, use the 56-part Petro Valves engineering BOM!
  if (valveType.toUpperCase().includes('BALL') || isTrunnion) {
    if (tmbvTemplateData && Array.isArray(tmbvTemplateData.parts)) {
      rawComponents = tmbvTemplateData.parts.map(p => {
        // Adapt drawing number dynamically to this valve size and class
        let drg = p.drgNo || '---';
        if (drg.startsWith('BV02')) {
          drg = `BV02${endCode}${classCode}XTX${sizeCode}${drg.slice(-4)}`;
        }
        return {
          itemNo: p.itemNo,
          rawPartName: p.rawPartName,
          partName: p.partName,
          isCritical: p.isCritical,
          isPressureContaining: p.isPressureContaining,
          isPressureControlling: p.isPressureControlling,
          drgNo: drg,
          revNo: p.revNo || '01',
          qtyPerValve: typeof p.qty === 'number' ? p.qty : (parseInt(p.qty) || 1),
          remark: p.remark || ''
        };
      });
    }
  }

  // Fallback / Gate Valve Template if Gate Valve requested
  if (rawComponents.length === 0) {
    const isGate = valveType.toUpperCase().includes('GATE');
    const isGlobe = valveType.toUpperCase().includes('GLOBE');
    const vCode = isGate ? 'GV' : (isGlobe ? 'GLV' : 'CV');

    const stdParts = [
      { name: 'BODY*•', drgSuffix: 'M001', critical: true, pressCont: true, pressCtrl: false, qty: 1, rev: '01' },
      { name: (isGate ? 'BONNET/COVER*•' : 'COVER*•'), drgSuffix: 'M002', critical: true, pressCont: true, pressCtrl: false, qty: 1, rev: '01' },
      { name: (isGate ? 'FLEXIBLE WEDGE*◊' : (isGlobe ? 'PLUG DISC*◊' : 'SWING DISC*◊')), drgSuffix: 'M003', critical: true, pressCont: false, pressCtrl: true, qty: 1, rev: '01' },
      { name: 'SEAT RING◊', drgSuffix: 'S006', critical: false, pressCont: false, pressCtrl: true, qty: 2, rev: '02', remark: 'STELLITE FACED' },
      { name: 'STEM*•', drgSuffix: 'M007', critical: true, pressCont: true, pressCtrl: false, qty: 1, rev: '01' },
      { name: 'BODY-BONNET GASKET', drgSuffix: 'S008', critical: false, pressCont: true, pressCtrl: false, qty: 1, rev: '02', remark: 'SS316+GRAPHITE' },
      { name: 'GLAND PACKING SET', drgSuffix: 'S009', critical: false, pressCont: false, pressCtrl: false, qty: 1, rev: '02', remark: 'DIE FORMED GRAPHITE' },
      { name: 'BACK SEAT BUSH', drgSuffix: 'M010', critical: false, pressCont: false, pressCtrl: false, qty: 1, rev: '01' },
      { name: 'GLAND BUSH', drgSuffix: 'M011', critical: false, pressCont: false, pressCtrl: false, qty: 1, rev: '01' },
      { name: 'GLAND FLANGE', drgSuffix: 'M012', critical: false, pressCont: false, pressCtrl: false, qty: 1, rev: '01' },
      { name: 'BODY-BONNET STUD*', drgSuffix: 'S022', critical: true, pressCont: false, pressCtrl: false, qty: 16, rev: '02', remark: 'A193 B7' },
      { name: 'BODY-BONNET NUT*', drgSuffix: 'S023', critical: true, pressCont: false, pressCtrl: false, qty: 16, rev: '02', remark: 'A194 2H' },
      { name: 'GLAND EYE BOLT & NUT', drgSuffix: 'S024', critical: false, pressCont: false, pressCtrl: false, qty: 2, rev: '01' },
      { name: 'YOKE BUSH', drgSuffix: 'M030', critical: false, pressCont: false, pressCtrl: false, qty: 1, rev: '01', remark: 'ALUMINIUM BRONZE' },
      { name: 'HANDWHEEL / OPERATOR', drgSuffix: '---', critical: false, pressCont: false, pressCtrl: false, qty: 1, rev: '', remark: 'EN 1561' },
      { name: 'HANDWHEEL NUT', drgSuffix: 'S035', critical: false, pressCont: false, pressCtrl: false, qty: 1, rev: '01' },
      { name: 'GREASE NIPPLE', drgSuffix: 'S036', critical: false, pressCont: false, pressCtrl: false, qty: 1, rev: '00' },
      { name: 'NAME PLATE', drgSuffix: 'M049', critical: false, pressCont: false, pressCtrl: false, qty: 1, rev: '02', remark: 'SS 304' },
      { name: 'RIVET', drgSuffix: 'S050', critical: false, pressCont: false, pressCtrl: false, qty: 4, rev: '00' }
    ];

    rawComponents = stdParts.map((sp, idx) => ({
      itemNo: idx + 1,
      rawPartName: sp.name,
      partName: sp.name.replace(/[*•◊]/g, '').trim(),
      isCritical: sp.critical,
      isPressureContaining: sp.pressCont,
      isPressureControlling: sp.pressCtrl,
      drgNo: sp.drgSuffix === '---' ? '---' : `${vCode}01${endCode}${classCode}XTX${sizeCode}${sp.drgSuffix}`,
      revNo: sp.rev,
      qtyPerValve: sp.qty,
      remark: sp.remark || ''
    }));
  }

  // Build final BOM components with stock check
  const bomComponents = [];
  for (const comp of rawComponents) {
    const totalRequiredQty = (comp.qtyPerValve || 1) * itemQty;
    const category = mapPartCategory(comp.partName);

    // Look up warehouse stock
    const stockItem = await InventoryStock.findOne({
      partName: new RegExp(comp.partName, 'i')
    });
    const inStock = stockItem ? stockItem.quantityAvailable : 0;
    const shortage = Math.max(0, totalRequiredQty - inStock);

    bomComponents.push({
      itemNo: comp.itemNo,
      rawPartName: comp.rawPartName,
      partName: comp.partName,
      isCritical: Boolean(comp.isCritical),
      isPressureContaining: Boolean(comp.isPressureContaining),
      isPressureControlling: Boolean(comp.isPressureControlling),
      drgNo: comp.drgNo || '---',
      revNo: comp.revNo || '00',
      remark: comp.remark || '',
      category,
      materialGrade: comp.isPressureContaining ? bodyMoc : (comp.isPressureControlling ? trimMoc : 'Standard'),
      dimensions: `${size} ${pressureClass}`,
      bomMultiplier: comp.qtyPerValve || 1,
      qtyPerValve: comp.qtyPerValve || 1,
      totalRequiredQty,
      unit: 'NOS',
      inStockQty: inStock,
      reservedStockQty: 0,
      shortageQty: shortage,
      estimatedLeadTimeDays: category === 'Raw Casting/Forging' ? 21 : 10,
      estimatedUnitCost: 0,
      status: 'AUTO_SUGGESTED'
    });
  }

  const now = new Date();
  const prefix = `BOM-${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const seq = await getNextSequenceValue(prefix);
  const bomId = `${prefix}-${String(seq).padStart(4, '0')}`;

  const bom = await BillOfMaterials.create({
    bomId,
    bomNumber: bomNo,
    bomDate: now,
    workOrder: workOrder._id,
    quotation: workOrder.quotation?._id || workOrder.quotation,
    drawing: workOrder.drawing?._id || workOrder.drawing,
    customer: workOrder.customer?._id || workOrder.customer,
    itemIndex: validIndex,
    designSpecs: {
      sizeClassEndDetail,
      typeDesignOpt,
      boreDetail,
      quantity: qtyStr,
      mfgStandard: mfgStd,
      testingStandard: testingStd,
      weight,
      drawingNo: workOrder.drawing?.drawingNumber || workOrder.drawing?.drawingId || 'DWG-001'
    },
    valveSpecs: {
      valveType,
      size,
      pressureClass,
      designStandard: mfgStd,
      bodyMoc,
      trimMoc,
      endConnection
    },
    components: bomComponents,
    status: 'DRAFT_AI_SUGGESTED',
    notes: 'NOTES:- * TO BE CRITICAL PARTS AND OTHERS ARE NON-CRITICAL PARTS.\n• TO BE PRESSURE CONTAINING PARTS.\n◊ TO BE PRESSURE CONTROLLING PARTS.'
  });

  console.log(`[AI BOM Service] ✅ Generated BOM ${bom.bomId} (${bom.bomNumber}) with ${bom.components.length} components for Work Order ${workOrder.workOrderId}.`);

  return bom;
};

/**
 * 2. CONFIRM BOM, ATOMICALLY RESERVE STOCK & AUTO-CREATE PRs
 */
exports.confirmBomAndGeneratePrs = async ({ bomId, user, adjustments = [] }) => {
  const bom = await BillOfMaterials.findById(bomId).populate('workOrder customer');
  if (!bom) {
    throw new Error('Bill of Materials record not found.');
  }

  if (bom.status === 'PR_GENERATED' && bom.generatedPrs?.length > 0) {
    console.log(`[AI BOM Service] Idempotent hit: BOM ${bom.bomId} already confirmed and PRs generated.`);
    const existingPrs = await PurchaseRequisition.find({ _id: { $in: bom.generatedPrs } });
    return { bom, prs: existingPrs };
  }

  if (adjustments && adjustments.length > 0) {
    adjustments.forEach(adj => {
      const comp = bom.components.id(adj._id) || bom.components.find(c => c.itemNo === adj.itemNo);
      if (comp) {
        if (adj.materialGrade) comp.materialGrade = adj.materialGrade;
        if (adj.totalRequiredQty) comp.totalRequiredQty = Number(adj.totalRequiredQty);
        if (adj.drgNo) comp.drgNo = adj.drgNo;
        if (adj.revNo) comp.revNo = adj.revNo;
        if (adj.remark) comp.remark = adj.remark;
        comp.status = 'ADJUSTED';
      }
    });
  }

  const shortageItemsByCategory = {};

  for (const comp of bom.components) {
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

    if (comp.shortageQty > 0) {
      if (!shortageItemsByCategory[comp.category]) {
        shortageItemsByCategory[comp.category] = [];
      }
      shortageItemsByCategory[comp.category].push({
        partName: comp.partName,
        drgNo: comp.drgNo,
        revNo: comp.revNo,
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
