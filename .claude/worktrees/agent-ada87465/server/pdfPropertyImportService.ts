/**
 * PDF Property Import Service v2
 *
 * Two-step import:
 * 1. parsePdfToStaging() - Extract PDF text, parse fields, store in staging table
 * 2. importFromStaging() - Import selected staging rows into real DB tables
 *
 * CORRECTED MAPPING (confirmed by user):
 * - Between FEE (%) and LANDLORD keyword = LANDLORD name + address
 * - After LANDLORD keyword = TENANT name
 */

import fs from 'fs';
import PDFParser from 'pdf2json';
import { db } from './db';
import { randomUUID } from 'crypto';
import {
  pdfImportStaging,
  landlords,
  properties,
  tenant,
  tenancies,
  tenancyChecklistItems,
} from '@shared/schema';
import { eq, inArray } from 'drizzle-orm';

// ============================================================
// TYPES
// ============================================================

export interface ImportResult {
  totalPages: number;
  successCount: number;
  errorCount: number;
  landlords: { created: number; existing: number };
  properties: { created: number; existing: number };
  tenants: { created: number; existing: number };
  tenancies: { created: number };
  checklistItems: { created: number };
  errors: Array<{ page: number; message: string }>;
}

// ============================================================
// PARSING HELPERS
// ============================================================

function sanitize(text: string | null | undefined): string {
  if (!text) return '';
  return text
    .replace(/[<>'";&=\\]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .substring(0, 500);
}

function extractPostcode(text: string): string {
  if (!text) return '';
  const match = text.match(/([A-Z]{1,2}\d{1,2}[A-Z]?\s*\d[A-Z]{2})/i);
  return match ? match[1].toUpperCase().trim() : '';
}

function parseDate(value: string | null): Date | null {
  if (!value) return null;
  const dmyMatch = value.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (dmyMatch) {
    return new Date(parseInt(dmyMatch[3]), parseInt(dmyMatch[2]) - 1, parseInt(dmyMatch[1]));
  }
  const parsed = new Date(value);
  if (!isNaN(parsed.getTime())) return parsed;
  return null;
}

function parseDepositHolderType(value: string): { holderType: string; scheme: string | null } {
  if (!value) return { holderType: 'agency_custodial', scheme: null };
  const lower = value.toLowerCase();
  if (lower.includes('landlord')) return { holderType: 'landlord', scheme: 'landlord' };
  if (lower.includes('insurance')) return { holderType: 'agency_insurance', scheme: 'insurance' };
  if (lower.includes('custodial') || lower.includes('agency')) return { holderType: 'agency_custodial', scheme: 'dps' };
  return { holderType: 'agency_custodial', scheme: 'dps' };
}

// ============================================================
// PDF TEXT EXTRACTION
// ============================================================

function extractTextFromPdf(filePath: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const pdfParser = new PDFParser();

    pdfParser.on('pdfParser_dataReady', (pdfData: any) => {
      const textContent = pdfData.Pages.map((page: any, pageIndex: number) => {
        const pageTexts = page.Texts.map((text: any) => {
          try {
            const rawText = text.R.map((r: any) => r.T).join('');
            try {
              return decodeURIComponent(rawText);
            } catch {
              return rawText.replace(/%20/g, ' ').replace(/%2C/g, ',');
            }
          } catch {
            return '';
          }
        });
        return `=== Page ${pageIndex + 1} ===\n${pageTexts.join(' ')}`;
      }).join('\n\n');

      resolve(textContent);
    });

    pdfParser.on('pdfParser_dataError', (errData: any) => {
      reject(new Error(`PDF parsing error: ${errData.parserError}`));
    });

    pdfParser.loadPDF(filePath);
  });
}

// ============================================================
// PAGE TEXT PARSING (CORRECTED: landlord/tenant swap fixed)
// ============================================================

interface ParsedFields {
  propertyFirstLine: string;
  propertyStreet: string;
  propertyAddress: string;
  postcode: string;
  managementFee: string;
  managementType: string;
  managementPeriodMonths: string;
  landlordName: string;
  landlordAddress: string;
  landlordPhone: string;
  landlordMobile: string;
  landlordEmail: string;
  bankName: string;
  bankAccountNo: string;
  sortCode: string;
  tenantName: string;
  tenantPhone: string;
  tenantMobile: string;
  depositAmount: string;
  rentAmount: string;
  rentFrequency: string;
  tenancyStart: string;
  tenancyEnd: string;
  periodMonths: string;
  depositHeldBy: string;
  keysGivenToTenant: string;
  spareKeysInOffice: string;
  asAtDate: string;
  checklistJson: string;
}

function parsePropertyPage(pageText: string): ParsedFields | null {
  try {
    // 1. Property first line (between PROPERTY and MANAGEMENT/LET at top)
    const propertyMatch = pageText.match(/PROPERTY\s+(.+?)(?=MANAGEMENT\/LET)/);
    const propertyFirstLine = propertyMatch ? propertyMatch[1].trim().replace(/\s+/g, ' ') : '';
    const postcode = extractPostcode(propertyFirstLine);

    // 2. Management fee
    const feeMatch = pageText.match(/FEE\s*\(%\)\s*(\d+\.?\d*)/);
    const managementFee = feeMatch ? feeMatch[1] : '0';

    // 3. LANDLORD name + address (CORRECTED: between FEE and LANDLORD keyword)
    let landlordName = '';
    let landlordAddress = '';
    const landlordSection = pageText.match(/FEE\s*\(%\)\s*\d+\.?\d*\s+(.+?)\s+LANDLORD/);
    if (landlordSection) {
      const info = landlordSection[1].trim().replace(/\s+/g, ' ');
      // Try to split name from address: title-based names first
      const titleMatch = info.match(/^((?:Mr|Mrs|Ms|Miss|Dr|Prof|Sir|Lady)\s+(?:&\s+(?:Mr|Mrs|Ms|Miss|Dr|Prof)\s+)?[\w\s'-]+?)(?=\s+\d|\s+C\/O|\s+PO\s|$)/i);
      if (titleMatch) {
        landlordName = sanitize(titleMatch[1]);
        landlordAddress = sanitize(info.substring(titleMatch[1].length));
      } else {
        // No title - could be a company name or name without title
        // Look for where address starts (a number or known address word)
        const addrStart = info.match(/^(.+?)(?=\s+\d+\s|\s+C\/O\s|\s+c\/o\s|\s+Flat\s|\s+current\s)/i);
        if (addrStart) {
          landlordName = sanitize(addrStart[1]);
          landlordAddress = sanitize(info.substring(addrStart[1].length));
        } else {
          // Entire text is the name (no address found)
          landlordName = sanitize(info);
        }
      }
    }

    // 4. TENANT name (CORRECTED: after LANDLORD keyword, until first number)
    let tenantName = '';
    let tenantPhone = '';
    const tenantSection = pageText.match(/LANDLORD\s+(.+?)(?=\d+\.?\d*\s+\d+\.?\d*\s+\d{2}\/)/);
    if (tenantSection) {
      let tenantInfo = tenantSection[1].trim().replace(/\s+/g, ' ');
      // Check if there's a phone number before the financial data
      const phoneInTenantMatch = tenantInfo.match(/^(.+?)\s+(0\d{9,}|\+?\d{10,})$/);
      if (phoneInTenantMatch) {
        tenantName = sanitize(phoneInTenantMatch[1]);
        tenantPhone = phoneInTenantMatch[2].replace(/\s+/g, '');
      } else {
        // Remove trailing numbers that might be deposit/rent
        tenantName = sanitize(tenantInfo.replace(/\s*\d+\.?\d*\s*$/, ''));
      }
    }

    // 5. Financial data: deposit, rent, start date, end date
    const financialMatch = pageText.match(/(\d+\.?\d*)\s+(\d+\.?\d*)\s+(\d{2}\/\d{2}\/\d{4})\s+(\d{2}\/\d{2}\/\d{4})/);
    const depositAmount = financialMatch ? financialMatch[1] : '';
    const rentAmount = financialMatch ? financialMatch[2] : '';
    const tenancyStart = financialMatch ? financialMatch[3] : '';
    const tenancyEnd = financialMatch ? financialMatch[4] : '';

    // 6. Bank details (landlord's bank)
    const bankMatch = pageText.match(/(?:ADDRESS\s+)?(?:UK\s+)?BANK\s+(.+?)\s*Acc\s*No\s*(\d+)/i);
    const bankName = bankMatch ? sanitize(bankMatch[1]) : '';
    const bankAccountNo = bankMatch ? bankMatch[2].trim() : '';
    const sortCodeMatch = pageText.match(/SORT\s*CODE\s+([\d\-\s]+)/i);
    const sortCode = sortCodeMatch ? sortCodeMatch[1].trim().replace(/\s+/g, '') : '';

    // 7. Landlord contact (TELEPHONE, MOBILE, Email in landlord section)
    const landlordPhoneMatch = pageText.match(/TELEPHONE\s+([\d\s+]+?)(?:\s+MOBILE)/);
    const landlordPhone = landlordPhoneMatch ? landlordPhoneMatch[1].replace(/\s+/g, '').trim() : '';

    const landlordMobileMatch = pageText.match(/MOBILE\s+([\d\s+]+?)(?:\s+Email)/);
    const landlordMobile = landlordMobileMatch ? landlordMobileMatch[1].replace(/\s+/g, '').trim() : '';

    const emailMatch = pageText.match(/Email\s+([^\s]+@[^\s]+)/i);
    const landlordEmail = emailMatch ? sanitize(emailMatch[1]) : '';

    // 8. Rent frequency
    let rentFrequency = 'Calendar Monthly';
    if (pageText.includes('Quarterly')) rentFrequency = 'Quarterly';
    else if (pageText.includes('Four Weekly')) rentFrequency = 'Four Weekly';
    else if (pageText.includes('Annually')) rentFrequency = 'Annually';

    // 9. Deposit held by
    const heldByMatch = pageText.match(/Held\s+By\s+(.+?)(?=MANAGEMENT)/);
    const depositHeldBy = heldByMatch ? sanitize(heldByMatch[1].split(/\n/)[0]) : '';

    // 10. Management type + period
    const mgmtTypeMatch = pageText.match(/MANAGEMENT\s+(Managed|Let Only|Rent Collection)/i);
    const managementType = mgmtTypeMatch ? mgmtTypeMatch[1] : 'Managed';

    const periodMatch = pageText.match(/PERIOD\s+(\d+)\s+Months/i);
    const managementPeriodMonths = periodMatch ? periodMatch[1] : '12';

    // 11. Tenant mobile (second MOBILE near CHECK LIST)
    const tenantMobileMatch = pageText.match(/PERIOD\s+\d+\s+Months\s+MOBILE\s+([\d\s]+?)(?:\s+CHECK)/i);
    const tenantMobile = tenantMobileMatch ? tenantMobileMatch[1].replace(/\s+/g, '').trim() : '';

    // 12. Property street address (from TENANT(S)...TELEPHONE at bottom)
    const streetMatch = pageText.match(/TENANT\(S\).*?TELEPHONE\s+(.+?)(?=\s+DEPOSIT\s+HELD)/);
    const propertyStreet = streetMatch ? sanitize(streetMatch[1]) : '';

    // 13. AS AT date
    const asAtMatch = pageText.match(/AS\s+AT\s+(\d{1,2}\s+\w+\s+\d{4})/);
    const asAtDate = asAtMatch ? asAtMatch[1] : '';

    // 14. Keys
    const spareKeysMatch = pageText.match(/SPARE\s+SET\s+OF\s+KEYS\s+IN\s+OFFICE\s+(Y|N)/i);
    const spareKeysInOffice = spareKeysMatch ? spareKeysMatch[1] : '';
    const keysGivenMatch = pageText.match(/SET\s+OF\s+KEYS\s+GIVEN\s+TO\s+TENANT\s*\.*(Y|N)?/i);
    const keysGivenToTenant = keysGivenMatch ? (keysGivenMatch[1] || '') : '';

    // 15. Construct full property address
    // Extract flat/unit identifier from first line (e.g. "Flat B London W9 3DF" → "Flat B")
    let propertyAddress = propertyStreet;
    const firstLineClean = propertyFirstLine
      .replace(postcode, '')
      .replace(/\b(?:London|LONDON|Westminster|Westmintster|Brent|Camden|City\s+of\s+Westminster|Maida\s+Hill|Kensington|Chelsea|Paddington|Kilburn|Wembley|Hampstead|Harrow)\b/gi, '')
      .trim()
      .replace(/\s+/g, ' ')
      .replace(/^,\s*|,\s*$/g, '')
      .trim();
    if (firstLineClean && !propertyStreet.toLowerCase().includes(firstLineClean.toLowerCase())) {
      propertyAddress = propertyStreet ? `${firstLineClean}, ${propertyStreet}` : firstLineClean;
    }
    if (postcode && !propertyAddress.includes(postcode)) {
      propertyAddress += `, ${postcode}`;
    }

    // 16. Checklist items
    const checklistItems: Record<string, boolean> = {
      deposits_and_rent: pageText.includes('DEPOSIT & RENT'),
      guarantors_agreement: pageText.includes('GUARANTORS AGREEMENT'),
      notices: pageText.includes('NOTICES'),
      tenancy_agreement: pageText.includes('TENANCY AGREEMENT'),
      standing_order: pageText.includes('STANDING ORDER'),
      authorization_to_landlord: pageText.includes('AUTHORIZATION TO L/L'),
      tenants_id: pageText.includes("TENANTS' ID") || pageText.includes('TENANTS ID'),
      previous_landlord_reference: pageText.includes('PREVIOUS L/L REFERENCE'),
      bank_reference: pageText.includes('BANK REFERENCE'),
      work_reference: pageText.includes('WORK REFERENCE'),
      inventory: pageText.includes('INVENTORY'),
      terms_and_conditions_to_landlord: pageText.includes('TERMS & CONDITIONS TO L/L'),
      deposit_protection_tds: pageText.includes('DEPOSIT PROTECTION BY TDS'),
      information_sheet_to_landlord: pageText.includes('INFORMATION SHEET  TO L/L') || pageText.includes('INFORMATION SHEET TO L/L'),
      deposit_protection_dps: pageText.includes('DEPOSIT PROTECTION BY DPS'),
      gas_safety_certificate: pageText.includes('GAS SAFETY CERTIFICATE'),
      deposit_held_by_landlord: pageText.includes('DEPOSIT HELD BY LANDLORD'),
    };

    return {
      propertyFirstLine: sanitize(propertyFirstLine),
      propertyStreet,
      propertyAddress: sanitize(propertyAddress),
      postcode,
      managementFee,
      managementType,
      managementPeriodMonths,
      landlordName,
      landlordAddress,
      landlordPhone,
      landlordMobile,
      landlordEmail,
      bankName,
      bankAccountNo,
      sortCode,
      tenantName,
      tenantPhone,
      tenantMobile,
      depositAmount,
      rentAmount,
      rentFrequency,
      tenancyStart,
      tenancyEnd,
      periodMonths: managementPeriodMonths,
      depositHeldBy,
      keysGivenToTenant,
      spareKeysInOffice,
      asAtDate,
      checklistJson: JSON.stringify(checklistItems),
    };
  } catch (error) {
    console.error('Error parsing page:', error);
    return null;
  }
}

// ============================================================
// STEP 1: Parse PDF → Staging Table
// ============================================================

export async function parsePdfToStaging(filePath: string): Promise<{
  batchId: string;
  totalPages: number;
  errors: Array<{ page: number; message: string }>;
}> {
  const batchId = randomUUID();
  const errors: Array<{ page: number; message: string }> = [];

  console.log('Extracting text from PDF...');
  const extractedText = await extractTextFromPdf(filePath);

  const pages = extractedText.split(/=== Page \d+ ===/).filter(p => p.trim().length > 100);
  console.log(`Found ${pages.length} pages to parse`);

  for (let i = 0; i < pages.length; i++) {
    const pageNum = i + 1;
    try {
      const data = parsePropertyPage(pages[i]);
      if (!data) {
        errors.push({ page: pageNum, message: 'Failed to parse page' });
        continue;
      }

      await db.insert(pdfImportStaging).values({
        batchId,
        pageNumber: pageNum,
        status: 'pending',
        propertyAddress: data.propertyAddress || null,
        propertyFirstLine: data.propertyFirstLine || null,
        propertyStreet: data.propertyStreet || null,
        postcode: data.postcode || null,
        managementFee: data.managementFee || null,
        managementType: data.managementType || null,
        managementPeriodMonths: data.managementPeriodMonths || null,
        landlordName: data.landlordName || null,
        landlordAddress: data.landlordAddress || null,
        landlordPhone: data.landlordPhone || null,
        landlordMobile: data.landlordMobile || null,
        landlordEmail: data.landlordEmail || null,
        bankName: data.bankName || null,
        bankAccountNo: data.bankAccountNo || null,
        sortCode: data.sortCode || null,
        tenantName: data.tenantName || null,
        tenantPhone: data.tenantPhone || null,
        tenantMobile: data.tenantMobile || null,
        depositAmount: data.depositAmount || null,
        rentAmount: data.rentAmount || null,
        rentFrequency: data.rentFrequency || null,
        tenancyStart: data.tenancyStart || null,
        tenancyEnd: data.tenancyEnd || null,
        periodMonths: data.periodMonths || null,
        depositHeldBy: data.depositHeldBy || null,
        keysGivenToTenant: data.keysGivenToTenant || null,
        spareKeysInOffice: data.spareKeysInOffice || null,
        asAtDate: data.asAtDate || null,
        checklistJson: data.checklistJson || null,
      });
    } catch (err: any) {
      errors.push({ page: pageNum, message: err.message });
    }
  }

  // Clean up uploaded file
  try { fs.unlinkSync(filePath); } catch {}

  console.log(`Parsed ${pages.length} pages into staging (batch: ${batchId}), ${errors.length} errors`);
  return { batchId, totalPages: pages.length, errors };
}

// ============================================================
// STEP 2: Import Selected Staging Rows → Real Tables
// ============================================================

export async function importFromStaging(rowIds: number[]): Promise<ImportResult> {
  const result: ImportResult = {
    totalPages: rowIds.length,
    successCount: 0,
    errorCount: 0,
    landlords: { created: 0, existing: 0 },
    properties: { created: 0, existing: 0 },
    tenants: { created: 0, existing: 0 },
    tenancies: { created: 0 },
    checklistItems: { created: 0 },
    errors: [],
  };

  // Fetch selected staging rows
  const rows = await db.select().from(pdfImportStaging).where(inArray(pdfImportStaging.id, rowIds));

  // Dedup caches
  const landlordCache = new Map<string, number>();
  const propertyCache = new Map<string, number>();
  const tenantCache = new Map<string, number>();

  for (const row of rows) {
    try {
      // 1. Find or create LANDLORD
      const landlordId = await findOrCreateLandlord(row, landlordCache, result);

      // 2. Find or create PROPERTY
      const propertyId = await findOrCreateProperty(row, landlordId, propertyCache, result);

      // 3. Find or create TENANT
      const tenantId = await findOrCreateTenant(row, propertyId, landlordId, tenantCache, result);

      // 4. Create TENANCY
      const tenancyId = await createTenancy(row, propertyId, landlordId, tenantId, result);

      // 5. Create CHECKLIST ITEMS
      await createChecklistItems(row, tenancyId, result);

      // Mark staging row as imported
      await db.update(pdfImportStaging)
        .set({ status: 'imported' })
        .where(eq(pdfImportStaging.id, row.id));

      result.successCount++;
    } catch (error: any) {
      console.error(`Error importing staging row ${row.id} (page ${row.pageNumber}):`, error.message);
      result.errors.push({ page: row.pageNumber, message: error.message });
      result.errorCount++;

      await db.update(pdfImportStaging)
        .set({ status: 'error' })
        .where(eq(pdfImportStaging.id, row.id));
    }
  }

  console.log(`Import complete: ${result.successCount} success, ${result.errorCount} errors`);
  return result;
}

// ============================================================
// FIND-OR-CREATE FUNCTIONS
// ============================================================

type StagingRow = typeof pdfImportStaging.$inferSelect;

async function findOrCreateLandlord(
  row: StagingRow,
  cache: Map<string, number>,
  result: ImportResult
): Promise<number> {
  const name = row.landlordName || 'Unknown';
  const email = row.landlordEmail?.toLowerCase() || '';
  const cacheKey = email || name.toLowerCase().trim();

  if (cache.has(cacheKey)) {
    result.landlords.existing++;
    return cache.get(cacheKey)!;
  }

  // Check DB by email
  if (email) {
    const existing = await db.select({ id: landlords.id })
      .from(landlords).where(eq(landlords.email, email)).limit(1);
    if (existing.length > 0) {
      cache.set(cacheKey, existing[0].id);
      result.landlords.existing++;
      return existing[0].id;
    }
  }

  // Check DB by name
  const existingByName = await db.select({ id: landlords.id })
    .from(landlords).where(eq(landlords.name, name)).limit(1);
  if (existingByName.length > 0) {
    cache.set(cacheKey, existingByName[0].id);
    result.landlords.existing++;
    return existingByName[0].id;
  }

  const isCompany = /ltd|limited|llp|plc|properties|investment|estates|mortgage|development/i.test(name);
  const landlordPostcode = row.landlordAddress ? extractPostcode(row.landlordAddress) : '';

  const [newLandlord] = await db.insert(landlords).values({
    name,
    email: email || null,
    phone: row.landlordPhone || null,
    mobile: row.landlordMobile || null,
    landlordType: isCompany ? 'company' : 'individual',
    isCorporate: isCompany,
    companyName: isCompany ? name : null,
    addressLine1: row.landlordAddress?.split(/\d{1,2}\s/)?.[0]?.trim() || null,
    postcode: landlordPostcode || null,
    bankName: row.bankName || null,
    bankAccountNumber: row.bankAccountNo || null,
    bankSortCode: row.sortCode || null,
    isActive: true,
  }).returning({ id: landlords.id });

  cache.set(cacheKey, newLandlord.id);
  result.landlords.created++;
  return newLandlord.id;
}

async function findOrCreateProperty(
  row: StagingRow,
  landlordId: number,
  cache: Map<string, number>,
  result: ImportResult
): Promise<number> {
  const fullAddress = row.propertyAddress || row.propertyFirstLine || 'Unknown';
  const normalizedAddress = fullAddress.toLowerCase().replace(/\s+/g, ' ').trim();

  if (cache.has(normalizedAddress)) {
    result.properties.existing++;
    return cache.get(normalizedAddress)!;
  }

  const existing = await db.select({ id: properties.id })
    .from(properties).where(eq(properties.addressLine1, fullAddress)).limit(1);

  if (existing.length > 0) {
    await db.update(properties).set({
      landlordId, isManaged: true, isRental: true,
      managementFeeType: row.managementFee && row.managementFee !== '0' ? 'percentage' : null,
      managementFeeValue: row.managementFee && row.managementFee !== '0' ? row.managementFee : null,
      managementPeriodMonths: row.managementPeriodMonths ? parseInt(row.managementPeriodMonths) : null,
      updatedAt: new Date(),
    }).where(eq(properties.id, existing[0].id));
    cache.set(normalizedAddress, existing[0].id);
    result.properties.existing++;
    return existing[0].id;
  }

  const addrLower = fullAddress.toLowerCase();
  let propertyType = 'flat';
  if (addrLower.includes('house')) propertyType = 'house';
  else if (addrLower.includes('maisonette')) propertyType = 'maisonette';
  else if (addrLower.includes('studio')) propertyType = 'studio';

  const rentNum = parseFloat(row.rentAmount || '0');
  const priceInPence = Math.round(rentNum * 100) || 100000;

  const [newProperty] = await db.insert(properties).values({
    title: fullAddress,
    description: `Managed rental property at ${fullAddress}`,
    addressLine1: fullAddress,
    address: fullAddress,
    city: 'London',
    postcode: row.postcode || 'TBC',
    propertyType,
    tenure: 'leasehold',
    bedrooms: 1,
    bathrooms: 1,
    price: priceInPence,
    status: 'active',
    isManaged: true,
    isRental: true,
    isListed: false,
    isResidential: true,
    landlordId,
    managementFeeType: row.managementFee && row.managementFee !== '0' ? 'percentage' : null,
    managementFeeValue: row.managementFee && row.managementFee !== '0' ? row.managementFee : null,
    managementPeriodMonths: row.managementPeriodMonths ? parseInt(row.managementPeriodMonths) : null,
  }).returning({ id: properties.id });

  cache.set(normalizedAddress, newProperty.id);
  result.properties.created++;
  return newProperty.id;
}

async function findOrCreateTenant(
  row: StagingRow,
  propertyId: number,
  landlordId: number,
  cache: Map<string, number>,
  result: ImportResult
): Promise<number | null> {
  const name = row.tenantName?.trim();
  if (!name) return null;

  const mobile = row.tenantMobile || '';
  const cacheKey = `${name.toLowerCase()}_${mobile}`;

  if (cache.has(cacheKey)) {
    result.tenants.existing++;
    return cache.get(cacheKey)!;
  }

  const existing = await db.select({ id: tenant.id })
    .from(tenant).where(eq(tenant.name, name)).limit(1);

  if (existing.length > 0) {
    cache.set(cacheKey, existing[0].id);
    result.tenants.existing++;
    return existing[0].id;
  }

  const [newTenant] = await db.insert(tenant).values({
    name,
    phone: row.tenantPhone || null,
    mobile: mobile || null,
    propertyId,
    landlordId,
    status: 'active',
  }).returning({ id: tenant.id });

  cache.set(cacheKey, newTenant.id);
  result.tenants.created++;
  return newTenant.id;
}

async function createTenancy(
  row: StagingRow,
  propertyId: number,
  landlordId: number,
  tenantId: number | null,
  result: ImportResult
): Promise<number> {
  const startDate = parseDate(row.tenancyStart) || new Date();
  const endDate = parseDate(row.tenancyEnd);
  const { holderType, scheme } = parseDepositHolderType(row.depositHeldBy || '');

  let depositScheme = scheme;
  const checklist = row.checklistJson ? JSON.parse(row.checklistJson) : {};
  if (checklist.deposit_protection_dps) depositScheme = 'dps';
  if (checklist.deposit_protection_tds) depositScheme = 'tds';
  if (checklist.deposit_held_by_landlord) depositScheme = 'landlord';

  let status = 'active';
  if (!tenantId) status = 'void';
  else if (endDate && endDate < new Date()) status = 'expired';

  const rentFreq = row.rentFrequency || 'Calendar Monthly';

  const [newTenancy] = await db.insert(tenancies).values({
    propertyId,
    landlordId,
    tenantId,
    startDate,
    endDate,
    periodMonths: row.periodMonths ? parseInt(row.periodMonths) : 12,
    rentAmount: row.rentAmount || '0',
    rentFrequency: rentFreq,
    depositAmount: row.depositAmount || null,
    depositScheme,
    depositHolderType: holderType,
    status,
  }).returning({ id: tenancies.id });

  result.tenancies.created++;
  return newTenancy.id;
}

async function createChecklistItems(
  row: StagingRow,
  tenancyId: number,
  result: ImportResult
): Promise<void> {
  const checklist = row.checklistJson ? JSON.parse(row.checklistJson) : {};
  const itemTypes = [
    'deposits_and_rent', 'guarantors_agreement', 'notices', 'tenancy_agreement',
    'standing_order', 'authorization_to_landlord', 'tenants_id',
    'previous_landlord_reference', 'bank_reference', 'work_reference',
    'inventory', 'terms_and_conditions_to_landlord', 'deposit_protection_tds',
    'information_sheet_to_landlord', 'deposit_protection_dps',
    'gas_safety_certificate', 'deposit_held_by_landlord',
  ];

  for (const itemType of itemTypes) {
    const exists = checklist[itemType] ?? false;
    await db.insert(tenancyChecklistItems).values({
      tenancyId,
      itemType,
      isCompleted: exists,
      completedAt: exists ? new Date() : null,
    });
    result.checklistItems.created++;
  }
}
