/**
 * NegationDetector.js
 * Deterministic helper for detecting negation, exclusion, prohibition, and ambiguity
 * in engineering specifications and RFQ line items.
 */

class NegationDetector {
  /**
   * Checks if a target phrase or match in textContext is negated.
   * @param {string} textContext Full text snippet
   * @param {string|number} target Either the target substring or its start index
   * @param {number} length Length of the match if index is provided
   * @returns {{ isNegated: boolean, reason: string }}
   */
  isNegated(textContext, target, length = 0) {
    if (!textContext || typeof textContext !== 'string') {
      return { isNegated: false, reason: '' };
    }

    let startIndex = -1;
    let matchLen = 0;

    if (typeof target === 'number') {
      startIndex = target;
      matchLen = length;
    } else if (typeof target === 'string') {
      startIndex = textContext.toLowerCase().indexOf(target.toLowerCase());
      matchLen = target.length;
    }

    if (startIndex === -1) {
      return { isNegated: false, reason: '' };
    }

    // Extract local context window (up to 50 chars before and 50 chars after)
    const windowBefore = textContext.substring(Math.max(0, startIndex - 50), startIndex);
    const windowAfter = textContext.substring(startIndex + matchLen, Math.min(textContext.length, startIndex + matchLen + 50));

    // Post-negation patterns (e.g. "Pneumatic actuator not required", "Flanged connection is not permitted", "Socket weld excluded")
    const postNegationPattern = /^\s*[:=,-]?\s*(?:connection|actuator|type|valve|end|ends|operation|size|rating|operator)?\s*(?:is\s+|are\s+|shall\s+be\s+)?(?:not\s+required|not\s+permitted|not\s+allowed|not\s+applicable|prohibited|excluded|exclude|not\s+in\s+scope|shall\s+not|never\s+used|not\s+acceptable|is\s+excluded)/i;
    if (postNegationPattern.test(windowAfter)) {
      const matched = windowAfter.match(postNegationPattern)[0].trim();
      return { isNegated: true, reason: `Negated by post-modifier: "${matched}"` };
    }

    // Pre-negation patterns (e.g. "without pneumatic", "no socket weld", "excluding flanged", "not permitted: gate valve")
    const preNegationPattern = /(?:without|excluding|exclude|no|not\s+permitted|not\s+allowed|prohibit|prohibited|shall\s+not\s+(?:use|have|be)|never|except\s+for|do\s+not\s+use)\s*[:=,-]?\s*(?:connection|actuator|type|valve|end|ends|operation|size|rating|operator)?\s*$/i;
    if (preNegationPattern.test(windowBefore)) {
      const matched = windowBefore.match(preNegationPattern)[0].trim();
      return { isNegated: true, reason: `Negated by pre-modifier: "${matched}"` };
    }

    return { isNegated: false, reason: '' };
  }

  /**
   * Checks if a phrase is ambiguous (e.g. "Ball valve / Gate valve alternative", "Flanged or Butt Weld").
   * @param {string} textContext Full text snippet or document
   * @param {Array<string>} candidateValues Semantic candidate options to check
   * @param {number} matchIndex Optional index of the match to check local neighborhood
   * @param {number} matchLength Optional length of the match
   * @returns {{ isAmbiguous: boolean, reason: string }}
   */
  isAmbiguous(textContext, candidateValues = [], matchIndex = -1, matchLength = 0) {
    if (!textContext || typeof textContext !== 'string') {
      return { isAmbiguous: false, reason: '' };
    }

    // Determine the relevant scope of text to evaluate for ambiguity.
    // If a matchIndex is provided, evaluate the immediate neighborhood (+/- 60 chars).
    // If no matchIndex is provided, evaluate only a short scoped string (< 250 chars).
    // NEVER run generic ambiguity checks across entire multi-page documents!
    let localScope = textContext;
    if (matchIndex >= 0) {
      const start = Math.max(0, matchIndex - 60);
      const end = Math.min(textContext.length, matchIndex + matchLength + 60);
      localScope = textContext.substring(start, end);
    } else if (textContext.length > 250) {
      localScope = textContext.substring(0, 250);
    }

    const lower = localScope.toLowerCase();

    // Check candidate conflicting values only if there are 2 or more DIFFERENT semantic candidates
    if (candidateValues && candidateValues.length > 1) {
      // Filter out duplicate or equivalent representations (e.g. ['4"', '100 mm'] or ['300', '300#'])
      const uniqueVals = [...new Set(candidateValues.map(v => String(v).trim().toLowerCase()).filter(Boolean))];
      if (uniqueVals.length > 1) {
        const escaped = uniqueVals.map(c => c.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
        const slashPattern = new RegExp(`(?:${escaped.join('|')})\\s*[/|]\\s*(?:${escaped.join('|')})`, 'i');
        const orPattern = new RegExp(`(?:${escaped.join('|')})\\s+(?:or|alternative|optional|either)\\s+(?:${escaped.join('|')})`, 'i');
        if (slashPattern.test(lower) || orPattern.test(lower)) {
          return { isAmbiguous: true, reason: `Multiple conflicting options specified in local context: ${uniqueVals.join(', ')}` };
        }
      }
    }

    return { isAmbiguous: false, reason: '' };
  }

  /**
   * Checks if a size/dimension match belongs to non-valve equipment (gasket, flange, pipe, bolt).
   * @param {string} textContext 
   * @param {number} matchIndex 
   * @returns {{ isNonValve: boolean, prefix: string }}
   */
  isNonValveEquipmentContext(textContext, matchIndex) {
    if (!textContext || matchIndex < 0) return { isNonValve: false, prefix: '' };

    const prefix = textContext.substring(Math.max(0, matchIndex - 30), matchIndex).toLowerCase();
    const nonValveKeywords = ['gasket', 'flange', 'pipe', 'piping', 'bolt', 'nut', 'stud', 'tube', 'tubing', 'orifice', 'plate', 'washer'];

    for (const kw of nonValveKeywords) {
      const regex = new RegExp(`\\b${kw}\\s*[:=]?\\s*$`, 'i');
      if (regex.test(prefix)) {
        return { isNonValve: true, prefix: kw };
      }
    }

    return { isNonValve: false, prefix: '' };
  }
}

module.exports = new NegationDetector();
