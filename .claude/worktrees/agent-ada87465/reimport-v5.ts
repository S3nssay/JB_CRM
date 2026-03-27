/**
 * Delete Property Data + Reimport v5
 * 
 * Property Address extraction: appears after "TELEPHONE" near end, before "DEPOSIT HELD"
 * Pattern: TENANT(S)...TELEPHONE [property_address] DEPOSIT HELD
 * 
 * Run with: npx tsx reimport-v5.ts
 */

import 'dotenv/config';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { readFileSync } from 'fs';
import { properties, landlords, rentalAgreements } from './shared/schema.ts';
import { eq, sql } from 'drizzle-orm';

const connectionString = process.env.DATABASE_URL!;
const client = postgres(connectionString, { ssl: 'require' });
const db = drizzle(client);

const extractedText = readFileSync('./property_list_extracted.txt', 'utf-8');

function sanitize(text: string | null | undefined): string {
    if (!text) return '';
    return text.replace(/[<>'";&=\\]/g, '').replace(/\s+/g, ' ').trim().substring(0, 250);
}

function parsePropertyPage(pageText: string): any | null {
    try {
        const data: any = {};

        // 1. PROPERTY ADDRESS - appears after "TELEPHONE" near end, before "DEPOSIT HELD"
        // Pattern: TENANT(S) TENANCY PERIOD RENT AMOUNT TELEPHONE [address] DEPOSIT HELD
        const propertyAddressMatch = pageText.match(/TENANT\(S\).*?TELEPHONE\s+(\d+[A-Za-z]?\s+[A-Za-z\s]+?)(?=\s+DEPOSIT\s+HELD)/s);
        if (propertyAddressMatch) {
            data.propertyAddress = sanitize(propertyAddressMatch[1]);
        }

        // 2. POSTCODE - from PROPERTY line at start
        const postcodeMatch = pageText.match(/PROPERTY.*?([A-Z]{1,2}\d{1,2}[A-Z]?\s*\d[A-Z]{2})/i);
        data.postcode = postcodeMatch ? postcodeMatch[1].toUpperCase().trim() : '';

        // 3. Management Fee
        const feeMatch = pageText.match(/FEE\s*\(%\)\s*(\d+\.?\d*)/);
        data.managementFee = feeMatch ? parseFloat(feeMatch[1]) : 0;

        // 4. LANDLORD NAME (between fee and "LANDLORD" keyword)
        // The landlord name/address is between the fee percentage and the word "LANDLORD"
        const landlordSection = pageText.match(/FEE\s*\(%\)\s*\d+\.?\d*\s+(.+?)\s+LANDLORD\s/s);
        if (landlordSection) {
            let landlordInfo = landlordSection[1].trim();
            // Try to extract name with title
            const nameMatch = landlordInfo.match(/^((?:Mr|Mrs|Ms|Miss|Dr|Prof)?\s*(?:&\s*(?:Mr|Mrs|Ms|Miss|Dr))?\s*[A-Za-z\s\-'\u0026]+?)(?=\s+\d|\s+[A-Z][a-z]+(?:\s+[A-Z][a-z]+)?\s+(?:Road|Street|Lane|Avenue|Way|Drive|Close|Crescent|House|Flat|C\/O)|$)/i);
            if (nameMatch) {
                data.landlordName = sanitize(nameMatch[1]);
                data.landlordAddress = sanitize(landlordInfo.substring(nameMatch[1].length).trim());
            } else {
                // Split on common address starters
                const addressStart = landlordInfo.search(/\d+\s|C\/O|PO\s+Box|Flat\s|House\s/i);
                if (addressStart > 0) {
                    data.landlordName = sanitize(landlordInfo.substring(0, addressStart));
                    data.landlordAddress = sanitize(landlordInfo.substring(addressStart));
                } else {
                    data.landlordName = sanitize(landlordInfo);
                }
            }
        }

        // 5. TENANT NAME (after "LANDLORD" keyword until first number)
        const tenantMatch = pageText.match(/\sLANDLORD\s+(.+?)(?=\s+\d{3,})/s);
        if (tenantMatch) {
            data.tenantName = sanitize(tenantMatch[1].trim());
        }

        // 6. Rent, Deposit, Dates (after tenant name)
        const financialMatch = pageText.match(/LANDLORD\s+.+?\s+(\d+\.?\d*)\s+(\d+\.?\d*)\s+(\d{2}\/\d{2}\/\d{4})\s+(\d{2}\/\d{2}\/\d{4})/s);
        if (financialMatch) {
            data.rentAmount = parseFloat(financialMatch[1]) || 0;
            data.depositAmount = parseFloat(financialMatch[2]) || 0;
            data.tenancyStart = financialMatch[3];
            data.tenancyEnd = financialMatch[4];
        }

        // 7. Bank details
        const bankMatch = pageText.match(/BANK\s+([A-Za-z\s]+?)\s*Acc\s*No\s*(\d+)/i);
        if (bankMatch) {
            data.bankName = sanitize(bankMatch[1]);
            data.accountNumber = bankMatch[2].trim();
        }

        const sortCodeMatch = pageText.match(/SORT\s*CODE\s+([\d\-\s]+)/i);
        if (sortCodeMatch) {
            data.sortCode = sortCodeMatch[1].replace(/\s+/g, '-').trim();
        }

        // 8. Landlord TELEPHONE (first one, right after SORT CODE area)
        const telephoneMatch = pageText.match(/SORT\s*CODE.*?TELEPHONE\s+(\d{10,})/);
        if (telephoneMatch) {
            data.landlordTelephone = telephoneMatch[1];
        }

        // 9. Landlord MOBILE (first MOBILE before Email)
        const mobileMatch = pageText.match(/MOBILE\s+(\d[\d\s]+?)(?=\s*Email)/);
        if (mobileMatch) {
            data.landlordMobile = mobileMatch[1].replace(/\s+/g, '').trim();
        }

        // 10. Landlord Email
        const emailMatch = pageText.match(/Email\s+([^\s]+@[^\s]+)/i);
        if (emailMatch) {
            data.landlordEmail = sanitize(emailMatch[1]);
        }

        // 11. Deposit Held By
        const heldByMatch = pageText.match(/Held\s+By\s+(.+?)(?=\s*MANAGEMENT)/s);
        if (heldByMatch) {
            data.depositHeldBy = sanitize(heldByMatch[1].split(/\n/)[0]);
        }

        // 12. Payment Frequency
        if (pageText.includes('Calendar Monthly')) data.paymentFrequency = 'Calendar Monthly';
        else if (pageText.includes('Quarterly')) data.paymentFrequency = 'Quarterly';
        else data.paymentFrequency = 'Monthly';

        // 13. Period
        const periodMatch = pageText.match(/PERIOD\s+(\d+)\s+Months/i);
        if (periodMatch) {
            data.periodMonths = parseInt(periodMatch[1]);
        }

        // Build full address
        if (data.propertyAddress && data.postcode) {
            data.fullAddress = `${data.propertyAddress}, London, ${data.postcode}`;
        } else {
            data.fullAddress = data.propertyAddress || `Property in ${data.postcode}`;
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

async function main() {
    // Step 1: Delete existing data
    console.log('=== DELETING EXISTING DATA ===\n');
    await db.execute(sql`DELETE FROM rental_agreements`);
    console.log('Deleted rental_agreements');
    await db.execute(sql`DELETE FROM properties`);
    console.log('Deleted properties');
    await db.execute(sql`DELETE FROM landlords`);
    console.log('Deleted landlords\n');

    // Step 2: Parse and show samples
    console.log('=== SAMPLE PARSING (first 3 pages) ===\n');
    const pages = splitIntoPages(extractedText);

    for (let i = 0; i < Math.min(3, pages.length); i++) {
        const data = parsePropertyPage(pages[i]);
        console.log(`Page ${i + 1}:`);
        console.log(`  Property: ${data?.fullAddress}`);
        console.log(`  LANDLORD: ${data?.landlordName}`);
        console.log(`  Landlord Addr: ${data?.landlordAddress?.substring(0, 40)}...`);
        console.log(`  Landlord Tel: ${data?.landlordTelephone} | Mobile: ${data?.landlordMobile}`);
        console.log(`  Landlord Email: ${data?.landlordEmail}`);
        console.log(`  Bank: ${data?.bankName} | Acc: ${data?.accountNumber} | Sort: ${data?.sortCode}`);
        console.log(`  TENANT: ${data?.tenantName}`);
        console.log(`  Rent: £${data?.rentAmount} | Deposit: £${data?.depositAmount}`);
        console.log(`  Dates: ${data?.tenancyStart} to ${data?.tenancyEnd}`);
        console.log(`  Deposit Held: ${data?.depositHeldBy}`);
        console.log(`  Fee: ${data?.managementFee}%`);
        console.log('');
    }

    // Step 3: Import data
    console.log('=== IMPORTING DATA ===\n');

    let imported = 0;
    let errors = 0;
    const landlordCache = new Map<string, number>();

    for (let i = 0; i < pages.length; i++) {
        const data = parsePropertyPage(pages[i]);

        if (!data || !data.landlordName) {
            errors++;
            continue;
        }

        try {
            // Create/find landlord
            let landlordId: number;
            const landlordKey = data.landlordName.toLowerCase().trim();

            if (landlordCache.has(landlordKey)) {
                landlordId = landlordCache.get(landlordKey)!;
            } else {
                const existing = await db.select().from(landlords)
                    .where(eq(landlords.name, data.landlordName)).limit(1);

                if (existing.length > 0) {
                    landlordId = existing[0].id;
                } else {
                    const isCompany = /Ltd|Limited|Properties|Investment|Estates/i.test(data.landlordName);

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
                title: data.fullAddress,
                description: `Managed property. Tenant: ${data.tenantName || 'TBC'}`,
                addressLine1: data.propertyAddress || 'TBC',
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

    console.log(`\n=== COMPLETE ===`);
    console.log(`Imported: ${imported} properties`);
    console.log(`Errors: ${errors}`);
    console.log(`Landlords: ${landlordCache.size}`);

    await client.end();
}

main().catch(console.error);
