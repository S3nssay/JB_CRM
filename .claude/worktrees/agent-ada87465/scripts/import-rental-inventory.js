import XLSX from 'xlsx';
import pg from 'pg';

const { Pool } = pg;

// Database connection using environment variable
const DATABASE_URL = process.env.DATABASE_URL || 'postgresql://postgres:ThisIsJohnBarclayCRM@db.klejkooiqsziifttiqws.supabase.co:5432/postgres';

const pool = new Pool({
  connectionString: DATABASE_URL,
});

// Path to the Excel file
const filePath = 'C:\\Users\\ziaa\\Dropbox\\ZA\\DOWNLOADS\\BUSINESS\\JOHN BARCLAY\\Documentation\\rental Inventory.xlsx';

// Excel date serial to JS Date
function excelDateToJSDate(serial) {
  if (!serial || serial === 0) return null;
  // Excel's epoch is January 1, 1900, but there's a bug where it thinks 1900 is a leap year
  const utcDays = Math.floor(serial - 25569);
  const utcValue = utcDays * 86400;
  return new Date(utcValue * 1000);
}

// Normalize phone number
function normalizePhone(phone) {
  if (!phone) return null;
  let p = String(phone).replace(/[^\d+]/g, '');
  // Add UK prefix if needed
  if (p.startsWith('7') && p.length === 10) {
    p = '0' + p;
  }
  if (p.startsWith('44')) {
    p = '0' + p.substring(2);
  }
  return p || null;
}

// Normalize sort code
function normalizeSortCode(sortCode) {
  if (!sortCode) return null;
  // Remove any non-digits
  const digits = String(sortCode).replace(/\D/g, '');
  // Format as XX-XX-XX
  if (digits.length === 6) {
    return `${digits.substring(0, 2)}-${digits.substring(2, 4)}-${digits.substring(4, 6)}`;
  }
  return digits;
}

// Extract area from postcode
function getAreaFromPostcode(postcode) {
  if (!postcode) return null;
  const prefix = postcode.split(' ')[0];
  const areaMap = {
    'W2': 1, // Bayswater - ID 1
    'NW10': 2, // Harlesden/Kensal Green - ID 2
    'NW6': 3, // Kilburn - ID 3
    'W10': 4, // North Kensington - ID 4
    'W9': 5, // Maida Vale - ID 5
    'NW2': 6, // Willesden - ID 6
    'W11': 7, // Notting Hill - ID 7
    'HA9': 8, // Wembley - ID 8
    'N11': 9, // N11 area - ID 9
  };
  return areaMap[prefix] || 4; // Default to area 4
}

async function main() {
  const client = await pool.connect();

  try {
    console.log('=== RENTAL INVENTORY IMPORT ===\n');

    // Read the Excel file
    console.log('Reading Excel file...');
    const workbook = XLSX.readFile(filePath);
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const data = XLSX.utils.sheet_to_json(sheet);
    console.log(`Found ${data.length} rows\n`);

    // Step 1: Clear existing data
    console.log('Step 1: Clearing existing data...');
    await client.query('BEGIN');

    // Clear tables in order (respecting foreign keys)
    const tablesToClear = [
      'rental_agreements',
      'property_portal_listings',
      'maintenance_tickets',
      'maintenance_ticket_updates',
      'property_workflows',
      'viewing_appointments',
      'property_offers',
      'contract_documents',
      'customer_enquiries',
      'maintenance_requests',
      'work_orders',
      'property_certifications',
      'certification_reminders',
      'inspection_reports',
      'saved_properties',
      'social_media_posts',
      'property_inquiries',
      'properties',
      'landlords',
    ];

    for (const table of tablesToClear) {
      try {
        await client.query(`DELETE FROM ${table}`);
        console.log(`  Cleared ${table}`);
      } catch (e) {
        if (!e.message.includes('does not exist')) {
          console.log(`  Warning: ${table} - ${e.message}`);
        }
      }
    }

    await client.query('COMMIT');
    console.log('Data cleared.\n');

    // Step 2: Create tables if needed
    console.log('Step 2: Creating tables...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS landlords (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        email TEXT,
        mobile TEXT,
        bank_account_no TEXT,
        sort_code TEXT,
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS rental_agreements (
        id SERIAL PRIMARY KEY,
        property_id INTEGER NOT NULL,
        landlord_id INTEGER NOT NULL,
        rent_amount INTEGER NOT NULL,
        rent_frequency TEXT NOT NULL,
        management_fee_percent DECIMAL,
        tenancy_start TIMESTAMP,
        tenancy_end TIMESTAMP,
        deposit_held_by TEXT,
        deposit_amount INTEGER,
        status TEXT NOT NULL DEFAULT 'active',
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `);
    console.log('Tables ready.\n');

    // Step 3: Process and insert data
    console.log('Step 3: Importing data...\n');

    // Track unique landlords by name
    const landlordMap = new Map(); // name -> id
    let landlordCount = 0;
    let propertyCount = 0;
    let agreementCount = 0;

    await client.query('BEGIN');

    // Make sure we have london_areas
    const areasResult = await client.query('SELECT COUNT(*) FROM london_areas');
    if (parseInt(areasResult.rows[0].count) === 0) {
      console.log('Inserting default London areas...');
      await client.query(`
        INSERT INTO london_areas (name, postcode, description, investment_perspective, market_analysis, positive_aspects, negative_aspects)
        VALUES
          ('Bayswater', 'W2', 'Affluent area in West London', 'Strong investment potential', 'High demand area', ARRAY['Good transport', 'Central location'], ARRAY['High prices']),
          ('Harlesden', 'NW10', 'Diverse area in Northwest London', 'Good growth potential', 'Up and coming area', ARRAY['Affordable', 'Good transport'], ARRAY['Regeneration ongoing']),
          ('Kilburn', 'NW6', 'Vibrant area in Northwest London', 'Steady growth', 'Popular with professionals', ARRAY['Good transport', 'Diverse'], ARRAY['Busy high street']),
          ('North Kensington', 'W10', 'Cultural area in West London', 'Strong potential', 'Popular area', ARRAY['Portobello Market', 'Character'], ARRAY['Varied quality']),
          ('Maida Vale', 'W9', 'Leafy residential area', 'Premium investment', 'High demand', ARRAY['Canal views', 'Quiet streets'], ARRAY['Premium prices']),
          ('Willesden', 'NW2', 'Residential area in Northwest London', 'Good growth', 'Family area', ARRAY['Parks', 'Transport'], ARRAY['Variable quality']),
          ('Notting Hill', 'W11', 'Famous area in West London', 'Premium investment', 'High demand', ARRAY['Character', 'Restaurants'], ARRAY['Very expensive']),
          ('Wembley', 'HA9', 'Area near Wembley Stadium', 'Good growth', 'Regeneration area', ARRAY['Stadium', 'New builds'], ARRAY['Busy on events']),
          ('Friern Barnet', 'N11', 'Residential area in North London', 'Steady growth', 'Family area', ARRAY['Parks', 'Schools'], ARRAY['Further out'])
      `);
    }

    for (const row of data) {
      const landlordName = row['Landlord Name'];
      const landlordEmail = row['Landlord Email'];
      const landlordMobile = normalizePhone(row['Landlord Mobile']);
      const bankAccountNo = row['Bank Account No'] ? String(row['Bank Account No']) : null;
      const sortCode = normalizeSortCode(row['Sort Code']);

      // Skip if no landlord name
      if (!landlordName) continue;

      // Check if landlord exists
      let landlordId = landlordMap.get(landlordName);

      if (!landlordId) {
        // Insert new landlord
        const landlordResult = await client.query(
          `INSERT INTO landlords (name, email, mobile, bank_account_no, sort_code)
           VALUES ($1, $2, $3, $4, $5)
           RETURNING id`,
          [landlordName, landlordEmail, landlordMobile, bankAccountNo, sortCode]
        );
        landlordId = landlordResult.rows[0].id;
        landlordMap.set(landlordName, landlordId);
        landlordCount++;
      }

      // Create property
      const propertyAddress = row['Property Address'];
      const city = row['City'] || 'London';
      const postcode = row['Postcode'];
      const rentAmount = Math.round((row['Rent Amount'] || 0) * 100); // Convert to pence
      const rentFrequency = row['Rent Frequency'] || 'Monthly';
      const managementFee = row['Management Fee (%)'];
      const tenancyStart = excelDateToJSDate(row['Tenancy Start']);
      const tenancyEnd = excelDateToJSDate(row['Tenancy End']);
      const depositHeldBy = row['Deposit Held By'];

      // Determine property type from address
      let propertyType = 'flat';
      const addressLower = propertyAddress.toLowerCase();
      if (addressLower.includes('house') || (!addressLower.includes('flat') && !addressLower.includes('floor'))) {
        propertyType = 'house';
      }

      // Get area ID from postcode
      const areaId = getAreaFromPostcode(postcode);

      // Insert property
      const propertyResult = await client.query(
        `INSERT INTO properties (
          listing_type, status, title, description, price, property_type,
          bedrooms, bathrooms, address_line1, address_line2, postcode, area_id,
          tenure, rent_period, available_from
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
        RETURNING id`,
        [
          'rental',
          'let',
          propertyAddress,
          `Rental property at ${propertyAddress}, ${city}`,
          rentAmount, // Monthly rent in pence
          propertyType,
          1, // Default bedrooms (we don't have this data)
          1, // Default bathrooms
          propertyAddress,
          city,
          postcode,
          areaId,
          'leasehold',
          rentFrequency === 'Weekly' ? 'per_week' : 'per_month',
          tenancyStart
        ]
      );
      const propertyId = propertyResult.rows[0].id;
      propertyCount++;

      // Create rental agreement
      await client.query(
        `INSERT INTO rental_agreements (
          property_id, landlord_id, rent_amount, rent_frequency,
          management_fee_percent, tenancy_start, tenancy_end, deposit_held_by
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [
          propertyId,
          landlordId,
          rentAmount,
          rentFrequency,
          managementFee || 0,
          tenancyStart,
          tenancyEnd,
          depositHeldBy
        ]
      );
      agreementCount++;
    }

    await client.query('COMMIT');

    console.log('\n=== IMPORT COMPLETE ===');
    console.log(`Landlords imported: ${landlordCount}`);
    console.log(`Properties imported: ${propertyCount}`);
    console.log(`Rental agreements created: ${agreementCount}`);

    // Verify
    const verifyLandlords = await client.query('SELECT COUNT(*) FROM landlords');
    const verifyProperties = await client.query('SELECT COUNT(*) FROM properties');
    const verifyAgreements = await client.query('SELECT COUNT(*) FROM rental_agreements');

    console.log('\n=== VERIFICATION ===');
    console.log(`Landlords in database: ${verifyLandlords.rows[0].count}`);
    console.log(`Properties in database: ${verifyProperties.rows[0].count}`);
    console.log(`Rental agreements in database: ${verifyAgreements.rows[0].count}`);

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error:', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch(console.error);
