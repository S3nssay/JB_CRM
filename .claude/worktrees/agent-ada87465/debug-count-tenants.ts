
import 'dotenv/config';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { tenants } from './shared/schema.ts';
import { count } from 'drizzle-orm';

const connectionString = process.env.DATABASE_URL!;
const client = postgres(connectionString, { ssl: 'require' });
const db = drizzle(client);

async function run() {
    const res = await db.select({ count: count() }).from(tenants);
    console.log("Total Tenants:", res[0].count);
    process.exit(0);
}

run();
