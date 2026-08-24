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
    productIndex = 0,
    lineItemId = null
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
      if (val && (val.normalizedValue || val.validationState === 'INVALID' || val.validationState === 'AMBIGUOUS')) {
        regexExtractions[key] = val; // Override with scoped result
      }
    }

    const rawExtractionsToSave = [];
    const validatedDynamicFields = {};
    const fieldConfidences = {};

    // Map regex results to fieldNames
    const regexFieldMap = {};
    Object.entries(regexExtractions).forEach(([extractorId, fieldObj]) => {
      if (fieldObj && fieldObj.fieldId && (fieldObj.normalizedValue !== undefined || fieldObj.validationState === 'INVALID' || fieldObj.validationState === 'AMBIGUOUS')) {
        regexFieldMap[fieldObj.fieldId] = fieldObj;
      }
    });

// Set of Engineering-Derived fields that must be populated by contract review / engineering rules
// unless explicit customer text was captured by regex/source extraction.
const ENGINEERING_DERIVED_FIELDS = new Set([
  'valve_design_std', 'valve_testing_std', 'valve_direction',
  'valve_fire_safe', 'valve_service', 'valve_nace_req',
  'valve_painting_dft', 'valve_packing', 'valve_dispatch',
  'valve_location', 'valve_special_req', 'valve_hydro_shell',
  'valve_hydro_seat', 'valve_air_seat', 'valve_back_seat',
  'valve_dbb_hydro', 'valve_antistatic_test', 'valve_design_validation',
  'annex_a', 'annex_b', 'annex_c', 'annex_d', 'annex_e',
  'annex_f', 'annex_g', 'annex_h', 'annex_i', 'annex_j',
  'annex_k', 'annex_l', 'annex_m',
  'valve_calib_cert', 'valve_ibr_ce_cert', 'valve_qsl_level',
  'valve_api6d_monogram'
]);

    // Process fields defined for this form context
    const fieldsToExtractWithAI = [];

    for (const fDef of fieldDefinitions) {
      const key = fDef.fieldName;
      const lowerKey = key.toLowerCase();

      // Check if regex extracted this field
      let regexMatch = null;
      if (lowerKey.includes('size')) regexMatch = regexFieldMap['valve_size'];
      else if (lowerKey.includes('operating') || lowerKey.includes('actuation') || lowerKey.includes('operation')) regexMatch = regexFieldMap['valve_operating'];
      else if (lowerKey.includes('class') || lowerKey.includes('pressure_rating') || lowerKey.includes('pressure_class') || lowerKey === 'rating') regexMatch = regexFieldMap['valve_class'];
      else if (lowerKey.includes('type') && lowerKey.includes('valve')) regexMatch = regexFieldMap['valve_type'];
      else if (lowerKey.includes('material') || lowerKey.includes('moc')) regexMatch = regexFieldMap['shellMaterial'] || regexFieldMap['valve_moc_body'];
      else if (lowerKey.includes('end') || lowerKey.includes('connection')) regexMatch = regexFieldMap['endConnection'] || regexFieldMap['valve_end_connection'];
      else if (lowerKey.includes('testing_std') || lowerKey.includes('testing')) {
        const stdMatch = regexFieldMap['designStandard'];
        if (stdMatch && /api\s*598|iso\s*15848|bs\s*6755/i.test(stdMatch.normalizedValue)) {
          regexMatch = stdMatch;
        }
      }
      else if (lowerKey.includes('standard') || lowerKey.includes('design_std')) regexMatch = regexFieldMap['designStandard'];
      else if (lowerKey.includes('qty') || lowerKey.includes('quantity')) regexMatch = regexFieldMap['quantity'];
      else if (lowerKey.includes('drawing') || lowerKey.includes('dwg') || lowerKey.includes('pid')) regexMatch = regexFieldMap['drawingNumber'];
      else if (lowerKey.includes('tag')) regexMatch = regexFieldMap['tagNumber'];

      if (regexMatch) {
        if (regexMatch.validationState === 'INVALID' || regexMatch.validationState === 'AMBIGUOUS') {
          // Explicit customer negation or ambiguity detected — preserve raw evidence, set null canonical value, and do not send to AI
          fieldConfidences[key] = {
            value: null,
            confidence: regexMatch.score?.confidence || 0,
            source: 'REGEX',
            provenance: 'CUSTOMER_EXTRACTED',
            validationState: regexMatch.validationState,
            reasoning: regexMatch.reasoning?.[0] || `Customer text is ${regexMatch.validationState.toLowerCase()}`
          };

          rawExtractionsToSave.push({
            enquiryId,
            lineItemId,
            productIndex,
            field: key,
            rawValue: regexMatch.rawValue,
            normalizedValue: null,
            extractionMethod: 'REGEX',
            provenance: 'CUSTOMER_EXTRACTED',
            confidence: regexMatch.score?.confidence || 0,
            validationState: regexMatch.validationState,
            validationReason: regexMatch.reasoning?.[0] || '',
            sourceText: regexMatch.reasoning?.[0] || '',
            isAccepted: false
          });

          continue; // Negated/ambiguous in customer text — do not send to AI to invent a positive requirement
        }

        if (regexMatch.normalizedValue) {
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
              provenance: 'CUSTOMER_EXTRACTED',
              validationState: 'VALID',
              reasoning: confRes.reasoning
            };

            rawExtractionsToSave.push({
              enquiryId,
              lineItemId,
              productIndex,
              field: key,
              rawValue: regexMatch.rawValue,
              normalizedValue: valRes.canonicalValue,
              extractionMethod: 'REGEX',
              provenance: 'CUSTOMER_EXTRACTED',
              confidence: confRes.confidence,
              validationState: 'VALID',
              validationReason: valRes.reason,
              sourceText: regexMatch.reasoning?.[0] || '',
              isAccepted: true
            });

            continue; // Successfully extracted by deterministic regex — skip AI for this field!
          }
        }
      }

      // FIELD PROVENANCE GATE:
      // Engineering-derived fields (standards, annexures, DFT, etc.) must come from
      // engineering/contract-review rules unless explicit text was matched by regex above.
      // Do NOT send them to AI to guess/hallucinate.
      if (ENGINEERING_DERIVED_FIELDS.has(key)) {
        fieldConfidences[key] = {
          value: null,
          confidence: 0,
          source: 'ENGINEERING_RULE',
          provenance: 'ENGINEERING_RULE',
          validationState: 'DEFERRED',
          reasoning: 'Engineering-derived field — deferred to contract review rules'
        };

        rawExtractionsToSave.push({
          enquiryId,
          lineItemId,
          productIndex,
          field: key,
          rawValue: null,
          normalizedValue: null,
          extractionMethod: 'ENGINEERING_RULE',
          provenance: 'ENGINEERING_RULE',
          confidence: 0,
          validationState: 'DEFERRED',
          validationReason: 'Deferred to engineering/contract review rules',
          isAccepted: false
        });

        continue;
      }

      // If regex did not extract a customer field, queue for AI extraction assistant
      fieldsToExtractWithAI.push(fDef);
    }

    // STAGE 2: AI Extraction Assistant (Only for missing customer fields)
    // Isolated Cache Key: enquiryId + lineItemId/productIndex + descHash + sortedFieldNames
    let aiResults = {};
    if (fieldsToExtractWithAI.length > 0) {
      const crypto = require('crypto');
      const descHash = productDescription
        ? crypto.createHash('md5').update(productDescription).digest('hex').slice(0, 8)
        : 'NO_DESC';
      const sortedFieldNames = fieldsToExtractWithAI.map(f => f.fieldName).sort().join(',');
      const itemKey = lineItemId ? `li_${lineItemId}` : `p${productIndex}`;
      const cacheKey = `${enquiryId || 'SYSTEM'}::${itemKey}::${descHash}::${sortedFieldNames}`;

      if (this._aiExtractionCache.has(cacheKey)) {
        aiResults = this._aiExtractionCache.get(cacheKey);
        console.log(`[Zero-Hallucination Pipeline] AI cache HIT for ${fieldsToExtractWithAI.length} fields (${sortedFieldNames}). Reusing cached result.`);
      } else {
        console.log(`[Zero-Hallucination Pipeline] Calling AI Assistant for ${fieldsToExtractWithAI.length} missing customer fields (${sortedFieldNames})`);
        aiResults = await aiService.extractDynamicFields(textContext, fieldsToExtractWithAI, productDescription, enquiryId?.toString() || 'SYSTEM');
        // Cache the result for identical extraction contexts
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
        aiConf = (aiFieldOutput.confidence !== undefined && aiFieldOutput.confidence !== null) ? Number(aiFieldOutput.confidence) : 0;
      } else if (aiFieldOutput !== undefined && aiFieldOutput !== null) {
        rawAiVal = aiFieldOutput;
        aiConf = 0; // Explicit missing confidence must be 0, never assume 75
      }

      if (rawAiVal === null || rawAiVal === undefined || rawAiVal === '' || rawAiVal === 'null') {
        // Field not present in text
        fieldConfidences[key] = {
          value: null,
          confidence: 0,
          source: 'NOT_FOUND',
          provenance: 'NOT_FOUND',
          validationState: 'NOT_FOUND',
          reasoning: 'Field not present in provided document text'
        };

        rawExtractionsToSave.push({
          enquiryId,
          lineItemId,
          productIndex,
          field: key,
          rawValue: null,
          normalizedValue: null,
          extractionMethod: 'AI',
          provenance: 'NOT_FOUND',
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
          provenance: 'CUSTOMER_EXTRACTED',
          validationState: 'VALID',
          reasoning: confRes.reasoning
        };

        rawExtractionsToSave.push({
          enquiryId,
          lineItemId,
          productIndex,
          field: key,
          rawValue: rawAiVal,
          normalizedValue: valRes.canonicalValue,
          extractionMethod: 'AI',
          provenance: 'CUSTOMER_EXTRACTED',
          confidence: confRes.confidence,
          validationState: 'VALID',
          validationReason: valRes.reason,
          isAccepted: true
        });

        const mongoose = require('mongoose');
        const isValidObjectId = enquiryId && mongoose.Types.ObjectId.isValid(enquiryId);

        if (isValidObjectId) {
          await ValidationLog.create({
            enquiryId,
            lineItemId,
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
          provenance: 'CUSTOMER_EXTRACTED',
          validationState: 'INVALID',
          reasoning: `REJECTED: ${valRes.reason}`
        };

        rawExtractionsToSave.push({
          enquiryId,
          lineItemId,
          productIndex,
          field: key,
          rawValue: rawAiVal,
          normalizedValue: null,
          extractionMethod: 'AI',
          provenance: 'CUSTOMER_EXTRACTED',
          confidence: 0,
          validationState: 'INVALID',
          validationReason: valRes.reason,
          isAccepted: false,
          rejectionReason: valRes.reason
        });

        const mongoose = require('mongoose');
        const isValidObjectId = enquiryId && mongoose.Types.ObjectId.isValid(enquiryId);

        if (isValidObjectId) {
          await ValidationLog.create({
            enquiryId,
            lineItemId,
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

    // Persist Raw Extractions to DB if valid enquiry ObjectId present
    const mongoose = require('mongoose');
    const isValidEnquiryObjectId = enquiryId && mongoose.Types.ObjectId.isValid(enquiryId);
    if (isValidEnquiryObjectId && rawExtractionsToSave.length > 0) {
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
      lineItemId,
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
