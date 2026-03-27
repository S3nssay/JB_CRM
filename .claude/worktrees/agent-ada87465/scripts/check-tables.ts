import dotenv from 'dotenv';
dotenv.config();

import { Pool } from 'pg';

const connectionString = process.env.DATABASE_URL;
console.log('DATABASE_URL prefix:', connectionString?.slice(0, 50));

if (!connectionString) {
  console.error('DATABASE_URL not set');
  process.exit(1);
}

const pool = new Pool({
  connectionString,
  ssl: { rejectUnauthorized: false }
});

pool.query("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name LIKE 'voice%'")
  .then(r => {
    console.log('Voice tables:', r.rows);
    return pool.query("SELECT COUNT(*) as count FROM information_schema.tables WHERE table_schema = 'public'");
  })
  .then(r => {
    console.log('Total public tables:', r.rows[0].count);
    pool.end();
  })
  .catch(e => {
    console.error('Query error:', e.message);
    pool.end();
    process.exit(1);
  });
