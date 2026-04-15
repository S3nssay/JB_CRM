import { Router } from 'express';
import { pool } from './db';
import { generateLetterPDF, AVAILABLE_MERGE_FIELDS } from './lib/pdfLetterGenerator';
import { generateTenancyAgreement } from './lib/tenancyAgreementGenerator';

export const letterRouter = Router();

// ==========================================
// LETTER TEMPLATES
// ==========================================

// GET /letter-templates - list all (optional ?category= filter)
letterRouter.get('/letter-templates', async (req, res) => {
  try {
    const { category } = req.query;
    let query = 'SELECT * FROM letter_templates WHERE 1=1';
    const params: unknown[] = [];
    if (category) {
      params.push(category);
      query += ` AND category = $${params.length}`;
    }
    query += ' ORDER BY created_at DESC';
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching letter templates:', error);
    res.status(500).json({ error: 'Failed to fetch letter templates' });
  }
});

// GET /letter-templates/:id - single
letterRouter.get('/letter-templates/:id', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM letter_templates WHERE id = $1', [req.params.id]);
    if (!result.rows[0]) return res.status(404).json({ error: 'Template not found' });
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error fetching letter template:', error);
    res.status(500).json({ error: 'Failed to fetch letter template' });
  }
});

// POST /letter-templates - create
letterRouter.post('/letter-templates', async (req, res) => {
  try {
    const { name, category, subject, bodyHtml, mergeFields, isActive, createdBy } = req.body;
    if (!name || !category || !bodyHtml) {
      return res.status(400).json({ error: 'name, category, and bodyHtml are required' });
    }
    const result = await pool.query(
      `INSERT INTO letter_templates (name, category, subject, body_html, merge_fields, is_active, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [name, category, subject ?? null, bodyHtml, mergeFields ?? null, isActive ?? true, createdBy ?? null]
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error creating letter template:', error);
    res.status(500).json({ error: 'Failed to create letter template' });
  }
});

// PUT /letter-templates/:id - update
letterRouter.put('/letter-templates/:id', async (req, res) => {
  try {
    const { name, category, subject, bodyHtml, mergeFields, isActive } = req.body;
    const result = await pool.query(
      `UPDATE letter_templates
       SET name = COALESCE($1, name),
           category = COALESCE($2, category),
           subject = COALESCE($3, subject),
           body_html = COALESCE($4, body_html),
           merge_fields = COALESCE($5, merge_fields),
           is_active = COALESCE($6, is_active),
           updated_at = NOW()
       WHERE id = $7
       RETURNING *`,
      [name ?? null, category ?? null, subject ?? null, bodyHtml ?? null, mergeFields ?? null, isActive ?? null, req.params.id]
    );
    if (!result.rows[0]) return res.status(404).json({ error: 'Template not found' });
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating letter template:', error);
    res.status(500).json({ error: 'Failed to update letter template' });
  }
});

// DELETE /letter-templates/:id - delete
letterRouter.delete('/letter-templates/:id', async (req, res) => {
  try {
    const result = await pool.query('DELETE FROM letter_templates WHERE id = $1 RETURNING id', [req.params.id]);
    if (!result.rows[0]) return res.status(404).json({ error: 'Template not found' });
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting letter template:', error);
    res.status(500).json({ error: 'Failed to delete letter template' });
  }
});

// ==========================================
// MERGE FIELDS
// ==========================================

// GET /letter-merge-fields - return available merge field names
letterRouter.get('/letter-merge-fields', (_req, res) => {
  res.json(AVAILABLE_MERGE_FIELDS);
});

// ==========================================
// PDF GENERATION
// ==========================================

// POST /letter-templates/:id/generate - generate PDF for a template
letterRouter.post('/letter-templates/:id/generate', async (req, res) => {
  try {
    const { tenantId, landlordId, propertyId } = req.body;

    // Fetch template
    const templateResult = await pool.query('SELECT * FROM letter_templates WHERE id = $1', [req.params.id]);
    if (!templateResult.rows[0]) return res.status(404).json({ error: 'Template not found' });
    const template = templateResult.rows[0];

    // Build merge data from optional entity IDs
    const mergeData: Record<string, string | number | undefined> = {
      today_date: new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }),
    };

    let recipientAddress: string | undefined;

    if (tenantId) {
      const tenantResult = await pool.query(
        'SELECT id, name, email, phone, address FROM tenant WHERE id = $1',
        [tenantId]
      );
      if (tenantResult.rows[0]) {
        const t = tenantResult.rows[0];
        mergeData['tenant_name'] = t.name;
        mergeData['tenant_email'] = t.email;
        mergeData['tenant_phone'] = t.phone;
        recipientAddress = t.address ?? undefined;
      }
    }

    if (landlordId) {
      const landlordResult = await pool.query(
        'SELECT id, name, email, phone, mobile, address FROM landlords WHERE id = $1',
        [landlordId]
      );
      if (landlordResult.rows[0]) {
        const l = landlordResult.rows[0];
        mergeData['landlord_name'] = l.name;
        mergeData['landlord_email'] = l.email;
        mergeData['landlord_phone'] = l.phone ?? l.mobile;
        if (!tenantId) recipientAddress = l.address ?? undefined;
      }
    }

    if (propertyId) {
      const propResult = await pool.query(
        'SELECT id, address, postcode, rent_amount, rent_period FROM properties WHERE id = $1',
        [propertyId]
      );
      if (propResult.rows[0]) {
        const p = propResult.rows[0];
        mergeData['property_address'] = p.address;
        mergeData['property_postcode'] = p.postcode;
        mergeData['rent_amount'] = p.rent_amount ? `£${(Number(p.rent_amount) / 100).toFixed(2)}` : undefined;
        mergeData['rent_period'] = p.rent_period;
      }
    }

    const pdfBuffer = await generateLetterPDF(template.body_html, mergeData, {
      subject: template.subject ?? undefined,
      recipientAddress,
    });

    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="letter-${req.params.id}.pdf"`,
      'Content-Length': pdfBuffer.length,
    });
    res.end(pdfBuffer);
  } catch (error) {
    console.error('Error generating letter PDF:', error);
    res.status(500).json({ error: 'Failed to generate PDF' });
  }
});

// ==========================================
// ARREARS REMINDER CONFIG
// ==========================================

// GET /arrears-reminder-config - list tiers with template names
letterRouter.get('/arrears-reminder-config', async (_req, res) => {
  try {
    const result = await pool.query(
      `SELECT arc.*, lt.name AS template_name
       FROM arrears_reminder_config arc
       LEFT JOIN letter_templates lt ON arc.template_id = lt.id
       ORDER BY arc.tier ASC`
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching arrears reminder config:', error);
    res.status(500).json({ error: 'Failed to fetch arrears reminder config' });
  }
});

// PUT /arrears-reminder-config/:id - update tier config
letterRouter.put('/arrears-reminder-config/:id', async (req, res) => {
  try {
    const { name, daysOverdue, templateId, sendEmail, sendSms, sendLetter, escalateToManager, isActive } = req.body;
    const result = await pool.query(
      `UPDATE arrears_reminder_config
       SET name = COALESCE($1, name),
           days_overdue = COALESCE($2, days_overdue),
           template_id = COALESCE($3, template_id),
           send_email = COALESCE($4, send_email),
           send_sms = COALESCE($5, send_sms),
           send_letter = COALESCE($6, send_letter),
           escalate_to_manager = COALESCE($7, escalate_to_manager),
           is_active = COALESCE($8, is_active),
           updated_at = NOW()
       WHERE id = $9
       RETURNING *`,
      [
        name ?? null,
        daysOverdue ?? null,
        templateId ?? null,
        sendEmail ?? null,
        sendSms ?? null,
        sendLetter ?? null,
        escalateToManager ?? null,
        isActive ?? null,
        req.params.id,
      ]
    );
    if (!result.rows[0]) return res.status(404).json({ error: 'Config not found' });
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating arrears reminder config:', error);
    res.status(500).json({ error: 'Failed to update arrears reminder config' });
  }
});

// ==========================================
// ARREARS TENANTS
// ==========================================

// GET /arrears-tenants - tenants in arrears
letterRouter.get('/arrears-tenants', async (_req, res) => {
  try {
    const result = await pool.query(
      `SELECT
         a.id AS arrears_id,
         a.amount,
         a.days_overdue,
         a.status AS arrears_status,
         a.dunning_level,
         a.last_reminder_sent,
         a.next_reminder_due,
         t.id AS tenant_id,
         t.name AS tenant_name,
         t.email AS tenant_email,
         t.phone AS tenant_phone,
         p.id AS property_id,
         p.address AS property_address,
         p.postcode AS property_postcode
       FROM arrears a
       JOIN tenant t ON t.id = a.tenant_id
       JOIN properties p ON p.id = a.property_id
       WHERE a.status IN ('active', 'partially_paid')
       ORDER BY a.days_overdue DESC`
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching arrears tenants:', error);
    res.status(500).json({ error: 'Failed to fetch arrears tenants' });
  }
});

// POST /arrears-send-batch - send reminders to a batch of tenants
letterRouter.post('/arrears-send-batch', async (req, res) => {
  try {
    const { tenantIds, tier } = req.body;
    if (!Array.isArray(tenantIds) || tenantIds.length === 0) {
      return res.status(400).json({ error: 'tenantIds array is required' });
    }
    if (tier === undefined || tier === null) {
      return res.status(400).json({ error: 'tier is required' });
    }

    const placeholders = tenantIds.map((_: unknown, i: number) => `$${i + 1}`).join(', ');
    await pool.query(
      `UPDATE arrears
       SET dunning_level = $${tenantIds.length + 1},
           last_reminder_sent = NOW(),
           next_reminder_due = NOW() + INTERVAL '7 days',
           updated_at = NOW()
       WHERE tenant_id IN (${placeholders})
         AND status IN ('active', 'partially_paid')`,
      [...tenantIds, tier]
    );

    res.json({ success: true, updated: tenantIds.length });
  } catch (error) {
    console.error('Error sending arrears batch:', error);
    res.status(500).json({ error: 'Failed to send arrears batch' });
  }
});

// ==========================================
// TENANCY AGREEMENT GENERATION
// ==========================================

// POST /tenancy-agreement/generate - generate AST PDF from a tenancy record
letterRouter.post('/tenancy-agreement/generate', async (req, res) => {
  try {
    const { tenancyId } = req.body;
    if (!tenancyId) return res.status(400).json({ error: 'tenancyId is required' });

    // Fetch tenancy with landlord, tenant and property
    const tenancyResult = await pool.query(
      `SELECT
         tn.id,
         tn.start_date, tn.end_date, tn.period_months,
         tn.rent_amount, tn.rent_frequency,
         tn.deposit_amount, tn.deposit_scheme,
         tn.special_terms,
         t.name AS tenant_name, t.address AS tenant_address,
         l.name AS landlord_name, l.address AS landlord_address,
         p.address AS property_address
       FROM tenancy tn
       LEFT JOIN tenant t ON t.id = tn.tenant_id
       LEFT JOIN landlords l ON l.id = tn.landlord_id
       LEFT JOIN properties p ON p.id = tn.property_id
       WHERE tn.id = $1`,
      [tenancyId]
    );

    if (!tenancyResult.rows[0]) return res.status(404).json({ error: 'Tenancy not found' });
    const row = tenancyResult.rows[0];

    const formatDate = (d: string | null) =>
      d ? new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }) : 'TBC';

    const pdfBuffer = await generateTenancyAgreement({
      landlordName: row.landlord_name ?? 'Unknown Landlord',
      landlordAddress: row.landlord_address ?? '',
      tenantName: row.tenant_name ?? 'Unknown Tenant',
      tenantAddress: row.tenant_address ?? undefined,
      propertyAddress: row.property_address ?? '',
      rentAmount: row.rent_amount ? Math.round(Number(row.rent_amount) * 100) : 0,
      rentPeriod: row.rent_frequency ?? 'month',
      depositAmount: row.deposit_amount ? Math.round(Number(row.deposit_amount) * 100) : 0,
      depositScheme: row.deposit_scheme ?? undefined,
      startDate: formatDate(row.start_date),
      endDate: formatDate(row.end_date),
      periodMonths: row.period_months ?? 12,
      specialTerms: row.special_terms ?? undefined,
    });

    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="tenancy-agreement-${tenancyId}.pdf"`,
      'Content-Length': pdfBuffer.length,
    });
    res.end(pdfBuffer);
  } catch (error) {
    console.error('Error generating tenancy agreement:', error);
    res.status(500).json({ error: 'Failed to generate tenancy agreement' });
  }
});

// ==========================================
// CC RECIPIENTS SEARCH
// ==========================================

// GET /cc-recipients - search landlords, tenants or contractors by name/email
letterRouter.get('/cc-recipients', async (req, res) => {
  try {
    const { type, search } = req.query;
    const searchTerm = search ? `%${String(search).toLowerCase()}%` : '%';

    const results: { id: number; name: string; email: string; entity_type: string }[] = [];

    if (!type || type === 'landlord') {
      const r = await pool.query(
        `SELECT id, name, email, 'landlord' AS entity_type
         FROM landlords
         WHERE (LOWER(name) LIKE $1 OR LOWER(email) LIKE $1)
           AND email IS NOT NULL AND email != ''
         ORDER BY name
         LIMIT 25`,
        [searchTerm]
      );
      results.push(...r.rows);
    }

    if (!type || type === 'tenant') {
      const r = await pool.query(
        `SELECT id, name, email, 'tenant' AS entity_type
         FROM tenant
         WHERE (LOWER(name) LIKE $1 OR LOWER(email) LIKE $1)
           AND email IS NOT NULL AND email != ''
         ORDER BY name
         LIMIT 25`,
        [searchTerm]
      );
      results.push(...r.rows);
    }

    if (!type || type === 'contractor') {
      const r = await pool.query(
        `SELECT id, contact_name AS name, email, 'contractor' AS entity_type
         FROM contractor
         WHERE (LOWER(contact_name) LIKE $1 OR LOWER(email) LIKE $1)
           AND email IS NOT NULL AND email != ''
         ORDER BY contact_name
         LIMIT 25`,
        [searchTerm]
      );
      results.push(...r.rows);
    }

    res.json(results);
  } catch (error) {
    console.error('Error fetching CC recipients:', error);
    res.status(500).json({ error: 'Failed to fetch CC recipients' });
  }
});
