/**
 * Property Data Import Script v3 - ACCURATE PARSING
 * 
 * PDF Structure Analysis:
 * - "PROPERTY [address] [postcode]" - Property address
 * - "FEE (%) [number]" - Management fee percentage  
 * - Between FEE and LANDLORD - TENANT info (name + address)
 * - "LANDLORD [name]" - Landlord name (can be individual or Ltd)
 * - [deposit] [rent] [start_date] [end_date] - Financial values
 * - "BANK [name] Acc No [num] SORT CODE [code]" - Banking
 * - "Email [email]" - Landlord email
 * - "Held By [type]" - Deposit holder
 * - "PERIOD [num] Months" - Tenancy period
 * 
 * Run with: npx tsx import-properties-v3.ts
 */

import 'dotenv/config';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { readFileSync } from 'fs';
import { properties, landlords, rentalAgreements } from './shared/schema.ts';
import { eq } from 'drizzle-orm';

// Database connection
const connectionString = process.env.DATABASE_URL!;
const client = postgres(connectionString, { ssl: 'require' });
const db = drizzle(client);

// Read the extracted text file
const extractedText = readFileSync('./property_list_extracted.txt', 'utf-8');

// Sanitize text
function sanitize(text: string | null | undefined): string {
    if (!text) return '';
    return text
        .replace(/[<>'";&=\\]/g, '')
        .replace(/\s+/g, ' ')
        .trim()
        .substring(0, 250);
}

// Parse UK postcode from text
function extractPostcode(text: string): string {
    const match = text.match(/([A-Z]{1,2}\d{1,2}[A-Z]?\s*\d[A-Z]{2})/i);
    return match ? match[1].toUpperCase().trim() : '';
}

// Parse a single property page with CORRECTED field identification
function parsePropertyPage(pageText: string): any | null {
    try {
        const data: any = {};

        // 1. Extract PROPERTY ADDRESS (between "PROPERTY" and "MANAGEMENT/LET")
        const propertyMatch = pageText.match(/PROPERTY\s+(.+?)(?=MANAGEMENT\/LET)/s);
        if (propertyMatch) {
            let address = propertyMatch[1].trim().replace(/\s+/g, ' ');
            data.propertyAddress = sanitize(address);
            data.postcode = extractPostcode(address);
        }

        // 2. Extract MANAGEMENT FEE (%)
        const feeMatch = pageText.match(/FEE\s*\(%\)\s*(\d+\.?\d*)/);
        data.managementFee = feeMatch ? parseFloat(feeMatch[1]) : 0;

        // 3. Extract TENANT NAME & ADDRESS (BETWEEN fee number and "LANDLORD")
        // This is the data BEFORE "LANDLORD" keyword - it's the tenant info!
        const tenantSection = pageText.match(/FEE\s*\(%\)\s*\d+\.?\d*\s+(.+?)(?=LANDLORD)/s);
        if (tenantSection) {
            let tenantInfo = tenantSection[1].trim().replace(/\s+/g, ' ');
            // Extract just the name part (before any address-looking content)
            // Try to find where address starts (usually a number or known address word)
            const nameMatch = tenantInfo.match(/^((?:Mr|Mrs|Ms|Miss|Dr|Prof)\s+.+?)(?=\d|C\/O|PO Box|Flat|House|Lane|Road|Street|Avenue|Way|Drive|Close|Gardens|Place|Court|Crescent|Park|Square|Terrace|Mews|Hill|Grove|$)/i);
            if (nameMatch) {
                data.tenantName = sanitize(nameMatch[1]);
            } else {
                // If no title, try first few words
                const words = tenantInfo.split(' ').slice(0, 4).join(' ');
                data.tenantName = sanitize(words);
            }
            data.tenantAddress = sanitize(tenantInfo);
        }

        // 4. Extract LANDLORD NAME (after "LANDLORD" until numbers or phone)
        const landlordMatch = pageText.match(/LANDLORD\s+(.+?)(?=\d{4,}|\+?\d{9,}|ADDRESS)/s);
        if (landlordMatch) {
            let landlordName = landlordMatch[1].trim().replace(/\s+/g, ' ');
            // Clean up - remove any trailing numbers or phone patterns
            landlordName = landlordName.replace(/\s*\d{3,}.*$/, '').trim();
            data.landlordName = sanitize(landlordName);
        }

        // 5. Extract DEPOSIT, RENT, START DATE, END DATE
        // Pattern: [deposit] [rent] [dd/mm/yyyy] [dd/mm/yyyy]
        const financialMatch = pageText.match(/LANDLORD\s+.+?\s+(\d+\.?\d*)\s+(\d+\.?\d*)\s+(\d{2}\/\d{2}\/\d{4})\s+(\d{2}\/\d{2}\/\d{4})/s);
        if (financialMatch) {
            data.depositAmount = parseFloat(financialMatch[1]) || 0;
            data.rentAmount = parseFloat(financialMatch[2]) || 0;
            data.tenancyStart = financialMatch[3];
            data.tenancyEnd = financialMatch[4];
        }

        // 6. Extract BANK details
        const bankMatch = pageText.match(/(?:ADDRESS\s+)?BANK\s+(.+?)\s+Acc\s*No\s*(\d+)/i);
        if (bankMatch) {
            data.bankName = sanitize(bankMatch[1]);
            data.accountNumber = bankMatch[2].trim();
        }

        const sortCodeMatch = pageText.match(/SORT\s*CODE\s+([\d\-\s]+)/i);
        if (sortCodeMatch) {
            data.sortCode = sortCodeMatch[1].trim().replace(/\s+/g, '');
        }

        // 7. Extract EMAIL (landlord's email)
        const emailMatch = pageText.match(/Email\s+([^\s]+@[^\s]+)/i);
        if (emailMatch) {
            data.landlordEmail = sanitize(emailMatch[1]);
        }

        // 8. Extract MOBILE (landlord's mobile - the one after MOBILE keyword near email)
        // There can be multiple MOBILE entries - we want the landlord's one
        const landlordMobileMatch = pageText.match(/MOBILE\s+(\d[\d\s]+?)(?:\s+Email|\s+Calendar)/);
        if (landlordMobileMatch) {
            data.landlordMobile = landlordMobileMatch[1].replace(/\s+/g, '').trim();
        }

        // 9. Extract DEPOSIT HELD BY
        const heldByMatch = pageText.match(/Held\s+By\s+(.+?)(?=MANAGEMENT)/s);
        if (heldByMatch) {
            data.depositHeldBy = sanitize(heldByMatch[1].split(/\n/)[0]);
        }

        // 10. Extract PERIOD (months)
        const periodMatch = pageText.match(/PERIOD\s+(\d+)\s+Months/i);
        if (periodMatch) {
            data.periodMonths = parseInt(periodMatch[1]);
        }

        // 11. Extract PAYMENT FREQUENCY
        if (pageText.includes('Calendar Monthly')) data.paymentFrequency = 'Calendar Monthly';
        else if (pageText.includes('Quarterly')) data.paymentFrequency = 'Quarterly';
        else if (pageText.includes('Four Weekly')) data.paymentFrequency = 'Four Weekly';
        else if (pageText.includes('Annually')) data.paymentFrequency = 'Annually';
        else data.paymentFrequency = 'Monthly';

        return data;

    } catch (error) {
        console.error('Error parsing page:', error);
        return null;
    }
}

// Split text into pages
function splitIntoPages(text: string): string[] {
    const pages = text.split(/=== Page \d+ ===/);
    return pages.filter(p => p.trim().length > 100);
}

// Main import function
async function importData() {
    console.log('Starting ACCURATE property data import...\n');

    const pages = splitIntoPages(extractedText);
    console.log(`Found ${pages.length} property pages to import\n`);

    let imported = 0;
    let errors = 0;
    const landlordCache = new Map<string, number>();

    // Sample output for first 3 pages to verify parsing
    console.log('=== SAMPLE PARSING (first 3 pages) ===\n');
    for (let i = 0; i < Math.min(3, pages.length); i++) {
        const data = parsePropertyPage(pages[i]);
        console.log(`Page ${i + 1}:`);
        console.log(`  Property: ${data?.propertyAddress}`);
        console.log(`  Postcode: ${data?.postcode}`);
        console.log(`  Landlord: ${data?.landlordName}`);
        console.log(`  Tenant: ${data?.tenantName}`);
        console.log(`  Rent: £${data?.rentAmount}`);
        console.log(`  Deposit: £${data?.depositAmount}`);
        console.log(`  Fee: ${data?.managementFee}%`);
        console.log(`  Dates: ${data?.tenancyStart} to ${data?.tenancyEnd}`);
        console.log('');
    }

    console.log('=== IMPORTING DATA ===\n');

    for (let i = 0; i < pages.length; i++) {
        const data = parsePropertyPage(pages[i]);

        if (!data || !data.propertyAddress || !data.landlordName) {
            console.log(`Skipping page ${i + 1} - missing required data`);
            errors++;
            continue;
        }

        try {
            // 1. Create or find landlord
            let landlordId: number;
            const landlordKey = data.landlordName.toLowerCase().trim();

            if (landlordCache.has(landlordKey)) {
                landlordId = landlordCache.get(landlordKey)!;
            } else {
                // Check if landlord exists
                const existingLandlords = await db.select().from(landlords)
                    .where(eq(landlords.name, data.landlordName))
                    .limit(1);

                if (existingLandlords.length > 0) {
                    landlordId = existingLandlords[0].id;
                } else {
                    const isCompany = data.landlordName.includes('Ltd') ||
                        data.landlordName.includes('Limited') ||
                        data.landlordName.includes('Properties') ||
                        data.landlordName.includes('Investment') ||
                        data.landlordName.includes('Estates');

                    const [newLandlord] = await db.insert(landlords).values({
                        name: data.landlordName,
                        email: data.landlordEmail || null,
                        mobile: data.landlordMobile || null,
                        landlordType: isCompany ? 'company' : 'individual',
                        bankName: data.bankName || null,
                        bankAccountNo: data.accountNumber || null,
                        sortCode: data.sortCode || null,
                        status: 'active'
                    }).returning();

                    landlordId = newLandlord.id;
                    console.log(`Created landlord: ${data.landlordName}`);
                }
                landlordCache.set(landlordKey, landlordId);
            }

            // 2. Create property
            const [property] = await db.insert(properties).values({
                title: data.propertyAddress || 'Property',
                description: `Managed rental property at ${data.propertyAddress}`,
                addressLine1: data.propertyAddress,
                postcode: data.postcode || 'TBC',
                listingType: 'rental',
                propertyType: data.propertyAddress.toLowerCase().includes('flat') ? 'apartment' : 'house',
                tenure: 'leasehold',
                bedrooms: 1,
                bathrooms: 1,
                price: Math.round(data.rentAmount || 0), // Store as pounds, not pence
                status: 'available'
            }).returning();

            // 3. Create rental agreement
            if (data.tenancyStart && data.tenancyEnd) {
                const startDate = new Date(data.tenancyStart.split('/').reverse().join('-'));
                const endDate = new Date(data.tenancyEnd.split('/').reverse().join('-'));

                await db.insert(rentalAgreements).values({
                    propertyId: property.id,
                    landlordId: landlordId,
                    rentAmount: Math.round(data.rentAmount || 0), // Store as pounds
                    rentFrequency: data.paymentFrequency || 'Monthly',
                    tenancyStart: startDate,
                    tenancyEnd: endDate,
                    depositAmount: Math.round(data.depositAmount || 0), // Store as pounds
                    depositHeldBy: data.depositHeldBy || null,
                    managementFeePercent: String(data.managementFee || 0),
                    status: endDate > new Date() ? 'active' : 'expired'
                });
            }

            imported++;
            if (imported % 20 === 0) {
                console.log(`Imported ${imported} properties...`);
            }

        } catch (error) {
            console.error(`Error importing page ${i + 1}:`, error);
            errors++;
        }
    }

    console.log('\n=== Import Complete ===');
    console.log(`Successfully imported: ${imported} properties`);
    console.log(`Errors: ${errors}`);
    console.log(`Unique landlords created: ${landlordCache.size}`);

    await client.end();
}

// Run import
importData().catch(console.error);
