/**
 * EvidenceEngine
 * Merges and correlates extraction evidence across multi-document RFQ inputs.
 * Calculates document authority and multi-document agreement percentages.
 */

const { DOCUMENT_AUTHORITY_WEIGHTS } = require('../../types/EngineeringField');

class EvidenceEngine {
  constructor() {
    this.evidenceStore = new Map(); // fieldId -> Array of Evidence
  }

  /**
   * Adds evidence for a specific field.
   */
  addEvidence(fieldId, evidenceItem) {
    if (!this.evidenceStore.has(fieldId)) {
      this.evidenceStore.set(fieldId, []);
    }
    const currentList = this.evidenceStore.get(fieldId);
    
    // Assign document authority weight
    const docType = String(evidenceItem.documentType || '').toUpperCase();
    const authority = DOCUMENT_AUTHORITY_WEIGHTS[docType] || DOCUMENT_AUTHORITY_WEIGHTS.EMAIL_BODY;

    currentList.push({
      ...evidenceItem,
      authority,
      timestamp: new Date()
    });
  }

  /**
   * Analyzes accumulated evidence for a field and calculates consensus/agreement.
   * @param {string} fieldId 
   */
  evaluateFieldEvidence(fieldId) {
    const evidenceList = this.evidenceStore.get(fieldId) || [];
    if (evidenceList.length === 0) {
      return {
        hasEvidence: false,
        consensusValue: null,
        agreementScore: 0,
        highestAuthority: 0,
        evidence: []
      };
    }

    // Group evidence by normalized value
    const valueGroups = new Map();
    let maxAuthority = 0;

    evidenceList.forEach(item => {
      const val = item.normalizedValue;
      if (!val) return;

      if (item.authority > maxAuthority) {
        maxAuthority = item.authority;
      }

      if (!valueGroups.has(val)) {
        valueGroups.set(val, {
          normalizedValue: val,
          totalAuthorityScore: 0,
          count: 0,
          items: []
        });
      }

      const group = valueGroups.get(val);
      group.totalAuthorityScore += item.authority;
      group.count += 1;
      group.items.push(item);
    });

    if (valueGroups.size === 0) {
      return {
        hasEvidence: false,
        consensusValue: null,
        agreementScore: 0,
        highestAuthority: maxAuthority,
        evidence: evidenceList
      };
    }

    // Find value group with highest combined authority score
    let winningGroup = null;
    let totalVotes = 0;

    for (const group of valueGroups.values()) {
      totalVotes += group.count;
      if (!winningGroup || group.totalAuthorityScore > winningGroup.totalAuthorityScore) {
        winningGroup = group;
      }
    }

    const agreementScore = Math.round((winningGroup.count / totalVotes) * 100);

    return {
      hasEvidence: true,
      consensusValue: winningGroup.normalizedValue,
      agreementScore,
      highestAuthority: maxAuthority,
      winningGroup,
      totalEvidenceCount: evidenceList.length,
      evidence: evidenceList
    };
  }

  clear() {
    this.evidenceStore.clear();
  }
}

module.exports = EvidenceEngine;
