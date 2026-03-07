const pdfjsLib = require('pdfjs-dist/legacy/build/pdf.js');
const fs = require('fs');
const path = require('path');

async function main() {
    const data = new Uint8Array(fs.readFileSync(path.join(__dirname, 'Verbal.pdf')));
    const doc = await pdfjsLib.getDocument({ data }).promise;
    console.log('Pages:', doc.numPages);

    let fullText = '';
    for (let i = 1; i <= doc.numPages; i++) {
        const page = await doc.getPage(i);
        const content = await page.getTextContent();

        // Group items by Y position to detect paragraph breaks
        let lastY = null;
        let pageText = '';
        for (const item of content.items) {
            if (item.str === undefined) continue;
            const y = Math.round(item.transform[5]);
            if (lastY !== null && Math.abs(y - lastY) > 15) {
                pageText += '\n';
            }
            if (lastY !== null && Math.abs(y - lastY) > 30) {
                pageText += '\n'; // double newline for bigger gaps = paragraph break
            }
            pageText += item.str;
            lastY = y;
        }
        fullText += `\n=== PAGE ${i} ===\n` + pageText + '\n';
    }

    fs.writeFileSync(path.join(__dirname, 'verbal_pdf_text.txt'), fullText, 'utf-8');
    console.log('Done. Chars:', fullText.length);
}

main().catch(e => { console.error(e); process.exit(1); });
