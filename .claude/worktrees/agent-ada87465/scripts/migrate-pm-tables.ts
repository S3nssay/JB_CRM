import { Pool } from 'pg';
import 'dotenv/config';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function migrate() {
  console.log('Starting migration...');

  // Create tenancies table
  await pool.query(`
    CREATE TABLE IF NOT EXISTS tenancies (
      id SERIAL PRIMARY KEY,
      property_id INTEGER NOT NULL,
      landlord_id INTEGER NOT NULL,
      tenant_id INTEGER,
      start_date TIMESTAMP NOT NULL,
      end_date TIMESTAMP,
      period_months INTEGER,
      is_periodic BOOLEAN DEFAULT false,
      rent_amount DECIMAL NOT NULL,
      rent_frequency TEXT NOT NULL DEFAULT 'monthly',
      rent_due_day INTEGER DEFAULT 1,
      deposit_amount DECIMAL,
      deposit_scheme TEXT,
      deposit_holder_type TEXT,
      deposit_certificate_number TEXT,
      deposit_protected_date TIMESTAMP,
      guarantor_name TEXT,
      guarantor_email TEXT,
      guarantor_phone TEXT,
      guarantor_address TEXT,
      status TEXT NOT NULL DEFAULT 'active',
      notes TEXT,
      created_at TIMESTAMP NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMP NOT NULL DEFAULT NOW()
    )
  `);
  console.log('Created tenancies table');

  // Create tenancy_checklist table
  await pool.query(`
    CREATE TABLE IF NOT EXISTS tenancy_checklist (
      id SERIAL PRIMARY KEY,
      tenancy_id INTEGER NOT NULL,
      item_type TEXT NOT NULL,
      is_completed BOOLEAN DEFAULT false,
      completed_at TIMESTAMP,
      completed_by INTEGER,
      document_url TEXT,
      document_name TEXT,
      document_uploaded_at TIMESTAMP,
      document_uploaded_by INTEGER,
      notes TEXT,
      created_at TIMESTAMP NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMP NOT NULL DEFAULT NOW()
    )
  `);
  console.log('Created tenancy_checklist table');

  // Add new columns to landlords table if they don't exist
  const landlordColumns = [
    { name: 'status', def: "TEXT NOT NULL DEFAULT 'active'" },
    { name: 'notes', def: 'TEXT' },
    { name: 'bank_account_number', def: 'TEXT' },
    { name: 'bank_sort_code', def: 'TEXT' },
    { name: 'bank_account_holder_name', def: 'TEXT' }
  ];

  for (const col of landlordColumns) {
    try {
      await pool.query(`ALTER TABLE landlords ADD COLUMN IF NOT EXISTS ${col.name} ${col.def}`);
      console.log(`Added ${col.name} column to landlords`);
    } catch (e: any) {
      console.log(`${col.name} column: ${e.message}`);
    }
  }

  // Add new columns to tenants table if they don't exist
  const tenantColumns = [
    { name: 'name', def: 'TEXT' },
    { name: 'email', def: 'TEXT' },
    { name: 'phone', def: 'TEXT' },
    { name: 'mobile', def: 'TEXT' },
    { name: 'address', def: 'TEXT' },
    { name: 'address_line1', def: 'TEXT' },
    { name: 'address_line2', def: 'TEXT' },
    { name: 'city', def: 'TEXT' },
    { name: 'postcode', def: 'TEXT' },
    { name: 'country', def: "TEXT DEFAULT 'United Kingdom'" },
    { name: 'employer', def: 'TEXT' },
    { name: 'employer_address', def: 'TEXT' },
    { name: 'employer_phone', def: 'TEXT' },
    { name: 'job_title', def: 'TEXT' },
    { name: 'annual_income', def: 'DECIMAL' },
    { name: 'emergency_contact_relationship', def: 'TEXT' },
    { name: 'id_verification_status', def: "TEXT DEFAULT 'unverified'" },
    { name: 'id_verification_token', def: 'TEXT' },
    { name: 'id_verification_token_expiry', def: 'TIMESTAMP' }
  ];

  for (const col of tenantColumns) {
    try {
      await pool.query(`ALTER TABLE tenants ADD COLUMN IF NOT EXISTS ${col.name} ${col.def}`);
      console.log(`Added ${col.name} column to tenants`);
    } catch (e: any) {
      console.log(`${col.name} column: ${e.message}`);
    }
  }

  // Make user_id and property_id optional in tenants
  try {
    await pool.query(`ALTER TABLE tenants ALTER COLUMN user_id DROP NOT NULL`);
    console.log('Made user_id column optional');
  } catch (e: any) {
    console.log(`user_id: ${e.message}`);
  }

  try {
    await pool.query(`ALTER TABLE tenants ALTER COLUMN property_id DROP NOT NULL`);
    console.log('Made property_id column optional');
  } catch (e: any) {
    console.log(`property_id: ${e.message}`);
  }

  console.log('Migration complete!');
  await pool.end();
}

migrate().catch(async (e) => {
  console.error('Migration failed:', e);
  await pool.end();
  process.exit(1);
});
