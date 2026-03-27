import 'dotenv/config';
import pg from 'pg';

const client = new pg.Client({
    connectionString: process.env.DATABASE_URL
});

async function auditDatabase() {
    await client.connect();
    console.log('=== DATABASE AUDIT ===\n');

    // Get all tables
    const tables = await client.query(`
    SELECT table_name FROM information_schema.tables 
    WHERE table_schema = 'public' ORDER BY table_name
  `);
    console.log('TABLES IN DATABASE:');
    tables.rows.forEach(r => console.log('  -', r.table_name));

    // Check properties table structure
    console.log('\n--- PROPERTIES TABLE ---');
    const propCols = await client.query(`
    SELECT column_name, data_type, column_default 
    FROM information_schema.columns 
    WHERE table_name = 'properties' ORDER BY ordinal_position
  `);
    propCols.rows.forEach(r => console.log(`  ${r.column_name}: ${r.data_type}`));

    // Check landlords table
    console.log('\n--- LANDLORDS TABLE ---');
    const landlordCols = await client.query(`
    SELECT column_name, data_type 
    FROM information_schema.columns 
    WHERE table_name = 'landlords' ORDER BY ordinal_position
  `);
    if (landlordCols.rows.length === 0) {
        console.log('  ❌ TABLE DOES NOT EXIST');
    } else {
        landlordCols.rows.forEach(r => console.log(`  ${r.column_name}: ${r.data_type}`));
    }

    // Check tenants table
    console.log('\n--- TENANTS TABLE ---');
    const tenantCols = await client.query(`
    SELECT column_name, data_type 
    FROM information_schema.columns 
    WHERE table_name = 'tenants' ORDER BY ordinal_position
  `);
    if (tenantCols.rows.length === 0) {
        console.log('  ❌ TABLE DOES NOT EXIST');
    } else {
        tenantCols.rows.forEach(r => console.log(`  ${r.column_name}: ${r.data_type}`));
    }

    // Check compliance_status table
    console.log('\n--- COMPLIANCE_STATUS TABLE ---');
    const compCols = await client.query(`
    SELECT column_name, data_type 
    FROM information_schema.columns 
    WHERE table_name = 'compliance_status' ORDER BY ordinal_position
  `);
    if (compCols.rows.length === 0) {
        console.log('  ❌ TABLE DOES NOT EXIST');
    } else {
        compCols.rows.forEach(r => console.log(`  ${r.column_name}: ${r.data_type}`));
    }

    // Check for KYC/documents tables
    console.log('\n--- DOCUMENTS/KYC TABLES ---');
    const docTables = await client.query(`
    SELECT table_name FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND (table_name LIKE '%document%' OR table_name LIKE '%kyc%' OR table_name LIKE '%file%')
  `);
    if (docTables.rows.length === 0) {
        console.log('  ❌ NO DOCUMENT/KYC TABLES FOUND');
    } else {
        docTables.rows.forEach(r => console.log('  -', r.table_name));
    }

    // Property counts by type
    console.log('\n--- PROPERTY COUNTS ---');
    const counts = await client.query(`
    SELECT 
      listing_type, 
      property_category, 
      is_managed,
      COUNT(*) as count 
    FROM properties 
    GROUP BY listing_type, property_category, is_managed
    ORDER BY listing_type, property_category
  `);
    counts.rows.forEach(r => {
        console.log(`  ${r.listing_type || 'null'} | ${r.property_category || 'null'} | managed:${r.is_managed} = ${r.count}`);
    });

    await client.end();
}

auditDatabase();
