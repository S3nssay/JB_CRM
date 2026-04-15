import { Router } from 'express';
import { pool } from './db';
import * as XLSX from 'xlsx';

export const taxRoutes = Router();

// Middleware to check if user is authenticated and is admin/agent
const requireAgent = (req: any, res: any, next: any) => {
  if (!req.user) return res.status(401).json({ error: 'Not authenticated' });
  if (req.user.role !== 'admin' && req.user.role !== 'agent') return res.status(403).json({ error: 'Not authorized' });
  next();
};

// ============================================================
// LHA BENEFIT PAYMENTS
// ============================================================

// GET /lha-benefits - list all, optional ?tenantId= filter
taxRoutes.get('/lha-benefits', requireAgent, async (req: any, res) => {
  try {
    const { tenantId } = req.query;
    let query = `
      SELECT lbp.*, t.name as tenant_name
      FROM lha_benefit_payments lbp
      LEFT JOIN tenant t ON lbp.tenant_id = t.id
    `;
    const params: any[] = [];
    if (tenantId) {
      query += ` WHERE lbp.tenant_id = $1`;
      params.push(tenantId);
    }
    query += ` ORDER BY lbp.payment_date DESC`;
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (error: any) {
    console.error('Error fetching LHA benefits:', error);
    res.status(500).json({ error: 'Failed to fetch LHA benefit payments' });
  }
});

// GET /lha-benefits/:id - single record
taxRoutes.get('/lha-benefits/:id', requireAgent, async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query(
      `SELECT lbp.*, t.name as tenant_name
       FROM lha_benefit_payments lbp
       LEFT JOIN tenant t ON lbp.tenant_id = t.id
       WHERE lbp.id = $1`,
      [id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'LHA benefit payment not found' });
    }
    res.json(result.rows[0]);
  } catch (error: any) {
    console.error('Error fetching LHA benefit:', error);
    res.status(500).json({ error: 'Failed to fetch LHA benefit payment' });
  }
});

// POST /lha-benefits - create
taxRoutes.post('/lha-benefits', requireAgent, async (req: any, res) => {
  try {
    const { tenantId, tenancyId, paymentDate, totalAmount, splitToRent, splitToTenant, reference, notes } = req.body;
    if (!tenantId || !paymentDate || totalAmount === undefined) {
      return res.status(400).json({ error: 'tenantId, paymentDate, and totalAmount are required' });
    }
    const result = await pool.query(
      `INSERT INTO lha_benefit_payments
        (tenant_id, tenancy_id, payment_date, total_amount, split_to_rent, split_to_tenant, reference, status, notes, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, 'received', $8, $9)
       RETURNING *`,
      [tenantId, tenancyId || null, paymentDate, totalAmount, splitToRent || 0, splitToTenant || 0, reference || null, notes || null, req.user?.id || null]
    );
    res.status(201).json(result.rows[0]);
  } catch (error: any) {
    console.error('Error creating LHA benefit:', error);
    res.status(500).json({ error: 'Failed to create LHA benefit payment' });
  }
});

// PUT /lha-benefits/:id - update
taxRoutes.put('/lha-benefits/:id', requireAgent, async (req: any, res) => {
  try {
    const { id } = req.params;
    const { tenantId, tenancyId, paymentDate, totalAmount, splitToRent, splitToTenant, reference, status, notes } = req.body;
    const result = await pool.query(
      `UPDATE lha_benefit_payments
       SET tenant_id = COALESCE($1, tenant_id),
           tenancy_id = COALESCE($2, tenancy_id),
           payment_date = COALESCE($3, payment_date),
           total_amount = COALESCE($4, total_amount),
           split_to_rent = COALESCE($5, split_to_rent),
           split_to_tenant = COALESCE($6, split_to_tenant),
           reference = COALESCE($7, reference),
           status = COALESCE($8, status),
           notes = COALESCE($9, notes),
           updated_at = NOW()
       WHERE id = $10
       RETURNING *`,
      [tenantId, tenancyId, paymentDate, totalAmount, splitToRent, splitToTenant, reference, status, notes, id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'LHA benefit payment not found' });
    }
    res.json(result.rows[0]);
  } catch (error: any) {
    console.error('Error updating LHA benefit:', error);
    res.status(500).json({ error: 'Failed to update LHA benefit payment' });
  }
});

// DELETE /lha-benefits/:id - delete
taxRoutes.delete('/lha-benefits/:id', requireAgent, async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query('DELETE FROM lha_benefit_payments WHERE id = $1 RETURNING id', [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'LHA benefit payment not found' });
    }
    res.json({ success: true });
  } catch (error: any) {
    console.error('Error deleting LHA benefit:', error);
    res.status(500).json({ error: 'Failed to delete LHA benefit payment' });
  }
});

// ============================================================
// OVERSEAS LANDLORD TAX DEDUCTIONS
// ============================================================

// GET /tax-deductions - list all, optional ?landlordId= filter
taxRoutes.get('/tax-deductions', requireAgent, async (req: any, res) => {
  try {
    const { landlordId } = req.query;
    let query = `
      SELECT ltd.*, l.name as landlord_name, p.address as property_address
      FROM landlord_tax_deductions ltd
      LEFT JOIN landlords l ON ltd.landlord_id = l.id
      LEFT JOIN property p ON ltd.property_id = p.id
    `;
    const params: any[] = [];
    if (landlordId) {
      query += ` WHERE ltd.landlord_id = $1`;
      params.push(landlordId);
    }
    query += ` ORDER BY ltd.tax_period_start DESC`;
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (error: any) {
    console.error('Error fetching tax deductions:', error);
    res.status(500).json({ error: 'Failed to fetch tax deductions' });
  }
});

// POST /tax-deductions - create
taxRoutes.post('/tax-deductions', requireAgent, async (req: any, res) => {
  try {
    const { landlordId, propertyId, taxPeriodStart, taxPeriodEnd, rentCollected, taxRate, taxDeducted, netPaidToLandlord, notes } = req.body;
    if (!landlordId || !taxPeriodStart || !taxPeriodEnd || rentCollected === undefined) {
      return res.status(400).json({ error: 'landlordId, taxPeriodStart, taxPeriodEnd, and rentCollected are required' });
    }
    const result = await pool.query(
      `INSERT INTO landlord_tax_deductions
        (landlord_id, property_id, tax_period_start, tax_period_end, rent_collected, tax_rate, tax_deducted, net_paid_to_landlord, remitted_to_hmrc, notes, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, false, $9, $10)
       RETURNING *`,
      [landlordId, propertyId || null, taxPeriodStart, taxPeriodEnd, rentCollected, taxRate || '20', taxDeducted || 0, netPaidToLandlord || 0, notes || null, req.user?.id || null]
    );
    res.status(201).json(result.rows[0]);
  } catch (error: any) {
    console.error('Error creating tax deduction:', error);
    res.status(500).json({ error: 'Failed to create tax deduction' });
  }
});

// PUT /tax-deductions/:id - update (including marking as remitted to HMRC)
taxRoutes.put('/tax-deductions/:id', requireAgent, async (req: any, res) => {
  try {
    const { id } = req.params;
    const { landlordId, propertyId, taxPeriodStart, taxPeriodEnd, rentCollected, taxRate, taxDeducted, netPaidToLandlord, remittedToHmrc, remittedDate, hmrcReference, notes } = req.body;
    const result = await pool.query(
      `UPDATE landlord_tax_deductions
       SET landlord_id = COALESCE($1, landlord_id),
           property_id = COALESCE($2, property_id),
           tax_period_start = COALESCE($3, tax_period_start),
           tax_period_end = COALESCE($4, tax_period_end),
           rent_collected = COALESCE($5, rent_collected),
           tax_rate = COALESCE($6, tax_rate),
           tax_deducted = COALESCE($7, tax_deducted),
           net_paid_to_landlord = COALESCE($8, net_paid_to_landlord),
           remitted_to_hmrc = COALESCE($9, remitted_to_hmrc),
           remitted_date = COALESCE($10, remitted_date),
           hmrc_reference = COALESCE($11, hmrc_reference),
           notes = COALESCE($12, notes)
       WHERE id = $13
       RETURNING *`,
      [landlordId, propertyId, taxPeriodStart, taxPeriodEnd, rentCollected, taxRate, taxDeducted, netPaidToLandlord, remittedToHmrc, remittedDate || null, hmrcReference || null, notes, id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Tax deduction not found' });
    }
    res.json(result.rows[0]);
  } catch (error: any) {
    console.error('Error updating tax deduction:', error);
    res.status(500).json({ error: 'Failed to update tax deduction' });
  }
});

// GET /overseas-landlords - list landlords where is_overseas=true
taxRoutes.get('/overseas-landlords', requireAgent, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT id, name, email, phone, mobile, address, overseas_address, overseas_country,
             tax_percentage, tax_exemption_certificate_no, tax_exemption_start_date, tax_exemption_end_date,
             status
      FROM landlords
      WHERE is_overseas = true
      ORDER BY name ASC
    `);
    res.json(result.rows);
  } catch (error: any) {
    console.error('Error fetching overseas landlords:', error);
    res.status(500).json({ error: 'Failed to fetch overseas landlords' });
  }
});

// ============================================================
// HMRC RENT REPORT
// ============================================================

// GET /hmrc-rent-report?from=&to=
taxRoutes.get('/hmrc-rent-report', requireAgent, async (req, res) => {
  try {
    const { from, to } = req.query;
    if (!from || !to) {
      return res.status(400).json({ error: 'from and to date parameters are required' });
    }

    // Get all overseas landlords
    const landlordResult = await pool.query(`
      SELECT id, name, email, overseas_address, address, overseas_country,
             tax_percentage, tax_exemption_certificate_no, tax_exemption_start_date, tax_exemption_end_date
      FROM landlords
      WHERE is_overseas = true
      ORDER BY name ASC
    `);

    const report = await Promise.all(
      landlordResult.rows.map(async (landlord: any) => {
        // Get properties for this landlord
        const propResult = await pool.query(`
          SELECT p.id, p.address
          FROM property p
          WHERE p.landlord_id = $1 AND p.is_managed = true
        `, [landlord.id]);

        // Get rent invoices for this landlord's properties in date range
        const invoiceResult = await pool.query(`
          SELECT p.id as property_id, p.address as property_address,
                 COALESCE(SUM(i.amount), 0)::bigint as rent_collected_pence
          FROM property p
          LEFT JOIN invoice i ON i.property_id = p.id
            AND i.invoice_type = 'rent'
            AND i.status = 'paid'
            AND i.due_date BETWEEN $1 AND $2
          WHERE p.landlord_id = $3 AND p.is_managed = true
          GROUP BY p.id, p.address
        `, [from, to, landlord.id]);

        const properties = invoiceResult.rows.map((row: any) => ({
          propertyId: row.property_id,
          address: row.property_address,
          rentCollected: Number(row.rent_collected_pence),
        }));

        const totalRent = properties.reduce((sum: number, p: any) => sum + p.rentCollected, 0);
        const taxRate = landlord.tax_percentage ? Number(landlord.tax_percentage) : 20;
        const taxDeducted = Math.round(totalRent * (taxRate / 100));
        const netPaid = totalRent - taxDeducted;

        return {
          landlordId: landlord.id,
          landlordName: landlord.name,
          landlordAddress: landlord.overseas_address || landlord.address || '',
          overseasCountry: landlord.overseas_country || '',
          taxExemptionCertNo: landlord.tax_exemption_certificate_no || null,
          taxExemptionStart: landlord.tax_exemption_start_date || null,
          taxExemptionEnd: landlord.tax_exemption_end_date || null,
          properties,
          totalRent,
          taxRate,
          taxDeducted,
          netPaid,
        };
      })
    );

    res.json({ from, to, report });
  } catch (error: any) {
    console.error('Error generating HMRC rent report:', error);
    res.status(500).json({ error: 'Failed to generate HMRC rent report' });
  }
});

// GET /hmrc-rent-report/export?from=&to= - Export to Excel
taxRoutes.get('/hmrc-rent-report/export', requireAgent, async (req, res) => {
  try {
    const { from, to } = req.query;
    if (!from || !to) {
      return res.status(400).json({ error: 'from and to date parameters are required' });
    }

    // Get all overseas landlords
    const landlordResult = await pool.query(`
      SELECT id, name, email, overseas_address, address, overseas_country,
             tax_percentage, tax_exemption_certificate_no, tax_exemption_start_date, tax_exemption_end_date
      FROM landlords
      WHERE is_overseas = true
      ORDER BY name ASC
    `);

    const report = await Promise.all(
      landlordResult.rows.map(async (landlord: any) => {
        const invoiceResult = await pool.query(`
          SELECT p.id as property_id, p.address as property_address,
                 COALESCE(SUM(i.amount), 0)::bigint as rent_collected_pence
          FROM property p
          LEFT JOIN invoice i ON i.property_id = p.id
            AND i.invoice_type = 'rent'
            AND i.status = 'paid'
            AND i.due_date BETWEEN $1 AND $2
          WHERE p.landlord_id = $3 AND p.is_managed = true
          GROUP BY p.id, p.address
        `, [from, to, landlord.id]);

        const properties = invoiceResult.rows.map((row: any) => ({
          address: row.property_address,
          rentCollected: Number(row.rent_collected_pence),
        }));

        const totalRent = properties.reduce((sum: number, p: any) => sum + p.rentCollected, 0);
        const taxRate = landlord.tax_percentage ? Number(landlord.tax_percentage) : 20;
        const taxDeducted = Math.round(totalRent * (taxRate / 100));
        const netPaid = totalRent - taxDeducted;

        return { landlord, properties, totalRent, taxRate, taxDeducted, netPaid };
      })
    );

    // Build Excel workbook
    const wb = XLSX.utils.book_new();

    // Summary sheet
    const summaryData = [
      ['HMRC Non-Resident Landlord Scheme - Rent Report'],
      [`Period: ${from} to ${to}`],
      [''],
      ['Landlord Name', 'Overseas Address', 'Country', 'Total Rent (£)', 'Tax Rate (%)', 'Tax Deducted (£)', 'Net Paid (£)', 'Exemption Certificate'],
    ];
    let grandTotalRent = 0;
    let grandTaxDeducted = 0;
    let grandNetPaid = 0;

    for (const row of report) {
      summaryData.push([
        row.landlord.name,
        row.landlord.overseas_address || row.landlord.address || '',
        row.landlord.overseas_country || '',
        (row.totalRent / 100).toFixed(2),
        String(row.taxRate),
        (row.taxDeducted / 100).toFixed(2),
        (row.netPaid / 100).toFixed(2),
        row.landlord.tax_exemption_certificate_no || 'N/A',
      ]);
      grandTotalRent += row.totalRent;
      grandTaxDeducted += row.taxDeducted;
      grandNetPaid += row.netPaid;
    }

    summaryData.push(['']);
    summaryData.push([
      'TOTALS', '', '',
      (grandTotalRent / 100).toFixed(2),
      '',
      (grandTaxDeducted / 100).toFixed(2),
      (grandNetPaid / 100).toFixed(2),
      '',
    ]);

    const summarySheet = XLSX.utils.aoa_to_sheet(summaryData);
    XLSX.utils.book_append_sheet(wb, summarySheet, 'Summary');

    // Detail sheet (property breakdown)
    const detailData = [
      ['Landlord Name', 'Property Address', 'Rent Collected (£)', 'Tax Rate (%)', 'Tax Deducted (£)', 'Net Paid (£)'],
    ];
    for (const row of report) {
      for (const prop of row.properties) {
        const propTax = Math.round(prop.rentCollected * (row.taxRate / 100));
        detailData.push([
          row.landlord.name,
          prop.address || '',
          (prop.rentCollected / 100).toFixed(2),
          String(row.taxRate),
          (propTax / 100).toFixed(2),
          ((prop.rentCollected - propTax) / 100).toFixed(2),
        ]);
      }
    }
    const detailSheet = XLSX.utils.aoa_to_sheet(detailData);
    XLSX.utils.book_append_sheet(wb, detailSheet, 'Property Detail');

    const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
    const filename = `HMRC_Rent_Report_${String(from).replace(/-/g, '')}_${String(to).replace(/-/g, '')}.xlsx`;

    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.send(buffer);
  } catch (error: any) {
    console.error('Error exporting HMRC rent report:', error);
    res.status(500).json({ error: 'Failed to export HMRC rent report' });
  }
});
