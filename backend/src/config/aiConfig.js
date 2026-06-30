/**
 * Production AI Extraction Configuration
 */

module.exports = {
  // Model Configuration
  // Part 3: Use OpenAI (gpt-4o-mini) as the primary extraction model
  // Note: gpt-4o-mini is standard and has high limits / structured output support
  PRIMARY_MODEL: 'gpt-4o-mini',
  
  // Model Fallbacks (Cascade Chain: OpenAI -> Gemini -> Groq)
  GEMINI_MODELS: ['gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-2.5-flash-lite', 'gemini-flash-latest'],
  GROQ_MODEL: 'llama-3.3-70b-versatile',
  
  // Timeout for AI API requests in milliseconds (increased to 90s for large specs)
  AI_TIMEOUT: parseInt(process.env.AI_TIMEOUT, 10) || 90000,

  // Limits
  MAX_PRODUCTS_PER_BATCH: parseInt(process.env.MAX_PRODUCTS_PER_BATCH, 10) || 10,
  MAX_CONTEXT_SIZE: parseInt(process.env.MAX_CONTEXT_SIZE, 10) || 15000,
  MAX_ATTACHMENTS: parseInt(process.env.MAX_ATTACHMENTS, 10) || 10,
  MAX_RETRIES: parseInt(process.env.MAX_RETRIES, 10) || 4,
  MAX_AI_CONCURRENCY: parseInt(process.env.MAX_AI_CONCURRENCY, 10) || 4,
  
  // Caching & OCR
  OCR_CACHE_ENABLED: process.env.OCR_CACHE_ENABLED !== 'false', // Default to true
  
  // Text Extraction CAP for primary item extraction
  MAX_ATTACHMENT_TEXT: parseInt(process.env.MAX_ATTACHMENT_TEXT, 10) || 8000
};
