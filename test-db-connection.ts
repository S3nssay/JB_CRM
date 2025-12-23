import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pg;

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
    console.error('ERROR: DATABASE_URL is not set in .env file');
    process.exit(1);
}

// Mask password in URL for logging
const maskedUrl = connectionString.replace(/:[^:@]*@/, ':***@');
console.log('Testing connection to:', maskedUrl);

const pool = new Pool({
    connectionString,
    ssl: {
        rejectUnauthorized: false
    }
});

async function testConnection() {
    try {
        const client = await pool.connect();
        console.log('✓ Successfully connected to Supabase database!');

        // Test basic query
        const timeResult = await client.query('SELECT NOW() as current_time');
        console.log('✓ Current database time:', timeResult.rows[0].current_time);

        // Check database version
        const versionResult = await client.query('SELECT version()');
        console.log('✓ PostgreSQL version:', versionResult.rows[0].version.split(',')[0]);

        // List tables
        const tablesResult = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      ORDER BY table_name
    `);

        if (tablesResult.rows.length > 0) {
            console.log('✓ Tables in database:', tablesResult.rows.map(r => r.table_name).join(', '));
        } else {
            console.log('⚠ No tables found - you may need to run migrations');
        }

        client.release();
        await pool.end();
        console.log('\n✓ Database connection test completed successfully!');
        process.exit(0);
    } catch (err) {
        console.error('\n✗ Connection failed:', err.message);
        await pool.end();
        process.exit(1);
    }
}

testConnection();
