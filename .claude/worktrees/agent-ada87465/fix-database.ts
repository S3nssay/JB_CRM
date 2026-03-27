import 'dotenv/config';
import pg from 'pg';

const client = new pg.Client({
    connectionString: process.env.DATABASE_URL
});

async function fixDatabase() {
    await client.connect();
    console.log('Connected to database');

    // Add missing columns to properties table
    const columns = [
        "ALTER TABLE properties ADD COLUMN IF NOT EXISTS property_category TEXT DEFAULT 'residential'",
        "ALTER TABLE properties ADD COLUMN IF NOT EXISTS is_managed BOOLEAN DEFAULT false",
        "ALTER TABLE properties ADD COLUMN IF NOT EXISTS landlord_id INTEGER",
    ];

    for (const sql of columns) {
        try {
            await client.query(sql);
            console.log('✓', sql.substring(0, 60) + '...');
        } catch (e: any) {
            console.log('✗', e.message);
        }
    }

    // Set all properties to managed
    await client.query('UPDATE properties SET is_managed = true WHERE is_managed IS NULL OR is_managed = false');
    console.log('✓ Set all properties to is_managed = true');

    // Set default property_category where null
    await client.query("UPDATE properties SET property_category = 'residential' WHERE property_category IS NULL");
    console.log('✓ Set default property_category = residential');

    // Count
    const result = await client.query('SELECT COUNT(*) FROM properties');
    console.log('\nTotal properties:', result.rows[0].count);

    await client.end();
    console.log('\nDatabase fixed!');
}

fixDatabase();
