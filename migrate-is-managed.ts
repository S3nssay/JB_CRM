import { db } from './server/db';
import { sql } from 'drizzle-orm';

async function migrate() {
    console.log('Adding is_managed and landlord_id columns to properties table...');

    try {
        await db.execute(sql`ALTER TABLE properties ADD COLUMN IF NOT EXISTS is_managed BOOLEAN DEFAULT false`);
        console.log('Added is_managed column');

        await db.execute(sql`ALTER TABLE properties ADD COLUMN IF NOT EXISTS landlord_id INTEGER`);
        console.log('Added landlord_id column');

        await db.execute(sql`UPDATE properties SET is_managed = true`);
        console.log('Set all properties to isManaged = true');

        console.log('Migration complete!');
        process.exit(0);
    } catch (error) {
        console.error('Migration failed:', error);
        process.exit(1);
    }
}

migrate();
