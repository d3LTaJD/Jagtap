/**
 * DependencyRuleEngine
 * Enforces cross-field structural dependency rules.
 * Example: `if (valve_type !== 'Ball Valve') ball_type = null;`
 */

class DependencyRuleEngine {
  /**
   * Applies conditional taxonomy rules across field extractions dictionary.
   * @param {Object} fieldsDictionary Map of fieldId -> EngineeringField
   */
  applyRules(fieldsDictionary) {
    if (!fieldsDictionary || typeof fieldsDictionary !== 'object') return fieldsDictionary;

    const result = { ...fieldsDictionary };
    const valveTypeField = result['valve_type'];
    const valveType = valveTypeField?.normalizedValue;

    // Rule 1: Non-Ball Valve fields must nullify ball-specific properties
    if (valveType && valveType !== 'Ball Valve') {
      if (result['ball_type']) {
        result['ball_type'] = this.nullifyField(result['ball_type'], `Nullified because valve_type is ${valveType}`);
      }
      if (result['seat_type'] && valveType === 'Check Valve') {
        // Check valves use disc, not soft ball seats
        result['seat_type'] = this.nullifyField(result['seat_type'], `Nullified because Check Valves do not use soft ball seats`);
      }
    }

    // Rule 2: Check Valves do not have manual operators (handwheel/gearbox)
    if (valveType === 'Check Valve' && result['valve_operating']) {
      result['valve_operating'] = this.nullifyField(result['valve_operating'], 'Check Valves are self-operating line valves');
    }

    return result;
  }

  nullifyField(field, reason) {
    if (!field) return null;
    return {
      ...field,
      rawValue: null,
      normalizedValue: null,
      validationState: 'NOT_FOUND',
      reasoning: [...(field.reasoning || []), `DependencyRuleEngine: ${reason}`]
    };
  }
}

module.exports = new DependencyRuleEngine();
