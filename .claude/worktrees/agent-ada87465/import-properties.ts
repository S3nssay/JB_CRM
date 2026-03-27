/**
 * Property Data Import Script (v2 - Fixed Schema)
 * Parses property_list_extracted.txt and imports data into the database
 * 
 * Run with: npx tsx import-properties.ts
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

// Sanitize text to prevent SQL issues
function sanitize(text: string | null | undefined): string {
    if (!text) return '';
    return text
        .replace(/[<>'";&=\\]/g, '') // Remove special SQL chars
        .replace(/\s+/g, ' ')          // Normalize whitespace
        .trim()
        .substring(0, 250);            // Limit length
}

// Parse a single property page
function parsePropertyPage(pageText: string): any | null {
    try {
        // Extract key fields using regex patterns
        const propertyMatch = pageText.match(/PROPERTY\s+(.+?)(?=MANAGEMENT\/LET|LANDLORD)/s);
        const feeMatch = pageText.match(/FEE \(%\)\s*(\d+\.?\d*)/);
        const landlordMatch = pageText.match(/LANDLORD\s+(.+?)(?=\d{4}|\d{3,}\.?\d*\s+\d)/s);
        const tenancyStartMatch = pageText.match(/(\d{2}\/\d{2}\/\d{4})\s+\d{2}\/\d{2}\/\d{4}/);
        const tenancyEndMatch = pageText.match(/\d{2}\/\d{2}\/\d{4}\s+(\d{2}\/\d{2}\/\d{4})/);
        const bankMatch = pageText.match(/BANK\s+(.+?)Acc No\s*(\d+)/);
        const sortCodeMatch = pageText.match(/SORT CODE\s+([\d-]+)/);
        const mobileMatch = pageText.match(/MOBILE\s+([\d\s+]+)/);
        const emailMatch = pageText.match(/Email\s+([^\s]+@[^\s]+)/);
        const depositHeldMatch = pageText.match(/Held By\s+(.+?)(?=MANAGEMENT)/s);
        const periodMatch = pageText.match(/PERIOD\s+(\d+)\s+Months/);

        // Extract property address parts
        let propertyAddress = propertyMatch ? propertyMatch[1].trim().replace(/\s+/g, ' ') : '';
        propertyAddress = propertyAddress.split('MANAGEMENT')[0].trim();

        // Extract postcode
        const postcodeMatch = propertyAddress.match(/([A-Z]{1,2}\d{1,2}[A-Z]?\s*\d[A-Z]{2})/i);
        const postcode = postcodeMatch ? postcodeMatch[1].toUpperCase() : '';

        // Parse landlord name
        let landlordName = landlordMatch ? landlordMatch[1].trim().replace(/\s+/g, ' ') : '';
        landlordName = landlordName.split(/\d{4}|ADDRESS/)[0].trim();

        // Parse rent - find two numbers separated by space before dates
        const rentValues = pageText.match(/(\d+\.?\d*)\s+(\d+\.?\d*)\s+\d{2}\/\d{2}\/\d{4}/);
        let rentAmount = 0;
        let depositAmount = 0;
        if (rentValues) {
            depositAmount = parseFloat(rentValues[1]) || 0;
            rentAmount = parseFloat(rentValues[2]) || 0;
        }

        // Get management fee
        const feePercentage = feeMatch ? parseFloat(feeMatch[1]) : 0;

        // Get deposit held by
        let depositHeldBy = depositHeldMatch ? depositHeldMatch[1].trim() : 'Unknown';
        depositHeldBy = depositHeldBy.split('\n')[0].trim();

        // Mobile/phone
        const mobile = mobileMatch ? mobileMatch[1].trim().replace(/\s+/g, '') : '';

        // Email
        const email = emailMatch ? emailMatch[1].trim() : '';

        // Bank details
        const bankName = bankMatch ? bankMatch[1].trim() : '';
        const accountNumber = bankMatch ? bankMatch[2].trim() : '';
        const sortCode = sortCodeMatch ? sortCodeMatch[1].trim() : '';

        // Parse tenancy dates
        const tenancyStart = tenancyStartMatch ? tenancyStartMatch[1] : null;
        const tenancyEnd = tenancyEndMatch ? tenancyEndMatch[1] : null;

        return {
            propertyAddress: sanitize(propertyAddress),
            postcode: sanitize(postcode),
            landlordName: sanitize(landlordName),
            rentAmount,
            depositAmount,
            tenancyStart,
            tenancyEnd,
            feePercentage,
            depositHeldBy: sanitize(depositHeldBy),
            mobile: sanitize(mobile),
            email: sanitize(email),
            bankName: sanitize(bankName),
            accountNumber: sanitize(accountNumber),
            sortCode: sanitize(sortCode),
            periodMonths: periodMatch ? parseInt(periodMatch[1]) : 12
        };
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
    console.log('Starting property data import...');

    const pages = splitIntoPages(extractedText);
    console.log(`Found ${pages.length} property pages to import`);

    let imported = 0;
    let errors = 0;
    const landlordCache = new Map<string, number>(); // name -> id

    for (let i = 0; i < pages.length; i++) {
        const data = parsePropertyPage(pages[i]);

        if (!data || !data.propertyAddress) {
            console.log(`Skipping page ${i + 1} - could not parse`);
            errors++;
            continue;
        }

        try {
            // 1. Create or get landlord
            let landlordId: number;
            const landlordKey = data.landlordName.toLowerCase();

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
                    // Create landlord - use correct field names from schema
                    const isCompany = data.landlordName.includes('Ltd') ||
                        data.landlordName.includes('Limited') ||
                        data.landlordName.includes('Properties') ||
                        data.landlordName.includes('Investment');

                    const [newLandlord] = await db.insert(landlords).values({
                        name: data.landlordName || 'Unknown Landlord',
                        email: data.email || null,
                        mobile: data.mobile || null,
                        landlordType: isCompany ? 'company' : 'individual',
                        bankName: data.bankName || null,
                        bankAccountNo: data.accountNumber || null,
                        sortCode: data.sortCode || null
                    }).returning();

                    landlordId = newLandlord.id;
                    console.log(`Created landlord: ${data.landlordName}`);
                }
                landlordCache.set(landlordKey, landlordId);
            }

            // 2. Create property - use correct field names from schema
            const cleanAddress = data.propertyAddress || 'Managed Property';

            const [property] = await db.insert(properties).values({
                title: cleanAddress,
                description: `Managed rental property at ${cleanAddress}`,
                addressLine1: cleanAddress,
                postcode: data.postcode || 'TBC',
                listingType: 'rental',
                propertyType: cleanAddress.toLowerCase().includes('flat') ? 'apartment' : 'house',
                tenure: 'leasehold',
                bedrooms: 1,
                bathrooms: 1,
                price: Math.round((data.rentAmount || 1000) * 100), // Convert to pence
                status: 'available',
                propertyManagerId: null
            }).returning();

            console.log(`Created property: ${cleanAddress.substring(0, 50)}...`);

            // 3. Create rental agreement to link property and landlord
            if (data.tenancyStart && data.tenancyEnd) {
                const startDate = new Date(data.tenancyStart.split('/').reverse().join('-'));
                const endDate = new Date(data.tenancyEnd.split('/').reverse().join('-'));

                await db.insert(rentalAgreements).values({
                    propertyId: property.id,
                    landlordId: landlordId,
                    rentAmount: Math.round((data.rentAmount || 0) * 100), // Convert to pence
                    rentFrequency: 'Monthly',
                    tenancyStart: startDate,
                    tenancyEnd: endDate,
                    depositAmount: Math.round((data.depositAmount || 0) * 100),
                    depositHeldBy: data.depositHeldBy || null,
                    managementFeePercent: String(data.feePercentage || 0),
                    status: endDate > new Date() ? 'active' : 'expired'
                });
                console.log(`Created rental agreement for property ${property.id}`);
            }

            imported++;

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
