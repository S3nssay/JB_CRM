/**
 * Sourcing Follow-Up Sequence Service
 *
 * Manages multi-touch outreach cadences for property sourcing leads.
 * Default sequence: letter (day 0) -> email (day 7) -> letter (day 21).
 * Campaigns can define custom sequences via lead_monitoring_config.config.followUpSequence.
 */

export interface FollowUpStep {
  step: number;
  day: number;
  channel: 'email' | 'post';
}

const DEFAULT_SEQUENCE: FollowUpStep[] = [
  { step: 0, day: 0, channel: 'post' },
  { step: 1, day: 7, channel: 'email' },
  { step: 2, day: 21, channel: 'post' },
];

/**
 * Get the follow-up sequence for a campaign.
 * Returns campaign-specific sequence if available, otherwise default.
 */
export function getFollowUpSequence(campaignConfig?: any): FollowUpStep[] {
  if (campaignConfig?.followUpSequence && Array.isArray(campaignConfig.followUpSequence)) {
    return campaignConfig.followUpSequence;
  }
  return DEFAULT_SEQUENCE;
}

/**
 * Get the next step in the follow-up sequence.
 * Returns null when the sequence is exhausted.
 */
export function getNextFollowUpStep(
  currentStep: number,
  sequence: FollowUpStep[]
): FollowUpStep | null {
  const nextIndex = sequence.findIndex(s => s.step === currentStep + 1);
  if (nextIndex === -1) return null;
  return sequence[nextIndex];
}

/**
 * Calculate the date for the next follow-up based on current step.
 * Returns null if the sequence is exhausted.
 */
export function calculateNextFollowUpDate(
  currentStep: number,
  sequence: FollowUpStep[]
): Date | null {
  const currentStepObj = sequence.find(s => s.step === currentStep);
  const nextStep = getNextFollowUpStep(currentStep, sequence);

  if (!nextStep || !currentStepObj) return null;

  const daysDiff = nextStep.day - currentStepObj.day;
  const nextDate = new Date();
  nextDate.setDate(nextDate.getDate() + daysDiff);
  return nextDate;
}

/**
 * Advance a lead to the next step in the follow-up sequence.
 * Creates a new draft outreach for the next step.
 */
export async function advanceFollowUpSequence(leadId: number): Promise<void> {
  const { pool } = await import('../../server/db');
  const { draftOutreach } = await import('./sourcingOutreachService');

  // Get current lead state
  const leadResult = await pool.query(
    'SELECT * FROM proactive_lead WHERE id = $1',
    [leadId]
  );
  if (leadResult.rows.length === 0) {
    throw new Error(`Proactive lead ${leadId} not found`);
  }
  const lead = leadResult.rows[0];

  // Get campaign config if exists
  let campaignConfig: any = undefined;
  if (lead.campaign_id) {
    const configResult = await pool.query(
      `SELECT config FROM lead_monitoring_config WHERE id = $1`,
      [lead.campaign_id]
    );
    if (configResult.rows.length > 0) {
      campaignConfig = configResult.rows[0].config;
    }
  }

  // Get sequence and determine current step from last contact
  const sequence = getFollowUpSequence(campaignConfig);

  const lastContactResult = await pool.query(
    `SELECT sequence_step FROM lead_contact_history
     WHERE lead_id = $1 AND status = 'sent'
     ORDER BY created_at DESC LIMIT 1`,
    [leadId]
  );

  const currentStep = lastContactResult.rows.length > 0
    ? (lastContactResult.rows[0].sequence_step ?? 0)
    : -1; // No contacts yet, start at step 0

  const nextStep = getNextFollowUpStep(currentStep, sequence);

  if (nextStep) {
    // Create next draft
    await draftOutreach(leadId, nextStep.step);

    // Update next follow-up date
    const nextDate = calculateNextFollowUpDate(nextStep.step, sequence);
    if (nextDate) {
      await pool.query(
        `UPDATE proactive_lead SET next_follow_up_date = $1, updated_at = NOW() WHERE id = $2`,
        [nextDate, leadId]
      );
    }
  } else {
    // Sequence exhausted
    await pool.query(
      `UPDATE proactive_lead
       SET notes = COALESCE(notes, '') || E'\n[Follow-up sequence complete at ' || NOW()::text || ']',
           next_follow_up_date = NULL,
           updated_at = NOW()
       WHERE id = $1`,
      [leadId]
    );
  }
}
