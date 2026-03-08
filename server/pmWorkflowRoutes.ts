import { Router } from "express";
import { pool } from "./db";

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
      "SELECT COUNT(*)::int as active_cases, COALESCE(SUM(amount_outstanding), 0)::numeric as total_outstanding FROM arrears WHERE status = 'active'"
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
    let sql = "SELECT t.id as tenancy_id, t.deposit_amount, t.deposit_scheme, t.deposit_certificate_number, t.deposit_protected_date, t.deposit_holder_type, t.start_date, t.end_date, t.status as tenancy_status, p.address as property_address, p.postcode as property_postcode, te.name as tenant_name, te.email as tenant_email FROM tenancy t LEFT JOIN property p ON t.property_id = p.id LEFT JOIN tenant te ON t.tenant_id = te.id WHERE t.deposit_amount IS NOT NULL";
    const params: any[] = [];

    if (status === "protected") {
      sql += " AND t.deposit_certificate_number IS NOT NULL AND t.deposit_certificate_number != ''";
    } else if (status === "unprotected") {
      sql += " AND (t.deposit_certificate_number IS NULL OR t.deposit_certificate_number = '')";
    }

    sql += " ORDER BY t.created_at DESC";

    const result = await pool.query(sql, params);
    res.json(result.rows);
  } catch (error: any) {
    console.error("Error fetching deposits:", error);
    res.status(500).json({ error: error.message });
  }
});

pmWorkflowRouter.put("/deposits/:tenancyId/protect", requireAgent, async (req, res) => {
  try {
    const { tenancyId } = req.params;
    const { depositScheme, depositCertificateNumber, depositProtectedDate, depositHolderType } = req.body;

    const result = await pool.query(
      "UPDATE tenancy SET deposit_scheme = $1, deposit_certificate_number = $2, deposit_protected_date = $3, deposit_holder_type = $4, updated_at = NOW() WHERE id = $5 RETURNING *",
      [depositScheme, depositCertificateNumber, depositProtectedDate, depositHolderType, tenancyId]
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

pmWorkflowRouter.post("/end-of-tenancy/:tenancyId/start", requireAgent, async (req, res) => {
  try {
    const { tenancyId } = req.params;

    const tenancyResult = await pool.query(
      "UPDATE tenancy SET status = 'ending', updated_at = NOW() WHERE id = $1 RETURNING *",
      [tenancyId]
    );

    if (tenancyResult.rows.length === 0) {
      return res.status(404).json({ error: "Tenancy not found" });
    }

    // Create checkout checklist items
    const checklistItems = [
      "serve_notice",
      "checkout_inspection",
      "inventory_checkout",
      "meter_readings",
      "key_return",
      "deposit_return",
      "final_account",
      "utility_notifications",
      "council_tax_notification",
      "forwarding_address"
    ];

    for (const itemType of checklistItems) {
      await pool.query(
        "INSERT INTO tenancy_checklist_item (tenancy_id, item_type, is_completed) VALUES ($1, $2, false) ON CONFLICT DO NOTHING",
        [tenancyId, itemType]
      );
    }

    const checklist = await pool.query(
      "SELECT * FROM tenancy_checklist_item WHERE tenancy_id = $1 ORDER BY id ASC",
      [tenancyId]
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

pmWorkflowRouter.get("/end-of-tenancy/:tenancyId", requireAgent, async (req, res) => {
  try {
    const { tenancyId } = req.params;

    const tenancyResult = await pool.query(
      "SELECT t.*, p.address as property_address, p.postcode as property_postcode, te.name as tenant_name, te.email as tenant_email, te.phone as tenant_phone, l.name as landlord_name, l.email as landlord_email FROM tenancy t LEFT JOIN property p ON t.property_id = p.id LEFT JOIN tenant te ON t.tenant_id = te.id LEFT JOIN landlord l ON t.landlord_id = l.id WHERE t.id = $1",
      [tenancyId]
    );

    if (tenancyResult.rows.length === 0) {
      return res.status(404).json({ error: "Tenancy not found" });
    }

    const checklistResult = await pool.query(
      "SELECT * FROM tenancy_checklist_item WHERE tenancy_id = $1 ORDER BY id ASC",
      [tenancyId]
    );

    const tenancy = tenancyResult.rows[0];
    const inventoryResult = await pool.query(
      "SELECT * FROM property_inventory WHERE property_id = $1 ORDER BY created_at DESC LIMIT 1",
      [tenancy.property_id]
    );

    res.json({
      tenancy,
      checklist: checklistResult.rows,
      latestInventory: inventoryResult.rows[0] || null
    });
  } catch (error: any) {
    console.error("Error fetching end of tenancy details:", error);
    res.status(500).json({ error: error.message });
  }
});

pmWorkflowRouter.post("/end-of-tenancy/:tenancyId/complete", requireAgent, async (req, res) => {
  try {
    const { tenancyId } = req.params;

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
