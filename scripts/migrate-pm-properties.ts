/**
 * Migration script to move data from pm_properties to properties table
 * and update the properties table schema to match pm_properties
 *
 * Run with: npx tsx scripts/migrate-pm-properties.ts
 */

import { Pool } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function migrate() {
  const client = await pool.connect();

  try {
    console.log('Starting migration from pm_properties to properties...');

    await client.query('BEGIN');

    // Step 1: Add missing columns to properties table
    console.log('Step 1: Adding missing columns to properties table...');

    const alterStatements = [
      // Property type flags
      `ALTER TABLE properties ADD COLUMN IF NOT EXISTS is_listed_rental BOOLEAN DEFAULT false`,
      `ALTER TABLE properties ADD COLUMN IF NOT EXISTS is_listed_sale BOOLEAN DEFAULT false`,

      // Property name
      `ALTER TABLE properties ADD COLUMN IF NOT EXISTS property_name TEXT`,

      // Address fields
      `ALTER TABLE properties ADD COLUMN IF NOT EXISTS address TEXT`,
      `ALTER TABLE properties ADD COLUMN IF NOT EXISTS city TEXT`,
      `ALTER TABLE properties ADD COLUMN IF NOT EXISTS country TEXT DEFAULT 'United Kingdom'`,

      // Lease fields
      `ALTER TABLE properties ADD COLUMN IF NOT EXISTS lease_length INTEGER`,
      `ALTER TABLE properties ADD COLUMN IF NOT EXISTS ground_rent INTEGER`,
      `ALTER TABLE properties ADD COLUMN IF NOT EXISTS service_charge INTEGER`,

      // Vendor
      `ALTER TABLE properties ADD COLUMN IF NOT EXISTS vendor_id INTEGER`,

      // Management fields
      `ALTER TABLE properties ADD COLUMN IF NOT EXISTS management_type TEXT`,
      `ALTER TABLE properties ADD COLUMN IF NOT EXISTS management_period_months INTEGER`,
      `ALTER TABLE properties ADD COLUMN IF NOT EXISTS management_start_date TIMESTAMP`,
      `ALTER TABLE properties ADD COLUMN IF NOT EXISTS management_end_date TIMESTAMP`,
      `ALTER TABLE properties ADD COLUMN IF NOT EXISTS management_fee_type TEXT`,
      `ALTER TABLE properties ADD COLUMN IF NOT EXISTS management_fee_value DECIMAL`,

      // Rental fields
      `ALTER TABLE properties ADD COLUMN IF NOT EXISTS rent_amount INTEGER`,

      // Portal syndication
      `ALTER TABLE properties ADD COLUMN IF NOT EXISTS published_to_portals BOOLEAN DEFAULT false`,

      // Agent
      `ALTER TABLE properties ADD COLUMN IF NOT EXISTS agent_id INTEGER`,

      // Notes
      `ALTER TABLE properties ADD COLUMN IF NOT EXISTS notes TEXT`,

      // Make some columns nullable that were previously NOT NULL
      `ALTER TABLE properties ALTER COLUMN title DROP NOT NULL`,
      `ALTER TABLE properties ALTER COLUMN description DROP NOT NULL`,
      `ALTER TABLE properties ALTER COLUMN price DROP NOT NULL`,
      `ALTER TABLE properties ALTER COLUMN bedrooms DROP NOT NULL`,
      `ALTER TABLE properties ALTER COLUMN bathrooms DROP NOT NULL`,
      `ALTER TABLE properties ALTER COLUMN address_line1 DROP NOT NULL`,
      `ALTER TABLE properties ALTER COLUMN tenure DROP NOT NULL`,
    ];

    for (const stmt of alterStatements) {
      try {
        await client.query(stmt);
        console.log(`  Executed: ${stmt.substring(0, 60)}...`);
      } catch (err: any) {
        // Ignore errors for columns that might already exist or constraints already dropped
        if (!err.message.includes('already exists') && !err.message.includes('does not exist')) {
          console.log(`  Warning: ${err.message}`);
        }
      }
    }

    // Step 2: Check if pm_properties has data
    const pmCount = await client.query('SELECT COUNT(*) FROM pm_properties');
    const propertiesCount = await client.query('SELECT COUNT(*) FROM properties');

    console.log(`\nStep 2: Checking data...`);
    console.log(`  pm_properties has ${pmCount.rows[0].count} records`);
    console.log(`  properties has ${propertiesCount.rows[0].count} records`);

    if (parseInt(pmCount.rows[0].count) > 0) {
      // Step 3: Insert data from pm_properties to properties
      console.log('\nStep 3: Migrating data from pm_properties to properties...');

      // First, get the max ID from properties to avoid conflicts
      const maxIdResult = await client.query('SELECT COALESCE(MAX(id), 0) as max_id FROM properties');
      const maxPropertiesId = parseInt(maxIdResult.rows[0].max_id);

      // Check if pm_properties IDs would conflict
      const minPmIdResult = await client.query('SELECT MIN(id) as min_id FROM pm_properties');
      const minPmId = parseInt(minPmIdResult.rows[0].min_id);

      console.log(`  Max properties ID: ${maxPropertiesId}, Min pm_properties ID: ${minPmId}`);

      // Insert pm_properties data into properties
      // Using ON CONFLICT to handle any ID conflicts by updating
      const insertQuery = `
        INSERT INTO properties (
          id,
          is_managed,
          is_listed_rental,
          is_listed_sale,
          is_residential,
          property_type,
          title,
          property_name,
          address,
          address_line1,
          address_line2,
          city,
          postcode,
          country,
          latitude,
          longitude,
          area_id,
          bedrooms,
          bathrooms,
          receptions,
          square_footage,
          year_built,
          description,
          images,
          floor_plan,
          features,
          amenities,
          tenure,
          lease_length,
          ground_rent,
          service_charge,
          council_tax_band,
          energy_rating,
          landlord_id,
          vendor_id,
          management_type,
          management_period_months,
          management_start_date,
          management_end_date,
          management_fee_type,
          management_fee_value,
          rent_amount,
          rent_period,
          deposit,
          furnished,
          available_from,
          minimum_tenancy,
          price,
          price_qualifier,
          published_to_portals,
          is_published_website,
          is_published_zoopla,
          is_published_rightmove,
          is_published_onthemarket,
          is_published_social,
          status,
          property_manager_id,
          agent_id,
          notes,
          created_at,
          updated_at
        )
        SELECT
          id,
          is_managed,
          is_listed_rental,
          is_listed_sale,
          is_residential,
          property_type,
          title,
          property_name,
          address,
          address_line1,
          address_line2,
          city,
          postcode,
          country,
          latitude,
          longitude,
          area_id,
          bedrooms,
          bathrooms,
          receptions,
          square_footage,
          year_built,
          description,
          images,
          floor_plan,
          features,
          amenities,
          tenure,
          lease_length,
          ground_rent,
          service_charge,
          council_tax_band,
          energy_rating,
          landlord_id,
          vendor_id,
          management_type,
          management_period_months,
          management_start_date,
          management_end_date,
          management_fee_type,
          management_fee_value,
          rent_amount,
          rent_period,
          deposit,
          furnished,
          available_from,
          minimum_tenancy,
          price,
          price_qualifier,
          published_to_portals,
          is_published_website,
          is_published_zoopla,
          is_published_rightmove,
          is_published_onthemarket,
          is_published_social,
          status,
          property_manager_id,
          agent_id,
          notes,
          created_at,
          updated_at
        FROM pm_properties
        ON CONFLICT (id) DO UPDATE SET
          is_managed = EXCLUDED.is_managed,
          is_listed_rental = EXCLUDED.is_listed_rental,
          is_listed_sale = EXCLUDED.is_listed_sale,
          is_residential = EXCLUDED.is_residential,
          property_type = EXCLUDED.property_type,
          title = EXCLUDED.title,
          property_name = EXCLUDED.property_name,
          address = EXCLUDED.address,
          address_line1 = EXCLUDED.address_line1,
          address_line2 = EXCLUDED.address_line2,
          city = EXCLUDED.city,
          postcode = EXCLUDED.postcode,
          country = EXCLUDED.country,
          latitude = EXCLUDED.latitude,
          longitude = EXCLUDED.longitude,
          area_id = EXCLUDED.area_id,
          bedrooms = EXCLUDED.bedrooms,
          bathrooms = EXCLUDED.bathrooms,
          receptions = EXCLUDED.receptions,
          square_footage = EXCLUDED.square_footage,
          year_built = EXCLUDED.year_built,
          description = EXCLUDED.description,
          images = EXCLUDED.images,
          floor_plan = EXCLUDED.floor_plan,
          features = EXCLUDED.features,
          amenities = EXCLUDED.amenities,
          tenure = EXCLUDED.tenure,
          lease_length = EXCLUDED.lease_length,
          ground_rent = EXCLUDED.ground_rent,
          service_charge = EXCLUDED.service_charge,
          council_tax_band = EXCLUDED.council_tax_band,
          energy_rating = EXCLUDED.energy_rating,
          landlord_id = EXCLUDED.landlord_id,
          vendor_id = EXCLUDED.vendor_id,
          management_type = EXCLUDED.management_type,
          management_period_months = EXCLUDED.management_period_months,
          management_start_date = EXCLUDED.management_start_date,
          management_end_date = EXCLUDED.management_end_date,
          management_fee_type = EXCLUDED.management_fee_type,
          management_fee_value = EXCLUDED.management_fee_value,
          rent_amount = EXCLUDED.rent_amount,
          rent_period = EXCLUDED.rent_period,
          deposit = EXCLUDED.deposit,
          furnished = EXCLUDED.furnished,
          available_from = EXCLUDED.available_from,
          minimum_tenancy = EXCLUDED.minimum_tenancy,
          price = EXCLUDED.price,
          price_qualifier = EXCLUDED.price_qualifier,
          published_to_portals = EXCLUDED.published_to_portals,
          is_published_website = EXCLUDED.is_published_website,
          is_published_zoopla = EXCLUDED.is_published_zoopla,
          is_published_rightmove = EXCLUDED.is_published_rightmove,
          is_published_onthemarket = EXCLUDED.is_published_onthemarket,
          is_published_social = EXCLUDED.is_published_social,
          status = EXCLUDED.status,
          property_manager_id = EXCLUDED.property_manager_id,
          agent_id = EXCLUDED.agent_id,
          notes = EXCLUDED.notes,
          updated_at = EXCLUDED.updated_at
      `;

      const result = await client.query(insertQuery);
      console.log(`  Migrated ${result.rowCount} records`);

      // Reset the sequence to avoid ID conflicts
      await client.query(`SELECT setval('properties_id_seq', (SELECT MAX(id) FROM properties))`);
      console.log('  Reset properties_id_seq');
    }

    // Step 4: Verify migration
    const newPropertiesCount = await client.query('SELECT COUNT(*) FROM properties');
    console.log(`\nStep 4: Verification`);
    console.log(`  properties now has ${newPropertiesCount.rows[0].count} records`);

    await client.query('COMMIT');
    console.log('\nMigration completed successfully!');
    console.log('\nNOTE: pm_properties table has NOT been dropped.');
    console.log('Once you verify everything works, you can drop it with:');
    console.log('  DROP TABLE pm_properties CASCADE;');

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Migration failed:', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

migrate().catch(console.error);
