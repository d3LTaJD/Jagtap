const Qap = require('../models/Qap');
const Quotation = require('../models/Quotation');
const { notifyRoles, sendEmail } = require('../services/notificationService');
const ActivityLog = require('../models/ActivityLog');
const { getNextSequenceValue } = require('../utils/counter');
const { hasPermission } = require('../config/permissions');

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

    quotation.items.forEach((item, index) => {
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

      if (isCheckValve && defaults.designStd === 'API 6D 25TH ED') {
        addDoc('API 6D Annex C - Certificate of Conformance');
        addDoc('API 6D Annex D - Qualification of Inspections and Test Personnel');
        addDoc('API 6D Annex G - Requirements for Non-destructive Examination (NDE)');
        addDoc('API 6D Annex H - Supplementary Documentation Requirements');
      }

      addDoc('Hydrostatic & Pneumatic Test Report');
      addDoc('Visual & Painting Inspection DFT Report');
      addDoc('Final Dimension & Packing List Checksheet');

      // ─────────────────────────────────────────────────────────────────
      // Add activities to inspection activities list
      // ─────────────────────────────────────────────────────────────────
      const addActivity = (stage, name, refDoc, criteria, insType) => {
        activities.push({
          activityNo: activities.length + 1,
          stageOfManufacture: stage,
          activityName: name,
          referenceDocument: refDoc,
          acceptanceCriteria: criteria,
          inspectionType: insType,
          status: 'Planned',
          responsibleParty: 'Manufacturer / TPI'
        });
      };

      // 1. PIM & Procedures
      addActivity('Pre-manufacturing', 'Review of QAP, WPS, PQR, and Welder Qualifications', `${defaults.designStd} / ASME Sec IX`, 'Approved documentation and welder performance records', 'R');
      
      // 2. Material verification
      const partLabel = (isCheckValve || isGlobeValve) ? 'Disc/Wedge' : 'Ball';
      const materialGradeInfo = `Body: ${defaults.mocBody}, ${partLabel}: ${defaults.mocBall}, Stem: ${defaults.mocStem}, Seat: ${defaults.mocSeat}`;
      addActivity('Material Receipt', `Verification of material identity, certificates, and marking (${materialGradeInfo})`, 'EN 10204 / ASTM Spec', 'Verification of marking and chemical/physical test compliance', 'W');
      addActivity('Heat Treatment', 'Verification of Solution Annealing Heat Treatment', 'Material Standard', 'MICRO/Macro structure and hardness conformance', 'R');

      // 3. NDT & Supplementary Tests
      if (hasRT) {
        addActivity('NDT', `Radiographic Examination (RT) of body casting parts`, 'ASME Sec V Art 2', 'ASME B16.34 / API 6D acceptance criteria (free from cracks/voids)', 'W');
      }
      if (hasUT) {
        addActivity('NDT', `Ultrasonic Testing (UT) of forged valve parts`, 'ASME Sec V Art 5', 'ASME B16.34 / API 6D acceptance criteria (free from internal flaws)', 'W');
      }
      if (hasDPT) {
        addActivity('NDT', 'Liquid Dye Penetrant Testing (DPT) on machined surfaces', 'ASME Sec V Art 6', 'ASME B16.34 / API 6D', 'W');
      }
      if (hasMPT) {
        addActivity('NDT', 'Magnetic Particle Testing (MPT) on welded joints / forgings', 'ASME Sec V Art 7', 'ASME B16.34 / API 6D', 'W');
      }
      if (hasPMI) {
        addActivity('Inspection', 'Positive Material Identification (PMI) of critical alloy components', 'API 578', 'Chemical composition verification', 'W');
      }

      // 4. Machining & Assembly
      addActivity('In-process Machining', 'Dimensional check & Visual Inspection of body, bonnet, and connector parts', `Manufacturing Drawing / ${defaults.designStd}`, 'Dimensions, wall thickness, and face-to-face as per B16.10', 'W');
      
      if (isCheckValve) {
        addActivity('Assembly', 'Assembly check, disc movement, and alignment check', 'QCP Manual', 'Correct assembly, disc alignment, and smooth self-operating movement', 'W');
      } else {
        addActivity('Assembly', 'Assembly check, seating torque, and alignment check', 'QCP Manual', 'Correct assembly, component alignment, and smooth operation', 'W');
      }

      // 5. Electrical test
      if (!isCheckValve && !isGlobeValve) {
        addActivity('Testing', 'Antistatic Electrical Resistance Test', 'API 6D', 'Resistance < 10 Ohms at 12V DC between stem, ball, and body', 'W');
      }

      // 6. Hydrostatic/Pneumatic Tests
      const p = getTestPressures(classVal);
      const d = getTestDurations(sizeVal);
      
      addActivity('Final Testing', `Hydrostatic Shell & Seat Testing`, defaults.testingStd, `Shell: ${p.shell} PSI for ${d.shell}, Seat: ${p.seat} PSI for ${d.seat}`, 'H');
      
      if (isGlobeValve) {
        addActivity('Final Testing', `Hydrostatic Backseat Testing`, defaults.testingStd, `Backseat: ${p.seat} PSI for ${d.seat}`, 'H');
      }

      if (!isCheckValve) {
        addActivity('Final Testing', `Low Pressure Pneumatic Air Seat Testing`, defaults.testingStd, `Air Seat: ${p.air} PSI for ${d.seat}`, 'H');
      }

      if (!isCheckValve && defaults.isTMBV) {
        addActivity('Final Testing', `Double Block & Bleed (DBB) Hydrostatic Test`, 'API 6D', `Seat: ${p.seat} PSI for ${d.seat}`, 'W');
      }
      if (hasFugitive) {
        addActivity('Special Testing', 'Fugitive Emission Helium Leakage Testing', 'ISO 15848-1', 'Leakage rate conforming to specified class (A, B, or C)', 'W');
      }
      if (hasCryo) {
        addActivity('Special Testing', 'Cryogenic Testing at Low Temperature', 'BS 6364', 'Seat leakage rate within BS 6364 limit', 'W');
      }
      if (hasDemo) {
        addActivity('Special Testing', 'Functional Performance Testing under Pipe Load', 'Customer Specification', 'Functional operability without damage', 'W');
      }

      // 7. Surface prep, Painting & Final dispatch
      addActivity('Painting', `Surface Preparation and Paint DFT Inspection`, 'Painting Specification', `DFT: Min ${defaults.paintingDft} shade as specified`, 'R');
      addActivity('Packing & Dispatch', 'Final Visual Verification, Nameplate checks, and Packing Inspection', 'Packing Procedure', 'Identification tagging, secure seaworthy/roadworthy packaging', 'R');
    });

    // Fallback if no piping or ball valve items were parsed
    if (!isPipingValve && activities.length === 0) {
      activities.push({
        activityNo: 1,
        stageOfManufacture: 'Final Testing',
        activityName: 'Hydrostatic Pressure Testing',
        referenceDocument: 'Standard Code',
        acceptanceCriteria: 'Conforming to code requirements',
        inspectionType: 'H',
        status: 'Planned'
      });
      docChecklists.push({ documentType: 'Hydrostatic Test Report', status: 'Awaited' });
    }

    const year = new Date().getFullYear();
    const month = String(new Date().getMonth() + 1).padStart(2, '0');
    const prefix = `QAP-${year}-${month}-`;
    const seq = await getNextSequenceValue(prefix);
    
    const qapData = {
      qapId: `${prefix}${String(seq).padStart(4, '0')}`,
      quotation: quotation._id,
      customer: quotation.customer,
      preparedBy: req.user._id,
      activities,
      documents: docChecklists
    };

    const qap = await Qap.create(qapData);
    
    await notifyRoles({ 
      roles: ['QC_ENGINEER'], 
      type: 'QAP_APPROVAL', 
      title: 'New QAP Generated', 
      message: `QAP ${qap.qapId} generated and awaits your initial review.`, 
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
      updateData.dynamicFields = { ...originalQap.dynamicFields, ...dynamicFields };
    }

    // 3. Assignment check
    if (assignedTo !== undefined && assignedTo?.toString() !== originalQap.assignedTo?.toString()) {
      if (!hasPermission(req.user, 'QAP', 'finalSignOff') && !hasPermission(req.user, 'QAP', 'editActivities')) {
        return res.status(403).json({ status: 'error', message: 'Not authorized to assign QAPs' });
      }
      updateData.assignedTo = assignedTo || null;
    }

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
