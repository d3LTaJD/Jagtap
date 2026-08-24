import React, { useState } from 'react';
import { 
  ClipboardCheck, 
  Layers, 
  Sparkles,
  Copy,
  Info,
  CheckCircle2,
  AlertTriangle,
  FileText,
  X
} from 'lucide-react';

/**
 * CONTRACT REVIEW CHECKLIST - 67 PARAMETER MATRIX COMPONENT
 * Matches the exact Excel 2nd Tab format (Offer Formates.xlsx -> Contract Review Check List)
 */

export const CHECKLIST_SECTIONS = [
  {
    title: 'PRIMARY IDENTIFICATION',
    id: 'primary',
    rows: [
      { key: 'valve_type', sr: 'A', name: 'Valve Type', default: 'Ball Valve', options: ['Ball Valve', 'Gate Valve', 'Globe Valve', 'Check Valve', 'Butterfly Valve', 'Plug Valve'] },
      { key: 'valve_size', sr: 'B', name: 'Size in MM', default: '50' },
      { key: 'valve_class', sr: 'C', name: 'Class', default: '150#', options: ['150#', '300#', '600#', '800#', '900#', '1500#', '2500#'] },
      { key: 'valve_api6d_monogram', sr: 'D', name: 'Required API 6D Monogram', default: 'No', options: ['Yes', 'No'] },
      { key: 'valve_qsl_level', sr: 'E', name: 'Quality Specification Levels (QSL) QSL 2, 3, 3G, 4 & 4G', default: 'No', options: ['No', 'QSL 1', 'QSL 2', 'QSL 3', 'QSL 3G', 'QSL 4', 'QSL 4G'] }
    ]
  },
  {
    title: 'DESIGN SPECIFICATION',
    id: 'design',
    rows: [
      { key: 'valve_design_type', sr: '1', name: 'Design Type', default: 'Floating Ball', options: ['Floating Ball', 'Trunnion Mounted', 'Bolted Bonnet', 'Pressure Seal', 'Swing Check', 'Lift Check', 'Wafer Check'] },
      { key: 'valve_bore', sr: '2', name: 'Bore', default: 'Full Bore', options: ['Full Bore', 'Reduced Bore', 'Regular Bore'] },
      { key: 'valve_end_connection', sr: '3', name: 'End Type', default: 'Flanged RF', options: ['Flanged RF', 'Flanged RTJ', 'Flanged FF', 'Butt Weld (BW)', 'Socket Weld (SW)', 'Screwed (NPT)', 'Wafer', 'Lugged'] },
      { key: 'valve_operating', sr: '4', name: 'Operating of Valves', default: 'Lever / Hand Operated', options: ['Lever / Hand Operated', 'Handwheel', 'Gear Operated', 'Pneumatic Actuator', 'Electric Actuator', 'Hydraulic Actuator', 'Bare Stem'] },
      { key: 'valve_ball_type', sr: '5', name: 'Ball Type', default: 'Solid Ball', options: ['Solid Ball', 'Hollow Ball', 'Wedge', 'Disc', 'Plug', 'NA'] },
      { key: 'valve_direction', sr: '6', name: 'Direction', default: 'Bi-Directional', options: ['Bi-Directional', 'Uni Directional'] },
      { key: 'valve_service', sr: '7', name: 'Service (A) Liquid (B) Gas (C) Others', default: 'Liquid / Hydrocarbon', options: ['Liquid / Hydrocarbon', 'Gas / Natural Gas', 'Steam', 'Water', 'Sour Gas / NACE', 'Cryogenic'] },
      { key: 'valve_seat_type', sr: '8', name: 'Seat Type', default: 'Soft Seated (RPTFE / PTFE)', options: ['Soft Seated (RPTFE / PTFE)', 'Soft Seated (Devlon / PEEK)', 'Metal to Metal (Stellite)', 'Integral Metal Seat', 'Renewable Seat'] },
      { key: 'valve_design_std', sr: '9', name: 'Valve Design Standard', default: 'API 6D / ASME B16.34', options: ['API 6D / ASME B16.34', 'API 600', 'API 602', 'BS 1868', 'BS 1873', 'API 609', 'ASME B16.34'] },
      { key: 'valve_testing_std', sr: '10', name: 'Valve Testing Standard', default: 'API 6D / API 598', options: ['API 6D / API 598', 'API 598', 'API 6D', 'BS EN 12266-1', 'ISO 5208'] },
      { key: 'valve_min_design_pressure', sr: '11', name: 'Minimum Design Operating Pressure (PSI)', default: '0 PSI' },
      { key: 'valve_max_design_pressure', sr: '12', name: 'Maximum Design Operating Pressure (PSI)', default: 'As per ASME B16.34' },
      { key: 'valve_min_design_temp', sr: '13', name: 'Minimium Design Temperature', default: '-29°C' },
      { key: 'valve_max_design_temp', sr: '14', name: 'Maximum Design Temperature', default: '200°C' },
      { key: 'valve_drain_size', sr: '15', name: 'Drain Connection Size in MM', default: '15 mm (1/2" NPT)' },
      { key: 'valve_vent_size', sr: '16', name: 'Vent Connection Size in MM', default: '15 mm (1/2" NPT)' },
      { key: 'valve_lifting_lug', sr: '17', name: 'Lifting Lug (25 Kg And Above)', default: 'Applicable for > 25 kg', options: ['Applicable for > 25 kg', 'Yes', 'No'] },
      { key: 'valve_support_foot', sr: '18', name: 'Support Foot Required', default: 'As per Standard', options: ['Yes', 'No', 'As per Standard', 'For 8" & Above'] },
      { key: 'valve_fire_safe', sr: '19', name: 'Fire Safe Design', default: 'API 607 / API 6FA', options: ['API 607 / API 6FA', 'Yes', 'No', 'As per API 6FA', 'As per API 607'] },
      { key: 'valve_antistatic', sr: '20', name: 'Antistatic Device', default: 'Yes (As per API 6D)', options: ['Yes (As per API 6D)', 'Yes', 'No'] },
      { key: 'valve_locking', sr: '21', name: 'Locking Device', default: 'On Request', options: ['Yes', 'No', 'On Request'] },
      { key: 'valve_pigging', sr: '22', name: 'Is Valve For Pigging: (A) Ball Valve (B) Gate Valve', default: 'Yes (Full Bore)', options: ['Yes (Full Bore)', 'No', 'NA'] },
      { key: 'valve_pressure_relief', sr: '23', name: 'Pressure Relief Device', default: 'Self Relieving Seats', options: ['Self Relieving Seats', 'External PRV', 'Not Applicable'] },
      { key: 'valve_cavity_relief', sr: '24', name: 'Cavity Relief Valve', default: 'Automatic Cavity Relief', options: ['Automatic Cavity Relief', 'External By-Pass', 'Not Applicable'] },
      { key: 'valve_bypass', sr: '25', name: 'By-Pass Connection', default: 'No', options: ['Yes', 'No', 'On Request'] },
      { key: 'valve_corrosion_allowance', sr: '26', name: 'Corrossion Alloance in MM', default: '3.0 mm', options: ['1.5 mm', '3.0 mm', '6.0 mm', 'Nil'] },
      { key: 'valve_special_req', sr: '27', name: 'Any Special Requirement', default: 'As per RFQ Specification' }
    ]
  },
  {
    title: 'MATERIAL OF CONSTRUCTION (MOC)',
    id: 'moc',
    rows: [
      { key: 'valve_body_moc', sr: '28', name: 'Body/Side P/C/Bonnet/Trunnion', default: 'ASTM A216 Gr. WCB', options: ['ASTM A216 Gr. WCB', 'ASTM A351 Gr. CF8M', 'ASTM A351 Gr. CF8', 'ASTM A105', 'ASTM A352 Gr. LCB', 'ASTM A182 Gr. F316', 'ASTM A182 Gr. F51 (Duplex)'] },
      { key: 'valve_ball_moc', sr: '29', name: 'Ball/Wedge/Disc', default: 'ASTM A182 Gr. F316 / CF8M', options: ['ASTM A182 Gr. F316 / CF8M', 'ASTM A182 Gr. F304 / CF8', 'ASTM A105 + ENP', 'ASTM A216 Gr. WCB + 13% Cr', 'ASTM A182 Gr. F51'] },
      { key: 'valve_stem_moc', sr: '30', name: 'Stem/Hing', default: 'ASTM A276 Type 316 / 410', options: ['ASTM A276 Type 316', 'ASTM A276 Type 410', 'ASTM A182 Gr. F51', '17-4PH / UNS S17400', 'Inconel 718'] },
      { key: 'valve_seat_ring_moc', sr: '31', name: 'Seat Ring (Soft Seat)/Seat Holder', default: 'RPTFE / SS316 + Devlon', options: ['RPTFE (Glass Filled)', 'PTFE (Virgin)', 'Devlon V-API', 'PEEK', 'SS316 + Stellite', 'A105 + ENP + RPTFE'] },
      { key: 'valve_fasteners_moc', sr: '32', name: 'Stud & Nuts', default: 'ASTM A193 Gr. B7 / A194 Gr. 2H', options: ['ASTM A193 Gr. B7 / A194 Gr. 2H', 'ASTM A193 Gr. B7M / A194 Gr. 2HM', 'ASTM A193 Gr. B8 / A194 Gr. 8', 'ASTM A320 Gr. L7 / A194 Gr. 4 / 7'] },
      { key: 'valve_extended_bonnet', sr: '33', name: 'Extended Bonnet', default: 'No', options: ['Yes', 'No', 'For Cryogenic Service'] }
    ]
  },
  {
    title: 'RAW MATERIAL & SUPPLEMENTARY REQUIRED TESTING DETAILS',
    id: 'testing_supplementary',
    rows: [
      { key: 'test_mtc', sr: '34', name: 'Material Test Certificates (EN 10204 3.1 or EN 10204 3.2)', default: 'EN 10204 Type 3.1', options: ['EN 10204 Type 3.1', 'EN 10204 Type 3.2 (TPIA)', 'EN 10204 Type 2.2'] },
      { key: 'test_rt', sr: '35', name: 'RT (Radiographic Testing)', default: 'As per ASME B16.34', options: ['As per ASME B16.34', '100% Critical Areas', '10% Spot RT', '100% Full RT', 'No'] },
      { key: 'test_ut', sr: '36', name: 'UT (Ultrasonic Testing)', default: 'As per ASME B16.34', options: ['As per ASME B16.34', '100% Forgings / Bar', '100% Body & Bonnet', 'No'] },
      { key: 'test_dpt', sr: '37', name: 'DPT (Dye Penetrant Testing)', default: '100% Machined Sealing Surfaces', options: ['100% Machined Sealing Surfaces', '100% Welds & Stellite', 'No'] },
      { key: 'test_mpt', sr: '38', name: 'MPT (Magnetic Particle Testing)', default: 'As per ASME B16.34', options: ['As per ASME B16.34', '100% Forged Parts', 'No'] },
      { key: 'test_nace', sr: '39', name: 'NACE Requirement (MR0175 / ISO 15156)', default: 'As per Client RFQ', options: ['Yes (MR0175 / ISO 15156)', 'Yes (MR0103)', 'No', 'As per Client RFQ'] },
      { key: 'test_fugitive_emission', sr: '40', name: 'Fugitive Emission Test / Helium Leak Test', default: 'As per ISO 15848-1 / API 641', options: ['As per ISO 15848-1 / API 641', 'Helium Vacuum Leak Test', 'No', 'On Request'] },
      { key: 'test_cryogenic', sr: '41', name: 'Cryogenics Test', default: 'No', options: ['Yes (BS 6364 / -196°C)', 'No', 'On Request'] },
      { key: 'test_load_moments', sr: '42', name: 'Demonstration of valve function under pressure and pipe loads and moments', default: 'As per API 6D Annex F', options: ['As per API 6D Annex F', 'No', 'On Request'] },
      { key: 'test_igc', sr: '43', name: 'IGC (Intergranular Corrosion Test)', default: 'ASTM A262 Practice E (For SS)', options: ['ASTM A262 Practice E (For SS)', 'No', 'Applicable for SS316'] },
      { key: 'test_pmi', sr: '44', name: 'PMI TEST (Positive Material Identification)', default: '100% Alloy & SS Components', options: ['100% Alloy & SS Components', '100% All Parts', 'No', 'Spot PMI'] },
      { key: 'test_chemical', sr: '45', name: 'Chemical Test', default: 'Yes (Heat Wise in MTC)', options: ['Yes (Heat Wise in MTC)', 'Yes', 'No'] },
      { key: 'test_physical', sr: '46', name: 'Physical / Mechanical Test', default: 'Yes (Heat Wise in MTC)', options: ['Yes (Heat Wise in MTC)', 'Yes', 'No'] },
      { key: 'test_hardness_pressure_containing', sr: '47', name: 'Hardness Test Report On Pressure Containing Parts', default: 'Yes (<= 22 HRC for NACE)', options: ['Yes (<= 22 HRC for NACE)', 'Yes (As per ASTM)', 'No'] },
      { key: 'test_hardness_pressure_controlling', sr: '48', name: 'Hardness Test Report On Pressure Controlling Parts', default: 'Yes (As per Standard)', options: ['Yes (As per Standard)', 'Yes', 'No'] },
      { key: 'test_heat_treatment_chart', sr: '49', name: 'Heat Treatment Chart', default: 'Yes (Furnace Chart Available)', options: ['Yes (Furnace Chart Available)', 'No'] },
      { key: 'test_impact', sr: '50', name: 'Impact Hardness Test (Charpy V-Notch)', default: 'At -29°C / -46°C (For LCB/LTCS)', options: ['At -29°C (Standard)', 'At -46°C (For LTCS)', 'At -196°C (Cryogenic)', 'No'] },
      { key: 'test_pqr_wps', sr: '51', name: 'PQR & WPS', default: 'As per ASME Section IX', options: ['As per ASME Section IX', 'No', 'NA'] },
      { key: 'test_solution_annealing', sr: '52', name: 'Solution Annealing', default: 'Yes (For Stainless Steel)', options: ['Yes (For Stainless Steel)', 'No', 'NA'] },
      { key: 'test_seismic', sr: '53', name: 'Seismic Testing', default: 'No', options: ['Yes', 'No', 'On Request'] },
      { key: 'test_calibration', sr: '54', name: 'Calibration Certificate', default: 'Yes (NABL Traceable Gauges)', options: ['Yes (NABL Traceable Gauges)', 'Yes', 'No'] },
      { key: 'test_ibr_ce', sr: '55', name: 'IBR / CE Certification', default: 'No (API Spec)', options: ['IBR Form III-C', 'CE / PED 2014/68/EU', 'No (API Spec)', 'On Request'] },
      { key: 'test_api6d_validation', sr: '56', name: "Design Validation as Per API 6D:25th Annexure's", default: 'Complied to API 6D Annex F', options: ['Complied to API 6D Annex F', 'No', 'NA'] }
    ]
  },
  {
    title: 'FINAL PRESSURE TESTING (HYDRO & PNEUMATIC)',
    id: 'testing_final',
    rows: [
      { key: 'test_hydro_shell', sr: '57', name: 'Hydro Shell Test (PSI) / Duration (Min.)', default: 'As per API 6D / ASME B16.34' },
      { key: 'test_hydro_seat', sr: '58', name: 'Hydro Seat Test (PSI) / Duration (Min.)', default: 'As per API 6D / API 598' },
      { key: 'test_air_seat', sr: '59', name: 'Air Seat Test (PSI) / Duration (Min.)', default: '80-100 PSI (6-7 Bar) / 2-5 Min' },
      { key: 'test_dbb_hydro', sr: '60', name: 'DBB HYDRO FOR DBB VALVES (ONLY FOR TMBV VALVES) (PSI) / Duration (Min.)', default: 'As per API 6D (For Trunnion Mounted)' },
      { key: 'test_back_seat', sr: '61', name: 'Back Seat Test (PSI) / Duration (Min.)', default: 'Applicable for Gate/Globe (1.1x / API 598)' },
      { key: 'test_antistatic_test', sr: '62', name: 'Antistatic Test', default: '< 10 Ohms at 12V DC (API 6D)' }
    ]
  },
  {
    title: 'OTHER SPECIFICATION & SHIPMENT',
    id: 'other',
    rows: [
      { key: 'spec_painting', sr: '63', name: 'Painting (DFT Micron)', default: 'Epoxy Primer + Polyurethane Topcoat (75-125 Micron)', options: ['Epoxy Primer + Polyurethane Topcoat (75-125 Micron)', 'High Temp Aluminum Paint (300°C)', 'Special 3-Coat Paint Spec (250-300 Micron)', 'Manufacturer Standard'] },
      { key: 'spec_packing', sr: '64', name: 'Packing', default: 'Seaworthy Wooden Box / Loose Plastic Wrapped', options: ['Seaworthy Wooden Box', 'Treated Wooden Box / Pallet', 'Loose Plastic Wrapped'] },
      { key: 'spec_dispatch', sr: '65', name: 'Dispatch By', default: 'Road Freight / Transport', options: ['Road Freight / Transport', 'Air Cargo', 'Sea Shipment', 'Ex-Works Collection'] },
      { key: 'spec_location', sr: '66', name: 'Location / Destination', default: 'Client Project Site / IOCL Site' },
      { key: 'spec_special_clause', sr: '67', name: 'Is there any special requirement', default: 'No / As per RFQ Notes' }
    ]
  }
];

export const API_6D_ANNEXURES = [
  { code: 'ANNEX A', name: 'Repair or Remanufacturing of Valves', type: 'I', key: 'annex_a' },
  { code: 'ANNEX B', name: 'Example of Valve Configurations', type: 'I', key: 'annex_b' },
  { code: 'ANNEX C', name: 'Valve End-to-end and Face-to-face Dimensions', type: 'N', key: 'annex_c' },
  { code: 'ANNEX D', name: 'Guidance for Travel Stops by Valve Type', type: 'I', key: 'annex_d' },
  { code: 'ANNEX E', name: 'Isolation Valve Features', type: 'I', key: 'annex_e' },
  { code: 'ANNEX F', name: 'Design Validation', type: 'I', key: 'annex_f' },
  { code: 'ANNEX G', name: 'External Coating for End Connections', type: 'N', key: 'annex_g' },
  { code: 'ANNEX H', name: 'Heat-treating Equipment Qualification', type: 'N', key: 'annex_h' },
  { code: 'ANNEX I', name: 'Quality Specification Level (QSL) and Supplimentery Testing', type: 'N', key: 'annex_i' },
  { code: 'ANNEX J', name: 'Requirements for Extended Hydrostatic Shell Test Duration and Records Retention for Valves in Jurisdictional Pipeline Systems', type: 'I', key: 'annex_j' },
  { code: 'ANNEX K', name: 'Purchase Specification Customization-Permissible Deviations to Specified Design and Manufacturing Requirments', type: 'N', key: 'annex_k' },
  { code: 'ANNEX L', name: 'Specified Customization-Supplemental Options to Specified Design and Manufacturing Requirments', type: 'I', key: 'annex_l' },
  { code: 'ANNEX M', name: 'Valves in Hydrogen (H2) Gas Service', type: 'I', key: 'annex_m' }
];

export const CONTRACT_REVIEW_GENERAL = [
  {
    code: 'A',
    question: 'Any legal requirement applicable',
    defaultAnswer: 'Yes',
    notes: 'FACTORY ACT, INDIAN ELECTRICITY, ATOMIC ENERGY REGULATORY BOARD (AERB for Steel material, Weight and measurement act, Labor law for lifting > 25 kg, AERB for RT)'
  },
  {
    code: 'B',
    question: 'All requirements specified by the customer',
    defaultAnswer: 'Yes',
    notes: 'Technical parameters, standards and datasheets verified.'
  },
  {
    code: 'C',
    question: 'Any additional requirement for valves, which are not stated by customer & but necessary for valves',
    defaultAnswer: 'Yes',
    notes: 'As per Petro Valves standard engineering practices and ASME/API codes.'
  },
  {
    code: 'D',
    question: 'All requirement defined & documented',
    defaultAnswer: 'Yes',
    notes: 'Documented in Contract Review Checklist and Part-I/II/III.'
  },
  {
    code: 'E',
    question: 'Any differences from previously identified & resolved',
    defaultAnswer: 'Yes',
    notes: 'All technical queries resolved.'
  },
  {
    code: 'F',
    question: "Petro Valves has the capability to meet the customer's requirement",
    defaultAnswer: 'Yes',
    notes: 'Manufacturing, testing and quality facilities available.'
  },
  {
    code: 'G',
    question: 'Is there any customer specified / provided training required',
    defaultAnswer: 'No',
    notes: ''
  },
  {
    code: 'H',
    question: 'Is there any customer specified supplier to be used',
    defaultAnswer: 'No',
    notes: ''
  },
  {
    code: 'I',
    question: 'Is there any risk for execution, design & supply of valves',
    defaultAnswer: 'No',
    notes: 'Standard manufacturing lifecycle.'
  },
  {
    code: 'K',
    question: 'Any different Between Inquiry and Offer',
    defaultAnswer: 'No',
    notes: 'Quotation complies fully with customer inquiry.'
  }
];

export const ToggleSwitch = ({ 
  checked, 
  onChange, 
  disabled = false, 
  activeColor = 'bg-emerald-600', 
  labelOn = 'Yes', 
  labelOff = 'No' 
}) => {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-6 w-14 flex-shrink-0 cursor-pointer items-center rounded-full p-0.5 transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-brand-500/20 disabled:cursor-not-allowed disabled:opacity-50 ${
        checked ? activeColor : 'bg-slate-200 hover:bg-slate-300'
      }`}
    >
      <span
        aria-hidden="true"
        className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out ${
          checked ? 'translate-x-8' : 'translate-x-0'
        }`}
      />
      <span
        className={`absolute text-[10px] font-black uppercase tracking-tight select-none ${
          checked ? 'left-1.5 text-white' : 'right-1.5 text-slate-500'
        }`}
      >
        {checked ? labelOn : labelOff}
      </span>
    </button>
  );
};

export default function ContractReviewMatrix({ 
  quotation, 
  items = [], 
  onItemFieldChange, 
  onOpenCopySpecs,
  readOnly = false,
  onSave 
}) {
  const [activeProvenance, setActiveProvenance] = useState(null);
  const [generalReview, setGeneralReview] = useState(() => {
    const initial = {};
    CONTRACT_REVIEW_GENERAL.forEach(q => {
      initial[q.code] = quotation?.contractReviewGeneral?.[q.code]?.answer || q.defaultAnswer;
    });
    return initial;
  });

  const handleGeneralReviewToggle = (code, newVal) => {
    const answer = newVal ? 'Yes' : 'No';
    setGeneralReview(prev => ({ ...prev, [code]: answer }));
    if (quotation) {
      if (!quotation.contractReviewGeneral) quotation.contractReviewGeneral = {};
      const qObj = CONTRACT_REVIEW_GENERAL.find(item => item.code === code);
      quotation.contractReviewGeneral[code] = {
        answer,
        notes: answer === 'Yes' ? (qObj?.notes || '') : ''
      };
    }
  };

  // Helper to extract value for an item without magic default masking
  const getItemValue = (item, rowKey, fallback = '-') => {
    if (!item) return fallback;
    const dynamic = item.dynamicFields || {};
    const norm = item.normalizedSpecifications || {};
    const derived = item.derivedSpecifications || {};
    const source = item.sourceSpecifications || {};

    let raw = undefined;

    // Specific direct property overrides
    if (rowKey === 'valve_size') {
      raw = dynamic.valve_size || dynamic.size || dynamic.size_mm || item.size;
    } else if (rowKey === 'valve_class') {
      raw = dynamic.valve_class || dynamic.pressure_class || dynamic.class || item.pressureClass;
    } else if (rowKey === 'valve_type') {
      raw = dynamic.valve_type || dynamic.type || item.productCategory;
    } else if (rowKey === 'valve_body_moc') {
      raw = dynamic.valve_body_moc || dynamic.valve_moc_body || dynamic.body_material || dynamic.shellMaterial || item.materialGrade;
    } else if (rowKey === 'valve_design_std') {
      raw = dynamic.valve_design_std || dynamic.designStandard || item.applicableStandard || item.standardCode;
    } else if (rowKey === 'valve_operating') {
      raw = dynamic.valve_operating || dynamic.operation || dynamic.operating || dynamic.actuation;
    } else if (rowKey === 'valve_end_connection') {
      raw = dynamic.valve_end_connection || dynamic.end_connection || dynamic.endConnection;
    } else {
      raw = dynamic[rowKey] ?? norm[rowKey] ?? derived[rowKey] ?? (source[rowKey]?.value || source[rowKey]);
    }

    if (raw === undefined || raw === null || raw === '') {
      return fallback;
    }

    if (typeof raw === 'object') {
      return raw.value || raw.normalizedValue || raw.rawValue || fallback;
    }

    return String(raw);
  };

  // Helper to get field-level provenance metadata
  const getFieldProvenance = (item, rowKey) => {
    if (!item) return null;
    const fc = item.fieldConfidences?.[rowKey] || item.sourceSpecifications?.[rowKey];
    if (fc) return fc;

    if (rowKey === 'valve_size') return item.fieldConfidences?.valve_size || item.fieldConfidences?.size || item.sourceSpecifications?.valve_size;
    if (rowKey === 'valve_class') return item.fieldConfidences?.valve_class || item.fieldConfidences?.pressure_class || item.sourceSpecifications?.valve_class;
    if (rowKey === 'valve_type') return item.fieldConfidences?.valve_type || item.fieldConfidences?.type || item.sourceSpecifications?.valve_type;
    if (rowKey === 'valve_body_moc') return item.fieldConfidences?.valve_body_moc || item.fieldConfidences?.valve_moc_body || item.fieldConfidences?.body_material;
    if (rowKey === 'valve_operating') return item.fieldConfidences?.valve_operating || item.fieldConfidences?.operation;
    if (rowKey === 'valve_end_connection') return item.fieldConfidences?.valve_end_connection || item.fieldConfidences?.endConnection;
    if (rowKey === 'valve_design_std') return item.fieldConfidences?.valve_design_std || item.fieldConfidences?.designStandard;

    return null;
  };

  const handleCellChange = (itemIdx, rowKey, value) => {
    if (onItemFieldChange) {
      onItemFieldChange(itemIdx, rowKey, value);
    }
  };

  return (
    <div className="space-y-6">
      {/* Main Checklist Matrix Grid */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto relative">
          <table className="w-full text-left border-collapse text-xs">
            {/* Table Header: Document Meta + Line Items Sr. No. */}
            <thead className="bg-slate-900 text-white">
              <tr>
                <th className="px-4 py-3.5 font-bold uppercase tracking-wider text-[11px] w-12 text-center border-r border-slate-800 bg-slate-900 sticky left-0 z-20">
                  Sr.
                </th>
                <th className="px-5 py-3.5 font-bold uppercase tracking-wider text-[11px] min-w-[280px] border-r border-slate-800 bg-slate-900 sticky left-12 z-20">
                  Specification Parameter Name
                </th>
                {items.map((item, idx) => (
                  <th 
                    key={idx} 
                    className="px-4 py-3.5 font-bold text-center border-r border-slate-800 min-w-[180px] max-w-[220px] bg-slate-900/95"
                  >
                    <div className="flex flex-col items-center">
                      <div className="flex items-center gap-1 mb-0.5">
                        <span className="px-2 py-0.5 bg-brand-500 text-white rounded text-[10px] font-black uppercase">
                          Offer Sr. #{item.itemNo || idx + 1}
                        </span>
                        {onOpenCopySpecs && !readOnly && (
                          <button
                            type="button"
                            onClick={() => onOpenCopySpecs(idx)}
                            className="p-1 hover:bg-slate-800 text-slate-400 hover:text-brand-300 rounded transition-colors cursor-pointer"
                            title="Copy specs from this item to other items"
                          >
                            <Copy className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                      <span className="text-[11px] text-slate-200 truncate max-w-[170px] font-medium" title={item.description}>
                        {item.description || `Item ${idx + 1}`}
                      </span>
                      <span className="text-[10px] text-slate-400 font-normal">
                        Qty: {item.quantity || 1} {item.unit || 'NOS'}
                      </span>
                    </div>
                  </th>
                ))}
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-200">
              {CHECKLIST_SECTIONS.map((sec) => (
                <React.Fragment key={sec.id}>
                  {/* Section Title Header Row */}
                  <tr className="bg-slate-100 font-black text-slate-800">
                    <td colSpan={2 + items.length} className="px-5 py-2.5 text-xs uppercase tracking-wider border-y border-slate-300">
                      <div className="flex items-center gap-2">
                        <Layers className="w-3.5 h-3.5 text-brand-600" />
                        <span>{sec.title}</span>
                      </div>
                    </td>
                  </tr>

                  {/* Parameter Rows */}
                  {sec.rows.map((row) => (
                    <tr key={row.key} className="hover:bg-brand-50/40 transition-colors group">
                      {/* Serial Number */}
                      <td className="px-4 py-2.5 text-center font-bold text-slate-500 border-r border-slate-200 bg-white group-hover:bg-brand-50/40 sticky left-0 z-10">
                        {row.sr}
                      </td>

                      {/* Parameter Name */}
                      <td className="px-5 py-2.5 font-semibold text-slate-800 border-r border-slate-200 bg-white group-hover:bg-brand-50/40 sticky left-12 z-10">
                        <div className="flex items-center justify-between gap-2">
                          <span>{row.name}</span>
                          {row.options && (
                            <span className="text-[9px] text-slate-400 font-normal px-1 bg-slate-100 rounded">
                              preset
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Value Cells across Line Items */}
                      {items.map((item, itemIdx) => {
                        const cellVal = getItemValue(item, row.key, row.default);
                        const prov = getFieldProvenance(item, row.key);
                        const isPureYesNo = row.options && row.options.length === 2 && row.options.includes('Yes') && row.options.includes('No');

                        if (isPureYesNo) {
                          const isChecked = String(cellVal).toLowerCase() === 'yes' || cellVal === true;
                          return (
                            <td 
                              key={itemIdx} 
                              className="px-3 py-2 border-r border-slate-200 text-slate-700 relative text-xs text-center"
                            >
                              <div className="flex items-center justify-center gap-1.5">
                                <ToggleSwitch
                                  checked={isChecked}
                                  onChange={(newVal) => handleCellChange(itemIdx, row.key, newVal ? 'Yes' : 'No')}
                                  disabled={readOnly}
                                />
                                {prov && (
                                  <button
                                    type="button"
                                    onClick={() => setActiveProvenance({
                                      fieldName: row.name,
                                      key: row.key,
                                      itemIndex: itemIdx + 1,
                                      itemDescription: item.description,
                                      value: cellVal,
                                      ...prov
                                    })}
                                    className="p-0.5 text-slate-400 hover:text-brand-600 transition-colors cursor-pointer"
                                    title="View Source Provenance"
                                  >
                                    <Info className="w-3 h-3" />
                                  </button>
                                )}
                              </div>
                            </td>
                          );
                        }

                        return (
                          <td 
                            key={itemIdx} 
                            className="px-3 py-2 border-r border-slate-200 text-slate-700 relative text-xs group/cell"
                          >
                            <div className="relative flex items-center gap-1">
                              <div className="flex-1 min-w-0">
                                {!readOnly ? (
                                  row.options ? (
                                    <select
                                      value={cellVal}
                                      onChange={e => handleCellChange(itemIdx, row.key, e.target.value)}
                                      className="w-full px-2 py-1.5 bg-slate-50 hover:bg-white border border-transparent hover:border-slate-300 focus:border-brand-500 focus:bg-white rounded-lg text-xs font-medium outline-none transition-all cursor-pointer truncate"
                                    >
                                      {!row.options.includes(cellVal) && cellVal !== '-' && (
                                        <option value={cellVal}>{cellVal}</option>
                                      )}
                                      {row.options.map(opt => (
                                        <option key={opt} value={opt}>{opt}</option>
                                      ))}
                                      <option value="-">- (Not Applicable)</option>
                                    </select>
                                  ) : (
                                    <input
                                      type="text"
                                      value={cellVal === '-' ? '' : cellVal}
                                      placeholder={row.default || '-'}
                                      onChange={e => handleCellChange(itemIdx, row.key, e.target.value || '-')}
                                      className="w-full px-2 py-1.5 bg-slate-50 hover:bg-white border border-transparent hover:border-slate-300 focus:border-brand-500 focus:bg-white rounded-lg text-xs font-medium outline-none transition-all"
                                    />
                                  )
                                ) : (
                                  <span className="px-2 py-1 block font-medium truncate">
                                    {cellVal}
                                  </span>
                                )}
                              </div>

                              {prov && (
                                <button
                                  type="button"
                                  onClick={() => setActiveProvenance({
                                    fieldName: row.name,
                                    key: row.key,
                                    itemIndex: itemIdx + 1,
                                    itemDescription: item.description,
                                    value: cellVal,
                                    ...prov
                                  })}
                                  className={`shrink-0 p-1 rounded transition-all cursor-pointer ${
                                    prov.validationState === 'CONFLICT'
                                      ? 'text-amber-600 hover:bg-amber-50'
                                      : (prov.confidence >= 85 ? 'text-emerald-600 hover:bg-emerald-50' : 'text-blue-600 hover:bg-blue-50')
                                  }`}
                                  title={`Source: ${prov.source?.document || prov.source?.type || 'Extracted'} (${prov.confidence || 100}%)`}
                                >
                                  {prov.validationState === 'CONFLICT' ? (
                                    <AlertTriangle className="w-3.5 h-3.5" />
                                  ) : (
                                    <span className="text-[9px] font-black px-1 py-0.5 bg-slate-100 rounded border border-slate-200">
                                      {prov.confidence ? `${prov.confidence}%` : '✓'}
                                    </span>
                                  )}
                                </button>
                              )}
                            </div>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </React.Fragment>
              ))}

              {/* API 6D ANNEXURES SECTION */}
              <tr className="bg-slate-100 font-black text-slate-800">
                <td colSpan={2 + items.length} className="px-5 py-2.5 text-xs uppercase tracking-wider border-y border-slate-300">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-3.5 h-3.5 text-brand-600" />
                    <span>API 6D ANNEXURE REQUIREMENTS (INFORMATIVE / NORMATIVE)</span>
                  </div>
                </td>
              </tr>

              {API_6D_ANNEXURES.map((annex) => (
                <tr key={annex.key} className="hover:bg-brand-50/40 transition-colors group">
                  <td className="px-4 py-2.5 text-center font-bold text-slate-500 border-r border-slate-200 bg-white group-hover:bg-brand-50/40 sticky left-0 z-10">
                    {annex.code}
                  </td>
                  <td className="px-5 py-2.5 font-semibold text-slate-800 border-r border-slate-200 bg-white group-hover:bg-brand-50/40 sticky left-12 z-10">
                    <div className="flex items-center justify-between gap-2">
                      <span>{annex.name}</span>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold ${
                        annex.type === 'N' ? 'bg-amber-100 text-amber-800' : 'bg-blue-100 text-blue-800'
                      }`}>
                        {annex.type === 'N' ? 'Normative (N)' : 'Informative (I)'}
                      </span>
                    </div>
                  </td>
                  {items.map((item, itemIdx) => {
                    const cellVal = getItemValue(item, annex.key, annex.type === 'N' ? 'Yes' : 'No');
                    const isChecked = String(cellVal).toLowerCase() === 'yes' || cellVal === true;

                    return (
                      <td key={itemIdx} className="px-3 py-2 border-r border-slate-200 text-slate-700 text-xs text-center">
                        <div className="flex items-center justify-center">
                          <ToggleSwitch
                            checked={isChecked}
                            onChange={(newVal) => handleCellChange(itemIdx, annex.key, newVal ? 'Yes' : 'No')}
                            disabled={readOnly}
                            activeColor={annex.type === 'N' ? 'bg-emerald-600' : 'bg-brand-600'}
                          />
                        </div>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* CONTRACT REVIEW - GENERAL SECTION */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-5">
        <div className="border-b border-slate-100 pb-3">
          <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <ClipboardCheck className="w-5 h-5 text-brand-600" />
            CONTRACT REVIEW - GENERAL (Quality Assurance & Commercial Compliance)
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Standard quality and legal checks required by ISO 9001 and API Spec Q1 for order acceptance.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {CONTRACT_REVIEW_GENERAL.map((q) => {
            const currentAnswer = generalReview[q.code] !== undefined ? generalReview[q.code] : (quotation?.contractReviewGeneral?.[q.code]?.answer || q.defaultAnswer);
            const isChecked = currentAnswer === 'Yes' || String(currentAnswer).toLowerCase() === 'yes';

            return (
              <div key={q.code} className="p-4 bg-slate-50 rounded-xl border border-slate-200/80 space-y-2">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1">
                    <span className="font-black text-brand-700 text-xs mr-2">{q.code}.</span>
                    <span className="font-bold text-slate-800 text-xs">{q.question}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <ToggleSwitch
                      checked={isChecked}
                      onChange={(newVal) => handleGeneralReviewToggle(q.code, newVal)}
                      disabled={readOnly}
                      activeColor="bg-emerald-600"
                    />
                  </div>
                </div>
                {q.notes && (
                  <p className="text-[11px] text-slate-500 pl-5 italic">
                    {q.notes}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* FIELD-LEVEL PROVENANCE MODAL */}
      {activeProvenance && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-lg w-full overflow-hidden">
            {/* Modal Header */}
            <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-brand-400" />
                <div>
                  <h4 className="font-bold text-sm">Field Extraction Provenance</h4>
                  <p className="text-[11px] text-slate-300">
                    Offer Sr. #{activeProvenance.itemIndex} — {activeProvenance.fieldName}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setActiveProvenance(null)}
                className="p-1 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-6 space-y-4 text-xs">
              <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-200">
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">Extracted Value</span>
                  <span className="text-sm font-black text-slate-900">{activeProvenance.value || activeProvenance.normalizedValue || '-'}</span>
                </div>
                <div className="text-right">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">Confidence</span>
                  <span className={`inline-flex items-center gap-1 font-black text-sm ${
                    activeProvenance.confidence >= 85 ? 'text-emerald-600' : 'text-amber-600'
                  }`}>
                    {activeProvenance.confidence ? `${activeProvenance.confidence}%` : '100%'}
                  </span>
                </div>
              </div>

              <div className="space-y-2">
                <div className="grid grid-cols-2 gap-2">
                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-0.5">Source Document</span>
                    <span className="font-semibold text-slate-800 break-all">{activeProvenance.source?.document || activeProvenance.sourceDocument || 'Client RFQ Attachment'}</span>
                  </div>
                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-0.5">Location / Page</span>
                    <span className="font-semibold text-slate-800">{activeProvenance.source?.location || (activeProvenance.page ? `Page ${activeProvenance.page}` : 'Line Item Row')}</span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-0.5">Extraction Method</span>
                    <span className="font-semibold text-brand-700 uppercase font-mono">{activeProvenance.extractionMethod || 'DETERMINISTIC'}</span>
                  </div>
                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-0.5">Validation State</span>
                    <span className={`font-semibold uppercase font-mono ${
                      activeProvenance.validationState === 'CONFLICT' ? 'text-amber-600' : 'text-emerald-700'
                    }`}>{activeProvenance.validationState || 'VALID'}</span>
                  </div>
                </div>

                {/* Source Evidence Text */}
                <div className="p-3.5 bg-brand-50/50 rounded-xl border border-brand-100 space-y-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-brand-800 block">Raw Source Evidence</span>
                  <p className="font-mono text-[11px] text-slate-800 bg-white p-2 rounded-lg border border-brand-100/60 leading-relaxed select-all">
                    "{activeProvenance.source?.evidence || activeProvenance.rawValue || activeProvenance.evidence || activeProvenance.value || 'Direct customer specification match'}"
                  </p>
                </div>

                {activeProvenance.reasoning && (
                  <p className="text-[11px] text-slate-500 italic pl-1">
                    Note: {activeProvenance.reasoning}
                  </p>
                )}
              </div>
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-3 bg-slate-50 border-t border-slate-200 flex justify-end">
              <button
                type="button"
                onClick={() => setActiveProvenance(null)}
                className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-bold text-xs transition-colors cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
