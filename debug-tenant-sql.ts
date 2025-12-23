
import 'dotenv/config';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { tenants } from './shared/schema.ts';

const connectionString = process.env.DATABASE_URL!;
const client = postgres(connectionString, { ssl: 'require' });
const db = drizzle(client);

async function run() {
    try {
        console.log("Generating SQL...");
        const userId = 123;
        const firstName = "Ms Berengere";
        const lastName = "Brohan";

        // Use .toSQL() if available on query builder
        // Note: insert().values() returns query builder?
        // Actually drizzle-orm/postgres-js adapter's query builder supports inspection?

        // I'll try to just execute it and catch error stack
        await db.insert(tenants).values({
            firstName: firstName,
            lastName: lastName,
            status: 'active',
            userId: userId,
            email: `${userId}@example.com`
        } as any); // Removed returning() to force just insert? returning shouldn't break syntax

        console.log("Success");
    } catch (e: any) {
        console.log("Error:", e.message);
        console.log("Details:", e);
    }
    process.exit(0);
}

run();
