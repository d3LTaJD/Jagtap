/**
 * Centralized Engineering Knowledge Engine
 * Single source of truth for Engineering Taxonomy, Standards, Materials,
 * End Connections, Aliases, and Cross-Field Compatibility Rules.
 */

const INCH_TO_MM_MAP = Object.freeze({
  '1/8': '6', '1/8"': '6',
  '1/4': '8', '1/4"': '8',
  '3/8': '10', '3/8"': '10',
  '1/2': '15', '1/2"': '15',
  '3/4': '20', '3/4"': '20',
  '1': '25', '1"': '25',
  '1-1/4': '32', '1 1/4': '32', '1 1/4"': '32', '1-1/4"': '32',
  '1-1/2': '40', '1 1/2': '40', '1 1/2"': '40', '1-1/2"': '40',
  '2': '50', '2"': '50',
  '2-1/2': '65', '2 1/2': '65', '2 1/2"': '65', '2-1/2"': '65',
  '3': '80', '3"': '80',
  '4': '100', '4"': '100',
  '5': '125', '5"': '125',
  '6': '150', '6"': '150',
  '8': '200', '8"': '200',
  '10': '250', '10"': '250',
  '12': '300', '12"': '300',
  '14': '350', '14"': '350',
  '16': '400', '16"': '400',
  '18': '450', '18"': '450',
  '20': '500', '20"': '500',
  '24': '600', '24"': '600',
  '28': '700', '28"': '700',
  '30': '750', '30"': '750',
  '36': '900', '36"': '900',
  '40': '1000', '40"': '1000',
  '42': '1050', '42"': '1050',
  '48': '1200', '48"': '1200',
  '54': '1350', '54"': '1350',
  '60': '1500', '60"': '1500',
  '64': '1600', '64"': '1600',
  '72': '1800', '72"': '1800',
  '80': '2000', '80"': '2000'
});

const END_CONNECTION_ALIASES = Object.freeze({
  'bw': 'Butt Weld',
  'buttweld': 'Butt Weld',
  'butt weld': 'Butt Weld',
  'b/w': 'Butt Weld',
  'b.w.': 'Butt Weld',
  'bw end': 'Butt Weld',
  'bw ends': 'Butt Weld',
  'sw': 'Socket Weld',
  'socketweld': 'Socket Weld',
  'socket weld': 'Socket Weld',
  's/w': 'Socket Weld',
  's.w.': 'Socket Weld',
  'rf': 'Raised Face',
  'raised face': 'Raised Face',
  'r.f.': 'Raised Face',
  'rtj': 'Ring Type Joint',
  'ring type joint': 'Ring Type Joint',
  'r-t-j': 'Ring Type Joint',
  'ff': 'Flat Face',
  'flat face': 'Flat Face',
  'f.f.': 'Flat Face',
  'npt': 'NPT Threaded',
  'threaded': 'NPT Threaded',
  'screwed': 'NPT Threaded',
  'wafer': 'Wafer',
  'lug': 'Lug',
  'flanged': 'Flanged',
  'flange': 'Flanged',
  'fe': 'Flanged'
});

const CLASS_RATING_ALIASES = Object.freeze({
  '150': '150#', '150#': '150#', 'cl150': '150#', 'class 150': '150#', '150lbs': '150#', '150 lbs': '150#',
  '300': '300#', '300#': '300#', 'cl300': '300#', 'class 300': '300#', '300lbs': '300#', '300 lbs': '300#',
  '600': '600#', '600#': '600#', 'cl600': '600#', 'class 600': '600#', '600lbs': '600#', '600 lbs': '600#',
  '800': '800#', '800#': '800#', 'cl800': '800#', 'class 800': '800#', '800lbs': '800#', '800 lbs': '800#',
  '900': '900#', '900#': '900#', 'cl900': '900#', 'class 900': '900#', '900lbs': '900#', '900 lbs': '900#',
  '1500': '1500#', '1500#': '1500#', 'cl1500': '1500#', 'class 1500': '1500#', '1500lbs': '1500#', '1500 lbs': '1500#',
  '2500': '2500#', '2500#': '2500#', 'cl2500': '2500#', 'class 2500': '2500#', '2500lbs': '2500#', '2500 lbs': '2500#'
});

const MATERIAL_ALIASES = Object.freeze({
  'a105': 'ASTM A105',
  'a 105': 'ASTM A105',
  'astm a105': 'ASTM A105',
  'lf2': 'ASTM A350 LF2',
  'a350 lf2': 'ASTM A350 LF2',
  'a350-lf2': 'ASTM A350 LF2',
  'wcb': 'ASTM A216 WCB',
  'a216 wcb': 'ASTM A216 WCB',
  'lcb': 'ASTM A352 LCB',
  'a352 lcb': 'ASTM A352 LCB',
  'ss316': 'SS316',
  '316ss': 'SS316',
  '316 ss': 'SS316',
  'ss316l': 'SS316L',
  '316l': 'SS316L',
  'ss304': 'SS304',
  '304ss': 'SS304',
  'ss304l': 'SS304L',
  'f316': 'ASTM A182 F316',
  'f316l': 'ASTM A182 F316L',
  'f304': 'ASTM A182 F304',
  'f51': 'Duplex F51 (UNS S31803)',
  'f53': 'Super Duplex F53 (UNS S32750)'
});

const VALVE_TYPE_ALIASES = Object.freeze({
  'ball valve': 'Ball Valve',
  'ball': 'Ball Valve',
  'globe valve': 'Globe Valve',
  'globe': 'Globe Valve',
  'gate valve': 'Gate Valve',
  'gate': 'Gate Valve',
  'check valve': 'Check Valve',
  'check': 'Check Valve',
  'non return valve': 'Check Valve',
  'nrv': 'Check Valve',
  'butterfly valve': 'Butterfly Valve',
  'bfv': 'Butterfly Valve',
  'plug valve': 'Plug Valve',
  'control valve': 'Control Valve',
  'control': 'Control Valve'
});

class KnowledgeEngine {
  constructor() {
    this.dynamicAliases = new Map();
  }

  normalizeSize(rawSize) {
    if (!rawSize) return null;
    const clean = String(rawSize).toLowerCase().replace(/(?:inch|inches|nb|dn|mm|["'\s])+/g, '').trim();
    if (INCH_TO_MM_MAP[clean]) return INCH_TO_MM_MAP[clean];
    if (INCH_TO_MM_MAP[String(rawSize).trim()]) return INCH_TO_MM_MAP[String(rawSize).trim()];
    const num = Number(clean);
    if (!isNaN(num) && num >= 15 && num <= 2000) {
      return String(num);
    }
    return clean;
  }

  normalizeEndConnection(rawConn) {
    if (!rawConn) return null;
    const key = String(rawConn).toLowerCase().trim();
    if (END_CONNECTION_ALIASES[key]) return END_CONNECTION_ALIASES[key];
    if (this.dynamicAliases.has(`conn:${key}`)) return this.dynamicAliases.get(`conn:${key}`);
    return String(rawConn).trim();
  }

  normalizeClass(rawClass) {
    if (!rawClass) return null;
    const key = String(rawClass).toLowerCase().replace(/[^a-z0-9]/g, '');
    if (CLASS_RATING_ALIASES[key]) return CLASS_RATING_ALIASES[key];
    return String(rawClass).trim();
  }

  normalizeMaterial(rawMat) {
    if (!rawMat) return null;
    const key = String(rawMat).toLowerCase().replace(/[^a-z0-9]/g, '');
    if (MATERIAL_ALIASES[key]) return MATERIAL_ALIASES[key];
    if (this.dynamicAliases.has(`mat:${key}`)) return this.dynamicAliases.get(`mat:${key}`);
    return String(rawMat).trim();
  }

  normalizeValveType(rawType) {
    if (!rawType) return null;
    const key = String(rawType).toLowerCase().trim();
    if (VALVE_TYPE_ALIASES[key]) return VALVE_TYPE_ALIASES[key];
    return String(rawType).trim();
  }

  registerLearnedAlias(category, alias, canonicalValue) {
    const cleanAlias = String(alias).toLowerCase().replace(/[^a-z0-9]/g, '');
    const cat = String(category).toLowerCase();
    const shortCat = cat.startsWith('mat') ? 'mat' : cat.startsWith('conn') ? 'conn' : cat;
    
    this.dynamicAliases.set(`${shortCat}:${cleanAlias}`, canonicalValue);
    this.dynamicAliases.set(`${cat}:${cleanAlias}`, canonicalValue);
  }
}

// Export singleton instance
module.exports = new KnowledgeEngine();
