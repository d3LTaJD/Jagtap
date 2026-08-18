const fs = require('fs');
const path = require('path');
const { generateQuotationPdf } = require('../services/quotationPdf');

async function testPdfGeneration() {
  console.log('--- Testing 5-Page Petro Valves PDF Generation ---');

  const mockQuotation = {
    quotationId: 'PV/J/QTN/P-001/26-27',
    createdAt: new Date('2026-07-05'),
    senderCompany: 'ABC Constractor',
    clientName: 'ABC Constractor',
    customer: {
      companyName: 'ABC Constractor',
      address: 'Ahmedabad, Gujarat, India',
      mobileNumber: '+91 90237232XX',
      emailAddress: 'sales@petrovalves.co.in',
      primaryContactName: 'Mr. Jay'
    },
    enquiry: {
      createdAt: new Date('2026-07-05'),
      projectName: 'Pipeline Project',
      subject: 'Offer for Valves as per your requirements.'
    },
    contactMobile: '+91 90237232XX',
    contactEmail: 'sales@petrovalves.co.in',
    kindAttention: 'Mr. Jay',
    enquiryRefText: 'Your Enquiry by   E-Mail   on DT.   05/07/26',
    projectName: 'Pipeline Project',
    subjectText: 'Offer for Valves as per your requirements.',
    salutationOpeningText: 'We acknowledge with thanks the receipt of your above referred enquiry and we are pleased to submit our proposal as under.',
    technicalSpecificationClause: 'We offered our valves as per Specification given in Contract Review Check.',
    technicalDeviations: '',
    pricePartNotice: 'We offer our Valves as below, considering Contract Review Check (Format No. R/5.1.3.5/2 Rev04).',
    cert32Percent: 5,
    pfPercent: 5,
    tpiCharges: 60000,
    signatoryName: 'Jay Mistry',
    signatoryDesignation: '(Sales & Projects)',
    signatoryPhone: '9023723212',
    items: [
      {
        description: 'BALL VALVE 15MM 800#',
        quantity: 2,
        unitPrice: 2200,
        dynamicFields: {
          valve_type: 'BALL',
          valve_size: '15',
          valve_class: '800',
          valve_api6d_monogram: 'No',
          valve_qsl_level: 'No',
          valve_design_type: '3 P/C REDUCE BORE',
          valve_bore: 'REDUCE BORE',
          valve_end_connection: 'FLANGE',
          valve_operating: 'LEVER',
          valve_ball_type: 'SOLID BALL',
          valve_direction: 'Bi Directional',
          valve_service: 'GAS',
          valve_seat_type: 'Soft Seat',
          valve_design_std: 'BS 5351',
          valve_testing_std: 'API 598',
          valve_min_design_press: '1750 PSI',
          valve_max_design_press: '1975 PSI',
          valve_min_design_temp: '-29° C',
          valve_max_design_temp: '121° C',
          valve_drain_conn: 'No',
          valve_vent_conn: 'No',
          valve_lifting_lug: 'No',
          valve_support_foot: 'No',
          valve_fire_safe: 'No',
          valve_antistatic: 'No',
          valve_locking_device: 'No',
          valve_pigging: 'No',
          valve_pressure_relief: 'No',
          valve_cavity_relief: 'No',
          valve_bypass_conn: 'No',
          valve_corrosion_allowance: '1.5',
          valve_special_req: 'No',
          valve_moc_body: 'ASTM A105',
          valve_moc_ball: '13% CR. STEEL',
          valve_moc_stem: '13% Cr. Steel',
          valve_moc_seat: '13% CR. STEEL',
          valve_moc_stud_nuts: 'ASTM A193 Gr. B7 & ASTM A194 Gr. 2H',
          valve_extended_bonnet: 'No',
          valve_mtc: 'EN 10204 3.2',
          valve_rt: 'No',
          valve_ut: 'No',
          valve_dpt: 'No',
          valve_mpt: 'No',
          valve_nace: 'No',
          valve_fugitive_emission: 'No',
          valve_cryogenics: 'No',
          valve_demo_function: 'No',
          valve_igc: 'No',
          valve_pmi: 'No',
          valve_chemical_test: 'Yes',
          valve_physical_test: 'Yes',
          valve_hardness_containing: 'Yes',
          valve_hardness_controlling: 'Yes',
          valve_heat_treatment: 'No',
          valve_impact_hardness: '0° C',
          valve_pqr_wps: 'Yes',
          valve_solution_annealing: 'No',
          valve_seismic: 'No',
          valve_calib_cert: 'Yes',
          valve_ibr_ce: 'No',
          valve_design_val_api6d: 'No',
          valve_hydro_shell: '3050 (02)',
          valve_hydro_seat: '2250 (02)',
          valve_air_seat: '100 (02)',
          valve_dbb_hydro: '-',
          valve_back_seat: '-',
          valve_antistatic_test: 'No',
          valve_painting: '300',
          valve_packing: 'Yes',
          valve_dispatch_by: 'By Road',
          valve_location: 'As per requirement',
          valve_other_special: 'No',
          annex_a: 'No',
          annex_b: 'No',
          annex_c: 'Yes',
          annex_d: 'Yes',
          annex_e: 'No',
          annex_f: 'No',
          annex_g: 'As per requirement',
          annex_h: 'Yes',
          annex_i: 'No',
          annex_j: 'No',
          annex_k: 'No',
          annex_l: 'No',
          annex_m: 'No'
        }
      },
      {
        description: 'GLOBE VALVE 200MM 600#',
        quantity: 1,
        unitPrice: 205000,
        dynamicFields: {
          valve_type: 'GLOBE',
          valve_size: '200',
          valve_class: '600',
          valve_api6d_monogram: 'No',
          valve_qsl_level: 'No',
          valve_design_type: 'BB OS & Y',
          valve_bore: 'FULL BORE',
          valve_end_connection: 'FLANGE',
          valve_operating: 'GEAR',
          valve_ball_type: 'PLUG TYPE',
          valve_direction: 'Single Directional',
          valve_service: 'GAS',
          valve_seat_type: 'Metal Seat',
          valve_design_std: 'BS 1873',
          valve_testing_std: 'API 598',
          valve_moc_body: 'ASTM A216 Gr. WCB',
          valve_moc_ball: '13% CR. STEEL',
          valve_moc_stem: '13% Cr. Steel',
          valve_moc_seat: '13% CR. STEEL',
          valve_moc_stud_nuts: 'ASTM A193 Gr. B7 & ASTM A194 Gr. 2H',
          valve_rt: 'Yes',
          valve_ut: 'No'
        }
      },
      {
        description: 'CHECK VALVE 25MM 800#',
        quantity: 5,
        unitPrice: 3800,
        dynamicFields: {
          valve_type: 'CHECK',
          valve_size: '25',
          valve_class: '800',
          valve_design_type: 'PISTON TYPE',
          valve_bore: 'REDUCE BORE',
          valve_end_connection: 'FLANGE',
          valve_operating: 'SELF ACTING',
          valve_direction: 'Single Directional',
          valve_service: 'GAS',
          valve_seat_type: 'Metal Seat',
          valve_design_std: 'API 602 / BS 5352',
          valve_testing_std: 'API 598',
          valve_moc_body: 'ASTM A105',
          valve_rt: 'No',
          valve_ut: 'Yes'
        }
      },
      {
        description: 'GATE VALVE 50MM 300#',
        quantity: 3,
        unitPrice: 12500,
        dynamicFields: {
          valve_type: 'GATE',
          valve_size: '50',
          valve_class: '300',
          valve_design_type: 'BB OS & Y',
          valve_bore: 'FULL BORE',
          valve_end_connection: 'FLANGE',
          valve_operating: 'HAND WHEEL',
          valve_direction: 'Bi Directional',
          valve_service: 'GAS',
          valve_seat_type: 'Metal Seat',
          valve_design_std: 'API 600',
          valve_testing_std: 'API 598',
          valve_moc_body: 'ASTM A216 Gr. WCB',
          valve_rt: 'No',
          valve_ut: 'Yes'
        }
      },
      {
        description: 'BALL VALVE 100MM 150#',
        quantity: 4,
        unitPrice: 45000,
        dynamicFields: {
          valve_type: 'BALL',
          valve_size: '100',
          valve_class: '150',
          valve_design_type: '2 P/C LONG',
          valve_bore: 'FULL BORE',
          valve_end_connection: 'FLANGE',
          valve_operating: 'LEVER',
          valve_direction: 'Bi Directional',
          valve_service: 'GAS',
          valve_seat_type: 'Soft Seat',
          valve_design_std: 'API 6D 25TH ED',
          valve_testing_std: 'API 6D 25TH ED',
          valve_moc_body: 'ASTM A216 Gr. WCB',
          valve_rt: 'No',
          valve_ut: 'Yes'
        }
      },
      {
        description: 'GLOBE VALVE 50MM 600#',
        quantity: 2,
        unitPrice: 28000,
        dynamicFields: {
          valve_type: 'GLOBE',
          valve_size: '50',
          valve_class: '600',
          valve_design_type: 'BB OS & Y',
          valve_bore: 'FULL BORE',
          valve_end_connection: 'FLANGE',
          valve_operating: 'HAND WHEEL',
          valve_direction: 'Single Directional',
          valve_service: 'GAS',
          valve_seat_type: 'Metal Seat',
          valve_design_std: 'BS 1873',
          valve_testing_std: 'API 598',
          valve_moc_body: 'ASTM A216 Gr. WCB',
          valve_rt: 'No',
          valve_ut: 'Yes'
        }
      },
      {
        description: 'CHECK VALVE 80MM 300#',
        quantity: 2,
        unitPrice: 22000,
        dynamicFields: {
          valve_type: 'CHECK',
          valve_size: '80',
          valve_class: '300',
          valve_design_type: 'SWING TYPE',
          valve_bore: 'FULL BORE',
          valve_end_connection: 'FLANGE',
          valve_operating: 'SELF ACTING',
          valve_direction: 'Single Directional',
          valve_service: 'GAS',
          valve_seat_type: 'Metal Seat',
          valve_design_std: 'BS 1868',
          valve_testing_std: 'API 598',
          valve_moc_body: 'ASTM A216 Gr. WCB',
          valve_rt: 'No',
          valve_ut: 'Yes'
        }
      },
      {
        description: 'GATE VALVE 150MM 600#',
        quantity: 1,
        unitPrice: 165000,
        dynamicFields: {
          valve_type: 'GATE',
          valve_size: '150',
          valve_class: '600',
          valve_design_type: 'BB OS & Y',
          valve_bore: 'FULL BORE',
          valve_end_connection: 'FLANGE',
          valve_operating: 'GEAR',
          valve_direction: 'Bi Directional',
          valve_service: 'GAS',
          valve_seat_type: 'Metal Seat',
          valve_design_std: 'API 600',
          valve_testing_std: 'API 598',
          valve_moc_body: 'ASTM A216 Gr. WCB',
          valve_rt: 'Yes',
          valve_ut: 'No'
        }
      }
    ]
  };

  const buffer = await generateQuotationPdf(mockQuotation);
  const outPath = path.join(__dirname, 'test_output_quotation.pdf');
  fs.writeFileSync(outPath, buffer);
  console.log(`✅ Successfully generated official 5-page quotation PDF! File size: ${buffer.length} bytes at ${outPath}`);
}

testPdfGeneration()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('❌ PDF Generation Error:', err);
    process.exit(1);
  });
