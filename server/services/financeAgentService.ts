/**
 * Finance Agent Service -- Core Business Logic
 *
 * Statement aggregation, invoice creation, and management fee calculation
 * for the Taylor (PM Finance) agent. All amounts in pence (integer).
 */
import { Pool } from 'pg';
import { lettingServicePackages } from '@shared/lettingServiceTerms';

// Use the app's shared pool (lazy import to avoid circular deps)
let _pool: Pool | null = null;
function getPool(): Pool {
  if (!_pool) {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    _pool = require('../db').pool;
  }
  return _pool!;
}

// ============================================================
// Management Fee Calculation
// ============================================================

export interface ManagementFeeResult {
  feePence: number;
  feePercentage: number;
  vatPence: number;
}

/**
 * Calculate monthly management fee for a property based on its service package.
 * Only 'deducted_monthly' packages produce a monthly fee; upfront packages return zeros.
 * VAT is 20% of the fee.
 */
export function calculateManagementFee(
  managementType: string | null,
  monthlyRentPence: number
): ManagementFeeResult {
  if (!managementType) {
    return { feePence: 0, feePercentage: 0, vatPence: 0 };
  }

  const pkg = lettingServicePackages.find((p) => p.id === managementType);
  if (!pkg || pkg.feeType !== 'deducted_monthly') {
    return { feePence: 0, feePercentage: 0, vatPence: 0 };
  }

  const feePence = Math.round((monthlyRentPence * pkg.feePercentage) / 100);
  const vatPence = Math.round(feePence * 0.2);

  return {
    feePence,
    feePercentage: pkg.feePercentage,
    vatPence,
  };
}

// ============================================================
// Number Generation
// ============================================================

/**
 * Generate invoice number scoped by tenancyId (not propertyId).
 * A property can have multiple active tenancies, so propertyId would cause
 * UNIQUE constraint violations on invoices.invoiceNumber during bulk generation.
 */
export function generateInvoiceNumber(tenancyId: number, date: Date): string {
  const yyyy = date.getFullYear().toString();
  const mm = (date.getMonth() + 1).toString().padStart(2, '0');
  return `INV-${yyyy}${mm}-${tenancyId}`;
}

/**
 * Generate statement number scoped by propertyId (one statement per property per month).
 */
export function generateStatementNumber(propertyId: number, date: Date): string {
  const yyyy = date.getFullYear().toString();
  const mm = (date.getMonth() + 1).toString().padStart(2, '0');
  return `STMT-${yyyy}${mm}-${propertyId}`;
}

// ============================================================
// Monthly Statement Generation
// ============================================================

/**
 * Generate monthly landlord statements for all managed properties.
 * Aggregates: rent collected, management fees, maintenance costs, certification costs, VAT.
 * Flags properties with zero rent as attention_needed.
 */
export async function generateMonthlyStatements(
  year: number,
  month: number
): Promise<{ created: number; attentionNeeded: number }> {
  const pool = getPool();
  const periodStart = new Date(year, month - 1, 1);
  const periodEnd = new Date(year, month, 0, 23, 59, 59); // last day of month

  // 1. Get all managed properties with landlord info
  const { rows: managedProperties } = await pool.query(`
    SELECT
      p.id AS property_id,
      p.landlord_id,
      p.address,
      p.management_type,
      p.service_charge
    FROM properties p
    WHERE p.is_managed = true
      AND p.landlord_id IS NOT NULL
  `);

  let created = 0;
  let attentionNeeded = 0;

  for (const prop of managedProperties) {
    const propertyId = prop.property_id;
    const landlordId = prop.landlord_id;
    const statementNumber = generateStatementNumber(propertyId, periodStart);

    // Check if statement already exists for this property/period
    const { rows: existing } = await pool.query(
      `SELECT id FROM landlord_statement
       WHERE property_id = $1
         AND statement_period_start = $2
         AND statement_period_end = $3`,
      [propertyId, periodStart, periodEnd]
    );
    if (existing.length > 0) continue;

    // 2. Aggregate rent collected from paid invoices in period
    const { rows: rentRows } = await pool.query(
      `SELECT COALESCE(SUM(i.amount), 0) AS total_rent
       FROM invoice i
       WHERE i.property_id = $1
         AND i.invoice_type = 'rent'
         AND i.status = 'paid'
         AND i.paid_date >= $2
         AND i.paid_date <= $3`,
      [propertyId, periodStart, periodEnd]
    );
    const totalRentCollected = parseInt(rentRows[0].total_rent, 10);

    // 3. Calculate management fee
    const feeResult = calculateManagementFee(prop.management_type, totalRentCollected);

    // 4. Query maintenance costs from work orders (Phase 7 cost ledger)
    const { rows: maintenanceRows } = await pool.query(
      `SELECT COALESCE(SUM(wo.invoice_amount), 0) AS total_maintenance
       FROM work_order wo
       JOIN maintenance_request mr ON wo.maintenance_request_id = mr.id
       WHERE mr.property_id = $1
         AND wo.status = 'completed'
         AND wo.completed_date >= $2
         AND wo.completed_date <= $3`,
      [propertyId, periodStart, periodEnd]
    );
    const maintenanceDeductions = parseInt(maintenanceRows[0].total_maintenance, 10);

    // 5. Query certification costs
    const { rows: certRows } = await pool.query(
      `SELECT COALESCE(SUM(cost), 0) AS total_certs
       FROM property_certification
       WHERE property_id = $1
         AND created_at >= $2
         AND created_at <= $3`,
      [propertyId, periodStart, periodEnd]
    );
    const certificationCosts = parseInt(certRows[0].total_certs, 10);

    const otherDeductions = certificationCosts;
    const vatOnFees = feeResult.vatPence;
    const netPayable =
      totalRentCollected - feeResult.feePence - maintenanceDeductions - otherDeductions - vatOnFees;

    const isAttentionNeeded = totalRentCollected === 0;
    if (isAttentionNeeded) attentionNeeded++;

    // 6. Insert landlord_statement
    const { rows: stmtRows } = await pool.query(
      `INSERT INTO landlord_statement
        (landlord_id, property_id, statement_number, attention_needed,
         statement_period_start, statement_period_end,
         total_rent_collected, management_fees, maintenance_deductions,
         other_deductions, vat_on_fees, net_payable, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, 'draft')
       RETURNING id`,
      [
        landlordId, propertyId, statementNumber, isAttentionNeeded,
        periodStart, periodEnd,
        totalRentCollected, feeResult.feePence, maintenanceDeductions,
        otherDeductions, vatOnFees, netPayable,
      ]
    );
    const statementId = stmtRows[0].id;

    // 7. Insert statement line items
    const lineItems = [
      { lineType: 'rent_collected', description: 'Rent collected', amount: totalRentCollected, date: periodEnd },
      { lineType: 'management_fee', description: `Management fee (${feeResult.feePercentage}%)`, amount: -feeResult.feePence, date: periodEnd },
      { lineType: 'management_fee', description: 'VAT on management fee', amount: -vatOnFees, date: periodEnd },
    ];

    if (maintenanceDeductions > 0) {
      lineItems.push({
        lineType: 'maintenance',
        description: 'Maintenance deductions',
        amount: -maintenanceDeductions,
        date: periodEnd,
      });
    }

    if (certificationCosts > 0) {
      lineItems.push({
        lineType: 'other_deduction',
        description: 'Certification/compliance costs',
        amount: -certificationCosts,
        date: periodEnd,
      });
    }

    for (const item of lineItems) {
      await pool.query(
        `INSERT INTO statement_line_item
          (statement_id, property_id, line_type, description, amount, transaction_date)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [statementId, propertyId, item.lineType, item.description, item.amount, item.date]
      );
    }

    created++;
  }

  return { created, attentionNeeded };
}

// ============================================================
// Monthly Invoice Generation
// ============================================================

/**
 * Generate rent invoices for active tenancies with rent due within 7 days.
 * Converts tenancy rentAmount (decimal string) to pence (integer).
 */
export async function generateMonthlyInvoices(
  targetDate: Date
): Promise<{ created: number; sent: number }> {
  const pool = getPool();

  // Find active tenancies with rent due within 7 days
  const rentDueDay = targetDate.getDate();
  const windowEnd = new Date(targetDate);
  windowEnd.setDate(windowEnd.getDate() + 7);

  const { rows: tenancies } = await pool.query(
    `SELECT
       t.id AS tenancy_id,
       t.property_id,
       t.tenant_id,
       t.landlord_id,
       t.rent_amount,
       t.rent_due_day,
       p.service_charge,
       p.address AS property_address
     FROM tenancy_contracts t
     JOIN properties p ON t.property_id = p.id
     WHERE t.status = 'active'
       AND t.rent_due_day IS NOT NULL
       AND t.rent_amount IS NOT NULL`
  );

  let created = 0;

  for (const tenancy of tenancies) {
    // Check if rent due day falls within 7-day window
    const dueDay = parseInt(tenancy.rent_due_day, 10);
    const dueDate = new Date(targetDate.getFullYear(), targetDate.getMonth(), dueDay);

    // If due day already passed this month, look at next month
    if (dueDate < targetDate) {
      dueDate.setMonth(dueDate.getMonth() + 1);
    }

    const diffMs = dueDate.getTime() - targetDate.getTime();
    const diffDays = diffMs / (1000 * 60 * 60 * 24);

    if (diffDays < 0 || diffDays > 7) continue;

    const invoiceNumber = generateInvoiceNumber(tenancy.tenancy_id, dueDate);

    // Check if invoice already exists for this period
    const { rows: existing } = await pool.query(
      `SELECT id FROM invoice WHERE invoice_number = $1`,
      [invoiceNumber]
    );
    if (existing.length > 0) continue;

    // Convert rent amount from decimal string to pence
    const rentPence = Math.round(parseFloat(tenancy.rent_amount) * 100);
    if (isNaN(rentPence) || rentPence <= 0) continue;

    // Calculate service charge line (if applicable)
    const serviceChargePence = tenancy.service_charge ? parseInt(tenancy.service_charge, 10) : 0;
    const monthlyServiceCharge = serviceChargePence > 0 ? Math.round(serviceChargePence / 12) : 0;

    const totalAmount = rentPence + monthlyServiceCharge;

    // Build line items
    const lineItems: Array<{ description: string; quantity: number; unitAmount: number; totalAmount: number; vatRate: number }> = [
      { description: 'Monthly rent', quantity: 1, unitAmount: rentPence, totalAmount: rentPence, vatRate: 0 },
    ];

    if (monthlyServiceCharge > 0) {
      lineItems.push({
        description: 'Service charge (monthly)',
        quantity: 1,
        unitAmount: monthlyServiceCharge,
        totalAmount: monthlyServiceCharge,
        vatRate: 0,
      });
    }

    await pool.query(
      `INSERT INTO invoice
        (invoice_number, property_id, tenant_id, landlord_id, tenancy_id,
         invoice_type, amount, vat_amount, total_amount, line_items,
         due_date, status)
       VALUES ($1, $2, $3, $4, $5, 'rent', $6, 0, $7, $8, $9, 'draft')`,
      [
        invoiceNumber,
        tenancy.property_id,
        tenancy.tenant_id,
        tenancy.landlord_id,
        tenancy.tenancy_id,
        rentPence,
        totalAmount,
        JSON.stringify(lineItems),
        dueDate,
      ]
    );

    created++;
  }

  return { created, sent: 0 };
}

// ============================================================
// Deal Event Lifecycle Triggers
// ============================================================

/**
 * Generate first month's invoice when a tenancy is agreed (TENANCY_AGREED deal event).
 * Called by financeCronJobs.ts deal event subscription.
 */
export async function generateFirstInvoiceForTenancy(
  dealId: number,
  propertyId: number
): Promise<{ created: number; invoiceNumber?: string }> {
  const pool = getPool();

  // Find the most recent active tenancy for this property
  const { rows: tenancyRows } = await pool.query(
    `SELECT tc.id AS tenancy_id, tc.tenant_id, tc.landlord_id,
            tc.rent_amount, tc.start_date
     FROM tenancy_contracts tc
     WHERE tc.property_id = $1
       AND tc.status = 'active'
     ORDER BY tc.start_date DESC
     LIMIT 1`,
    [propertyId]
  );

  if (tenancyRows.length === 0) {
    console.log(`[Taylor Event] No active tenancy found for property ${propertyId}, skipping first invoice`);
    return { created: 0 };
  }

  const tenancy = tenancyRows[0];
  const now = new Date();

  // Calculate due date: use start_date if in the future, otherwise 1st of next month
  let dueDate = new Date(tenancy.start_date);
  if (dueDate <= now) {
    // Use 1st of next month
    dueDate = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  }

  const invoiceNumber = generateInvoiceNumber(tenancy.tenancy_id, dueDate);

  // Idempotency check
  const { rows: existing } = await pool.query(
    `SELECT id FROM invoice WHERE invoice_number = $1`,
    [invoiceNumber]
  );
  if (existing.length > 0) {
    console.log(`[Taylor Event] Invoice ${invoiceNumber} already exists, skipping`);
    return { created: 0, invoiceNumber };
  }

  // Convert rent amount from decimal string to pence
  const rentPence = Math.round(parseFloat(tenancy.rent_amount) * 100);
  if (isNaN(rentPence) || rentPence <= 0) {
    console.log(`[Taylor Event] Invalid rent amount for tenancy ${tenancy.tenancy_id}, skipping`);
    return { created: 0 };
  }

  // Calculate service charge line (if applicable)
  const { rows: propRows } = await pool.query(
    `SELECT service_charge FROM properties WHERE id = $1`,
    [propertyId]
  );
  const serviceChargePence = propRows[0]?.service_charge ? parseInt(propRows[0].service_charge, 10) : 0;
  const monthlyServiceCharge = serviceChargePence > 0 ? Math.round(serviceChargePence / 12) : 0;

  const totalAmount = rentPence + monthlyServiceCharge;

  // Build line items
  const lineItems: Array<{ description: string; quantity: number; unitAmount: number; totalAmount: number; vatRate: number }> = [
    { description: 'Monthly rent', quantity: 1, unitAmount: rentPence, totalAmount: rentPence, vatRate: 0 },
  ];

  if (monthlyServiceCharge > 0) {
    lineItems.push({
      description: 'Service charge (monthly)',
      quantity: 1,
      unitAmount: monthlyServiceCharge,
      totalAmount: monthlyServiceCharge,
      vatRate: 0,
    });
  }

  await pool.query(
    `INSERT INTO invoice
      (invoice_number, property_id, tenant_id, landlord_id, tenancy_id,
       invoice_type, amount, vat_amount, total_amount, line_items,
       due_date, status)
     VALUES ($1, $2, $3, $4, $5, 'rent', $6, 0, $7, $8, $9, 'draft')`,
    [
      invoiceNumber,
      propertyId,
      tenancy.tenant_id,
      tenancy.landlord_id,
      tenancy.tenancy_id,
      rentPence,
      totalAmount,
      JSON.stringify(lineItems),
      dueDate,
    ]
  );

  console.log(`[Taylor Event] First invoice ${invoiceNumber} created for tenancy ${tenancy.tenancy_id} (deal ${dealId})`);
  return { created: 1, invoiceNumber };
}

/**
 * Generate final landlord statement when a tenancy is ending (TENANCY_ENDING deal event).
 * Called by financeCronJobs.ts deal event subscription.
 * Always sets attention_needed = true since final statements require review.
 */
export async function generateFinalStatement(
  dealId: number,
  propertyId: number
): Promise<{ created: number; statementNumber?: string }> {
  const pool = getPool();

  // Get managed property with landlord
  const { rows: propRows } = await pool.query(
    `SELECT p.id AS property_id, p.landlord_id, p.management_type, p.service_charge, p.address
     FROM properties p
     WHERE p.id = $1
       AND p.is_managed = true`,
    [propertyId]
  );

  if (propRows.length === 0) {
    console.log(`[Taylor Event] No managed property found for id ${propertyId}, skipping final statement`);
    return { created: 0 };
  }

  const prop = propRows[0];
  const now = new Date();
  const periodStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const periodEnd = now;

  const statementNumber = generateStatementNumber(propertyId, periodStart);

  // Idempotency check
  const { rows: existing } = await pool.query(
    `SELECT id FROM landlord_statement
     WHERE property_id = $1
       AND statement_period_start = $2
       AND statement_period_end = $3`,
    [propertyId, periodStart, periodEnd]
  );
  if (existing.length > 0) {
    console.log(`[Taylor Event] Final statement already exists for property ${propertyId}, skipping`);
    return { created: 0, statementNumber };
  }

  // Aggregate rent collected from paid invoices in period
  const { rows: rentRows } = await pool.query(
    `SELECT COALESCE(SUM(i.amount), 0) AS total_rent
     FROM invoice i
     WHERE i.property_id = $1
       AND i.invoice_type = 'rent'
       AND i.status = 'paid'
       AND i.paid_date >= $2
       AND i.paid_date <= $3`,
    [propertyId, periodStart, periodEnd]
  );
  const totalRentCollected = parseInt(rentRows[0].total_rent, 10);

  // Calculate management fee
  const feeResult = calculateManagementFee(prop.management_type, totalRentCollected);

  // Query maintenance costs from work orders
  const { rows: maintenanceRows } = await pool.query(
    `SELECT COALESCE(SUM(wo.invoice_amount), 0) AS total_maintenance
     FROM work_order wo
     JOIN maintenance_request mr ON wo.maintenance_request_id = mr.id
     WHERE mr.property_id = $1
       AND wo.status = 'completed'
       AND wo.completed_date >= $2
       AND wo.completed_date <= $3`,
    [propertyId, periodStart, periodEnd]
  );
  const maintenanceDeductions = parseInt(maintenanceRows[0].total_maintenance, 10);

  // Query certification costs
  const { rows: certRows } = await pool.query(
    `SELECT COALESCE(SUM(cost), 0) AS total_certs
     FROM property_certification
     WHERE property_id = $1
       AND created_at >= $2
       AND created_at <= $3`,
    [propertyId, periodStart, periodEnd]
  );
  const certificationCosts = parseInt(certRows[0].total_certs, 10);

  const otherDeductions = certificationCosts;
  const vatOnFees = feeResult.vatPence;
  const netPayable =
    totalRentCollected - feeResult.feePence - maintenanceDeductions - otherDeductions - vatOnFees;

  // Insert landlord_statement (final statements always need review)
  const { rows: stmtRows } = await pool.query(
    `INSERT INTO landlord_statement
      (landlord_id, property_id, statement_number, attention_needed,
       statement_period_start, statement_period_end,
       total_rent_collected, management_fees, maintenance_deductions,
       other_deductions, vat_on_fees, net_payable, status)
     VALUES ($1, $2, $3, true, $4, $5, $6, $7, $8, $9, $10, $11, 'draft')
     RETURNING id`,
    [
      prop.landlord_id, propertyId, statementNumber,
      periodStart, periodEnd,
      totalRentCollected, feeResult.feePence, maintenanceDeductions,
      otherDeductions, vatOnFees, netPayable,
    ]
  );
  const statementId = stmtRows[0].id;

  // Insert statement line items
  const lineItems = [
    { lineType: 'rent_collected', description: 'Rent collected', amount: totalRentCollected, date: periodEnd },
    { lineType: 'management_fee', description: `Management fee (${feeResult.feePercentage}%)`, amount: -feeResult.feePence, date: periodEnd },
    { lineType: 'management_fee', description: 'VAT on management fee', amount: -vatOnFees, date: periodEnd },
  ];

  if (maintenanceDeductions > 0) {
    lineItems.push({
      lineType: 'maintenance',
      description: 'Maintenance deductions',
      amount: -maintenanceDeductions,
      date: periodEnd,
    });
  }

  if (certificationCosts > 0) {
    lineItems.push({
      lineType: 'other_deduction',
      description: 'Certification/compliance costs',
      amount: -certificationCosts,
      date: periodEnd,
    });
  }

  for (const item of lineItems) {
    await pool.query(
      `INSERT INTO statement_line_item
        (statement_id, property_id, line_type, description, amount, transaction_date)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [statementId, propertyId, item.lineType, item.description, item.amount, item.date]
    );
  }

  console.log(`[Taylor Event] Final statement ${statementNumber} created for property ${propertyId} (deal ${dealId})`);
  return { created: 1, statementNumber };
}
