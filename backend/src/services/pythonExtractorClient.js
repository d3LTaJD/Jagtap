const axios = require('axios');
const FormData = require('form-data');

const PYTHON_SERVICE_URL = process.env.PYTHON_EXTRACTOR_URL || 'http://127.0.0.1:8001';

class PythonExtractorClient {
  constructor() {
    this.baseUrl = PYTHON_SERVICE_URL;
  }

  /**
   * Health check to see if Python extractor service is running.
   */
  async isServiceAvailable() {
    try {
      const res = await axios.get(`${this.baseUrl}/health`, { timeout: 800 });
      return res.status === 200 && res.data?.status === 'healthy';
    } catch {
      return false;
    }
  }

  /**
   * Sends PDF / Excel file buffer to Python extractor service.
   * @param {Buffer} fileBuffer
   * @param {string} fileName
   * @returns {Promise<{success: boolean, items: Array, root_specs: Object, error?: string}>}
   */
  async extractFile(fileBuffer, fileName) {
    try {
      const isUp = await this.isServiceAvailable();
      if (!isUp) {
        return { success: false, fallback: true, error: 'Python extractor service offline' };
      }

      const form = new FormData();
      form.append('file', fileBuffer, { filename: fileName });

      const response = await axios.post(`${this.baseUrl}/api/v1/extract-file`, form, {
        headers: {
          ...form.getHeaders()
        },
        maxContentLength: 50 * 1024 * 1024,
        maxBodyLength: 50 * 1024 * 1024,
        timeout: 15000
      });

      if (response.data && response.data.success) {
        return {
          success: true,
          total_items: response.data.total_items,
          items: response.data.items || [],
          root_specs: response.data.root_specs || {},
          metadata: response.data.metadata || {}
        };
      }

      return {
        success: false,
        fallback: true,
        error: response.data?.error || 'Python extraction failed'
      };
    } catch (err) {
      console.warn(`[PythonExtractorClient] File extraction error: ${err.message}`);
      return { success: false, fallback: true, error: err.message };
    }
  }

  /**
   * Sends plain text / email body to Python extractor service.
   * @param {string} text
   * @returns {Promise<{success: boolean, items: Array, root_specs: Object, error?: string}>}
   */
  async extractText(text) {
    try {
      const isUp = await this.isServiceAvailable();
      if (!isUp) {
        return { success: false, fallback: true, error: 'Python extractor service offline' };
      }

      const response = await axios.post(
        `${this.baseUrl}/api/v1/extract-text`,
        { text },
        { timeout: 5000 }
      );

      if (response.data && response.data.success) {
        return {
          success: true,
          total_items: response.data.total_items,
          items: response.data.items || [],
          root_specs: response.data.root_specs || {},
          metadata: response.data.metadata || {}
        };
      }

      return {
        success: false,
        fallback: true,
        error: response.data?.error || 'Python text extraction failed'
      };
    } catch (err) {
      console.warn(`[PythonExtractorClient] Text extraction error: ${err.message}`);
      return { success: false, fallback: true, error: err.message };
    }
  }
}

module.exports = new PythonExtractorClient();
