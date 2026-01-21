import XLSX from 'xlsx';
import path from 'path';

const EXCEL_PATH = path.join('C:', 'Users', 'ziaa', 'Dropbox', 'ZA', 'DOWNLOADS', 'BUSINESS', 'JOHN BARCLAY', 'Documentation', 'Managed_PropertyList_Data.xlsx');

// Extract postcode from address
function extractPostcode(address: string): string {
  if (!address) return '';
  const match = address.match(/([A-Z]{1,2}\d{1,2}[A-Z]?\s*\d[A-Z]{2})/i);
  return match ? match[1].toUpperCase().replace(/\s+/g, ' ') : '';
}

const workbook = XLSX.readFile(EXCEL_PATH);
const sheetName = workbook.SheetNames[0];
const sheet = workbook.Sheets[sheetName];
const rows: any[] = XLSX.utils.sheet_to_json(sheet, { header: 1 });

console.log(`Total rows (including header): ${rows.length}`);
console.log(`Data rows: ${rows.length - 1}`);

// Column indices
const COL_PROPERTY_ADDRESS = 2;
const COL_LANDLORD_NAME = 7;
const COL_TENANT_NAME = 15;

// Track unique values
const postcodes = new Map<string, number>();
const addresses = new Map<string, number>();
const landlords = new Map<string, number>();
const tenants = new Map<string, number>();

for (let i = 1; i < rows.length; i++) {
  const row = rows[i];
  const address = String(row[COL_PROPERTY_ADDRESS] || '').trim();
  const postcode = extractPostcode(address);
  const landlordName = String(row[COL_LANDLORD_NAME] || '').trim();
  const tenantName = String(row[COL_TENANT_NAME] || '').trim();

  if (postcode) {
    postcodes.set(postcode, (postcodes.get(postcode) || 0) + 1);
  }
  if (address) {
    addresses.set(address, (addresses.get(address) || 0) + 1);
  }
  if (landlordName) {
    landlords.set(landlordName, (landlords.get(landlordName) || 0) + 1);
  }
  if (tenantName) {
    tenants.set(tenantName, (tenants.get(tenantName) || 0) + 1);
  }
}

console.log('\n=== UNIQUE COUNTS ===');
console.log(`Unique postcodes: ${postcodes.size}`);
console.log(`Unique addresses: ${addresses.size}`);
console.log(`Unique landlord names: ${landlords.size}`);
console.log(`Unique tenant names: ${tenants.size}`);

// Show postcodes that appear multiple times
console.log('\n=== DUPLICATE POSTCODES (same property, multiple tenancies) ===');
let duplicateCount = 0;
for (const [postcode, count] of postcodes.entries()) {
  if (count > 1) {
    console.log(`${postcode}: ${count} rows`);
    duplicateCount += count - 1;
  }
}
console.log(`\nTotal duplicate rows (extra tenancies): ${duplicateCount}`);
console.log(`Expected properties: ${postcodes.size}`);
console.log(`Expected tenancies: ${rows.length - 1}`);

// Show sample of rows without postcodes
console.log('\n=== ROWS WITHOUT VALID POSTCODES ===');
let noPostcodeCount = 0;
for (let i = 1; i < rows.length; i++) {
  const row = rows[i];
  const address = String(row[COL_PROPERTY_ADDRESS] || '').trim();
  const postcode = extractPostcode(address);
  if (!postcode && address) {
    noPostcodeCount++;
    if (noPostcodeCount <= 5) {
      console.log(`Row ${i}: "${address}"`);
    }
  }
}
console.log(`Total rows without valid postcode: ${noPostcodeCount}`);

process.exit(0);
