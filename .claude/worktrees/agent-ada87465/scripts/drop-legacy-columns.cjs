const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function main() {
  console.log('Dropping legacy columns from property table...');

  try {
    await pool.query(`
      ALTER TABLE property
      DROP COLUMN IF EXISTS listing_type,
      DROP COLUMN IF EXISTS property_category
    `);
    console.log('SUCCESS: Dropped listing_type and property_category columns');
  } catch (error) {
    console.error('ERROR:', error.message);
  }

  await pool.end();
}

main();
