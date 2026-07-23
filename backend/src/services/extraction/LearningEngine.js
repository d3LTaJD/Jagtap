/**
 * LearningEngine
 * Dynamic learning loop for capturing human overrides from sales engineers.
 * Automatically learns new alias synonyms and registers them into KnowledgeEngine.
 */

const knowledgeEngine = require('./KnowledgeEngine');

class LearningEngine {
  constructor() {
    this.learnedAliases = [];
  }

  /**
   * Records a user override correction and registers a learned alias.
   * @param {Object} params Correction details.
   */
  recordCorrection({
    fieldCategory, // 'material', 'class', 'connection', 'valve'
    rawToken,
    userSelectedCanonical,
    userId = 'SYSTEM_USER',
    documentContext = ''
  }) {
    if (!fieldCategory || !rawToken || !userSelectedCanonical) {
      return { success: false, reason: 'Missing required parameters for learning' };
    }

    const learnedEntry = {
      fieldCategory,
      rawToken,
      userSelectedCanonical,
      userId,
      documentContext,
      timestamp: new Date()
    };

    this.learnedAliases.push(learnedEntry);

    // Register alias immediately into KnowledgeEngine memory
    knowledgeEngine.registerLearnedAlias(fieldCategory, rawToken, userSelectedCanonical);

    return {
      success: true,
      learnedEntry
    };
  }

  /**
   * Retrieves all learned alias history.
   */
  getHistory() {
    return [...this.learnedAliases];
  }
}

module.exports = new LearningEngine();
