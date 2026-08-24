/**
 * EngineeringDictionary.js
 * High-precision Engineering Dictionary and Validation Whitelist Service.
 * Single Source of Truth for validation, alias resolution, and canonical normalization.
 * Rejects hallucinated or impossible engineering specifications (e.g. Class 3000 or Size 9000mm).
 */

const { VALIDATION_STATES, REVIEW_REASONS } = require('../../types/EngineeringField');

// 1. ALLOWED VALVE TYPES WHITELIST
const ALLOWED_VALVE_TYPES = Object.freeze([
  'Ball Valve',
  'Floating Ball Valve',
  'Trunnion Mounted Ball Valve',
  'Gate Valve',
  'Knife Gate Valve',
  'Wedge Gate Valve',
  'Globe Valve',
  'Needle Valve',
  'Check Valve',
  'Swing Check Valve',
  'Lift Check Valve',
  'Dual Plate Check Valve',
  'Non Return Valve',
  'Butterfly Valve',
  'Plug Valve',
  'Control Valve',
  'Safety Valve',
  'Pressure Relief Valve'
]);

const VALVE_TYPE_ALIASES = Object.freeze({
  'ball valve': 'Ball Valve',
  'ball': 'Ball Valve',
  'b.v': 'Ball Valve',
  'b.v.': 'Ball Valve',
  'bv': 'Ball Valve',
  'b valve': 'Ball Valve',
  'floating ball valve': 'Floating Ball Valve',
  'fbv': 'Floating Ball Valve',
  'floating ball': 'Floating Ball Valve',
  'trunnion mounted ball valve': 'Trunnion Mounted Ball Valve',
  'trunnion ball valve': 'Trunnion Mounted Ball Valve',
  'tmbv': 'Trunnion Mounted Ball Valve',
  'trunnion mounted': 'Trunnion Mounted Ball Valve',
  'gate valve': 'Gate Valve',
  'gate': 'Gate Valve',
  'g.v': 'Gate Valve',
  'g.v.': 'Gate Valve',
  'gv': 'Gate Valve',
  'g valve': 'Gate Valve',
  'knife gate valve': 'Knife Gate Valve',
  'knife gate': 'Knife Gate Valve',
  'wedge gate valve': 'Wedge Gate Valve',
  'wedge gate': 'Wedge Gate Valve',
  'globe valve': 'Globe Valve',
  'globe': 'Globe Valve',
  'gl.v': 'Globe Valve',
  'check valve': 'Check Valve',
  'check': 'Check Valve',
  'chk': 'Check Valve',
  'non return valve': 'Check Valve',
  'nrv': 'Check Valve',
  'c.v': 'Check Valve',
  'swing check valve': 'Swing Check Valve',
  'swing check': 'Swing Check Valve',
  'lift check valve': 'Lift Check Valve',
  'lift check': 'Lift Check Valve',
  'dual plate check valve': 'Dual Plate Check Valve',
  'dual plate check': 'Dual Plate Check Valve',
  'butterfly valve': 'Butterfly Valve',
  'butterfly': 'Butterfly Valve',
  'bfv': 'Butterfly Valve',
  'plug valve': 'Plug Valve',
  'plug': 'Plug Valve',
  'control valve': 'Control Valve',
  'control': 'Control Valve',
  'needle valve': 'Needle Valve',
  'needle': 'Needle Valve',
  'safety valve': 'Safety Valve',
  'srv': 'Safety Valve',
  'prv': 'Pressure Relief Valve'
});

// 2. ALLOWED PRESSURE CLASSES WHITELIST (ASME B16.34)
const ALLOWED_PRESSURE_CLASSES = Object.freeze([
  '150#',
  '300#',
  '600#',
  '800#',
  '900#',
  '1500#',
  '2500#'
]);

const CLASS_ALIASES = Object.freeze({
  '150': '150#', '150#': '150#', 'cl150': '150#', 'class 150': '150#', '150 class': '150#', '150lbs': '150#', '150 lbs': '150#', 'cl-150': '150#', 'class: 150': '150#', 'class:150': '150#', 'pressure class: 150#': '150#', 'pressure class: 150': '150#',
  '300': '300#', '300#': '300#', 'cl300': '300#', 'class 300': '300#', '300 class': '300#', '300lbs': '300#', '300 lbs': '300#', 'cl-300': '300#', 'class: 300': '300#', 'class:300': '300#', 'pressure class: 300#': '300#', 'pressure class: 300': '300#',
  '600': '600#', '600#': '600#', 'cl600': '600#', 'class 600': '600#', '600 class': '600#', '600lbs': '600#', '600 lbs': '600#', 'cl-600': '600#', 'class: 600': '600#', 'class:600': '600#', 'pressure class: 600#': '600#', 'pressure class: 600': '600#',
  '800': '800#', '800#': '800#', 'cl800': '800#', 'class 800': '800#', '800 class': '800#', '800lbs': '800#', '800 lbs': '800#', 'cl-800': '800#', 'class: 800': '800#', 'class:800': '800#', 'pressure class: 800#': '800#', 'pressure class: 800': '800#',
  '900': '900#', '900#': '900#', 'cl900': '900#', 'class 900': '900#', '900 class': '900#', '900lbs': '900#', '900 lbs': '900#', 'cl-900': '900#', 'class: 900': '900#', 'class:900': '900#', 'pressure class: 900#': '900#', 'pressure class: 900': '900#',
  '1500': '1500#', '1500#': '1500#', 'cl1500': '1500#', 'class 1500': '1500#', '1500 class': '1500#', '1500lbs': '1500#', '1500 lbs': '1500#', 'cl-1500': '1500#', 'class: 1500': '1500#', 'class:1500': '1500#', 'pressure class: 1500#': '1500#', 'pressure class: 1500': '1500#',
  '2500': '2500#', '2500#': '2500#', 'cl2500': '2500#', 'class 2500': '2500#', '2500 class': '2500#', '2500lbs': '2500#', '2500 lbs': '2500#', 'cl-2500': '2500#', 'class: 2500': '2500#', 'class:2500': '2500#', 'pressure class: 2500#': '2500#', 'pressure class: 2500': '2500#'
});

// 3. ALLOWED CATALOG SIZES (ASME B16.10 / ISO 5752)
const ALLOWED_SIZES_MM = Object.freeze([
  15, 20, 25, 32, 40, 50, 65, 80, 100, 125, 150, 200,
  250, 300, 350, 400, 450, 500, 600, 700, 750, 900,
  1000, 1050, 1200, 1350, 1500, 1800, 2000
]);

// Nominal Size Mappings (ASME B16.10 / ISO 5752)
const NPS_TO_DN_MAP = Object.freeze({
  '1/2': 15, '1/2"': 15, '0.5': 15,
  '3/4': 20, '3/4"': 20, '0.75': 20,
  '1': 25, '1"': 25,
  '1-1/4': 32, '1 1/4': 32, '1.25': 32, '1-1/4"': 32, '1 1/4"': 32,
  '1-1/2': 40, '1 1/2': 40, '1.5': 40, '1-1/2"': 40, '1 1/2"': 40,
  '2': 50, '2"': 50,
  '2-1/2': 65, '2 1/2': 65, '2.5': 65, '2-1/2"': 65, '2 1/2"': 65,
  '3': 80, '3"': 80,
  '4': 100, '4"': 100,
  '5': 125, '5"': 125,
  '6': 150, '6"': 150,
  '8': 200, '8"': 200,
  '10': 250, '10"': 250,
  '12': 300, '12"': 300,
  '14': 350, '14"': 350,
  '16': 400, '16"': 400,
  '18': 450, '18"': 450,
  '20': 500, '20"': 500,
  '24': 600, '24"': 600,
  '28': 700, '28"': 700,
  '30': 750, '30"': 750,
  '36': 900, '36"': 900,
  '40': 1000, '40"': 1000,
  '42': 1050, '42"': 1050,
  '48': 1200, '48"': 1200,
  '54': 1350, '54"': 1350,
  '60': 1500, '60"': 1500,
  '72': 1800, '72"': 1800,
  '80': 2000, '80"': 2000
});

const DN_TO_NPS_MAP = Object.freeze({
  15: '1/2', 20: '3/4', 25: '1', 32: '1-1/4', 40: '1-1/2',
  50: '2', 65: '2-1/2', 80: '3', 100: '4', 125: '5',
  150: '6', 200: '8', 250: '10', 300: '12', 350: '14',
  400: '16', 450: '18', 500: '20', 600: '24', 700: '28',
  750: '30', 900: '36', 1000: '40', 1050: '42', 1200: '48',
  1350: '54', 1500: '60', 1800: '72', 2000: '80'
});

const INCH_TO_MM_MAP = Object.freeze({
  '1/8': '6 mm', '1/8"': '6 mm', '6': '6 mm', 'dn6': '6 mm', '6 nb': '6 mm', '6nb': '6 mm',
  '1/4': '8 mm', '1/4"': '8 mm', '8': '8 mm', 'dn8': '8 mm', '8 nb': '8 mm', '8nb': '8 mm',
  '3/8': '10 mm', '3/8"': '10 mm', '10': '10 mm', 'dn10': '10 mm', '10 nb': '10 mm', '10nb': '10 mm',
  '1/2': '15 mm', '1/2"': '15 mm', '15': '15 mm', 'dn15': '15 mm', '15mm': '15 mm', '0.5': '15 mm', '0.5"': '15 mm', '15 nb': '15 mm', '15nb': '15 mm',
  '3/4': '20 mm', '3/4"': '20 mm', '20': '20 mm', 'dn20': '20 mm', '20mm': '20 mm', '0.75': '20 mm', '0.75"': '20 mm', '20 nb': '20 mm', '20nb': '20 mm',
  '1': '25 mm', '1"': '25 mm', '25': '25 mm', 'dn25': '25 mm', '25mm': '25 mm', '25 nb': '25 mm', '25nb': '25 mm',
  '1-1/4': '32 mm', '1 1/4': '32 mm', '1.25': '32 mm', '1 1/4"': '32 mm', '1-1/4"': '32 mm', '32': '32 mm', 'dn32': '32 mm', '32 nb': '32 mm', '32nb': '32 mm',
  '1-1/2': '40 mm', '1 1/2': '40 mm', '1.5': '40 mm', '1 1/2"': '40 mm', '1-1/2"': '40 mm', '40': '40 mm', 'dn40': '40 mm', '40 nb': '40 mm', '40nb': '40 mm',
  '2': '50 mm', '2"': '50 mm', '2in': '50 mm', '2inch': '50 mm', '2 inch': '50 mm', '50': '50 mm', 'dn50': '50 mm', '50mm': '50 mm', '50 nb': '50 mm', '50nb': '50 mm',
  '2-1/2': '65 mm', '2 1/2': '65 mm', '2.5': '65 mm', '2 1/2"': '65 mm', '2-1/2"': '65 mm', '65': '65 mm', 'dn65': '65 mm', '65 nb': '65 mm', '65nb': '65 mm',
  '3': '80 mm', '3"': '80 mm', '3in': '80 mm', '3inch': '80 mm', '80': '80 mm', 'dn80': '80 mm', '80mm': '80 mm', '80 nb': '80 mm', '80nb': '80 mm',
  '4': '100 mm', '4"': '100 mm', '4in': '100 mm', '4inch': '100 mm', '100': '100 mm', 'dn100': '100 mm', '100mm': '100 mm', '100 nb': '100 mm', '100nb': '100 mm',
  '5': '125 mm', '5"': '125 mm', '125': '125 mm', 'dn125': '125 mm', '125 nb': '125 mm', '125nb': '125 mm',
  '6': '150 mm', '6"': '150 mm', '6in': '150 mm', '6inch': '150 mm', '150': '150 mm', 'dn150': '150 mm', '150mm': '150 mm', '150 nb': '150 mm', '150nb': '150 mm',
  '8': '200 mm', '8"': '200 mm', '8in': '200 mm', '8inch': '200 mm', '200': '200 mm', 'dn200': '200 mm', '200mm': '200 mm', '200 nb': '200 mm', '200nb': '200 mm',
  '10': '250 mm', '10"': '250 mm', '250': '250 mm', 'dn250': '250 mm', '250 nb': '250 mm', '250nb': '250 mm',
  '12': '300 mm', '12"': '300 mm', '300': '300 mm', 'dn300': '300 mm', '300 nb': '300 mm', '300nb': '300 mm',
  '14': '350 mm', '14"': '350 mm', '350': '350 mm', 'dn350': '350 mm', '350 nb': '350 mm', '350nb': '350 mm',
  '16': '400 mm', '16"': '400 mm', '400': '400 mm', 'dn400': '400 mm', '400 nb': '400 mm', '400nb': '400 mm',
  '18': '450 mm', '18"': '450 mm', '450': '450 mm', 'dn450': '450 mm', '450 nb': '450 mm', '450nb': '450 mm',
  '20': '500 mm', '20"': '500 mm', '500': '500 mm', 'dn500': '500 mm', '500 nb': '500 mm', '500nb': '500 mm',
  '24': '600 mm', '24"': '600 mm', '600': '600 mm', 'dn600': '600 mm', '600 nb': '600 mm', '600nb': '600 mm',
  '28': '700 mm', '28"': '700 mm', '700': '700 mm', '700 nb': '700 mm',
  '30': '750 mm', '30"': '750 mm', '750': '750 mm', '750 nb': '750 mm',
  '36': '900 mm', '36"': '900 mm', '900': '900 mm', '900 nb': '900 mm',
  '40': '1000 mm', '40"': '1000 mm', '1000': '1000 mm', '1000 nb': '1000 mm',
  '42': '1050 mm', '42"': '1050 mm', '1050': '1050 mm', '1050 nb': '1050 mm',
  '48': '1200 mm', '48"': '1200 mm', '1200': '1200 mm', '1200 nb': '1200 mm',
  '54': '1350 mm', '54"': '1350 mm', '1350': '1350 mm', '1350 nb': '1350 mm',
  '60': '1500 mm', '60"': '1500 mm', '1500': '1500 mm', '1500 nb': '1500 mm',
  '72': '1800 mm', '72"': '1800 mm', '1800': '1800 mm', '1800 nb': '1800 mm',
  '80"': '2000 mm', '2000': '2000 mm', '2000 nb': '2000 mm'
});

// 4. END CONNECTIONS WHITELIST
const ALLOWED_END_CONNECTIONS = Object.freeze([
  'Flanged RF',
  'Flanged RTJ',
  'Flanged Flat Face',
  'Flanged',
  'Butt Weld',
  'Socket Weld',
  'NPT Threaded',
  'Wafer',
  'Lug'
]);

const END_CONNECTION_ALIASES = Object.freeze({
  'butt weld': 'Butt Weld',
  'b/w': 'Butt Weld',
  'bw': 'Butt Weld',
  'bw end': 'Butt Weld',
  'butt weld ends': 'Butt Weld',
  'socket weld': 'Socket Weld',
  's/w': 'Socket Weld',
  's.w.': 'Socket Weld',
  'socket weld ends': 'Socket Weld',
  'flanged': 'Flanged',
  'flange': 'Flanged',
  'flg': 'Flanged',
  'fe': 'Flanged',
  'flanged rf': 'Flanged RF',
  'rf flanged': 'Flanged RF',
  'flanged raised face': 'Flanged RF',
  'flanged - rf': 'Flanged RF',
  'flanged-rf': 'Flanged RF',
  'flanged rf ends': 'Flanged RF',
  'flanged rtj': 'Flanged RTJ',
  'rtj flanged': 'Flanged RTJ',
  'flanged ring type joint': 'Flanged RTJ',
  'flanged - rtj': 'Flanged RTJ',
  'flanged-rtj': 'Flanged RTJ',
  'flanged rtj ends': 'Flanged RTJ',
  'flanged ff': 'Flanged Flat Face',
  'flanged flat face': 'Flanged Flat Face',
  'flanged - ff': 'Flanged Flat Face',
  'flanged-ff': 'Flanged Flat Face',
  'flanged ends': 'Flanged',
  'rf': 'Flanged RF',
  'raised face': 'Flanged RF',
  'r.f.': 'Flanged RF',
  'rtj': 'Flanged RTJ',
  'ring type joint': 'Flanged RTJ',
  'r-t-j': 'Flanged RTJ',
  'ff': 'Flanged Flat Face',
  'flat face': 'Flanged Flat Face',
  'f.f.': 'Flanged Flat Face',
  'npt': 'NPT Threaded',
  'threaded': 'NPT Threaded',
  'screwed': 'NPT Threaded',
  'scr': 'NPT Threaded',
  'wafer': 'Wafer',
  'lug': 'Lug'
});

// 4.5. OPERATIONS WHITELIST
const ALLOWED_OPERATIONS = Object.freeze([
  'Manual',
  'Handwheel',
  'Lever Operated',
  'Gear Operated',
  'Pneumatic',
  'Electric',
  'Motorized',
  'Hydraulic',
  'Bare Shaft'
]);

const OPERATION_ALIASES = Object.freeze({
  'manual': 'Manual',
  'handwheel': 'Manual',
  'lever': 'Lever Operated',
  'lever operated': 'Lever Operated',
  'gear': 'Gear Operated',
  'gear operated': 'Gear Operated',
  'gearbox': 'Gear Operated',
  'pneumatic': 'Pneumatic',
  'pneumatic actuator': 'Pneumatic',
  'air operated': 'Pneumatic',
  'actuated': 'Pneumatic',
  'electric': 'Electric',
  'electric actuator': 'Electric',
  'motorized': 'Motorized',
  'motor operated': 'Motorized',
  'mov': 'Motorized',
  'hydraulic': 'Hydraulic',
  'bare shaft': 'Bare Shaft'
});

// 5. MATERIALS WHITELIST
const ALLOWED_MATERIALS = Object.freeze([
  'ASTM A105',
  'ASTM A350 LF2',
  'ASTM A216 WCB',
  'ASTM A352 LCB',
  'ASTM A351 Gr. CF8M',
  'ASTM A351 Gr. CF8',
  'SS316',
  'SS316L',
  'SS304',
  'SS304L',
  'ASTM A182 F316',
  'ASTM A182 F316L',
  'ASTM A182 F304',
  'Duplex F51 (UNS S31803)',
  'Super Duplex F53 (UNS S32750)',
  'Monel 400',
  'Inconel 625',
  'Hastelloy C276',
  'Cast Iron',
  'Ductile Iron'
]);

const MATERIAL_ALIASES = Object.freeze({
  'a105': 'ASTM A105',
  'a 105': 'ASTM A105',
  'a-105': 'ASTM A105',
  'astm a105': 'ASTM A105',
  'forged steel': 'ASTM A105',
  'forged carbon steel': 'ASTM A105',
  'lf2': 'ASTM A350 LF2',
  'a350 lf2': 'ASTM A350 LF2',
  'a350-lf2': 'ASTM A350 LF2',
  'astm a350 lf2': 'ASTM A350 LF2',
  'wcb': 'ASTM A216 WCB',
  'cs': 'ASTM A216 WCB',
  'cast steel': 'ASTM A216 WCB',
  'carbon steel': 'ASTM A216 WCB',
  'a216 wcb': 'ASTM A216 WCB',
  'a216-wcb': 'ASTM A216 WCB',
  'a-216 wcb': 'ASTM A216 WCB',
  'astm a216 wcb': 'ASTM A216 WCB',
  'astm a216 gr. wcb': 'ASTM A216 WCB',
  'astm a216 gr wcb': 'ASTM A216 WCB',
  'a216 gr. wcb': 'ASTM A216 WCB',
  'a216 gr wcb': 'ASTM A216 WCB',
  'cs wcb': 'ASTM A216 WCB',
  'carbon steel wcb': 'ASTM A216 WCB',
  'cs (a216 wcb)': 'ASTM A216 WCB',
  'lcb': 'ASTM A352 LCB',
  'a352 lcb': 'ASTM A352 LCB',
  'astm a352 lcb': 'ASTM A352 LCB',
  'cf8m': 'ASTM A351 Gr. CF8M',
  'cf-8m': 'ASTM A351 Gr. CF8M',
  'a351 cf8m': 'ASTM A351 Gr. CF8M',
  'a351-cf8m': 'ASTM A351 Gr. CF8M',
  'astm a351 cf8m': 'ASTM A351 Gr. CF8M',
  'astm a351 gr. cf8m': 'ASTM A351 Gr. CF8M',
  'astm a351 gr cf8m': 'ASTM A351 Gr. CF8M',
  'a351 gr. cf8m': 'ASTM A351 Gr. CF8M',
  'a351 gr cf8m': 'ASTM A351 Gr. CF8M',
  'cf8': 'ASTM A351 Gr. CF8',
  'cf-8': 'ASTM A351 Gr. CF8',
  'a351 cf8': 'ASTM A351 Gr. CF8',
  'astm a351 cf8': 'ASTM A351 Gr. CF8',
  'astm a351 gr. cf8': 'ASTM A351 Gr. CF8',
  'astm a351 gr cf8': 'ASTM A351 Gr. CF8',
  'ss316': 'SS316',
  'ss 316': 'SS316',
  '316ss': 'SS316',
  '316 ss': 'SS316',
  '316': 'SS316',
  'stainless steel 316': 'SS316',
  'ss316l': 'SS316L',
  'ss 316l': 'SS316L',
  '316l': 'SS316L',
  '316l ss': 'SS316L',
  'ss304': 'SS304',
  'ss 304': 'SS304',
  '304ss': 'SS304',
  '304 ss': 'SS304',
  '304': 'SS304',
  'stainless steel 304': 'SS304',
  'ss304l': 'SS304L',
  'ss 304l': 'SS304L',
  'f316': 'ASTM A182 F316',
  'a182 f316': 'ASTM A182 F316',
  'astm a182 f316': 'ASTM A182 F316',
  'f316l': 'ASTM A182 F316L',
  'a182 f316l': 'ASTM A182 F316L',
  'astm a182 f316l': 'ASTM A182 F316L',
  'f304': 'ASTM A182 F304',
  'a182 f304': 'ASTM A182 F304',
  'f51': 'Duplex F51 (UNS S31803)',
  'duplex f51': 'Duplex F51 (UNS S31803)',
  'duplexf51': 'Duplex F51 (UNS S31803)',
  'f53': 'Super Duplex F53 (UNS S32750)',
  'duplex f53': 'Super Duplex F53 (UNS S32750)',
  'super duplex f53': 'Super Duplex F53 (UNS S32750)',
  'duplexf53': 'Super Duplex F53 (UNS S32750)',
  'monel 400': 'Monel 400',
  'monel': 'Monel 400',
  'inconel 625': 'Inconel 625',
  'inconel': 'Inconel 625',
  'hastelloy c276': 'Hastelloy C276',
  'hastelloy': 'Hastelloy C276',
  'cast iron': 'Cast Iron',
  'ductile iron': 'Ductile Iron'
});

// 6. DESIGN STANDARDS WHITELIST
const ALLOWED_STANDARDS = Object.freeze([
  'API 6D',
  'API 600',
  'API 602',
  'API 608',
  'API 594',
  'API 598',
  'ASME B16.34',
  'BS 5351',
  'BS 1868',
  'BS 1873',
  'BS 5352',
  'ISO 17292',
  'EN 12516',
  'IS 14846',
  'IBR'
]);

const STANDARD_ALIASES = Object.freeze({
  'api6d': 'API 6D', 'api 6d': 'API 6D',
  'api600': 'API 600', 'api 600': 'API 600',
  'api602': 'API 602', 'api 602': 'API 602',
  'api608': 'API 608', 'api 608': 'API 608',
  'api594': 'API 594', 'api 594': 'API 594',
  'api598': 'API 598', 'api 598': 'API 598',
  'asme b16.34': 'ASME B16.34', 'b16.34': 'ASME B16.34', 'asme': 'ASME B16.34',
  'bs 5352': 'BS 5352', 'bs5352': 'BS 5352',
  'bs 1868': 'BS 1868', 'bs1868': 'BS 1868',
  'bs 1873': 'BS 1873', 'bs1873': 'BS 1873',
  'bs 5351': 'BS 5351', 'bs5351': 'BS 5351',
  'iso 17292': 'ISO 17292', 'iso17292': 'ISO 17292',
  'ibr': 'IBR'
});

class EngineeringDictionary {
  constructor() {
    this.dynamicAliases = new Map();
  }

  /**
   * Normalizes size with NPS and DN extraction and nominal consistency validation.
   * @param {string} rawSize 
   * @returns {Object} { isValid, state, canonicalValue, nps, dn, reviewReason, reason }
   */
  normalizeSize(rawSize) {
    if (!rawSize || typeof rawSize !== 'string') {
      return {
        isValid: false,
        state: VALIDATION_STATES.NOT_FOUND,
        canonicalValue: null,
        nps: null,
        dn: null,
        reviewReason: REVIEW_REASONS.SIZE_NOT_FOUND,
        reason: 'Size is empty or missing'
      };
    }

    const strVal = rawSize.trim();

    // Check for dual NPS and DN representation (e.g. '2" (50 MM)', '6" / 150 MM', '6" / 50 MM', 'NPS 2 / DN50')
    const inchPattern = /(\d+(?:\/\d+)?(?:\.\d+)?)\s*(?:"|inch|inches|in\b|nps\b)/i;
    const mmPattern = /(?:dn\s*|(?:\b))(\d+)\s*(?:mm|dn\b)/i;

    const inchMatch = strVal.match(inchPattern);
    const mmMatch = strVal.match(mmPattern);

    if (inchMatch && mmMatch) {
      const rawNps = inchMatch[1];
      const rawDn = parseInt(mmMatch[1], 10);
      const expectedDn = NPS_TO_DN_MAP[rawNps];

      if (expectedDn && expectedDn !== rawDn) {
        return {
          isValid: false,
          state: VALIDATION_STATES.CONFLICT,
          canonicalValue: null,
          nps: rawNps,
          dn: rawDn,
          reviewReason: REVIEW_REASONS.SIZE_NPS_DN_MISMATCH,
          reason: `NPS ${rawNps}" (${expectedDn} mm) conflicts with specified DN ${rawDn} mm`
        };
      }

      if (expectedDn && expectedDn === rawDn && ALLOWED_SIZES_MM.includes(rawDn)) {
        return {
          isValid: true,
          state: VALIDATION_STATES.VALID,
          canonicalValue: `${rawDn} mm`,
          nps: rawNps,
          dn: rawDn,
          reason: `Matched consistent NPS ${rawNps}" and DN ${rawDn} mm`
        };
      }
    }

    // Check single inch/NPS lookup
    const lowerNoSpace = strVal.toLowerCase().replace(/[\s"']/g, '');
    const mapped = INCH_TO_MM_MAP[strVal] || INCH_TO_MM_MAP[lowerNoSpace];
    if (mapped) {
      const dnVal = parseInt(mapped, 10);
      const npsVal = DN_TO_NPS_MAP[dnVal] || null;
      return {
        isValid: true,
        state: VALIDATION_STATES.VALID,
        canonicalValue: mapped,
        nps: npsVal,
        dn: dnVal,
        reason: 'Converted size to standard NB mm'
      };
    }

    // Direct NPS to DN lookup by stripping in/inch/inches/nb/"
    const npsSuffixMatch = strVal.toLowerCase().trim().match(/^([0-9]+(?:\/[0-9]+)?(?:\.[0-9]+)?)\s*(?:"|in|inch|inches|nb|'')?$/i);
    if (npsSuffixMatch && npsSuffixMatch[1]) {
      const rawNpsKey = npsSuffixMatch[1];
      const dnVal = NPS_TO_DN_MAP[rawNpsKey];
      if (dnVal && ALLOWED_SIZES_MM.includes(dnVal)) {
        return {
          isValid: true,
          state: VALIDATION_STATES.VALID,
          canonicalValue: `${dnVal} mm`,
          nps: DN_TO_NPS_MAP[dnVal] || rawNpsKey,
          dn: dnVal,
          reason: `Converted ${rawNpsKey}" to standard ${dnVal} mm`
        };
      }
    }

    // Direct mm suffix lookup (e.g. "50mm", "250 mm")
    const mmSuffixMatch = strVal.toLowerCase().trim().match(/^([0-9]+)\s*(?:mm|dn)?$/i);
    if (mmSuffixMatch && mmSuffixMatch[1]) {
      const rawMm = parseInt(mmSuffixMatch[1], 10);
      if (ALLOWED_SIZES_MM.includes(rawMm)) {
        const npsVal = DN_TO_NPS_MAP[rawMm] || null;
        return {
          isValid: true,
          state: VALIDATION_STATES.VALID,
          canonicalValue: `${rawMm} mm`,
          nps: npsVal,
          dn: rawMm,
          reason: `Valid size within standard catalog range: ${rawMm} mm`
        };
      }
    }

    // Check single numeric mm lookup
    const numOnly = Number(strVal.replace(/[^0-9.]/g, ''));
    if (!isNaN(numOnly) && ALLOWED_SIZES_MM.includes(numOnly)) {
      const npsVal = DN_TO_NPS_MAP[numOnly] || null;
      return {
        isValid: true,
        state: VALIDATION_STATES.VALID,
        canonicalValue: `${numOnly} mm`,
        nps: npsVal,
        dn: numOnly,
        reason: `Valid size within standard catalog range: ${numOnly} mm`
      };
    }

    return {
      isValid: false,
      state: VALIDATION_STATES.INVALID,
      canonicalValue: null,
      nps: null,
      dn: isNaN(numOnly) ? null : numOnly,
      reviewReason: REVIEW_REASONS.SIZE_NOT_FOUND,
      reason: `Size "${strVal}" is not in standard catalog sizes (Allowed: 15mm-2000mm)`
    };
  }

  /**
   * Validates and normalizes any extracted field value against whitelists and canonical maps.
   * @param {string} fieldName 
   * @param {any} rawValue 
   * @returns {Object} { isValid: boolean, canonicalValue: string|null, state: string, reviewReason: string|null, reason: string }
   */
  validateAndNormalize(fieldName, rawValue) {
    if (rawValue === null || rawValue === undefined || rawValue === '') {
      return {
        isValid: false,
        state: VALIDATION_STATES.NOT_FOUND,
        canonicalValue: null,
        reviewReason: REVIEW_REASONS.MISSING_REQUIRED_FIELD,
        reason: 'Value is empty'
      };
    }

    const key = String(fieldName).toLowerCase();
    const strVal = String(rawValue).trim();
    const cleanKey = strVal.toLowerCase().replace(/[^a-z0-9]/g, '');

    // 1. Valve Type
    if (key.includes('type') && key.includes('valve')) {
      const lower = strVal.toLowerCase();
      const singularLower = lower.replace(/\bvalves\b/i, 'valve').trim();
      const canonical = VALVE_TYPE_ALIASES[lower] || VALVE_TYPE_ALIASES[singularLower] || this.dynamicAliases.get(`valve:${cleanKey}`);
      if (canonical) {
        return { isValid: true, state: VALIDATION_STATES.VALID, canonicalValue: canonical, reason: 'Matched valve type whitelist' };
      }
      const exact = ALLOWED_VALVE_TYPES.find(v => v.toLowerCase() === lower || v.toLowerCase() === singularLower);
      if (exact) {
        return { isValid: true, state: VALIDATION_STATES.VALID, canonicalValue: exact, reason: 'Exact match in valve type whitelist' };
      }
      return {
        isValid: false,
        state: VALIDATION_STATES.INVALID,
        canonicalValue: null,
        reviewReason: REVIEW_REASONS.VALVE_TYPE_NOT_FOUND,
        reason: `"${strVal}" is not a recognized engineering valve type`
      };
    }

    // 2. Size
    if (key.includes('size')) {
      return this.normalizeSize(strVal);
    }

    // 3. Operation / Actuation
    if (key.includes('operating') || key.includes('actuation') || key.includes('operation')) {
      const lower = strVal.toLowerCase();
      const canonical = OPERATION_ALIASES[lower] || this.dynamicAliases.get(`op:${cleanKey}`);
      if (canonical) {
        return { isValid: true, state: VALIDATION_STATES.VALID, canonicalValue: canonical, reason: 'Matched operation type whitelist' };
      }
      const exact = ALLOWED_OPERATIONS.find(o => o.toLowerCase() === lower);
      if (exact) {
        return { isValid: true, state: VALIDATION_STATES.VALID, canonicalValue: exact, reason: 'Exact match in operation whitelist' };
      }
      return {
        isValid: false,
        state: VALIDATION_STATES.INVALID,
        canonicalValue: null,
        reviewReason: REVIEW_REASONS.INVALID_VALUE,
        reason: `Operation type "${strVal}" is not in allowed list`
      };
    }

    // 4. Pressure Class / Rating
    if (key.includes('class') || key.includes('pressure_rating') || key.includes('pressure_class') || key === 'rating' || (key.includes('rating') && !key.includes('operating'))) {
      const cleanClass = strVal.toLowerCase().replace(/[^0-9]/g, '');
      const canonical = CLASS_ALIASES[cleanClass] || CLASS_ALIASES[strVal.toLowerCase()];
      if (canonical && ALLOWED_PRESSURE_CLASSES.includes(canonical)) {
        return { isValid: true, state: VALIDATION_STATES.VALID, canonicalValue: canonical, reason: 'Matched ASME pressure class rating' };
      }
      return {
        isValid: false,
        state: VALIDATION_STATES.INVALID,
        canonicalValue: null,
        reviewReason: REVIEW_REASONS.CLASS_NOT_FOUND,
        reason: `Pressure class "${strVal}" is not a recognized ASME rating (Allowed: 150#, 300#, 600#, 800#, 900#, 1500#, 2500#)`
      };
    }

    // 5. End Connection
    if (key.includes('end') || key.includes('connection')) {
      const lower = strVal.toLowerCase();
      const canonical = END_CONNECTION_ALIASES[lower] || this.dynamicAliases.get(`conn:${cleanKey}`);
      if (canonical) {
        return { isValid: true, state: VALIDATION_STATES.VALID, canonicalValue: canonical, reason: 'Matched end connection whitelist' };
      }
      const exact = ALLOWED_END_CONNECTIONS.find(c => c.toLowerCase() === lower);
      if (exact) {
        return { isValid: true, state: VALIDATION_STATES.VALID, canonicalValue: exact, reason: 'Exact match in end connection whitelist' };
      }
      return {
        isValid: false,
        state: VALIDATION_STATES.INVALID,
        canonicalValue: null,
        reviewReason: REVIEW_REASONS.INVALID_VALUE,
        reason: `End connection "${strVal}" is not in allowed list`
      };
    }

    // 6. Material (MOC)
    if (key.includes('material') || key.includes('moc')) {
      const cleanMat = strVal.toLowerCase().replace(/[^a-z0-9]/g, '');
      const canonical = MATERIAL_ALIASES[cleanMat] || MATERIAL_ALIASES[strVal.toLowerCase()] || this.dynamicAliases.get(`mat:${cleanKey}`);
      if (canonical) {
        return { isValid: true, state: VALIDATION_STATES.VALID, canonicalValue: canonical, reason: 'Matched engineering material grade whitelist' };
      }
      const exact = ALLOWED_MATERIALS.find(m => m.toLowerCase() === strVal.toLowerCase());
      if (exact) {
        return { isValid: true, state: VALIDATION_STATES.VALID, canonicalValue: exact, reason: 'Exact match in material whitelist' };
      }

      return {
        isValid: false,
        state: VALIDATION_STATES.INVALID,
        canonicalValue: null,
        reviewReason: REVIEW_REASONS.MATERIAL_NOT_FOUND,
        reason: `Material grade "${strVal}" is not recognized in engineering dictionary`
      };
    }

    // 7. Standard
    if (key.includes('standard') || key.includes('std')) {
      const lower = strVal.toLowerCase();
      const canonical = STANDARD_ALIASES[lower.replace(/[^a-z0-9]/g, '')];
      if (canonical) {
        return { isValid: true, state: VALIDATION_STATES.VALID, canonicalValue: canonical, reason: 'Matched design standard whitelist' };
      }
      return { isValid: true, state: VALIDATION_STATES.VALID, canonicalValue: strVal.toUpperCase(), reason: 'Passed standard formatting' };
    }

    // 8. Quantity
    if (key.includes('qty') || key.includes('quantity')) {
      const num = Number(strVal);
      if (!isNaN(num) && num > 0 && Number.isInteger(num)) {
        return { isValid: true, state: VALIDATION_STATES.VALID, canonicalValue: String(num), reason: 'Valid positive integer quantity' };
      }
      return {
        isValid: false,
        state: VALIDATION_STATES.INVALID,
        canonicalValue: null,
        reviewReason: REVIEW_REASONS.MISSING_QUANTITY,
        reason: `Quantity "${strVal}" must be a positive integer`
      };
    }

    // Default fallback for custom text fields
    return { isValid: true, state: VALIDATION_STATES.VALID, canonicalValue: strVal, reason: 'Passed general text validation' };
  }

  normalizeClass(classInput) {
    return this.validateAndNormalize('valve_class', classInput);
  }

  normalizeValveType(typeInput) {
    return this.validateAndNormalize('valve_type', typeInput);
  }

  normalizeMaterial(matInput) {
    return this.validateAndNormalize('valve_moc_body', matInput);
  }

  normalizeEndConnection(connInput) {
    return this.validateAndNormalize('valve_end_connection', connInput);
  }

  normalizeQuantity(qtyInput) {
    return this.validateAndNormalize('quantity', qtyInput);
  }

  normalizeStandard(stdInput) {
    return this.validateAndNormalize('valve_design_std', stdInput);
  }

  normalizeOperation(opInput) {
    return this.validateAndNormalize('valve_actuation_type', opInput);
  }

  getField(key) {
    return this.validateAndNormalize(key, '');
  }

  registerLearnedAlias(category, alias, canonicalValue) {
    const cleanAlias = String(alias).toLowerCase().replace(/[^a-z0-9]/g, '');
    const cat = String(category).toLowerCase();
    this.dynamicAliases.set(`${cat}:${cleanAlias}`, canonicalValue);
  }
}

module.exports = new EngineeringDictionary();
module.exports.ALLOWED_VALVE_TYPES = ALLOWED_VALVE_TYPES;
module.exports.ALLOWED_PRESSURE_CLASSES = ALLOWED_PRESSURE_CLASSES;
module.exports.ALLOWED_END_CONNECTIONS = ALLOWED_END_CONNECTIONS;
module.exports.ALLOWED_MATERIALS = ALLOWED_MATERIALS;
module.exports.ALLOWED_SIZES_MM = ALLOWED_SIZES_MM;
module.exports.NPS_TO_DN_MAP = NPS_TO_DN_MAP;
module.exports.DN_TO_NPS_MAP = DN_TO_NPS_MAP;
