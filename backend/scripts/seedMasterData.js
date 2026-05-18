const mongoose = require('mongoose');
require('dotenv').config(); // Load .env from backend directory
const MasterData = require('../src/models/MasterData');

const masterDataToSeed = [
  {
    name: 'VALVE TYPE',
    assignedTo: ['Product', 'Enquiry', 'Quotation', 'QAP'],
    items: [
      { value: 'BV', label: 'Ball Valve', isActive: true },
      { value: 'GD', label: 'Globe Valve', isActive: true },
      { value: 'GV', label: 'Gate Valve', isActive: true },
      { value: 'GC', label: 'Conduit Gate Valve', isActive: true },
      { value: 'SC', label: 'Check Valves', isActive: true },
      { value: 'TW_SQ', label: '3Way SQ', isActive: true },
      { value: 'TW_D', label: '3Way D', isActive: true },
      { value: 'TW_4', label: '4Way Valve', isActive: true },
      { value: 'FB', label: 'Flush Bottom', isActive: true },
      { value: 'BF', label: 'Butterfly', isActive: true },
      { value: 'KG', label: 'Knife Gate', isActive: true },
      { value: 'TB', label: '2Way Bottom LL Port', isActive: true },
      { value: 'FV', label: 'Lug Valve', isActive: true },
      { value: '61_O', label: 'O&AY Type', isActive: true },
      { value: '61_S', label: 'Swing Type', isActive: true },
      { value: '62', label: 'Lift Type', isActive: true },
      { value: '71', label: 'Center Disc', isActive: true },
    ]
  },
  {
    name: 'DESIGN TYPE',
    assignedTo: ['Product', 'Enquiry', 'Quotation', 'QAP'],
    items: [
      { value: '01', label: '1 P/C Long', isActive: true },
      { value: '02', label: '2P/C Long', isActive: true },
      { value: '03', label: '3P/C', isActive: true },
      { value: '04', label: '3P/C Welded', isActive: true },
      { value: '05', label: '3P/C Weldolet', isActive: true },
      { value: '11', label: '1P/C Short', isActive: true },
      { value: '12', label: '2P/C Short', isActive: true },
      { value: '13', label: '3P/C Short', isActive: true },
      { value: '31_L', label: '2Way L', isActive: true },
      { value: '32_T', label: '2Way T', isActive: true },
      { value: '31_BL', label: '3Way BL', isActive: true },
      { value: '32_BT', label: '3Way BT', isActive: true },
      { value: '41', label: '4Way LL', isActive: true },
      { value: '61_O', label: 'O&AY Type', isActive: true },
      { value: '61_S', label: 'Swing Type', isActive: true },
      { value: '62', label: 'Lift Type', isActive: true },
      { value: '71', label: 'Center Disc', isActive: true },
    ]
  },
  {
    name: 'BORE',
    assignedTo: ['Product', 'Enquiry', 'Quotation', 'QAP'],
    items: [
      { value: 'F', label: 'Full Bore', isActive: true },
      { value: 'R', label: 'Reduced Bore', isActive: true },
      { value: 'X', label: 'Not Applicable', isActive: true },
    ]
  },
  {
    name: 'END CONNECTION',
    assignedTo: ['Product', 'Enquiry', 'Quotation', 'QAP'],
    items: [
      { value: 'FL', label: 'Flange End', isActive: true },
      { value: 'DW', label: 'Butt Weld', isActive: true },
      { value: 'SP_PUP', label: 'SW With PUP', isActive: true },
      { value: 'UP', label: 'DW With PUP', isActive: true },
      { value: 'FF', label: 'FLX BW', isActive: true },
      { value: 'FP', label: 'FLXRW With PUP', isActive: true },
      { value: 'SW', label: 'Socket Weld', isActive: true },
      { value: 'SA', label: 'SW With Nipple', isActive: true },
      { value: 'SP', label: 'SW With PUP/FXSW', isActive: true },
      { value: 'ST', label: 'SWATH NPT(F)', isActive: true },
      { value: 'SM', label: 'SWATH NPT(M)', isActive: true },
      { value: 'TN', label: 'T-Threaded NPT(F)', isActive: true },
      { value: 'TM', label: 'T-Threaded NPT(M)', isActive: true },
      { value: 'TC', label: 'T-Threaded DSP(F)', isActive: true },
      { value: 'TP', label: 'T-Threaded BSP(F)', isActive: true },
      { value: 'TS', label: 'T-NPT-FXSW With Nipple', isActive: true },
      { value: 'TQ', label: 'T-NPT/NPTXSW With Nipple', isActive: true },
      { value: 'WT', label: 'Water Type', isActive: true },
    ]
  },
  {
    name: 'CLASS',
    assignedTo: ['Product', 'Enquiry', 'Quotation', 'QAP'],
    items: [
      { value: '01', label: '150', isActive: true },
      { value: '02', label: '300', isActive: true },
      { value: '03', label: '400', isActive: true },
      { value: '04', label: '600', isActive: true },
      { value: '05', label: '800', isActive: true },
      { value: '06', label: '900', isActive: true },
      { value: '07', label: '1500', isActive: true },
      { value: '08', label: '2500', isActive: true },
    ]
  },
  {
    name: 'OPERATING',
    assignedTo: ['Product', 'Enquiry', 'Quotation', 'QAP'],
    items: [
      { value: 'H', label: 'Handle / Handwheel', isActive: true },
      { value: 'G', label: 'Gear Box', isActive: true },
      { value: 'P', label: 'PNU ACT', isActive: true },
      { value: 'M', label: 'MOV ACT', isActive: true },
      { value: 'Q', label: 'Goova', isActive: true },
      { value: 'Q_GAS', label: 'Gas Power', isActive: true },
      { value: 'E', label: 'ELE ACT', isActive: true },
      { value: 'R', label: 'EHOV', isActive: true },
      { value: 'S', label: 'HOV', isActive: true },
      { value: 'A', label: 'EXT Handle', isActive: true },
      { value: 'B', label: 'EXT Gear', isActive: true },
      { value: 'C', label: 'EXT PNE', isActive: true },
      { value: 'D', label: 'EXT Goova', isActive: true },
      { value: 'F', label: 'EXT Gas / Power ACT', isActive: true },
      { value: '#', label: 'EXT ELE ACT', isActive: true },
      { value: 'J', label: 'EXT EHOV', isActive: true },
      { value: 'K', label: 'EXT HOV', isActive: true },
    ]
  },
  {
    name: 'BALL TYPE',
    assignedTo: ['Product', 'Enquiry', 'Quotation', 'QAP'],
    items: [
      { value: 'FH', label: 'Floating Hollow', isActive: true },
      { value: 'FS_FLOT', label: 'FLOT Solid', isActive: true },
      { value: 'FI', label: 'TRU Hollow', isActive: true },
      { value: 'FS_TRU', label: 'TRU Solid', isActive: true },
      { value: 'FX', label: 'Floating', isActive: true },
      { value: 'TX', label: 'Trunnion', isActive: true },
      { value: 'GB', label: 'Globe', isActive: true },
      { value: 'FL', label: 'FLAX Solid', isActive: true },
      { value: 'KW', label: 'Knife Wage', isActive: true },
    ]
  },
  {
    name: 'SIZE',
    assignedTo: ['Product', 'Enquiry', 'Quotation', 'QAP'],
    items: [
      { value: '006', label: '1/4"', isActive: true },
      { value: '010', label: '3/8"', isActive: true },
      { value: '012', label: '1/2"', isActive: true },
      { value: '019', label: '3/4"', isActive: true },
      { value: '025', label: '1"', isActive: true },
      { value: '032', label: '1-1/4"', isActive: true },
      { value: '038', label: '1-1/2"', isActive: true },
      { value: '050', label: '2"', isActive: true },
      { value: '065', label: '2-1/2"', isActive: true },
      { value: '075', label: '3"', isActive: true },
      { value: '100', label: '4"', isActive: true },
      { value: '125', label: '5"', isActive: true },
      { value: '150', label: '6"', isActive: true },
      { value: '200', label: '8"', isActive: true },
      { value: '250', label: '10"', isActive: true },
      { value: '300', label: '12"', isActive: true },
      { value: '350', label: '14"', isActive: true },
      { value: '400', label: '16"', isActive: true },
      { value: '450', label: '18"', isActive: true },
      { value: '500', label: '20"', isActive: true },
      { value: '600', label: '24"', isActive: true },
      { value: '650', label: '26"', isActive: true },
      { value: '700', label: '28"', isActive: true },
      { value: '750', label: '30"', isActive: true },
      { value: '800', label: '32"', isActive: true },
      { value: '900', label: '36"', isActive: true },
      { value: '1000', label: '42"', isActive: true },
    ]
  },
  {
    name: 'OPERATION',
    assignedTo: ['Product', 'Enquiry', 'Quotation', 'QAP'],
    items: [
      { value: 'A', label: 'Assembly', isActive: true },
      { value: 'M', label: 'Machining', isActive: true },
      { value: 'C', label: 'Casting', isActive: true },
      { value: 'P', label: 'Pattern', isActive: true },
      { value: 'D', label: 'Die', isActive: true },
      { value: 'S', label: 'Spar', isActive: true },
      { value: 'F', label: 'Forge', isActive: true },
      { value: 'R', label: 'Pre Machining', isActive: true },
    ]
  },
  {
    name: 'PARTS / BOM',
    assignedTo: ['Product', 'Enquiry', 'Quotation', 'QAP'],
    items: [
      { value: '001', label: 'Body', isActive: true },
      { value: '002', label: 'Side P/C', isActive: true },
      { value: '003', label: 'Waste', isActive: true },
      { value: '004', label: 'Bonnet / Cover', isActive: true },
      { value: '005', label: 'Trunion / Yoke', isActive: true },
      { value: '006', label: 'Seat Ring', isActive: true },
      { value: '007', label: 'Stem', isActive: true },
      { value: '008', label: 'Body Gasket', isActive: true },
      { value: '009', label: 'Gland Packing', isActive: true },
      { value: '010', label: 'Stem Ring', isActive: true },
      { value: '011', label: 'Gland Bush', isActive: true },
      { value: '012', label: 'Gland Nut / Disc', isActive: true },
      { value: '013', label: 'Seat Holder', isActive: true },
      { value: '014', label: 'Seal / Clamping Ring', isActive: true },
      { value: '015', label: 'Spring Holder', isActive: true },
      { value: '016', label: 'Compression Spring', isActive: true },
      { value: '017', label: 'Antistatic Spring', isActive: true },
      { value: '018', label: 'Handle', isActive: true },
      { value: '019', label: 'Handle Nut', isActive: true },
      { value: '020', label: 'Lock Plate', isActive: true },
      { value: '021', label: 'Stop / Hinge Pin', isActive: true },
      { value: '022', label: 'Body Stud', isActive: true },
      { value: '023', label: 'Body Nut', isActive: true },
      { value: '024', label: 'Hex Bolt', isActive: true },
      { value: '025', label: 'Seat O-Ring', isActive: true },
      { value: '026', label: 'Stem O-Ring', isActive: true },
      { value: '027', label: 'Gasket / Trunnion O-Ring', isActive: true },
      { value: '028', label: 'Sleeve', isActive: true },
      { value: '029', label: 'Washer', isActive: true },
      { value: '030', label: 'Lock Device', isActive: true },
      { value: '031', label: 'Gland Follower', isActive: true },
      { value: '032', label: 'Chain Conn Valve', isActive: true },
      { value: '033', label: 'Vent Conn', isActive: true },
      { value: '034', label: 'Stem Seal', isActive: true },
      { value: '035', label: 'Ext Seat Seal / Sealant Pipe', isActive: true },
      { value: '036', label: 'Bracket', isActive: true },
      { value: '037', label: 'Lifting Lugs', isActive: true },
      { value: '038', label: 'Valve Support Foot', isActive: true },
      { value: '039', label: 'Hinge Lever', isActive: true },
      { value: '040', label: 'Bonnet', isActive: true },
      { value: '041', label: 'Back Seat Bush', isActive: true },
      { value: '042', label: 'Yoke Bush', isActive: true },
      { value: '043', label: 'Connecting', isActive: true },
      { value: '044', label: 'Plug', isActive: true },
      { value: '045', label: 'Name Plate', isActive: true },
      { value: '046', label: 'Rivet', isActive: true },
      { value: '051', label: 'Middle Valve', isActive: true },
      { value: '052', label: 'Int NRV', isActive: true },
      { value: '053', label: 'NRV Switch', isActive: true },
      { value: '054', label: 'Bonnet Stud', isActive: true },
      { value: '100', label: 'Other Assembly', isActive: true },
    ]
  },
  {
    name: 'MOC (Material of Construction)',
    assignedTo: ['Product', 'Enquiry', 'Quotation', 'QAP'],
    items: [
      { value: '01', label: 'ASTM A216 Gr WCB', isActive: true },
      { value: '02', label: 'ASTM A216 Gr WCC', isActive: true },
      { value: '03', label: 'ASTM A 352 Gr LCC', isActive: true },
      { value: '04', label: 'ASTM A 352 Gr LCB', isActive: true },
      { value: '05', label: 'ASTM A 352 Gr CF8', isActive: true },
      { value: '06', label: 'ASTM A182', isActive: true },
      { value: '07', label: 'ASTM A182 Gr F304', isActive: true },
      { value: '08', label: 'ASTM A182 Gr F6A', isActive: true },
      { value: '09', label: 'ASTM A351 Gr CF8', isActive: true },
      { value: '010', label: 'ASTM A 351 Gr CF3', isActive: true },
      { value: '011', label: 'ASTM A182', isActive: true },
      { value: '012', label: 'ASTM A182', isActive: true },
      { value: '013', label: 'ASTM A 479', isActive: true },
      { value: '014', label: 'ASTM A 479', isActive: true },
      { value: '015', label: 'ASTM A 479', isActive: true },
      { value: '016', label: 'ASTM A 479', isActive: true },
      { value: '017', label: 'ASTM A182 Gr F304', isActive: true },
      { value: '018', label: 'ASTM A182', isActive: true },
      { value: '019', label: 'ASTM A182', isActive: true },
      { value: '021', label: 'ASTM A479', isActive: true },
      { value: '025', label: 'SS410', isActive: true },
      { value: '026', label: 'SS440', isActive: true },
      { value: '027', label: 'CI', isActive: true },
      { value: '028', label: 'SG Iron', isActive: true },
      { value: '029', label: 'PTFE', isActive: true },
      { value: '030', label: 'RPTFE', isActive: true },
      { value: '031', label: 'CFT', isActive: true },
      { value: '033', label: 'VTON', isActive: true },
      { value: '034', label: 'VILON-S', isActive: true },
      { value: '035', label: 'NCS', isActive: true },
      { value: '036', label: 'PEEK', isActive: true },
      { value: '037', label: 'GRAFOIL', isActive: true },
      { value: '038', label: 'SS304+SPW', isActive: true },
      { value: '039', label: 'SS316+SPW GRAFOIL', isActive: true },
      { value: '040', label: 'SS304+STR', isActive: true },
      { value: '041', label: 'SS316+STR', isActive: true },
      { value: '042', label: 'SS410+STR', isActive: true },
      { value: '043', label: 'ASTM A216', isActive: true },
      { value: '044', label: 'ASTM A216', isActive: true },
      { value: '045', label: 'ASTM A216', isActive: true },
      { value: '046', label: 'ASTM A216', isActive: true },
    ]
  }
];

const seedMasterData = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB.');

    for (const data of masterDataToSeed) {
      // Calculate missing sortOrders
      data.items = data.items.map((item, idx) => ({ ...item, sortOrder: idx }));

      const existing = await MasterData.findOne({ name: data.name });
      if (existing) {
        console.log(`[SKIPPED] ${data.name} already exists.`);
      } else {
        await MasterData.create(data);
        console.log(`[CREATED] ${data.name} seeded with ${data.items.length} items.`);
      }
    }

    console.log('Master data seeding complete!');
    process.exit(0);
  } catch (err) {
    console.error('Error seeding master data:', err);
    process.exit(1);
  }
};

seedMasterData();
