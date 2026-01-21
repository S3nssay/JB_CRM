import { pool } from '../server/db';

async function dropLegacyTables() {
  console.log('=== DROPPING LEGACY TABLES ===\n');

  // Legacy tables to drop - in order to handle foreign key dependencies
  const legacyTables = [
    'tenancy_contracts',
    'rental_agreements',
    'tenants',
    'landlords',
    'properties'
  ];

  for (const table of legacyTables) {
    try {
      // Check if table exists first
      const checkResult = await pool.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.tables
          WHERE table_schema = 'public'
          AND table_name = $1
        )
      `, [table]);

      if (checkResult.rows[0].exists) {
        // Drop with CASCADE to handle dependencies
        await pool.query(`DROP TABLE IF EXISTS "${table}" CASCADE`);
        console.log(`✓ Dropped table: ${table}`);
      } else {
        console.log(`- Table ${table} does not exist, skipping`);
      }
    } catch (err: any) {
      console.error(`✗ Error dropping ${table}:`, err.message);
    }
  }

  // Verify PM tables exist and show their counts
  console.log('\n=== PM TABLES STATUS ===\n');

  const pmTables = [
    'pm_landlords',
    'pm_tenants',
    'pm_properties',
    'pm_tenancies',
    'pm_tenancy_checklist'
  ];

  for (const table of pmTables) {
    try {
      const countResult = await pool.query(`SELECT COUNT(*) FROM "${table}"`);
      console.log(`✓ ${table}: ${countResult.rows[0].count} records`);
    } catch (err: any) {
      console.error(`✗ ${table}: ${err.message}`);
    }
  }

  await pool.end();
  console.log('\n=== COMPLETE ===');
}

dropLegacyTables().catch(console.error);
