/**
 * Centralized Normalization Service
 * Single source of truth for engineering field normalization, unit conversions,
 * option dropdown matching, and value canonicalization across the backend architecture.
 */

const knowledgeEngine = require('./KnowledgeEngine');

class NormalizationService {
  normalizeField(fieldId, rawValue) {
    if (rawValue === null || rawValue === undefined || rawValue === '') {
      return null;
    }

    const strVal = String(rawValue).trim();

    switch (fieldId) {
      case 'valve_size':
      case 'size':
        return knowledgeEngine.normalizeSize(strVal);

      case 'valve_class':
      case 'pressure_class':
      case 'class':
        return knowledgeEngine.normalizeClass(strVal);

      case 'endConnection':
      case 'valve_ends':
        return knowledgeEngine.normalizeEndConnection(strVal);

      case 'shellMaterial':
      case 'bodyMaterial':
      case 'materialGrade':
        return knowledgeEngine.normalizeMaterial(strVal);

      case 'valve_type':
        return knowledgeEngine.normalizeValveType(strVal);

      default:
        return strVal;
    }
  }

  /**
   * Validates and normalizes extracted fields dictionary against field definitions.
   * Single source of truth for dropdown option matching, numerical equality size matching, and type casting.
   */
  normalizeExtractedFields(data, fieldDefinitions) {
    if (!data || typeof data !== 'object') return {};
    if (!fieldDefinitions || !Array.isArray(fieldDefinitions)) return {};

    const normalized = {};
    for (const f of fieldDefinitions) {
      const key = f.fieldName;
      let rawInput = data[key];

      let val = null;
      let confidence = 90;
      let sourcePage = null;

      if (rawInput !== undefined && rawInput !== null) {
        if (typeof rawInput === 'object' && rawInput !== null && rawInput.value !== undefined) {
          val = rawInput.value;
          confidence = parseInt(rawInput.confidence, 10);
          if (isNaN(confidence)) confidence = 90;
          sourcePage = (rawInput.sourcePage !== undefined && rawInput.sourcePage !== null) ? parseInt(rawInput.sourcePage, 10) : null;
          if (isNaN(sourcePage)) sourcePage = null;
        } else {
          val = rawInput;
          confidence = 90;
          sourcePage = null;
        }
      }

      const nullResult = {
        value: null,
        confidence: 0,
        sourcePage: null
      };

      if (val === undefined || val === null) {
        normalized[key] = nullResult;
        continue;
      }

      const lowerKey = key.toLowerCase();
      const lowerLabel = (f.fieldLabel || '').toLowerCase();
      const isSizeField = lowerKey.includes('size') || lowerLabel.includes('size');
      const isPressureField = lowerKey.includes('pressure') || lowerKey.includes('class') || lowerKey.includes('bar') || lowerLabel.includes('pressure') || lowerLabel.includes('class') || lowerLabel.includes('bar');
      const isMocOrActuatorField = lowerKey.includes('moc') || lowerKey.includes('material') || lowerKey.includes('actuator') || lowerKey.includes('actuation') || lowerLabel.includes('moc') || lowerLabel.includes('material') || lowerLabel.includes('actuator') || lowerLabel.includes('actuation');

      // 1. Size Pre-normalization & Validation
      if (isSizeField) {
        const canonicalSize = knowledgeEngine.normalizeSize(val);
        if (canonicalSize) {
          val = canonicalSize;
        }

        const sizeInMm = Number(val);
        if (!isNaN(sizeInMm)) {
          if (sizeInMm < 15 || sizeInMm > 2000) {
            console.warn(`[NormalizationService] Rejecting size outside 15mm-2000mm range: ${val}`);
            normalized[key] = nullResult;
            continue;
          }
        }
      }

      // 2. Pressure Class/Rating Validation
      if (isPressureField) {
        const clean = String(val).toLowerCase().replace(/[^0-9.]/g, '').trim();
        const num = Number(clean);
        if (!isNaN(num) && num > 0) {
          const isStrictClass = lowerKey.includes('class') || lowerLabel.includes('class');
          if (isStrictClass) {
            if (num < 150 || num > 4500) {
              console.warn(`[NormalizationService] Rejecting class rating outside 150#-4500# range: ${val}`);
              normalized[key] = nullResult;
              continue;
            }
          }
        }
      }

      // 3. MOC / Material text integrity
      if (isMocOrActuatorField) {
        const sVal = String(val).trim();
        const cleanLower = sVal.toLowerCase();

        // Reject schedule identifiers masquerading as materials.
        // "MS ST for Sch 8" is a schedule identifier, not a material grade.
        const isScheduleId = /\bfor\s+sch(?:edule)?\s*\d+/i.test(sVal) ||
                             /\bms\s+st\b.*\bsch/i.test(sVal) ||
                             /\bsch(?:edule)?[\s\-]*\d+/i.test(sVal);
        if (isScheduleId) {
          console.warn(`[NormalizationService] Rejecting schedule identifier as material for field ${key}: "${sVal}"`);
          normalized[key] = nullResult;
          continue;
        }

        const isJunk = ['unknown', 'n/a', 'na', 'none', 'not specified'].includes(cleanLower);
        if (isJunk) {
          console.warn(`[NormalizationService] Rejecting junk text for field ${key}: "${sVal}"`);
          normalized[key] = nullResult;
          continue;
        }
      }

      // 4. Dropdown Option matching
      if ((f.fieldType === 'Dropdown' || f.fieldType === 'Dropdown (Single)') && f.options && f.options.length) {
        let matchVal = val;
        const normalizeStr = s => String(s).toLowerCase().replace(/[^a-z0-9]/g, '');
        const valNormalized = normalizeStr(val);

        const directMatch = f.options.find(opt => normalizeStr(opt) === valNormalized);
        if (directMatch) {
          matchVal = directMatch;
        } else if (isSizeField) {
          const cleanSize = knowledgeEngine.normalizeSize(val);
          if (cleanSize) matchVal = cleanSize;
        }

        const isNumericDropdown = f.options.every(opt => !/[a-zA-Z]/.test(String(opt)));

        const matchedOpt = f.options.find(opt => {
          const nOpt = normalizeStr(opt);
          const nVal = normalizeStr(matchVal);

          if (nOpt === nVal) return true;

          // Numerical equality match for size/number dropdowns
          const numOpt = Number(nOpt.replace(/[^0-9]/g, ''));
          const numVal = Number(nVal.replace(/[^0-9]/g, ''));
          if (!isNaN(numOpt) && !isNaN(numVal) && numOpt > 0 && numOpt === numVal) return true;

          if (isNumericDropdown) return false;

          if (nVal === 'sw' && nOpt.includes('socketweld')) return true;
          if (nVal === 'bw' && nOpt.includes('buttweld')) return true;
          if (nVal === 'fe' && nOpt.includes('flange')) return true;
          if (nVal.includes('flange') && nOpt.includes('flange')) return true;

          if (nOpt.includes(nVal) || nVal.includes(nOpt)) return true;

          return false;
        });

        if (matchedOpt) {
          normalized[key] = { value: matchedOpt, confidence, sourcePage };
        } else if (key === 'valve_type') {
          const canonicalType = knowledgeEngine.normalizeValveType(val);
          if (canonicalType) {
            normalized[key] = { value: canonicalType, confidence, sourcePage };
          } else {
            console.warn(`[NormalizationService] Option "${val}" not found in options list for ${key}:`, f.options);
            normalized[key] = nullResult;
          }
        } else {
          console.warn(`[NormalizationService] Option "${val}" not found in options list for ${key}:`, f.options);
          normalized[key] = nullResult;
        }
        continue;
      }

      normalized[key] = { value: val, confidence, sourcePage };
    }

    return normalized;
  }
}

module.exports = new NormalizationService();
