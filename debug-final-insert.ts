
import 'dotenv/config';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { properties, tenants, rentalAgreements, users } from './shared/schema.ts';
import { eq, sql, and } from 'drizzle-orm';

const connectionString = process.env.DATABASE_URL!;
const client = postgres(connectionString, { ssl: 'require' });
const db = drizzle(client);

async function run() {
    try {
        console.log("Looking for Jeff's property...");
        // Hardcoded address search?
        // I'll skip property lookup and just insert a Tenant for property ID 1 (if exists)

        const username = `debug_jeff_${Date.now()}`;
        console.log("Creating User...");
        const [newUser] = await db.insert(users).values({
            username: username,
            password: 'password123',
            email: `${username}@example.com`,
            fullName: 'Jeff Hu',
            role: 'tenant',
            isActive: true,
            createdAt: new Date()
        } as any).returning();

        console.log("User Created:", newUser.id);

        console.log("Creating Tenant...");
        const [newTenant] = await db.insert(tenants).values({
            firstName: 'Jeff',
            lastName: 'Hu',
            status: 'active',
            userId: newUser.id,
            propertyId: 1, // Assumptions: Property 1 exists
            email: `${username}@example.com`
        } as any).returning();

        console.log("Tenant Created:", newTenant.id);

    } catch (e: any) {
        console.log("Error:", e.message);
    }
    process.exit(0);
}

run();
