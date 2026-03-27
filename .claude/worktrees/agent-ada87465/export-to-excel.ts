/**
 * PDF to Excel Export Script
 * Parses property_list_extracted.txt and creates an Excel file with all fields
 * 
 * Run with: npx tsx export-to-excel.ts
 */

import { readFileSync, writeFileSync } from 'fs';

// Read the extracted text file
const extractedText = readFileSync('./property_list_extracted.txt', 'utf-8');

// Parse a single property page and extract ALL fields
function parsePropertyPage(pageText: string): Record<string, string> {
    const data: Record<string, string> = {};

    try {
        // Property Address
        const propertyMatch = pageText.match(/PROPERTY\s+(.+?)(?=MANAGEMENT\/LET|LANDLORD)/s);
        let propertyAddress = propertyMatch ? propertyMatch[1].trim().replace(/\s+/g, ' ') : '';
        propertyAddress = propertyAddress.split('MANAGEMENT')[0].trim();
        data['Property Address'] = propertyAddress;

        // Extract postcode
        const postcodeMatch = propertyAddress.match(/([A-Z]{1,2}\d{1,2}[A-Z]?\s*\d[A-Z]{2})/i);
        data['Postcode'] = postcodeMatch ? postcodeMatch[1].toUpperCase() : '';

        // Management Fee
        const feeMatch = pageText.match(/FEE \(%\)\s*(\d+\.?\d*)/);
        data['Management Fee (%)'] = feeMatch ? feeMatch[1] : '0';

        // Landlord
        const landlordMatch = pageText.match(/LANDLORD\s+(.+?)(?=\d{4}|\d{3,}\.?\d*\s+\d)/s);
        let landlordName = landlordMatch ? landlordMatch[1].trim().replace(/\s+/g, ' ') : '';
        landlordName = landlordName.split(/\d{4}|ADDRESS/)[0].trim();
        data['Landlord Name'] = landlordName;

        // Rent and Deposit (two numbers before dates)
        const rentValues = pageText.match(/(\d+\.?\d*)\s+(\d+\.?\d*)\s+(\d{2}\/\d{2}\/\d{4})\s+(\d{2}\/\d{2}\/\d{4})/);
        if (rentValues) {
            data['Deposit'] = rentValues[1];
            data['Rent Amount'] = rentValues[2];
            data['Tenancy Start'] = rentValues[3];
            data['Tenancy End'] = rentValues[4];
        } else {
            data['Deposit'] = '';
            data['Rent Amount'] = '';
            data['Tenancy Start'] = '';
            data['Tenancy End'] = '';
        }

        // Bank details
        const bankMatch = pageText.match(/BANK\s+(.+?)Acc No\s*(\d+)/);
        data['Bank Name'] = bankMatch ? bankMatch[1].trim() : '';
        data['Account Number'] = bankMatch ? bankMatch[2].trim() : '';

        const sortCodeMatch = pageText.match(/SORT CODE\s+([\d-]+)/);
        data['Sort Code'] = sortCodeMatch ? sortCodeMatch[1].trim() : '';

        // Telephone
        const telephoneMatch = pageText.match(/TELEPHONE\s+([\d]+)/);
        data['Telephone'] = telephoneMatch ? telephoneMatch[1].trim() : '';

        // Mobile
        const mobileMatch = pageText.match(/MOBILE\s+([\d\s+]+)/);
        data['Mobile'] = mobileMatch ? mobileMatch[1].trim().replace(/\s+/g, '') : '';

        // Email
        const emailMatch = pageText.match(/Email\s+([^\s]+@[^\s]+)/);
        data['Email'] = emailMatch ? emailMatch[1].trim() : '';

        // Deposit Held By
        const depositHeldMatch = pageText.match(/Held By\s+(.+?)(?=MANAGEMENT)/s);
        let depositHeldBy = depositHeldMatch ? depositHeldMatch[1].trim() : '';
        depositHeldBy = depositHeldBy.split('\n')[0].trim();
        data['Deposit Held By'] = depositHeldBy;

        // Management Type
        const managementMatch = pageText.match(/MANAGEMENT\s+(Managed|Let Only)/i);
        data['Management Type'] = managementMatch ? managementMatch[1] : 'Managed';

        // Period
        const periodMatch = pageText.match(/PERIOD\s+(\d+)\s+Months/);
        data['Period (Months)'] = periodMatch ? periodMatch[1] : '';

        // Payment Frequency
        if (pageText.includes('Calendar Monthly')) data['Payment Frequency'] = 'Calendar Monthly';
        else if (pageText.includes('Quarterly')) data['Payment Frequency'] = 'Quarterly';
        else if (pageText.includes('Annually')) data['Payment Frequency'] = 'Annually';
        else data['Payment Frequency'] = '';

        // Tenant Name (from TENANT(S) section)
        const tenantMatch = pageText.match(/TENANT\(S\)[^\n]*\n([^\n]+)/);
        let tenantName = tenantMatch ? tenantMatch[1].trim() : '';
        tenantName = tenantName.replace(/DEPOSIT HELD.*/i, '').trim();
        data['Tenant Name'] = tenantName;

        // Keys
        data['Spare Keys in Office'] = pageText.includes('SPARE SET OF KEYS IN OFFICE    Y') ? 'Yes' : 'No';

    } catch (error) {
        console.error('Error parsing page:', error);
    }

    return data;
}

// Split text into pages
function splitIntoPages(text: string): string[] {
    const pages = text.split(/=== Page \d+ ===/);
    return pages.filter(p => p.trim().length > 100);
}

// Convert to CSV (which can be opened in Excel)
function generateCSV(records: Record<string, string>[]): string {
    if (records.length === 0) return '';

    // Get all headers
    const headers = Object.keys(records[0]);

    // Escape CSV values
    const escapeCSV = (val: string) => {
        if (val.includes(',') || val.includes('"') || val.includes('\n')) {
            return `"${val.replace(/"/g, '""')}"`;
        }
        return val;
    };

    // Build CSV
    const csvRows = [headers.map(escapeCSV).join(',')];

    for (const record of records) {
        const row = headers.map(h => escapeCSV(record[h] || ''));
        csvRows.push(row.join(','));
    }

    return csvRows.join('\n');
}

// Main export function
function exportToExcel() {
    console.log('Parsing property data from PDF extract...');

    const pages = splitIntoPages(extractedText);
    console.log(`Found ${pages.length} property pages`);

    const records: Record<string, string>[] = [];

    for (let i = 0; i < pages.length; i++) {
        const data = parsePropertyPage(pages[i]);
        if (data['Property Address']) {
            records.push(data);
        }
    }

    console.log(`Parsed ${records.length} records`);

    // Generate CSV
    const csv = generateCSV(records);

    // Write to file
    const filename = 'property_list.csv';
    writeFileSync(filename, csv, 'utf-8');

    console.log(`\n=== Export Complete ===`);
    console.log(`Created: ${filename}`);
    console.log(`Records: ${records.length}`);
    console.log(`Columns: ${Object.keys(records[0] || {}).length}`);
    console.log(`\nOpen ${filename} in Excel to view the data.`);
}

// Run export
exportToExcel();
