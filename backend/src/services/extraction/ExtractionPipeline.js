/**
 * ExtractionPipeline
 * Main Orchestrator for Zero-Hallucination Engineering Extraction.
 * Coordinates Layout parsing, Plugin Extractors, Evidence correlation,
 * Decision Engine, Dependency Rules, and Metrics.
 */

const documentLayoutEngine = require('./DocumentLayoutEngine');
const extractorRegistry = require('./ExtractorRegistry');
const EvidenceEngine = require('./EvidenceEngine');
const decisionEngine = require('./DecisionEngine');
const dependencyRuleEngine = require('./DependencyRuleEngine');
const extractionMetrics = require('./ExtractionMetrics');

class ExtractionPipeline {
  /**
   * Processes a document through the deterministic zero-hallucination extraction pipeline.
   * @param {string|Object} rawContent Document text or structured layout.
   * @param {Object} options Options including documentId, documentType.
   */
  processDocument(rawContent, options = {}) {
    const documentId = options.documentId || `DOC-${Date.now()}`;
    const documentType = options.documentType || 'PURCHASE_RFQ';

    // 1. Layout Engine
    const layout = documentLayoutEngine.parseLayout(rawContent, documentId);

    // 2. Collect text blocks & run modular extractor plugins
    const fullText = layout.pages
      .flatMap(p => [
        ...p.blocks.map(b => b.text),
        ...p.tables.flatMap(t => t.rows.flatMap(r => r.cells.map(c => c.text)))
      ])
      .join(' ');

    const pluginExtractions = extractorRegistry.runAll(fullText);

    // 3. Evidence Engine Correlation
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

    // 4. Decision Engine
    const fieldDefinitions = [
      { id: 'valve_size', name: 'Valve Size' },
      { id: 'valve_class', name: 'Pressure Class' },
      { id: 'shellMaterial', name: 'Shell Material' },
      { id: 'valve_type', name: 'Valve Type' },
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

    // 5. Cross-Field Dependency Rules
    decisions = dependencyRuleEngine.applyRules(decisions);

    // 6. Record Metrics Telemetry
    extractionMetrics.recordPipelineRun(decisions);

    // 7. Output result with backwards compatibility map
    return {
      documentId,
      layout,
      fields: decisions,
      // Compatibility dictionary mapping to legacy spec properties
      legacySpecifications: {
        valve_size: decisions.valve_size?.normalizedValue || '',
        valve_class: decisions.valve_class?.normalizedValue || '',
        shellMaterial: decisions.shellMaterial?.normalizedValue || '',
        valve_type: decisions.valve_type?.normalizedValue || '',
        designStandard: decisions.designStandard?.normalizedValue || '',
        designPressure: decisions.designPressure?.normalizedValue || '',
        designTemperature: decisions.designTemperature?.normalizedValue || '',
        quantity: decisions.quantity?.normalizedValue || '',
        tagNumber: decisions.tagNumber?.normalizedValue || '',
        drawingNumber: decisions.drawingNumber?.normalizedValue || ''
      }
    };
  }
}

module.exports = new ExtractionPipeline();
