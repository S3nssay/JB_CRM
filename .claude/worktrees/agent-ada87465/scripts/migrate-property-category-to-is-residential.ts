/**
 * Migration Script: Convert propertyCategory (string) to isResidential (boolean)
 *
 * This script:
 * 1. Adds is_residential boolean column to properties and pm_properties tables
 * 2. Migrates existing data: property_category = 'commercial' -> is_residential = false
 * 3. Drops the old property_category column
 *
 * Run with: npx tsx scripts/migrate-property-category-to-is-residential.ts
 */

import { db } from '../server/db';
import { sql } from 'drizzle-orm';

async function migrate() {
  console.log('Starting migration: propertyCategory -> isResidential\n');

  try {
    // Step 1: Add is_residential column to properties table
    console.log('1. Adding is_residential column to properties table...');
    await db.execute(sql`
      ALTER TABLE properties
      ADD COLUMN IF NOT EXISTS is_residential boolean NOT NULL DEFAULT true
    `);
    console.log('   Done.\n');

    // Step 2: Migrate data in properties table
    console.log('2. Migrating data in properties table...');
    const propertiesResult = await db.execute(sql`
      UPDATE properties
      SET is_residential = CASE
        WHEN property_category = 'commercial' THEN false
        ELSE true
      END
      WHERE property_category IS NOT NULL
    `);
    console.log(`   Updated properties based on property_category.\n`);

    // Step 3: Add is_residential column to pm_properties table
    console.log('3. Adding is_residential column to pm_properties table...');
    await db.execute(sql`
      ALTER TABLE pm_properties
      ADD COLUMN IF NOT EXISTS is_residential boolean NOT NULL DEFAULT true
    `);
    console.log('   Done.\n');

    // Step 4: Migrate data in pm_properties table
    console.log('4. Migrating data in pm_properties table...');
    await db.execute(sql`
      UPDATE pm_properties
      SET is_residential = CASE
        WHEN property_category = 'commercial' THEN false
        ELSE true
      END
      WHERE property_category IS NOT NULL
    `);
    console.log(`   Updated pm_properties based on property_category.\n`);

    // Step 5: Drop the old property_category column from properties
    console.log('5. Dropping property_category column from properties table...');
    await db.execute(sql`
      ALTER TABLE properties
      DROP COLUMN IF EXISTS property_category
    `);
    console.log('   Done.\n');

    // Step 6: Drop the old property_category column from pm_properties
    console.log('6. Dropping property_category column from pm_properties table...');
    await db.execute(sql`
      ALTER TABLE pm_properties
      DROP COLUMN IF EXISTS property_category
    `);
    console.log('   Done.\n');

    // Verify the migration
    console.log('7. Verifying migration...');

    const propertiesCheck = await db.execute(sql`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_name = 'properties'
      AND column_name IN ('is_residential', 'property_category')
    `);
    console.log('   Properties table columns:', propertiesCheck.rows);

    const pmPropertiesCheck = await db.execute(sql`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_name = 'pm_properties'
      AND column_name IN ('is_residential', 'property_category')
    `);
    console.log('   PM Properties table columns:', pmPropertiesCheck.rows);

    // Count of commercial vs residential
    const propStats = await db.execute(sql`
      SELECT
        is_residential,
        COUNT(*) as count
      FROM properties
      GROUP BY is_residential
    `);
    console.log('\n   Properties stats:', propStats.rows);

    const pmPropStats = await db.execute(sql`
      SELECT
        is_residential,
        COUNT(*) as count
      FROM pm_properties
      GROUP BY is_residential
    `);
    console.log('   PM Properties stats:', pmPropStats.rows);

    console.log('\nMigration completed successfully!');
  } catch (error) {
    console.error('Migration failed:', error);
    throw error;
  }
}

migrate()
  .then(() => process.exit(0))
  .catch(() => process.exit(1));
