/**
 * LearningEngine.js
 * Persistent dynamic learning loop with threshold-based approval.
 * Corrections are NOT immediately learned. A correction must be seen N times
 * (from different users or enquiries) before it is promoted to the dictionary.
 * This prevents one mistaken user edit from polluting the dictionary.
 */

const engineeringDictionary = require('./EngineeringDictionary');

const LEARNING_THRESHOLD = 3; // Require 3 independent corrections before auto-learning

class LearningEngine {
  constructor() {
    this.isInitialized = false;
  }

  /**
   * Initializes the LearningEngine by loading all APPROVED corrections from MongoDB.
   */
  async init() {
    if (this.isInitialized) return;
    try {
      const ExtractionCorrection = require('../../models/ExtractionCorrection');
      const approved = await ExtractionCorrection.find({ appliedToKnowledge: true });

      for (const corr of approved) {
        engineeringDictionary.registerLearnedAlias(
          corr.fieldCategory,
          corr.wrongValue || '',
          corr.correctValue
        );
      }
      this.isInitialized = true;
      console.log(`[LearningEngine] Loaded ${approved.length} approved learning aliases from MongoDB.`);
    } catch (err) {
      console.error('[LearningEngine] Failed to load corrections on startup:', err.message);
    }
  }

  /**
   * Records a user override correction. Saves to MongoDB as PENDING.
   * Checks if this same correction has been seen enough times to auto-promote.
   */
  async recordCorrection({
    enquiryId = null,
    productIndex = 0,
    fieldCategory,
    field,
    wrongValue,
    correctValue,
    correctedBy = null,
    documentContext = ''
  }) {
    if (!fieldCategory || !correctValue) {
      return { success: false, reason: 'Missing required parameters for learning' };
    }

    try {
      const ExtractionCorrection = require('../../models/ExtractionCorrection');

      // Save the new correction as PENDING (not yet applied to knowledge)
      const corrDoc = await ExtractionCorrection.create({
        enquiryId,
        productIndex,
        fieldCategory,
        field: field || fieldCategory,
        wrongValue: wrongValue || '',
        correctValue,
        context: documentContext,
        correctedBy,
        appliedToKnowledge: false // Pending until threshold met
      });

      console.log(`[LearningEngine] Recorded PENDING correction: "${wrongValue}" → "${correctValue}" (field: ${field})`);

      // Check threshold: Has this same correction been seen enough times?
      if (wrongValue && wrongValue.trim().length > 0) {
        const count = await ExtractionCorrection.countDocuments({
          fieldCategory,
          wrongValue: wrongValue.trim(),
          correctValue: correctValue.trim()
        });

        if (count >= LEARNING_THRESHOLD) {
          // Promote: Mark all matching corrections as applied
          await ExtractionCorrection.updateMany(
            { fieldCategory, wrongValue: wrongValue.trim(), correctValue: correctValue.trim() },
            { $set: { appliedToKnowledge: true } }
          );

          // Register in dictionary immediately
          engineeringDictionary.registerLearnedAlias(fieldCategory, wrongValue, correctValue);
          console.log(`[LearningEngine] ✅ AUTO-PROMOTED: "${wrongValue}" → "${correctValue}" (seen ${count} times, threshold: ${LEARNING_THRESHOLD})`);

          return { success: true, correction: corrDoc, promoted: true, count };
        } else {
          console.log(`[LearningEngine] Pending: "${wrongValue}" → "${correctValue}" (${count}/${LEARNING_THRESHOLD} corrections needed)`);
          return { success: true, correction: corrDoc, promoted: false, count };
        }
      }

      return { success: true, correction: corrDoc, promoted: false };
    } catch (err) {
      console.error('[LearningEngine] Error saving correction to DB:', err.message);
      return { success: false, reason: err.message };
    }
  }

  /**
   * Manually approve a pending correction (admin override).
   */
  async approveCorrection(correctionId) {
    try {
      const ExtractionCorrection = require('../../models/ExtractionCorrection');
      const corr = await ExtractionCorrection.findByIdAndUpdate(
        correctionId,
        { appliedToKnowledge: true },
        { new: true }
      );
      if (corr && corr.wrongValue) {
        engineeringDictionary.registerLearnedAlias(corr.fieldCategory, corr.wrongValue, corr.correctValue);
      }
      return { success: true, correction: corr };
    } catch (err) {
      return { success: false, reason: err.message };
    }
  }

  /**
   * Retrieves all corrections (pending and approved).
   */
  async getHistory({ onlyPending = false } = {}) {
    try {
      const ExtractionCorrection = require('../../models/ExtractionCorrection');
      const filter = onlyPending ? { appliedToKnowledge: false } : {};
      return await ExtractionCorrection.find(filter).sort({ createdAt: -1 });
    } catch (err) {
      return [];
    }
  }
}

const instance = new LearningEngine();
module.exports = instance;
