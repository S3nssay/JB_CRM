/**
 * Sourcing Approval Service
 *
 * Staff approval workflow for Charlie's outreach drafts.
 * All outreach must be approved before sending. Staff can approve, reject, or edit drafts.
 *
 * CRITICAL: approveOutreach updates approval fields BEFORE triggering send.
 * CRITICAL: rejectOutreach NEVER sends any outreach -- only updates status.
 */

// ============================================================
// Get Pending Approvals
// ============================================================

/**
 * Get all outreach drafts awaiting staff approval.
 * Returns contact history joined with lead details, ordered oldest first.
 */
export async function getPendingApprovals(): Promise<Array<{
  contactHistoryId: number;
  leadId: number;
  channel: string;
  subject: string | null;
  content: string | null;
  pdfUrl: string | null;
  sequenceStep: number | null;
  propertyAddress: string;
  postcode: string;
  ownerName: string | null;
  leadSource: string;
  propensityScore: string | null;
  daysOnMarket: number | null;
  createdAt: Date;
}>> {
  const { pool } = await import('../../db');

  const result = await pool.query(
    `SELECT
       lch.id AS contact_history_id,
       lch.lead_id,
       lch.contact_method AS channel,
       lch.subject,
       lch.content,
       lch.pdf_url,
       lch.sequence_step,
       pl.property_address,
       pl.postcode,
       pl.owner_name,
       pl.lead_source,
       pl.propensity_score,
       pl.days_on_market,
       lch.created_at
     FROM lead_contact_history lch
     JOIN proactive_lead pl ON pl.id = lch.lead_id
     WHERE lch.approval_status = 'pending'
     ORDER BY lch.created_at ASC`
  );

  return result.rows.map((r: any) => ({
    contactHistoryId: r.contact_history_id,
    leadId: r.lead_id,
    channel: r.channel,
    subject: r.subject,
    content: r.content,
    pdfUrl: r.pdf_url,
    sequenceStep: r.sequence_step,
    propertyAddress: r.property_address,
    postcode: r.postcode,
    ownerName: r.owner_name,
    leadSource: r.lead_source,
    propensityScore: r.propensity_score,
    daysOnMarket: r.days_on_market,
    createdAt: r.created_at,
  }));
}

// ============================================================
// Approve Outreach
// ============================================================

/**
 * Approve an outreach draft. Updates approval fields first, then triggers sending.
 * For email: calls sendApprovedEmail to dispatch via emailService.
 * For post: calls sendApprovedLetter (staff downloads PDF to print and post).
 */
export async function approveOutreach(
  contactHistoryId: number,
  approvedById: number
): Promise<void> {
  const { pool } = await import('../../db');
  const { sendApprovedEmail, sendApprovedLetter } = await import('./sourcingOutreachService');

  // 1. Update approval fields BEFORE sending
  await pool.query(
    `UPDATE lead_contact_history
     SET approval_status = 'approved',
         approved_by_id = $1,
         approved_at = NOW()
     WHERE id = $2`,
    [approvedById, contactHistoryId]
  );

  // 2. Read the record to determine channel
  const result = await pool.query(
    `SELECT contact_method FROM lead_contact_history WHERE id = $1`,
    [contactHistoryId]
  );
  if (result.rows.length === 0) return;

  const channel = result.rows[0].contact_method;

  // 3. Trigger send based on channel
  if (channel === 'email') {
    await sendApprovedEmail(contactHistoryId);
  } else if (channel === 'post') {
    await sendApprovedLetter(contactHistoryId);
  }
}

// ============================================================
// Reject Outreach
// ============================================================

/**
 * Reject an outreach draft. Does NOT send any outreach.
 * Updates lead status to 'declined' if no other pending outreach exists.
 */
export async function rejectOutreach(
  contactHistoryId: number,
  rejectedById: number,
  reason?: string
): Promise<void> {
  const { pool } = await import('../../db');

  // Update contact history with rejection
  await pool.query(
    `UPDATE lead_contact_history
     SET approval_status = 'rejected',
         approved_by_id = $1,
         approved_at = NOW(),
         rejection_reason = $2
     WHERE id = $3`,
    [rejectedById, reason || null, contactHistoryId]
  );

  // Check if this lead has any other pending outreach
  const leadResult = await pool.query(
    `SELECT lead_id FROM lead_contact_history WHERE id = $1`,
    [contactHistoryId]
  );
  if (leadResult.rows.length === 0) return;

  const leadId = leadResult.rows[0].lead_id;

  const pendingCount = await pool.query(
    `SELECT COUNT(*) AS cnt FROM lead_contact_history
     WHERE lead_id = $1 AND approval_status = 'pending' AND id != $2`,
    [leadId, contactHistoryId]
  );

  // If no other pending outreach, mark lead as declined
  if (parseInt(pendingCount.rows[0].cnt) === 0) {
    await pool.query(
      `UPDATE proactive_lead SET status = 'declined', updated_at = NOW() WHERE id = $1`,
      [leadId]
    );
  }
}

// ============================================================
// Edit Outreach Draft
// ============================================================

/**
 * Edit an outreach draft's content and/or subject.
 * If channel is 'post', regenerates the PDF with new content.
 */
export async function editOutreachDraft(
  contactHistoryId: number,
  newContent: string,
  newSubject?: string
): Promise<void> {
  const { pool } = await import('../../db');

  // Update content and optionally subject
  const updates: string[] = ['content = $1'];
  const params: any[] = [newContent];

  if (newSubject !== undefined) {
    updates.push(`subject = $${params.length + 1}`);
    params.push(newSubject);
  }

  params.push(contactHistoryId);
  await pool.query(
    `UPDATE lead_contact_history SET ${updates.join(', ')} WHERE id = $${params.length}`,
    params
  );

  // Check if this is a post channel -- need to regenerate PDF
  const result = await pool.query(
    `SELECT lch.contact_method, lch.lead_id, lch.sequence_step,
            pl.owner_name, pl.owner_address, pl.property_address, pl.lead_source
     FROM lead_contact_history lch
     JOIN proactive_lead pl ON pl.id = lch.lead_id
     WHERE lch.id = $1`,
    [contactHistoryId]
  );

  if (result.rows.length > 0 && result.rows[0].contact_method === 'post') {
    const row = result.rows[0];
    const { generateOutreachLetterPDF } = await import('../../services/pdfService');

    const pdfBuffer = await generateOutreachLetterPDF({
      recipientName: row.owner_name || 'Property Owner',
      recipientAddress: row.owner_address || row.property_address,
      propertyAddress: row.property_address,
      leadSource: row.lead_source,
      personalizedMessage: newContent,
      date: new Date()
    });

    // Store updated PDF
    const fs = await import('fs');
    const path = await import('path');
    const dir = path.resolve('uploads/sourcing');
    await fs.promises.mkdir(dir, { recursive: true });
    const filename = `outreach-${row.lead_id}-step${row.sequence_step || 0}-${Date.now()}.pdf`;
    const filepath = path.join(dir, filename);
    await fs.promises.writeFile(filepath, pdfBuffer);
    const pdfUrl = `/uploads/sourcing/${filename}`;

    await pool.query(
      `UPDATE lead_contact_history SET pdf_url = $1 WHERE id = $2`,
      [pdfUrl, contactHistoryId]
    );
  }
}
