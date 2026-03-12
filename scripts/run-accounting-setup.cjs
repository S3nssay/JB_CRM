const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

async function run() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });

  const scripts = [
    'create-accounting-tables.sql',
    'create-accounting-indexes.sql',
    'seed-accounting-data.sql'
  ];

  for (const script of scripts) {
    const filePath = path.join(__dirname, script);
    const sql = fs.readFileSync(filePath, 'utf8');
    console.log(`Running ${script}...`);
    try {
      await pool.query(sql);
      console.log(`  ✓ ${script} completed`);
    } catch (e) {
      console.error(`  ✗ ${script} failed:`, e.message);
    }
  }

  // Verify tables exist
  const { rows } = await pool.query(`
    SELECT table_name FROM information_schema.tables
    WHERE table_schema = 'public'
    AND table_name IN (
      'business_settings','chart_of_accounts','tax_rates','financial_periods',
      'journal_entries','journal_entry_lines','business_invoices','business_invoice_lines',
      'purchase_invoices','purchase_invoice_lines','credit_notes','payment_allocations',
      'vat_returns','vat_return_transactions','recurring_invoice_templates'
    )
    ORDER BY table_name
  `);
  console.log(`\nVerification: ${rows.length}/15 accounting tables exist:`);
  rows.forEach(r => console.log(`  ✓ ${r.table_name}`));

  // Verify bridge columns
  const bridgeCheck = await pool.query(`
    SELECT column_name, table_name FROM information_schema.columns
    WHERE (table_name = 'invoice' AND column_name = 'business_invoice_id')
    OR (table_name = 'property_transaction' AND column_name = 'journal_entry_id')
  `);
  console.log(`\nBridge columns: ${bridgeCheck.rows.length}/2 added:`);
  bridgeCheck.rows.forEach(r => console.log(`  ✓ ${r.table_name}.${r.column_name}`));

  // Verify seed data
  const coaCount = await pool.query('SELECT COUNT(*) FROM chart_of_accounts');
  const taxCount = await pool.query('SELECT COUNT(*) FROM tax_rates');
  const bsCount = await pool.query('SELECT COUNT(*) FROM business_settings');
  console.log(`\nSeed data: ${coaCount.rows[0].count} accounts, ${taxCount.rows[0].count} tax rates, ${bsCount.rows[0].count} business settings`);

  await pool.end();
}

run().catch(e => { console.error(e); process.exit(1); });
