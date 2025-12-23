import 'dotenv/config';
import pg from 'pg';

const client = new pg.Client({
    connectionString: process.env.DATABASE_URL
});

async function main() {
    await client.connect();
    const result = await client.query('SELECT COUNT(*) FROM properties');
    console.log('Total properties:', result.rows[0].count);

    const managed = await client.query('SELECT COUNT(*) FROM properties WHERE is_managed = true');
    console.log('Managed properties:', managed.rows[0].count);

    await client.end();
}

main();
