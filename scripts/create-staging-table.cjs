const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const sql = `
CREATE TABLE IF NOT EXISTS pdf_import_staging (
  id SERIAL PRIMARY KEY,
  batch_id TEXT NOT NULL,
  page_number INTEGER NOT NULL,
  status TEXT DEFAULT 'pending',
  property_address TEXT,
  property_first_line TEXT,
  property_street TEXT,
  postcode TEXT,
  management_fee TEXT,
  management_type TEXT,
  management_period_months TEXT,
  landlord_name TEXT,
  landlord_address TEXT,
  landlord_phone TEXT,
  landlord_mobile TEXT,
  landlord_email TEXT,
  bank_name TEXT,
  bank_account_no TEXT,
  sort_code TEXT,
  tenant_name TEXT,
  tenant_phone TEXT,
  tenant_mobile TEXT,
  deposit_amount TEXT,
  rent_amount TEXT,
  rent_frequency TEXT,
  tenancy_start TEXT,
  tenancy_end TEXT,
  period_months TEXT,
  deposit_held_by TEXT,
  keys_given_to_tenant TEXT,
  spare_keys_in_office TEXT,
  as_at_date TEXT,
  checklist_json TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);`;

pool.query(sql)
  .then(() => { console.log('pdf_import_staging table created successfully'); pool.end(); })
  .catch(e => { console.error('Error:', e.message); pool.end(); });
