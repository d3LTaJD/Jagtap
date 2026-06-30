const fs = require('fs');
const path = require('path');

/**
 * Saves every AI request & response to d:\jagtap\workflow-automation\backend\logs\ai\
 * Format: YYYYMMDD_HHMMSS_EnquiryID_Step.json
 * Never crashes or blocks execution.
 */
exports.logAIRequestResponse = (enquiryId, step, requestPayload, responsePayload) => {
  try {
    const logsDir = path.join('d:\\jagtap\\workflow-automation\\backend', 'logs', 'ai');
    
    // Ensure directory exists recursively
    if (!fs.existsSync(logsDir)) {
      fs.mkdirSync(logsDir, { recursive: true });
    }

    const now = new Date();
    const YYYY = now.getFullYear();
    const MM = String(now.getMonth() + 1).padStart(2, '0');
    const DD = String(now.getDate()).padStart(2, '0');
    const HH = String(now.getHours()).padStart(2, '0');
    const min = String(now.getMinutes()).padStart(2, '0');
    const ss = String(now.getSeconds()).padStart(2, '0');
    const dateStr = `${YYYY}${MM}${DD}_${HH}${min}${ss}`;

    const safeEnquiryId = (enquiryId || 'SYSTEM').replace(/[^a-zA-Z0-9_-]/g, '_');
    const safeStep = (step || 'Step').replace(/[^a-zA-Z0-9_-]/g, '_');

    const filename = `${dateStr}_${safeEnquiryId}_${safeStep}.json`;
    const filePath = path.join(logsDir, filename);

    const logData = {
      timestamp: now.toISOString(),
      enquiryId: enquiryId || null,
      step: step || null,
      request: requestPayload,
      response: responsePayload
    };

    fs.writeFile(filePath, JSON.stringify(logData, null, 2), (err) => {
      if (err) {
        console.error('[AI Logger] Failed to write log file:', err.message);
      } else {
        console.log(`[AI Logger] Request/Response saved to: ${filePath}`);
      }
    });
  } catch (err) {
    console.error('[AI Logger] Error in logAIRequestResponse:', err.message);
  }
};
