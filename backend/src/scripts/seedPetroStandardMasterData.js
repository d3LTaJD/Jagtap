/**
 * Seed Petro Standard Master Data for Ball Valves, Globe Valves, and Check Valves.
 * Preserves all existing common master data and creates dedicated, valve-specific master data categories.
 */
require('dotenv').config();
const mongoose = require('mongoose');
const MasterData = require('../models/MasterData');

const valveMasterDataSets = [
  // ═══════════════════════════════════════════════════════════════════════════
  // 🔵 BALL VALVE SPECIFIC MASTER DATA (Petro Std_Ball valve.docx)
  // ═══════════════════════════════════════════════════════════════════════════
  {
    name: 'BALL VALVE - DESIGN & TESTING STANDARDS',
    slug: 'ball-valve-standards',
    description: 'Design, testing, and certification standards per Petro Std_Ball valve.docx',
    icon: 'ShieldCheck',
    items: [
      { label: 'API 6D (Design & Manufacturing)', value: 'API 6D', description: 'Pipeline Valves Standard (Default)' },
      { label: 'API 608 (Design)', value: 'API 608', description: 'Metal Ball Valves - Flanged, Threaded and Welding Ends' },
      { label: 'BS 5351 (Design)', value: 'BS 5351', description: 'Steel Ball Valves for Petroleum Industry' },
      { label: 'ISO 14313 (Design)', value: 'ISO 14313', description: 'Petroleum and natural gas industries - Pipeline valves' },
      { label: 'API 6D Testing (Hydro Shell & Seat, Air Seat)', value: 'API 6D Testing', description: 'API 6D Hydro & Air testing specifications' },
      { label: 'API 598 (Valve Inspection and Testing)', value: 'API 598', description: 'Alternative testing standard' },
      { label: 'API 607 (Fire Test for Floating Ball Valves)', value: 'API 607', description: 'Fire test certification for soft-seated floating valves' },
      { label: 'API 6FA (Fire Test for Trunnion Mounted Ball Valves)', value: 'API 6FA', description: 'Fire test specification for pipeline valves' },
      { label: 'API 6D Monogram: NO (Default)', value: 'API 6D MONOGRAM: NO', description: 'Standard production without monogram' },
      { label: 'API 6D Monogram: YES (If Specified)', value: 'API 6D MONOGRAM: YES', description: 'Official API 6D monogram applied on nameplate' },
      { label: 'QSL-1 (Quality Specification Level 1 - Default)', value: 'QSL 1', description: 'Standard quality specification level' },
      { label: 'QSL-2 (Quality Specification Level 2)', value: 'QSL 2', description: 'Enhanced NDE and traceability' },
      { label: 'QSL-3 / QSL-3G (Quality Specification Level 3 / Gas)', value: 'QSL 3', description: 'High-integrity critical gas service testing' },
      { label: 'QSL-4 / QSL-4G (Quality Specification Level 4 / Gas)', value: 'QSL 4', description: 'Highest quality specification level with 100% volumetric inspection' }
    ]
  },
  {
    name: 'BALL VALVE - DESIGN & CONSTRUCTION TYPES',
    slug: 'ball-valve-design-types',
    description: 'Design types and construction body styles for Ball Valves',
    icon: 'Layers',
    items: [
      { label: 'Floating Ball Valve - 2 Piece Split Body (15mm - 600mm for 150#, 300#, 600#)', value: 'Floating Ball - 2 Piece', description: 'Split body floating ball valve' },
      { label: 'Floating Ball Valve - 3 Piece Bolted (All sizes for 800#, 900#, 1500#, 2500#)', value: 'Floating Ball - 3 Piece', description: '3-piece forged or cast body' },
      { label: 'Floating Ball Valve - 1 Piece Unibody (Reduced Bore)', value: 'Floating Ball - 1 Piece', description: 'Single piece body construction' },
      { label: 'Trunnion Mounted Ball Valve - 2 Piece Cast/Forged', value: 'Trunnion Mounted - 2 Piece', description: 'Trunnion mounted with fixed ball' },
      { label: 'Trunnion Mounted Ball Valve - 3 Piece (≥650mm for 150#-600#; all for 800#+)', value: 'Trunnion Mounted - 3 Piece', description: 'Heavy duty pipeline trunnion ball valve' },
      { label: 'Top Entry Ball Valve (In-line Maintenance)', value: 'Top Entry Ball Valve', description: 'Top entry single piece body for plant maintenance' },
      { label: 'Double Block and Bleed (DBB) Ball Valve', value: 'DBB Ball Valve', description: 'Twin ball or single ball double isolation with bleed' },
      { label: 'Full Bore (FB) - Default', value: 'Full Bore', description: 'Unrestricted full bore matching pipe ID' },
      { label: 'Reduced Bore (RB) - If Specified', value: 'Reduced Bore', description: 'Standard reduced port' }
    ]
  },
  {
    name: 'BALL VALVE - PARTS & BILL OF MATERIALS (BOM)',
    slug: 'ball-valve-parts-bom',
    description: 'Component parts and materials specific to Ball Valves per Petro Std',
    icon: 'Cpu',
    items: [
      { label: 'Body (ASTM A216 WCB / A352 LCC / A182 F316 / A105)', value: 'Body', description: 'Main pressure-containing valve shell' },
      { label: 'Closure / Side Piece / Body Adapter', value: 'Closure', description: 'Bolted side body piece' },
      { label: 'Ball (ASTM A182 F316 / A105+ENP / A216 WCB+ENP / F6a)', value: 'Ball', description: 'Spherical flow controlling element' },
      { label: 'Seat Ring (ASTM A182 F316 / A105+ENP / A216 WCB)', value: 'Seat Ring', description: 'Metal seat holder ring' },
      { label: 'Seat Insert - Soft (PTFE for 150# / RPTFE for 300#-2500# / Devlon / PEEK)', value: 'Seat Insert (Soft)', description: 'Primary sealing insert' },
      { label: 'Seat Insert - Metal to Metal (Stellite Gr. 6 / Tungsten Carbide Coated)', value: 'Seat Insert (Metal)', description: 'Hardfaced metal seat for high temp/abrasive service' },
      { label: 'Stem (ASTM A479 316 / A479 410 / 17-4PH / Inconel 718)', value: 'Stem', description: 'Blowout-proof operating stem' },
      { label: 'Trunnion Plate / Lower Trunnion Pin', value: 'Trunnion', description: 'Lower supporting pin for trunnion mounted valves' },
      { label: 'Gland Flange / Gland Bush', value: 'Gland Bush', description: 'Stem packing compression flange' },
      { label: 'Body Studs & Heavy Hex Nuts (ASTM A193 B7 / A194 2H / B7M/2HM / L7/7)', value: 'Body Studs & Nuts', description: 'High-strength pressure bolting' },
      { label: 'Seat Springs (Inconel X-750)', value: 'Seat Springs', description: 'Pre-load energizing springs for seat rings' },
      { label: 'Primary Body Gasket (Spiral Wound SS316 + Flexible Graphite)', value: 'Body Gasket', description: 'Fire-safe body joint sealing' },
      { label: 'Secondary O-Rings / Lip Seals (FKM / Viton AED / HNBR / PTFE Lip Seal)', value: 'O-Rings / Lip Seals', description: 'Elastomeric/polymeric fluid containment seals' },
      { label: 'Drain Connection (15mm for 50-200mm; 25mm for ≥200mm)', value: 'Drain Connection', description: 'Body cavity drain port with plug or needle valve' },
      { label: 'Vent Connection (25mm for ≥200mm; No for 50-150mm)', value: 'Vent Connection', description: 'Body cavity vent port' },
      { label: 'Emergency Sealant Injection Fitting (Stem & Seat)', value: 'Sealant Injection Fitting', description: 'High-pressure emergency sealant fitting with check valve' },
      { label: 'Antistatic Device (Spring-loaded Ball & Plunger)', value: 'Antistatic Device', description: 'Electrical continuity between ball, stem, and body' },
      { label: 'Lifting Lugs (For valves ≥ 25 kg)', value: 'Lifting Lugs', description: 'Welded or forged lifting attachment points' },
      { label: 'Support Foot (For valves ≥ 200 mm NB)', value: 'Support Foot', description: 'Integrated mounting feet for pipeline support' }
    ]
  },
  {
    name: 'BALL VALVE - OPERATING & ACTUATION',
    slug: 'ball-valve-operating',
    description: 'Operating mechanisms and actuation methods for Ball Valves',
    icon: 'Sliders',
    items: [
      { label: 'Hand Lever / Wrench (Size ≤ 100mm for 150#, ≤ 80mm for 300#, ≤ 50mm for 600#)', value: 'Lever Operated', description: 'Manual 90-degree lever handle' },
      { label: 'Worm Gearbox with Handwheel (Size ≥ 150mm for 150#, ≥ 100mm for 300#, ≥ 80mm for 600#)', value: 'Gear Operated', description: 'Manual enclosed quarter-turn worm gearbox' },
      { label: 'Pneumatic Actuator - Double Acting (DA)', value: 'Pneumatic Actuator (DA)', description: 'Air-driven rack and pinion / scotch yoke actuator' },
      { label: 'Pneumatic Actuator - Spring Return / Fail Safe (SR)', value: 'Pneumatic Actuator (SR)', description: 'Emergency shutdown (ESD) fail close or fail open' },
      { label: 'Electric Motorized Actuator (MOV) - On/Off or Modulating', value: 'Electric Actuator (MOV)', description: '415V / 230V / 24V DC quarter-turn electric actuator' },
      { label: 'Gas-Over-Oil Actuator (Pipeline Emergency)', value: 'Gas-Over-Oil Actuator', description: 'Pipeline gas-powered hydraulic actuator' },
      { label: 'Bare Shaft with ISO 5211 Direct Mounting Pad', value: 'Bare Shaft', description: 'Machined top flange ready for customer automation' }
    ]
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // 🟢 GLOBE VALVE SPECIFIC MASTER DATA (Petro Std_Globe Valve .docx)
  // ═══════════════════════════════════════════════════════════════════════════
  {
    name: 'GLOBE VALVE - DESIGN & TESTING STANDARDS',
    slug: 'globe-valve-standards',
    description: 'Design, testing, and painting standards per Petro Std_Globe Valve .docx',
    icon: 'ShieldCheck',
    items: [
      { label: 'BS 1873 (Cast Steel Globe Valves - Flanged and Butt-welding)', value: 'BS 1873', description: 'Standard construction for cast globe valves' },
      { label: 'API 602 (Compact Steel Globe Valves - Forged ≤ 50mm)', value: 'API 602', description: 'Forged steel globe valves for class 800/1500' },
      { label: 'ASME B16.34 (Valves - Flanged, Threaded, and Welding End)', value: 'ASME B16.34', description: 'Pressure-temperature ratings and wall thickness' },
      { label: 'API 598 (Valve Inspection and Testing - Default)', value: 'API 598', description: 'Hydro shell, hydro seat, and air seat test standard' },
      { label: 'BS 6755 Part 1 (Testing of Industrial Valves)', value: 'BS 6755-1', description: 'British testing standard for production valves' },
      { label: 'API 6D Monogram: NO (Strict Default)', value: 'API 6D MONOGRAM: NO', description: 'Globe valves do not carry API 6D monogram' },
      { label: 'Painting DFT: 120 Microns (Default)', value: 'Painting DFT: 120 Microns', description: 'Standard external primer and epoxy topcoat thickness' },
      { label: 'Backseat Test: Required (Seat test pressure per Class & Size)', value: 'Backseat Test: Required', description: 'Internal backseat stem sealing test' }
    ]
  },
  {
    name: 'GLOBE VALVE - DESIGN & CONSTRUCTION TYPES',
    slug: 'globe-valve-design-types',
    description: 'Globe valve bonnet designs, flow profiles, and plug styles',
    icon: 'Layers',
    items: [
      { label: 'Outside Screw and Yoke (OS&Y) - Bolted Bonnet (Standard)', value: 'OS&Y Bolted Bonnet', description: 'External stem threads isolated from process fluid' },
      { label: 'Pressure Seal Bonnet (High Pressure Class ≥ 900#)', value: 'Pressure Seal Bonnet', description: 'Self-energizing pressure seal bonnet for power/steam' },
      { label: 'Welded Bonnet (Compact Forged Class 800#)', value: 'Welded Bonnet', description: 'Hermetically welded bonnet for lethal/fugitive service' },
      { label: 'Straight Through (T-Pattern / Z-Body) - Standard', value: 'Straight Pattern', description: 'Standard horizontal in-line flow globe valve' },
      { label: 'Y-Pattern Globe Valve (Low Pressure Drop)', value: 'Y-Pattern', description: '45-degree inclined stem reducing turbulence and pressure drop' },
      { label: 'Angle Pattern Globe Valve (90-Degree Flow)', value: 'Angle Pattern', description: 'Right angle body serving as 90-degree pipe bend' },
      { label: 'Plug Type Disc (Throttling & Severe Service)', value: 'Plug Disc', description: 'Tapered solid plug disc for heavy throttling' },
      { label: 'Regulating / Parabolic Disc', value: 'Regulating Disc', description: 'Contoured disc for linear flow control' },
      { label: 'Flat / Composition Disc (Bubble Tight Low Pressure)', value: 'Flat Disc', description: 'Renewable disc insert for low pressure gas/water' },
      { label: 'Uni-Directional Flow (Standard Arrow on Body)', value: 'Uni-Directional', description: 'Flow direction into seat from below disc' }
    ]
  },
  {
    name: 'GLOBE VALVE - PARTS & BILL OF MATERIALS (BOM)',
    slug: 'globe-valve-parts-bom',
    description: 'Component parts and materials specific to Globe Valves per Petro Std',
    icon: 'Cpu',
    items: [
      { label: 'Body (ASTM A216 WCB / A352 LCC / A182 F316 / A105)', value: 'Body', description: 'Main globe valve body casting/forging' },
      { label: 'Bonnet (ASTM A216 WCB / A352 LCC / A182 F316 / A105)', value: 'Bonnet', description: 'Removable top pressure cover with stuffing box' },
      { label: 'Disc / Plug (ASTM A216 WCB+13% Cr / ASTM A182 F316 / Stellited)', value: 'Disc / Plug', description: 'Flow regulating closure member' },
      { label: 'Body Seat Ring (ASTM A182 F6a / ASTM A182 F316 / Stellite Gr. 6)', value: 'Body Seat Ring', description: 'Renewable or integral hardfaced body seat' },
      { label: 'Stem - Rising (ASTM A479 410 / ASTM A479 316 / 17-4PH)', value: 'Stem', description: 'Threaded rising stem with integral backseat shoulder' },
      { label: 'Yoke Bush / Stem Nut (Aluminium Bronze / Ductile Iron)', value: 'Yoke Bush', description: 'Internal threaded drive nut' },
      { label: 'Backseat Bushing (ASTM A276 410 / ASTM A276 316)', value: 'Backseat Bushing', description: 'Stem seal when valve is fully open' },
      { label: 'Gland Bush & Gland Flange', value: 'Gland Flange & Bush', description: 'Packing compression assembly' },
      { label: 'Bonnet Studs & Heavy Hex Nuts (ASTM A193 B7 / A194 2H)', value: 'Bonnet Studs & Nuts', description: 'High-tensile bonnet bolting' },
      { label: 'Bonnet Gasket (Spiral Wound SS316 + Flexible Graphite / RTJ)', value: 'Bonnet Gasket', description: 'Body-bonnet joint seal' },
      { label: 'Gland Packing (Die-Formed Flexible Graphite with Braided Carbon End Rings)', value: 'Gland Packing', description: 'High-temperature low-emission stem packing' },
      { label: 'Handwheel & Handwheel Nut (Ductile Iron / Carbon Steel)', value: 'Handwheel', description: 'Direct manual operating wheel' }
    ]
  },
  {
    name: 'GLOBE VALVE - OPERATING & ACTUATION',
    slug: 'globe-valve-operating',
    description: 'Operating mechanisms and actuation methods for Globe Valves',
    icon: 'Sliders',
    items: [
      { label: 'Direct Handwheel (Size ≤ 250mm for 150#, ≤ 200mm for 300#, ≤ 150mm for 600#)', value: 'Handwheel Operated', description: 'Manual direct handwheel drive' },
      { label: 'Bevel Gear Box with Handwheel (Size ≥ 300mm for 150#, ≥ 250mm for 300#, ≥ 200mm for 600#)', value: 'Bevel Gear Operated', description: 'Multi-turn enclosed bevel gearbox' },
      { label: 'Electric Multi-Turn Actuator (MOV) - On/Off & Regulating', value: 'Electric Multi-Turn Actuator (MOV)', description: 'Motorized intelligent actuator (Rotork / Auma type)' },
      { label: 'Pneumatic Linear Piston / Diaphragm Control Actuator', value: 'Pneumatic Linear Actuator', description: 'Pneumatic diaphragm/cylinder with electro-pneumatic positioner' }
    ]
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // 🟠 CHECK VALVE SPECIFIC MASTER DATA (Petro Std_Check Valve .docx)
  // ═══════════════════════════════════════════════════════════════════════════
  {
    name: 'CHECK VALVE - DESIGN & TESTING STANDARDS',
    slug: 'check-valve-standards',
    description: 'Design, testing, and size-specific rules per Petro Std_Check Valve .docx',
    icon: 'ShieldCheck',
    items: [
      { label: 'BS 1868 (Lift & Swing Check: 15mm - 40mm)', value: 'BS 1868', description: 'British standard for small bore check valves' },
      { label: 'API 6D 25th Ed (Swing Check: 50mm & Above)', value: 'API 6D (Check)', description: 'Pipeline check valves design standard' },
      { label: 'API 594 (Dual Plate & Wafer Check Valves)', value: 'API 594', description: 'Compact wafer, lug, and double-flanged check valves' },
      { label: 'API 598 Testing (For 15mm - 40mm Small Bore)', value: 'API 598 (Check)', description: 'Hydro shell and hydro seat test' },
      { label: 'API 6D Testing (For 50mm & Above Large Bore)', value: 'API 6D Testing (Check)', description: 'Pipeline hydro test pressure tables' },
      { label: 'Air Seat Test: NO (Liquid Hydro Test Only)', value: 'Air Seat Test: NO', description: 'Air seat test is not applicable for check valves per Petro Std' },
      { label: 'API 6D Monogram: NO (Default)', value: 'API 6D MONOGRAM: NO', description: 'Check valves standard production without monogram' },
      { label: 'Painting DFT: 120 Microns (Default)', value: 'Painting DFT: 120 Microns', description: 'Standard protective paint finish' }
    ]
  },
  {
    name: 'CHECK VALVE - DESIGN & CONSTRUCTION TYPES',
    slug: 'check-valve-design-types',
    description: 'Check valve design types partitioned by size per Petro Std',
    icon: 'Layers',
    items: [
      { label: 'Lift Check Valve - Piston / Ball (Size 15mm - 40mm)', value: 'Lift Check Valve', description: 'Small bore vertical or horizontal lift check per BS 1868' },
      { label: 'Swing Check Valve - Bolted Cover (Size 50mm & Above)', value: 'Swing Check Valve', description: 'Full opening swing disc check valve per API 6D' },
      { label: 'Tilting Disc Check Valve (Rapid Closure / Non-Slam)', value: 'Tilting Disc Check', description: 'Pivot-mounted disc reducing water hammer' },
      { label: 'Dual Plate Wafer Check Valve (Spring Assisted)', value: 'Dual Plate Check', description: 'Lightweight spring-loaded twin disc non-return valve' },
      { label: 'Nozzle / Axial Flow Check Valve', value: 'Axial Flow Check', description: 'Dynamic non-slam nozzle check for compressor discharge' },
      { label: 'Uni-Directional Flow (Mandatory Flow Arrow)', value: 'Uni-Directional', description: 'Arrow cast/engraved on valve body' }
    ]
  },
  {
    name: 'CHECK VALVE - PARTS & BILL OF MATERIALS (BOM)',
    slug: 'check-valve-parts-bom',
    description: 'Component parts and materials specific to Check Valves per Petro Std',
    icon: 'Cpu',
    items: [
      { label: 'Body (ASTM A216 WCB / A352 LCC / A182 F316 / A105)', value: 'Body', description: 'Main check valve body casting/forging' },
      { label: 'Cover / Cap (ASTM A216 WCB / A352 LCC / A182 F316 / A105)', value: 'Cover', description: 'Bolted top access cover' },
      { label: 'Disc / Clapper (ASTM A216 WCB+Stellited / ASTM A182 F316 / 13% Cr Steel)', value: 'Disc / Clapper', description: 'Pivoting or lifting closure disc' },
      { label: 'Body Seat Ring (ASTM A216 WCB+Stellited / ASTM A182 F316)', value: 'Body Seat Ring', description: 'Metal-to-metal hardfaced seat ring' },
      { label: 'Hinge / Hinge Arm (ASTM A216 WCB / Cast Stainless Steel)', value: 'Hinge Arm', description: 'Supporting swing arm for the disc' },
      { label: 'Hinge Pin / Pivot Shaft (ASTM A479 410 / ASTM A276 316)', value: 'Hinge Pin', description: 'Heavy-duty pivot pin for swing disc' },
      { label: 'Disc Washer & Disc Nut with Split Pin (SS316)', value: 'Disc Retainer Hardware', description: 'Disc attachment hardware with locking cotter pin' },
      { label: 'Cover Studs & Heavy Hex Nuts (ASTM A193 B7 / A194 2H)', value: 'Cover Studs & Nuts', description: 'High-tensile cover bolting' },
      { label: 'Cover Gasket (Spiral Wound SS316 + Flexible Graphite / RTJ)', value: 'Cover Gasket', description: 'Body-cover joint pressure seal' },
      { label: 'Internal Spring (Inconel X-750 for Lift / Dual Plate)', value: 'Return Spring', description: 'Closure assist spring for non-slam performance' },
      { label: 'Lifting Lugs (For valves ≥ 25 kg)', value: 'Lifting Lugs', description: 'Lifting attachment points per Petro Std' },
      { label: 'Support Foot (For valves ≥ 200 mm NB)', value: 'Support Foot', description: 'Pipeline support feet per Petro Std' }
    ]
  },
  {
    name: 'CHECK VALVE - OPERATING & SERVICE',
    slug: 'check-valve-operating',
    description: 'Service specifications and non-return mechanisms for Check Valves',
    icon: 'Sliders',
    items: [
      { label: 'Self-Actuated by Line Fluid / Flow (Standard - No External Operator)', value: 'Self-Actuated (Flow Operated)', description: 'Automatic opening by forward flow, closure by gravity/backpressure' },
      { label: 'Hydraulic Dashpot Damper (For Severe Pulsating Service)', value: 'Hydraulic Dashpot Damper', description: 'External oil/gas damper preventing disc chatter and slamming' },
      { label: 'External Counterweight & Position Lever (Visual Indicator)', value: 'Counterweight & Lever', description: 'External lever showing open/closed disc position' }
    ]
  }
];

async function seed() {
  console.log('Connecting to MongoDB Atlas...');
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Connected to MongoDB.\n');

  console.log('--- Seeding Petro Standard Master Data Categories ---');
  let inserted = 0;
  let updated = 0;

  for (const set of valveMasterDataSets) {
    const existing = await MasterData.findOne({ slug: set.slug });
    if (existing) {
      existing.name = set.name;
      existing.description = set.description;
      existing.icon = set.icon;
      existing.items = set.items;
      existing.isActive = true;
      await existing.save();
      console.log(`🔄 Updated MasterData: "${set.name}" (${set.slug}) -> ${set.items.length} items`);
      updated++;
    } else {
      await MasterData.create({
        name: set.name,
        slug: set.slug,
        description: set.description,
        icon: set.icon,
        items: set.items,
        isActive: true
      });
      console.log(`✅ Created MasterData: "${set.name}" (${set.slug}) -> ${set.items.length} items`);
      inserted++;
    }
  }

  console.log(`\n🎉 SEED COMPLETED: ${inserted} created, ${updated} updated.`);

  const allMasterData = await MasterData.find().select('name slug items.length isActive').sort({ name: 1 });
  console.log(`\nTotal MasterData categories in database: ${allMasterData.length}`);
  allMasterData.forEach((m, idx) => {
    console.log(`  ${idx + 1}. [${m.slug}] ${m.name} (${m.items?.length || 0} items)`);
  });

  await mongoose.disconnect();
  console.log('\nDisconnected from MongoDB.');
}

seed().catch(err => {
  console.error('Seed error:', err);
  process.exit(1);
});
