import XLSX from 'xlsx';
import path from 'path';

// Path to the Excel file
const filePath = 'C:\\Users\\ziaa\\Dropbox\\ZA\\DOWNLOADS\\BUSINESS\\JOHN BARCLAY\\Documentation\\rental Inventory.xlsx';

try {
  // Read the workbook
  const workbook = XLSX.readFile(filePath);

  console.log('=== WORKBOOK INFO ===');
  console.log('Sheet names:', workbook.SheetNames);

  // Process each sheet
  workbook.SheetNames.forEach(sheetName => {
    console.log(`\n=== SHEET: ${sheetName} ===`);
    const sheet = workbook.Sheets[sheetName];

    // Convert to JSON to see the data
    const data = XLSX.utils.sheet_to_json(sheet, { header: 1 });

    if (data.length > 0) {
      console.log('\nColumn Headers (Row 1):');
      const headers = data[0];
      headers.forEach((header, index) => {
        console.log(`  ${index + 1}. ${header}`);
      });

      console.log(`\nTotal rows: ${data.length}`);

      // Show first few rows of data
      console.log('\nFirst 3 data rows:');
      for (let i = 1; i < Math.min(4, data.length); i++) {
        console.log(`\nRow ${i + 1}:`);
        data[i].forEach((cell, index) => {
          if (cell !== undefined && cell !== null && cell !== '') {
            console.log(`  ${headers[index] || `Column ${index + 1}`}: ${cell}`);
          }
        });
      }
    } else {
      console.log('Sheet is empty');
    }
  });

  // Output full JSON for processing
  console.log('\n\n=== FULL JSON DATA ===');
  const mainSheet = workbook.Sheets[workbook.SheetNames[0]];
  const jsonData = XLSX.utils.sheet_to_json(mainSheet);
  console.log(JSON.stringify(jsonData, null, 2));

} catch (error) {
  console.error('Error reading Excel file:', error.message);
}
