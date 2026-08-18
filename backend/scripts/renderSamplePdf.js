const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

async function convertPdfToImages() {
  const browser = await puppeteer.launch({ 
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1400, height: 2000, deviceScaleFactor: 1 });
  
  const pdfData = fs.readFileSync('d:/jagtap/J(P)001_ABC Constractor.pdf');
  const base64Pdf = pdfData.toString('base64');
  
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <script src="https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js"></script>
      <style>
        body { margin: 0; background: #525659; display: flex; flex-direction: column; align-items: center; gap: 20px; padding: 20px; }
        canvas { background: white; }
      </style>
    </head>
    <body>
      <div id="container"></div>
      <script>
        pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
        const rawData = atob("${base64Pdf}");
        const uint8Array = new Uint8Array(rawData.length);
        for (let i = 0; i < rawData.length; i++) {
          uint8Array[i] = rawData.charCodeAt(i);
        }
        
        pdfjsLib.getDocument({ data: uint8Array }).promise.then(async function(pdf) {
          const container = document.getElementById('container');
          for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
            const p = await pdf.getPage(pageNum);
            const scale = 2.0;
            const viewport = p.getViewport({ scale: scale });
            const canvas = document.createElement('canvas');
            canvas.id = 'page-' + pageNum;
            const context = canvas.getContext('2d');
            canvas.height = viewport.height;
            canvas.width = viewport.width;
            container.appendChild(canvas);
            await p.render({ canvasContext: context, viewport: viewport }).promise;
          }
          window.RENDER_DONE = true;
        }).catch(err => {
          console.error(err);
          window.RENDER_ERROR = err.message;
        });
      </script>
    </body>
    </html>
  `;
  
  await page.setContent(html);
  await page.waitForFunction('window.RENDER_DONE === true || window.RENDER_ERROR', { timeout: 30000 });
  
  const error = await page.evaluate(() => window.RENDER_ERROR);
  if (error) {
    console.error('Render error:', error);
    await browser.close();
    return;
  }
  
  const outDir = 'd:/jagtap/workflow-automation/backend/sample_pages';
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
  
  for (let i = 1; i <= 5; i++) {
    const canvas = await page.$('#page-' + i);
    if (canvas) {
      const imgBuffer = await canvas.screenshot();
      fs.writeFileSync(path.join(outDir, `sample_page_${i}.png`), imgBuffer);
      console.log(`Saved sample_page_${i}.png`);
    }
  }
  
  await browser.close();
  console.log('All sample pages rendered to PNG successfully!');
}

convertPdfToImages().catch(console.error);
