import { db } from '../server/db';
import { pmProperties, pmTenancies, pmLandlords, pmTenants } from '../shared/schema';
import { eq, sql, count } from 'drizzle-orm';

async function verify() {
  // Count all records
  const [propCount] = await db.select({ count: count() }).from(pmProperties);
  const [tenancyCount] = await db.select({ count: count() }).from(pmTenancies);
  const [landlordCount] = await db.select({ count: count() }).from(pmLandlords);
  const [tenantCount] = await db.select({ count: count() }).from(pmTenants);

  console.log('=== RECORD COUNTS ===');
  console.log('Properties:', propCount.count);
  console.log('Tenancies:', tenancyCount.count);
  console.log('Landlords:', landlordCount.count);
  console.log('Tenants:', tenantCount.count);

  // Check deposit holder types using raw SQL
  const depositTypes = await db.execute(sql`
    SELECT deposit_holder_type, COUNT(*) as cnt
    FROM pm_tenancies
    GROUP BY deposit_holder_type
  `);
  console.log('\n=== DEPOSIT HOLDER TYPES ===');
  depositTypes.rows.forEach((r: any) => console.log(r.deposit_holder_type || 'NULL', ':', r.cnt));

  // Check landlord addresses
  const landlordAddresses = await db.execute(sql`
    SELECT name, address FROM pm_landlords LIMIT 5
  `);
  console.log('\n=== SAMPLE LANDLORD ADDRESSES ===');
  landlordAddresses.rows.forEach((r: any) => console.log(r.name, ':', r.address || 'NO ADDRESS'));

  // Check a sample property with tenancy
  const sample = await db.execute(sql`
    SELECT
      p.address as property_address,
      p.management_period_months,
      l.name as landlord_name,
      l.address as landlord_address,
      t.deposit_holder_type,
      t.deposit_scheme,
      t.deposit_amount,
      tn.name as tenant_name
    FROM pm_properties p
    JOIN pm_landlords l ON p.landlord_id = l.id
    LEFT JOIN pm_tenancies t ON t.property_id = p.id AND t.status = 'active'
    LEFT JOIN pm_tenants tn ON t.tenant_id = tn.id
    WHERE t.id IS NOT NULL
    LIMIT 3
  `);
  console.log('\n=== SAMPLE PROPERTY DATA ===');
  sample.rows.forEach((r: any, i: number) => {
    console.log('\nProperty', i+1 + ':');
    console.log('  Address:', r.property_address);
    console.log('  Landlord:', r.landlord_name);
    console.log('  Landlord Address:', r.landlord_address || 'MISSING');
    console.log('  Tenant:', r.tenant_name);
    console.log('  Deposit Holder Type:', r.deposit_holder_type || 'MISSING');
    console.log('  Deposit Scheme:', r.deposit_scheme);
    console.log('  Deposit Amount:', r.deposit_amount);
    console.log('  Management Period:', r.management_period_months, 'months');
  });

  process.exit(0);
}

verify().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
