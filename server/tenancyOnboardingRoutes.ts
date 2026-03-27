import { Router } from "express";
import { pool } from "./db";
import { emailService } from "./emailService";
import { onboardingStepTypes, onboardingStepLabels, onboardingStepDescriptions } from "@shared/schema";

export const tenancyOnboardingRouter = Router();

const requireAgent = (req: any, res: any, next: any) => {
  if (!req.user) return res.status(401).json({ error: "Not authenticated" });
  if (req.user.role !== "admin" && req.user.role !== "agent") return res.status(403).json({ error: "Not authorized" });
  next();
};

// ============================================================
// GET all onboarding pipelines (with summary)
// ============================================================
tenancyOnboardingRouter.get("/tenancy-onboarding", requireAgent, async (req, res) => {
  try {
    const { status } = req.query;
    let query = `
      SELECT o.*,
        t.name as tenant_name, t.email as tenant_email, t.phone as tenant_phone,
        p.address as property_address, p.postcode as property_postcode,
        l.name as landlord_name, l.email as landlord_email,
        u.full_name as agent_name,
        (SELECT COUNT(*)::int FROM tenancy_onboarding_step s WHERE s.onboarding_id = o.id AND s.status = 'completed') as steps_completed,
        (SELECT COUNT(*)::int FROM tenancy_onboarding_step s WHERE s.onboarding_id = o.id) as steps_total
      FROM tenancy_onboarding o
      LEFT JOIN tenant t ON t.id = o.tenant_id
      LEFT JOIN property p ON p.id = o.property_id
      LEFT JOIN landlord l ON l.id = o.landlord_id
      LEFT JOIN "user" u ON u.id = o.assigned_agent_id
    `;
    const params: any[] = [];
    if (status) {
      query += ` WHERE o.status = $1`;
      params.push(status);
    }
    query += ` ORDER BY o.created_at DESC`;

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (error: any) {
    console.error("Error fetching onboarding pipelines:", error);
    res.status(500).json({ error: error.message });
  }
});

// ============================================================
// GET single onboarding pipeline with all steps
// ============================================================
tenancyOnboardingRouter.get("/tenancy-onboarding/:id", requireAgent, async (req, res) => {
  try {
    const { id } = req.params;

    const onboardingResult = await pool.query(`
      SELECT o.*,
        t.name as tenant_name, t.email as tenant_email, t.phone as tenant_phone, t.status as tenant_status,
        p.address as property_address, p.postcode as property_postcode, p.rent_amount as property_rent,
        p.management_fee_type, p.management_fee_value,
        l.name as landlord_name, l.email as landlord_email, l.phone as landlord_phone,
        u.full_name as agent_name, u.email as agent_email
      FROM tenancy_onboarding o
      LEFT JOIN tenant t ON t.id = o.tenant_id
      LEFT JOIN property p ON p.id = o.property_id
      LEFT JOIN landlord l ON l.id = o.landlord_id
      LEFT JOIN "user" u ON u.id = o.assigned_agent_id
      WHERE o.id = $1
    `, [id]);

    if (onboardingResult.rows.length === 0) {
      return res.status(404).json({ error: "Onboarding not found" });
    }

    const stepsResult = await pool.query(`
      SELECT s.*,
        u.full_name as assigned_to_name,
        cu.full_name as completed_by_name
      FROM tenancy_onboarding_step s
      LEFT JOIN "user" u ON u.id = s.assigned_to_id
      LEFT JOIN "user" cu ON cu.id = s.completed_by_id
      WHERE s.onboarding_id = $1
      ORDER BY s.step_order ASC
    `, [id]);

    res.json({
      ...onboardingResult.rows[0],
      steps: stepsResult.rows,
    });
  } catch (error: any) {
    console.error("Error fetching onboarding:", error);
    res.status(500).json({ error: error.message });
  }
});

// ============================================================
// POST - Start new onboarding pipeline
// Accepts tenantId (required). Property and landlord assigned later.
// If tenant was just created, register_applicant step is auto-completed.
// ============================================================
tenancyOnboardingRouter.post("/tenancy-onboarding", requireAgent, async (req, res) => {
  const client = await pool.connect();
  try {
    const { tenantId, propertyId, landlordId, assignedAgentId, notes } = req.body;
    const userId = (req as any).user?.id;

    if (!tenantId) {
      return res.status(400).json({ error: "tenantId is required" });
    }

    // Verify tenant exists
    const tenantCheck = await client.query(`SELECT id, name, status FROM tenant WHERE id = $1`, [tenantId]);
    if (tenantCheck.rows.length === 0) {
      return res.status(400).json({ error: "Tenant not found" });
    }

    await client.query("BEGIN");

    // Set tenant status to 'applicant' if not already active
    await client.query(
      `UPDATE tenant SET status = 'applicant', updated_at = NOW() WHERE id = $1 AND status NOT IN ('applicant', 'active')`,
      [tenantId]
    );

    // Create onboarding record (propertyId and landlordId are optional)
    const onboardingResult = await client.query(`
      INSERT INTO tenancy_onboarding (property_id, landlord_id, tenant_id, assigned_agent_id, status, current_step, notes)
      VALUES ($1, $2, $3, $4, 'in_progress', 'collect_documents', $5)
      RETURNING *
    `, [propertyId || null, landlordId || null, tenantId, assignedAgentId || null, notes || null]);

    const onboarding = onboardingResult.rows[0];

    // Create all steps
    for (let i = 0; i < onboardingStepTypes.length; i++) {
      const stepType = onboardingStepTypes[i];
      const isFirstStep = stepType === 'register_applicant';
      const isSecondStep = stepType === 'collect_documents';

      await client.query(`
        INSERT INTO tenancy_onboarding_step (onboarding_id, step_type, step_order, status, assigned_to_id, completed_at, completed_by_id)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
      `, [
        onboarding.id,
        stepType,
        i + 1,
        isFirstStep ? 'completed' : isSecondStep ? 'in_progress' : 'pending',
        assignedAgentId || null,
        isFirstStep ? new Date() : null,
        isFirstStep ? userId : null,
      ]);
    }

    await client.query("COMMIT");

    // Send notification
    await sendOnboardingNotification(onboarding.id, 'register_applicant');

    // Return full onboarding with steps
    const result = await pool.query(`
      SELECT o.*, t.name as tenant_name, t.email as tenant_email,
        p.address as property_address, l.name as landlord_name
      FROM tenancy_onboarding o
      LEFT JOIN tenant t ON t.id = o.tenant_id
      LEFT JOIN property p ON p.id = o.property_id
      LEFT JOIN landlord l ON l.id = o.landlord_id
      WHERE o.id = $1
    `, [onboarding.id]);

    const steps = await pool.query(
      `SELECT * FROM tenancy_onboarding_step WHERE onboarding_id = $1 ORDER BY step_order`,
      [onboarding.id]
    );

    res.json({ ...result.rows[0], steps: steps.rows });
  } catch (error: any) {
    await client.query("ROLLBACK");
    console.error("Error creating onboarding:", error);
    res.status(500).json({ error: error.message });
  } finally {
    client.release();
  }
});

// ============================================================
// PATCH - Complete a step and advance the pipeline
// ============================================================
tenancyOnboardingRouter.patch("/tenancy-onboarding/:id/steps/:stepId", requireAgent, async (req, res) => {
  const client = await pool.connect();
  try {
    const { id, stepId } = req.params;
    const { status, stepData, notes } = req.body;
    const userId = (req as any).user?.id;

    await client.query("BEGIN");

    // Get the step
    const stepResult = await client.query(
      `SELECT * FROM tenancy_onboarding_step WHERE id = $1 AND onboarding_id = $2`,
      [stepId, id]
    );
    if (stepResult.rows.length === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "Step not found" });
    }

    const step = stepResult.rows[0];

    // Update step
    const updateFields: string[] = [];
    const updateValues: any[] = [];
    let paramCount = 1;

    if (status) {
      updateFields.push(`status = $${paramCount++}`);
      updateValues.push(status);
      if (status === 'completed') {
        updateFields.push(`completed_at = NOW()`);
        updateFields.push(`completed_by_id = $${paramCount++}`);
        updateValues.push(userId);
      }
    }
    if (stepData !== undefined) {
      updateFields.push(`step_data = $${paramCount++}`);
      updateValues.push(JSON.stringify(stepData));
    }
    if (notes !== undefined) {
      updateFields.push(`notes = $${paramCount++}`);
      updateValues.push(notes);
    }
    updateFields.push(`updated_at = NOW()`);
    updateValues.push(stepId);

    await client.query(
      `UPDATE tenancy_onboarding_step SET ${updateFields.join(', ')} WHERE id = $${paramCount}`,
      updateValues
    );

    // If step completed, handle side effects and advance pipeline
    if (status === 'completed') {
      await handleStepCompletion(client, parseInt(id), step.step_type, stepData, userId);

      // Advance to next step
      const nextStep = await client.query(
        `SELECT * FROM tenancy_onboarding_step WHERE onboarding_id = $1 AND step_order = $2`,
        [id, step.step_order + 1]
      );

      if (nextStep.rows.length > 0) {
        await client.query(
          `UPDATE tenancy_onboarding_step SET status = 'in_progress', updated_at = NOW() WHERE id = $1`,
          [nextStep.rows[0].id]
        );
        await client.query(
          `UPDATE tenancy_onboarding SET current_step = $1, updated_at = NOW() WHERE id = $2`,
          [nextStep.rows[0].step_type, id]
        );
      } else {
        // All steps done - mark onboarding complete
        await client.query(
          `UPDATE tenancy_onboarding SET status = 'completed', current_step = 'completed', completed_at = NOW(), updated_at = NOW() WHERE id = $1`,
          [id]
        );
      }
    }

    await client.query("COMMIT");

    // Send notification for completed step
    if (status === 'completed') {
      await sendOnboardingNotification(parseInt(id), step.step_type);
    }

    // Return updated onboarding
    const updatedResult = await pool.query(`
      SELECT o.*, t.name as tenant_name, p.address as property_address, l.name as landlord_name
      FROM tenancy_onboarding o
      LEFT JOIN tenant t ON t.id = o.tenant_id
      LEFT JOIN property p ON p.id = o.property_id
      LEFT JOIN landlord l ON l.id = o.landlord_id
      WHERE o.id = $1
    `, [id]);

    const steps = await pool.query(
      `SELECT * FROM tenancy_onboarding_step WHERE onboarding_id = $1 ORDER BY step_order`,
      [id]
    );

    res.json({ ...updatedResult.rows[0], steps: steps.rows });
  } catch (error: any) {
    await client.query("ROLLBACK");
    console.error("Error updating step:", error);
    res.status(500).json({ error: error.message });
  } finally {
    client.release();
  }
});

// ============================================================
// PATCH - Update onboarding status (cancel, put on hold, etc.)
// ============================================================
tenancyOnboardingRouter.patch("/tenancy-onboarding/:id", requireAgent, async (req, res) => {
  try {
    const { id } = req.params;
    const { status, assignedAgentId, notes } = req.body;

    const updateFields: string[] = [];
    const updateValues: any[] = [];
    let paramCount = 1;

    if (status) {
      updateFields.push(`status = $${paramCount++}`);
      updateValues.push(status);
    }
    if (assignedAgentId !== undefined) {
      updateFields.push(`assigned_agent_id = $${paramCount++}`);
      updateValues.push(assignedAgentId);
    }
    if (notes !== undefined) {
      updateFields.push(`notes = $${paramCount++}`);
      updateValues.push(notes);
    }
    updateFields.push(`updated_at = NOW()`);
    updateValues.push(id);

    const result = await pool.query(
      `UPDATE tenancy_onboarding SET ${updateFields.join(', ')} WHERE id = $${paramCount} RETURNING *`,
      updateValues
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Onboarding not found" });
    }

    res.json(result.rows[0]);
  } catch (error: any) {
    console.error("Error updating onboarding:", error);
    res.status(500).json({ error: error.message });
  }
});

// ============================================================
// GET - Onboarding dashboard summary
// ============================================================
tenancyOnboardingRouter.get("/tenancy-onboarding-summary", requireAgent, async (req, res) => {
  try {
    const summaryResult = await pool.query(`
      SELECT
        COUNT(*)::int as total,
        COUNT(*) FILTER (WHERE status = 'in_progress')::int as in_progress,
        COUNT(*) FILTER (WHERE status = 'completed')::int as completed,
        COUNT(*) FILTER (WHERE status = 'on_hold')::int as on_hold,
        COUNT(*) FILTER (WHERE status = 'cancelled')::int as cancelled
      FROM tenancy_onboarding
    `);

    const stepStats = await pool.query(`
      SELECT s.step_type,
        COUNT(*) FILTER (WHERE s.status = 'completed')::int as completed,
        COUNT(*) FILTER (WHERE s.status = 'in_progress')::int as in_progress,
        COUNT(*) FILTER (WHERE s.status = 'pending')::int as pending,
        COUNT(*) FILTER (WHERE s.status = 'blocked')::int as blocked
      FROM tenancy_onboarding_step s
      JOIN tenancy_onboarding o ON o.id = s.onboarding_id
      WHERE o.status = 'in_progress'
      GROUP BY s.step_type
      ORDER BY MIN(s.step_order)
    `);

    res.json({
      summary: summaryResult.rows[0],
      stepStats: stepStats.rows,
    });
  } catch (error: any) {
    console.error("Error fetching onboarding summary:", error);
    res.status(500).json({ error: error.message });
  }
});

// ============================================================
// Helper: Handle side effects when a step completes
// ============================================================
async function handleStepCompletion(
  client: any,
  onboardingId: number,
  stepType: string,
  stepData: any,
  userId: number
) {
  const ob = await client.query(
    `SELECT * FROM tenancy_onboarding WHERE id = $1`,
    [onboardingId]
  );
  if (ob.rows.length === 0) return;
  const onboarding = ob.rows[0];

  switch (stepType) {
    case 'allocate_property':
      // Step 4: Assign property and landlord to the onboarding
      if (stepData?.propertyId && stepData?.landlordId) {
        await client.query(
          `UPDATE tenancy_onboarding SET property_id = $1, landlord_id = $2, updated_at = NOW() WHERE id = $3`,
          [stepData.propertyId, stepData.landlordId, onboardingId]
        );
        // Also update tenant's property/landlord reference
        await client.query(
          `UPDATE tenant SET property_id = $1, landlord_id = $2, updated_at = NOW() WHERE id = $3`,
          [stepData.propertyId, stepData.landlordId, onboarding.tenant_id]
        );
      }
      break;

    case 'landlord_approval':
      // Step 5: Change tenant status from applicant to active
      await client.query(
        `UPDATE tenant SET status = 'active', updated_at = NOW() WHERE id = $1`,
        [onboarding.tenant_id]
      );
      break;

    case 'confirm_start_date':
      // Step 6: Create tenancy record if stepData has the details
      if (stepData?.startDate && stepData?.rentAmount) {
        const tenancyResult = await client.query(`
          INSERT INTO tenancy (property_id, landlord_id, tenant_id, start_date, end_date, period_months,
            rent_amount, rent_frequency, rent_due_day, deposit_amount, status)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'active')
          RETURNING id
        `, [
          onboarding.property_id,
          onboarding.landlord_id,
          onboarding.tenant_id,
          stepData.startDate,
          stepData.endDate || null,
          stepData.periodMonths || 12,
          stepData.rentAmount,
          stepData.rentFrequency || 'monthly',
          stepData.rentDueDay || 1,
          stepData.depositAmount || null,
        ]);
        await client.query(
          `UPDATE tenancy_onboarding SET tenancy_id = $1, updated_at = NOW() WHERE id = $2`,
          [tenancyResult.rows[0].id, onboardingId]
        );
        await client.query(
          `UPDATE tenant SET property_id = $1, landlord_id = $2, move_in_date = $3, updated_at = NOW() WHERE id = $4`,
          [onboarding.property_id, onboarding.landlord_id, stepData.startDate, onboarding.tenant_id]
        );
      }
      break;

    case 'record_rent':
      if (onboarding.tenancy_id && stepData?.rentAmount) {
        await client.query(`
          UPDATE tenancy SET rent_amount = $1, rent_frequency = $2, rent_due_day = $3, updated_at = NOW()
          WHERE id = $4
        `, [
          stepData.rentAmount,
          stepData.rentFrequency || 'monthly',
          stepData.rentDueDay || 1,
          onboarding.tenancy_id,
        ]);
      }
      break;

    case 'set_commission':
      if (stepData?.commissionType && stepData?.commissionValue) {
        await client.query(`
          UPDATE property SET management_fee_type = $1, management_fee_value = $2, updated_at = NOW()
          WHERE id = $3
        `, [stepData.commissionType, stepData.commissionValue, onboarding.property_id]);
      }
      break;

    case 'record_deposit':
      if (onboarding.tenancy_id && stepData?.depositAmount) {
        await client.query(`
          UPDATE tenancy SET deposit_amount = $1, deposit_scheme = $2, deposit_holder_type = $3, updated_at = NOW()
          WHERE id = $4
        `, [
          stepData.depositAmount,
          stepData.depositScheme || 'DPS',
          stepData.depositHolderType || 'agency_custodial',
          onboarding.tenancy_id,
        ]);
      }
      break;

    case 'protect_deposit':
      if (onboarding.tenancy_id && stepData?.certificateNumber) {
        await client.query(`
          UPDATE tenancy SET deposit_certificate_number = $1, deposit_protected_date = NOW(), updated_at = NOW()
          WHERE id = $2
        `, [stepData.certificateNumber, onboarding.tenancy_id]);
      }
      break;

    case 'receive_dps_certificate':
      if (onboarding.tenancy_id && stepData?.documentUrl) {
        await client.query(`
          INSERT INTO document (name, document_type, entity_type, entity_id, tenancy_id, property_id, landlord_id, tenant_id,
            storage_url, status, uploaded_by)
          VALUES ('DPS Certificate', 'deposit_certificate', 'tenancy', $1, $1, $2, $3, $4, $5, 'active', $6)
        `, [
          onboarding.tenancy_id,
          onboarding.property_id,
          onboarding.landlord_id,
          onboarding.tenant_id,
          stepData.documentUrl,
          userId,
        ]);
      }
      break;
  }
}

// ============================================================
// Helper: Send email notifications for onboarding events
// ============================================================
async function sendOnboardingNotification(onboardingId: number, stepType: string) {
  try {
    const result = await pool.query(`
      SELECT o.*,
        t.name as tenant_name, t.email as tenant_email,
        p.address as property_address, p.postcode as property_postcode,
        l.name as landlord_name, l.email as landlord_email,
        u.full_name as agent_name, u.email as agent_email
      FROM tenancy_onboarding o
      LEFT JOIN tenant t ON t.id = o.tenant_id
      LEFT JOIN property p ON p.id = o.property_id
      LEFT JOIN landlord l ON l.id = o.landlord_id
      LEFT JOIN "user" u ON u.id = o.assigned_agent_id
      WHERE o.id = $1
    `, [onboardingId]);

    if (result.rows.length === 0) return;
    const data = result.rows[0];

    const propertyAddr = [data.property_address, data.property_postcode].filter(Boolean).join(', ') || 'Property TBA';

    switch (stepType) {
      case 'register_applicant':
        if (data.agent_email) {
          await emailService.sendEmail(
            data.agent_email,
            `New Tenancy Applicant - ${data.tenant_name || 'New Applicant'}`,
            `<h2>New Tenancy Applicant Registered</h2>
            <p>A new applicant has been registered in the onboarding pipeline.</p>
            <p><strong>Applicant:</strong> ${data.tenant_name || 'N/A'}<br/>
            <strong>Email:</strong> ${data.tenant_email || 'N/A'}<br/>
            <strong>Property:</strong> ${propertyAddr}</p>
            <p>Please log in to the CRM to review and proceed with the tenancy onboarding.</p>
            <p>Kind regards,<br/>John Barclay CRM</p>`
          );
        }
        break;

      case 'allocate_property':
        if (data.landlord_email) {
          await emailService.sendEmail(
            data.landlord_email,
            `Tenancy Applicant Allocated - ${propertyAddr}`,
            `<h2>Tenancy Applicant Allocated to Your Property</h2>
            <p>Dear ${data.landlord_name},</p>
            <p>An applicant has been allocated to your property at <strong>${propertyAddr}</strong>.</p>
            <p><strong>Applicant:</strong> ${data.tenant_name || 'N/A'}</p>
            <p>Your agent ${data.agent_name || 'at John Barclay'} will be in touch to discuss the application and seek your approval.</p>
            <p>Kind regards,<br/>John Barclay Property Management</p>`
          );
        }
        break;

      case 'landlord_approval':
        if (data.tenant_email) {
          await emailService.sendEmail(
            data.tenant_email,
            `Tenancy Application Approved - ${propertyAddr}`,
            `<h2>Your Tenancy Application Has Been Approved</h2>
            <p>Dear ${data.tenant_name},</p>
            <p>We're pleased to inform you that your application for <strong>${propertyAddr}</strong> has been approved by the landlord.</p>
            <p>Your agent ${data.agent_name || 'at John Barclay'} will be in touch shortly to confirm the move-in date and next steps.</p>
            <p>Kind regards,<br/>John Barclay Property Management</p>`
          );
        }
        break;

      case 'sign_contracts':
        if (data.landlord_email) {
          await emailService.sendEmail(
            data.landlord_email,
            `Tenancy Contracts Signed - ${propertyAddr}`,
            `<h2>Tenancy Contracts Signed</h2>
            <p>Dear ${data.landlord_name},</p>
            <p>All tenancy contracts for <strong>${propertyAddr}</strong> have been signed by all parties.</p>
            <p>Tenant: ${data.tenant_name || 'N/A'}</p>
            <p>Kind regards,<br/>John Barclay Property Management</p>`
          );
        }
        break;

      case 'protect_deposit':
        if (data.tenant_email) {
          await emailService.sendEmail(
            data.tenant_email,
            `Deposit Protected - ${propertyAddr}`,
            `<h2>Your Deposit Has Been Protected</h2>
            <p>Dear ${data.tenant_name},</p>
            <p>We can confirm that your deposit for <strong>${propertyAddr}</strong> has been registered with the Deposit Protection Scheme.</p>
            <p>You will receive a copy of the Deposit Certificate from DPS directly.</p>
            <p>Kind regards,<br/>John Barclay Property Management</p>`
          );
        }
        break;
    }

    // Mark notification as sent on the step
    await pool.query(
      `UPDATE tenancy_onboarding_step SET notification_sent = true, notification_sent_at = NOW()
       WHERE onboarding_id = $1 AND step_type = $2`,
      [onboardingId, stepType]
    );

  } catch (error) {
    console.error("Error sending onboarding notification:", error);
  }
}
