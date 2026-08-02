/**
 * Tokenizer.js
 * Pre-processing layer that normalizes raw RFQ text BEFORE regex extractors run.
 * Handles concatenated words, abbreviations, hyphens, slashes, and mixed formatting
 * found in real-world industrial RFQ documents and OCR output.
 */

// Abbreviation expansion map (applied BEFORE regex)
const ABBREVIATION_MAP = Object.freeze({
  'ibv': 'isolation ball valve',
  'mov': 'motor operated valve',
  'aov': 'air operated valve',
  'sdv': 'shut down valve',
  'bv': 'ball valve',
  'gv': 'gate valve',
  'glv': 'globe valve',
  'cv': 'check valve',
  'btfv': 'butterfly valve',
  'bfv': 'butterfly valve',
  'pv': 'plug valve',
  'nrv': 'non return valve',
  'srv': 'safety valve',
  'prv': 'pressure relief valve',
  'fb': 'full bore',
  'rb': 'reduced bore',
  'fp': 'full port',
  'rp': 'regular port',
  'bw': 'butt weld',
  'sw': 'socket weld',
  'fe': 'flanged',
  'flg': 'flanged',
  'scr': 'screwed',
  'thd': 'threaded',
  // BOQ table abbreviations
  'vlv': 'valve',
  'chk': 'check',
  'bol': 'bolted',
  'tru': 'trunnion',
  'hov': 'hand operated valve',
  'rtj': 'ring type joint',
  'rf': 'raised face'
});

// Concatenated valve type patterns (no space between words)
const CONCAT_VALVE_PATTERNS = [
  { pattern: /ballvalve/gi, replacement: 'ball valve' },
  { pattern: /gatevalve/gi, replacement: 'gate valve' },
  { pattern: /globevalve/gi, replacement: 'globe valve' },
  { pattern: /checkvalve/gi, replacement: 'check valve' },
  { pattern: /butterflyvalve/gi, replacement: 'butterfly valve' },
  { pattern: /plugvalve/gi, replacement: 'plug valve' },
  { pattern: /controlvalve/gi, replacement: 'control valve' },
  { pattern: /needlevalve/gi, replacement: 'needle valve' },
  { pattern: /safetyvalve/gi, replacement: 'safety valve' },
  { pattern: /nonreturnvalve/gi, replacement: 'non return valve' },
  { pattern: /buttweld/gi, replacement: 'butt weld' },
  { pattern: /socketweld/gi, replacement: 'socket weld' },
  { pattern: /fullbore/gi, replacement: 'full bore' },
  { pattern: /reducedbore/gi, replacement: 'reduced bore' },
  { pattern: /fullport/gi, replacement: 'full port' },
  { pattern: /regularport/gi, replacement: 'regular port' },
  { pattern: /raisedface/gi, replacement: 'raised face' },
  { pattern: /flatface/gi, replacement: 'flat face' },
  { pattern: /ringtypejoint/gi, replacement: 'ring type joint' }
];

class Tokenizer {
  /**
   * Normalizes raw RFQ text for improved regex matching.
   * @param {string} rawText Original document/email text
   * @returns {string} Tokenized and normalized text
   */
  tokenize(rawText) {
    if (!rawText || typeof rawText !== 'string') return '';

    let text = rawText;

    // Step 1: Normalize unicode and whitespace
    text = text.replace(/\u00A0/g, ' ');     // non-breaking spaces
    text = text.replace(/[\r\n]+/g, '\n');    // normalize line endings
    text = text.replace(/\t/g, ' ');          // tabs to spaces

    // Step 2: Normalize quotes and special characters
    text = text.replace(/[""]/g, '"');
    text = text.replace(/['']/g, "'");

    // Step 3: Normalize inch markers (various unicode quotes → standard ")
    text = text.replace(/(\d)\s*[""″‶‴]/g, '$1"');

    // Step 3.5: Expand BOQ slash abbreviations BEFORE the generic slash splitter
    // These are specific to industrial BOQ tables and must be handled first
    const SLASH_ABBREVIATIONS = {
      'F/F': 'flanged',
      'f/f': 'flanged',
      'W/W': 'weld end',
      'w/w': 'weld end',
      'A/G': 'above ground',
      'a/g': 'above ground',
      'B/W': 'butt weld',
      'b/w': 'butt weld',
      'S/W': 'socket weld',
      's/w': 'socket weld'
    };
    for (const [abbr, expansion] of Object.entries(SLASH_ABBREVIATIONS)) {
      text = text.split(abbr).join(expansion);
    }

    // Step 4: Expand hyphen/slash-separated compound terms
    // "BALL-VALVE" → "BALL VALVE", "BALL/GATE" → "BALL GATE"
    text = text.replace(/(\w+)\s*[-\/]\s*(\w+)/g, (match, a, b) => {
      // Don't split numbers like "1-1/2" or "A350-LF2"
      if (/^\d/.test(a) && /^\d/.test(b)) return match;
      if (/^[A-Z]\d+$/i.test(a)) return match; // Material codes like A350-LF2
      return `${a} ${b}`;
    });

    // Step 5: Expand concatenated valve type patterns
    for (const { pattern, replacement } of CONCAT_VALVE_PATTERNS) {
      text = text.replace(pattern, replacement);
    }

    // Step 6: Normalize size notations
    // "DN100" → "DN 100"
    text = text.replace(/\b(DN|dn|Dn)(\d+)\b/g, '$1 $2');
    // "CL300" or "CL-300" → "Class 300"
    text = text.replace(/\bCL[\s-]*(\d+)\b/gi, 'Class $1');
    // "NPS4" → "NPS 4"
    text = text.replace(/\b(NPS|nps)(\d+)\b/g, '$1 $2');
    // "4IN" or "4in" → '4 inch'
    text = text.replace(/\b(\d+(?:\.\d+)?)\s*(?:IN|in)\b/g, '$1 inch');
    // "150LBS" → "150 lbs"
    text = text.replace(/\b(\d+)\s*(?:LBS|lbs|Lbs)\b/g, '$1 lbs');

    // Step 7: Expand standalone abbreviations (whole word match only)
    // Only expand if surrounded by word boundaries and not part of larger word
    const words = text.split(/(\s+)/);
    const expandedWords = words.map(word => {
      const lower = word.toLowerCase().replace(/[^a-z]/g, '');
      if (ABBREVIATION_MAP[lower]) {
        return ABBREVIATION_MAP[lower];
      }
      return word;
    });
    text = expandedWords.join('');

    // Step 8: Collapse multiple spaces
    text = text.replace(/  +/g, ' ');

    return text.trim();
  }

  /**
   * Tokenizes text while preserving original for source attribution.
   * @param {string} rawText 
   * @returns {{ original: string, tokenized: string }}
   */
  tokenizeWithOriginal(rawText) {
    return {
      original: rawText || '',
      tokenized: this.tokenize(rawText)
    };
  }
}

module.exports = new Tokenizer();
