/**
 * DocumentLayoutEngine
 * Layout-aware document structure parser.
 * Preserves Page, Block, Table, Row, Cell, and Coordinate structure
 * without flattening tables into unstructured text strings.
 */

class DocumentLayoutEngine {
  /**
   * Parses text or raw parsed structure into a layout-aware Document object.
   * @param {string|Object} rawContent Text string or structured file object.
   * @param {string} documentId File or Document ID reference.
   */
  parseLayout(rawContent, documentId = 'DOC-UNKNOWN') {
    if (!rawContent) {
      return this.createEmptyDocument(documentId);
    }

    // If already structured (e.g. from structured PDF / Excel parser)
    if (typeof rawContent === 'object' && rawContent.pages) {
      return {
        documentId,
        pages: rawContent.pages.map((p, pIdx) => ({
          pageNumber: p.pageNumber || pIdx + 1,
          blocks: p.blocks || [],
          tables: p.tables || []
        }))
      };
    }

    // Convert raw text into page/table structural representation
    const text = String(rawContent).trim();
    const rawSplits = text.split(/\f|(?:^|\n)--- Page \d+ ---\n?/i).map(s => s.trim()).filter(Boolean);
    const pageSplits = rawSplits.length > 0 ? rawSplits : [text];
    const pages = pageSplits.map((pageText, pIdx) => {
      const lines = pageText.split('\n').map(l => l.trim()).filter(Boolean);
      const tables = [];
      const blocks = [];

      let currentTable = null;

      lines.forEach((line, lineIdx) => {
        // Detect table row separators (e.g. pipe | or tab \t separated text)
        if (line.includes('|') || line.includes('\t') || /\s{3,}/.test(line)) {
          const cells = line.includes('|')
            ? line.split('|').map(c => c.trim()).filter(Boolean)
            : line.split(/\t|\s{3,}/).map(c => c.trim()).filter(Boolean);

          if (cells.length >= 2) {
            if (!currentTable) {
              currentTable = {
                tableId: `TBL-${pIdx + 1}-${tables.length + 1}`,
                rows: []
              };
              tables.push(currentTable);
            }
            currentTable.rows.push({
              rowIndex: currentTable.rows.length + 1,
              cells: cells.map((cellText, colIdx) => ({
                columnIndex: colIdx + 1,
                text: cellText,
                bbox: null
              }))
            });
            return;
          }
        }

        currentTable = null;
        blocks.push({
          blockId: `BLK-${pIdx + 1}-${lineIdx + 1}`,
          text: line,
          bbox: null
        });
      });

      return {
        pageNumber: pIdx + 1,
        blocks,
        tables
      };
    });

    return {
      documentId,
      pages
    };
  }

  createEmptyDocument(documentId) {
    return {
      documentId,
      pages: [{ pageNumber: 1, blocks: [], tables: [] }]
    };
  }
}

module.exports = new DocumentLayoutEngine();
