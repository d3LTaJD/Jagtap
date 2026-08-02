/**
 * EngineeringDictionary.js
 * High-precision Engineering Dictionary and Validation Whitelist Service.
 * Single Source of Truth for validation, alias resolution, and canonical normalization.
 * Rejects hallucinated or impossible engineering specifications (e.g. Class 3000 or Size 9000mm).
 */

// 1. ALLOWED VALVE TYPES WHITELIST
const ALLOWED_VALVE_TYPES = Object.freeze([
  'Ball Valve',
  'Gate Valve',
  'Globe Valve',
  'Check Valve',
  'Butterfly Valve',
  'Plug Valve',
  'Control Valve',
  'Needle Valve',
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
  'gate valve': 'Gate Valve',
  'gate': 'Gate Valve',
  'g.v': 'Gate Valve',
  'g.v.': 'Gate Valve',
  'gv': 'Gate Valve',
  'g valve': 'Gate Valve',
  'globe valve': 'Globe Valve',
  'globe': 'Globe Valve',
  'gl.v': 'Globe Valve',
  'check valve': 'Check Valve',
  'check': 'Check Valve',
  'chk': 'Check Valve',
  'non return valve': 'Check Valve',
  'nrv': 'Check Valve',
  'c.v': 'Check Valve',
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
  '150': '150#', '150#': '150#', 'cl150': '150#', 'class 150': '150#', '150lbs': '150#', '150 lbs': '150#', 'cl-150': '150#',
  '300': '300#', '300#': '300#', 'cl300': '300#', 'class 300': '300#', '300lbs': '300#', '300 lbs': '300#', 'cl-300': '300#',
  '600': '600#', '600#': '600#', 'cl600': '600#', 'class 600': '600#', '600lbs': '600#', '600 lbs': '600#', 'cl-600': '600#',
  '800': '800#', '800#': '800#', 'cl800': '800#', 'class 800': '800#', '800lbs': '800#', '800 lbs': '800#', 'cl-800': '800#',
  '900': '900#', '900#': '900#', 'cl900': '900#', 'class 900': '900#', '900lbs': '900#', '900 lbs': '900#', 'cl-900': '900#',
  '1500': '1500#', '1500#': '1500#', 'cl1500': '1500#', 'class 1500': '1500#', '1500lbs': '1500#', '1500 lbs': '1500#', 'cl-1500': '1500#',
  '2500': '2500#', '2500#': '2500#', 'cl2500': '2500#', 'class 2500': '2500#', '2500lbs': '2500#', '2500 lbs': '2500#', 'cl-2500': '2500#'
});

// 3. INCH TO MM SIZING CONVERSION (ASME B16.10 / ISO 5752)
const INCH_TO_MM_MAP = Object.freeze({
  '1/8': '6 mm', '1/8"': '6 mm', '6': '6 mm', 'dn6': '6 mm',
  '1/4': '8 mm', '1/4"': '8 mm', '8': '8 mm', 'dn8': '8 mm',
  '3/8': '10 mm', '3/8"': '10 mm', '10': '10 mm', 'dn10': '10 mm',
  '1/2': '15 mm', '1/2"': '15 mm', '15': '15 mm', 'dn15': '15 mm', '15mm': '15 mm',
  '3/4': '20 mm', '3/4"': '20 mm', '20': '20 mm', 'dn20': '20 mm', '20mm': '20 mm',
  '1': '25 mm', '1"': '25 mm', '25': '25 mm', 'dn25': '25 mm', '25mm': '25 mm',
  '1-1/4': '32 mm', '1 1/4': '32 mm', '1.25': '32 mm', '1 1/4"': '32 mm', '1-1/4"': '32 mm', '32': '32 mm', 'dn32': '32 mm',
  '1-1/2': '40 mm', '1 1/2': '40 mm', '1.5': '40 mm', '1 1/2"': '40 mm', '1-1/2"': '40 mm', '40': '40 mm', 'dn40': '40 mm',
  '2': '50 mm', '2"': '50 mm', '2in': '50 mm', '2inch': '50 mm', '2 inch': '50 mm', '50': '50 mm', 'dn50': '50 mm', '50mm': '50 mm',
  '2-1/2': '65 mm', '2 1/2': '65 mm', '2.5': '65 mm', '2 1/2"': '65 mm', '2-1/2"': '65 mm', '65': '65 mm', 'dn65': '65 mm',
  '3': '80 mm', '3"': '80 mm', '3in': '80 mm', '3inch': '80 mm', '80': '80 mm', 'dn80': '80 mm', '80mm': '80 mm',
  '4': '100 mm', '4"': '100 mm', '4in': '100 mm', '4inch': '100 mm', '100': '100 mm', 'dn100': '100 mm', '100mm': '100 mm',
  '5': '125 mm', '5"': '125 mm', '125': '125 mm', 'dn125': '125 mm',
  '6': '150 mm', '6"': '150 mm', '6in': '150 mm', '6inch': '150 mm', '150': '150 mm', 'dn150': '150 mm', '150mm': '150 mm',
  '8': '200 mm', '8"': '200 mm', '8in': '200 mm', '8inch': '200 mm', '200': '200 mm', 'dn200': '200 mm', '200mm': '200 mm',
  '10': '250 mm', '10"': '250 mm', '250': '250 mm', 'dn250': '250 mm',
  '12': '300 mm', '12"': '300 mm', '300': '300 mm', 'dn300': '300 mm',
  '14': '350 mm', '14"': '350 mm', '350': '350 mm', 'dn350': '350 mm',
  '16': '400 mm', '16"': '400 mm', '400': '400 mm', 'dn400': '400 mm',
  '18': '450 mm', '18"': '450 mm', '450': '450 mm', 'dn450': '450 mm',
  '20': '500 mm', '20"': '500 mm', '500': '500 mm', 'dn500': '500 mm',
  '24': '600 mm', '24"': '600 mm', '600': '600 mm', 'dn600': '600 mm',
  '28': '700 mm', '28"': '700 mm', '700': '700 mm',
  '30': '750 mm', '30"': '750 mm', '750': '750 mm',
  '36': '900 mm', '36"': '900 mm', '900': '900 mm',
  '40': '1000 mm', '40"': '1000 mm', '1000': '1000 mm',
  '42': '1050 mm', '42"': '1050 mm',
  '48': '1200 mm', '48"': '1200 mm', '1200': '1200 mm',
  '54': '1350 mm', '54"': '1350 mm',
  '60': '1500 mm', '60"': '1500 mm', '1500': '1500 mm',
  '72': '1800 mm', '72"': '1800 mm',
  '80': '2000 mm', '80"': '2000 mm', '2000': '2000 mm'
});

// 4. END CONNECTIONS WHITELIST
const ALLOWED_END_CONNECTIONS = Object.freeze([
  'Butt Weld',
  'Socket Weld',
  'Flanged',
  'NPT Threaded',
  'Ring Type Joint',
  'Raised Face',
  'Flat Face',
  'Wafer',
  'Lug'
]);

const END_CONNECTION_ALIASES = Object.freeze({
  'bw': 'Butt Weld',
  'buttweld': 'Butt Weld',
  'butt weld': 'Butt Weld',
  'b/w': 'Butt Weld',
  'b.w.': 'Butt Weld',
  'bw end': 'Butt Weld',
  'sw': 'Socket Weld',
  'socketweld': 'Socket Weld',
  'socket weld': 'Socket Weld',
  's/w': 'Socket Weld',
  's.w.': 'Socket Weld',
  'flanged': 'Flanged',
  'flange': 'Flanged',
  'flg': 'Flanged',
  'fe': 'Flanged',
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
  'scr': 'NPT Threaded',
  'wafer': 'Wafer',
  'lug': 'Lug'
});

// 5. MATERIALS WHITELIST
const ALLOWED_MATERIALS = Object.freeze([
  'ASTM A105',
  'ASTM A350 LF2',
  'ASTM A216 WCB',
  'ASTM A352 LCB',
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
  'astm a105': 'ASTM A105',
  'lf2': 'ASTM A350 LF2',
  'a350 lf2': 'ASTM A350 LF2',
  'a350-lf2': 'ASTM A350 LF2',
  'wcb': 'ASTM A216 WCB',
  'a216 wcb': 'ASTM A216 WCB',
  'astm a216 wcb': 'ASTM A216 WCB',
  'cs wcb': 'ASTM A216 WCB',
  'carbon steel wcb': 'ASTM A216 WCB',
  'lcb': 'ASTM A352 LCB',
  'a352 lcb': 'ASTM A352 LCB',
  'ss316': 'SS316',
  '316ss': 'SS316',
  '316 ss': 'SS316',
  '316': 'SS316',
  'ss316l': 'SS316L',
  '316l': 'SS316L',
  '316l ss': 'SS316L',
  'ss304': 'SS304',
  '304ss': 'SS304',
  '304 ss': 'SS304',
  '304': 'SS304',
  'ss304l': 'SS304L',
  'f316': 'ASTM A182 F316',
  'a182 f316': 'ASTM A182 F316',
  'f316l': 'ASTM A182 F316L',
  'a182 f316l': 'ASTM A182 F316L',
  'f304': 'ASTM A182 F304',
  'f51': 'Duplex F51 (UNS S31803)',
  'f53': 'Super Duplex F53 (UNS S32750)',
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
  'ASME B16.34',
  'BS 5351',
  'BS 1868',
  'BS 1873',
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
  'asme b16.34': 'ASME B16.34', 'b16.34': 'ASME B16.34', 'asme': 'ASME B16.34',
  'iso 17292': 'ISO 17292', 'iso17292': 'ISO 17292',
  'ibr': 'IBR'
});

class EngineeringDictionary {
  constructor() {
    this.dynamicAliases = new Map();
  }

  /**
   * Validates and normalizes any extracted field value against whitelists and canonical maps.
   * @param {string} fieldName 
   * @param {any} rawValue 
   * @returns {Object} { isValid: boolean, canonicalValue: string|null, reason: string }
   */
  validateAndNormalize(fieldName, rawValue) {
    if (rawValue === null || rawValue === undefined || rawValue === '') {
      return { isValid: false, canonicalValue: null, reason: 'Value is empty' };
    }

    const key = String(fieldName).toLowerCase();
    const strVal = String(rawValue).trim();
    const cleanKey = strVal.toLowerCase().replace(/[^a-z0-9]/g, '');

    // 1. Valve Type
    if (key.includes('type') && key.includes('valve')) {
      const lower = strVal.toLowerCase();
      const canonical = VALVE_TYPE_ALIASES[lower] || this.dynamicAliases.get(`valve:${cleanKey}`);
      if (canonical) {
        return { isValid: true, canonicalValue: canonical, reason: 'Matched valve type whitelist' };
      }
      // Check exact match in allowed list
      const exact = ALLOWED_VALVE_TYPES.find(v => v.toLowerCase() === lower);
      if (exact) {
        return { isValid: true, canonicalValue: exact, reason: 'Exact match in valve type whitelist' };
      }
      return { isValid: false, canonicalValue: null, reason: `"${strVal}" is not a recognized engineering valve type` };
    }

    // 2. Size
    if (key.includes('size')) {
      const lower = strVal.toLowerCase().replace(/[\s"']/g, '');
      const mapped = INCH_TO_MM_MAP[strVal] || INCH_TO_MM_MAP[lower];
      if (mapped) {
        return { isValid: true, canonicalValue: mapped, reason: 'Converted size to standard NB mm' };
      }
      // Numeric check for mm values (15mm - 2000mm)
      const numOnly = Number(strVal.replace(/[^0-9.]/g, ''));
      if (!isNaN(numOnly) && numOnly >= 15 && numOnly <= 2000) {
        return { isValid: true, canonicalValue: `${numOnly} mm`, reason: 'Valid size within 15mm-2000mm catalog range' };
      }
      return { isValid: false, canonicalValue: null, reason: `Size "${strVal}" is outside valid 15mm-2000mm catalog range` };
    }

    // 3. Pressure Class / Rating
    if (key.includes('class') || key.includes('rating')) {
      const cleanClass = strVal.toLowerCase().replace(/[^0-9]/g, '');
      const canonical = CLASS_ALIASES[cleanClass] || CLASS_ALIASES[strVal.toLowerCase()];
      if (canonical && ALLOWED_PRESSURE_CLASSES.includes(canonical)) {
        return { isValid: true, canonicalValue: canonical, reason: 'Matched ASME pressure class rating' };
      }
      return { isValid: false, canonicalValue: null, reason: `Pressure class "${strVal}" is not a recognized ASME rating (Allowed: 150#, 300#, 600#, 800#, 900#, 1500#, 2500#)` };
    }

    // 4. End Connection
    if (key.includes('end') || key.includes('connection')) {
      const lower = strVal.toLowerCase();
      const canonical = END_CONNECTION_ALIASES[lower] || this.dynamicAliases.get(`conn:${cleanKey}`);
      if (canonical) {
        return { isValid: true, canonicalValue: canonical, reason: 'Matched end connection whitelist' };
      }
      const exact = ALLOWED_END_CONNECTIONS.find(c => c.toLowerCase() === lower);
      if (exact) {
        return { isValid: true, canonicalValue: exact, reason: 'Exact match in end connection whitelist' };
      }
      return { isValid: false, canonicalValue: null, reason: `End connection "${strVal}" is not in allowed list` };
    }

    // 5. Material (MOC)
    if (key.includes('material') || key.includes('moc')) {
      const cleanMat = strVal.toLowerCase().replace(/[^a-z0-9]/g, '');
      const canonical = MATERIAL_ALIASES[cleanMat] || MATERIAL_ALIASES[strVal.toLowerCase()] || this.dynamicAliases.get(`mat:${cleanKey}`);
      if (canonical) {
        return { isValid: true, canonicalValue: canonical, reason: 'Matched engineering material grade whitelist' };
      }
      const exact = ALLOWED_MATERIALS.find(m => m.toLowerCase() === strVal.toLowerCase());
      if (exact) {
        return { isValid: true, canonicalValue: exact, reason: 'Exact match in material whitelist' };
      }
      // Fallback for long specs containing known grade words
      if (cleanMat.includes('wcb')) return { isValid: true, canonicalValue: 'ASTM A216 WCB', reason: 'Extracted WCB grade' };
      if (cleanMat.includes('316l')) return { isValid: true, canonicalValue: 'SS316L', reason: 'Extracted SS316L grade' };
      if (cleanMat.includes('316')) return { isValid: true, canonicalValue: 'SS316', reason: 'Extracted SS316 grade' };
      if (cleanMat.includes('304')) return { isValid: true, canonicalValue: 'SS304', reason: 'Extracted SS304 grade' };
      if (cleanMat.includes('a105')) return { isValid: true, canonicalValue: 'ASTM A105', reason: 'Extracted A105 grade' };

      return { isValid: false, canonicalValue: null, reason: `Material grade "${strVal}" is not recognized in engineering dictionary` };
    }

    // 6. Standard
    if (key.includes('standard')) {
      const lower = strVal.toLowerCase();
      const canonical = STANDARD_ALIASES[lower.replace(/[^a-z0-9]/g, '')];
      if (canonical) {
        return { isValid: true, canonicalValue: canonical, reason: 'Matched design standard whitelist' };
      }
      return { isValid: true, canonicalValue: strVal.toUpperCase(), reason: 'Passed standard formatting' };
    }

    // 7. Quantity
    if (key.includes('qty') || key.includes('quantity')) {
      const num = Number(strVal);
      if (!isNaN(num) && num > 0 && Number.isInteger(num)) {
        return { isValid: true, canonicalValue: String(num), reason: 'Valid positive integer quantity' };
      }
      return { isValid: false, canonicalValue: null, reason: `Quantity "${strVal}" must be a positive integer` };
    }

    // Default fallback for custom text fields
    return { isValid: true, canonicalValue: strVal, reason: 'Passed general text validation' };
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
