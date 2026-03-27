import { pool } from '../server/db';

// Checklist item types that require document uploads
const checklistItems = [
  'tenancy_agreement',
  'notices',
  'guarantors_agreement',
  'deposits_and_rent',
  'standing_order',
  'inventory',
  'deposit_protection_dps',
  'deposit_protection_tds',
  'deposit_held_by_landlord',
  'work_reference',
  'bank_reference',
  'previous_landlord_reference',
  'tenants_id',
  'authorization_to_landlord',
  'terms_and_conditions_to_landlord',
  'information_sheet_to_landlord',
  'gas_safety_certificate',
  'keys_given_to_tenant',
  'spare_keys_in_office'
];

async function createChecklists() {
  console.log('Fetching all tenancies...');

  // Get all tenancies
  const tenanciesResult = await pool.query(`
    SELECT id, deposit_scheme FROM pm_tenancies
  `);

  const tenancies = tenanciesResult.rows;
  console.log(`Found ${tenancies.length} tenancies`);

  let itemsCreated = 0;

  for (const tenancy of tenancies) {
    // Determine which deposit protection item to use based on scheme
    const depositScheme = tenancy.deposit_scheme || 'dps';

    for (const itemType of checklistItems) {
      // Skip irrelevant deposit protection items based on scheme
      if (itemType === 'deposit_protection_dps' && depositScheme !== 'dps') continue;
      if (itemType === 'deposit_protection_tds' && depositScheme !== 'tds') continue;
      if (itemType === 'deposit_held_by_landlord' && depositScheme !== 'landlord') continue;

      try {
        await pool.query(`
          INSERT INTO pm_tenancy_checklist (tenancy_id, item_type, is_completed)
          VALUES ($1, $2, false)
          ON CONFLICT DO NOTHING
        `, [tenancy.id, itemType]);
        itemsCreated++;
      } catch (err: any) {
        console.error(`  Error creating checklist item ${itemType} for tenancy ${tenancy.id}:`, err.message);
      }
    }
  }

  console.log(`\nCreated ${itemsCreated} checklist items`);

  // Summary by type
  const summaryResult = await pool.query(`
    SELECT item_type, COUNT(*) as count
    FROM pm_tenancy_checklist
    GROUP BY item_type
    ORDER BY item_type
  `);

  console.log('\n=== Checklist Items Summary ===');
  for (const row of summaryResult.rows) {
    console.log(`  ${row.item_type}: ${row.count}`);
  }

  await pool.end();
}

createChecklists().catch(console.error);
