import XLSX from 'xlsx';
import { pool } from '../server/db';

const XLSX_PATH = 'C:\\Users\\ziaa\\Dropbox\\ZA\\DOWNLOADS\\BUSINESS\\JOHN BARCLAY\\Documentation\\Managed_PropertyList_Data.xlsx';

interface PropertyRow {
  'Property Address': string;
  'Postcode': string;
  'Management Fee (%)': number;
  'Landlord Name': string;
  'Deposit': number;
  'Rent Amount': number;
  'Tenancy Start': string;
  'Tenancy End': string;
  'Bank Name': string;
  'Account Number': string;
  'Sort Code': string;
  'Telephone': string;
  'Mobile': string;
  'Email': string;
  'Deposit Held By': string;
  'Management Type': string;
  'Period (Months)': number;
  'Payment Frequency': string;
  'Tenant Name': string;
  'Spare Keys in Office': string;
}

async function importData() {
  console.log('Reading Excel file...');
  const workbook = XLSX.readFile(XLSX_PATH);
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  const data: PropertyRow[] = XLSX.utils.sheet_to_json(sheet);

  console.log(`Found ${data.length} rows to import`);

  // Track unique landlords
  const landlordMap = new Map<string, number>();
  const propertyMap = new Map<string, number>();

  // Step 1: Insert unique landlords
  console.log('\n--- Inserting Landlords ---');
  for (const row of data) {
    const landlordName = row['Landlord Name']?.trim();
    if (!landlordName || landlordMap.has(landlordName)) continue;

    // Determine if company or individual
    const isCompany = landlordName.includes('Ltd') || landlordName.includes('Limited') ||
                      landlordName.includes('Properties') || landlordName.includes('Investment') ||
                      landlordName.includes('Accommodation') || landlordName.includes('Rentals');

    const landlordType = isCompany ? 'company' : 'individual';
    const companyName = isCompany ? landlordName : null;

    try {
      const result = await pool.query(`
        INSERT INTO pm_landlords (name, landlord_type, company_name, email, phone, mobile, bank_name, bank_account_number, bank_sort_code, status)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'active')
        RETURNING id
      `, [
        landlordName,
        landlordType,
        companyName,
        row['Email'] || null,
        row['Telephone'] || null,
        row['Mobile'] || null,
        row['Bank Name'] || null,
        row['Account Number'] || null,
        row['Sort Code'] || null
      ]);

      landlordMap.set(landlordName, result.rows[0].id);
      console.log(`  Inserted landlord: ${landlordName} (ID: ${result.rows[0].id})`);
    } catch (err: any) {
      console.error(`  Error inserting landlord ${landlordName}:`, err.message);
    }
  }

  console.log(`\nTotal landlords inserted: ${landlordMap.size}`);

  // Step 2: Insert properties
  console.log('\n--- Inserting Properties ---');
  for (const row of data) {
    const address = row['Property Address']?.trim();
    const postcode = row['Postcode']?.trim();
    if (!address) continue;

    const propertyKey = `${address}-${postcode}`;
    if (propertyMap.has(propertyKey)) continue;

    const landlordName = row['Landlord Name']?.trim();
    const landlordId = landlordMap.get(landlordName);

    // Parse management fee
    const managementFee = parseFloat(row['Management Fee (%)']) || 0;
    const managementFeeType = managementFee > 0 ? 'percentage' : 'fixed';

    // Build full address
    const fullAddress = postcode ? `${address}, ${postcode}` : address;

    try {
      const result = await pool.query(`
        INSERT INTO pm_properties (
          address, address_line1, postcode, landlord_id,
          management_fee_type, management_fee_value,
          property_type, status, is_managed
        )
        VALUES ($1, $2, $3, $4, $5, $6, 'flat', 'managed', true)
        RETURNING id
      `, [
        fullAddress,
        address,
        postcode || 'Unknown',
        landlordId || null,
        managementFeeType,
        managementFee
      ]);

      propertyMap.set(propertyKey, result.rows[0].id);
      console.log(`  Inserted property: ${address} (ID: ${result.rows[0].id})`);
    } catch (err: any) {
      console.error(`  Error inserting property ${address}:`, err.message);
    }
  }

  console.log(`\nTotal properties inserted: ${propertyMap.size}`);

  // Step 3: Insert tenants and tenancies
  console.log('\n--- Inserting Tenants & Tenancies ---');
  let tenancyCount = 0;
  let tenantCount = 0;

  for (const row of data) {
    const address = row['Property Address']?.trim();
    const postcode = row['Postcode']?.trim();
    const propertyKey = `${address}-${postcode}`;
    const propertyId = propertyMap.get(propertyKey);

    const landlordName = row['Landlord Name']?.trim();
    const landlordId = landlordMap.get(landlordName);

    if (!propertyId || !landlordId) continue;

    // Parse dates (format: DD/MM/YYYY)
    const parseDate = (dateStr: string): Date | null => {
      if (!dateStr) return null;
      const parts = dateStr.split('/');
      if (parts.length !== 3) return null;
      const [day, month, year] = parts;
      return new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
    };

    const startDate = parseDate(row['Tenancy Start']);
    const endDate = parseDate(row['Tenancy End']);

    if (!startDate) continue;

    // Create tenant if tenant name exists
    let tenantId: number | null = null;
    const tenantName = row['Tenant Name']?.trim();
    if (tenantName && tenantName.length > 2) {
      try {
        const tenantResult = await pool.query(`
          INSERT INTO pm_tenants (name, status)
          VALUES ($1, 'active')
          RETURNING id
        `, [tenantName]);
        tenantId = tenantResult.rows[0].id;
        tenantCount++;
        console.log(`  Inserted tenant: ${tenantName} (ID: ${tenantId})`);
      } catch (err: any) {
        console.error(`  Error inserting tenant ${tenantName}:`, err.message);
      }
    }

    // Parse deposit scheme
    const depositHeldBy = row['Deposit Held By'] || '';
    let depositScheme = 'dps';
    if (depositHeldBy.includes('Landlord')) {
      depositScheme = 'landlord';
    } else if (depositHeldBy.includes('Custodial')) {
      depositScheme = 'dps';
    } else if (depositHeldBy.includes('Insurance')) {
      depositScheme = 'tds';
    }

    // Parse rent frequency
    const paymentFreq = row['Payment Frequency'] || 'Calendar Monthly';
    let rentFrequency = 'monthly';
    if (paymentFreq.includes('Quarterly')) {
      rentFrequency = 'quarterly';
    } else if (paymentFreq.includes('Annual')) {
      rentFrequency = 'annually';
    } else if (paymentFreq.includes('Weekly')) {
      rentFrequency = 'weekly';
    }

    // Create tenancy
    try {
      await pool.query(`
        INSERT INTO pm_tenancies (
          property_id, landlord_id, tenant_id,
          start_date, end_date, period_months,
          rent_amount, rent_frequency,
          deposit_amount, deposit_scheme,
          status
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'active')
      `, [
        propertyId,
        landlordId,
        tenantId,
        startDate,
        endDate,
        row['Period (Months)'] || 12,
        row['Rent Amount'] || 0,
        rentFrequency,
        row['Deposit'] || 0,
        depositScheme
      ]);
      tenancyCount++;
      console.log(`  Inserted tenancy for property ID ${propertyId}`);
    } catch (err: any) {
      console.error(`  Error inserting tenancy for ${address}:`, err.message);
    }
  }

  console.log(`\n=== Import Complete ===`);
  console.log(`Landlords: ${landlordMap.size}`);
  console.log(`Properties: ${propertyMap.size}`);
  console.log(`Tenants: ${tenantCount}`);
  console.log(`Tenancies: ${tenancyCount}`);

  await pool.end();
}

importData().catch(console.error);
