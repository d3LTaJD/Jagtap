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
  X,
  Edit2,
  ChevronDown
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
      { key: 'valve_design_type', sr: '1', name: 'Design Type', default: '2 p/c', options: ['2 p/c', '3 p/c', 'Lift', 'Swing', 'OS&Y'] },
      { key: 'valve_bore', sr: '2', name: 'Bore', default: 'Full Bore', options: ['Full Bore', 'Reduced Bore', '-'] },
      { key: 'valve_end_connection', sr: '3', name: 'End Type', default: 'Flange end', options: ['Flange end', 'Socket Weld with Pups', 'Butt weld', 'Screwed NPT', 'Other'] },
      { key: 'valve_operating', sr: '4', name: 'Operating of Valves', default: 'Handle', options: ['Handle', 'Hand Wheel', 'Gear Box', 'Actuator', '-'] },
      { key: 'valve_ball_type', sr: '5', name: 'Ball Type', default: 'Floating', options: ['Floating', 'TMBV', 'Globe', '-'] },
      { key: 'valve_direction', sr: '6', name: 'Direction', default: 'Bi-Directional', options: ['Bi-Directional', 'Uni Directional'] },
      { key: 'valve_service', sr: '7', name: 'Service (A) Liquid (B) Gas (C) Others', default: 'Liquid/Gas (Default)', options: ['Liquid/Gas (Default)', 'Liquid / Hydrocarbon', 'Gas / Natural Gas', 'Steam', 'Water', 'Sour Gas (NACE MR0175)', 'Cryogenic'] },
      { key: 'valve_seat_type', sr: '8', name: 'Seat Type', default: 'Soft Seat', options: ['Soft Seat', 'Primary Metal Secondary Soft', 'Metal to Metal', 'Metal Seat'] },
      { key: 'valve_design_std', sr: '9', name: 'Valve Design Standard', default: 'API 6D 25TH ED', options: ['ISO 17292', 'API 6D 25TH ED', 'ASME B16.34', 'BS 1868', 'BS 1873', 'ISO 15761'] },
      { key: 'valve_testing_std', sr: '10', name: 'Valve Testing Standard', default: 'API 6D 25TH ED.', options: ['API 598', 'API 6D 25TH ED.', 'BS EN 12266-1', 'ISO 5208'] },
      { key: 'valve_min_design_pressure', sr: '11', name: 'Design operating Pressure at max temp (PSI)', default: '240 PSI' },
      { key: 'valve_max_design_pressure', sr: '12', name: 'Design Operating Pressure at min temp (PSI)', default: '285 PSI' },
      { key: 'valve_min_design_temp', sr: '13', name: 'Minimum Design Temperature', default: '0° C', options: ['0° C', '-29° C', '-45° C'] },
      { key: 'valve_max_design_temp', sr: '14', name: 'Maximum Design Temperature', default: '65° C', options: ['65° C', '121° C'] },
      { key: 'valve_drain_size', sr: '15', name: 'Drain Connection Size in MM', default: 'No', options: ['No', '15 mm', '25 mm'] },
      { key: 'valve_vent_size', sr: '16', name: 'Vent Connection Size in MM', default: 'No', options: ['No', '15 mm', '25 mm'] },
      { key: 'valve_lifting_lug', sr: '17', name: 'Lifting Lug', default: 'No', options: ['Yes', 'No'] },
      { key: 'valve_support_foot', sr: '18', name: 'Support Foot', default: 'No', options: ['Yes', 'No'] },
      { key: 'valve_fire_safe', sr: '19', name: 'Fire Safe Design', default: 'API 607', options: ['API 607', 'API 6FA'] },
      { key: 'valve_antistatic', sr: '20', name: 'Antistatic Device', default: 'Yes', options: ['Yes', 'No'] },
      { key: 'valve_locking', sr: '21', name: 'Locking Device', default: 'No', options: ['No', 'Yes'] },
      { key: 'valve_pigging', sr: '22', name: 'Is Valve for pigging', default: 'No', options: ['No', 'Yes'] },
      { key: 'valve_pressure_relief', sr: '23', name: 'Pressure Relief Valve', default: 'No', options: ['No', 'Yes'] },
      { key: 'valve_cavity_relief', sr: '24', name: 'Cavity Relief valve', default: 'No', options: ['No', 'Yes'] },
      { key: 'valve_bypass', sr: '25', name: 'By-Pass Connection', default: 'No', options: ['No', 'Yes'] },
      { key: 'valve_corrosion_allowance', sr: '26', name: 'Corrosion Allowance in MM', default: '1.5 mm', options: ['1.5 mm', '2 mm', '3 mm', '5 mm', 'Nil'] },
      { key: 'valve_special_req', sr: '27', name: 'Any Special Req', default: 'No', options: ['No', 'Yes'] }
    ]
  },
  {
    title: 'MATERIAL OF CONSTRUCTION (MOC)',
    id: 'moc',
    rows: [
      { 
        key: 'valve_body_moc', 
        sr: '28', 
        name: 'Body/Side P/C/Bonnet/Trunnion', 
        default: 'ASTM A216 Gr. WCB', 
        options: [
          'ASTM A 216 Gr. WCB',
          'ASTM A 216 Gr. WCC',
          'ASTM A 352 Gr. LCB',
          'ASTM A 352 Gr. LCC',
          'ASTM A 351 Gr. CF8',
          'ASTM A 351 Gr. CF8M',
          'ASTM A 351 Gr. CF3',
          'ASTM A 351 Gr. CF3M',
          'ASTM A 351 Gr. CN7',
          'ASTM A 351 Gr. CN7M',
          'ASTM A 105',
          'ASTM A 350 Gr. LF2',
          'ASTM A182 Gr.F6A CL.1',
          'ASTM A182 Gr.F6A CL.2',
          'ASTM A182 Gr.F304',
          'ASTM A182 Gr.F316',
          'ASTM A182 Gr.F304L',
          'ASTM A182 Gr.F316L',
          'ASTM A182 Gr. F51 (Duplex)',
          'CI',
          'SG IRON'
        ] 
      },
      { 
        key: 'valve_ball_moc', 
        sr: '29', 
        name: 'Ball/Wedge/Disc', 
        default: 'ASTM A216 Gr. WCB + 75 MIC ENP', 
        options: [
          'ASTM A 216 Gr. WCB + 75 MIC ENP',
          'ASTM A 216 Gr. WCB + STELLITED',
          'ASTM A216 Gr.WCB+13% Cr.',
          'ASTM A216 Gr.WCC+75µ ENP',
          'ASTM A352 Gr.LCB+75µ ENP',
          'ASTM A352 Gr.LCC+75µ ENP',
          'ASTM A350 Gr.LF2+75µ ENP',
          'ASTM A 351 Gr. CF8',
          'ASTM A 351 Gr. CF8M',
          'ASTM A 351 Gr. CF3',
          'ASTM A 351 Gr. CF3M',
          'ASTM A 351 Gr. CN7',
          'ASTM A 351 Gr. CN7M',
          'ASTM A 350 Gr. LF2',
          'ASTM A182 Gr.F6A CL.1',
          'ASTM A182 Gr.F6A CL.2',
          'ASTM A182 GR.F6A CL1+75µ ENP',
          'ASTM A182 GR.F6A CL2+75µ ENP',
          'ASTM A182 Gr.F304',
          'ASTM A182 Gr.F316',
          'ASTM A182 Gr.F304L',
          'ASTM A182 Gr.F316L',
          'ASTM A182 Gr. F51',
          'ASTM A105+13% Cr.',
          'ASTM A105 + 75 MIC ENP',
          'ASTM A 479 Gr.SS304',
          'ASTM A 479 Gr.SS316',
          'ASTM A 479 Gr.SS304L',
          'ASTM A 479 Gr.SS316L',
          'ASTM A 479 Gr.SS410',
          'SS304+STR',
          'SS316+STR',
          'SS410+STR',
          'SS4140',
          'SS316',
          '13% Cr.STEEL'
        ] 
      },
      { 
        key: 'valve_stem_moc', 
        sr: '30', 
        name: 'Stem/Hing', 
        default: 'ASTM A479 Gr. 410', 
        options: [
          'ASTM A479 Gr. 410',
          'ASTM A 479 Gr.SS410',
          'ASTM 182 Gr. F6 cl2',
          'ASTM A182 Gr.F6A CL.1',
          'ASTM A182 Gr.F6A CL.2',
          'ASTM A182 Gr.F304',
          'ASTM A182 Gr.F316',
          'ASTM A182 Gr.F304L',
          'ASTM A182 Gr.F316L',
          'ASTM A 479 Gr.SS304',
          'ASTM A 479 Gr.SS316',
          'ASTM A 479 Gr.SS304L',
          'ASTM A 479 Gr.SS316L',
          'ASTM A276 Type 316',
          'ASTM A182 Gr. F51',
          'SS4140',
          '13% Cr.STEEL'
        ] 
      },
      { 
        key: 'valve_seat_ring_moc', 
        sr: '31', 
        name: 'Seat Ring (Soft Seat)/Seat Holder', 
        default: 'PTFE', 
        options: [
          'PTFE',
          'RPTFE',
          'CFT',
          'NYLON 6',
          'DEVLON-S',
          'NCB',
          'PEEK',
          'PTFE + ASTM 182 Gr. F6 cl1',
          'RPTFE + ASTM 182 Gr. F6 cl1',
          'RPTFE + ASTM A182 Gr. F6a CL.1',
          'ASTM A 216 Gr. WCB + STELLITED',
          'ASTM A 217 Gr. CA15',
          'ASTM A217 GR.CA15+75µ ENP',
          'ASTM A 105',
          'ASTM A105+13% Cr.',
          'ASTM A216 Gr.WCB+13% Cr.',
          'ASTM A182 Gr.F6A CL.1',
          'ASTM A182 Gr.F6A CL.2',
          'ASTM A182 Gr.F304',
          'ASTM A182 Gr.F316',
          'ASTM A182 Gr.F304L',
          'ASTM A182 Gr.F316L',
          'ASTM A 479 Gr.SS304',
          'ASTM A 479 Gr.SS316',
          'ASTM A 479 Gr.SS304L',
          'ASTM A 479 Gr.SS316L',
          'ASTM A 479 Gr.SS410',
          'SS304+STR',
          'SS316+STR',
          'SS410+STR',
          'SS4140',
          '13% Cr.STEEL',
          'Metal to Metal (Stellite)'
        ] 
      },
      { 
        key: 'valve_fasteners_moc', 
        sr: '32', 
        name: 'Stud & Nuts', 
        default: 'ASTM A193 Gr. B7 & ASTM A194 Gr. 2H', 
        options: [
          'ASTM A 193 Gr. B7 & ASTM A 194 Gr. 2H',
          'ASTM A 193 Gr. B7M & ASTM A 194 Gr. 2HM',
          'ASTM A 320 Gr. L7 & ASTM A 194 Gr. 7',
          'ASTM A 320 Gr. L7M & ASTM A 194 Gr. 7M',
          'ASTM A 193 Gr.B7+HDG & ASTM A 194 Gr.2H+HDG',
          'ASTM A 193 Gr.B7M+HDG & ASTM A 194 Gr.2HM+HDG',
          'ASTM A 320 Gr.L7+HDG & ASTM A 194 Gr.7+HDG',
          'ASTM A 320 Gr.L7M+HDG & ASTM A 194 Gr.7M+HDG',
          'ASTM A 193 Gr.B7+XYLAN & ASTM A 194 Gr.2H+XYLAN',
          'ASTM A 193 Gr.B7M+XYLAN & ASTM A 194 Gr.2HM+XYLAN',
          'ASTM A 320 Gr.L7+XYLAN & ASTM A 194 Gr.7+XYLAN',
          'ASTM A 320 Gr.L7M+XYLAN & ASTM A 194 Gr.7M+XYLAN',
          'ASTM A 320 Gr B8 & ASTM A 194 Gr. 8',
          'ASTM A 320 Gr8M & ASTM A 194 Gr8M',
          'ASTM A 193 Gr. B8 & ASTM A 194 Gr. 8',
          'ASTM A 193 Gr.B7',
          'ASTM A 194 Gr.2H',
          'ASTM A 193 Gr.B7M',
          'ASTM A 194 Gr.2HM',
          'ASTM A 320 Gr.L7',
          'ASTM A 194 Gr.7',
          'ASTM A 320 Gr.L7M',
          'ASTM A 194 Gr.7M'
        ] 
      },
      { key: 'valve_extended_bonnet', sr: '33', name: 'Extended Bonnet', default: 'No', options: ['No', 'Yes'] }
    ]
  },
  {
    title: 'RAW MATERIAL & SUPPLEMENTARY REQUIRED TESTING DETAILS',
    id: 'testing_supplementary',
    rows: [
      { key: 'test_mtc', sr: '34', name: 'Material Test Certificates', default: 'EN 10204 3.1', options: ['EN 10204 3.1', 'EN 10204 3.2'] },
      { key: 'test_rt', sr: '35', name: 'RT', default: 'No', options: ['Yes', 'No'] },
      { key: 'test_ut', sr: '36', name: 'UT', default: 'No', options: ['Yes', 'No'] },
      { key: 'test_dpt', sr: '37', name: 'DPT', default: 'No', options: ['No', 'Yes'] },
      { key: 'test_mpt', sr: '38', name: 'MPT', default: 'No', options: ['No', 'Yes'] },
      { key: 'test_nace', sr: '39', name: 'NACE Requirement', default: 'No', options: ['No', 'Yes'] },
      { key: 'test_fugitive_emission', sr: '40', name: 'Fugitive emission Test/Helium Test', default: 'No', options: ['No', 'Yes'] },
      { key: 'test_cryogenic', sr: '41', name: 'Cryogenics Test', default: 'No', options: ['No', 'Yes'] },
      { key: 'test_load_moments', sr: '42', name: 'Demonstration of valve function under pressure and pipe loads and moments', default: 'No', options: ['No', 'Yes'] },
      { key: 'test_igc', sr: '43', name: 'IGC', default: 'No', options: ['No', 'Yes'] },
      { key: 'test_pmi', sr: '44', name: 'PMI TEST', default: 'No', options: ['No', 'Yes'] },
      { key: 'test_chemical', sr: '45', name: 'Chemical Test', default: 'Yes', options: ['Yes', 'No'] },
      { key: 'test_physical', sr: '46', name: 'Physical Test', default: 'Yes', options: ['Yes', 'No'] },
      { key: 'test_hardness_pressure_containing', sr: '47', name: 'Hardness Test Report On Pressure Containing Parts', default: 'Yes', options: ['Yes', 'No'] },
      { key: 'test_hardness_pressure_controlling', sr: '48', name: 'Hardness Test Report On Pressure Controlling Parts', default: 'Yes', options: ['Yes', 'No'] },
      { key: 'test_heat_treatment_chart', sr: '49', name: 'Heat Treatment Chart', default: 'No', options: ['No', 'Yes'] },
      { key: 'test_impact', sr: '50', name: 'Impact Hardness Test', default: '0° C', options: ['0° C', '-29° C', '-45° C', 'No'] },
      { key: 'test_pqr_wps', sr: '51', name: 'PQR & WPS', default: 'Yes', options: ['Yes', 'No'] },
      { key: 'test_solution_annealing', sr: '52', name: 'Solution Annealing', default: 'Yes', options: ['Yes', 'No'] },
      { key: 'test_seismic', sr: '53', name: 'Seismic Testing', default: 'No', options: ['No', 'Yes'] },
      { key: 'test_calibration', sr: '54', name: 'Calibration Certificate', default: 'Yes', options: ['Yes', 'No'] },
      { key: 'test_ibr_ce', sr: '55', name: 'IBR/CE Certification', default: 'No', options: ['No', 'Yes'] },
      { key: 'test_api6d_validation', sr: '56', name: "Design Validation as Per API 6D:25th Annexure's", default: 'No', options: ['No', 'Yes'] }
    ]
  },
  {
    title: 'FINAL PRESSURE TESTING (HYDRO & PNEUMATIC)',
    id: 'testing_final',
    rows: [
      { key: 'test_hydro_shell', sr: '57.1', name: 'Hydro Shell Test (PSI)', default: '450 PSI' },
      { key: 'test_hydro_seat', sr: '57.2', name: 'Hydro Seat Test (PSI)', default: '325 PSI' },
      { key: 'test_air_seat', sr: '57.3', name: 'Air Seat test (PSI)', default: '-' },
      { key: 'test_duration_shell', sr: '58.1', name: 'Shell Test Duration', default: '2 Min' },
      { key: 'test_duration_seat', sr: '58.2', name: 'Seat Test Duration', default: '2 Min' },
      { key: 'test_dbb_hydro', sr: '59', name: 'DBB Hydro for DBB Valves', default: '-' },
      { key: 'test_back_seat', sr: '60', name: 'Back seat Test', default: '-' },
      { key: 'test_antistatic_test', sr: '61', name: 'Antistatic Test', default: '-' }
    ]
  },
  {
    title: 'OTHER SPECIFICATION & SHIPMENT',
    id: 'other',
    rows: [
      { key: 'spec_painting', sr: '62', name: 'Painting (DFT Micron)', default: '120 (default)', options: ['120 (default)', 'Other (As per Client Req)'] },
      { key: 'spec_packing', sr: '63', name: 'Packing', default: 'Yes', options: ['Yes', 'No'] },
      { key: 'spec_dispatch', sr: '64', name: 'Dispatch By', default: 'Road (default)', options: ['Road (default)', 'Air', 'Sea'] },
      { key: 'spec_location', sr: '65', name: 'Location', default: 'As Per client Req' },
      { key: 'spec_special_clause', sr: '66', name: 'Is there any special requirement.', default: 'NO', options: ['NO', 'YES'] }
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
  const [customInputCells, setCustomInputCells] = useState({});
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

  const getItemValue = (item, rowKey, fallback = '-') => {
    if (!item) return fallback;
    const dynamic = item.dynamicFields || {};
    const norm = item.normalizedSpecifications || {};
    const derived = item.derivedSpecifications || {};
    const source = item.sourceSpecifications || {};
    const vType = String(dynamic.valve_type || item.valveType || item.description || item.productCategory || 'Ball Valve').toUpperCase();
    const sz = parseInt(String(dynamic.valve_size || dynamic.size || item.size || 50).replace(/[^0-9]/g, ''), 10) || 50;
    const cl = parseInt(String(dynamic.valve_class || dynamic.class || item.pressureClass || 150).replace(/[^0-9]/g, ''), 10) || 150;

    let isTmbv = false;
    if (vType.includes('BALL')) {
      if (cl === 150 || cl === 300) isTmbv = sz >= 200;
      else if (cl === 600) isTmbv = sz >= 50;
      else if (cl === 800) isTmbv = sz >= 65;
      else if (cl >= 900) isTmbv = true;
    }

    let raw = dynamic[rowKey] ?? norm[rowKey] ?? derived[rowKey];

    // Priority resolution for component MOCs across all common aliases and derived fields
    if (!raw && rowKey === 'valve_body_moc') {
      raw = dynamic.valve_body_moc || dynamic.valve_moc_body || dynamic.moc_body || dynamic.body_material || dynamic.shellMaterial ||
            derived.moc_body || derived.valve_body_moc || derived.valve_moc_body ||
            norm.valve_body_moc || norm.valve_moc_body || item.materialGrade;
    }
    if (!raw && rowKey === 'valve_ball_moc') {
      raw = dynamic.valve_ball_moc || dynamic.valve_moc_ball || dynamic.moc_ball || dynamic.trim_moc || dynamic.ball_material ||
            derived.moc_ball || derived.valve_ball_moc || derived.valve_moc_ball || derived.ball_moc ||
            norm.valve_ball_moc || norm.valve_moc_ball;
    }
    if (!raw && rowKey === 'valve_stem_moc') {
      raw = dynamic.valve_stem_moc || dynamic.valve_moc_stem || dynamic.moc_stem || dynamic.stem_material ||
            derived.moc_stem || derived.valve_stem_moc || derived.valve_moc_stem || derived.stem_moc ||
            norm.valve_stem_moc || norm.valve_moc_stem;
    }
    if (!raw && rowKey === 'valve_seat_ring_moc') {
      raw = dynamic.valve_seat_ring_moc || dynamic.valve_moc_seat || dynamic.moc_seat || dynamic.seat_material ||
            derived.moc_seat || derived.valve_seat_ring_moc || derived.valve_moc_seat || derived.seat_moc ||
            norm.valve_seat_ring_moc || norm.valve_moc_seat;
    }
    if (!raw && rowKey === 'valve_fasteners_moc') {
      raw = dynamic.valve_fasteners_moc || dynamic.valve_moc_stud_nuts || dynamic.moc_stud_nuts || dynamic.fasteners_moc ||
            derived.moc_stud_nuts || derived.valve_fasteners_moc || derived.valve_moc_stud_nuts || derived.studs_moc ||
            norm.valve_fasteners_moc || norm.valve_moc_stud_nuts;
    }

    const isInvalidLeak = (rowKey === 'valve_extended_bonnet' && raw === 'Flanged RF') ||
      (vType.includes('CHECK') && (
        (rowKey === 'valve_drain_size' && ['15 mm', '25 mm'].includes(raw)) ||
        (rowKey === 'valve_vent_size' && ['15 mm', '25 mm'].includes(raw)) ||
        (rowKey === 'valve_bore' && ['Full Bore', 'Reduced Bore'].includes(raw)) ||
        (rowKey === 'valve_ball_type' && ['Floating', 'TMBV'].includes(raw)) ||
        (rowKey === 'valve_operating' && ['Handle', 'Gear Box'].includes(raw)) ||
        (rowKey === 'valve_antistatic' && raw === 'Yes') ||
        (rowKey === 'valve_direction' && raw === 'Bi-Directional') ||
        (rowKey === 'valve_ball_moc' && (String(raw).includes('ENP') || raw === 'SS316')) ||
        (rowKey === 'valve_stem_moc' && raw === 'ASTM 182 Gr. F6 cl2') ||
        (rowKey === 'valve_seat_ring_moc' && (raw === 'PTFE' || raw === 'RPTFE' || String(raw).includes('PTFE'))) ||
        (rowKey === 'test_solution_annealing' && raw === 'Yes') ||
        (rowKey === 'test_air_seat' && (raw === '100 PSI' || String(raw).includes('PSI') || String(raw).includes('100'))) ||
        (rowKey === 'test_dbb_hydro' && raw !== '-') ||
        (rowKey === 'test_antistatic_test' && raw !== '-') ||
        ((rowKey.startsWith('annex_') || rowKey.startsWith('api_6d_annex_')) && raw === 'Yes')
      )) ||
      (vType.includes('GLOBE') && (
        (rowKey === 'valve_bore' && ['Full Bore', 'Reduced Bore'].includes(raw)) ||
        (rowKey === 'valve_ball_type' && ['Floating', 'TMBV', '-'].includes(raw)) ||
        (rowKey === 'valve_operating' && (raw === 'Handle' || raw === '-')) ||
        (rowKey === 'valve_direction' && raw === 'Bi-Directional') ||
        (rowKey === 'valve_design_std' && ['API 6D 25TH ED', 'API 6D', 'BS 1868', 'ISO 17292'].includes(raw)) ||
        (rowKey === 'valve_testing_std' && ['API 6D 25TH ED.', 'API 6D 25th Ed', 'API 6D'].includes(raw)) ||
        (rowKey === 'valve_fire_safe' && ['API 607', 'API 6FA'].includes(raw)) ||
        (rowKey === 'valve_antistatic' && raw !== '-') ||
        (rowKey === 'valve_ball_moc' && (String(raw).includes('ENP') || raw === 'SS316' || raw === 'ASTM A216 Gr. WCB + STELLITED')) ||
        (rowKey === 'valve_stem_moc' && (raw === 'ASTM 182 Gr. F6 cl2' || raw === 'ASTM A479 Gr. 410')) ||
        (rowKey === 'valve_seat_ring_moc' && (raw === 'PTFE' || raw === 'RPTFE' || String(raw).includes('PTFE'))) ||
        (rowKey === 'test_dbb_hydro' && raw !== '-') ||
        (rowKey === 'test_back_seat' && raw === '-') ||
        (rowKey === 'test_antistatic_test' && raw !== 'No') ||
        ((rowKey.startsWith('annex_') || rowKey.startsWith('api_6d_annex_')) && raw === 'Yes')
      ));

    if (raw !== undefined && raw !== null && raw !== '' && raw !== 'Ball Valve' && raw !== 'Valves' && !isInvalidLeak) {
      if (typeof raw === 'object') return raw.value || raw.normalizedValue || raw.rawValue || fallback;
      return String(raw);
    }

    if (rowKey === 'valve_size') {
      raw = sz;
    } else if (rowKey === 'valve_class') {
      raw = `${cl}#`;
    } else if (rowKey === 'valve_type') {
      if (vType.includes('CHECK')) {
        raw = sz <= 40 ? 'Lift Check Valve' : 'Swing Check Valve';
      } else {
        raw = dynamic.valve_type || item.productCategory || 'Ball Valve';
      }
    } else if (rowKey === 'valve_design_type') {
      if (vType.includes('CHECK')) raw = sz >= 50 ? 'Swing' : 'Lift';
      else if (vType.includes('GLOBE')) raw = 'OS&Y';
      else raw = [800, 900, 1500, 2500].includes(cl) ? '3 p/c' : (sz >= 650 ? '3 p/c' : '2 p/c');
    } else if (rowKey === 'valve_ball_type') {
      if (vType.includes('CHECK')) raw = '-';
      else if (vType.includes('GLOBE')) raw = 'Globe';
      else raw = isTmbv ? 'TMBV' : 'Floating';
    } else if (rowKey === 'valve_seat_type') {
      if (vType.includes('CHECK') || vType.includes('GLOBE')) raw = 'Metal Seat';
      else raw = isTmbv ? 'Primary Metal Secondary Soft' : 'Soft Seat';
    } else if (rowKey === 'valve_body_moc') {
      raw = dynamic.valve_body_moc || dynamic.valve_moc_body || dynamic.body_material || dynamic.shellMaterial || item.materialGrade;
    } else if (rowKey === 'valve_design_std') {
      if (vType.includes('CHECK')) raw = sz <= 40 ? 'BS 1868' : 'API 6D 25th Ed';
      else if (vType.includes('GLOBE')) raw = sz <= 40 ? 'ISO 15761' : 'BS 1873';
      else raw = sz <= 40 ? 'ISO 17292' : 'API 6D 25TH ED';
    } else if (rowKey === 'valve_testing_std') {
      if (vType.includes('CHECK')) raw = sz <= 40 ? 'API 598' : 'API 6D 25th Ed';
      else if (vType.includes('GLOBE')) raw = 'API 598';
      else raw = sz <= 40 ? 'API 598' : 'API 6D 25TH ED.';
    } else if (rowKey === 'valve_min_design_pressure' || rowKey === 'design_operating_pressure_max_temp_psi') {
      const pressMap = { 150: '240 PSI', 300: '677 PSI', 600: '1335 PSI', 800: '1750 PSI', 900: '2000 PSI', 1500: '3333 PSI', 2500: '5553 PSI' };
      raw = pressMap[cl] || '240 PSI';
    } else if (rowKey === 'valve_max_design_pressure' || rowKey === 'design_operating_pressure_min_temp_psi') {
      const pressMap = { 150: '285 PSI', 300: '740 PSI', 600: '1480 PSI', 800: '1975 PSI', 900: '2220 PSI', 1500: '3705 PSI', 2500: '6170 PSI' };
      raw = pressMap[cl] || '285 PSI';
    } else if (rowKey === 'valve_min_design_temp') {
      raw = cl === 800 ? '-29° C' : '0° C';
    } else if (rowKey === 'valve_max_design_temp') {
      raw = '65° C';
    } else if (rowKey === 'valve_drain_size') {
      if (vType.includes('CHECK') || vType.includes('GLOBE')) raw = 'No';
      else raw = isTmbv ? (sz >= 200 ? '25 mm' : '15 mm') : 'No';
    } else if (rowKey === 'valve_vent_size') {
      if (vType.includes('CHECK') || vType.includes('GLOBE')) raw = 'No';
      else raw = isTmbv ? (sz >= 200 ? '25 mm' : 'No') : 'No';
    } else if (rowKey === 'valve_operating') {
      if (vType.includes('CHECK')) {
        raw = '-';
      } else if (vType.includes('GLOBE')) {
        let requiresGear = false;
        if (cl === 150) requiresGear = sz >= 300;
        else if (cl === 300) requiresGear = sz >= 250;
        else if (cl === 600) requiresGear = sz >= 200;
        else if (cl === 800) requiresGear = false;
        else if (cl >= 900) requiresGear = sz >= 100;
        raw = requiresGear ? 'Gear Box' : 'Hand Wheel';
      } else {
        let requiresGear = false;
        if (cl === 150) requiresGear = sz >= 200;
        else if (cl === 300) requiresGear = sz >= 150;
        else if (cl === 600) requiresGear = sz >= 100;
        else if (cl === 800) requiresGear = false;
        else if (cl === 900) requiresGear = sz >= 80;
        else if (cl === 1500) requiresGear = sz >= 80;
        else if (cl === 2500) requiresGear = sz >= 50;
        raw = requiresGear ? 'Gear Box' : 'Handle';
      }
    } else if (rowKey === 'valve_end_connection') {
      if (vType.includes('GLOBE')) raw = cl === 800 ? 'Socket Weld' : 'Flange end';
      else raw = cl === 800 ? 'Socket Weld with Pups' : 'Flange end';
    } else if (rowKey === 'valve_bore') {
      if (vType.includes('CHECK') || vType.includes('GLOBE')) raw = '-';
      else raw = 'Full Bore';
    } else if (rowKey === 'valve_direction') {
      if (vType.includes('CHECK') || vType.includes('GLOBE')) raw = 'Uni Directional';
      else raw = 'Bi-Directional';
    } else if (rowKey === 'valve_service' || rowKey === 'service') {
      raw = 'Liquid/Gas (Default)';
    } else if (rowKey === 'valve_lifting_lug') {
      let hasLiftingLug = false;
      if (!isTmbv) {
        if (cl === 150 && sz >= 100) hasLiftingLug = true;
        if (cl >= 300 && sz >= 80) hasLiftingLug = true;
      } else {
        if ((cl === 150 || cl === 300) && sz >= 80) hasLiftingLug = true;
        if (cl >= 600 && sz >= 50) hasLiftingLug = true;
      }
      raw = hasLiftingLug ? 'Yes' : 'No';
    } else if (rowKey === 'valve_support_foot') {
      raw = sz >= 200 ? 'Yes' : 'No';
    } else if (rowKey === 'valve_fire_safe') {
      if (vType.includes('GLOBE')) raw = '-';
      else if (vType.includes('CHECK')) raw = 'API 607';
      else raw = isTmbv ? 'API 6FA' : 'API 607';
    } else if (rowKey === 'valve_antistatic' || rowKey === 'antistatic_device' || rowKey === 'antistatic') {
      raw = (vType.includes('CHECK') || vType.includes('GLOBE')) ? '-' : 'Yes';
    } else if (rowKey === 'valve_locking' || rowKey === 'locking_device' || rowKey === 'locking') {
      raw = 'No';
    } else if (rowKey === 'valve_pigging' || rowKey === 'is_valve_for_pigging' || rowKey === 'pigging') {
      raw = 'No';
    } else if (rowKey === 'valve_pressure_relief' || rowKey === 'pressure_relief_valve' || rowKey === 'pressure_relief') {
      raw = 'No';
    } else if (rowKey === 'valve_cavity_relief' || rowKey === 'cavity_relief_valve' || rowKey === 'cavity_relief') {
      raw = 'No';
    } else if (rowKey === 'valve_bypass' || rowKey === 'by_pass_connection' || rowKey === 'bypass') {
      raw = 'No';
    } else if (rowKey === 'valve_corrosion_allowance' || rowKey === 'corrosion_allowance' || rowKey === 'corrosionAllowance') {
      raw = '1.5 mm';
    } else if (rowKey === 'valve_special_req' || rowKey === 'special_req' || rowKey === 'any_special_req' || rowKey === 'specialRequirement') {
      raw = 'No';
    } else if (rowKey === 'valve_body_moc' || rowKey === 'moc_body' || rowKey === 'body_material') {
      raw = derived.moc_body || derived.valve_body_moc || dynamic.valve_body_moc || dynamic.valve_moc_body || item.materialGrade || (cl === 800 ? 'ASTM A105' : 'ASTM A216 Gr. WCB');
    } else if (rowKey === 'valve_ball_moc' || rowKey === 'moc_ball' || rowKey === 'trim_moc' || rowKey === 'ball_material') {
      if (derived.moc_ball || derived.valve_ball_moc || dynamic.valve_ball_moc || dynamic.valve_moc_ball) {
        raw = derived.moc_ball || derived.valve_ball_moc || dynamic.valve_ball_moc || dynamic.valve_moc_ball;
      } else if (vType.includes('GLOBE')) {
        raw = '13% Cr Steel';
      } else if (vType.includes('CHECK')) {
        raw = cl === 800 ? '13% Cr Steel' : 'ASTM A216 Gr. WCB + STELLITED';
      } else {
        raw = cl === 800 ? 'SS316' : 'ASTM A216 Gr. WCB + 75 MIC ENP';
      }
    } else if (rowKey === 'valve_stem_moc' || rowKey === 'moc_stem' || rowKey === 'stem_material') {
      if (derived.moc_stem || derived.valve_stem_moc || dynamic.valve_stem_moc || dynamic.valve_moc_stem) {
        raw = derived.moc_stem || derived.valve_stem_moc || dynamic.valve_stem_moc || dynamic.valve_moc_stem;
      } else if (vType.includes('GLOBE')) {
        raw = '13% Cr Steel';
      } else if (vType.includes('CHECK')) {
        raw = 'ASTM A479 Gr. 410';
      } else {
        raw = cl === 150 ? 'ASTM A479 Gr. 410' : 'ASTM 182 Gr. F6 cl2';
      }
    } else if (rowKey === 'valve_seat_ring_moc' || rowKey === 'moc_seat' || rowKey === 'seat_material') {
      if (derived.moc_seat || derived.valve_seat_ring_moc || dynamic.valve_seat_ring_moc || dynamic.valve_moc_seat) {
        raw = derived.moc_seat || derived.valve_seat_ring_moc || dynamic.valve_seat_ring_moc || dynamic.valve_moc_seat;
      } else if (vType.includes('CHECK') || vType.includes('GLOBE')) {
        raw = 'ASTM A216 Gr. WCB + STELLITED';
      } else if (!isTmbv) {
        raw = cl === 150 ? 'PTFE' : 'RPTFE';
      } else {
        raw = cl === 150 ? 'PTFE + ASTM 182 Gr. F6 cl1' : 'RPTFE + ASTM 182 Gr. F6 cl1';
      }
    } else if (rowKey === 'valve_fasteners_moc' || rowKey === 'moc_stud_nuts' || rowKey === 'fasteners_moc') {
      raw = derived.moc_stud_nuts || derived.valve_fasteners_moc || dynamic.valve_fasteners_moc || dynamic.valve_moc_stud_nuts || 'ASTM A193 Gr. B7 & ASTM A194 Gr. 2H';
    } else if (rowKey === 'valve_extended_bonnet' || rowKey === 'extended_bonnet') {
      raw = 'No';
    } else if (rowKey === 'test_mtc' || rowKey === 'mtc_type' || rowKey === 'mtc') {
      raw = 'EN 10204 3.1';
    } else if (rowKey === 'test_rt' || rowKey === 'rt') {
      let reqRt = false;
      if ([600, 900, 1500, 2500].includes(cl)) reqRt = true;
      else if ((cl === 150 || cl === 300) && sz >= 350) reqRt = true;
      raw = reqRt ? 'Yes' : 'No';
    } else if (rowKey === 'test_ut' || rowKey === 'ut') {
      raw = cl === 800 ? 'Yes' : 'No';
    } else if (['test_dpt', 'test_mpt', 'test_nace', 'test_fugitive_emission', 'test_cryogenic', 'test_load_moments', 'test_igc', 'test_pmi', 'test_heat_treatment_chart', 'test_seismic', 'test_ibr_ce', 'test_api6d_validation'].includes(rowKey) || ['dpt', 'mpt', 'nace', 'nace_requirement', 'fugitive_emission', 'cryogenic', 'load_moments', 'igc', 'pmi', 'heat_treatment_chart', 'seismic', 'ibr_ce', 'api6d_validation'].includes(rowKey)) {
      raw = 'No';
    } else if (rowKey === 'test_solution_annealing' || rowKey === 'solution_annealing') {
      raw = vType.includes('CHECK') ? 'No' : 'Yes';
    } else if (['test_chemical', 'test_physical', 'test_hardness_pressure_containing', 'test_hardness_pressure_controlling', 'test_pqr_wps', 'test_calibration'].includes(rowKey) || ['chemical_test', 'physical_test', 'hardness_containing', 'hardness_controlling', 'pqr_wps', 'calibration'].includes(rowKey)) {
      raw = 'Yes';
    } else if (rowKey === 'test_impact' || rowKey === 'impact_test' || rowKey === 'impact_hardness') {
      const minTemp = dynamic.valve_min_design_temp || dynamic.min_temp;
      if (minTemp && ['0° C', '-29° C', '-45° C'].includes(minTemp)) {
        raw = cl === 800 ? '-29° C' : minTemp;
      } else {
        raw = cl === 800 ? '-29° C' : '0° C';
      }
    } else if (rowKey === 'test_hydro_shell' || rowKey === 'hydro_shell_test' || rowKey === 'hydro_shell_pressure_psi') {
      const shellMap = { 150: 450, 300: 1125, 600: 2250, 800: 3050, 900: 3300, 1500: 5500, 2500: 9200 };
      raw = `${shellMap[cl] || 450} PSI`;
    } else if (rowKey === 'test_hydro_seat' || rowKey === 'hydro_seat_test' || rowKey === 'hydro_seat_pressure_psi') {
      const seatMap = { 150: 325, 300: 825, 600: 1650, 800: 2250, 900: 2450, 1500: 4050, 2500: 6700 };
      raw = `${seatMap[cl] || 325} PSI`;
    } else if (rowKey === 'test_air_seat' || rowKey === 'air_seat_test' || rowKey === 'air_seat_pressure_psi') {
      raw = vType.includes('CHECK') ? '-' : '100 PSI';
    } else if (rowKey === 'test_duration_shell' || rowKey === 'shell_test_duration' || rowKey === 'test_duration_shell_min') {
      let shellDur = '2 Min';
      if (sz >= 500) shellDur = '30 Min';
      else if (sz >= 300) shellDur = '15 Min';
      else if (sz >= 150) shellDur = '5 Min';
      raw = shellDur;
    } else if (rowKey === 'test_duration_seat' || rowKey === 'seat_test_duration' || rowKey === 'test_duration_seat_min') {
      let seatDur = '2 Min';
      if (sz >= 500) seatDur = '10 Min';
      else if (sz >= 150) seatDur = '5 Min';
      raw = seatDur;
    } else if (rowKey === 'test_min_pressures' || rowKey === 'min_test_pressures') {
      const shellMap = { 150: 450, 300: 1125, 600: 2250, 800: 3050, 900: 3300, 1500: 5500, 2500: 9200 };
      const seatMap = { 150: 325, 300: 825, 600: 1650, 800: 2250, 900: 2450, 1500: 4050, 2500: 6700 };
      raw = `Shell: ${shellMap[cl] || 450} PSI, Seat: ${seatMap[cl] || 325} PSI, Air: ${vType.includes('CHECK') ? '-' : '100 PSI'}`;
    } else if (rowKey === 'test_min_durations' || rowKey === 'min_test_durations') {
      let shellDur = '2 Min';
      let seatDur = '2 Min';
      if (sz >= 500) { shellDur = '30 Min'; seatDur = '10 Min'; }
      else if (sz >= 300) { shellDur = '15 Min'; seatDur = '5 Min'; }
      else if (sz >= 150) { shellDur = '5 Min'; seatDur = '5 Min'; }
      raw = `Shell: ${shellDur}, Seat: ${seatDur}`;
    } else if (rowKey === 'test_dbb_hydro' || rowKey === 'dbb_hydro') {
      if (vType.includes('CHECK') || vType.includes('GLOBE')) {
        raw = '-';
      } else if (isTmbv) {
        const seatMap = { 150: 325, 300: 825, 600: 1650, 800: 2250, 900: 2450, 1500: 4050, 2500: 6700 };
        const seatP = seatMap[cl] || 325;
        let seatDur = '2 Min';
        if (sz >= 500) seatDur = '10 Min';
        else if (sz >= 150) seatDur = '5 Min';
        raw = `Seat Test: ${seatP} PSI / ${seatDur}`;
      } else {
        raw = '-';
      }
    } else if (rowKey === 'test_back_seat' || rowKey === 'back_seat_test' || rowKey === 'backseat') {
      if (vType.includes('GLOBE')) {
        const seatMap = { 150: 325, 300: 825, 600: 1650, 800: 2250, 900: 2450, 1500: 4050, 2500: 6700 };
        const seatP = seatMap[cl] || 325;
        let seatDur = '2 Min';
        if (sz >= 500) seatDur = '10 Min';
        else if (sz >= 150) seatDur = '5 Min';
        raw = `Seat Test: ${seatP} PSI / ${seatDur}`;
      } else {
        raw = '-';
      }
    } else if (rowKey === 'test_antistatic_test' || rowKey === 'antistatic_test') {
      if (vType.includes('CHECK')) raw = '-';
      else if (vType.includes('GLOBE')) raw = 'No';
      else raw = 'Yes';
    } else if (rowKey === 'spec_painting' || rowKey === 'painting' || rowKey === 'painting_dft_micron') {
      raw = '120 (default)';
    } else if (rowKey === 'spec_packing' || rowKey === 'packing') {
      raw = 'Yes';
    } else if (rowKey === 'spec_dispatch' || rowKey === 'dispatch_by') {
      raw = 'Road (default)';
    } else if (rowKey === 'spec_location' || rowKey === 'location') {
      raw = 'As Per client Req';
    } else if (rowKey === 'spec_special_clause' || rowKey === 'special_requirement' || rowKey === 'is_special_requirement') {
      raw = 'NO';
    } else if (['annex_c', 'annex_d', 'annex_g', 'annex_h', 'api_6d_annex_c', 'api_6d_annex_d', 'api_6d_annex_g', 'api_6d_annex_h'].includes(rowKey)) {
      raw = (vType.includes('CHECK') || vType.includes('GLOBE')) ? 'No' : 'Yes';
    } else if (rowKey === 'annex_e' || rowKey === 'api_6d_annex_e') {
      raw = (!vType.includes('CHECK') && !vType.includes('GLOBE') && isTmbv) ? 'Yes' : 'No';
    } else if (rowKey.startsWith('annex_') || rowKey.startsWith('api_6d_annex_')) {
      raw = 'No';
    } else {
      raw = derived[rowKey] ?? (source[rowKey]?.value || source[rowKey]);
    }

    if (raw === undefined || raw === null || raw === '') {
      return fallback;
    }

    if (typeof raw === 'object') {
      return raw.value || raw.normalizedValue || raw.rawValue || fallback;
    }

    return String(raw);
  };

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

  const getRowOptions = (row, item) => {
    if (!row.options) return null;
    const dynamic = item?.dynamicFields || {};
    const vType = String(dynamic.valve_type || item?.productCategory || 'Ball Valve').toUpperCase();

    if (row.key === 'valve_seat_type') {
      if (vType.includes('CHECK') || vType.includes('GLOBE')) return ['Metal Seat'];
      return ['Soft Seat', 'Primary Metal Secondary Soft', 'Metal to Metal'];
    }
    if (row.key === 'valve_operating') {
      if (vType.includes('CHECK')) return ['-'];
      if (vType.includes('GLOBE')) return ['Hand Wheel', 'Gear Box', 'Actuator'];
      return ['Handle', 'Gear Box', 'Actuator'];
    }
    if (row.key === 'valve_end_connection') {
      if (vType.includes('GLOBE')) return ['Flange end', 'Socket Weld', 'Butt weld', 'Screwed NPT', 'Other'];
      return ['Flange end', 'Socket Weld with Pups', 'Butt weld', 'Screwed NPT', 'Other'];
    }
    if (row.key === 'valve_design_type') {
      if (vType.includes('CHECK')) return ['Lift', 'Swing'];
      if (vType.includes('GLOBE')) return ['OS&Y'];
      return ['2 p/c', '3 p/c'];
    }
    if (row.key === 'valve_ball_type') {
      if (vType.includes('CHECK') || vType.includes('GLOBE')) return ['-'];
      return ['Floating', 'TMBV'];
    }
    if (row.key === 'valve_bore') {
      if (vType.includes('CHECK') || vType.includes('GLOBE')) return ['-'];
      return ['Full Bore', 'Reduced Bore'];
    }
    if (row.key === 'valve_direction') {
      if (vType.includes('CHECK') || vType.includes('GLOBE')) return ['Uni Directional'];
      return ['Bi-Directional', 'Uni Directional'];
    }
    if (row.key === 'valve_design_std') {
      if (vType.includes('CHECK')) return ['BS 1868', 'API 6D 25th Ed', 'ASME B16.34'];
      if (vType.includes('GLOBE')) return ['ISO 15761', 'BS 1873', 'ASME B16.34'];
      return ['ISO 17292', 'API 6D 25TH ED', 'ASME B16.34', 'BS 5351'];
    }
    if (row.key === 'valve_testing_std') {
      if (vType.includes('CHECK')) return ['API 598', 'API 6D 25th Ed', 'BS EN 12266-1', 'ISO 5208'];
      if (vType.includes('GLOBE')) return ['API 598', 'BS EN 12266-1', 'ISO 5208'];
      return ['API 598', 'API 6D 25TH ED.', 'BS EN 12266-1', 'ISO 5208'];
    }
    if (row.key === 'valve_min_design_temp') {
      return ['0° C', '-29° C', '-45° C'];
    }
    if (row.key === 'valve_max_design_temp') {
      return ['65° C', '121° C'];
    }
    if (row.key === 'valve_drain_size' || row.key === 'valve_vent_size') {
      return ['No', '15 mm', '25 mm'];
    }
    if (row.key === 'valve_lifting_lug' || row.key === 'valve_support_foot') {
      return ['Yes', 'No'];
    }
    if (row.key === 'valve_fire_safe') {
      if (vType.includes('GLOBE')) return ['-'];
      return ['API 607', 'API 6FA'];
    }
    if (row.key === 'valve_corrosion_allowance') {
      return ['1.5 mm', '2 mm', '3 mm', '5 mm', 'Nil'];
    }
    if (row.key === 'valve_antistatic') {
      if (vType.includes('GLOBE') || vType.includes('CHECK')) return ['-'];
      return ['Yes', 'No'];
    }
    if (['valve_locking', 'valve_pigging', 'valve_pressure_relief', 'valve_cavity_relief', 'valve_bypass', 'valve_special_req'].includes(row.key)) {
      return ['Yes', 'No'];
    }
    if (row.key === 'valve_body_moc') {
      return ['ASTM A216 Gr. WCB', 'ASTM A105', 'ASTM A351 Gr. CF8M', 'ASTM A351 Gr. CF8', 'ASTM A352 Gr. LCC', 'ASTM A352 Gr. LCB', 'ASTM A182 Gr. F316', 'ASTM A182 Gr. F51 (Duplex)'];
    }
    if (row.key === 'valve_ball_moc') {
      if (vType.includes('GLOBE')) return ['13% Cr Steel', 'ASTM A216 Gr. WCB + STELLITED', 'SS316'];
      if (vType.includes('CHECK')) return ['ASTM A216 Gr. WCB + STELLITED', '13% Cr Steel'];
      return ['ASTM A216 Gr. WCB + 75 MIC ENP', 'SS316', 'ASTM A105 + 75 MIC ENP', 'ASTM A351 Gr. CF8M', 'ASTM A182 Gr. F316', 'ASTM A352 Gr. LCC + 75 MIC ENP', 'ASTM A182 Gr. F51'];
    }
    if (row.key === 'valve_stem_moc') {
      if (vType.includes('GLOBE')) return ['13% Cr Steel', 'ASTM A479 Gr. 410', 'ASTM 182 Gr. F6 cl2'];
      if (vType.includes('CHECK')) return ['ASTM A479 Gr. 410', 'ASTM 182 Gr. F6 cl2'];
      return ['ASTM A479 Gr. 410', 'ASTM 182 Gr. F6 cl2', 'ASTM A276 Type 316', 'ASTM A182 Gr. F316', 'ASTM A182 Gr. F51'];
    }
    if (row.key === 'valve_seat_ring_moc') {
      if (vType.includes('CHECK') || vType.includes('GLOBE')) return ['ASTM A216 Gr. WCB + STELLITED', '13% Cr Steel'];
      return ['PTFE', 'RPTFE', 'PTFE + ASTM 182 Gr. F6 cl1', 'RPTFE + ASTM 182 Gr. F6 cl1', 'PEEK', 'Devlon', 'Metal to Metal (Stellite)'];
    }
    if (row.key === 'valve_fasteners_moc') {
      return ['ASTM A193 Gr. B7 & ASTM A194 Gr. 2H', 'ASTM A193 Gr. B7M & ASTM A194 Gr. 2HM', 'ASTM A193 Gr. B8 & ASTM A194 Gr. 8', 'ASTM A320 Gr. L7 & ASTM A194 Gr. 7'];
    }
    if (row.key === 'valve_extended_bonnet') {
      return ['Yes', 'No'];
    }
    if (row.key === 'test_mtc') {
      return ['EN 10204 3.1', 'EN 10204 3.2'];
    }
    if (row.key === 'test_impact') {
      return ['0° C', '-29° C', '-45° C', 'No'];
    }
    if (['test_rt', 'test_ut', 'test_dpt', 'test_mpt', 'test_nace', 'test_fugitive_emission', 'test_cryogenic', 'test_load_moments', 'test_igc', 'test_pmi', 'test_chemical', 'test_physical', 'test_hardness_pressure_containing', 'test_hardness_pressure_controlling', 'test_heat_treatment_chart', 'test_pqr_wps', 'test_solution_annealing', 'test_seismic', 'test_calibration', 'test_ibr_ce', 'test_api6d_validation', 'test_antistatic_test', 'spec_packing'].includes(row.key)) {
      return ['Yes', 'No'];
    }
    if (row.key === 'spec_special_clause') {
      return ['NO', 'YES'];
    }
    return row.options;
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
                        const rowOptions = getRowOptions(row, item);
                        const isPureYesNo = rowOptions && rowOptions.length === 2 && rowOptions.includes('Yes') && rowOptions.includes('No');
                        const isCustomInput = !!customInputCells[`${itemIdx}_${row.key}`];

                        if (isPureYesNo && !isCustomInput) {
                          const isChecked = String(cellVal).toLowerCase() === 'yes' || cellVal === true;
                          return (
                            <td 
                              key={itemIdx} 
                              className="px-3 py-2 border-r border-slate-200 text-slate-700 relative text-xs text-center group/cell"
                            >
                              <div className="flex items-center justify-center gap-1.5">
                                <ToggleSwitch
                                  checked={isChecked}
                                  onChange={(newVal) => handleCellChange(itemIdx, row.key, newVal ? 'Yes' : 'No')}
                                  disabled={readOnly}
                                />
                                {!readOnly && (
                                  <button
                                    type="button"
                                    onClick={() => setCustomInputCells(prev => ({ ...prev, [`${itemIdx}_${row.key}`]: true }))}
                                    className="p-1 text-slate-300 hover:text-brand-600 rounded hover:bg-slate-100 transition-colors opacity-0 group-hover/cell:opacity-100"
                                    title="Type custom text"
                                  >
                                    <Edit2 className="w-2.5 h-2.5" />
                                  </button>
                                )}
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
                                  isCustomInput || !rowOptions ? (
                                    <div className="flex items-center gap-1">
                                      <input
                                        type="text"
                                        value={cellVal === '-' ? '' : cellVal}
                                        placeholder={row.default || '-'}
                                        onChange={e => handleCellChange(itemIdx, row.key, e.target.value || '-')}
                                        className="w-full px-2 py-1.5 bg-slate-50 hover:bg-white border border-slate-300 focus:border-brand-500 focus:bg-white rounded-lg text-xs font-medium outline-none transition-all"
                                        autoFocus={isCustomInput}
                                      />
                                      {rowOptions && (
                                        <button
                                          type="button"
                                          onClick={() => setCustomInputCells(prev => ({ ...prev, [`${itemIdx}_${row.key}`]: false }))}
                                          className="p-1 text-slate-400 hover:text-brand-600 rounded hover:bg-slate-100 transition-colors shrink-0"
                                          title="Switch back to dropdown presets"
                                        >
                                          <ChevronDown className="w-3.5 h-3.5" />
                                        </button>
                                      )}
                                    </div>
                                  ) : (
                                    <div className="flex items-center gap-1">
                                      <select
                                        value={cellVal}
                                        onChange={e => {
                                          if (e.target.value === '__CUSTOM__') {
                                            setCustomInputCells(prev => ({ ...prev, [`${itemIdx}_${row.key}`]: true }));
                                          } else {
                                            handleCellChange(itemIdx, row.key, e.target.value);
                                          }
                                        }}
                                        className="w-full px-2 py-1.5 bg-slate-50 hover:bg-white border border-transparent hover:border-slate-300 focus:border-brand-500 focus:bg-white rounded-lg text-xs font-medium outline-none transition-all cursor-pointer truncate"
                                      >
                                        {!rowOptions.includes(cellVal) && cellVal !== '-' && (
                                          <option value={cellVal}>{cellVal}</option>
                                        )}
                                        {rowOptions.map(opt => (
                                          <option key={opt} value={opt}>{opt}</option>
                                        ))}
                                        <option value="-">- (Not Applicable)</option>
                                        <option value="__CUSTOM__">✏️ Custom / Free text...</option>
                                      </select>
                                      <button
                                        type="button"
                                        onClick={() => setCustomInputCells(prev => ({ ...prev, [`${itemIdx}_${row.key}`]: true }))}
                                        className="p-1 text-slate-300 hover:text-brand-600 rounded hover:bg-slate-100 transition-colors opacity-0 group-hover/cell:opacity-100 shrink-0"
                                        title="Type custom text"
                                      >
                                        <Edit2 className="w-3 h-3" />
                                      </button>
                                    </div>
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
                    const isTmbvItem = /trunnion|tmbv/i.test(item.valveType || item.description || '') || item.dynamicFields?.valve_type?.toLowerCase().includes('trunnion');
                    const defaultAnnexVal = (annex.key === 'annex_c' || annex.key === 'annex_d' || annex.key === 'annex_g' || annex.key === 'annex_h' || (annex.key === 'annex_e' && isTmbvItem)) ? 'Yes' : 'No';
                    const cellVal = getItemValue(item, annex.key, defaultAnnexVal);
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
