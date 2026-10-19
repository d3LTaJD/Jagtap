const mongoose = require('mongoose');
const Qap = require('../models/Qap');
const Quotation = require('../models/Quotation');
const { notifyRoles, sendEmail } = require('../services/notificationService');
const ActivityLog = require('../models/ActivityLog');
const { getNextSequenceValue } = require('../utils/counter');
const { hasPermission } = require('../config/permissions');
const { generateQapPdf } = require('../services/qapPdfService');

exports.generateQapFromQuotation = async (req, res, next) => {
  try {
    const quotation = await Quotation.findById(req.body.quotationId).populate('items');
    if (!quotation) return res.status(404).json({ status: 'error', message: 'Quotation not found' });

    let activities = [];
    let docChecklists = [];
    
    // Helpers for parsing specs
    const parseItemSpecs = (item, q) => {
      const desc = item.description || '';
      
      // 1. Get Class
      let classVal = item.dynamicFields?.valve_class || q.dynamicFields?.valve_class || '150#';
      const classMatch = desc.match(/(150|300|600|800|900|1500|2500)#/i) || desc.match(/class\s*(150|300|600|800|900|1500|2500)/i);
      if (classMatch) {
        classVal = classMatch[1] + '#';
      }

      // 2. Get Size (DN)
      let sizeVal = null;
      if (item.dynamicFields?.valve_size) {
        sizeVal = parseInt(item.dynamicFields.valve_size, 10);
      } else if (q.dynamicFields?.valve_size) {
        sizeVal = parseInt(q.dynamicFields.valve_size, 10);
      }
      
      const sizeMmMatch = desc.match(/(?:dn|\b)(\d+)\s*(?:mm|nb)/i);
      if (sizeMmMatch) {
        sizeVal = parseInt(sizeMmMatch[1], 10);
      } else {
        const inchFractions = {
          '1/2': 15, '0.5': 15, '3/4': 20, '0.75': 20, '1': 25,
          '1-1/4': 32, '1.25': 32, '1 1/4': 32, '1-1/2': 40, '1.5': 40, '1 1/2': 40,
          '2': 50, '2-1/2': 65, '2.5': 65, '2 1/2': 65, '3': 80, '4': 100, '6': 150,
          '8': 200, '10': 250, '12': 300, '14': 350, '16': 400, '18': 450, '20': 500,
          '22': 550, '24': 600, '26': 650, '28': 700, '30': 750, '32': 800, '34': 850,
          '36': 900, '38': 950, '40': 1000, '42': 1050, '48': 1200, '54': 1350, '56': 1400,
          '60': 1500
        };
        const inchMatch = desc.match(/((?:\d+\/\d+|\d+\.\d+|\d+))\s*(?:"|inch|in\b)/i);
        if (inchMatch && inchFractions[inchMatch[1]]) {
          sizeVal = inchFractions[inchMatch[1]];
        }
      }
      
      if (!sizeVal) sizeVal = 50; // Fallback to 50mm

      const isCheckValve = desc.toLowerCase().includes('check valve') ||
                           item.dynamicFields?.valve_type === 'Check Valve' ||
                           q.dynamicFields?.valve_type === 'Check Valve';

      const isGlobeValve = !isCheckValve && (
                           desc.toLowerCase().includes('globe valve') ||
                           item.dynamicFields?.valve_type === 'Globe Valve' ||
                           q.dynamicFields?.valve_type === 'Globe Valve'
      );

      const isBallValve = !isCheckValve && !isGlobeValve && (
                          desc.toLowerCase().includes('ball valve') || 
                          item.dynamicFields?.valve_type === 'Ball Valve' ||
                          q.dynamicFields?.valve_type === 'Ball Valve' ||
                          item.productCategory === 'Valves' ||
                          q.productCategory === 'Valves'
      );

      return { classVal, sizeVal, isBallValve, isCheckValve, isGlobeValve };
    };

    const getBallValveDefaults = (size, classStr, qFields = {}) => {
      const isTMBV = qFields.valve_ball_type ? qFields.valve_ball_type.includes('TMBV') : (
        classStr === '150#' || classStr === '300#' ? size > 150 : (
          classStr === '600#' ? size >= 50 : (
            classStr === '800#' ? size > 50 : true
          )
        )
      );

      const operatingType = qFields.valve_operating || (
        classStr === '150#' ? (size <= 150 ? 'Handle' : 'Gear Box') : (
          classStr === '300#' ? (size <= 100 ? 'Handle' : 'Gear Box') : (
            classStr === '600#' ? (size <= 80 ? 'Handle' : 'Gear Box') : (
              classStr === '800#' ? (size <= 50 ? 'Handle' : 'Gear Box') : 'Gear Box'
            )
          )
        )
      );

      const designStd = qFields.valve_design_std || (size <= 40 ? 'ISO 17292' : 'API 6D 25TH ED');
      const testingStd = qFields.valve_testing_std || (size <= 40 ? 'API 598' : 'API 6D 25TH ED');
      const paintingDft = qFields.valve_painting_dft || '120 Micron';

      const mocBody = qFields.valve_moc_body || (classStr === '800#' ? 'ASTM A105' : 'ASTM A216 Gr. WCB');
      const mocBall = qFields.valve_moc_ball || 'ASTM A216 Gr. WCB + 75 MIC ENP';
      const mocStem = qFields.valve_moc_stem || 'ASTM A479 Gr. 410';
      const mocSeat = qFields.valve_moc_seat || 'PTFE';

      return { isTMBV, operatingType, designStd, testingStd, paintingDft, mocBody, mocBall, mocStem, mocSeat };
    };

    const getCheckValveDefaults = (size, classStr, qFields = {}) => {
      const subtype = size <= 40 ? 'Lift Check Valve' : 'Swing Check Valve';
      const designStd = qFields.valve_design_std || (size <= 40 ? 'BS 1868' : 'API 6D 25TH ED');
      const testingStd = qFields.valve_testing_std || (size <= 40 ? 'API 598' : 'API 6D 25TH ED');
      const paintingDft = qFields.valve_painting_dft || '120 Micron';
      
      const mocBody = qFields.valve_moc_body || (classStr === '800#' ? 'ASTM A105' : 'ASTM A216 Gr. WCB');
      const mocBall = qFields.valve_moc_ball || (classStr === '800#' ? '13% Cr Steel' : 'ASTM A216 Gr. WCB + STELLITED');
      const mocStem = qFields.valve_moc_stem || 'ASTM A479 Gr. 410';
      const mocSeat = qFields.valve_moc_seat || 'ASTM A216 Gr. WCB + STELLITED';

      return { subtype, designStd, testingStd, paintingDft, mocBody, mocBall, mocStem, mocSeat };
    };

    const getGlobeValveDefaults = (size, classStr, qFields = {}) => {
      const isHandWheelDefault = (
        classStr === '150#' ? size <= 250 : (
          classStr === '300#' ? size <= 200 : (
            classStr === '600#' ? size <= 150 : (
              classStr === '800#' ? size <= 50 : size <= 80
            )
          )
        )
      );
      
      const operatingType = qFields.valve_operating || (isHandWheelDefault ? 'Hand Wheel' : 'Gear Box');
      const designStd = qFields.valve_design_std || (size <= 40 ? 'ISO 15761' : 'BS 1873');
      const testingStd = qFields.valve_testing_std || 'API 598';
      const paintingDft = qFields.valve_painting_dft || '120 Micron';
      
      const mocBody = qFields.valve_moc_body || (classStr === '800#' ? 'ASTM A105' : 'ASTM A216 Gr. WCB');
      const mocBall = qFields.valve_moc_ball || (classStr === '800#' ? '13% Cr Steel' : 'ASTM A216 Gr. WCB + STELLITED');
      const mocStem = qFields.valve_moc_stem || 'ASTM A479 Gr. 410';
      const mocSeat = qFields.valve_moc_seat || 'ASTM A216 Gr. WCB + STELLITED';

      return { operatingType, designStd, testingStd, paintingDft, mocBody, mocBall, mocStem, mocSeat };
    };

    const getTestPressures = (classStr) => {
      const pressures = {
        '150#': { shell: 450, seat: 325, air: 100 },
        '300#': { shell: 1125, seat: 825, air: 100 },
        '600#': { shell: 2250, seat: 1650, air: 100 },
        '800#': { shell: 3050, seat: 2250, air: 100 },
        '900#': { shell: 3300, seat: 2450, air: 100 },
        '1500#': { shell: 5500, seat: 4050, air: 100 },
        '2500#': { shell: 9200, seat: 67700, air: 100 }
      };
      return pressures[classStr] || { shell: 450, seat: 325, air: 100 };
    };

    const getTestDurations = (size) => {
      if (size <= 100) return { shell: '2 Minutes', seat: '2 Minutes' };
      if (size <= 250) return { shell: '5 Minutes', seat: '5 Minutes' };
      if (size <= 450) return { shell: '15 Minutes', seat: '5 Minutes' };
      return { shell: '30 Minutes', seat: '10 Minutes' };
    };

    // Process each quotation item to build activities and checklist
    let isPipingValve = false;

    const item = quotation.items?.find(it => {
      const d = (it.description || '').toLowerCase();
      return d.includes('valve') || it.productCategory === 'Valves';
    }) || quotation.items?.[0] || {};
    {
      const qFields = item.dynamicFields || quotation.dynamicFields || {};
      const { classVal, sizeVal, isBallValve, isCheckValve, isGlobeValve } = parseItemSpecs(item, quotation);
      
      if (!isBallValve && !isCheckValve && !isGlobeValve) {
        // Fallback for non-ball valve items
        if (item.testsRequired && item.testsRequired.includes('RT')) {
          activities.push({
            activityNo: activities.length + 1,
            stageOfManufacture: 'NDT',
            activityName: `Radiographic Examination on ${item.description}`,
            referenceDocument: 'ASME Sec V Art 2',
            acceptanceCriteria: 'ASME B16.34',
            inspectionType: 'W',
            status: 'Planned'
          });
          docChecklists.push({ documentType: `RT Film & Report - Item ${item.itemNo}`, status: 'Awaited' });
        }
        return;
      }

      isPipingValve = true;

      // Valve specifications & defaults
      let defaults;
      if (isCheckValve) {
        defaults = getCheckValveDefaults(sizeVal, classVal, qFields);
      } else if (isGlobeValve) {
        defaults = getGlobeValveDefaults(sizeVal, classVal, qFields);
      } else {
        defaults = getBallValveDefaults(sizeVal, classVal, qFields);
      }
      
      // Determine tests required (from dynamicFields OR item details)
      const hasRT = qFields.valve_test_rt === 'Yes' || (item.testsRequired && item.testsRequired.includes('RT')) || (
        (classVal === '600#' || classVal === '900#' || classVal === '1500#' || classVal === '2500#') ||
        (['150#', '300#'].includes(classVal) && sizeVal >= 350)
      );
      const hasUT = qFields.valve_test_ut === 'Yes' || (item.testsRequired && item.testsRequired.includes('UT')) || (
        classVal === '800#'
      );
      const hasDPT = qFields.valve_test_dpt === 'Yes' || (item.testsRequired && item.testsRequired.includes('DPT'));
      const hasMPT = qFields.valve_test_mpt === 'Yes' || (item.testsRequired && item.testsRequired.includes('MPT'));
      const hasNACE = qFields.valve_nace_req === 'Yes';
      const hasFugitive = qFields.valve_test_fugitive_emission === 'Yes';
      const hasCryo = qFields.valve_test_cryogenic === 'Yes';
      const hasDemo = qFields.valve_test_demo_function === 'Yes';
      const hasIGC = qFields.valve_test_igc === 'Yes';
      const hasPMI = qFields.valve_test_pmi === 'Yes';
      const hasHeatChart = qFields.valve_heat_treatment_chart === 'Yes';
      const hasSeismic = qFields.valve_test_seismic === 'Yes';
      const hasIbrCe = qFields.valve_ibr_ce_cert === 'Yes';
      const hasValidation = qFields.valve_design_validation === 'Yes';
      const minTemp = qFields.valve_min_design_temp || '0° C';
      const hasImpactTest = qFields.valve_test_impact_hardness === 'Yes' || minTemp === '-29° C' || minTemp === '-45° C' || classVal === '800#';

      // ─────────────────────────────────────────────────────────────────
      // Add documents to document checklist
      // ─────────────────────────────────────────────────────────────────
      const addDoc = (docType, remarks = '') => {
        if (!docChecklists.some(d => d.documentType === docType)) {
          docChecklists.push({ documentType: docType, status: 'Awaited', remarks });
        }
      };

      const mtcStd = qFields.valve_mtc_std || 'EN 10204 3.1';
      addDoc(`Material Test Certificate (MTC) - ${mtcStd}`, `Required for pressure containing/controlling parts`);
      addDoc('Chemical & Physical Test Reports');
      addDoc('Hardness Test Report');
      addDoc('WPS & PQR approval records');
      addDoc('Solution Annealing Heat Treatment Report');
      addDoc('Calibration Certificates (Pressure Gauges / Instruments)');
      
      if (!isCheckValve && !isGlobeValve) {
        addDoc('Antistatic Test Report');
      }
      
      if (hasRT) addDoc('RT Films and Radiography Examination Report');
      if (hasUT) addDoc('Ultrasonic Testing (UT) Report');
      if (hasDPT) addDoc('Dye Penetrant Testing (DPT) Report');
      if (hasMPT) addDoc('Magnetic Particle Testing (MPT) Report');
      if (hasNACE) addDoc('NACE MR0175 / MR0103 Compliance Certificate');
      if (hasFugitive) addDoc('Fugitive Emission Leakage Test Report');
      if (hasCryo) addDoc('Cryogenic Testing Report');
      if (hasDemo) addDoc('Valve Functional Performance Test Report');
      if (hasIGC) addDoc('Intergranular Corrosion (IGC) Test Report (ASTM A262)');
      if (hasPMI) addDoc('Positive Material Identification (PMI) Report');
      if (hasHeatChart) addDoc('Heat Treatment Charts & Records');
      if (hasImpactTest) addDoc('Charpy Impact Test Report');
      if (hasSeismic) addDoc('Seismic Qualification Certificate');
      if (hasIbrCe) addDoc('IBR Form III-C / CE Certificate of Conformance');
      if (hasValidation) addDoc('API 6D Design Validation Report');

      addDoc('Hydrostatic & Pneumatic Test Report');
      addDoc('Visual & Painting Inspection DFT Report');
      addDoc('Final Dimension & Packing List Checksheet');

      // ─────────────────────────────────────────────────────────────────
      // DYNAMIC 7-STAGE PETRO VALVES QAP ACTIVITIES GENERATION
      // Matching 3.1_QAP Format No. R/5.2/1 Rev01
      // ─────────────────────────────────────────────────────────────────
      const p = getTestPressures(classVal);
      const d = getTestDurations(sizeVal);
      const isBW = (item.description || '').toUpperCase().includes('BW') || 
                   (qFields.valve_ends || '').toUpperCase().includes('BW');

      const mocBody = item.materialGrade || qFields.valve_moc_body || defaults.mocBody;
      const mocBall = item.trimMaterial || qFields.valve_moc_ball || defaults.mocBall;
      const mocStem = qFields.valve_moc_stem || defaults.mocStem;
      const mocSeat = qFields.valve_moc_seat || defaults.mocSeat;
      const mocFastener = qFields.valve_moc_fastener || 'ASTM A193 Gr.B7 / ASTM A194 Gr.2H';
      const mocPup = qFields.valve_moc_pup || 'ASTM A106 Gr.B';

      let actIndex = 1;
      const pushAct = (data) => {
        activities.push({
          srNo: String(actIndex++),
          activityNo: activities.length + 1,
          status: 'Planned',
          responsibleParty: 'Manufacturer / TPI',
          ...data
        });
      };

      // ────────────────── SECTION 1: RAW MATERIAL (Critical) ──────────────────
      const bodyPartName = isBallValve ? '1) Body, Side P/c, Bonnet, Trunnion' : 
                           (isCheckValve ? '1) Body, Cover Casting' : '1) Body, Bonnet Casting');
      pushAct({
        sectionNo: '1',
        sectionTitle: 'RAW MATERIAL (Critical)',
        component: bodyPartName,
        typeOfCheck: '1.Heat Treatment',
        quantumOfCheck: '100%',
        referenceDocument: mocBody,
        acceptanceNorms: mocBody,
        formatOfRecord: 'Foundry Report as per EN10204 Type (ISO 10474) 3.1',
        inHouseOutSource: 'O',
        inspectionPvpl: 'P',
        inspectionTpi: 'R'
      });
      pushAct({
        sectionNo: '1',
        sectionTitle: 'RAW MATERIAL (Critical)',
        component: '',
        typeOfCheck: '2.Chem.Test',
        quantumOfCheck: 'Per Heat',
        referenceDocument: mocBody,
        acceptanceNorms: mocBody,
        formatOfRecord: 'Foundry Report as per EN10204 Type 3.1',
        inHouseOutSource: 'O',
        inspectionPvpl: 'P',
        inspectionTpi: 'R'
      });
      pushAct({
        sectionNo: '1',
        sectionTitle: 'RAW MATERIAL (Critical)',
        component: '',
        typeOfCheck: '3.Phy.Test',
        quantumOfCheck: 'Per Heat',
        referenceDocument: mocBody,
        acceptanceNorms: mocBody,
        formatOfRecord: 'Foundry Report as per EN10204 Type 3.1',
        inHouseOutSource: 'O',
        inspectionPvpl: 'P',
        inspectionTpi: 'R'
      });
      pushAct({
        sectionNo: '1',
        sectionTitle: 'RAW MATERIAL (Critical)',
        component: '',
        typeOfCheck: '4.Hardness Test',
        quantumOfCheck: 'Per Heat',
        referenceDocument: mocBody,
        acceptanceNorms: mocBody,
        formatOfRecord: 'Foundry Report as per EN10204 Type 3.1',
        inHouseOutSource: 'O',
        inspectionPvpl: 'P',
        inspectionTpi: 'R'
      });
      pushAct({
        sectionNo: '1',
        sectionTitle: 'RAW MATERIAL (Critical)',
        component: '',
        typeOfCheck: '5.Visual & Dim.',
        quantumOfCheck: 'Visual 100% / Dimensions 1%',
        referenceDocument: 'MSS-SP-55 & PV/PRO /VT/03',
        acceptanceNorms: `${defaults.designStd}/ Casting Drg.`,
        formatOfRecord: 'Inspection Report',
        inHouseOutSource: 'I',
        inspectionPvpl: 'P',
        inspectionTpi: 'R'
      });
      pushAct({
        sectionNo: '1',
        sectionTitle: 'RAW MATERIAL (Critical)',
        component: '',
        typeOfCheck: minTemp === '-29° C' ? '6.Impact Test at -29°C' : '6.Impact Test at 0°C',
        quantumOfCheck: 'Per Heat',
        referenceDocument: 'ASTM A 370',
        acceptanceNorms: 'Energy Value 27J Avg./ 22J Min (One Spec)/ Applicable Material Std./ Data sheet',
        formatOfRecord: 'Lab T.C/ Foundry T.C./ 3.1 Certi.',
        inHouseOutSource: 'O',
        inspectionPvpl: 'P',
        inspectionTpi: 'R'
      });
      pushAct({
        sectionNo: '1',
        sectionTitle: 'RAW MATERIAL (Critical)',
        component: '',
        typeOfCheck: '7.MPT Test (Casting of Body & S.P)*',
        quantumOfCheck: '100%',
        referenceDocument: 'ASME B16.34, App-II/ PV/PRO/MPT/03',
        acceptanceNorms: 'ASME B16.34, App-II/ PV/PRO/MPT/03',
        formatOfRecord: 'Inspection Report',
        inHouseOutSource: 'I/O',
        inspectionPvpl: 'P',
        inspectionTpi: 'R'
      });

      // Component 2: Trim (Ball / Disc)
      const trimPartName = isBallValve ? '2) Ball' : (isCheckValve ? '2) Swing Disc / Clapper' : '2) Disc / Wedge');
      pushAct({
        sectionNo: '1',
        sectionTitle: 'RAW MATERIAL (Critical)',
        component: trimPartName,
        typeOfCheck: '1.Heat Treatment',
        quantumOfCheck: '100%',
        referenceDocument: mocBall,
        acceptanceNorms: mocBall,
        formatOfRecord: 'Foundry Report as per EN10204 Type (ISO 10474) 3.1',
        inHouseOutSource: 'O',
        inspectionPvpl: 'P',
        inspectionTpi: 'R'
      });
      pushAct({
        sectionNo: '1',
        sectionTitle: 'RAW MATERIAL (Critical)',
        component: '',
        typeOfCheck: '2.Chem.Test',
        quantumOfCheck: 'Per Heat',
        referenceDocument: mocBall,
        acceptanceNorms: mocBall,
        formatOfRecord: 'Foundry Report as per EN10204 Type 3.1',
        inHouseOutSource: 'O',
        inspectionPvpl: 'P',
        inspectionTpi: 'R'
      });
      pushAct({
        sectionNo: '1',
        sectionTitle: 'RAW MATERIAL (Critical)',
        component: '',
        typeOfCheck: '3.Phy.Test',
        quantumOfCheck: 'Per Heat',
        referenceDocument: mocBall,
        acceptanceNorms: mocBall,
        formatOfRecord: 'Foundry Report as per EN10204 Type 3.1',
        inHouseOutSource: 'O',
        inspectionPvpl: 'P',
        inspectionTpi: 'R'
      });
      pushAct({
        sectionNo: '1',
        sectionTitle: 'RAW MATERIAL (Critical)',
        component: '',
        typeOfCheck: '4.Hardness Test',
        quantumOfCheck: 'Per Heat',
        referenceDocument: mocBall,
        acceptanceNorms: mocBall,
        formatOfRecord: 'Foundry Report as per EN10204 Type 3.1',
        inHouseOutSource: 'O',
        inspectionPvpl: 'P',
        inspectionTpi: 'R'
      });
      pushAct({
        sectionNo: '1',
        sectionTitle: 'RAW MATERIAL (Critical)',
        component: '',
        typeOfCheck: '5.Visual & Dim.',
        quantumOfCheck: 'Visual 100% / Dimensions 1%',
        referenceDocument: 'MSS-SP-55 & PV/PRO /VT/03',
        acceptanceNorms: `${defaults.designStd}/ Casting Drg.`,
        formatOfRecord: 'Inspection Report',
        inHouseOutSource: 'I',
        inspectionPvpl: 'P',
        inspectionTpi: 'R'
      });
      pushAct({
        sectionNo: '1',
        sectionTitle: 'RAW MATERIAL (Critical)',
        component: '',
        typeOfCheck: minTemp === '-29° C' ? '6.Impact Test at -29°C' : '6.Impact Test at 0°C',
        quantumOfCheck: 'Per Heat',
        referenceDocument: 'ASTM A 370',
        acceptanceNorms: 'Energy Value 27J Avg./ 22J Min (One Spec)/ Applicable Material Std./ Data sheet',
        formatOfRecord: 'Lab T.C/ Foundry T.C./ 3.1 Certi.',
        inHouseOutSource: 'O',
        inspectionPvpl: 'P',
        inspectionTpi: 'R'
      });

      // Component 3: Stem (R.bar)
      if (!isCheckValve) {
        pushAct({
          sectionNo: '1',
          sectionTitle: 'RAW MATERIAL (Critical)',
          component: '3) Stem (R.bar)',
          typeOfCheck: '1.Heat Treatment & Chem.Test',
          quantumOfCheck: '100% Per R. Bar/ Heat',
          referenceDocument: `${mocStem} (NO CASTING)`,
          acceptanceNorms: `${mocStem} (NO CASTING)`,
          formatOfRecord: 'Supplier/ Lab T.C / 3.1 Certi.',
          inHouseOutSource: 'O',
          inspectionPvpl: 'P',
          inspectionTpi: 'R'
        });
        pushAct({
          sectionNo: '1',
          sectionTitle: 'RAW MATERIAL (Critical)',
          component: '',
          typeOfCheck: '2.Phy.Test',
          quantumOfCheck: 'Per R. Bar/ Heat',
          referenceDocument: mocStem,
          acceptanceNorms: mocStem,
          formatOfRecord: 'Supplier/ Lab T.C / 3.1 Certi.',
          inHouseOutSource: 'O',
          inspectionPvpl: 'P',
          inspectionTpi: 'R'
        });
        pushAct({
          sectionNo: '1',
          sectionTitle: 'RAW MATERIAL (Critical)',
          component: '',
          typeOfCheck: '3.Hardness Test',
          quantumOfCheck: 'Per R. Bar/ Heat',
          referenceDocument: mocStem,
          acceptanceNorms: mocStem,
          formatOfRecord: 'Supplier/ Lab T.C / 3.1 Certi.',
          inHouseOutSource: 'O',
          inspectionPvpl: 'P',
          inspectionTpi: 'R'
        });
        pushAct({
          sectionNo: '1',
          sectionTitle: 'RAW MATERIAL (Critical)',
          component: '',
          typeOfCheck: '4.Visual & Dim.',
          quantumOfCheck: 'Visual 100% / Dimensions 1%',
          referenceDocument: 'PV/PRO /VT/03/ Internal Drg.',
          acceptanceNorms: 'PV/PRO /VT/03/ Internal Drg.',
          formatOfRecord: 'Incoming GRN/ IIR',
          inHouseOutSource: 'I',
          inspectionPvpl: 'P',
          inspectionTpi: 'R'
        });
        pushAct({
          sectionNo: '1',
          sectionTitle: 'RAW MATERIAL (Critical)',
          component: '',
          typeOfCheck: '5.Impact Test at 0°C',
          quantumOfCheck: 'Per R. Bar/ Heat',
          referenceDocument: 'ASTM A 370',
          acceptanceNorms: 'Energy Value 27J Avg./ 22J Min (One Spec)/ Applicable Material Std./ Data sheet',
          formatOfRecord: 'Lab T.C/ Foundry T.C./ 3.1 Certi.',
          inHouseOutSource: 'O',
          inspectionPvpl: 'P',
          inspectionTpi: 'R'
        });
      }

      // Component 4: Seat Holder / Seat Ring
      pushAct({
        sectionNo: '1',
        sectionTitle: 'RAW MATERIAL (Critical)',
        component: isBallValve ? '4) Seat Holder' : '4) Seat Ring',
        typeOfCheck: '2.Chem.Test & Phy.Test',
        quantumOfCheck: 'Per Heat',
        referenceDocument: mocSeat,
        acceptanceNorms: mocSeat,
        formatOfRecord: 'Foundry Report as per EN10204 Type (ISO 10474) 3.1',
        inHouseOutSource: 'O',
        inspectionPvpl: 'P',
        inspectionTpi: 'R'
      });
      pushAct({
        sectionNo: '1',
        sectionTitle: 'RAW MATERIAL (Critical)',
        component: '',
        typeOfCheck: '3.Hardness Test',
        quantumOfCheck: 'Per Heat',
        referenceDocument: mocSeat,
        acceptanceNorms: mocSeat,
        formatOfRecord: 'Inspection Report',
        inHouseOutSource: 'I/O',
        inspectionPvpl: 'P',
        inspectionTpi: 'R'
      });
      pushAct({
        sectionNo: '1',
        sectionTitle: 'RAW MATERIAL (Critical)',
        component: '',
        typeOfCheck: '5.Visual & Dim.',
        quantumOfCheck: 'Visual 100% / Dimensions 1%',
        referenceDocument: `PV/PRO /VT/03/ ${defaults.designStd}/ Drg.`,
        acceptanceNorms: `PV/PRO /VT/03/ ${defaults.designStd}/ Drg.`,
        formatOfRecord: 'Inspection Report',
        inHouseOutSource: 'I',
        inspectionPvpl: 'P',
        inspectionTpi: 'R'
      });
      pushAct({
        sectionNo: '1',
        sectionTitle: 'RAW MATERIAL (Critical)',
        component: '',
        typeOfCheck: '6.Impact Test at 0°C',
        quantumOfCheck: 'Per Heat',
        referenceDocument: 'ASTM A 370',
        acceptanceNorms: 'Energy Value 27J Avg./ 22J Min (One Spec)/ Applicable Material Std./ Data sheet',
        formatOfRecord: 'Lab T.C/Foundry T.C./3.1 Certi.',
        inHouseOutSource: 'O',
        inspectionPvpl: 'P',
        inspectionTpi: 'R'
      });

      // ────────────────── SECTION 2: BOUGHTOUT ITEMS ──────────────────
      pushAct({
        sectionNo: '2',
        sectionTitle: 'BOUGHTOUT ITEMS',
        component: '1) Pressure boundry fastners. API 20 E BSL-1 (Critical)',
        typeOfCheck: '1.Chem.Test & Phy.Test',
        quantumOfCheck: 'Per Lot/Heat',
        referenceDocument: mocFastener,
        acceptanceNorms: mocFastener,
        formatOfRecord: "Supplier's T.C/ Lab T.C./ 3.1 Certi.",
        inHouseOutSource: 'O',
        inspectionPvpl: 'P',
        inspectionTpi: 'R'
      });
      pushAct({
        sectionNo: '2',
        sectionTitle: 'BOUGHTOUT ITEMS',
        component: '',
        typeOfCheck: '3.Hardness Test & Impact Test at -29°C',
        quantumOfCheck: 'Per Lot/Heat',
        referenceDocument: 'ASTM A 370',
        acceptanceNorms: 'Energy Value 27J Avg./ 22J Min',
        formatOfRecord: "Supplier's T.C/ Lab T.C./ 3.1 Certi.",
        inHouseOutSource: 'O',
        inspectionPvpl: 'P',
        inspectionTpi: 'R'
      });
      pushAct({
        sectionNo: '2',
        sectionTitle: 'BOUGHTOUT ITEMS',
        component: '',
        typeOfCheck: '5.Dimensions',
        quantumOfCheck: '1% Per Lot',
        referenceDocument: 'Internal Drg. / ASME B18.2.1 / B18.2.2',
        acceptanceNorms: 'Internal Drg. / ASME B18.2.1 / B18.2.2',
        formatOfRecord: 'Incoming GRN/ Incoming inspection report',
        inHouseOutSource: 'I',
        inspectionPvpl: 'P',
        inspectionTpi: 'R'
      });

      if (isBW) {
        pushAct({
          sectionNo: '2',
          sectionTitle: 'BOUGHTOUT ITEMS',
          component: '2) Pup Piece (Critical)',
          typeOfCheck: '1.Chem.Test & Phy.Test',
          quantumOfCheck: 'Per Lot/Heat',
          referenceDocument: `${mocPup} / As per Approved G.A Drg.`,
          acceptanceNorms: `${mocPup} / As per Approved G.A Drg.`,
          formatOfRecord: "Supplier's T.C/ Lab TC.",
          inHouseOutSource: 'O',
          inspectionPvpl: 'P',
          inspectionTpi: 'R'
        });
        pushAct({
          sectionNo: '2',
          sectionTitle: 'BOUGHTOUT ITEMS',
          component: '',
          typeOfCheck: '3.Hardness Test & Impact Test at -29°C',
          quantumOfCheck: 'Per Lot/Heat',
          referenceDocument: 'ASTM A370',
          acceptanceNorms: 'Energy Value 27J Avg./ 22J Min(One Spec)',
          formatOfRecord: "Supplier's T.C/ Lab TC.",
          inHouseOutSource: 'O',
          inspectionPvpl: 'P',
          inspectionTpi: 'R'
        });
        pushAct({
          sectionNo: '2',
          sectionTitle: 'BOUGHTOUT ITEMS',
          component: '',
          typeOfCheck: '5.Visual & Dim.',
          quantumOfCheck: '10%',
          referenceDocument: 'Surface Defect/ Applicable Sch Th.',
          acceptanceNorms: 'No Surface Defect Accepted/ Applicable Sch Th.',
          formatOfRecord: 'Incoming GRN/ Incoming inspection report',
          inHouseOutSource: 'I',
          inspectionPvpl: 'P',
          inspectionTpi: 'R'
        });
      }

      // ────────────────── SECTION 3: INPROCESS INP. ──────────────────
      pushAct({
        sectionNo: '3',
        sectionTitle: 'INPROCESS INP.',
        component: '1) Body, Side P/c, Ball, Stem (Critical Items)',
        typeOfCheck: '1.Transfer Of Heat No. (Body & S/P) (If Remove during M/C)',
        quantumOfCheck: '100%',
        referenceDocument: 'Petro Q.M./ P.M.',
        acceptanceNorms: 'Petro Q.M./ P.M.',
        formatOfRecord: 'In Process Ins.Report/ Process Route Card/ Inspection Report',
        inHouseOutSource: 'I',
        inspectionPvpl: 'P',
        inspectionTpi: 'R'
      });
      if (isBW) {
        pushAct({
          sectionNo: '3',
          sectionTitle: 'INPROCESS INP.',
          component: '',
          typeOfCheck: '2.Pup Welding',
          quantumOfCheck: '100%',
          referenceDocument: 'As Per Petro WPS, PQR',
          acceptanceNorms: 'As Per Petro WPS, PQR',
          formatOfRecord: 'Weld Inspection Report',
          inHouseOutSource: 'I',
          inspectionPvpl: 'P',
          inspectionTpi: 'R'
        });
        pushAct({
          sectionNo: '3',
          sectionTitle: 'INPROCESS INP.',
          component: '',
          typeOfCheck: '3.RT of Butt Weld Joint',
          quantumOfCheck: '100%',
          referenceDocument: 'ASME BPVC Section V, Article 2',
          acceptanceNorms: 'ASME SECT. VIII, Div.1, UW 51',
          formatOfRecord: 'RT Report',
          inHouseOutSource: 'O',
          inspectionPvpl: 'P',
          inspectionTpi: 'R'
        });
        pushAct({
          sectionNo: '3',
          sectionTitle: 'INPROCESS INP.',
          component: '',
          typeOfCheck: '4.MPT of Bevel End (Before & After Weld)',
          quantumOfCheck: '100%',
          referenceDocument: 'ASME BPVC Section V, Article 7',
          acceptanceNorms: 'ASME BPVC, Section VIII, Division 1, Appendix 6',
          formatOfRecord: 'MPT Test Report',
          inHouseOutSource: 'I/O',
          inspectionPvpl: 'P',
          inspectionTpi: 'R'
        });
      }

      // ────────────────── SECTION 4: ASSEMBLY ──────────────────
      const valveLabel = isBallValve ? 'Ball valve' : (isCheckValve ? 'Check valve' : (isGlobeValve ? 'Globe valve' : 'Gate valve'));
      pushAct({
        sectionNo: '4',
        sectionTitle: 'ASSEMBLY',
        component: valveLabel,
        typeOfCheck: '1.Visual & Dim.',
        quantumOfCheck: '100%',
        referenceDocument: 'Approved GA Drg./ WI',
        acceptanceNorms: 'Approved GA Drg./ WI',
        formatOfRecord: 'Inspection Report',
        inHouseOutSource: 'I',
        inspectionPvpl: 'P',
        inspectionTpi: '--'
      });
      pushAct({
        sectionNo: '4',
        sectionTitle: 'ASSEMBLY',
        component: '',
        typeOfCheck: '2.Fitment & Allignment',
        quantumOfCheck: '100%',
        referenceDocument: 'Approved GA Drg./ WI W.I : 5.6.1/03',
        acceptanceNorms: 'Approved GA Drg./ WI W.I : 5.6.1/03',
        formatOfRecord: 'Inspection Report',
        inHouseOutSource: 'I',
        inspectionPvpl: 'P',
        inspectionTpi: '--'
      });

      // ────────────────── SECTION 5: FINAL INSPECTIONS ──────────────────
      pushAct({
        sectionNo: '5',
        sectionTitle: 'FINAL INSPECTIONS',
        component: valveLabel,
        typeOfCheck: '1.Visual',
        quantumOfCheck: '100%',
        referenceDocument: 'Approved G.A. Drg.',
        acceptanceNorms: 'Approved G.A. Drg.',
        formatOfRecord: 'Final Inspection Report Sheets',
        inHouseOutSource: 'I',
        inspectionPvpl: 'P',
        inspectionTpi: 'W'
      });
      pushAct({
        sectionNo: '5',
        sectionTitle: 'FINAL INSPECTIONS',
        component: '',
        typeOfCheck: '2.Dimensions',
        quantumOfCheck: '100%',
        referenceDocument: 'Approved G.A. Drg.',
        acceptanceNorms: 'Approved G.A. Drg.',
        formatOfRecord: 'Final Inspection Report Sheets',
        inHouseOutSource: 'I',
        inspectionPvpl: 'P',
        inspectionTpi: 'W'
      });
      pushAct({
        sectionNo: '5',
        sectionTitle: 'FINAL INSPECTIONS',
        component: '',
        typeOfCheck: '3.Hyd Body Test',
        quantumOfCheck: '100%',
        referenceDocument: `${defaults.testingStd} / Appvd. Drg.`,
        acceptanceNorms: `Shell: ${p.shell} PSI for ${d.shell} (Zero Leakage)`,
        formatOfRecord: 'Final Inspection Report Sheets',
        inHouseOutSource: 'I',
        inspectionPvpl: 'P',
        inspectionTpi: 'W'
      });
      pushAct({
        sectionNo: '5',
        sectionTitle: 'FINAL INSPECTIONS',
        component: '',
        typeOfCheck: '4.Hyd Seat Test',
        quantumOfCheck: '100%',
        referenceDocument: `${defaults.testingStd} / Appvd. Drg.`,
        acceptanceNorms: `Seat: ${p.seat} PSI for ${d.seat} (Zero Leakage)`,
        formatOfRecord: 'Final Inspection Report Sheets',
        inHouseOutSource: 'I',
        inspectionPvpl: 'P',
        inspectionTpi: 'W'
      });
      if (!isCheckValve) {
        pushAct({
          sectionNo: '5',
          sectionTitle: 'FINAL INSPECTIONS',
          component: '',
          typeOfCheck: '5.Air Seat Test',
          quantumOfCheck: '100%',
          referenceDocument: `${defaults.testingStd} / Appvd. Drg.`,
          acceptanceNorms: `Air Seat: ${p.air} PSI for ${d.seat} (Zero Leakage)`,
          formatOfRecord: 'Final Inspection Report Sheets',
          inHouseOutSource: 'I',
          inspectionPvpl: 'P',
          inspectionTpi: 'W'
        });
      }
      if (isBallValve) {
        pushAct({
          sectionNo: '5',
          sectionTitle: 'FINAL INSPECTIONS',
          component: '',
          typeOfCheck: '6.DBB Hydro for DBB Valves',
          quantumOfCheck: '100%',
          referenceDocument: `${defaults.designStd}`,
          acceptanceNorms: `${defaults.designStd} Seat: ${p.seat} PSI`,
          formatOfRecord: 'Final Inspection Report Sheets',
          inHouseOutSource: 'I',
          inspectionPvpl: 'P',
          inspectionTpi: 'W'
        });
        pushAct({
          sectionNo: '5',
          sectionTitle: 'FINAL INSPECTIONS',
          component: '',
          typeOfCheck: '7.Operational Torque Test',
          quantumOfCheck: 'One Valve per size per Rating in each Group',
          referenceDocument: `${defaults.designStd}`,
          acceptanceNorms: 'Conforming to design torque chart',
          formatOfRecord: 'Inspection Report',
          inHouseOutSource: 'I',
          inspectionPvpl: 'P',
          inspectionTpi: 'R'
        });
        pushAct({
          sectionNo: '5',
          sectionTitle: 'FINAL INSPECTIONS',
          component: '',
          typeOfCheck: '8.Antistatic Test',
          quantumOfCheck: '100%',
          referenceDocument: `${defaults.designStd}`,
          acceptanceNorms: 'Resistance < 10 Ohms at 12V DC',
          formatOfRecord: 'Inspection Report',
          inHouseOutSource: 'I',
          inspectionPvpl: 'P',
          inspectionTpi: 'R'
        });
      }
      pushAct({
        sectionNo: '5',
        sectionTitle: 'FINAL INSPECTIONS',
        component: '',
        typeOfCheck: '9.Functional Test (Open & Close)',
        quantumOfCheck: '10% Minimum 10 Cycles',
        referenceDocument: `${defaults.designStd}`,
        acceptanceNorms: 'Smooth operation across full stroke without binding',
        formatOfRecord: 'Inspection Report',
        inHouseOutSource: 'I',
        inspectionPvpl: 'P',
        inspectionTpi: 'R'
      });
      pushAct({
        sectionNo: '5',
        sectionTitle: 'FINAL INSPECTIONS',
        component: '',
        typeOfCheck: '10.Fire Safe Test',
        quantumOfCheck: 'Type Test',
        referenceDocument: 'API 6FA',
        acceptanceNorms: 'API 6FA',
        formatOfRecord: 'Fire Safe Test Certi.',
        inHouseOutSource: 'I',
        inspectionPvpl: 'R',
        inspectionTpi: 'R'
      });
      pushAct({
        sectionNo: '5',
        sectionTitle: 'FINAL INSPECTIONS',
        component: '',
        typeOfCheck: '11.Calibration of Inst.',
        quantumOfCheck: '100%',
        referenceDocument: `${defaults.designStd}/ PETRO Q.M.`,
        acceptanceNorms: `${defaults.designStd}/ PETRO Q.M.`,
        formatOfRecord: 'Calibration Certi.',
        inHouseOutSource: 'O',
        inspectionPvpl: 'R',
        inspectionTpi: 'R'
      });

      // ────────────────── SECTION 6: PAINTING ──────────────────
      pushAct({
        sectionNo: '6',
        sectionTitle: 'PAINTING',
        component: valveLabel,
        typeOfCheck: '1.Visual',
        quantumOfCheck: '100%',
        referenceDocument: 'As Per G.A. Drg.',
        acceptanceNorms: 'As Per G.A. Drg.',
        formatOfRecord: 'Surface Preparation Report',
        inHouseOutSource: 'I',
        inspectionPvpl: 'P',
        inspectionTpi: 'R'
      });
      pushAct({
        sectionNo: '6',
        sectionTitle: 'PAINTING',
        component: '',
        typeOfCheck: '2.Draining',
        quantumOfCheck: '100%',
        referenceDocument: 'As Per G.A. Drg.',
        acceptanceNorms: 'Complete water drainage & drying',
        formatOfRecord: 'Inspection Report',
        inHouseOutSource: 'I',
        inspectionPvpl: 'P',
        inspectionTpi: '--'
      });
      pushAct({
        sectionNo: '6',
        sectionTitle: 'PAINTING',
        component: '',
        typeOfCheck: '3.Surface Preparation SA 2 1/2',
        quantumOfCheck: '100%',
        referenceDocument: 'G.A.Drg./ As per Petro Procedure/ WI 5.6.1-04',
        acceptanceNorms: 'SA 2 1/2 blast cleaning profile (40-60 micron)',
        formatOfRecord: 'Surface Preparation Report',
        inHouseOutSource: 'I',
        inspectionPvpl: 'P',
        inspectionTpi: 'R'
      });
      pushAct({
        sectionNo: '6',
        sectionTitle: 'PAINTING',
        component: '',
        typeOfCheck: '4.Paint Coat',
        quantumOfCheck: '100%/ Random',
        referenceDocument: 'G.A.Drg./ As per Petro Procedure/ WI 5.6.1-04',
        acceptanceNorms: `Min ${defaults.paintingDft} shade as specified`,
        formatOfRecord: 'Paint Report',
        inHouseOutSource: 'I',
        inspectionPvpl: 'P',
        inspectionTpi: 'R'
      });
      pushAct({
        sectionNo: '6',
        sectionTitle: 'PAINTING',
        component: '',
        typeOfCheck: '5.Marking/ Tagging/ Name Plate',
        quantumOfCheck: '100%/ Random',
        referenceDocument: 'G.A.Drg./ As per Petro Procedure/ WI',
        acceptanceNorms: 'MSS-SP-25 / API 6D standard permanent tagging',
        formatOfRecord: 'Packing Slip',
        inHouseOutSource: 'I',
        inspectionPvpl: 'P',
        inspectionTpi: '--'
      });
      pushAct({
        sectionNo: '6',
        sectionTitle: 'PAINTING',
        component: '',
        typeOfCheck: '6.Auxillary Fitting',
        quantumOfCheck: '100%/ Random',
        referenceDocument: 'G.A.Drg./ As per Petro Procedure/ WI',
        acceptanceNorms: 'Properly mounted, plugged, and secured',
        formatOfRecord: 'Packing Slip',
        inHouseOutSource: 'I',
        inspectionPvpl: 'P',
        inspectionTpi: '--'
      });
      pushAct({
        sectionNo: '6',
        sectionTitle: 'PAINTING',
        component: '',
        typeOfCheck: '7.End Protector',
        quantumOfCheck: '100%/ Random',
        referenceDocument: 'G.A.Drg./ As per Petro Procedure/ WI',
        acceptanceNorms: 'Plastic flange caps/bevel edge protectors installed',
        formatOfRecord: 'Packing Slip',
        inHouseOutSource: 'I',
        inspectionPvpl: 'P',
        inspectionTpi: '--'
      });

      // ────────────────── SECTION 7: FINAL DOCUMENTATION ──────────────────
      pushAct({
        sectionNo: '7',
        sectionTitle: 'FINAL DOCUMENTATION',
        component: 'Final Documentation',
        typeOfCheck: 'Review',
        quantumOfCheck: '100%',
        referenceDocument: `As Per ${defaults.designStd}/ Appvd. Drg./ W.O.`,
        acceptanceNorms: `As Per ${defaults.designStd}/ Appvd. Drg./ W.O.`,
        formatOfRecord: 'Final Dossier-IRN, 3.1 Certi. as per EN10204, Inps & Test Report, Drawing, Etc.',
        inHouseOutSource: 'I',
        inspectionPvpl: 'P/H',
        inspectionTpi: 'R'
      });
    }

    const year = new Date().getFullYear();
    const month = String(new Date().getMonth() + 1).padStart(2, '0');
    const prefix = `QAP-${year}-${month}-`;
    const seq = await getNextSequenceValue(prefix);

    const primaryItem = item;
    const qFields = primaryItem.dynamicFields || quotation.dynamicFields || {};
    const { classVal, sizeVal, isBallValve, isCheckValve, isGlobeValve } = parseItemSpecs(primaryItem, quotation);
    const defaults = isCheckValve ? getCheckValveDefaults(sizeVal, classVal, qFields) :
                     (isGlobeValve ? getGlobeValveDefaults(sizeVal, classVal, qFields) : getBallValveDefaults(sizeVal, classVal, qFields));

    const Customer = require('../models/Customer');
    const customerDoc = await Customer.findById(quotation.customer);
    const clientName = customerDoc?.companyName || quotation.customer?.companyName || 'M/s. PLANT TECH INDUSTRIAL SERVICES LIMITED';
    const endUser = qFields.end_user || quotation.endUser || 'M/s. THINK GAS DISTRIBUTION PVT. LTD.';
    const projectName = quotation.projectName || quotation.title || 'THINK GAS (AG&P) PROJECT';
    const clientPoNo = quotation.customerPoNumber || quotation.poNumber || 'PTIS/HT/2026-27/JULY/47';
    const clientPoDate = quotation.poDate || new Date('2026-07-29');

    const valveTypeStr = isBallValve ? 'BALL VALVES' : (isCheckValve ? 'CHECK VALVES' : (isGlobeValve ? 'GLOBE VALVES' : 'GATE VALVES'));
    const isBW = (primaryItem.description || '').toUpperCase().includes('BW') || (qFields.valve_ends || '').toUpperCase().includes('BW');
    const endConnStr = isBW ? 'BW' : ((primaryItem.description || '').toUpperCase().includes('RTJ') ? 'RTJ' : 'RF');
    const mocBody = primaryItem.materialGrade || qFields.valve_moc_body || defaults.mocBody;
    const mocBall = primaryItem.trimMaterial || qFields.valve_moc_ball || defaults.mocBall;
    const mocStem = qFields.valve_moc_stem || defaults.mocStem;
    const mocSeat = qFields.valve_moc_seat || defaults.mocSeat;

    const custInitials = clientName.replace(/[^a-zA-Z]/g, '').slice(0, 5).toUpperCase() || 'CUST';
    const orderCode = quotation.quotationId ? quotation.quotationId.replace(/[^a-zA-Z0-9]/g, '') : 'P2627041';
    const valveCode = isBallValve ? 'BV' : (isCheckValve ? 'CV' : 'GV');
    const matCode = mocBody.includes('WCC') ? 'WCC' : (mocBody.includes('WCB') ? 'WCB' : 'CS');
    const dynamicQapNumber = `PV/QAP/${custInitials}/${orderCode}/${valveCode}/${matCode}`;
    
    const qapData = {
      qapId: `${prefix}${String(seq).padStart(4, '0')}`,
      qapNumber: dynamicQapNumber,
      revisionNo: '00',
      qapDate: new Date(),
      quotation: quotation._id,
      customer: quotation.customer,
      preparedBy: req.user._id,
      clientName,
      endUser,
      projectName,
      clientPoNo,
      clientPoDate,
      valveDetail: {
        valveType: valveTypeStr,
        designStandard: defaults.designStd,
        testingStandard: defaults.testingStd,
        itemCode: primaryItem.itemCode || orderCode + '01',
        size: `${sizeVal}MM`,
        pressureClass: classVal,
        endConnection: endConnStr,
        bodyMoc: mocBody,
        trimMoc: mocBall,
        stemMoc: mocStem,
        seatMoc: mocSeat,
        fastenerMoc: 'ASTM A193 Gr.B7 / ASTM A194 Gr.2H',
        pupPieceMoc: 'ASTM A106 Gr.B',
        paintingDft: defaults.paintingDft
      },
      formatNo: 'Format No.R/5.2/1  Rev01 Effective From 15-Sept-2022',
      activities,
      documents: docChecklists
    };

    const qap = await Qap.create(qapData);
    
    await notifyRoles({ 
      roles: ['QC_ENGINEER'], 
      type: 'QAP_APPROVAL', 
      title: 'New QAP Generated', 
      message: `QAP ${qap.qapNumber || qap.qapId} generated and awaits your initial review.`, 
      related_id: qap._id 
    });

    res.status(201).json({ status: 'success', data: { qap } });
  } catch (err) {
    next(err);
  }
};

exports.getQaps = async (req, res, next) => {
  try {
    const qaps = await Qap.find()
      .populate('quotation', 'quotationId')
      .populate('customer', 'companyName')
      .sort('-createdAt');
    res.status(200).json({ status: 'success', results: qaps.length, data: { qaps } });
  } catch (err) {
    next(err);
  }
};

exports.getQap = async (req, res, next) => {
  try {
    const qap = await Qap.findById(req.params.id)
      .populate('quotation')
      .populate('customer')
      .populate('preparedBy', 'fullName')
      .populate('reviewedBy', 'fullName')
      .populate('approvedBy', 'fullName');
    if (!qap) return res.status(404).json({ status: 'error', message: 'Not found' });
    res.status(200).json({ status: 'success', data: { qap } });
  } catch (err) {
    next(err);
  }
};

exports.updateQapStatus = async (req, res, next) => {
  try {
    const originalQap = await Qap.findById(req.params.id);
    if (!originalQap) return res.status(404).json({ status: 'error', message: 'QAP not found' });

    const { status, assignedTo, dynamicFields } = req.body;
    const updateData = {};

    // 1. Status change checks
    if (status !== undefined && status !== originalQap.status) {
      if (status === 'APPROVED') {
        if (!hasPermission(req.user, 'QAP', 'finalSignOff')) {
          return res.status(403).json({ status: 'error', message: 'Not authorized for final sign-off on QAP' });
        }
        updateData.approvedBy = req.user._id;
      }
      updateData.status = status;
    }

    // 2. Dynamic fields edit check
    if (dynamicFields !== undefined) {
      if (!hasPermission(req.user, 'QAP', 'editActivities')) {
        return res.status(403).json({ status: 'error', message: 'Not authorized to edit QAP activities or fields' });
      }
      
      let existing = {};
      if (originalQap.dynamicFields) {
        if (typeof originalQap.dynamicFields.toObject === 'function') {
          existing = originalQap.dynamicFields.toObject();
        } else if (originalQap.dynamicFields instanceof Map) {
          existing = Object.fromEntries(originalQap.dynamicFields);
        } else if (typeof originalQap.dynamicFields === 'object') {
          existing = { ...originalQap.dynamicFields };
        }
      }

      const merged = { ...existing, ...(dynamicFields || {}) };
      const cleaned = {};
      for (const [k, v] of Object.entries(merged)) {
        if (!k.startsWith('$') && !k.startsWith('_')) {
          cleaned[k] = v;
        }
      }
      updateData.dynamicFields = cleaned;
    }

    // 3. Assignment check
    if (assignedTo !== undefined && assignedTo?.toString() !== originalQap.assignedTo?.toString()) {
      if (!hasPermission(req.user, 'QAP', 'finalSignOff') && !hasPermission(req.user, 'QAP', 'editActivities')) {
        return res.status(403).json({ status: 'error', message: 'Not authorized to assign QAPs' });
      }
      updateData.assignedTo = assignedTo || null;
    }

    // 4. Dynamic QAP header and matrix edit check
    const allowedHeaderFields = ['qapNumber', 'revisionNo', 'qapDate', 'endUser', 'clientName', 'projectName', 'clientPoNo', 'clientPoDate', 'valveDetail', 'activities', 'documents', 'preparedByName', 'approvedByName', 'formatNo'];
    allowedHeaderFields.forEach(f => {
      if (req.body[f] !== undefined) {
        if (f === 'valveDetail' && originalQap.valveDetail) {
          const existingVd = originalQap.valveDetail.toObject ? originalQap.valveDetail.toObject() : originalQap.valveDetail;
          updateData.valveDetail = { ...existingVd, ...req.body.valveDetail };
        } else if (f === 'activities' && Array.isArray(req.body.activities)) {
          updateData.activities = req.body.activities.map(act => {
            const cleanAct = { ...act };
            if (cleanAct._id && !mongoose.Types.ObjectId.isValid(cleanAct._id)) {
              delete cleanAct._id;
            }
            return cleanAct;
          });
        } else {
          updateData[f] = req.body[f];
        }
      }
    });

    const qap = await Qap.findByIdAndUpdate(req.params.id, updateData, { new: true })
      .populate('quotation')
      .populate('customer')
      .populate('preparedBy', 'fullName')
      .populate('reviewedBy', 'fullName')
      .populate('approvedBy', 'fullName');

    if (status && status !== originalQap.status) {
      await ActivityLog.create({
        user_id: req.user._id,
        action: 'STATUS_CHANGE',
        module: 'QAP',
        details: `QAP ${qap.qapId} status changed from ${originalQap.status} to ${status}`,
        related_id: qap._id
      });
      
      if (status === 'UNDER_REVIEW') {
        await notifyRoles({ roles: ['DIRECTOR', 'DIR'], type: 'QAP_APPROVAL', title: 'QAP Approval Required', message: `QAP ${qap.qapId} awaits Director approval.`, related_id: qap._id });
        const adminUsers = await require('../models/User').find({ role: { $in: ['DIRECTOR', 'DIR'] } });
        adminUsers.forEach(u => {
          sendEmail({ userId: u._id, subject: 'QAP Approval Required', text: `Please approve QAP ${qap.qapId}` });
        });
      }
    }

    if (assignedTo && assignedTo.toString() !== originalQap.assignedTo?.toString()) {
      await ActivityLog.create({
        user_id: req.user._id,
        action: 'ASSIGNMENT',
        module: 'QAP',
        details: `QAP ${qap.qapId} assigned to ${assignedTo}`,
        related_id: qap._id
      });
    }

    res.status(200).json({ status: 'success', data: { qap } });
  } catch (err) {
    next(err);
  }
};

/**
 * Download official Petro Valves Quality Assurance Plan PDF
 */
exports.downloadQapPdf = async (req, res, next) => {
  try {
    const qap = await Qap.findById(req.params.id)
      .populate({
        path: 'quotation',
        populate: { path: 'customer' }
      })
      .populate('customer')
      .populate('workOrder')
      .populate('preparedBy', 'fullName name')
      .populate('reviewedBy', 'fullName name')
      .populate('approvedBy', 'fullName name');

    if (!qap) {
      return res.status(404).json({ status: 'error', message: 'QAP not found' });
    }

    const pdfBuffer = await generateQapPdf(qap);

    const safeName = (qap.qapNumber || qap.qapId || 'QAP').replace(/[\/\\?%*:|"<>]/g, '_');
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${safeName}.pdf"`);
    res.send(pdfBuffer);
  } catch (err) {
    console.error('[QAP PDF Download Error]', err);
    next(err);
  }
};

/**
 * Send official Petro Valves QAP PDF to client via email
 */
exports.sendQapToClient = async (req, res, next) => {
  try {
    const qap = await Qap.findById(req.params.id)
      .populate({
        path: 'quotation',
        populate: { path: 'customer' }
      })
      .populate('customer')
      .populate('workOrder')
      .populate('preparedBy', 'fullName name email')
      .populate('reviewedBy', 'fullName name email')
      .populate('approvedBy', 'fullName name email');

    if (!qap) {
      return res.status(404).json({ status: 'error', message: 'QAP not found' });
    }

    const { to, cc, subject, messageBody } = req.body;
    const recipientEmail = to || qap.customer?.email || qap.quotation?.customer?.email;

    if (!recipientEmail) {
      return res.status(400).json({ status: 'error', message: 'Recipient email address (to) is required.' });
    }

    // Generate the official 4-page PDF buffer
    const pdfBuffer = await generateQapPdf(qap);
    const safeName = (qap.qapNumber || qap.qapId || 'QAP').replace(/[\/\\?%*:|"<>]/g, '_');
    const emailSubject = subject || `Quality Assurance Plan (QAP) - ${qap.qapNumber || qap.qapId} - Petro Valves Pvt. Ltd.`;
    const emailBody = messageBody || `Dear Customer,\n\nPlease find attached the official Quality Assurance Plan (QAP Format No. R/5.2/1 Rev01) for ${qap.valveDetail?.valveType || 'Valves'} under Project: ${qap.projectName || 'Process Valves'} and P.O. No.: ${qap.clientPoNo || 'Internal'}.\n\nPlease review and let us know if any further inspections or client-witness stages are required.\n\nBest regards,\nPetro Valves Pvt. Ltd.`;

    const { sendEmail } = require('../services/emailService');

    const emailOptions = {
      to: recipientEmail,
      cc: cc || undefined,
      subject: emailSubject,
      text: emailBody,
      html: `
        <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #1e293b; max-width: 650px;">
          <div style="border-bottom: 2px solid #0b3b60; padding-bottom: 12px; margin-bottom: 16px;">
            <h2 style="color: #0b3b60; margin: 0; font-size: 18px;">Petro Valves Pvt. Ltd.</h2>
            <p style="margin: 4px 0 0 0; font-size: 13px; color: #64748b; font-weight: bold;">Quality Assurance &amp; Inspection Department</p>
          </div>
          <div style="font-size: 14px; white-space: pre-line; margin-bottom: 20px;">
            ${emailBody}
          </div>
          <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px 16px; margin-bottom: 20px;">
            <p style="margin: 0 0 6px 0; font-size: 12px; font-weight: bold; color: #334155;">QAP Reference Details:</p>
            <ul style="margin: 0; padding-left: 20px; font-size: 12px; color: #475569;">
              <li><strong>QAP No.:</strong> ${qap.qapNumber || qap.qapId} (Rev: ${qap.revisionNo || '00'})</li>
              <li><strong>Client / End User:</strong> ${qap.clientName || ''} / ${qap.endUser || ''}</li>
              <li><strong>P.O. Number:</strong> ${qap.clientPoNo || 'N/A'}</li>
              <li><strong>Valve Spec:</strong> ${qap.valveDetail?.valveType || ''} ${qap.valveDetail?.size || ''} ${qap.valveDetail?.pressureClass || ''}</li>
            </ul>
          </div>
          <div style="border-top: 1px solid #cbd5e1; padding-top: 12px; font-size: 11px; color: #94a3b8;">
            Attachment: <strong>${safeName}.pdf</strong> (Official 4-Page Quality Assurance Plan)<br/>
            This email was automatically dispatched by Petro Valves Workflow Automation.
          </div>
        </div>
      `,
      attachments: [
        {
          filename: `${safeName}.pdf`,
          content: pdfBuffer,
          contentType: 'application/pdf'
        }
      ]
    };

    await sendEmail(emailOptions);

    // Update QAP document
    qap.sentToClientDate = new Date();
    await qap.save();

    await ActivityLog.create({
      user_id: req.user._id,
      action: 'EMAIL_SENT',
      module: 'QAP',
      details: `Official QAP PDF (${qap.qapNumber || qap.qapId}) emailed to client at ${recipientEmail}`,
      related_id: qap._id
    });

    res.status(200).json({
      status: 'success',
      message: `Official QAP PDF successfully emailed to ${recipientEmail}!`,
      data: { qap }
    });
  } catch (err) {
    console.error('[Send QAP Email Error]', err);
    next(err);
  }
};
