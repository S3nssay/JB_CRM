/**
 * Script to import contractors from Excel file into the database
 * Run with: node scripts/import-contractors.js
 */

import XLSX from 'xlsx';
import path from 'path';
import { fileURLToPath } from 'url';
import pg from 'pg';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Database connection
const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres:ThisIsJohnBarclayCRM@db.klejkooiqsziifttiqws.supabase.co:5432/postgres'
});

// Map specializations to standardized categories
function mapSpecialization(spec) {
  if (!spec) return ['general'];

  const specLower = spec.toLowerCase();
  const mappings = {
    'plumbing': ['plumbing'],
    'gas': ['gas', 'heating'],
    'plumbing/gas': ['plumbing', 'gas', 'heating'],
    'electrical': ['electrical'],
    'appliances': ['appliances'],
    'cleaning': ['cleaning'],
    'removals': ['removals'],
    'locksmith': ['locksmith', 'security'],
    'handyman': ['general', 'handyman'],
    'general': ['general'],
    'painting': ['painting', 'decorating'],
    'carpentry': ['carpentry'],
    'roofing': ['roofing'],
    'pest': ['pest_control'],
    'pest control': ['pest_control']
  };

  for (const [key, values] of Object.entries(mappings)) {
    if (specLower.includes(key)) {
      return values;
    }
  }

  return ['general'];
}

// Format phone number
function formatPhone(phone) {
  if (!phone) return null;
  const phoneStr = String(phone).replace(/\D/g, '');
  if (phoneStr.length === 10) {
    return '+44' + phoneStr;
  } else if (phoneStr.length === 11 && phoneStr.startsWith('0')) {
    return '+44' + phoneStr.substring(1);
  }
  return '+44' + phoneStr;
}

async function importContractors() {
  // Read the Excel file
  const filePath = path.join(__dirname, '../uploads/contractors/Contractor List.xlsx');

  try {
    const workbook = XLSX.readFile(filePath);
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];

    // Convert to array format
    const data = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

    console.log('=== Importing Contractors ===\n');
    console.log(`Found ${data.length - 2} contractors in Excel file\n`);

    // Skip the first row (empty headers) and second row (actual headers)
    // Data starts at row 2 (index 2)
    const contractors = [];

    for (let i = 2; i < data.length; i++) {
      const row = data[i];
      if (!row || !row[0]) continue; // Skip empty rows

      const name = row[0];
      const phone = row[1];
      const specialization = row[2];
      const priority = row[3];

      const contractor = {
        companyName: name,
        contactName: name,
        email: null, // Not in spreadsheet
        phone: formatPhone(phone),
        emergencyPhone: formatPhone(phone),
        specializations: mapSpecialization(specialization),
        serviceAreas: ['W2', 'W9', 'W10', 'W11', 'NW6', 'NW8', 'NW10'], // Default to covered areas
        availableEmergency: priority === 'Main contact',
        responseTime: priority === 'Main contact' ? '4 hours' : '24 hours',
        callOutFee: null,
        hourlyRate: null,
        rating: null,
        completedJobs: 0,
        isActive: true,
        preferredContractor: priority === 'Main contact'
      };

      contractors.push(contractor);
      console.log(`  ${i - 1}. ${name} - ${specialization || 'General'} - ${priority || 'Standard'}`);
    }

    console.log(`\n--- Inserting ${contractors.length} contractors into database ---\n`);

    // Insert into database
    const client = await pool.connect();

    try {
      // Create the contractors table if it doesn't exist
      await client.query(`
        CREATE TABLE IF NOT EXISTS contractors (
          id SERIAL PRIMARY KEY,
          company_name TEXT NOT NULL,
          contact_name TEXT NOT NULL,
          email TEXT,
          phone TEXT NOT NULL,
          emergency_phone TEXT,
          specializations TEXT[],
          gas_registration_number TEXT,
          electrical_cert_number TEXT,
          insurance_expiry_date TIMESTAMP,
          service_areas TEXT[],
          available_emergency BOOLEAN DEFAULT FALSE,
          response_time TEXT,
          call_out_fee INTEGER,
          hourly_rate INTEGER,
          rating INTEGER,
          completed_jobs INTEGER DEFAULT 0,
          is_active BOOLEAN DEFAULT TRUE,
          preferred_contractor BOOLEAN DEFAULT FALSE,
          created_at TIMESTAMP DEFAULT NOW()
        )
      `);

      // Clear existing contractors (optional - comment out to append)
      await client.query('DELETE FROM contractors');
      console.log('Cleared existing contractors\n');

      // Insert each contractor
      for (const c of contractors) {
        await client.query(`
          INSERT INTO contractors (
            company_name, contact_name, email, phone, emergency_phone,
            specializations, service_areas, available_emergency,
            response_time, call_out_fee, hourly_rate, rating,
            completed_jobs, is_active, preferred_contractor
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
        `, [
          c.companyName,
          c.contactName,
          c.email,
          c.phone,
          c.emergencyPhone,
          c.specializations,
          c.serviceAreas,
          c.availableEmergency,
          c.responseTime,
          c.callOutFee,
          c.hourlyRate,
          c.rating,
          c.completedJobs,
          c.isActive,
          c.preferredContractor
        ]);

        console.log(`  ✓ Inserted: ${c.companyName}`);
      }

      console.log(`\n=== Successfully imported ${contractors.length} contractors ===`);

      // Show summary by specialization
      const result = await client.query(`
        SELECT unnest(specializations) as spec, COUNT(*) as count
        FROM contractors
        GROUP BY spec
        ORDER BY count DESC
      `);

      console.log('\n--- Contractors by Specialization ---');
      result.rows.forEach(row => {
        console.log(`  ${row.spec}: ${row.count}`);
      });

    } finally {
      client.release();
    }

  } catch (error) {
    console.error('Error importing contractors:', error);
  } finally {
    await pool.end();
  }
}

importContractors();
