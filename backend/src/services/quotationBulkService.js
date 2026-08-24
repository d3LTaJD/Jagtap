/**
 * QUOTATION BULK OPERATIONS & SPECIFICATION CLONING SERVICE
 * Safe bulk pricing updates and selective specification cloning engine.
 */

// Field classification for selective cloning
const SPEC_CATEGORIES = {
  common_specs: [
    'valve_design_type', 'valve_bore', 'valve_end_connection', 'valve_operating',
    'valve_ball_type', 'valve_direction', 'valve_service', 'valve_seat_type',
    'valve_design_std', 'valve_testing_std', 'valve_min_design_pressure',
    'valve_max_design_pressure', 'valve_min_design_temp', 'valve_max_design_temp',
    'valve_drain_size', 'valve_vent_size', 'valve_lifting_lug', 'valve_support_foot',
    'valve_fire_safe', 'valve_antistatic', 'valve_locking', 'valve_pigging',
    'valve_pressure_relief', 'valve_cavity_relief', 'valve_bypass',
    'valve_corrosion_allowance', 'valve_special_req'
  ],
  testing: [
    'test_mtc', 'test_rt', 'test_ut', 'test_dpt', 'test_mpt', 'test_nace',
    'test_fugitive_emission', 'test_cryogenic', 'test_load_moments', 'test_igc',
    'test_pmi', 'test_chemical', 'test_physical', 'test_hardness_pressure_containing',
    'test_hardness_pressure_controlling', 'test_heat_treatment_chart', 'test_impact',
    'test_pqr_wps', 'test_solution_annealing', 'test_seismic', 'test_calibration',
    'test_ibr_ce', 'test_api6d_validation', 'test_hydro_shell', 'test_hydro_seat',
    'test_air_seat', 'test_dbb_hydro', 'test_back_seat', 'test_antistatic_test'
  ],
  moc: [
    'valve_body_moc', 'valve_ball_moc', 'valve_stem_moc',
    'valve_seat_ring_moc', 'valve_fasteners_moc', 'valve_extended_bonnet'
  ],
  annexures: [
    'annex_a', 'annex_b', 'annex_c', 'annex_d', 'annex_e', 'annex_f',
    'annex_g', 'annex_h', 'annex_i', 'annex_j', 'annex_k', 'annex_l', 'annex_m'
  ]
};

function calculateItemTotals(item) {
  const qty = Number(item.quantity) || 1;
  const unitPrice = Number(item.unitPrice) || 0;
  const discount = Number(item.discountPercent) || 0;
  const ndt = Number(item.ndtCharges) || 0;
  const specTest = Number(item.specialTestingCharges) || 0;
  const spares = Number(item.sparesCharges) || 0;
  const pf = Number(item.pfCharges) || 0;
  const tpia = Number(item.tpiCharges) || 0;

  const effectiveUnitRate = Math.round(((unitPrice * (1 - discount / 100)) + ndt + specTest + spares + pf + tpia) * 100) / 100;
  const lineTotalExclGST = Math.round(effectiveUnitRate * qty * 100) / 100;
  const gstAmount = Math.round(lineTotalExclGST * 0.18 * 100) / 100;
  const lineTotalInclGST = Math.round((lineTotalExclGST + gstAmount) * 100) / 100;

  return {
    ...item,
    unitPrice,
    discountPercent: discount,
    ndtCharges: ndt,
    specialTestingCharges: specTest,
    sparesCharges: spares,
    pfCharges: pf,
    tpiCharges: tpia,
    lineTotalExclGST,
    gstAmount,
    lineTotalInclGST
  };
}

function applyBulkPricing(items, { targetIndices = [], action, value = 0, adjustType = 'percent' }) {
  const indexSet = new Set(targetIndices.length > 0 ? targetIndices : items.map((_, i) => i));

  return items.map((item, idx) => {
    if (!indexSet.has(idx)) return item;

    const copy = { ...item };
    const numVal = Number(value) || 0;

    switch (action) {
      case 'set_base_rate':
        copy.unitPrice = Math.max(0, numVal);
        break;
      case 'adjust_base_rate':
        if (adjustType === 'percent') {
          copy.unitPrice = Math.max(0, Math.round(copy.unitPrice * (1 + numVal / 100) * 100) / 100);
        } else {
          copy.unitPrice = Math.max(0, Math.round((copy.unitPrice + numVal) * 100) / 100);
        }
        break;
      case 'set_discount':
        copy.discountPercent = Math.min(100, Math.max(0, numVal));
        break;
      case 'set_ndt':
        copy.ndtCharges = Math.max(0, numVal);
        break;
      case 'set_special_testing':
        copy.specialTestingCharges = Math.max(0, numVal);
        break;
      case 'set_spares':
        copy.sparesCharges = Math.max(0, numVal);
        break;
      case 'set_pf':
        copy.pfCharges = Math.max(0, numVal);
        break;
      case 'set_tpia':
        copy.tpiCharges = Math.max(0, numVal);
        break;
      case 'clear_pricing':
        copy.unitPrice = 0;
        copy.discountPercent = 0;
        copy.ndtCharges = 0;
        copy.specialTestingCharges = 0;
        copy.sparesCharges = 0;
        copy.pfCharges = 0;
        copy.tpiCharges = 0;
        break;
      default:
        break;
    }

    return calculateItemTotals(copy);
  });
}

function applySelectiveSpecCloning(items, {
  sourceIndex = 0,
  targetScope = 'all', // 'all', 'same_type', 'same_size', 'same_class', 'selected'
  targetIndices = [],
  categories = {
    common_specs: true,
    testing: true,
    moc: true,
    annexures: true
  }
}) {
  const sourceItem = items[sourceIndex];
  if (!sourceItem) return items;

  const sourceDynamic = sourceItem.dynamicFields || {};
  const sourceNorm = sourceItem.normalizedSpecifications || {};

  // Determine list of fields to copy based on selected categories
  const fieldsToCopy = [];
  Object.keys(categories).forEach(catKey => {
    if (categories[catKey] && SPEC_CATEGORIES[catKey]) {
      fieldsToCopy.push(...SPEC_CATEGORIES[catKey]);
    }
  });

  const sourceType = (sourceItem.productCategory || sourceDynamic.valve_type || '').toLowerCase();
  const sourceSize = (sourceItem.size || sourceDynamic.valve_size || '').toLowerCase();
  const sourceClass = (sourceItem.pressureClass || sourceDynamic.valve_class || '').toLowerCase();

  const selectedIndexSet = new Set(targetIndices);

  return items.map((targetItem, idx) => {
    if (idx === sourceIndex) return targetItem; // Don't modify source item

    // Check scope filter
    let inScope = false;
    if (targetScope === 'all') {
      inScope = true;
    } else if (targetScope === 'same_type') {
      const tType = (targetItem.productCategory || targetItem.dynamicFields?.valve_type || '').toLowerCase();
      inScope = tType === sourceType;
    } else if (targetScope === 'same_size') {
      const tSize = (targetItem.size || targetItem.dynamicFields?.valve_size || '').toLowerCase();
      inScope = tSize === sourceSize;
    } else if (targetScope === 'same_class') {
      const tClass = (targetItem.pressureClass || targetItem.dynamicFields?.valve_class || '').toLowerCase();
      inScope = tClass === sourceClass;
    } else if (targetScope === 'selected') {
      inScope = selectedIndexSet.has(idx);
    }

    if (!inScope) return targetItem;

    // Apply only approved fields to dynamicFields & normalizedSpecifications
    const updatedDynamic = { ...(targetItem.dynamicFields || {}) };
    const updatedNorm = { ...(targetItem.normalizedSpecifications || {}) };

    fieldsToCopy.forEach(fieldKey => {
      const val = sourceDynamic[fieldKey] !== undefined ? sourceDynamic[fieldKey] : sourceNorm[fieldKey];
      if (val !== undefined) {
        updatedDynamic[fieldKey] = val;
        updatedNorm[fieldKey] = val;
      }
    });

    // MOC Direct Property Sync if MOC category was selected
    let updatedMaterialGrade = targetItem.materialGrade;
    if (categories.moc && updatedDynamic.valve_body_moc) {
      updatedMaterialGrade = updatedDynamic.valve_body_moc;
    }

    return {
      ...targetItem,
      materialGrade: updatedMaterialGrade,
      dynamicFields: updatedDynamic,
      normalizedSpecifications: updatedNorm
    };
  });
}

module.exports = {
  SPEC_CATEGORIES,
  calculateItemTotals,
  applyBulkPricing,
  applySelectiveSpecCloning
};
