const PDFParser = require('pdf2json');
const fs = require('fs');

const pdfParser = new PDFParser();

pdfParser.on('pdfParser_dataReady', (pdfData) => {
    // Extract text content from PDF with safe decoding
    const textContent = pdfData.Pages.map((page, pageIndex) => {
        const pageTexts = page.Texts.map(text => {
            try {
                const rawText = text.R.map(r => r.T).join('');
                // Try to decode, but fall back to raw text if it fails
                try {
                    return decodeURIComponent(rawText);
                } catch (e) {
                    return rawText.replace(/%20/g, ' ').replace(/%2C/g, ',');
                }
            } catch (e) {
                return '';
            }
        });
        return `=== Page ${pageIndex + 1} ===\n${pageTexts.join(' ')}`;
    }).join('\n\n');

    console.log('=== PDF Content ===');
    console.log('Number of pages:', pdfData.Pages.length);
    console.log('---');
    console.log(textContent);

    // Also save to a text file for easier analysis
    fs.writeFileSync('./property_list_extracted.txt', textContent);
    console.log('\n--- Saved to property_list_extracted.txt ---');
});

pdfParser.on('pdfParser_dataError', (errData) => {
    console.error('Error parsing PDF:', errData.parserError);
});

pdfParser.loadPDF('./property_list.pdf');
