import { pool } from '../db.js';

export interface AvailableAgent {
  id: number;
  fullName: string;
  phone: string;
  department: string;
}

/**
 * Get agents available to take calls for a given department.
 * Queries users with role admin/agent, matching department, non-null phone, and active status.
 */
export async function getAvailableAgents(department?: string): Promise<AvailableAgent[]> {
  let query = `
    SELECT u.id, u.full_name, u.phone, sp.department
    FROM "user" u
    JOIN staff_profile sp ON sp.user_id = u.id
    WHERE u.is_active = true
    AND u.phone IS NOT NULL
    AND u.phone != ''
    AND sp.is_active = true
    AND sp.on_leave = false
    AND u.role IN ('admin', 'agent')
  `;
  const params: any[] = [];

  if (department) {
    params.push(department);
    query += ` AND sp.department = $${params.length}`;
  }

  query += ' ORDER BY sp.department, u.full_name';

  const result = await pool.query(query, params);
  return result.rows.map((row: any) => ({
    id: row.id,
    fullName: row.full_name,
    phone: row.phone,
    department: row.department,
  }));
}

/**
 * Generate TwiML to ring available agents for a department.
 * Tries each agent sequentially with a 20s timeout.
 */
export function generateRoutingTwiML(agents: AvailableAgent[], callerNumber: string): string {
  if (agents.length === 0) {
    return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="Polly.Amy" language="en-GB">
    Thank you for calling John Barclay Estate Agents. Unfortunately all our agents are currently busy.
    Please leave a message after the tone and we'll return your call as soon as possible.
  </Say>
  <Record maxLength="120" transcribe="true" playBeep="true" />
</Response>`;
  }

  // Build dial sequence - try first available agent
  const agentPhones = agents.slice(0, 3).map(a =>
    `<Number statusCallbackEvent="completed" statusCallback="/api/voice/call-status">${a.phone}</Number>`
  ).join('\n      ');

  return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="Polly.Amy" language="en-GB">
    Please hold while we connect you to an agent.
  </Say>
  <Dial timeout="20" callerId="${process.env.TWILIO_PHONE_NUMBER || ''}" record="record-from-answer-dual">
    ${agentPhones}
  </Dial>
  <Say voice="Polly.Amy" language="en-GB">
    We were unable to connect you to an agent. Please leave a message after the tone.
  </Say>
  <Record maxLength="120" transcribe="true" playBeep="true" />
</Response>`;
}

/**
 * Map a caller's inquiry to a department based on keywords or AI classification.
 */
export function classifyDepartment(transcript: string): string {
  const lower = transcript.toLowerCase();

  if (lower.includes('maintenance') || lower.includes('repair') || lower.includes('fix') ||
      lower.includes('broken') || lower.includes('leak') || lower.includes('boiler')) {
    return 'maintenance';
  }

  if (lower.includes('rent') || lower.includes('tenant') || lower.includes('let') ||
      lower.includes('lettings') || lower.includes('move in') || lower.includes('deposit')) {
    return 'lettings';
  }

  if (lower.includes('buy') || lower.includes('sell') || lower.includes('sale') ||
      lower.includes('offer') || lower.includes('viewing') || lower.includes('valuation')) {
    return 'sales';
  }

  // Default to sales
  return 'sales';
}

export const callRoutingService = {
  getAvailableAgents,
  generateRoutingTwiML,
  classifyDepartment,
};
