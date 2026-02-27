/**
 * Clean Data Import Script
 *
 * Imports data from the Managed_PropertyList_Data.xlsx file into the unified tables:
 * - landlords
 * - tenants
 * - properties
 * - tenancies
 * - tenancy_checklist
 */

import { Pool } from 'pg';
import * as XLSX from 'xlsx';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config();

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

// File path
const EXCEL_FILE = 'C:/Users/ziaa/Dropbox/ZA/DOWNLOADS/BUSINESS/JOHN BARCLAY/Documentation/Managed_PropertyList_Data.xlsx';

// Parse address into components
function parseAddress(fullAddress: string): { line1: string; line2: string; city: string; postcode: string } {
  if (!fullAddress) return { line1: '', line2: '', city: '', postcode: '' };

  // Try to extract postcode (UK format)
  const postcodeMatch = fullAddress.match(/([A-Z]{1,2}\d{1,2}[A-Z]?\s*\d[A-Z]{2})/i);
  const postcode = postcodeMatch ? postcodeMatch[1].toUpperCase() : '';

  // Remove postcode from address
  let remaining = fullAddress.replace(postcode, '').trim();

  // Split remaining into parts
  const parts = remaining.split(/,\s*/).filter(p => p.trim());

  let line1 = '';
  let line2 = '';
  let city = '';

  if (parts.length >= 3) {
    line1 = parts[0];
    line2 = parts.slice(1, -1).join(', ');
    city = parts[parts.length - 1];
  } else if (parts.length === 2) {
    line1 = parts[0];
    city = parts[1];
  } else if (parts.length === 1) {
    line1 = parts[0];
  }

  return { line1, line2, city, postcode };
}

// Extract postcode from property address
function extractPostcode(address: string): string {
  if (!address) return '';
  const match = address.match(/([A-Z]{1,2}\d{1,2}[A-Z]?\s*\d[A-Z]{2})/i);
  return match ? match[1].toUpperCase() : '';
}

// Parse date from various formats
function parseDate(dateStr: string): Date | null {
  if (!dateStr) return null;

  // Try DD/MM/YYYY format
  const ddmmyyyy = dateStr.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (ddmmyyyy) {
    return new Date(parseInt(ddmmyyyy[3]), parseInt(ddmmyyyy[2]) - 1, parseInt(ddmmyyyy[1]));
  }

  // Try "DD Month YYYY" format
  const monthNames = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'];
  const ddMonthYYYY = dateStr.match(/(\d{1,2})\s+(\w+)\s+(\d{4})/i);
  if (ddMonthYYYY) {
    const monthIndex = monthNames.findIndex(m => m.startsWith(ddMonthYYYY[2].toLowerCase()));
    if (monthIndex >= 0) {
      return new Date(parseInt(ddMonthYYYY[3]), monthIndex, parseInt(ddMonthYYYY[1]));
    }
  }

  // Fallback to JS date parsing
  const d = new Date(dateStr);
  return isNaN(d.getTime()) ? null : d;
}

// Parse rent frequency
function parseRentFrequency(freq: string): string {
  if (!freq) return 'monthly';
  const lower = freq.toLowerCase();
  if (lower.includes('week')) return 'weekly';
  if (lower.includes('month') || lower.includes('calendar')) return 'monthly';
  if (lower.includes('quarter')) return 'quarterly';
  if (lower.includes('annual') || lower.includes('year')) return 'annually';
  return 'monthly';
}

// Parse deposit holder
function parseDepositHolder(holder: string): { scheme: string; holderType: string } {
  if (!holder) return { scheme: '', holderType: '' };
  const lower = holder.toLowerCase();

  if (lower.includes('landlord')) {
    return { scheme: 'landlord', holderType: 'landlord' };
  }
  if (lower.includes('dps')) {
    return { scheme: 'dps', holderType: 'agency_custodial' };
  }
  if (lower.includes('tds')) {
    return { scheme: 'tds', holderType: 'agency_custodial' };
  }
  if (lower.includes('insurance')) {
    return { scheme: 'agency_insurance', holderType: 'agency_insurance' };
  }
  if (lower.includes('agency')) {
    return { scheme: 'agency_custodial', holderType: 'agency_custodial' };
  }

  return { scheme: '', holderType: '' };
}

// Checklist item types (from schema)
const checklistItemTypes = [
  'authorization_to_landlord',
  'bank_reference',
  'deposit_held_by_landlord',
  'deposit_protection_dps',
  'deposit_protection_tds',
  'deposit_and_rent',
  'gas_safety_certificate',
  'guarantors_agreement',
  'information_sheet_to_landlord',
  'inventory',
  'notices',
  'previous_landlord_reference',
  'standing_order',
  'tenancy_agreement',
  'tenants_id',
  'terms_and_conditions_to_landlord',
  'work_reference',
  'epc_certificate',
  'eicr_certificate'
];

// Map Excel column to checklist item type
const checklistColumnMap: Record<string, string> = {
  'Authorization To LL': 'authorization_to_landlord',
  'Bank Reference': 'bank_reference',
  'Deposit Held By Landlord': 'deposit_held_by_landlord',
  'Deposit Protection DPS': 'deposit_protection_dps',
  'Deposit Protection TDS': 'deposit_protection_tds',
  'Deposit and Rent': 'deposit_and_rent',
  'Gas Safety Certificate': 'gas_safety_certificate',
  'Guarantors Agreement': 'guarantors_agreement',
  'Information Sheet To LL': 'information_sheet_to_landlord',
  'Inventory': 'inventory',
  'Notices': 'notices',
  'Previous LL Reference': 'previous_landlord_reference',
  'Standing Order': 'standing_order',
  'Tenancy Agreement': 'tenancy_agreement',
  'Tenants ID': 'tenants_id',
  'Terms Conditions To LL': 'terms_and_conditions_to_landlord',
  'Work Reference': 'work_reference'
};

async function importData() {
  console.log('=== STARTING CLEAN DATA IMPORT ===\n');

  // Read Excel file
  const workbook = XLSX.readFile(EXCEL_FILE);
  const sheet = workbook.Sheets['Tenancy Data'];
  const rows = XLSX.utils.sheet_to_json(sheet) as any[];

  console.log(`Found ${rows.length} rows to import\n`);

  // Track created entities to avoid duplicates
  const landlordMap = new Map<string, number>(); // email -> id
  const tenantMap = new Map<string, number>(); // name -> id
  const propertyMap = new Map<string, number>(); // address -> id

  let landlordCount = 0;
  let tenantCount = 0;
  let propertyCount = 0;
  let tenancyCount = 0;
  let checklistCount = 0;

  for (const row of rows) {
    try {
      // === 1. Create or find Landlord ===
      const landlordEmail = (row['Landlord Email'] || '').trim().toLowerCase();
      const landlordName = (row['Landlord Name'] || '').trim();

      let landlordId: number;

      if (landlordEmail && landlordMap.has(landlordEmail)) {
        landlordId = landlordMap.get(landlordEmail)!;
      } else if (landlordName) {
        // Check if landlord already exists by name
        const existingLandlord = await pool.query(
          'SELECT id FROM landlords WHERE LOWER(name) = LOWER($1) LIMIT 1',
          [landlordName]
        );

        if (existingLandlord.rows.length > 0) {
          landlordId = existingLandlord.rows[0].id;
        } else {
          // Create new landlord
          const landlordAddress = parseAddress(row['Landlord Address'] || '');

          const result = await pool.query(`
            INSERT INTO landlords (
              name, email, phone, mobile,
              address_line1, address_line2, city, postcode,
              bank_name, bank_account_number, bank_sort_code,
              landlord_type, status
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
            RETURNING id
          `, [
            landlordName,
            landlordEmail || null,
            (row['Landlord Telephone'] || '').trim() || null,
            (row['Landlord Mobile'] || '').trim() || null,
            landlordAddress.line1 || null,
            landlordAddress.line2 || null,
            landlordAddress.city || null,
            landlordAddress.postcode || null,
            (row['Bank Name'] || '').trim() || null,
            (row['Bank Account No'] || '').toString().trim() || null,
            (row['Bank Sort Code'] || '').toString().trim() || null,
            'individual',
            'active'
          ]);

          landlordId = result.rows[0].id;
          landlordCount++;
        }

        if (landlordEmail) {
          landlordMap.set(landlordEmail, landlordId);
        }
      } else {
        console.log(`  Skipping row - no landlord name`);
        continue;
      }

      // === 2. Create or find Tenant ===
      const tenantName = (row['Tenant Name'] || '').trim();
      let tenantId: number | null = null;

      if (tenantName) {
        if (tenantMap.has(tenantName)) {
          tenantId = tenantMap.get(tenantName)!;
        } else {
          // Check if tenant exists
          const existingTenant = await pool.query(
            'SELECT id FROM tenants WHERE LOWER(name) = LOWER($1) LIMIT 1',
            [tenantName]
          );

          if (existingTenant.rows.length > 0) {
            tenantId = existingTenant.rows[0].id;
          } else {
            // Create new tenant
            const result = await pool.query(`
              INSERT INTO tenants (name, phone, mobile, status)
              VALUES ($1, $2, $3, $4)
              RETURNING id
            `, [
              tenantName,
              (row['Tenant Telephone'] || '').trim() || null,
              (row['Tenant Mobile'] || '').trim() || null,
              'active'
            ]);

            tenantId = result.rows[0].id;
            tenantCount++;
          }

          tenantMap.set(tenantName, tenantId);
        }
      }

      // === 3. Create or find Property ===
      const propertyAddress = (row['Property Address'] || row['Property Name'] || '').trim();
      const postcode = extractPostcode(propertyAddress);

      let propertyId: number;

      if (propertyMap.has(propertyAddress)) {
        propertyId = propertyMap.get(propertyAddress)!;
      } else {
        // Check if property exists
        const existingProperty = await pool.query(
          'SELECT id FROM properties WHERE LOWER(address_line1) = LOWER($1) OR LOWER(address) = LOWER($1) LIMIT 1',
          [propertyAddress]
        );

        if (existingProperty.rows.length > 0) {
          propertyId = existingProperty.rows[0].id;
          // Update landlord_id
          await pool.query('UPDATE properties SET landlord_id = $1, is_managed = true WHERE id = $2', [landlordId, propertyId]);
        } else {
          // Create new property
          const mgmtFeePercent = parseFloat(row['Management Fee Percent']) || null;

          const result = await pool.query(`
            INSERT INTO properties (
              address, address_line1, postcode,
              landlord_id, is_managed, is_rental,
              management_fee_type, management_fee_value,
              status
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
            RETURNING id
          `, [
            propertyAddress,
            propertyAddress,
            postcode || null,
            landlordId,
            true, // is_managed
            true, // is_rental
            mgmtFeePercent ? 'percentage' : null,
            mgmtFeePercent,
            'active'
          ]);

          propertyId = result.rows[0].id;
          propertyCount++;
        }

        propertyMap.set(propertyAddress, propertyId);
      }

      // === 4. Create Tenancy ===
      const startDate = parseDate(row['Tenancy Start']);
      const endDate = parseDate(row['Tenancy End']);
      const rentAmount = parseFloat((row['Rent Amount'] || '0').toString().replace(/[^0-9.]/g, '')) || null;
      const depositAmount = parseFloat((row['Deposit Amount'] || '0').toString().replace(/[^0-9.]/g, '')) || null;
      const rentFrequency = parseRentFrequency(row['Rent Frequency']);
      const { scheme: depositScheme, holderType: depositHolderType } = parseDepositHolder(row['Deposit Holder']);

      // Check if tenancy already exists for this property
      const existingTenancy = await pool.query(
        'SELECT id FROM tenancies WHERE property_id = $1 AND status = $2 LIMIT 1',
        [propertyId, 'active']
      );

      let tenancyId: number;

      if (existingTenancy.rows.length > 0) {
        tenancyId = existingTenancy.rows[0].id;
        // Update existing tenancy
        await pool.query(`
          UPDATE tenancies SET
            landlord_id = $1,
            tenant_id = $2,
            start_date = $3,
            end_date = $4,
            rent_amount = $5,
            rent_frequency = $6,
            deposit_amount = $7,
            deposit_scheme = $8,
            deposit_holder_type = $9,
            updated_at = NOW()
          WHERE id = $10
        `, [
          landlordId,
          tenantId,
          startDate,
          endDate,
          rentAmount,
          rentFrequency,
          depositAmount,
          depositScheme || null,
          depositHolderType || null,
          tenancyId
        ]);
      } else {
        // Create new tenancy
        const result = await pool.query(`
          INSERT INTO tenancies (
            property_id, landlord_id, tenant_id,
            start_date, end_date,
            rent_amount, rent_frequency,
            deposit_amount, deposit_scheme, deposit_holder_type,
            status
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
          RETURNING id
        `, [
          propertyId,
          landlordId,
          tenantId,
          startDate,
          endDate,
          rentAmount,
          rentFrequency,
          depositAmount,
          depositScheme || null,
          depositHolderType || null,
          'active'
        ]);

        tenancyId = result.rows[0].id;
        tenancyCount++;
      }

      // === 5. Create Checklist Items ===
      // Delete existing checklist items for this tenancy
      await pool.query('DELETE FROM tenancy_checklist WHERE tenancy_id = $1', [tenancyId]);

      // Create checklist items
      for (const [columnName, itemType] of Object.entries(checklistColumnMap)) {
        const value = row[columnName];
        const isCompleted = value && value.toString().toLowerCase() === 'yes';

        await pool.query(`
          INSERT INTO tenancy_checklist (tenancy_id, item_type, is_completed)
          VALUES ($1, $2, $3)
        `, [tenancyId, itemType, isCompleted]);

        checklistCount++;
      }

      // Add additional checklist items that aren't in the Excel
      const additionalItems = ['epc_certificate', 'eicr_certificate'];
      for (const itemType of additionalItems) {
        await pool.query(`
          INSERT INTO tenancy_checklist (tenancy_id, item_type, is_completed)
          VALUES ($1, $2, $3)
        `, [tenancyId, itemType, false]);
        checklistCount++;
      }

      console.log(`  Imported: ${propertyAddress.substring(0, 40)}...`);

    } catch (error) {
      console.error(`  Error processing row:`, error);
    }
  }

  console.log('\n=== IMPORT COMPLETE ===');
  console.log(`Landlords created: ${landlordCount}`);
  console.log(`Tenants created: ${tenantCount}`);
  console.log(`Properties created: ${propertyCount}`);
  console.log(`Tenancies created: ${tenancyCount}`);
  console.log(`Checklist items created: ${checklistCount}`);

  await pool.end();
}

importData().catch(err => {
  console.error('Import failed:', err);
  pool.end();
  process.exit(1);
});
