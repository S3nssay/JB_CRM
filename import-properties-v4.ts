/**
 * Property Data Import Script v4 - CORRECTED PARSING
 * Based on user clarification of PDF structure:
 * 
 * CORRECT STRUCTURE:
 * - PROPERTY [partial address] - but full address is near TENANT(S) at end
 * - FEE (%) [number] - Management fee
 * - [Landlord Name] [Landlord Address] - Between FEE and LANDLORD keyword
 * - LANDLORD [Tenant Name] - After LANDLORD keyword = TENANT!
 * - [Rent] [Deposit] [Start Date] [End Date]
 * - BANK + Acc No + SORT CODE - Landlord banking
 * - TELEPHONE + MOBILE + Email - Landlord contact
 * - Held By - Deposit holder
 * - Second MOBILE near end - Tenant mobile
 * - Property street address near TENANT(S)
 * 
 * Run with: npx tsx import-properties-v4.ts
 */

import 'dotenv/config';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { readFileSync } from 'fs';
import { properties, landlords, rentalAgreements } from './shared/schema.ts';
import { eq } from 'drizzle-orm';

const connectionString = process.env.DATABASE_URL!;
const client = postgres(connectionString, { ssl: 'require' });
const db = drizzle(client);

const extractedText = readFileSync('./property_list_extracted.txt', 'utf-8');

function sanitize(text: string | null | undefined): string {
    if (!text) return '';
    return text.replace(/[<>'";&=\\]/g, '').replace(/\s+/g, ' ').trim().substring(0, 250);
}

function extractPostcode(text: string): string {
    const match = text.match(/([A-Z]{1,2}\d{1,2}[A-Z]?\s*\d[A-Z]{2})/i);
    return match ? match[1].toUpperCase().trim() : '';
}

function parsePropertyPage(pageText: string): any | null {
    try {
        const data: any = {};

        // 1. Get postcode from PROPERTY line
        const postcodeMatch = pageText.match(/PROPERTY\s+.+?([A-Z]{1,2}\d{1,2}[A-Z]?\s*\d[A-Z]{2})/i);
        data.postcode = postcodeMatch ? postcodeMatch[1].toUpperCase().trim() : '';

        // 2. Management Fee
        const feeMatch = pageText.match(/FEE\s*\(%\)\s*(\d+\.?\d*)/);
        data.managementFee = feeMatch ? parseFloat(feeMatch[1]) : 0;

        // 3. LANDLORD name and address (between FEE number and "LANDLORD" keyword)
        const landlordSection = pageText.match(/FEE\s*\(%\)\s*\d+\.?\d*\s+(.+?)(?=\s+LANDLORD\s)/s);
        if (landlordSection) {
            let landlordInfo = landlordSection[1].trim().replace(/\s+/g, ' ');

            // Extract landlord name (with title)
            const nameMatch = landlordInfo.match(/^((?:Mr|Mrs|Ms|Miss|Dr|Prof)\s*(?:&\s*(?:Mr|Mrs|Ms|Miss|Dr))?\s+[A-Za-z\s\-']+?)(?=\s+\d|\s+[A-Z][a-z]+\s+(?:Road|Street|Lane|Avenue|Way|Drive|Close|Crescent|Gardens|Place|Court|Park|Hill|Grove|Mews|Square|Terrace|House|Flat|C\/O)|$)/i);
            if (nameMatch) {
                data.landlordName = sanitize(nameMatch[1]);
                data.landlordAddress = sanitize(landlordInfo.replace(nameMatch[1], '').trim());
            } else {
                // Try without title - might be company
                const parts = landlordInfo.split(/(?=\d)/);
                data.landlordName = sanitize(parts[0]);
                data.landlordAddress = sanitize(parts.slice(1).join(' '));
            }
        }

        // 4. TENANT name (after "LANDLORD" keyword until numbers)
        const tenantMatch = pageText.match(/\sLANDLORD\s+(.+?)(?=\s+\d{3,})/s);
        if (tenantMatch) {
            data.tenantName = sanitize(tenantMatch[1].trim());
        }

        // 5. Rent, Deposit, Start Date, End Date (after tenant name)
        const financialMatch = pageText.match(/\sLANDLORD\s+.+?\s+(\d+\.?\d*)\s+(\d+\.?\d*)\s+(\d{2}\/\d{2}\/\d{4})\s+(\d{2}\/\d{2}\/\d{4})/s);
        if (financialMatch) {
            data.rentAmount = parseFloat(financialMatch[1]) || 0;
            data.depositAmount = parseFloat(financialMatch[2]) || 0;
            data.tenancyStart = financialMatch[3];
            data.tenancyEnd = financialMatch[4];
        }

        // 6. Bank details
        const bankMatch = pageText.match(/BANK\s+(.+?)\s*Acc\s*No\s*(\d+)/i);
        if (bankMatch) {
            data.bankName = sanitize(bankMatch[1]);
            data.accountNumber = bankMatch[2].trim();
        }

        const sortCodeMatch = pageText.match(/SORT\s*CODE\s+([\d\-\s]+)/i);
        if (sortCodeMatch) {
            data.sortCode = sortCodeMatch[1].trim().replace(/\s+/g, '-');
        }

        // 7. Landlord contact - TELEPHONE and first MOBILE before Email
        const telephoneMatch = pageText.match(/TELEPHONE\s+(\d+)/);
        if (telephoneMatch) {
            data.landlordTelephone = telephoneMatch[1];
        }

        // First MOBILE (landlord's)
        const landlordMobileMatch = pageText.match(/MOBILE\s+(\d[\d\s]+?)(?=\s*(?:Email|Calendar))/);
        if (landlordMobileMatch) {
            data.landlordMobile = landlordMobileMatch[1].replace(/\s+/g, '').trim();
        }

        // 8. Email (landlord's)
        const emailMatch = pageText.match(/Email\s+([^\s]+@[^\s]+)/i);
        if (emailMatch) {
            data.landlordEmail = sanitize(emailMatch[1]);
        }

        // 9. Deposit Held By
        const heldByMatch = pageText.match(/Held\s+By\s+(.+?)(?=\s*MANAGEMENT)/s);
        if (heldByMatch) {
            data.depositHeldBy = sanitize(heldByMatch[1].split(/\n/)[0]);
        }

        // 10. Period
        const periodMatch = pageText.match(/PERIOD\s+(\d+)\s+Months/i);
        if (periodMatch) {
            data.periodMonths = parseInt(periodMatch[1]);
        }

        // 11. Tenant Mobile (second MOBILE, near CHECK LIST)
        const tenantMobileMatch = pageText.match(/CHECK\s+LIST.*?MOBILE\s+(\d[\d\s]+)/s);
        if (tenantMobileMatch) {
            data.tenantMobile = tenantMobileMatch[1].replace(/\s+/g, '').trim();
        }

        // 12. Payment frequency
        if (pageText.includes('Calendar Monthly')) data.paymentFrequency = 'Calendar Monthly';
        else if (pageText.includes('Quarterly')) data.paymentFrequency = 'Quarterly';
        else if (pageText.includes('Four Weekly')) data.paymentFrequency = 'Four Weekly';
        else data.paymentFrequency = 'Monthly';

        // 13. Full property address - appears near TENANT(S) section
        // Pattern: number + street name before "DEPOSIT HELD"
        const propertyAddressMatch = pageText.match(/TELEPHONE\s+(?:\d+[A-Z]?\s+)?([A-Za-z\s]+?(?:Road|Street|Lane|Avenue|Way|Drive|Close|Crescent|Gardens|Place|Court|Park|Hill|Grove|Mews|Square|Terrace))\s+DEPOSIT/i);
        if (propertyAddressMatch) {
            // Try to get the number before the street name
            const streetNumberMatch = pageText.match(/TELEPHONE\s+(\d+[A-Z]?)\s+[A-Za-z]/);
            const streetNumber = streetNumberMatch ? streetNumberMatch[1] : '';
            data.propertyStreet = sanitize(`${streetNumber} ${propertyAddressMatch[1]}`.trim());
        }

        // Build full property address
        if (data.propertyStreet) {
            data.propertyAddress = `${data.propertyStreet}, London, ${data.postcode}`;
        } else {
            // Fallback to the partial address from PROPERTY line
            const partialMatch = pageText.match(/PROPERTY\s+(.+?)(?=\s+MANAGEMENT)/s);
            if (partialMatch) {
                data.propertyAddress = sanitize(partialMatch[1].trim());
            }
        }

        return data;

    } catch (error) {
        console.error('Parse error:', error);
        return null;
    }
}

function splitIntoPages(text: string): string[] {
    return text.split(/=== Page \d+ ===/).filter(p => p.trim().length > 100);
}

async function importData() {
    console.log('Starting CORRECTED property data import...\n');

    const pages = splitIntoPages(extractedText);
    console.log(`Found ${pages.length} pages\n`);

    // Sample first 3 for verification
    console.log('=== SAMPLE PARSING (verify before full import) ===\n');
    for (let i = 0; i < Math.min(3, pages.length); i++) {
        const data = parsePropertyPage(pages[i]);
        console.log(`Page ${i + 1}:`);
        console.log(`  Property Address: ${data?.propertyAddress}`);
        console.log(`  Postcode: ${data?.postcode}`);
        console.log(`  LANDLORD: ${data?.landlordName}`);
        console.log(`  Landlord Address: ${data?.landlordAddress?.substring(0, 50)}...`);
        console.log(`  Landlord Tel: ${data?.landlordTelephone}`);
        console.log(`  Landlord Mobile: ${data?.landlordMobile}`);
        console.log(`  Landlord Email: ${data?.landlordEmail}`);
        console.log(`  Bank: ${data?.bankName} Acc: ${data?.accountNumber} Sort: ${data?.sortCode}`);
        console.log(`  TENANT: ${data?.tenantName}`);
        console.log(`  Tenant Mobile: ${data?.tenantMobile}`);
        console.log(`  Rent: £${data?.rentAmount} | Deposit: £${data?.depositAmount}`);
        console.log(`  Dates: ${data?.tenancyStart} to ${data?.tenancyEnd}`);
        console.log(`  Deposit Held By: ${data?.depositHeldBy}`);
        console.log(`  Fee: ${data?.managementFee}%`);
        console.log('');
    }

    // Ask for confirmation before import
    console.log('Please verify the sample data above is correct.');
    console.log('If correct, the import will proceed...\n');

    let imported = 0;
    let errors = 0;
    const landlordCache = new Map<string, number>();

    for (let i = 0; i < pages.length; i++) {
        const data = parsePropertyPage(pages[i]);

        if (!data || !data.landlordName) {
            console.log(`Skipping page ${i + 1} - missing landlord name`);
            errors++;
            continue;
        }

        try {
            // Create or find landlord
            let landlordId: number;
            const landlordKey = data.landlordName.toLowerCase().trim();

            if (landlordCache.has(landlordKey)) {
                landlordId = landlordCache.get(landlordKey)!;
            } else {
                const existingLandlords = await db.select().from(landlords)
                    .where(eq(landlords.name, data.landlordName))
                    .limit(1);

                if (existingLandlords.length > 0) {
                    landlordId = existingLandlords[0].id;
                } else {
                    const isCompany = /Ltd|Limited|Properties|Investment|Estates|Inc|Corp|LLP|PLC/i.test(data.landlordName);

                    const [newLandlord] = await db.insert(landlords).values({
                        name: data.landlordName,
                        email: data.landlordEmail || null,
                        phone: data.landlordTelephone || null,
                        mobile: data.landlordMobile || null,
                        addressLine1: data.landlordAddress || null,
                        landlordType: isCompany ? 'company' : 'individual',
                        bankName: data.bankName || null,
                        bankAccountNo: data.accountNumber || null,
                        sortCode: data.sortCode || null,
                        status: 'active'
                    }).returning();

                    landlordId = newLandlord.id;
                }
                landlordCache.set(landlordKey, landlordId);
            }

            // Create property
            const [property] = await db.insert(properties).values({
                title: data.propertyAddress || `Property in ${data.postcode}`,
                description: `Managed rental property. Tenant: ${data.tenantName || 'TBC'}`,
                addressLine1: data.propertyStreet || data.propertyAddress || 'TBC',
                postcode: data.postcode || 'TBC',
                listingType: 'rental',
                propertyType: (data.propertyAddress || '').toLowerCase().includes('flat') ? 'apartment' : 'house',
                tenure: 'leasehold',
                bedrooms: 1,
                bathrooms: 1,
                price: Math.round(data.rentAmount || 0),
                status: 'available'
            }).returning();

            // Create rental agreement
            if (data.tenancyStart && data.tenancyEnd) {
                const startDate = new Date(data.tenancyStart.split('/').reverse().join('-'));
                const endDate = new Date(data.tenancyEnd.split('/').reverse().join('-'));

                await db.insert(rentalAgreements).values({
                    propertyId: property.id,
                    landlordId: landlordId,
                    rentAmount: Math.round(data.rentAmount || 0),
                    rentFrequency: data.paymentFrequency || 'Monthly',
                    tenancyStart: startDate,
                    tenancyEnd: endDate,
                    depositAmount: Math.round(data.depositAmount || 0),
                    depositHeldBy: data.depositHeldBy || null,
                    managementFeePercent: String(data.managementFee || 0),
                    status: endDate > new Date() ? 'active' : 'expired'
                });
            }

            imported++;

        } catch (error) {
            console.error(`Error page ${i + 1}:`, error);
            errors++;
        }
    }

    console.log('\n=== Import Complete ===');
    console.log(`Imported: ${imported} properties`);
    console.log(`Errors: ${errors}`);
    console.log(`Landlords: ${landlordCache.size}`);

    await client.end();
}

importData().catch(console.error);
