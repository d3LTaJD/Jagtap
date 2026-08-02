/**
 * Plugin-based Extractor Registry
 * Manages dynamic extractor plugin registration and pipeline execution.
 */

class ExtractorRegistry {
  constructor() {
    this.extractors = new Map();
  }

  /**
   * Registers a modular extractor plugin.
   * @param {Object} extractor Plugin instance with `id` and `extract(text, layout)` method.
   */
  register(extractor) {
    if (!extractor || !extractor.id || typeof extractor.extract !== 'function') {
      throw new Error(`Invalid extractor plugin signature: ${extractor?.id || 'unknown'}`);
    }
    this.extractors.set(extractor.id, extractor);
  }

  /**
   * Unregisters an extractor plugin by ID.
   */
  unregister(extractorId) {
    this.extractors.delete(extractorId);
  }

  /**
   * Executes all registered extractors on the given text and layout structure.
   * @param {string} textContext 
   * @param {Object} layoutStructure 
   * @returns {Object} Dictionary of extracted EngineeringField arrays/objects keyed by extractor ID.
   */
  runAll(textContext, layoutStructure = null) {
    const results = {};
    for (const [id, extractor] of this.extractors.entries()) {
      try {
        results[id] = extractor.extract(textContext, layoutStructure);
      } catch (err) {
        console.error(`[ExtractorRegistry] Error running extractor ${id}:`, err.message);
        results[id] = null;
      }
    }
    return results;
  }
}

const registryInstance = new ExtractorRegistry();

// Auto-register Phase 1 Modular Extractor Plugins (10 Extractors)
const sizeExtractor = require('./extractors/SizeExtractor');
const classExtractor = require('./extractors/ClassExtractor');
const materialExtractor = require('./extractors/MaterialExtractor');
const valveExtractor = require('./extractors/ValveExtractor');
const standardExtractor = require('./extractors/StandardExtractor');
const pressureExtractor = require('./extractors/PressureExtractor');
const temperatureExtractor = require('./extractors/TemperatureExtractor');
const quantityExtractor = require('./extractors/QuantityExtractor');
const tagExtractor = require('./extractors/TagExtractor');
const drawingExtractor = require('./extractors/DrawingExtractor');
const endConnectionExtractor = require('./extractors/EndConnectionExtractor');
const boreExtractor = require('./extractors/BoreExtractor');
const operationExtractor = require('./extractors/OperationExtractor');

registryInstance.register(sizeExtractor);
registryInstance.register(classExtractor);
registryInstance.register(materialExtractor);
registryInstance.register(valveExtractor);
registryInstance.register(standardExtractor);
registryInstance.register(pressureExtractor);
registryInstance.register(temperatureExtractor);
registryInstance.register(quantityExtractor);
registryInstance.register(tagExtractor);
registryInstance.register(drawingExtractor);
registryInstance.register(endConnectionExtractor);
registryInstance.register(boreExtractor);
registryInstance.register(operationExtractor);

module.exports = registryInstance;
