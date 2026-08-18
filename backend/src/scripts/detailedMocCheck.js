const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });
const mongoose = require('mongoose');
const MasterData = require('../models/MasterData');
const FieldDefinition = require('../models/FieldDefinition');

const userMocList = [
  { code: '001', name: 'ASTM A 216 Gr.WCB', category: 'BODY,S/P,BONNET,TRUNNION' },
  { code: '002', name: 'ASTM A 216 Gr.WCC', category: 'BODY,S/P,BONNET,TRUNNION' },
  { code: '003', name: 'ASTM A 352 Gr.LCB', category: 'BODY,S/P,BONNET,TRUNNION' },
  { code: '004', name: 'ASTM A 352 Gr.LCC', category: 'BODY,S/P,BONNET,TRUNNION' },
  { code: '005', name: 'ASTM A 351 Gr.CF8', category: 'BODY,S/P,BONNET,TRUNNION / BALL,WEDGE,DISC' },
  { code: '006', name: 'ASTM A 351 Gr.CF8M', category: 'BODY,S/P,BONNET,TRUNNION / BALL,WEDGE,DISC' },
  { code: '007', name: 'ASTM A 351 Gr.CF3', category: 'BODY,S/P,BONNET,TRUNNION / BALL,WEDGE,DISC' },
  { code: '008', name: 'ASTM A 351 Gr.CF3M', category: 'BODY,S/P,BONNET,TRUNNION / BALL,WEDGE,DISC' },
  { code: '009', name: 'ASTM A 351 Gr.CN7', category: 'BODY,S/P,BONNET,TRUNNION / BALL,WEDGE,DISC' },
  { code: '010', name: 'ASTM A 351 Gr.CN7M', category: 'BODY,S/P,BONNET,TRUNNION / BALL,WEDGE,DISC' },
  { code: '011', name: 'ASTM A 217 Gr.CA15', category: 'SEAT HOLDER' },
  { code: '012', name: 'ASTM A105', category: 'BODY,S/P,BONNET,TRUNNION / SEAT HOLDER' },
  { code: '013', name: 'ASTM A350 Gr.LF2', category: 'BODY,S/P,BONNET,TRUNNION / BALL,WEDGE,DISC' },
  { code: '014', name: 'ASTM A182 Gr.F6A CL.1', category: 'BODY / BALL / STEM / SEAT HOLDER' },
  { code: '015', name: 'ASTM A182 Gr.F6A CL.2', category: 'BODY / BALL / STEM / SEAT HOLDER' },
  { code: '016', name: 'ASTM A182 Gr.F304', category: 'BODY / BALL / STEM / SEAT HOLDER' },
  { code: '017', name: 'ASTM A182 Gr.F316', category: 'BODY / BALL / STEM / SEAT HOLDER' },
  { code: '018', name: 'ASTM A182 Gr.F304L', category: 'BODY / BALL / STEM / SEAT HOLDER' },
  { code: '019', name: 'ASTM A182 Gr.F316L', category: 'BODY / BALL / STEM / SEAT HOLDER' },
  { code: '020', name: 'ASTM A 479 Gr.SS304', category: 'BALL / STEM / SEAT HOLDER' },
  { code: '021', name: 'ASTM A 479 Gr.SS316', category: 'BALL / STEM / SEAT HOLDER' },
  { code: '022', name: 'ASTM A 479 Gr.SS304L', category: 'BALL / STEM / SEAT HOLDER' },
  { code: '023', name: 'ASTM A 479 Gr.SS316L', category: 'BALL / STEM / SEAT HOLDER' },
  { code: '024', name: 'ASTM A 479 Gr.SS410', category: 'BALL / STEM / SEAT HOLDER' },
  { code: '025', name: 'SS4140', category: 'BALL / STEM / SEAT HOLDER' },
  { code: '026', name: '13% Cr.STEEL', category: 'BALL / STEM / SEAT HOLDER' },
  { code: '027', name: 'CI', category: 'BODY,S/P,BONNET,TRUNNION' },
  { code: '028', name: 'SG IRON', category: 'BODY,S/P,BONNET,TRUNNION' },
  { code: '029', name: 'PTFE', category: 'SOFT SEAT' },
  { code: '030', name: 'RPTFE', category: 'SOFT SEAT' },
  { code: '031', name: 'CFT', category: 'SOFT SEAT' },
  { code: '032', name: 'NYLON 6', category: 'SOFT SEAT' },
  { code: '034', name: 'DEVLON-S', category: 'SOFT SEAT' },
  { code: '035', name: 'NCB', category: 'SOFT SEAT' },
  { code: '036', name: 'PEEK', category: 'SOFT SEAT' },
  { code: '040', name: 'SS304+STR', category: 'BALL / SEAT HOLDER' },
  { code: '041', name: 'SS316+STR', category: 'BALL / SEAT HOLDER' },
  { code: '042', name: 'SS410+STR', category: 'BALL / SEAT HOLDER' },
  { code: '043', name: 'ASTM A216 Gr.WCB+13% Cr.', category: 'BALL / SEAT HOLDER' },
  { code: '044', name: 'ASTM A105+13% Cr.', category: 'BALL / SEAT HOLDER' },
  { code: '045', name: 'ASTM A216 Gr.WCB+75µ ENP', category: 'BALL,WEDGE,DISC' },
  { code: '046', name: 'ASTM A216 Gr.WCC+75µ ENP', category: 'BALL,WEDGE,DISC' },
  { code: '047', name: 'ASTM A352 Gr.LCB+75µ ENP', category: 'BALL,WEDGE,DISC' },
  { code: '048', name: 'ASTM A352 Gr.LCC+75µ ENP', category: 'BALL,WEDGE,DISC' },
  { code: '049', name: 'ASTM A350 Gr.LF2+75µ ENP', category: 'BALL,WEDGE,DISC' },
  { code: '050', name: 'ASTM A182 GR.F6A CL1+75µ ENP', category: 'BALL,WEDGE,DISC' },
  { code: '051', name: 'ASTM A182 GR.F6A CL2+75µ ENP', category: 'BALL,WEDGE,DISC' },
  { code: '052', name: 'ASTM A217 GR.CA15+75µ ENP', category: 'SEAT HOLDER' },
  { code: '055', name: 'ASTM A 193 Gr.B7', category: 'STUD & NUT' },
  { code: '056', name: 'ASTM A 194 Gr.2H', category: 'STUD & NUT' },
  { code: '057', name: 'ASTM A 193 Gr.B7M', category: 'STUD & NUT' },
  { code: '058', name: 'ASTM A 194 Gr.2HM', category: 'STUD & NUT' },
  { code: '059', name: 'ASTM A 320 Gr.L7', category: 'STUD & NUT' },
  { code: '060', name: 'ASTM A 194 Gr.7', category: 'STUD & NUT' },
  { code: '061', name: 'ASTM A 320 Gr.L7M', category: 'STUD & NUT' },
  { code: '062', name: 'ASTM A 194 Gr.7M', category: 'STUD & NUT' },
  { code: '063', name: 'ASTM A 193 Gr.B7+HDG', category: 'STUD & NUT' },
  { code: '064', name: 'ASTM A 194 Gr.2H+HDG', category: 'STUD & NUT' },
  { code: '065', name: 'ASTM A 193 Gr.B7M+HDG', category: 'STUD & NUT' },
  { code: '066', name: 'ASTM A 194 Gr.2HM+HDG', category: 'STUD & NUT' },
  { code: '067', name: 'ASTM A 320 Gr.L7+HDG', category: 'STUD & NUT' },
  { code: '068', name: 'ASTM A 194 Gr.7+HDG', category: 'STUD & NUT' },
  { code: '069', name: 'ASTM A 320 Gr.L7M+HDG', category: 'STUD & NUT' },
  { code: '070', name: 'ASTM A 194 Gr.7M+HDG', category: 'STUD & NUT' },
  { code: '071', name: 'ASTM A 193 Gr.B7+XYLAN', category: 'STUD & NUT' },
  { code: '072', name: 'ASTM A 194 Gr.2H+XYLAN', category: 'STUD & NUT' },
  { code: '073', name: 'ASTM A 193 Gr.B7M+XYLAN', category: 'STUD & NUT' },
  { code: '074', name: 'ASTM A 194 Gr.2HM+XYLAN', category: 'STUD & NUT' },
  { code: '075', name: 'ASTM A 320 Gr.L7+XYLAN', category: 'STUD & NUT' },
  { code: '076', name: 'ASTM A 194 Gr.7+XYLAN', category: 'STUD & NUT' },
  { code: '077', name: 'ASTM A 320 Gr.L7M+XYLAN', category: 'STUD & NUT' },
  { code: '078', name: 'ASTM A 194 Gr.7M+XYLAN', category: 'STUD & NUT' },
  { code: '079', name: 'ASTM A 320 Gr B8', category: 'STUD & NUT' },
  { code: '080', name: 'ASTM A 194 Gr.8', category: 'STUD & NUT' },
  { code: '081', name: 'ASTM A 320 Gr8M', category: 'STUD & NUT' },
  { code: '082', name: 'ASTM A 194 Gr8M', category: 'STUD & NUT' },
  { code: '083', name: 'ASTM A 320 GrB8', category: 'STUD & NUT' },
  { code: '084', name: 'ASTM A 194 Gr.8', category: 'STUD & NUT' },
  { code: '085', name: 'ASTM A 320 Gr8M', category: 'STUD & NUT' },
  { code: '086', name: 'ASTM A 194 Gr8M', category: 'STUD & NUT' }
];

async function runDetailedCheck() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Connected to DB');

  const masterMoc = await MasterData.findOne({ slug: 'moc-material-of-construction' }).lean();
  const dbMocItems = masterMoc ? masterMoc.items || [] : [];

  // Also fetch all FieldDefinitions options for MOC fields
  const mocFields = await FieldDefinition.find({
    $or: [
      { fieldName: /moc/i },
      { fieldLabel: /moc/i },
      { fieldName: /material/i }
    ]
  }).lean();

  const allFieldOptions = new Set();
  mocFields.forEach(f => {
    (f.options || []).forEach(opt => {
      if (typeof opt === 'string') allFieldOptions.add(opt.trim().toUpperCase());
      else if (opt && (opt.label || opt.value)) allFieldOptions.add(String(opt.label || opt.value).trim().toUpperCase());
    });
  });

  const dbCodeMap = new Map();
  const dbLabelSet = new Set();

  dbMocItems.forEach(it => {
    dbCodeMap.set(String(it.value).padStart(3, '0'), it.label.trim());
    dbLabelSet.add(it.label.trim().toUpperCase());
  });

  console.log(`DB MasterData Items Count: ${dbMocItems.length}`);
  console.log(`DB FieldDefinition Unique Options Count: ${allFieldOptions.size}`);

  const presentList = [];
  const missingList = [];

  userMocList.forEach(item => {
    const codePadded = String(item.code).padStart(3, '0');
    const dbLabelByCode = dbCodeMap.get(codePadded);
    
    // Check match by code OR by label string normalization
    const nameNorm = item.name.trim().toUpperCase().replace(/\s+/g, ' ');
    const isPresentInMaster = dbLabelByCode || Array.from(dbLabelSet).some(l => l.replace(/\s+/g, ' ') === nameNorm);
    const isPresentInFieldOptions = Array.from(allFieldOptions).some(o => o.replace(/\s+/g, ' ') === nameNorm);

    if (isPresentInMaster || isPresentInFieldOptions) {
      presentList.push({ ...item, codePadded, dbLabel: dbLabelByCode || 'Matched by name' });
    } else {
      missingList.push({ ...item, codePadded });
    }
  });

  console.log('\n=========================================');
  console.log(`SUMMARY: ${presentList.length} PRESENT | ${missingList.length} MISSING (out of ${userMocList.length} items listed)`);
  console.log('=========================================\n');

  console.log('--- PRESENT ITEMS ---');
  presentList.forEach((it, idx) => {
    console.log(`${idx + 1}. [Code: ${it.codePadded}] "${it.name}" (Cat: ${it.category}) -> DB: "${it.dbLabel}"`);
  });

  console.log('\n--- MISSING ITEMS ---');
  if (missingList.length === 0) {
    console.log('NONE! All items are present in DB!');
  } else {
    missingList.forEach((it, idx) => {
      console.log(`${idx + 1}. [Code: ${it.codePadded}] "${it.name}" (Cat: ${it.category})`);
    });
  }

  // Also check what extra items exist in DB that were NOT in the user's list
  console.log('\n--- EXTRA ITEMS IN DB MASTER DATA NOT IN THIS SPECIFIC USER LIST ---');
  const userCodes = new Set(userMocList.map(u => String(u.code).padStart(3, '0')));
  const extraInDb = dbMocItems.filter(it => !userCodes.has(String(it.value).padStart(3, '0')));
  extraInDb.forEach(ex => console.log(`Code ${ex.value}: "${ex.label}"`));

  await mongoose.disconnect();
}

runDetailedCheck().catch(err => {
  console.error(err);
  process.exit(1);
});
