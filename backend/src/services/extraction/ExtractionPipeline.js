/**
 * ExtractionPipeline
 * Main Orchestrator for Zero-Hallucination Engineering Extraction.
 * Coordinates Deterministic Regex Extractors, AI Assistant, EngineeringDictionary,
 * ValidationEngine, FieldConfidenceEngine, and RawExtraction/ValidationLog auditing.
 */

const documentLayoutEngine = require('./DocumentLayoutEngine');
const extractorRegistry = require('./ExtractorRegistry');
const EvidenceEngine = require('./EvidenceEngine');
const decisionEngine = require('./DecisionEngine');
const dependencyRuleEngine = require('./DependencyRuleEngine');
const extractionMetrics = require('./ExtractionMetrics');
const engineeringDictionary = require('./EngineeringDictionary');
const validationEngine = require('./ValidationEngine');
const fieldConfidenceEngine = require('./FieldConfidenceEngine');
const tokenizer = require('./Tokenizer');
const consistencyChecker = require('./ConsistencyChecker');

class ExtractionPipeline {
  constructor() {
    // Document-level AI extraction cache.
    // Key: `${enquiryId}::${sortedFieldNamesHash}`
    // Value: AI extraction result object
    // Purpose: When 58 products all have the same 8 missing fields,
    // AI is called ONCE and the result is reused for all products.
    this._aiExtractionCache = new Map();
  }

  /**
   * Clear the AI extraction cache (call between enquiry processing runs).
   */
  clearCache() {
    this._aiExtractionCache.clear();
  }

  /**
   * Processes a document text snippet through the deterministic zero-hallucination extraction pipeline.
   */
  processDocument(rawContent, options = {}) {
    const documentId = options.documentId || `DOC-${Date.now()}`;
    const documentType = options.documentType || 'PURCHASE_RFQ';

    const layout = documentLayoutEngine.parseLayout(rawContent, documentId);

    const fullText = layout.pages
      .flatMap(p => [
        ...p.blocks.map(b => b.text),
        ...p.tables.flatMap(t => t.rows.flatMap(r => r.cells.map(c => c.text)))
      ])
      .join(' ');

    const pluginExtractions = extractorRegistry.runAll(fullText);

    const evidenceEngine = new EvidenceEngine();

    Object.entries(pluginExtractions).forEach(([pluginName, field]) => {
      if (field && field.normalizedValue) {
        evidenceEngine.addEvidence(field.fieldId, {
          documentType,
          sourceDocument: documentId,
          page: field.page || 1,
          extractor: pluginName,
          rawValue: field.rawValue,
          normalizedValue: field.normalizedValue
        });
      }
    });

    const fieldDefinitions = [
      { id: 'valve_size', name: 'Valve Size' },
      { id: 'valve_class', name: 'Pressure Class' },
      { id: 'shellMaterial', name: 'Shell Material' },
      { id: 'valve_type', name: 'Valve Type' },
      { id: 'endConnection', name: 'End Connection' },
      { id: 'designStandard', name: 'Design Standard' },
      { id: 'designPressure', name: 'Design Pressure' },
      { id: 'designTemperature', name: 'Design Temperature' },
      { id: 'quantity', name: 'Quantity' },
      { id: 'tagNumber', name: 'Tag Number' },
      { id: 'drawingNumber', name: 'Drawing Number' }
    ];

    let decisions = {};
    fieldDefinitions.forEach(f => {
      const evalResult = evidenceEngine.evaluateFieldEvidence(f.id);
      decisions[f.id] = decisionEngine.makeDecision(f.id, f.name, evalResult);
    });

    decisions = dependencyRuleEngine.applyRules(decisions);

    extractionMetrics.recordPipelineRun(decisions);

    return {
      documentId,
      layout,
      fields: decisions,
      legacySpecifications: {
        valve_size: decisions.valve_size?.normalizedValue || '',
        valve_class: decisions.valve_class?.normalizedValue || '',
        shellMaterial: decisions.shellMaterial?.normalizedValue || '',
        valve_type: decisions.valve_type?.normalizedValue || '',
        endConnection: decisions.endConnection?.normalizedValue || '',
        designStandard: decisions.designStandard?.normalizedValue || '',
        designPressure: decisions.designPressure?.normalizedValue || '',
        designTemperature: decisions.designTemperature?.normalizedValue || '',
        quantity: decisions.quantity?.normalizedValue || '',
        tagNumber: decisions.tagNumber?.normalizedValue || '',
        drawingNumber: decisions.drawingNumber?.normalizedValue || ''
      }
    };
  }

  /**
   * Production Gated Validation Pipeline:
   * 1. Deterministic Regex Extraction (First)
   * 2. Save Raw Extractions
   * 3. AI Extraction Assistant (Only for missing fields)
   * 4. Validation Engine (Rejects invalid/hallucinated values)
   * 5. Master Data & Engineering Dictionary Normalization
   * 6. Field Confidence Engine Gating
   * 7. Save Validation Logs
   */
  async processProductGatedPipeline({
    textContext,
    fieldDefinitions,
    productDescription = '',
    enquiryId = null,
    productIndex = 0
  }) {
    const RawExtraction = require('../../models/RawExtraction');
    const ValidationLog = require('../../models/ValidationLog');
    const aiService = require('../aiService');

    const rawTextToScan = `${productDescription}\n${textContext}`;

    // STAGE 0: Tokenizer Pre-Processing
    const textToScan = tokenizer.tokenize(rawTextToScan);
    // Also tokenize JUST the product description for scoped extraction
    const productDescTokenized = productDescription ? tokenizer.tokenize(productDescription) : '';

    // STAGE 0.5: Document-Level Consistency Check
    const consistency = consistencyChecker.checkConsistency(textToScan);
    if (!consistency.isConsistent) {
      console.log(`[Zero-Hallucination Pipeline] Multi-item specification variations detected across document (expected for multi-line BOQ):`, consistency.conflicts.map(c => c.message).join('; '));
      extractionMetrics.recordConsistencyConflict();
    }

    // STAGE 1: Deterministic Regex Extraction (Runs FIRST)
    // SCOPED STRATEGY: Run extractors on the product description first to avoid
    // cross-product contamination. Only fall back to full document for missing fields.
    const scopedExtractions = productDescTokenized
      ? extractorRegistry.runAll(productDescTokenized)
      : {};
    const fullExtractions = extractorRegistry.runAll(textToScan);

    // Merge: prefer scoped (product-specific) results over full-document results
    const regexExtractions = {};
    for (const [key, val] of Object.entries(fullExtractions)) {
      regexExtractions[key] = val;
    }
    for (const [key, val] of Object.entries(scopedExtractions)) {
      if (val && val.normalizedValue) {
        regexExtractions[key] = val; // Override with scoped result
      }
    }

    const rawExtractionsToSave = [];
    const validatedDynamicFields = {};
    const fieldConfidences = {};

    // Map regex results to fieldNames
    const regexFieldMap = {};
    Object.entries(regexExtractions).forEach(([extractorId, fieldObj]) => {
      if (fieldObj && fieldObj.fieldId && fieldObj.normalizedValue) {
        regexFieldMap[fieldObj.fieldId] = fieldObj;
      }
    });

    // Process fields defined for this form context
    const fieldsToExtractWithAI = [];

    for (const fDef of fieldDefinitions) {
      const key = fDef.fieldName;
      const lowerKey = key.toLowerCase();

      // Check if regex extracted this field
      let regexMatch = null;
      if (lowerKey.includes('size')) regexMatch = regexFieldMap['valve_size'];
      else if (lowerKey.includes('class') || lowerKey.includes('rating')) regexMatch = regexFieldMap['valve_class'];
      else if (lowerKey.includes('type') && lowerKey.includes('valve')) regexMatch = regexFieldMap['valve_type'];
      else if (lowerKey.includes('material') || lowerKey.includes('moc')) regexMatch = regexFieldMap['shellMaterial'] || regexFieldMap['valve_moc_body'];
      else if (lowerKey.includes('end') || lowerKey.includes('connection')) regexMatch = regexFieldMap['endConnection'] || regexFieldMap['valve_end_connection'];
      else if (lowerKey.includes('operating') || lowerKey.includes('actuation') || lowerKey.includes('operation')) regexMatch = regexFieldMap['valve_operating'];
      else if (lowerKey.includes('standard')) regexMatch = regexFieldMap['designStandard'];
      else if (lowerKey.includes('qty') || lowerKey.includes('quantity')) regexMatch = regexFieldMap['quantity'];

      if (regexMatch && regexMatch.normalizedValue) {
        // Validate regex result
        const valRes = validationEngine.validateField(key, regexMatch.normalizedValue);

        if (valRes.state === 'VALID') {
          const confRes = fieldConfidenceEngine.calculateFieldConfidence({
            fieldName: key,
            rawValue: regexMatch.rawValue,
            normalizedValue: valRes.canonicalValue,
            extractionMethod: 'REGEX',
            validationState: 'VALID',
            isRequired: fDef.isRequired
          });

          validatedDynamicFields[key] = valRes.canonicalValue;
          fieldConfidences[key] = {
            value: valRes.canonicalValue,
            confidence: confRes.confidence,
            source: 'REGEX',
            validationState: 'VALID',
            reasoning: confRes.reasoning
          };

          rawExtractionsToSave.push({
            enquiryId,
            productIndex,
            field: key,
            rawValue: regexMatch.rawValue,
            normalizedValue: valRes.canonicalValue,
            extractionMethod: 'REGEX',
            confidence: confRes.confidence,
            validationState: 'VALID',
            validationReason: valRes.reason,
            sourceText: regexMatch.reasoning?.[0] || '',
            isAccepted: true
          });

          continue; // Successfully extracted by deterministic regex — skip AI for this field!
        }
      }

      // If regex did not extract a valid value, queue for AI extraction assistant
      fieldsToExtractWithAI.push(fDef);
    }

    // STAGE 2: AI Extraction Assistant (Only for missing fields)
    // OPTIMIZATION: Document-level cache — if the same enquiry and the same
    // missing field names have already been queried against the same document,
    // reuse the cached AI result instead of making another API call.
    let aiResults = {};
    if (fieldsToExtractWithAI.length > 0) {
      const sortedFieldNames = fieldsToExtractWithAI.map(f => f.fieldName).sort().join(',');
      const cacheKey = `${enquiryId || 'SYSTEM'}::${sortedFieldNames}`;

      if (this._aiExtractionCache.has(cacheKey)) {
        aiResults = this._aiExtractionCache.get(cacheKey);
        console.log(`[Zero-Hallucination Pipeline] AI cache HIT for ${fieldsToExtractWithAI.length} fields (${sortedFieldNames}). Reusing cached result.`);
      } else {
        console.log(`[Zero-Hallucination Pipeline] Calling AI Assistant for ${fieldsToExtractWithAI.length} missing fields (${sortedFieldNames})`);
        aiResults = await aiService.extractDynamicFields(textContext, fieldsToExtractWithAI, productDescription, enquiryId?.toString() || 'SYSTEM');
        // Cache the result for subsequent products with the same missing fields
        this._aiExtractionCache.set(cacheKey, aiResults);
      }
    }

    // STAGE 3 & 4: Validation Engine & Dictionary Normalization for AI Output
    for (const fDef of fieldsToExtractWithAI) {
      const key = fDef.fieldName;
      const aiFieldOutput = aiResults[key];

      let rawAiVal = null;
      let aiConf = 0;
      if (aiFieldOutput && typeof aiFieldOutput === 'object') {
        rawAiVal = aiFieldOutput.value;
        aiConf = aiFieldOutput.confidence || 0;
      } else if (aiFieldOutput !== undefined) {
        rawAiVal = aiFieldOutput;
        aiConf = 75;
      }

      if (rawAiVal === null || rawAiVal === undefined || rawAiVal === '' || rawAiVal === 'null') {
        // Field not present in text
        fieldConfidences[key] = {
          value: null,
          confidence: 0,
          source: 'NOT_FOUND',
          validationState: 'NOT_FOUND',
          reasoning: 'Field not present in provided document text'
        };

        rawExtractionsToSave.push({
          enquiryId,
          productIndex,
          field: key,
          rawValue: null,
          normalizedValue: null,
          extractionMethod: 'AI',
          confidence: 0,
          validationState: 'NOT_FOUND',
          validationReason: 'Value not in document',
          isAccepted: false
        });
        continue;
      }

      // Run Validation Engine on AI output
      const valRes = validationEngine.validateField(key, rawAiVal);

      if (valRes.state === 'VALID') {
        const confRes = fieldConfidenceEngine.calculateFieldConfidence({
          fieldName: key,
          rawValue: rawAiVal,
          normalizedValue: valRes.canonicalValue,
          extractionMethod: 'AI',
          validationState: 'VALID',
          isRequired: fDef.isRequired
        });

        validatedDynamicFields[key] = valRes.canonicalValue;
        fieldConfidences[key] = {
          value: valRes.canonicalValue,
          confidence: confRes.confidence,
          source: 'AI',
          validationState: 'VALID',
          reasoning: confRes.reasoning
        };

        rawExtractionsToSave.push({
          enquiryId,
          productIndex,
          field: key,
          rawValue: rawAiVal,
          normalizedValue: valRes.canonicalValue,
          extractionMethod: 'AI',
          confidence: confRes.confidence,
          validationState: 'VALID',
          validationReason: valRes.reason,
          isAccepted: true
        });

        if (enquiryId) {
          await ValidationLog.create({
            enquiryId,
            productIndex,
            field: key,
            aiValue: rawAiVal,
            finalValue: valRes.canonicalValue,
            validation: 'PASSED',
            source: 'EngineeringDictionary',
            confidenceBefore: aiConf,
            confidenceAfter: confRes.confidence
          }).catch(err => console.error('[ValidationLog] Save error:', err.message));
        }

      } else {
        // REJECT HALLUCINATED VALUE
        console.warn(`[Zero-Hallucination Pipeline] REJECTED AI value for ${key}: "${rawAiVal}". Reason: ${valRes.reason}`);

        fieldConfidences[key] = {
          value: null,
          confidence: 0,
          source: 'AI_REJECTED',
          validationState: 'INVALID',
          reasoning: `REJECTED: ${valRes.reason}`
        };

        rawExtractionsToSave.push({
          enquiryId,
          productIndex,
          field: key,
          rawValue: rawAiVal,
          normalizedValue: null,
          extractionMethod: 'AI',
          confidence: 0,
          validationState: 'INVALID',
          validationReason: valRes.reason,
          isAccepted: false,
          rejectionReason: valRes.reason
        });

        if (enquiryId) {
          await ValidationLog.create({
            enquiryId,
            productIndex,
            field: key,
            aiValue: rawAiVal,
            finalValue: null,
            validation: 'REJECTED',
            rejectionReason: valRes.reason,
            source: 'ValidationEngine',
            confidenceBefore: aiConf,
            confidenceAfter: 0
          }).catch(err => console.error('[ValidationLog] Save error:', err.message));
        }
      }
    }

    // Persist Raw Extractions to DB if enquiryId present
    if (enquiryId && rawExtractionsToSave.length > 0) {
      try {
        await RawExtraction.insertMany(rawExtractionsToSave.map(r => ({ ...r, enquiryId })));
      } catch (rawErr) {
        console.error('[RawExtraction] Error inserting raw extraction records:', rawErr.message);
      }
    }

    // STAGE 5: Evaluate Product Verification Status
    const statusEvaluation = fieldConfidenceEngine.evaluateProductStatus(fieldConfidences, 85);

    // Count sources for metrics
    let regexFieldCount = 0, aiFieldCount = 0, aiAccepted = 0, aiRejected = 0;
    for (const r of rawExtractionsToSave) {
      if (r.extractionMethod === 'REGEX') regexFieldCount++;
      else if (r.extractionMethod === 'AI') {
        aiFieldCount++;
        if (r.isAccepted) aiAccepted++;
        else aiRejected++;
      }
    }
    extractionMetrics.recordGatedPipelineResult({
      regexFieldCount, aiFieldCount, aiAccepted, aiRejected,
      extractionStatus: statusEvaluation.status
    });

    return {
      validatedDynamicFields,
      fieldConfidences,
      extractionStatus: statusEvaluation.status,
      overallConfidence: statusEvaluation.overallConfidence,
      fieldsNeedingReview: statusEvaluation.fieldsNeedingReview,
      consistencyConflicts: consistency.conflicts
    };
  }
}

module.exports = new ExtractionPipeline();
