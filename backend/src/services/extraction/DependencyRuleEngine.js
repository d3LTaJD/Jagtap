/**
 * DependencyRuleEngine
 * Enforces cross-field structural dependency and impossibility rules.
 * Catches engineering combinations that are physically impossible or extremely unusual.
 */

const { VALIDATION_STATES } = require('../../types/EngineeringField');

// Cross-field impossibility rules table
const IMPOSSIBILITY_RULES = [
  {
    id: 'BUTTERFLY_MAX_CLASS',
    description: 'Butterfly valves are typically not available above 900#',
    condition: (fields) => {
      const type = fields.valve_type?.normalizedValue;
      const cls = fields.valve_class?.normalizedValue;
      if (type !== 'Butterfly Valve' || !cls) return false;
      const num = parseInt(cls);
      return num > 900;
    },
    action: 'AMBIGUOUS',
    field: 'valve_class',
    reason: 'Butterfly Valves are typically not manufactured in Class 1500# or 2500#. Please verify.'
  },
  {
    id: 'CHECK_VALVE_NO_OPERATOR',
    description: 'Check valves are self-acting and do not have manual operators',
    condition: (fields) => {
      const type = fields.valve_type?.normalizedValue;
      const op = fields.valve_operating?.normalizedValue;
      return type === 'Check Valve' && op != null;
    },
    action: 'NULLIFY',
    field: 'valve_operating',
    reason: 'Check Valves are self-operating line valves and do not use handwheels/gearboxes.'
  },
  {
    id: 'BALL_VALVE_MAX_SIZE',
    description: 'Ball valves above 900mm are extremely uncommon',
    condition: (fields) => {
      const type = fields.valve_type?.normalizedValue;
      const size = fields.valve_size?.normalizedValue;
      if (type !== 'Ball Valve' || !size) return false;
      const mm = parseInt(size);
      return !isNaN(mm) && mm > 900;
    },
    action: 'AMBIGUOUS',
    field: 'valve_size',
    reason: 'Ball Valves above 900mm (36") are extremely uncommon. Please verify size.'
  },
  {
    id: 'GATE_VALVE_NO_WAFER',
    description: 'Gate valves are not manufactured in wafer style',
    condition: (fields) => {
      const type = fields.valve_type?.normalizedValue;
      const conn = fields.endConnection?.normalizedValue;
      return type === 'Gate Valve' && conn === 'Wafer';
    },
    action: 'AMBIGUOUS',
    field: 'endConnection',
    reason: 'Gate Valves are not manufactured in Wafer end connection. Wafer is for Butterfly/Check valves.'
  },
  {
    id: 'SAFETY_VALVE_NO_BORE',
    description: 'Safety/Relief valves do not have bore type specifications',
    condition: (fields) => {
      const type = fields.valve_type?.normalizedValue;
      const bore = fields.valve_bore?.normalizedValue;
      return (type === 'Safety Valve' || type === 'Pressure Relief Valve') && bore != null;
    },
    action: 'NULLIFY',
    field: 'valve_bore',
    reason: 'Safety/Relief Valves do not have Full Bore/Reduced Bore specifications.'
  },
  {
    id: 'NON_BALL_NO_BALL_TYPE',
    description: 'Non-Ball valves do not have ball type properties',
    condition: (fields) => {
      const type = fields.valve_type?.normalizedValue;
      const bt = fields.ball_type?.normalizedValue;
      return type && type !== 'Ball Valve' && bt != null;
    },
    action: 'NULLIFY',
    field: 'ball_type',
    reason: `Nullified because valve is not a Ball Valve.`
  },
  {
    id: 'SMALL_SIZE_NO_FLANGE',
    description: 'Sizes below 15mm (1/2") are typically screwed, not flanged',
    condition: (fields) => {
      const size = fields.valve_size?.normalizedValue;
      const conn = fields.endConnection?.normalizedValue;
      if (!size || !conn) return false;
      const mm = parseInt(size);
      return !isNaN(mm) && mm < 15 && conn === 'Flanged';
    },
    action: 'AMBIGUOUS',
    field: 'endConnection',
    reason: 'Sizes below 15mm (1/2") are typically screwed/threaded, not flanged. Please verify.'
  }
];

class DependencyRuleEngine {
  /**
   * Applies conditional taxonomy and impossibility rules across field extractions.
   * @param {Object} fieldsDictionary Map of fieldId -> EngineeringField
   * @returns {Object} Updated fields with impossibility flags
   */
  applyRules(fieldsDictionary) {
    if (!fieldsDictionary || typeof fieldsDictionary !== 'object') return fieldsDictionary;

    const result = { ...fieldsDictionary };
    const violations = [];

    for (const rule of IMPOSSIBILITY_RULES) {
      try {
        if (rule.condition(result)) {
          if (rule.action === 'NULLIFY') {
            result[rule.field] = this.nullifyField(result[rule.field], rule.reason);
          } else if (rule.action === 'AMBIGUOUS') {
            result[rule.field] = this.flagAmbiguous(result[rule.field], rule.reason);
          }
          violations.push({ ruleId: rule.id, field: rule.field, reason: rule.reason, action: rule.action });
        }
      } catch (err) {
        // Rule evaluation error — skip silently
      }
    }

    // Attach violations metadata for audit
    result._crossFieldViolations = violations;

    return result;
  }

  nullifyField(field, reason) {
    if (!field) return null;
    return {
      ...field,
      rawValue: null,
      normalizedValue: null,
      validationState: VALIDATION_STATES?.NOT_FOUND || 'NOT_FOUND',
      reasoning: [...(field.reasoning || []), `DependencyRuleEngine: ${reason}`]
    };
  }

  flagAmbiguous(field, reason) {
    if (!field) return field;
    return {
      ...field,
      validationState: VALIDATION_STATES?.AMBIGUOUS || 'AMBIGUOUS',
      reasoning: [...(field.reasoning || []), `DependencyRuleEngine [CROSS-FIELD WARNING]: ${reason}`]
    };
  }
}

module.exports = new DependencyRuleEngine();
