/**
 * Full Import Script for Managed Properties from Excel
 *
 * This script imports ALL data from Managed_PropertyList_Data.xlsx including:
 * - Landlords (with bank details)
 * - Properties (with management details)
 * - Tenants
 * - Tenancies (linking property, landlord, tenant with full deposit details)
 * - Tenancy Checklist items
 *
 * IMPORTANT: Each row in Excel represents a TENANCY with embedded landlord, property, and tenant data.
 * The same landlord or property may appear in multiple rows (multiple tenancies).
 */

import XLSX from 'xlsx';
import path from 'path';
import { db } from '../server/db';
import {
  pmLandlords,
  pmProperties,
  pmTenants,
  pmTenancies,
  pmTenancyChecklist
} from '../shared/schema';
import { eq, and } from 'drizzle-orm';

const EXCEL_PATH = path.join('C:', 'Users', 'ziaa', 'Dropbox', 'ZA', 'DOWNLOADS', 'BUSINESS', 'JOHN BARCLAY', 'Documentation', 'Managed_PropertyList_Data.xlsx');

// Excel column indices (0-based)
const COL = {
  PAGE: 0,
  PROPERTY_NAME: 1,
  PROPERTY_ADDRESS: 2,
  AS_AT_DATE: 3,
  MGMT_FEE_PERCENT: 4,
  MGMT_TYPE: 5,
  MGMT_PERIOD: 6,
  LANDLORD_NAME: 7,
  LANDLORD_ADDRESS: 8,
  LANDLORD_TELEPHONE: 9,
  LANDLORD_MOBILE: 10,
  LANDLORD_EMAIL: 11,
  BANK_NAME: 12,
  BANK_ACCOUNT_NO: 13,
  BANK_SORT_CODE: 14,
  TENANT_NAME: 15,
  TENANCY_START: 16,
  TENANCY_END: 17,
  TENANCY_PERIOD: 18,
  RENT_AMOUNT: 19,
  RENT_FREQUENCY: 20,
  DEPOSIT_AMOUNT: 21,
  DEPOSIT_HOLDER: 22,
  TENANT_TELEPHONE: 23,
  TENANT_MOBILE: 24,
  // Checklist items (Yes/No)
  AUTH_TO_LL: 25,
  BANK_REFERENCE: 26,
  DEPOSIT_HELD_BY_LL: 27,
  DEPOSIT_DPS: 28,
  DEPOSIT_TDS: 29,
  DEPOSIT_AND_RENT: 30,
  GAS_SAFETY: 31,
  GUARANTORS_AGREEMENT: 32,
  INFO_SHEET_TO_LL: 33,
  INVENTORY: 34,
  NOTICES: 35,
  PREV_LL_REF: 36,
  STANDING_ORDER: 37,
  TENANCY_AGREEMENT: 38,
  TENANTS_ID: 39,
  TERMS_COND_TO_LL: 40,
  WORK_REFERENCE: 41
};

interface ExcelRow {
  [key: number]: any;
}

// Parse date from Excel (handles various formats)
function parseDate(value: any): Date | null {
  if (!value) return null;

  // If it's already a Date
  if (value instanceof Date) return value;

  // If it's a number (Excel serial date)
  if (typeof value === 'number') {
    const excelEpoch = new Date(1899, 11, 30);
    return new Date(excelEpoch.getTime() + value * 24 * 60 * 60 * 1000);
  }

  // If it's a string
  if (typeof value === 'string') {
    // Try DD/MM/YYYY format
    const dmyMatch = value.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
    if (dmyMatch) {
      return new Date(parseInt(dmyMatch[3]), parseInt(dmyMatch[2]) - 1, parseInt(dmyMatch[1]));
    }

    // Try other formats
    const parsed = new Date(value);
    if (!isNaN(parsed.getTime())) return parsed;
  }

  return null;
}

// Parse number from Excel
function parseNumber(value: any): number | null {
  if (value === null || value === undefined || value === '') return null;
  const num = typeof value === 'number' ? value : parseFloat(String(value).replace(/[^0-9.-]/g, ''));
  return isNaN(num) ? null : num;
}

// Parse period from string like "12 Months" -> 12
function parsePeriodMonths(value: string | null): number | null {
  if (!value) return null;
  const match = String(value).match(/(\d+)/);
  return match ? parseInt(match[1]) : null;
}

// Parse rent frequency
function parseRentFrequency(value: string | null): string {
  if (!value) return 'monthly';
  const lower = String(value).toLowerCase();
  if (lower.includes('week')) return 'weekly';
  if (lower.includes('quarter')) return 'quarterly';
  if (lower.includes('annual') || lower.includes('year')) return 'annually';
  return 'monthly'; // Default: Calendar Monthly
}

// Parse deposit holder type
function parseDepositHolderType(value: string | null): { holderType: string; scheme: string | null } {
  if (!value) return { holderType: 'agency_custodial', scheme: null };
  const lower = String(value).toLowerCase();

  if (lower.includes('landlord')) {
    return { holderType: 'landlord', scheme: 'landlord' };
  }
  if (lower.includes('insurance')) {
    return { holderType: 'agency_insurance', scheme: 'insurance' };
  }
  if (lower.includes('custodial') || lower.includes('agency')) {
    return { holderType: 'agency_custodial', scheme: 'dps' };
  }

  return { holderType: 'agency_custodial', scheme: 'dps' };
}

// Extract postcode from address
function extractPostcode(address: string): string {
  if (!address) return '';
  // UK postcode pattern
  const match = address.match(/([A-Z]{1,2}\d{1,2}[A-Z]?\s*\d[A-Z]{2})/i);
  return match ? match[1].toUpperCase().replace(/\s+/g, ' ') : '';
}

// Clean address - remove postcode and extra spaces
function cleanAddress(address: string): string {
  if (!address) return '';
  const postcode = extractPostcode(address);
  let cleaned = address.replace(postcode, '').trim();
  // Remove trailing commas and extra spaces
  cleaned = cleaned.replace(/,\s*$/, '').replace(/\s+/g, ' ').trim();
  return cleaned;
}

// Check if checklist item is completed (Yes/No)
function isCompleted(value: any): boolean {
  if (!value) return false;
  return String(value).toLowerCase().trim() === 'yes';
}

// Track created entities to avoid duplicates
const landlordCache = new Map<string, number>(); // email -> id
const propertyCache = new Map<string, number>(); // full address -> id (NOT postcode - flats share postcodes!)
const tenantCache = new Map<string, number>(); // name+mobile -> id

async function findOrCreateLandlord(row: ExcelRow): Promise<number> {
  const name = String(row[COL.LANDLORD_NAME] || '').trim();
  const email = String(row[COL.LANDLORD_EMAIL] || '').trim().toLowerCase();
  const phone = String(row[COL.LANDLORD_TELEPHONE] || '').trim();
  const mobile = String(row[COL.LANDLORD_MOBILE] || '').trim();
  const address = String(row[COL.LANDLORD_ADDRESS] || '').trim();
  const bankName = String(row[COL.BANK_NAME] || '').trim();
  const bankAccountNumber = String(row[COL.BANK_ACCOUNT_NO] || '').trim();
  const bankSortCode = String(row[COL.BANK_SORT_CODE] || '').trim();

  if (!name) {
    throw new Error('Landlord name is required');
  }

  // Create a unique key for caching - use email if available, otherwise name+mobile
  const cacheKey = email || `${name}_${mobile}`;

  if (landlordCache.has(cacheKey)) {
    return landlordCache.get(cacheKey)!;
  }

  // Check if landlord exists in DB by email (if provided)
  if (email) {
    const existing = await db.select()
      .from(pmLandlords)
      .where(eq(pmLandlords.email, email))
      .limit(1);

    if (existing.length > 0) {
      landlordCache.set(cacheKey, existing[0].id);
      return existing[0].id;
    }
  }

  // Determine if company or individual
  const isCompany = name.toLowerCase().includes('ltd') ||
                   name.toLowerCase().includes('limited') ||
                   name.toLowerCase().includes('llp') ||
                   name.toLowerCase().includes('plc');

  // Extract postcode from landlord address
  const postcode = extractPostcode(address);

  // Create new landlord
  const [newLandlord] = await db.insert(pmLandlords).values({
    name: name,
    landlordType: isCompany ? 'company' : 'individual',
    companyName: isCompany ? name : null,
    email: email || null,
    phone: phone || null,
    mobile: mobile || null,
    address: address || null,
    postcode: postcode || null,
    bankName: bankName || null,
    bankAccountNumber: bankAccountNumber || null,
    bankSortCode: bankSortCode || null,
    status: 'active'
  }).returning();

  landlordCache.set(cacheKey, newLandlord.id);
  console.log(`  Created landlord: ${name} (ID: ${newLandlord.id})`);
  return newLandlord.id;
}

async function findOrCreateProperty(row: ExcelRow, landlordId: number): Promise<number> {
  const propertyName = String(row[COL.PROPERTY_NAME] || '').trim();
  const propertyAddress = String(row[COL.PROPERTY_ADDRESS] || '').trim();
  const postcode = extractPostcode(propertyAddress);
  const mgmtFeePercent = parseNumber(row[COL.MGMT_FEE_PERCENT]);
  const mgmtType = String(row[COL.MGMT_TYPE] || 'Managed').trim().toLowerCase();
  const mgmtPeriod = parsePeriodMonths(row[COL.MGMT_PERIOD]);

  if (!postcode) {
    console.warn(`  Warning: No postcode found in address: ${propertyAddress}`);
  }

  // Use FULL ADDRESS as cache key - different flats in same building share postcodes!
  // Normalize the address for comparison
  const normalizedAddress = propertyAddress.toLowerCase().replace(/\s+/g, ' ').trim();
  const cacheKey = normalizedAddress;

  if (propertyCache.has(cacheKey)) {
    return propertyCache.get(cacheKey)!;
  }

  // Check if property exists in DB by full address (case-insensitive)
  const existing = await db.select()
    .from(pmProperties)
    .where(eq(pmProperties.address, propertyAddress))
    .limit(1);

  if (existing.length > 0) {
    // Update with any new information
    await db.update(pmProperties)
      .set({
        propertyName: propertyName || existing[0].propertyName,
        landlordId: landlordId,
        managementFeeValue: mgmtFeePercent?.toString() || existing[0].managementFeeValue,
        managementType: mgmtType || existing[0].managementType,
        managementPeriodMonths: mgmtPeriod || existing[0].managementPeriodMonths,
        updatedAt: new Date()
      })
      .where(eq(pmProperties.id, existing[0].id));

    propertyCache.set(cacheKey, existing[0].id);
    return existing[0].id;
  }

  // Clean up property name (remove duplicated text)
  let cleanPropertyName = propertyName;
  // Some entries have duplicated text like "216A WCalrmic kLleawneood"
  // Just use the first word/number combo if it looks corrupted
  if (cleanPropertyName.length > 30 && !cleanPropertyName.includes(',')) {
    const firstPart = cleanPropertyName.split(' ')[0];
    if (/^\d+[A-Z]?$/i.test(firstPart)) {
      cleanPropertyName = firstPart;
    }
  }

  // Extract city from address (usually "London")
  const addressParts = cleanAddress(propertyAddress).split(',').map(p => p.trim());
  const city = addressParts.find(p => p.toLowerCase() === 'london') || 'London';
  const addressLine1 = addressParts[0] || propertyAddress;

  // Create new property
  const [newProperty] = await db.insert(pmProperties).values({
    propertyName: cleanPropertyName || null,
    address: propertyAddress,
    addressLine1: addressLine1,
    city: city,
    postcode: postcode || 'Unknown',
    isManaged: true,
    propertyCategory: 'residential',
    propertyType: 'flat', // Default, can be updated later
    landlordId: landlordId,
    managementType: mgmtType || 'managed',
    managementPeriodMonths: mgmtPeriod,
    managementFeeType: mgmtFeePercent ? 'percentage' : null,
    managementFeeValue: mgmtFeePercent?.toString() || null,
    status: 'active'
  }).returning();

  propertyCache.set(cacheKey, newProperty.id);
  console.log(`  Created property: ${cleanPropertyName || postcode} (ID: ${newProperty.id})`);
  return newProperty.id;
}

async function findOrCreateTenant(row: ExcelRow): Promise<number | null> {
  const name = String(row[COL.TENANT_NAME] || '').trim();
  const phone = String(row[COL.TENANT_TELEPHONE] || '').trim();
  const mobile = String(row[COL.TENANT_MOBILE] || '').trim();

  // If no tenant name, this might be a void period
  if (!name) {
    return null;
  }

  // Use name+mobile as cache key
  const cacheKey = `${name}_${mobile}`;

  if (tenantCache.has(cacheKey)) {
    return tenantCache.get(cacheKey)!;
  }

  // Check if tenant exists (by name and mobile)
  if (mobile) {
    const existing = await db.select()
      .from(pmTenants)
      .where(eq(pmTenants.mobile, mobile))
      .limit(1);

    if (existing.length > 0) {
      tenantCache.set(cacheKey, existing[0].id);
      return existing[0].id;
    }
  }

  // Determine if company tenant
  const isCompany = name.toLowerCase().includes('ltd') ||
                   name.toLowerCase().includes('limited') ||
                   name.toLowerCase().includes('llp');

  // Create new tenant
  const [newTenant] = await db.insert(pmTenants).values({
    name: name,
    phone: phone || null,
    mobile: mobile || null,
    status: 'active'
  }).returning();

  tenantCache.set(cacheKey, newTenant.id);
  console.log(`  Created tenant: ${name} (ID: ${newTenant.id})`);
  return newTenant.id;
}

async function createTenancy(
  row: ExcelRow,
  propertyId: number,
  landlordId: number,
  tenantId: number | null
): Promise<number> {
  const startDate = parseDate(row[COL.TENANCY_START]);
  const endDate = parseDate(row[COL.TENANCY_END]);
  const periodMonths = parsePeriodMonths(row[COL.TENANCY_PERIOD]);
  const rentAmount = parseNumber(row[COL.RENT_AMOUNT]);
  const rentFrequency = parseRentFrequency(row[COL.RENT_FREQUENCY]);
  const depositAmount = parseNumber(row[COL.DEPOSIT_AMOUNT]);
  const depositHolder = String(row[COL.DEPOSIT_HOLDER] || '').trim();
  const { holderType, scheme } = parseDepositHolderType(depositHolder);

  // Determine deposit scheme based on checklist
  let depositScheme = scheme;
  if (isCompleted(row[COL.DEPOSIT_DPS])) depositScheme = 'dps';
  else if (isCompleted(row[COL.DEPOSIT_TDS])) depositScheme = 'tds';
  else if (isCompleted(row[COL.DEPOSIT_HELD_BY_LL])) depositScheme = 'landlord';

  // Create tenancy - use a default rent if not provided
  const [newTenancy] = await db.insert(pmTenancies).values({
    propertyId,
    landlordId,
    tenantId,
    startDate: startDate || new Date(),
    endDate: endDate,
    periodMonths: periodMonths,
    rentAmount: (rentAmount || 0).toString(),
    rentFrequency: rentFrequency,
    depositAmount: depositAmount?.toString() || null,
    depositScheme: depositScheme,
    depositHolderType: holderType,
    status: tenantId ? 'active' : 'void'
  }).returning();

  console.log(`  Created tenancy ID: ${newTenancy.id} (${startDate?.toLocaleDateString() || 'No start'} - ${endDate?.toLocaleDateString() || 'No end'})`);
  return newTenancy.id;
}

async function createChecklistItems(row: ExcelRow, tenancyId: number): Promise<void> {
  const checklistMappings: Array<{ col: number; itemType: string }> = [
    { col: COL.AUTH_TO_LL, itemType: 'authorization_to_landlord' },
    { col: COL.BANK_REFERENCE, itemType: 'bank_reference' },
    { col: COL.DEPOSIT_HELD_BY_LL, itemType: 'deposit_held_by_landlord' },
    { col: COL.DEPOSIT_DPS, itemType: 'deposit_protection_dps' },
    { col: COL.DEPOSIT_TDS, itemType: 'deposit_protection_tds' },
    { col: COL.DEPOSIT_AND_RENT, itemType: 'deposits_and_rent' },
    { col: COL.GAS_SAFETY, itemType: 'gas_safety_certificate' },
    { col: COL.GUARANTORS_AGREEMENT, itemType: 'guarantors_agreement' },
    { col: COL.INFO_SHEET_TO_LL, itemType: 'information_sheet_to_landlord' },
    { col: COL.INVENTORY, itemType: 'inventory' },
    { col: COL.NOTICES, itemType: 'notices' },
    { col: COL.PREV_LL_REF, itemType: 'previous_landlord_reference' },
    { col: COL.STANDING_ORDER, itemType: 'standing_order' },
    { col: COL.TENANCY_AGREEMENT, itemType: 'tenancy_agreement' },
    { col: COL.TENANTS_ID, itemType: 'tenants_id' },
    { col: COL.TERMS_COND_TO_LL, itemType: 'terms_and_conditions_to_landlord' },
    { col: COL.WORK_REFERENCE, itemType: 'work_reference' }
  ];

  for (const mapping of checklistMappings) {
    const completed = isCompleted(row[mapping.col]);
    await db.insert(pmTenancyChecklist).values({
      tenancyId,
      itemType: mapping.itemType,
      isCompleted: completed,
      completedAt: completed ? new Date() : null
    });
  }
}

async function clearExistingData(): Promise<void> {
  console.log('Clearing existing PM data...');
  // Delete in correct order due to foreign keys
  await db.delete(pmTenancyChecklist);
  await db.delete(pmTenancies);
  await db.delete(pmProperties);
  await db.delete(pmTenants);
  await db.delete(pmLandlords);
  console.log('Existing data cleared.');
}

async function importData() {
  console.log('='.repeat(60));
  console.log('FULL MANAGED PROPERTY DATA IMPORT');
  console.log('='.repeat(60));
  console.log(`Reading: ${EXCEL_PATH}\n`);

  // Read Excel file - use first sheet regardless of name
  const workbook = XLSX.readFile(EXCEL_PATH);
  const sheetName = workbook.SheetNames[0];
  console.log(`Using sheet: "${sheetName}"`);
  const sheet = workbook.Sheets[sheetName];
  const rows: ExcelRow[] = XLSX.utils.sheet_to_json(sheet, { header: 1 });

  console.log(`Found ${rows.length - 1} data rows (excluding header)\n`);

  // Clear existing data first
  await clearExistingData();

  let successCount = 0;
  let errorCount = 0;
  const errors: string[] = [];

  // Skip header row (index 0)
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];

    // Skip empty rows
    if (!row || !row[COL.PROPERTY_ADDRESS]) {
      continue;
    }

    const rowNum = row[COL.PAGE] || i;
    const propertyAddress = String(row[COL.PROPERTY_ADDRESS] || '').trim();
    const postcode = extractPostcode(propertyAddress);

    console.log(`\nRow ${rowNum}: ${postcode || propertyAddress.substring(0, 30)}...`);

    try {
      // 1. Create/find Landlord
      const landlordId = await findOrCreateLandlord(row);

      // 2. Create/find Property (linked to landlord)
      const propertyId = await findOrCreateProperty(row, landlordId);

      // 3. Create/find Tenant (if exists)
      const tenantId = await findOrCreateTenant(row);

      // 4. Create Tenancy (links property, landlord, tenant)
      const tenancyId = await createTenancy(row, propertyId, landlordId, tenantId);

      // 5. Create Checklist Items for this tenancy
      await createChecklistItems(row, tenancyId);

      successCount++;
    } catch (error: any) {
      console.error(`  ERROR: ${error.message}`);
      errors.push(`Row ${rowNum} (${postcode}): ${error.message}`);
      errorCount++;
    }
  }

  console.log('\n' + '='.repeat(60));
  console.log('IMPORT COMPLETE');
  console.log('='.repeat(60));
  console.log(`Successfully imported: ${successCount} rows`);
  console.log(`Errors: ${errorCount} rows`);
  console.log(`Landlords created: ${landlordCache.size}`);
  console.log(`Properties created: ${propertyCache.size}`);
  console.log(`Tenants created: ${tenantCache.size}`);

  if (errors.length > 0) {
    console.log('\nErrors encountered:');
    errors.forEach(e => console.log(`  - ${e}`));
  }

  // Verify W12 0PA property
  console.log('\n' + '='.repeat(60));
  console.log('VERIFICATION: W12 0PA Property');
  console.log('='.repeat(60));

  const w12Property = await db.select()
    .from(pmProperties)
    .where(eq(pmProperties.postcode, 'W12 0PA'))
    .limit(1);

  if (w12Property.length > 0) {
    const prop = w12Property[0];
    console.log(`Property ID: ${prop.id}`);
    console.log(`Property Name: ${prop.propertyName}`);
    console.log(`Address: ${prop.address}`);
    console.log(`Postcode: ${prop.postcode}`);
    console.log(`Management Type: ${prop.managementType}`);
    console.log(`Management Period: ${prop.managementPeriodMonths} months`);
    console.log(`Management Fee: ${prop.managementFeeValue}%`);
    console.log(`Landlord ID: ${prop.landlordId}`);

    // Get landlord details
    if (prop.landlordId) {
      const landlord = await db.select()
        .from(pmLandlords)
        .where(eq(pmLandlords.id, prop.landlordId))
        .limit(1);

      if (landlord.length > 0) {
        console.log(`\nLandlord: ${landlord[0].name}`);
        console.log(`Email: ${landlord[0].email}`);
        console.log(`Bank: ${landlord[0].bankName}`);
        console.log(`Account: ${landlord[0].bankAccountNumber}`);
        console.log(`Sort Code: ${landlord[0].bankSortCode}`);
      }
    }

    // Get tenancies
    const tenancies = await db.select()
      .from(pmTenancies)
      .where(eq(pmTenancies.propertyId, prop.id));

    console.log(`\nTenancies: ${tenancies.length}`);
    for (const t of tenancies) {
      console.log(`  - Tenancy ${t.id}: ${t.startDate?.toLocaleDateString()} to ${t.endDate?.toLocaleDateString()}`);
      console.log(`    Rent: £${t.rentAmount} ${t.rentFrequency}`);
      console.log(`    Deposit: £${t.depositAmount} (${t.depositHolderType})`);

      if (t.tenantId) {
        const tenant = await db.select()
          .from(pmTenants)
          .where(eq(pmTenants.id, t.tenantId))
          .limit(1);
        if (tenant.length > 0) {
          console.log(`    Tenant: ${tenant[0].name} (${tenant[0].mobile})`);
        }
      }
    }
  } else {
    console.log('W12 0PA property not found!');
  }

  process.exit(0);
}

importData().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
