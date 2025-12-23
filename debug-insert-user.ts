
import 'dotenv/config';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { users } from './shared/schema.ts';

const connectionString = process.env.DATABASE_URL!;
const client = postgres(connectionString, { ssl: 'require' });
const db = drizzle(client);

async function run() {
    try {
        console.log("Attempting User insert...");
        const res = await db.insert(users).values({
            username: 'debug_user_' + Date.now(),
            password: 'password123',
            email: 'debug_user_' + Date.now() + '@example.com',
            fullName: 'Debug User',
            role: 'tenant',
            isActive: true,
            createdAt: new Date()
        } as any).returning();
        console.log("Success:", res);
    } catch (e: any) {
        console.log("Error:", e.message);
    }
    process.exit(0);
}

run();
