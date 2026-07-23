/**
 * ProductIdentity
 * Generates immutable structural product keys and hashes.
 * Ensures items are never accidentally merged based on matching description alone.
 */

const crypto = require('crypto');

class ProductIdentity {
  /**
   * Generates a composite immutable product identity object and SHA-256 hash.
   * @param {Object} params Product position and specification parameters.
   */
  generateIdentity({
    documentId = 'DOC-UNKNOWN',
    pageNumber = 1,
    tableId = null,
    rowIndex = null,
    columnIndex = null,
    itemNumber = null,
    rawDescription = '',
    specifications = {}
  }) {
    const normDesc = String(rawDescription).toLowerCase().replace(/[^a-z0-9]/g, '');
    const normSize = String(specifications.valve_size || '').toLowerCase();
    const normClass = String(specifications.valve_class || '').toLowerCase();
    const normMaterial = String(specifications.shellMaterial || '').toLowerCase();
    const normConn = String(specifications.endConnection || '').toLowerCase();

    // Composite key components
    const structuralKey = `${documentId}:P${pageNumber}:${tableId || 'NOTBL'}:R${rowIndex || 0}:C${columnIndex || 0}:ITEM${itemNumber || 0}`;
    const engineeringKey = `${normDesc}|${normSize}|${normClass}|${normMaterial}|${normConn}`;

    // SHA-256 fingerprint hash
    const hash = crypto
      .createHash('sha256')
      .update(`${structuralKey}::${engineeringKey}`)
      .digest('hex');

    return Object.freeze({
      documentId,
      pageNumber,
      tableId,
      rowIndex,
      columnIndex,
      itemNumber,
      structuralKey,
      engineeringKey,
      hash
    });
  }

  /**
   * Checks whether two product identities can safely be merged.
   * Only returns true if structural or exact composite fingerprints match 100%.
   */
  canMerge(identityA, identityB) {
    if (!identityA || !identityB) return false;
    return identityA.hash === identityB.hash;
  }
}

module.exports = new ProductIdentity();
