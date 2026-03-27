
import 'dotenv/config';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { tenants } from './shared/schema.ts';

const connectionString = process.env.DATABASE_URL!;
const client = postgres(connectionString, { ssl: 'require' });
const db = drizzle(client);

async function run() {
    try {
        console.log("Attempting insert...");
        const res = await db.insert(tenants).values({
            firstName: 'Test',
            lastName: 'User',
            status: 'active'
        } as any).returning();
        console.log("Success:", res);
    } catch (e: any) {
        console.log("Error:", e.message);
    }
    process.exit(0);
}

run();
