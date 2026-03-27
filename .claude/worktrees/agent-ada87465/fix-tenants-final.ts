
/**
 * Fix Tenants Final
 */

import 'dotenv/config';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { readFileSync } from 'fs';
import { properties, tenants, rentalAgreements, users } from './shared/schema.ts';
import { eq, and } from 'drizzle-orm';

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
        const propertyAddressMatch = pageText.match(/TENANT\(S\).*?TELEPHONE\s+(\d+[A-Za-z]?\s+[A-Za-z\s]+?)(?=\s+DEPOSIT\s+HELD)/s);
        if (propertyAddressMatch) {
            data.propertyAddress = sanitize(propertyAddressMatch[1]);
        }
        const tenantMatch = pageText.match(/\sLANDLORD\s+(.+?)(?=\s+\d{3,})/s);
        if (tenantMatch) {
            data.tenantName = sanitize(tenantMatch[1].trim());
        }
        return data;
    } catch (error) {
        return null;
    }
}

function splitIntoPages(text: string): string[] {
    return text.split(/=== Page \d+ ===/).filter(p => p.trim().length > 100);
}

async function main() {
    console.log('=== FIXING TENANTS FINAL ===\n');

    const pages = splitIntoPages(extractedText);
    let updated = 0;
    let errors = 0;
    let skipped = 0;

    for (let i = 0; i < pages.length; i++) {
        const data = parsePropertyPage(pages[i]);

        if (!data || !data.propertyAddress || !data.tenantName) {
            skipped++;
            continue;
        }

        if (data.tenantName === 'No tenant' || data.tenantName.toLowerCase() === 'vacant') {
            skipped++;
            continue;
        }

        // console.log(`Processing: ${data.tenantName} @ ${data.propertyAddress}`);

        try {
            const props = await db.select().from(properties)
                .where(eq(properties.addressLine1, data.propertyAddress));

            if (props.length === 0) {
                // console.log(`Property not found: ${data.propertyAddress}`);
                errors++;
                continue;
            }
            const property = props[0];

            const agreements = await db.select().from(rentalAgreements)
                .where(eq(rentalAgreements.propertyId, property.id));

            if (agreements.length === 0) {
                console.log(`Agreement not found for property ${property.id}`);
                errors++;
                continue;
            }
            const agreement = agreements[0];

            // Skip if already linked BUT verify referential integrity
            if (agreement.tenantId) {
                const existingTenant = await db.select().from(tenants).where(eq(tenants.id, agreement.tenantId));
                if (existingTenant.length > 0) {
                    // console.log(`Skipping verified linked: ${data.tenantName}`);
                    updated++;
                    continue;
                }
                console.log(`Orphaned Tenant ID ${agreement.tenantId} for ${data.tenantName}. Re-creating...`);
            }

            const tenantName = data.tenantName.trim();
            // Safe split
            const nameParts = tenantName.split(" ");
            let firstName = nameParts[0];
            let lastName = nameParts.length > 1 ? nameParts.slice(1).join(" ") : "Tenant";

            // Limit lengths just in case
            firstName = firstName.substring(0, 50);
            lastName = lastName.substring(0, 50);

            // Create User
            const randomSuffix = Math.floor(Math.random() * 100000);
            const username = `tenant_${firstName.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase()}_${Date.now()}_${randomSuffix}`.substring(0, 50);
            const email = `${username}@example.com`;

            // Insert User
            const [newUser] = await db.insert(users).values({
                username: username,
                password: 'password123',
                email: email,
                fullName: tenantName.substring(0, 100),
                role: 'tenant',
                isActive: true,
                createdAt: new Date()
            } as any).returning();

            // Insert Tenant
            const [newTenant] = await db.insert(tenants).values({
                firstName: firstName,
                lastName: lastName,
                status: 'active',
                userId: newUser.id,
                propertyId: property.id,
                email: email
            } as any).returning();

            // Link
            await db.update(rentalAgreements)
                .set({ tenantId: newTenant.id })
                .where(eq(rentalAgreements.id, agreement.id));

            updated++;
            // console.log(`Fixed: ${tenantName} (TID: ${newTenant.id})`);

        } catch (error: any) {
            console.error(`Error processing ${data.tenantName}: ${error.message}`);
            // console.error(error); // Detailed stack
            errors++;
        }
    }

    console.log(`\n=== COMPLETE ===`);
    console.log(`Updated/Verified: ${updated}`);
    console.log(`Errors: ${errors}`);

    await client.end();
}

main().catch(console.error);
