const Counter = require('../models/Counter');

/**
 * Atomically increments and returns the next sequence number for a given key.
 * If the key doesn't exist, it initializes it with 1.
 * 
 * @param {string} sequenceName The unique identifier name for the counter (e.g. prefix)
 * @returns {Promise<number>} The next sequence number
 */
exports.getNextSequenceValue = async (sequenceName) => {
  const sequenceDocument = await Counter.findOneAndUpdate(
    { _id: sequenceName },
    { $inc: { seq: 1 } },
    { new: true, upsert: true }
  );
  return sequenceDocument.seq;
};
