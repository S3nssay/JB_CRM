import fs from 'fs';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const pdf = require('pdf-parse');

async function extractPdfContent() {
    const dataBuffer = fs.readFileSync('./property_list.pdf');

    try {
        const data = await pdf(dataBuffer);

        console.log('=== PDF Content ===');
        console.log('Number of pages:', data.numpages);
        console.log('---');
        console.log(data.text);
    } catch (err) {
        console.error('Error parsing PDF:', err);
    }
}

extractPdfContent();
