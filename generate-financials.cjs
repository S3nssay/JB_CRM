const dotenv = require('dotenv');
dotenv.config();
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });

const DEFAULT_FEE_PERCENT = 10;
const VAT_RATE = 0.20;

async function run() {
  const client = await pool.connect();
  try {
    const { rows: managed } = await client.query(`
      SELECT p.id as property_id, p.address, p.management_fee_type, p.management_fee_value,
             p.landlord_id, l.name as landlord_name,
             t.id as tenancy_id, t.start_date, t.end_date, t.rent_amount as tenancy_rent, t.rent_frequency,
             ten.id as tenant_id, ten.name as tenant_name
      FROM property p
      JOIN landlord l ON p.landlord_id = l.id
      JOIN tenancy t ON t.property_id = p.id AND t.status = 'active' AND t.rent_amount > 0
      JOIN tenant ten ON t.tenant_id = ten.id
      WHERE p.is_managed = true
      ORDER BY p.landlord_id, p.id
    `);
    console.log("Found " + managed.length + " managed property-tenancy combinations");

    await client.query('BEGIN');
    await client.query('DELETE FROM statement_line_item');
    await client.query('DELETE FROM landlord_statement');
    await client.query('DELETE FROM invoice');
    console.log('Cleared existing data');

    const now = new Date();
    const currentMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    let invoiceCount = 0, statementCount = 0, lineItemCount = 0;
    const landlordMonthly = {};

    for (const row of managed) {
      const tenancyStart = new Date(row.start_date);
      const tenancyEnd = row.end_date ? new Date(row.end_date) : null;
      const rentDecimal = parseFloat(row.tenancy_rent);

      let monthlyRentPounds;
      if (row.rent_frequency === 'Quarterly') monthlyRentPounds = rentDecimal / 3;
      else if (row.rent_frequency === 'Annually') monthlyRentPounds = rentDecimal / 12;
      else monthlyRentPounds = rentDecimal;

      const monthlyRentPence = Math.round(monthlyRentPounds * 100);

      let feePercent = DEFAULT_FEE_PERCENT;
      if (row.management_fee_value) feePercent = parseFloat(row.management_fee_value);

      let month = new Date(tenancyStart.getFullYear(), tenancyStart.getMonth(), 1);

      while (month < currentMonth) {
        if (tenancyEnd && month >= tenancyEnd) break;
        const year = month.getFullYear();
        const m = month.getMonth();
        const monthStr = year + "-" + String(m + 1).padStart(2, '0');
        const dueDate = new Date(year, m, 1);
        const periodEnd = new Date(year, m + 1, 0);

        let invoiceStatus, paidDate = null;
        if (periodEnd < now) {
          invoiceStatus = 'paid';
          paidDate = new Date(year, m, 5);
        } else {
          invoiceStatus = 'sent';
        }

        const invoiceNumber = "INV-" + monthStr.replace('-','') + "-" + row.property_id;
        const monthName = month.toLocaleString('en-GB', { month: 'long', year: 'numeric' });
        const lineItems = JSON.stringify([{
          description: "Rent for " + monthName,
          quantity: 1, unitAmount: monthlyRentPence, totalAmount: monthlyRentPence, vatRate: 0
        }]);

        await client.query(
          "INSERT INTO invoice (invoice_number, property_id, tenant_id, landlord_id, tenancy_id, invoice_type, amount, vat_amount, total_amount, line_items, due_date, paid_date, status, created_at, updated_at) VALUES ($1,$2,$3,$4,$5,'rent',$6,0,$6,$7,$8,$9,$10,$8,NOW()) ON CONFLICT (invoice_number) DO NOTHING",
          [invoiceNumber, row.property_id, row.tenant_id, row.landlord_id, row.tenancy_id, monthlyRentPence, lineItems, dueDate, paidDate, invoiceStatus]
        );
        invoiceCount++;

        const key = row.landlord_id + "-" + monthStr;
        if (!landlordMonthly[key]) {
          landlordMonthly[key] = { landlordId: row.landlord_id, landlordName: row.landlord_name, monthStr, periodStart: dueDate, periodEnd, totalRent: 0, totalFees: 0, totalVat: 0, lines: [] };
        }
        const feePence = Math.round(monthlyRentPence * feePercent / 100);
        const vatPence = Math.round(feePence * VAT_RATE);
        landlordMonthly[key].totalRent += monthlyRentPence;
        landlordMonthly[key].totalFees += feePence;
        landlordMonthly[key].totalVat += vatPence;
        landlordMonthly[key].lines.push({ propertyId: row.property_id, address: row.address, rent: monthlyRentPence, fee: feePence, vat: vatPence, feePercent });

        month = new Date(year, m + 1, 1);
      }
    }
    console.log("Generated " + invoiceCount + " invoices");

    for (const [key, data] of Object.entries(landlordMonthly)) {
      const netPayable = data.totalRent - data.totalFees - data.totalVat;
      let status, paidAt = null;
      if (data.periodEnd < now) {
        status = 'paid';
        paidAt = new Date(data.periodEnd.getFullYear(), data.periodEnd.getMonth() + 1, 15);
      } else {
        status = 'draft';
      }

      const { rows: [stmt] } = await client.query(
        "INSERT INTO landlord_statement (landlord_id, statement_period_start, statement_period_end, total_rent_collected, management_fees, maintenance_deductions, other_deductions, vat_on_fees, net_payable, status, paid_at, created_at, updated_at) VALUES ($1,$2,$3,$4,$5,0,0,$6,$7,$8,$9,NOW(),NOW()) RETURNING id",
        [data.landlordId, data.periodStart, data.periodEnd, data.totalRent, data.totalFees, data.totalVat, netPayable, status, paidAt]
      );
      statementCount++;

      for (const line of data.lines) {
        await client.query(
          "INSERT INTO statement_line_item (statement_id, property_id, line_type, description, amount, transaction_date, created_at) VALUES ($1,$2,'rent_collected',$3,$4,$5,NOW())",
          [stmt.id, line.propertyId, "Rent collected - " + line.address, line.rent, data.periodStart]
        );
        lineItemCount++;
        await client.query(
          "INSERT INTO statement_line_item (statement_id, property_id, line_type, description, amount, transaction_date, created_at) VALUES ($1,$2,'management_fee',$3,$4,$5,NOW())",
          [stmt.id, line.propertyId, "Management fee (" + line.feePercent + "%) - " + line.address, -line.fee, data.periodStart]
        );
        lineItemCount++;
        if (line.vat > 0) {
          await client.query(
            "INSERT INTO statement_line_item (statement_id, property_id, line_type, description, amount, transaction_date, created_at) VALUES ($1,$2,'other_deduction',$3,$4,$5,NOW())",
            [stmt.id, line.propertyId, "VAT on management fee - " + line.address, -line.vat, data.periodStart]
          );
          lineItemCount++;
        }
      }
    }

    await client.query('COMMIT');
    console.log("Generated " + statementCount + " landlord statements with " + lineItemCount + " line items");
    console.log('Done!');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error:', err.message);
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}
run().catch(function(e) { console.error(e); process.exit(1); });
