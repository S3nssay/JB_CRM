const { Pool } = require('pg');
const XLSX = require('xlsx');
require('dotenv').config();

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const EXCEL_FILE = 'C:/Users/ziaa/Dropbox/ZA/DOWNLOADS/BUSINESS/JOHN BARCLAY/Documentation/Managed_PropertyList_Data.xlsx';

function parseAddress(fullAddress) {
  if (!fullAddress) return { line1: '', line2: '', city: '', postcode: '' };
  const postcodeMatch = fullAddress.match(/([A-Z]{1,2}\d{1,2}[A-Z]?\s*\d[A-Z]{2})/i);
  const postcode = postcodeMatch ? postcodeMatch[1].toUpperCase() : '';
  let remaining = fullAddress.replace(postcode, '').trim();
  const parts = remaining.split(/,\s*/).filter(p => p.trim());
  let line1 = parts[0] || '';
  let line2 = parts.length >= 3 ? parts.slice(1, -1).join(', ') : '';
  let city = parts.length >= 2 ? parts[parts.length - 1] : '';
  return { line1, line2, city, postcode };
}

function extractPostcode(address) {
  if (!address) return '';
  const match = address.match(/([A-Z]{1,2}\d{1,2}[A-Z]?\s*\d[A-Z]{2})/i);
  return match ? match[1].toUpperCase() : '';
}

function parseDate(dateStr) {
  if (!dateStr) return null;
  const ddmmyyyy = dateStr.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (ddmmyyyy) {
    return new Date(parseInt(ddmmyyyy[3]), parseInt(ddmmyyyy[2]) - 1, parseInt(ddmmyyyy[1]));
  }
  const monthNames = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'];
  const ddMonthYYYY = dateStr.match(/(\d{1,2})\s+(\w+)\s+(\d{4})/i);
  if (ddMonthYYYY) {
    const monthIndex = monthNames.findIndex(m => m.startsWith(ddMonthYYYY[2].toLowerCase()));
    if (monthIndex >= 0) {
      return new Date(parseInt(ddMonthYYYY[3]), monthIndex, parseInt(ddMonthYYYY[1]));
    }
  }
  const d = new Date(dateStr);
  return isNaN(d.getTime()) ? null : d;
}

function parseRentFrequency(freq) {
  if (!freq) return 'monthly';
  const lower = freq.toLowerCase();
  if (lower.includes('week')) return 'weekly';
  return 'monthly';
}

function parseDepositHolder(holder) {
  if (!holder) return { scheme: null, holderType: null };
  const lower = holder.toLowerCase();
  if (lower.includes('landlord')) return { scheme: 'landlord', holderType: 'landlord' };
  if (lower.includes('dps')) return { scheme: 'dps', holderType: 'agency_custodial' };
  if (lower.includes('tds')) return { scheme: 'tds', holderType: 'agency_custodial' };
  if (lower.includes('insurance')) return { scheme: 'agency_insurance', holderType: 'agency_insurance' };
  if (lower.includes('agency')) return { scheme: 'agency_custodial', holderType: 'agency_custodial' };
  return { scheme: null, holderType: null };
}

const checklistColumnMap = {
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

  const workbook = XLSX.readFile(EXCEL_FILE);
  const sheet = workbook.Sheets['Tenancy Data'];
  const rows = XLSX.utils.sheet_to_json(sheet);

  console.log('Found', rows.length, 'rows to import\n');

  const landlordMap = new Map();
  const tenantMap = new Map();
  const propertyMap = new Map();

  let stats = { landlords: 0, tenants: 0, properties: 0, tenancies: 0, checklist: 0 };

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    try {
      // 1. Landlord
      const landlordEmail = (row['Landlord Email'] || '').trim().toLowerCase();
      const landlordName = (row['Landlord Name'] || '').trim();
      if (!landlordName) continue;

      let landlordId;
      if (landlordEmail && landlordMap.has(landlordEmail)) {
        landlordId = landlordMap.get(landlordEmail);
      } else {
        const existing = await pool.query('SELECT id FROM landlords WHERE LOWER(name) = LOWER($1) LIMIT 1', [landlordName]);
        if (existing.rows.length > 0) {
          landlordId = existing.rows[0].id;
        } else {
          const addr = parseAddress(row['Landlord Address'] || '');
          const result = await pool.query(
            `INSERT INTO landlords (name, email, phone, mobile, address_line1, address_line2, city, postcode, bank_name, bank_account_number, bank_sort_code, landlord_type, status)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13) RETURNING id`,
            [landlordName, landlordEmail || null, (row['Landlord Telephone']||'').trim()||null, (row['Landlord Mobile']||'').trim()||null,
             addr.line1||null, addr.line2||null, addr.city||null, addr.postcode||null,
             (row['Bank Name']||'').trim()||null, (row['Bank Account No']||'').toString().trim()||null,
             (row['Bank Sort Code']||'').toString().trim()||null, 'individual', 'active']
          );
          landlordId = result.rows[0].id;
          stats.landlords++;
        }
        if (landlordEmail) landlordMap.set(landlordEmail, landlordId);
      }

      // 2. Tenant
      const tenantName = (row['Tenant Name'] || '').trim();
      let tenantId = null;
      if (tenantName) {
        if (tenantMap.has(tenantName)) {
          tenantId = tenantMap.get(tenantName);
        } else {
          const existing = await pool.query('SELECT id FROM tenants WHERE LOWER(name) = LOWER($1) LIMIT 1', [tenantName]);
          if (existing.rows.length > 0) {
            tenantId = existing.rows[0].id;
          } else {
            const result = await pool.query(
              'INSERT INTO tenants (name, phone, mobile, status) VALUES ($1, $2, $3, $4) RETURNING id',
              [tenantName, (row['Tenant Telephone']||'').trim()||null, (row['Tenant Mobile']||'').trim()||null, 'active']
            );
            tenantId = result.rows[0].id;
            stats.tenants++;
          }
          tenantMap.set(tenantName, tenantId);
        }
      }

      // 3. Property
      const propertyAddress = (row['Property Address'] || row['Property Name'] || '').trim();
      const postcode = extractPostcode(propertyAddress);
      let propertyId;

      if (propertyMap.has(propertyAddress)) {
        propertyId = propertyMap.get(propertyAddress);
      } else {
        const existing = await pool.query(
          'SELECT id FROM properties WHERE LOWER(address_line1) = LOWER($1) OR LOWER(address) = LOWER($1) LIMIT 1',
          [propertyAddress]
        );
        if (existing.rows.length > 0) {
          propertyId = existing.rows[0].id;
          await pool.query('UPDATE properties SET landlord_id = $1, is_managed = true WHERE id = $2', [landlordId, propertyId]);
        } else {
          const mgmtFee = parseFloat(row['Management Fee Percent']) || null;
          const result = await pool.query(
            `INSERT INTO properties (address, address_line1, postcode, landlord_id, is_managed, is_rental, management_fee_type, management_fee_value, status)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING id`,
            [propertyAddress, propertyAddress, postcode||null, landlordId, true, true, mgmtFee?'percentage':null, mgmtFee, 'active']
          );
          propertyId = result.rows[0].id;
          stats.properties++;
        }
        propertyMap.set(propertyAddress, propertyId);
      }

      // 4. Tenancy
      const startDate = parseDate(row['Tenancy Start']);
      const endDate = parseDate(row['Tenancy End']);
      const rentAmount = parseFloat((row['Rent Amount']||'0').toString().replace(/[^0-9.]/g,''))||null;
      const depositAmount = parseFloat((row['Deposit Amount']||'0').toString().replace(/[^0-9.]/g,''))||null;
      const rentFrequency = parseRentFrequency(row['Rent Frequency']);
      const { scheme: depositScheme, holderType: depositHolderType } = parseDepositHolder(row['Deposit Holder']);

      const existingTenancy = await pool.query(
        'SELECT id FROM tenancies WHERE property_id = $1 AND status = $2 LIMIT 1',
        [propertyId, 'active']
      );
      let tenancyId;

      if (existingTenancy.rows.length > 0) {
        tenancyId = existingTenancy.rows[0].id;
        await pool.query(
          `UPDATE tenancies SET landlord_id=$1, tenant_id=$2, start_date=$3, end_date=$4, rent_amount=$5,
           rent_frequency=$6, deposit_amount=$7, deposit_scheme=$8, deposit_holder_type=$9, updated_at=NOW() WHERE id=$10`,
          [landlordId, tenantId, startDate, endDate, rentAmount, rentFrequency, depositAmount, depositScheme, depositHolderType, tenancyId]
        );
      } else {
        const result = await pool.query(
          `INSERT INTO tenancies (property_id, landlord_id, tenant_id, start_date, end_date, rent_amount, rent_frequency,
           deposit_amount, deposit_scheme, deposit_holder_type, status)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING id`,
          [propertyId, landlordId, tenantId, startDate, endDate, rentAmount, rentFrequency, depositAmount, depositScheme, depositHolderType, 'active']
        );
        tenancyId = result.rows[0].id;
        stats.tenancies++;
      }

      // 5. Checklist
      await pool.query('DELETE FROM tenancy_checklist WHERE tenancy_id = $1', [tenancyId]);
      for (const [col, itemType] of Object.entries(checklistColumnMap)) {
        const val = row[col];
        const isCompleted = val && val.toString().toLowerCase() === 'yes';
        await pool.query(
          'INSERT INTO tenancy_checklist (tenancy_id, item_type, is_completed) VALUES ($1, $2, $3)',
          [tenancyId, itemType, isCompleted]
        );
        stats.checklist++;
      }
      // Additional items
      for (const itemType of ['epc_certificate', 'eicr_certificate']) {
        await pool.query(
          'INSERT INTO tenancy_checklist (tenancy_id, item_type, is_completed) VALUES ($1, $2, $3)',
          [tenancyId, itemType, false]
        );
        stats.checklist++;
      }

      if ((i+1) % 20 === 0) console.log('  Processed', i+1, 'rows...');
    } catch (err) {
      console.error('Error row', i, ':', err.message);
    }
  }

  console.log('\n=== IMPORT COMPLETE ===');
  console.log('Landlords:', stats.landlords);
  console.log('Tenants:', stats.tenants);
  console.log('Properties:', stats.properties);
  console.log('Tenancies:', stats.tenancies);
  console.log('Checklist items:', stats.checklist);

  pool.end();
}

importData().catch(err => { console.error(err); pool.end(); });
