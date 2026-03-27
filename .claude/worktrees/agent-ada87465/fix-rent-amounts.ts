/**
 * Fix Rent Amounts Script
 * The import script incorrectly multiplied rent by 100 (treating as pence)
 * This script divides all rent amounts by 100 to fix the values
 * 
 * Run with: npx tsx fix-rent-amounts.ts
 */

import 'dotenv/config';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { properties, rentalAgreements } from './shared/schema.ts';
import { sql } from 'drizzle-orm';

// Database connection
const connectionString = process.env.DATABASE_URL!;
const client = postgres(connectionString, { ssl: 'require' });
const db = drizzle(client);

async function fixRentAmounts() {
    console.log('Fixing rent amounts in properties and rental agreements...');

    try {
        // Fix properties table - divide price by 100
        const propertiesResult = await db.execute(sql`
            UPDATE properties 
            SET price = price / 100 
            WHERE price > 10000
        `);
        console.log('Fixed properties table prices');

        // Fix rental_agreements table - divide rent_amount by 100
        const agreementsResult = await db.execute(sql`
            UPDATE rental_agreements 
            SET rent_amount = rent_amount / 100 
            WHERE rent_amount > 10000
        `);
        console.log('Fixed rental_agreements rent amounts');

        // Fix deposit_amount in rental_agreements - divide by 100
        const depositsResult = await db.execute(sql`
            UPDATE rental_agreements 
            SET deposit_amount = deposit_amount / 100 
            WHERE deposit_amount > 10000
        `);
        console.log('Fixed rental_agreements deposit amounts');

        console.log('\n=== Fix Complete ===');
        console.log('All rent and deposit amounts have been corrected (divided by 100)');

    } catch (error) {
        console.error('Error fixing amounts:', error);
    }

    await client.end();
}

fixRentAmounts().catch(console.error);
