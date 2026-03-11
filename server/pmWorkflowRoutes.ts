import { Router } from "express";
import { pool } from "./db";
import { runRentProcessingAgent, importBankCSV } from "./services/rentProcessingAgent";
import { isGoCardlessConfigured } from "./gocardlessService";

export const pmWorkflowRouter = Router();

const requireAgent = (req: any, res: any, next: any) => {
  if (!req.user) return res.status(401).json({ error: "Not authenticated" });
  if (req.user.role !== "admin" && req.user.role !== "agent") return res.status(403).json({ error: "Not authorized" });
  next();
};

// ============================================================
// PM Dashboard
// ============================================================

pmWorkflowRouter.get("/pm-dashboard/summary", requireAgent, async (req, res) => {
  try {
    // Tenancy counts by status
    const tenancyResult = await pool.query(
      "SELECT status, COUNT(*)::int as count FROM tenancy GROUP BY status"
    );
    const tenancyCounts: Record<string, number> = { active: 0, pending: 0, ending: 0, closed: 0 };
    for (const row of tenancyResult.rows) {
      if (row.status in tenancyCounts) {
        tenancyCounts[row.status] = row.count;
      }
    }

    // Rent collection for current month
    const rentResult = await pool.query(
      "SELECT status, COUNT(*)::int as count, COALESCE(SUM(amount), 0)::numeric as total FROM invoice WHERE invoice_type = 'rent' AND date_trunc('month', due_date) = date_trunc('month', CURRENT_DATE) GROUP BY status"
    );
    const rentCollection: Record<string, { count: number; total: number }> = {
      paid: { count: 0, total: 0 },
      pending: { count: 0, total: 0 },
      overdue: { count: 0, total: 0 }
    };
    for (const row of rentResult.rows) {
      if (row.status in rentCollection) {
        rentCollection[row.status] = { count: row.count, total: parseFloat(row.total) };
      }
    }

    // Deposit protection status
    const depositResult = await pool.query(
      "SELECT CASE WHEN deposit_certificate_number IS NOT NULL AND deposit_certificate_number != '' THEN 'protected' ELSE 'unprotected' END as protection_status, COUNT(*)::int as count FROM tenancy WHERE deposit_amount IS NOT NULL GROUP BY protection_status"
    );
    const depositProtection: Record<string, number> = { protected: 0, unprotected: 0 };
    for (const row of depositResult.rows) {
      depositProtection[row.protection_status] = row.count;
    }

    // Compliance status from property_certificate
    const complianceResult = await pool.query(
      "SELECT CASE WHEN expiry_date < CURRENT_DATE THEN 'expired' WHEN expiry_date < CURRENT_DATE + INTERVAL '30 days' THEN 'expiring_soon' ELSE 'valid' END as compliance_status, COUNT(*)::int as count FROM property_certificate GROUP BY compliance_status"
    );
    const compliance: Record<string, number> = { valid: 0, expiring_soon: 0, expired: 0 };
    for (const row of complianceResult.rows) {
      compliance[row.compliance_status] = row.count;
    }

    // Arrears summary
    const arrearsResult = await pool.query(
      "SELECT COUNT(*)::int as active_cases, COALESCE(SUM(amount), 0)::numeric as total_outstanding FROM arrears WHERE status = 'active'"
    );
    const arrears = {
      activeCases: arrearsResult.rows[0]?.active_cases || 0,
      totalOutstanding: parseFloat(arrearsResult.rows[0]?.total_outstanding || "0")
    };

    // Tenancies ending in next 90 days
    const endingResult = await pool.query(
      "SELECT t.id, t.end_date, p.address as property_address, te.name as tenant_name FROM tenancy t LEFT JOIN property p ON t.property_id = p.id LEFT JOIN tenant te ON t.tenant_id = te.id WHERE t.end_date BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '90 days' AND t.status = 'active' ORDER BY t.end_date ASC"
    );

    res.json({
      tenancies: tenancyCounts,
      rentCollection,
      depositProtection,
      compliance,
      arrears,
      endingTenancies: endingResult.rows
    });
  } catch (error: any) {
    console.error("Error fetching PM dashboard summary:", error);
    res.status(500).json({ error: error.message });
  }
});
pmWorkflowRouter.get("/pm-dashboard/tenancies", requireAgent, async (req, res) => {
  try {
    const { status } = req.query;
    let sql = "SELECT t.*, p.address as property_address, p.postcode as property_postcode, te.name as tenant_name, te.email as tenant_email, te.phone as tenant_phone, l.name as landlord_name, l.email as landlord_email FROM tenancy t LEFT JOIN property p ON t.property_id = p.id LEFT JOIN tenant te ON t.tenant_id = te.id LEFT JOIN landlord l ON t.landlord_id = l.id";
    const params: any[] = [];

    if (status) {
      sql += " WHERE t.status = $1";
      params.push(status);
    }

    sql += " ORDER BY t.created_at DESC";

    const result = await pool.query(sql, params);
    res.json(result.rows);
  } catch (error: any) {
    console.error("Error fetching tenancies:", error);
    res.status(500).json({ error: error.message });
  }
});

// ============================================================
// Rent Collection
// ============================================================

pmWorkflowRouter.get("/rent-collection/daily", requireAgent, async (req, res) => {
  try {
    const { date } = req.query;
    const targetDate = date || new Date().toISOString().split("T")[0];

    const result = await pool.query(
      "SELECT i.*, te.name as tenant_name, te.email as tenant_email, p.address as property_address, pay.amount as payment_amount, pay.payment_date, pay.payment_method, pay.reference as payment_reference FROM invoice i LEFT JOIN tenancy tn ON i.tenancy_id = tn.id LEFT JOIN tenant te ON tn.tenant_id = te.id LEFT JOIN property p ON tn.property_id = p.id LEFT JOIN payment pay ON pay.invoice_id = i.id WHERE i.invoice_type = 'rent' AND i.due_date = $1 ORDER BY p.address ASC",
      [targetDate]
    );

    res.json(result.rows);
  } catch (error: any) {
    console.error("Error fetching daily rent collection:", error);
    res.status(500).json({ error: error.message });
  }
});

pmWorkflowRouter.get("/rent-collection/monthly", requireAgent, async (req, res) => {
  try {
    const { year, month } = req.query;
    const targetYear = year || new Date().getFullYear();
    const targetMonth = month || new Date().getMonth() + 1;
    const startDate = targetYear + "-" + String(targetMonth).padStart(2, "0") + "-01";

    const result = await pool.query(
      "SELECT i.*, te.name as tenant_name, te.email as tenant_email, p.address as property_address, pay.amount as payment_amount, pay.payment_date, pay.payment_method FROM invoice i LEFT JOIN tenancy tn ON i.tenancy_id = tn.id LEFT JOIN tenant te ON tn.tenant_id = te.id LEFT JOIN property p ON tn.property_id = p.id LEFT JOIN payment pay ON pay.invoice_id = i.id WHERE i.invoice_type = 'rent' AND date_trunc('month', i.due_date) = date_trunc('month', $1::date) ORDER BY i.due_date ASC, p.address ASC",
      [startDate]
    );

    const summaryResult = await pool.query(
      "SELECT COUNT(*)::int as total_invoices, COUNT(CASE WHEN status = 'paid' THEN 1 END)::int as paid_count, COUNT(CASE WHEN status = 'pending' THEN 1 END)::int as pending_count, COUNT(CASE WHEN status = 'overdue' THEN 1 END)::int as overdue_count, COALESCE(SUM(amount), 0)::numeric as total_expected, COALESCE(SUM(CASE WHEN status = 'paid' THEN amount ELSE 0 END), 0)::numeric as total_collected, COALESCE(SUM(CASE WHEN status \!= 'paid' THEN amount ELSE 0 END), 0)::numeric as total_outstanding FROM invoice WHERE invoice_type = 'rent' AND date_trunc('month', due_date) = date_trunc('month', $1::date)",
      [startDate]
    );

    const summary = summaryResult.rows[0];

    res.json({
      invoices: result.rows,
      summary: {
        totalInvoices: summary.total_invoices,
        paidCount: summary.paid_count,
        pendingCount: summary.pending_count,
        overdueCount: summary.overdue_count,
        totalExpected: parseFloat(summary.total_expected),
        totalCollected: parseFloat(summary.total_collected),
        totalOutstanding: parseFloat(summary.total_outstanding)
      }
    });
  } catch (error: any) {
    console.error("Error fetching monthly rent collection:", error);
    res.status(500).json({ error: error.message });
  }
});

pmWorkflowRouter.get("/rent-collection/commission-report", requireAgent, async (req, res) => {
  try {
    const { year, month } = req.query;
    const targetYear = year || new Date().getFullYear();
    const targetMonth = month || new Date().getMonth() + 1;
    const startDate = targetYear + "-" + String(targetMonth).padStart(2, "0") + "-01";

    const result = await pool.query(
      "SELECT p.id as property_id, p.address as property_address, p.management_fee_type, p.management_fee_value, l.name as landlord_name, COALESCE(SUM(CASE WHEN i.status = 'paid' THEN i.amount ELSE 0 END), 0)::numeric as rent_collected, CASE WHEN p.management_fee_type = 'percentage' THEN COALESCE(SUM(CASE WHEN i.status = 'paid' THEN i.amount ELSE 0 END), 0) * COALESCE(p.management_fee_value, 0) / 100 WHEN p.management_fee_type = 'fixed' THEN COALESCE(p.management_fee_value, 0) ELSE 0 END::numeric as commission FROM property p LEFT JOIN tenancy tn ON tn.property_id = p.id LEFT JOIN invoice i ON i.tenancy_id = tn.id AND i.invoice_type = 'rent' AND date_trunc('month', i.due_date) = date_trunc('month', $1::date) LEFT JOIN landlord l ON p.landlord_id = l.id WHERE p.is_managed = true GROUP BY p.id, p.address, p.management_fee_type, p.management_fee_value, l.name ORDER BY p.address ASC",
      [startDate]
    );

    const totalCommission = result.rows.reduce((sum: number, row: any) => sum + parseFloat(row.commission || "0"), 0);

    res.json({
      properties: result.rows.map((row: any) => ({
        ...row,
        rent_collected: parseFloat(row.rent_collected),
        commission: parseFloat(row.commission)
      })),
      totalCommission
    });
  } catch (error: any) {
    console.error("Error fetching commission report:", error);
    res.status(500).json({ error: error.message });
  }
});
// ============================================================
// Deposits
// ============================================================

pmWorkflowRouter.get("/deposits", requireAgent, async (req, res) => {
  try {
    const { status } = req.query;
    let sql = "SELECT t.id as tenancy_id, t.deposit_amount, t.deposit_scheme, t.deposit_certificate_number, t.deposit_protected_date, t.deposit_holder_type, t.start_date, t.end_date, t.status as tenancy_status, p.address as property_address, p.postcode as property_postcode, te.name as tenant_name, te.email as tenant_email, l.name as landlord_name FROM tenancy t LEFT JOIN property p ON t.property_id = p.id LEFT JOIN tenant te ON t.tenant_id = te.id LEFT JOIN landlord l ON t.landlord_id = l.id WHERE t.deposit_amount IS NOT NULL";
    const params: any[] = [];

    if (status === "protected") {
      sql += " AND t.deposit_certificate_number IS NOT NULL AND t.deposit_certificate_number != ''";
    } else if (status === "unprotected") {
      sql += " AND (t.deposit_certificate_number IS NULL OR t.deposit_certificate_number = '')";
    }

    sql += " ORDER BY t.created_at DESC";

    const result = await pool.query(sql, params);
    const rows = result.rows;

    // Compute stats
    const protectedCount = rows.filter((r: any) => r.deposit_certificate_number).length;
    const totalValue = rows.reduce((sum: number, r: any) => sum + parseFloat(r.deposit_amount || '0'), 0);

    // Map rows to expected shape
    const deposits = rows.map((r: any) => ({
      tenancy_id: r.tenancy_id,
      tenant_name: r.tenant_name || '',
      tenant_email: r.tenant_email || '',
      property_address: r.property_address || '',
      landlord_name: r.landlord_name || '',
      deposit_amount: Math.round(parseFloat(r.deposit_amount || '0') * 100),
      deposit_scheme: r.deposit_scheme,
      deposit_holder_type: r.deposit_holder_type,
      deposit_certificate_number: r.deposit_certificate_number,
      protected_date: r.deposit_protected_date,
    }));

    res.json({
      deposits,
      stats: {
        total: rows.length,
        protected: protectedCount,
        unprotected: rows.length - protectedCount,
        totalValue: Math.round(totalValue * 100),
      },
    });
  } catch (error: any) {
    console.error("Error fetching deposits:", error);
    res.status(500).json({ error: error.message });
  }
});

pmWorkflowRouter.put("/deposits/:tenancyId/protect", requireAgent, async (req, res) => {
  try {
    const { tenancyId } = req.params;
    const { depositScheme, depositCertificateNumber, depositProtectedDate, depositHolderType,
      deposit_scheme, deposit_holder_type, deposit_certificate_number, protected_date } = req.body;
    const finalScheme = depositScheme || deposit_scheme;
    const finalCert = depositCertificateNumber || deposit_certificate_number;
    const finalDate = depositProtectedDate || protected_date;
    const finalHolder = depositHolderType || deposit_holder_type;

    const result = await pool.query(
      "UPDATE tenancy SET deposit_scheme = $1, deposit_certificate_number = $2, deposit_protected_date = $3, deposit_holder_type = $4, updated_at = NOW() WHERE id = $5 RETURNING *",
      [finalScheme, finalCert, finalDate, finalHolder, tenancyId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Tenancy not found" });
    }

    res.json(result.rows[0]);
  } catch (error: any) {
    console.error("Error updating deposit protection:", error);
    res.status(500).json({ error: error.message });
  }
});
// ============================================================
// End of Tenancy
// ============================================================

// Start end-of-tenancy process with 15-step checklist
pmWorkflowRouter.post("/end-of-tenancy/:tenancyId/start", requireAgent, async (req, res) => {
  try {
    const { tenancyId } = req.params;
    const { noticeType } = req.body;

    const tenancyResult = await pool.query(
      `UPDATE tenancy SET status = 'ending', notice_type = $2, notice_served_date = NOW(), updated_at = NOW() WHERE id = $1 RETURNING *`,
      [tenancyId, noticeType || 'tenant_notice']
    );

    if (tenancyResult.rows.length === 0) {
      return res.status(404).json({ error: "Tenancy not found" });
    }

    // Full 15-step end-of-tenancy checklist (ordered)
    const checklistItems = [
      "serve_notice",
      "tenant_acknowledge_notice",
      "schedule_checkout_inspection",
      "checkout_inspection",
      "inventory_checkout",
      "meter_readings",
      "assess_dilapidations",
      "cleaning_assessment",
      "deposit_deductions_agreed",
      "deposit_return_initiated",
      "key_return",
      "final_account",
      "utility_notifications",
      "council_tax_notification",
      "forwarding_address"
    ];

    // Delete any old checklist items for this tenancy (end_of_tenancy workflow)
    await pool.query(
      `DELETE FROM tenancy_checklist_item WHERE tenancy_id = $1 AND item_type = ANY($2::text[])`,
      [tenancyId, checklistItems]
    );

    for (const itemType of checklistItems) {
      await pool.query(
        "INSERT INTO tenancy_checklist_item (tenancy_id, item_type, is_completed) VALUES ($1, $2, false)",
        [tenancyId, itemType]
      );
    }

    // Auto-complete serve_notice since we just served it
    await pool.query(
      `UPDATE tenancy_checklist_item SET is_completed = true, completed_at = NOW() WHERE tenancy_id = $1 AND item_type = 'serve_notice'`,
      [tenancyId]
    );

    const checklist = await pool.query(
      "SELECT * FROM tenancy_checklist_item WHERE tenancy_id = $1 AND item_type = ANY($2::text[]) ORDER BY id ASC",
      [tenancyId, checklistItems]
    );

    res.json({
      tenancy: tenancyResult.rows[0],
      checklist: checklist.rows
    });
  } catch (error: any) {
    console.error("Error starting end of tenancy:", error);
    res.status(500).json({ error: error.message });
  }
});

// Get end-of-tenancy details with full checkout info
pmWorkflowRouter.get("/end-of-tenancy/:tenancyId", requireAgent, async (req, res) => {
  try {
    const { tenancyId } = req.params;

    const tenancyResult = await pool.query(
      `SELECT t.*,
        p.address as property_address, p.postcode as property_postcode, p.address_line1 as property_address_line1,
        te.name as tenant_name, te.email as tenant_email, te.phone as tenant_phone,
        l.name as landlord_name, l.email as landlord_email, l.phone as landlord_phone
      FROM tenancy t
      LEFT JOIN property p ON t.property_id = p.id
      LEFT JOIN tenant te ON t.tenant_id = te.id
      LEFT JOIN landlord l ON t.landlord_id = l.id
      WHERE t.id = $1`,
      [tenancyId]
    );

    if (tenancyResult.rows.length === 0) {
      return res.status(404).json({ error: "Tenancy not found" });
    }

    // End-of-tenancy checklist items only
    const eotItems = [
      "serve_notice", "tenant_acknowledge_notice", "schedule_checkout_inspection",
      "checkout_inspection", "inventory_checkout", "meter_readings",
      "assess_dilapidations", "cleaning_assessment", "deposit_deductions_agreed",
      "deposit_return_initiated", "key_return", "final_account",
      "utility_notifications", "council_tax_notification", "forwarding_address"
    ];

    const checklistResult = await pool.query(
      `SELECT * FROM tenancy_checklist_item WHERE tenancy_id = $1 AND item_type = ANY($2::text[]) ORDER BY id ASC`,
      [tenancyId, eotItems]
    );

    const tenancy = tenancyResult.rows[0];

    // Get latest inventory report
    let latestInventory = null;
    try {
      const inventoryResult = await pool.query(
        "SELECT * FROM property_inventory WHERE property_id = $1 ORDER BY created_at DESC LIMIT 1",
        [tenancy.property_id]
      );
      latestInventory = inventoryResult.rows[0] || null;
    } catch (e) { /* table may not exist */ }

    // Get open maintenance tickets for the property
    let openMaintenance: any[] = [];
    try {
      const maintenanceResult = await pool.query(
        `SELECT * FROM maintenance_ticket WHERE property_id = $1 AND status NOT IN ('completed', 'cancelled') ORDER BY created_at DESC`,
        [tenancy.property_id]
      );
      openMaintenance = maintenanceResult.rows;
    } catch (e) { /* table may not exist */ }

    res.json({
      tenancy,
      checklist: checklistResult.rows,
      latestInventory,
      openMaintenance,
      depositSummary: {
        depositAmount: tenancy.deposit_amount,
        depositScheme: tenancy.deposit_scheme,
        depositCertificateNumber: tenancy.deposit_certificate_number,
        depositReturnAmount: tenancy.deposit_return_amount,
        depositDeductionsAmount: tenancy.deposit_deductions_amount,
        depositDeductionsReason: tenancy.deposit_deductions_reason,
        depositReturnStatus: tenancy.deposit_return_status,
        depositDisputeStatus: tenancy.deposit_dispute_status
      }
    });
  } catch (error: any) {
    console.error("Error fetching end of tenancy details:", error);
    res.status(500).json({ error: error.message });
  }
});

// Update deposit deductions / return details
pmWorkflowRouter.patch("/end-of-tenancy/:tenancyId/deposit", requireAgent, async (req, res) => {
  try {
    const { tenancyId } = req.params;
    const {
      depositReturnAmount, depositDeductionsAmount, depositDeductionsReason,
      depositReturnStatus, depositDisputeStatus, depositDisputeNotes,
      dilapidationsAmount, dilapidationsNotes, cleaningRequired, cleaningCost
    } = req.body;

    const fields: string[] = [];
    const values: any[] = [];
    let idx = 1;

    const addField = (col: string, val: any) => {
      if (val !== undefined) { fields.push(`${col} = $${idx}`); values.push(val); idx++; }
    };

    addField("deposit_return_amount", depositReturnAmount);
    addField("deposit_deductions_amount", depositDeductionsAmount);
    addField("deposit_deductions_reason", depositDeductionsReason);
    addField("deposit_return_status", depositReturnStatus);
    addField("deposit_dispute_status", depositDisputeStatus);
    addField("deposit_dispute_notes", depositDisputeNotes);
    addField("dilapidations_amount", dilapidationsAmount);
    addField("dilapidations_notes", dilapidationsNotes);
    addField("cleaning_required", cleaningRequired);
    addField("cleaning_cost", cleaningCost);

    if (fields.length === 0) return res.status(400).json({ error: "No fields to update" });

    fields.push(`updated_at = NOW()`);
    values.push(tenancyId);

    const result = await pool.query(
      `UPDATE tenancy SET ${fields.join(", ")} WHERE id = $${idx} RETURNING *`,
      values
    );

    res.json(result.rows[0]);
  } catch (error: any) {
    console.error("Error updating deposit details:", error);
    res.status(500).json({ error: error.message });
  }
});

// Update meter readings
pmWorkflowRouter.patch("/end-of-tenancy/:tenancyId/meters", requireAgent, async (req, res) => {
  try {
    const { tenancyId } = req.params;
    const { electric, gas, water } = req.body;

    const result = await pool.query(
      `UPDATE tenancy SET final_meter_electric = $1, final_meter_gas = $2, final_meter_water = $3, updated_at = NOW() WHERE id = $4 RETURNING *`,
      [electric, gas, water, tenancyId]
    );

    res.json(result.rows[0]);
  } catch (error: any) {
    console.error("Error updating meter readings:", error);
    res.status(500).json({ error: error.message });
  }
});

// Update checkout details
pmWorkflowRouter.patch("/end-of-tenancy/:tenancyId/checkout", requireAgent, async (req, res) => {
  try {
    const { tenancyId } = req.params;
    const { checkoutDate, checkoutClerk, forwardingAddress } = req.body;

    const fields: string[] = [];
    const values: any[] = [];
    let idx = 1;

    if (checkoutDate !== undefined) { fields.push(`checkout_date = $${idx}`); values.push(checkoutDate); idx++; }
    if (checkoutClerk !== undefined) { fields.push(`checkout_clerk = $${idx}`); values.push(checkoutClerk); idx++; }
    if (forwardingAddress !== undefined) { fields.push(`forwarding_address = $${idx}`); values.push(forwardingAddress); idx++; }

    if (fields.length === 0) return res.status(400).json({ error: "No fields to update" });

    fields.push(`updated_at = NOW()`);
    values.push(tenancyId);

    const result = await pool.query(
      `UPDATE tenancy SET ${fields.join(", ")} WHERE id = $${idx} RETURNING *`,
      values
    );

    res.json(result.rows[0]);
  } catch (error: any) {
    console.error("Error updating checkout details:", error);
    res.status(500).json({ error: error.message });
  }
});

// Complete end-of-tenancy — close tenancy + deactivate tenant
pmWorkflowRouter.post("/end-of-tenancy/:tenancyId/complete", requireAgent, async (req, res) => {
  try {
    const { tenancyId } = req.params;

    // Verify all checklist items are completed
    const incompleteResult = await pool.query(
      `SELECT COUNT(*) as count FROM tenancy_checklist_item
       WHERE tenancy_id = $1 AND is_completed = false
       AND item_type IN ('serve_notice','tenant_acknowledge_notice','schedule_checkout_inspection','checkout_inspection','inventory_checkout','meter_readings','assess_dilapidations','cleaning_assessment','deposit_deductions_agreed','deposit_return_initiated','key_return','final_account','utility_notifications','council_tax_notification','forwarding_address')`,
      [tenancyId]
    );

    const incompleteCount = parseInt(incompleteResult.rows[0].count);
    if (incompleteCount > 0) {
      return res.status(400).json({ error: `Cannot complete: ${incompleteCount} checklist items still pending` });
    }

    const tenancyResult = await pool.query(
      "UPDATE tenancy SET status = 'terminated', updated_at = NOW() WHERE id = $1 RETURNING *",
      [tenancyId]
    );

    if (tenancyResult.rows.length === 0) {
      return res.status(404).json({ error: "Tenancy not found" });
    }

    const tenancy = tenancyResult.rows[0];

    // Set tenant to inactive
    if (tenancy.tenant_id) {
      await pool.query(
        "UPDATE tenant SET status = 'inactive', updated_at = NOW() WHERE id = $1",
        [tenancy.tenant_id]
      );
    }

    // Mark property as no longer managed (optional - depends on business logic)
    // await pool.query("UPDATE property SET is_managed = false WHERE id = $1", [tenancy.property_id]);

    res.json({ tenancy: tenancyResult.rows[0], message: "Tenancy terminated successfully" });
  } catch (error: any) {
    console.error("Error completing end of tenancy:", error);
    res.status(500).json({ error: error.message });
  }
});
// ============================================================
// Compliance
// ============================================================

pmWorkflowRouter.get("/compliance/calendar", requireAgent, async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT pc.*, p.address as property_address, p.postcode as property_postcode, CASE WHEN pc.expiry_date < CURRENT_DATE THEN 'expired' WHEN pc.expiry_date < CURRENT_DATE + INTERVAL '7 days' THEN 'critical' WHEN pc.expiry_date < CURRENT_DATE + INTERVAL '30 days' THEN 'warning' WHEN pc.expiry_date < CURRENT_DATE + INTERVAL '90 days' THEN 'upcoming' ELSE 'valid' END as urgency FROM property_certificate pc LEFT JOIN property p ON pc.property_id = p.id ORDER BY pc.expiry_date ASC"
    );

    res.json(result.rows);
  } catch (error: any) {
    console.error("Error fetching compliance calendar:", error);
    res.status(500).json({ error: error.message });
  }
});

pmWorkflowRouter.get("/compliance/summary", requireAgent, async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT certificate_type, COUNT(*)::int as total, COUNT(CASE WHEN expiry_date < CURRENT_DATE THEN 1 END)::int as expired, COUNT(CASE WHEN expiry_date >= CURRENT_DATE AND expiry_date < CURRENT_DATE + INTERVAL '30 days' THEN 1 END)::int as expiring_soon, COUNT(CASE WHEN expiry_date >= CURRENT_DATE + INTERVAL '30 days' THEN 1 END)::int as valid FROM property_certificate GROUP BY certificate_type ORDER BY certificate_type"
    );

    res.json(result.rows);
  } catch (error: any) {
    console.error("Error fetching compliance summary:", error);
    res.status(500).json({ error: error.message });
  }
});

// ============================================================
// Inventory
// ============================================================

pmWorkflowRouter.get("/inventory/:propertyId", requireAgent, async (req, res) => {
  try {
    const { propertyId } = req.params;

    const inventories = await pool.query(
      "SELECT pi.*, (SELECT json_agg(ii.* ORDER BY ii.id) FROM inventory_item ii WHERE ii.inventory_id = pi.id) as items FROM property_inventory pi WHERE pi.property_id = $1 ORDER BY pi.created_at DESC",
      [propertyId]
    );

    res.json(inventories.rows);
  } catch (error: any) {
    console.error("Error fetching inventories:", error);
    res.status(500).json({ error: error.message });
  }
});

pmWorkflowRouter.post("/inventory", requireAgent, async (req, res) => {
  try {
    const { propertyId, tenancyId, inventoryType, notes, items } = req.body;

    const inventoryResult = await pool.query(
      "INSERT INTO property_inventory (property_id, tenancy_id, inventory_type, notes, status, created_at, updated_at) VALUES ($1, $2, $3, $4, 'draft', NOW(), NOW()) RETURNING *",
      [propertyId, tenancyId, inventoryType, notes]
    );

    const inventory = inventoryResult.rows[0];

    if (items && Array.isArray(items)) {
      for (const item of items) {
        await pool.query(
          "INSERT INTO inventory_item (inventory_id, room, item_name, description, condition, checkin_condition, quantity, notes, created_at, updated_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW())",
          [inventory.id, item.room, item.itemName, item.description, item.condition, item.checkinCondition, item.quantity || 1, item.notes]
        );
      }
    }

    const fullInventory = await pool.query(
      "SELECT pi.*, (SELECT json_agg(ii.* ORDER BY ii.id) FROM inventory_item ii WHERE ii.inventory_id = pi.id) as items FROM property_inventory pi WHERE pi.id = $1",
      [inventory.id]
    );

    res.json(fullInventory.rows[0]);
  } catch (error: any) {
    console.error("Error creating inventory:", error);
    res.status(500).json({ error: error.message });
  }
});

pmWorkflowRouter.post("/inventory/:inventoryId/items", requireAgent, async (req, res) => {
  try {
    const { inventoryId } = req.params;
    const { room, itemName, description, condition, checkinCondition, quantity, notes } = req.body;

    const result = await pool.query(
      "INSERT INTO inventory_item (inventory_id, room, item_name, description, condition, checkin_condition, quantity, notes, created_at, updated_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW()) RETURNING *",
      [inventoryId, room, itemName, description, condition, checkinCondition, quantity || 1, notes]
    );

    res.json(result.rows[0]);
  } catch (error: any) {
    console.error("Error adding inventory item:", error);
    res.status(500).json({ error: error.message });
  }
});

pmWorkflowRouter.put("/inventory/:inventoryId/items/:itemId/checkout", requireAgent, async (req, res) => {
  try {
    const { inventoryId, itemId } = req.params;
    const { checkoutCondition, checkoutNotes, damageAmount } = req.body;

    const result = await pool.query(
      "UPDATE inventory_item SET checkout_condition = $1, checkout_notes = $2, damage_amount = $3, updated_at = NOW() WHERE id = $4 AND inventory_id = $5 RETURNING *",
      [checkoutCondition, checkoutNotes, damageAmount, itemId, inventoryId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Inventory item not found" });
    }

    res.json(result.rows[0]);
  } catch (error: any) {
    console.error("Error updating checkout condition:", error);
    res.status(500).json({ error: error.message });
  }
});

pmWorkflowRouter.put("/inventory/:inventoryId/complete", requireAgent, async (req, res) => {
  try {
    const { inventoryId } = req.params;

    const result = await pool.query(
      "UPDATE property_inventory SET status = 'completed', completed_at = NOW(), updated_at = NOW() WHERE id = $1 RETURNING *",
      [inventoryId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Inventory not found" });
    }

    res.json(result.rows[0]);
  } catch (error: any) {
    console.error("Error completing inventory:", error);
    res.status(500).json({ error: error.message });
  }
});

pmWorkflowRouter.get("/inventory/:inventoryId/damage-summary", requireAgent, async (req, res) => {
  try {
    const { inventoryId } = req.params;

    const result = await pool.query(
      "SELECT * FROM inventory_item WHERE inventory_id = $1 AND damage_amount IS NOT NULL AND damage_amount > 0 ORDER BY room, item_name",
      [inventoryId]
    );

    const totalDamageResult = await pool.query(
      "SELECT COALESCE(SUM(damage_amount), 0)::numeric as total_damage FROM inventory_item WHERE inventory_id = $1 AND damage_amount IS NOT NULL AND damage_amount > 0",
      [inventoryId]
    );

    res.json({
      damagedItems: result.rows,
      totalDamageAmount: parseFloat(totalDamageResult.rows[0].total_damage)
    });
  } catch (error: any) {
    console.error("Error fetching damage summary:", error);
    res.status(500).json({ error: error.message });
  }
});


// ============================================================
// Viewings Calendar
// ============================================================

pmWorkflowRouter.get("/viewings/calendar", requireAgent, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        lv.id,
        lv.lead_id,
        lv.property_id,
        lv.scheduled_at,
        lv.duration,
        lv.viewing_type,
        lv.status,
        lv.cancelled_reason,
        lv.agent_notes,
        l.name as lead_name,
        l.email as lead_email,
        l.phone as lead_phone,
        COALESCE(p.address, p.address_line1, p.title) as property_address,
        p.postcode as property_postcode,
        u.full_name as conducted_by_name
      FROM lead_viewing lv
      LEFT JOIN lead l ON lv.lead_id = l.id
      LEFT JOIN property p ON lv.property_id = p.id
      LEFT JOIN "user" u ON lv.conducted_by = u.id
      ORDER BY lv.scheduled_at ASC
    `);

    res.json(result.rows);
  } catch (error: any) {
    console.error("Error fetching viewings calendar:", error);
    res.status(500).json({ error: error.message });
  }
});

// ============================================================
// Tenancy Contracts Expiry Calendar
// ============================================================

// ============================================================
// Rent Processing Agent
// ============================================================

// Run the rent processing agent
pmWorkflowRouter.post("/rent-agent/run", requireAgent, async (req, res) => {
  try {
    const triggeredBy = (req as any).user?.id ? `user_${(req as any).user.id}` : 'manual';
    const runId = await runRentProcessingAgent(triggeredBy);
    res.json({ runId, message: 'Rent processing agent started' });
  } catch (error: any) {
    console.error("Error running rent agent:", error);
    res.status(500).json({ error: error.message });
  }
});

// Get agent run status
pmWorkflowRouter.get("/rent-agent/status/:runId", requireAgent, async (req, res) => {
  try {
    const result = await pool.query("SELECT * FROM agent_run WHERE id = $1", [req.params.runId]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Run not found' });
    res.json(result.rows[0]);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Get recent agent runs
pmWorkflowRouter.get("/rent-agent/history", requireAgent, async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT * FROM agent_run WHERE agent_type = 'rent_processing' ORDER BY started_at DESC LIMIT 20"
    );
    res.json(result.rows);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Get latest agent run
pmWorkflowRouter.get("/rent-agent/latest", requireAgent, async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT * FROM agent_run WHERE agent_type = 'rent_processing' ORDER BY started_at DESC LIMIT 1"
    );
    res.json(result.rows[0] || null);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Check payment source (GoCardless vs CSV)
pmWorkflowRouter.get("/rent-agent/payment-source", requireAgent, async (req, res) => {
  try {
    const gcConfigured = isGoCardlessConfigured();
    const unmatchedCount = await pool.query(
      "SELECT COUNT(*)::int as count FROM bank_transaction WHERE match_status = 'unmatched' AND transaction_type = 'credit'"
    );
    res.json({
      goCardlessConfigured: gcConfigured,
      paymentSource: gcConfigured ? 'gocardless' : 'bank_csv',
      unmatchedBankTransactions: unmatchedCount.rows[0]?.count || 0,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Upload bank CSV (fallback when GoCardless not configured)
pmWorkflowRouter.post("/rent-agent/import-csv", requireAgent, async (req, res) => {
  try {
    const { csvContent, bankName } = req.body;
    if (!csvContent) return res.status(400).json({ error: 'csvContent is required' });

    const importedBy = (req as any).user?.id ? `user_${(req as any).user.id}` : 'unknown';
    const result = await importBankCSV(csvContent, bankName || 'Unknown Bank', importedBy);
    res.json(result);
  } catch (error: any) {
    console.error("Error importing bank CSV:", error);
    res.status(500).json({ error: error.message });
  }
});

// ============================================================
// PM Command Centre: Action Queue
// ============================================================

pmWorkflowRouter.get("/pm-command-centre/action-queue", requireAgent, async (req, res) => {
  try {
    const items: any[] = [];

    // 1. Overdue rent invoices
    const overdueInvoices = await pool.query(`
      SELECT i.id, i.amount, i.due_date, t.name as tenant_name,
        COALESCE(p.address, p.address_line1) as property_address,
        tn.id as tenancy_id
      FROM invoice i
      LEFT JOIN tenancy tn ON i.tenancy_id = tn.id
      LEFT JOIN tenant t ON tn.tenant_id = t.id
      LEFT JOIN property p ON tn.property_id = p.id
      WHERE i.status = 'overdue' AND i.invoice_type = 'rent'
      ORDER BY i.due_date ASC LIMIT 50
    `);
    for (const row of overdueInvoices.rows) {
      items.push({
        id: `overdue-invoice-${row.id}`,
        type: 'overdue_rent',
        icon: 'pound',
        priority: 'high',
        title: `Overdue rent - ${row.tenant_name || 'Unknown tenant'}`,
        description: `£${((row.amount || 0) / 100).toFixed(2)} due ${row.due_date ? new Date(row.due_date).toLocaleDateString('en-GB') : 'N/A'}`,
        entity: row.property_address || 'Unknown property',
        entityType: 'tenancy',
        entityId: row.tenancy_id,
        dueDate: row.due_date,
        link: '/crm/rent-collection'
      });
    }

    // 2. Unprotected deposits
    const unprotectedDeposits = await pool.query(`
      SELECT tn.id, tn.deposit_amount, t.name as tenant_name,
        COALESCE(p.address, p.address_line1) as property_address
      FROM tenancy tn
      LEFT JOIN tenant t ON tn.tenant_id = t.id
      LEFT JOIN property p ON tn.property_id = p.id
      WHERE tn.deposit_amount IS NOT NULL AND tn.deposit_amount > 0
        AND (tn.deposit_certificate_number IS NULL OR tn.deposit_certificate_number = '')
        AND tn.status = 'active'
      LIMIT 50
    `);
    for (const row of unprotectedDeposits.rows) {
      items.push({
        id: `unprotected-deposit-${row.id}`,
        type: 'unprotected_deposit',
        icon: 'shield',
        priority: 'high',
        title: `Unprotected deposit - ${row.tenant_name || 'Unknown tenant'}`,
        description: `£${((row.deposit_amount || 0) / 100).toFixed(2)} deposit not protected`,
        entity: row.property_address || 'Unknown property',
        entityType: 'tenancy',
        entityId: row.id,
        dueDate: null,
        link: '/crm/deposit-management'
      });
    }

    // 3. Expiring compliance certificates (within 30 days or expired)
    const expiringCerts = await pool.query(`
      SELECT pc.id, pc.certificate_type, pc.expiry_date,
        COALESCE(p.address, p.address_line1) as property_address,
        pc.property_id,
        (pc.expiry_date - CURRENT_DATE) as days_until_expiry
      FROM property_certificate pc
      LEFT JOIN property p ON pc.property_id = p.id
      WHERE pc.expiry_date <= CURRENT_DATE + INTERVAL '30 days'
      ORDER BY pc.expiry_date ASC LIMIT 50
    `);
    for (const row of expiringCerts.rows) {
      const expired = row.days_until_expiry < 0;
      items.push({
        id: `cert-${row.id}`,
        type: expired ? 'expired_certificate' : 'expiring_certificate',
        icon: 'certificate',
        priority: expired ? 'high' : 'medium',
        title: `${expired ? 'Expired' : 'Expiring'} ${row.certificate_type?.replace(/_/g, ' ') || 'certificate'}`,
        description: expired
          ? `Expired ${Math.abs(row.days_until_expiry)} days ago`
          : `Expires in ${row.days_until_expiry} days`,
        entity: row.property_address || 'Unknown property',
        entityType: 'property',
        entityId: row.property_id,
        dueDate: row.expiry_date,
        link: '/crm/compliance-calendar'
      });
    }

    // 4. Tenancies ending within 90 days (no end-of-tenancy started)
    const endingTenancies = await pool.query(`
      SELECT tn.id, tn.end_date, t.name as tenant_name,
        COALESCE(p.address, p.address_line1) as property_address,
        (tn.end_date::date - CURRENT_DATE) as days_remaining
      FROM tenancy tn
      LEFT JOIN tenant t ON tn.tenant_id = t.id
      LEFT JOIN property p ON tn.property_id = p.id
      WHERE tn.status = 'active'
        AND tn.end_date BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '90 days'
      ORDER BY tn.end_date ASC LIMIT 50
    `);
    for (const row of endingTenancies.rows) {
      items.push({
        id: `ending-tenancy-${row.id}`,
        type: 'ending_tenancy',
        icon: 'calendar',
        priority: row.days_remaining <= 30 ? 'high' : 'medium',
        title: `Tenancy ending - ${row.tenant_name || 'Unknown tenant'}`,
        description: `Ends in ${row.days_remaining} days`,
        entity: row.property_address || 'Unknown property',
        entityType: 'tenancy',
        entityId: row.id,
        dueDate: row.end_date,
        link: `/crm/end-of-tenancy`
      });
    }

    // 5. Open maintenance tickets (overdue or high urgency)
    const maintenanceTickets = await pool.query(`
      SELECT mt.id, mt.title, mt.urgency, mt.status, mt.created_at,
        COALESCE(p.address, p.address_line1) as property_address,
        mt.property_id
      FROM maintenance_ticket mt
      LEFT JOIN property p ON mt.property_id = p.id
      WHERE mt.status IN ('new', 'assigned', 'in_progress', 'awaiting_parts')
      ORDER BY
        CASE mt.urgency WHEN 'emergency' THEN 0 WHEN 'urgent' THEN 1 WHEN 'routine' THEN 2 ELSE 3 END,
        mt.created_at ASC
      LIMIT 50
    `);
    for (const row of maintenanceTickets.rows) {
      items.push({
        id: `maintenance-${row.id}`,
        type: 'maintenance',
        icon: 'wrench',
        priority: row.urgency === 'emergency' ? 'high' : row.urgency === 'urgent' ? 'high' : 'medium',
        title: row.title || 'Maintenance ticket',
        description: `${row.urgency} - ${row.status?.replace(/_/g, ' ')}`,
        entity: row.property_address || 'Unknown property',
        entityType: 'property',
        entityId: row.property_id,
        dueDate: null,
        link: '/crm/maintenance'
      });
    }

    // 6. Draft landlord statements
    const draftStatements = await pool.query(`
      SELECT ls.id, ls.landlord_id, ls.net_payable, ls.statement_period_end,
        l.name as landlord_name
      FROM landlord_statement ls
      LEFT JOIN landlord l ON ls.landlord_id = l.id
      WHERE ls.status = 'draft'
      ORDER BY ls.statement_period_end DESC LIMIT 50
    `);
    for (const row of draftStatements.rows) {
      items.push({
        id: `draft-statement-${row.id}`,
        type: 'draft_statement',
        icon: 'file',
        priority: 'low',
        title: `Draft statement - ${row.landlord_name || 'Unknown landlord'}`,
        description: `Net payable: £${((row.net_payable || 0) / 100).toFixed(2)}`,
        entity: row.landlord_name || 'Unknown landlord',
        entityType: 'landlord',
        entityId: row.landlord_id,
        dueDate: row.statement_period_end,
        link: '/crm/statements'
      });
    }

    // 7. Unmatched bank transactions (credits)
    const unmatchedTxns = await pool.query(`
      SELECT id, amount, transaction_date, description, reference
      FROM bank_transaction
      WHERE match_status = 'unmatched' AND transaction_type = 'credit'
      ORDER BY transaction_date DESC LIMIT 50
    `);
    for (const row of unmatchedTxns.rows) {
      items.push({
        id: `bank-txn-${row.id}`,
        type: 'unmatched_transaction',
        icon: 'bank',
        priority: 'medium',
        title: `Unmatched payment - £${((row.amount || 0) / 100).toFixed(2)}`,
        description: row.reference || row.description || 'No reference',
        entity: 'Bank',
        entityType: 'bank_transaction',
        entityId: row.id,
        dueDate: row.transaction_date,
        link: '/crm/bank-reconciliation'
      });
    }

    // 8. Pending tasks assigned to current user
    const userId = (req as any).user?.id;
    if (userId) {
      const pendingTasks = await pool.query(`
        SELECT t.id, t.title, t.description, t.priority, t.due_date, t.task_type,
          COALESCE(p.address, p.address_line1) as property_address,
          t.property_id
        FROM task t
        LEFT JOIN property p ON t.property_id = p.id
        WHERE t.assigned_to_id = $1 AND t.status IN ('pending', 'in_progress')
        ORDER BY
          CASE t.priority WHEN 'urgent' THEN 0 WHEN 'high' THEN 1 WHEN 'normal' THEN 2 ELSE 3 END,
          t.due_date ASC NULLS LAST
        LIMIT 30
      `, [userId]);
      for (const row of pendingTasks.rows) {
        items.push({
          id: `task-${row.id}`,
          type: 'task',
          icon: 'task',
          priority: row.priority === 'urgent' || row.priority === 'high' ? 'high' : 'medium',
          title: row.title || 'Task',
          description: row.description || row.task_type?.replace(/_/g, ' ') || '',
          entity: row.property_address || 'General',
          entityType: 'task',
          entityId: row.id,
          dueDate: row.due_date,
          link: '/crm/task-manager'
        });
      }
    }

    // Sort by priority (high first), then by due date
    const priorityOrder: Record<string, number> = { high: 0, medium: 1, low: 2 };
    items.sort((a, b) => {
      const pa = priorityOrder[a.priority] ?? 2;
      const pb = priorityOrder[b.priority] ?? 2;
      if (pa !== pb) return pa - pb;
      if (a.dueDate && b.dueDate) return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
      if (a.dueDate) return -1;
      if (b.dueDate) return 1;
      return 0;
    });

    res.json({
      items,
      counts: {
        total: items.length,
        high: items.filter(i => i.priority === 'high').length,
        medium: items.filter(i => i.priority === 'medium').length,
        low: items.filter(i => i.priority === 'low').length,
      }
    });
  } catch (error: any) {
    console.error("Error fetching action queue:", error);
    res.status(500).json({ error: error.message });
  }
});

// ============================================================
// PM Command Centre: Enhanced Summary (with maintenance count)
// ============================================================

pmWorkflowRouter.get("/pm-command-centre/summary", requireAgent, async (req, res) => {
  try {
    const [tenancyR, rentR, depositR, complianceR, arrearsR, endingR, maintenanceR] = await Promise.all([
      pool.query("SELECT status, COUNT(*)::int as count FROM tenancy GROUP BY status"),
      pool.query("SELECT status, COUNT(*)::int as count, COALESCE(SUM(amount), 0)::numeric as total FROM invoice WHERE invoice_type = 'rent' AND date_trunc('month', due_date) = date_trunc('month', CURRENT_DATE) GROUP BY status"),
      pool.query("SELECT CASE WHEN deposit_certificate_number IS NOT NULL AND deposit_certificate_number != '' THEN 'protected' ELSE 'unprotected' END as s, COUNT(*)::int as count FROM tenancy WHERE deposit_amount IS NOT NULL AND status = 'active' GROUP BY s"),
      pool.query("SELECT CASE WHEN expiry_date < CURRENT_DATE THEN 'expired' WHEN expiry_date < CURRENT_DATE + INTERVAL '30 days' THEN 'expiring_soon' ELSE 'valid' END as s, COUNT(*)::int as count FROM property_certificate GROUP BY s"),
      pool.query("SELECT COUNT(*)::int as active_cases, COALESCE(SUM(amount), 0)::numeric as total_outstanding FROM arrears WHERE status = 'active'"),
      pool.query("SELECT COUNT(*)::int as count FROM tenancy WHERE end_date BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '90 days' AND status = 'active'"),
      pool.query("SELECT COUNT(*)::int as count FROM maintenance_ticket WHERE status IN ('new', 'assigned', 'in_progress', 'awaiting_parts')")
    ]);

    const tenancies: Record<string, number> = { active: 0, pending: 0, ending: 0, closed: 0 };
    for (const r of tenancyR.rows) { if (r.status in tenancies) tenancies[r.status] = r.count; }

    const rent: Record<string, { count: number; total: number }> = { paid: { count: 0, total: 0 }, pending: { count: 0, total: 0 }, overdue: { count: 0, total: 0 } };
    for (const r of rentR.rows) { if (r.status in rent) rent[r.status] = { count: r.count, total: parseFloat(r.total) }; }

    const deposits: Record<string, number> = { protected: 0, unprotected: 0 };
    for (const r of depositR.rows) { deposits[r.s] = r.count; }

    const compliance: Record<string, number> = { valid: 0, expiring_soon: 0, expired: 0 };
    for (const r of complianceR.rows) { compliance[r.s] = r.count; }

    res.json({
      activeTenancies: tenancies.active,
      pendingTenancies: tenancies.pending,
      rentCollectedThisMonth: rent.paid.total,
      rentOutstandingThisMonth: rent.pending.total + rent.overdue.total,
      depositsProtected: deposits.protected,
      depositsUnprotected: deposits.unprotected,
      complianceValid: compliance.valid,
      complianceExpiring: compliance.expiring_soon,
      complianceExpired: compliance.expired,
      arrearsCases: arrearsR.rows[0]?.active_cases || 0,
      arrearsTotal: parseFloat(arrearsR.rows[0]?.total_outstanding || "0"),
      endingSoon: endingR.rows[0]?.count || 0,
      openMaintenanceTickets: maintenanceR.rows[0]?.count || 0
    });
  } catch (error: any) {
    console.error("Error fetching PM command centre summary:", error);
    res.status(500).json({ error: error.message });
  }
});

// Property-level progress view for PM Command Centre
pmWorkflowRouter.get("/pm-command-centre/property-progress", requireAgent, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        p.id,
        COALESCE(p.address, p.address_line1, p.title) as address,
        p.postcode,
        p.property_type,
        p.bedrooms,

        -- Landlord
        ll.name as landlord_name,

        -- Tenancy info
        tc.id as tenancy_id,
        tc.status as tenancy_status,
        tc.start_date as tenancy_start,
        tc.end_date as tenancy_end,
        tc.rent_amount,
        tc.rent_frequency,
        tc.deposit_amount,
        tc.deposit_certificate_number,
        t.name as tenant_name,

        -- Days until tenancy ends
        CASE
          WHEN tc.end_date IS NOT NULL THEN
            EXTRACT(DAY FROM tc.end_date - CURRENT_DATE)::int
          ELSE NULL
        END as days_until_end,

        -- Deposit status
        CASE
          WHEN tc.deposit_amount IS NULL OR tc.deposit_amount = 0 THEN 'none'
          WHEN tc.deposit_certificate_number IS NOT NULL AND tc.deposit_certificate_number != '' THEN 'protected'
          ELSE 'unprotected'
        END as deposit_status,

        -- Compliance counts
        (SELECT COUNT(*)::int FROM property_certificate pc
         WHERE pc.property_id = p.id AND pc.expiry_date >= CURRENT_DATE) as compliance_valid,
        (SELECT COUNT(*)::int FROM property_certificate pc
         WHERE pc.property_id = p.id AND pc.expiry_date < CURRENT_DATE) as compliance_expired,
        (SELECT COUNT(*)::int FROM property_certificate pc
         WHERE pc.property_id = p.id AND pc.expiry_date BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '30 days') as compliance_expiring,

        -- Maintenance open tickets
        (SELECT COUNT(*)::int FROM maintenance_ticket mt
         WHERE mt.property_id = p.id AND mt.status IN ('new', 'assigned', 'in_progress', 'awaiting_parts')) as open_maintenance,

        -- Rent this month
        (SELECT COALESCE(SUM(CASE WHEN inv.status = 'paid' THEN inv.amount ELSE 0 END), 0)::numeric
         FROM invoice inv WHERE inv.property_id = p.id AND inv.invoice_type = 'rent'
         AND date_trunc('month', inv.due_date) = date_trunc('month', CURRENT_DATE)) as rent_collected,
        (SELECT COALESCE(SUM(CASE WHEN inv.status IN ('pending', 'overdue') THEN inv.amount ELSE 0 END), 0)::numeric
         FROM invoice inv WHERE inv.property_id = p.id AND inv.invoice_type = 'rent'
         AND date_trunc('month', inv.due_date) = date_trunc('month', CURRENT_DATE)) as rent_outstanding,

        -- Arrears
        (SELECT COALESCE(SUM(arr.amount), 0)::numeric FROM arrears arr
         WHERE arr.property_id = p.id AND arr.status = 'active') as arrears_amount

      FROM property p
      LEFT JOIN landlord ll ON p.landlord_id = ll.id
      LEFT JOIN tenancy_contract tc ON tc.property_id = p.id
        AND tc.status IN ('active', 'pending', 'ending')
      LEFT JOIN tenant t ON tc.tenant_id = t.id
      WHERE p.is_managed = true
      ORDER BY
        CASE
          WHEN tc.status IS NULL THEN 2
          ELSE 0
        END,
        p.address ASC NULLS LAST, p.address_line1 ASC NULLS LAST
    `);

    res.json(result.rows);
  } catch (error: any) {
    console.error("Error fetching property progress:", error);
    res.status(500).json({ error: error.message });
  }
});

pmWorkflowRouter.get("/tenancy-expiry/calendar", requireAgent, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        tc.id,
        tc.property_id,
        tc.landlord_id,
        tc.tenant_id,
        tc.start_date,
        tc.end_date,
        tc.period_months,
        tc.is_periodic,
        tc.rent_amount,
        tc.rent_frequency,
        tc.status,
        COALESCE(p.address, p.address_line1, p.title) as property_address,
        p.postcode as property_postcode,
        t.name as tenant_name,
        t.email as tenant_email,
        t.phone as tenant_phone,
        ll.name as landlord_name,
        CASE
          WHEN tc.end_date IS NULL THEN 'periodic'
          WHEN tc.end_date < CURRENT_DATE THEN 'expired'
          WHEN tc.end_date < CURRENT_DATE + INTERVAL '30 days' THEN 'critical'
          WHEN tc.end_date < CURRENT_DATE + INTERVAL '60 days' THEN 'warning'
          WHEN tc.end_date < CURRENT_DATE + INTERVAL '90 days' THEN 'upcoming'
          ELSE 'active'
        END as urgency
      FROM tenancy_contract tc
      LEFT JOIN property p ON tc.property_id = p.id
      LEFT JOIN tenant t ON tc.tenant_id = t.id
      LEFT JOIN landlord ll ON tc.landlord_id = ll.id
      ORDER BY tc.end_date ASC NULLS LAST
    `);

    res.json(result.rows);
  } catch (error: any) {
    console.error("Error fetching tenancy expiry calendar:", error);
    res.status(500).json({ error: error.message });
  }
});

// Per-property rent-to-payment lifecycle for current month
pmWorkflowRouter.get("/pm-command-centre/rent-lifecycle", requireAgent, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        p.id as property_id,
        COALESCE(p.address, p.address_line1, p.title) as property_name,
        p.postcode,
        p.management_fee_type,
        p.management_fee_value,

        -- Landlord & bank details
        ll.id as landlord_id,
        ll.name as landlord_name,
        ll.email as landlord_email,
        ll.bank_name,
        ll.bank_account_number,
        ll.bank_sort_code,
        ll.bank_account_holder_name,

        -- Tenant
        t.name as tenant_name,
        tc.rent_amount,
        tc.rent_frequency,

        -- Rent invoice this month
        inv.id as invoice_id,
        inv.status as invoice_status,
        inv.amount as invoice_amount,
        inv.paid_date as invoice_paid_date,

        -- Bank transaction match for this invoice
        bt.id as bank_transaction_id,
        bt.transaction_date as bank_transaction_date,
        bt.amount as bank_transaction_amount,
        bt.description as bank_transaction_description,
        bt.match_status as bank_match_status,

        -- Maintenance charges this month (charged to landlord)
        (SELECT COALESCE(SUM(mt.actual_cost), 0)::int
         FROM maintenance_ticket mt
         WHERE mt.property_id = p.id
           AND mt.status IN ('completed', 'closed')
           AND mt.actual_cost > 0
           AND date_trunc('month', mt.resolved_at) = date_trunc('month', CURRENT_DATE)
        ) as maintenance_charges,

        (SELECT COUNT(*)::int
         FROM maintenance_ticket mt
         WHERE mt.property_id = p.id
           AND mt.status IN ('completed', 'closed')
           AND mt.actual_cost > 0
           AND date_trunc('month', mt.resolved_at) = date_trunc('month', CURRENT_DATE)
        ) as maintenance_ticket_count,

        -- Landlord statement this month
        ls.id as statement_id,
        ls.status as statement_status,
        ls.total_rent_collected as statement_rent,
        ls.management_fees as statement_commission,
        ls.vat_on_fees as statement_vat,
        ls.maintenance_deductions as statement_maintenance,
        ls.other_deductions as statement_other,
        ls.net_payable as statement_net,
        ls.sent_at as statement_sent_at,
        ls.paid_at as statement_paid_at,
        ls.payment_reference as statement_payment_ref,

        -- GoCardless mandate
        gm.id as mandate_id,
        gm.status as mandate_status

      FROM property p
      LEFT JOIN landlord ll ON p.landlord_id = ll.id
      LEFT JOIN tenancy_contract tc ON tc.property_id = p.id
        AND tc.status IN ('active', 'pending', 'ending')
      LEFT JOIN tenant t ON tc.tenant_id = t.id

      -- Current month rent invoice
      LEFT JOIN LATERAL (
        SELECT inv2.id, inv2.status, inv2.amount, inv2.paid_date, inv2.payment_id
        FROM invoice inv2
        WHERE inv2.property_id = p.id
          AND inv2.invoice_type = 'rent'
          AND date_trunc('month', inv2.due_date) = date_trunc('month', CURRENT_DATE)
        ORDER BY inv2.due_date DESC
        LIMIT 1
      ) inv ON true

      -- Matched bank transaction
      LEFT JOIN bank_transaction bt ON bt.matched_invoice_id = inv.id
        AND bt.match_status IN ('auto_matched', 'manually_matched')

      -- Landlord statement this month
      LEFT JOIN LATERAL (
        SELECT ls2.*
        FROM landlord_statement ls2
        WHERE ls2.landlord_id = ll.id
          AND date_trunc('month', ls2.statement_period_start) = date_trunc('month', CURRENT_DATE)
        ORDER BY ls2.created_at DESC
        LIMIT 1
      ) ls ON true

      -- GoCardless mandate for landlord (outbound payout)
      LEFT JOIN LATERAL (
        SELECT gm2.id, gm2.status
        FROM gocardless_mandate gm2
        WHERE gm2.landlord_id = ll.id
          AND gm2.status = 'active'
        ORDER BY gm2.created_at DESC
        LIMIT 1
      ) gm ON true

      WHERE p.is_managed = true
      ORDER BY p.address ASC NULLS LAST, p.address_line1 ASC NULLS LAST
    `);

    res.json(result.rows);
  } catch (error: any) {
    console.error("Error fetching rent lifecycle:", error);
    res.status(500).json({ error: error.message });
  }
});
