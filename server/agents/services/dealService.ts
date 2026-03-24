/**
 * Deal Service
 *
 * CRUD operations for deals, deal steps, deal events, and notifications.
 * Uses raw SQL via pool.query (following pmWorkflowRoutes pattern).
 */

import { pool } from '../../db';

// ---- Types ----

interface CreateDealParams {
  dealType: string;
  propertyId: number;
  tenancyId?: number;
  landlordId?: number;
  tenantId?: number;
  buyerId?: number;
  dealData?: any;
  currentPipeline?: string;
}

interface CreateDealStepParams {
  dealId: number;
  stepId: string;
  stepName: string;
  agentType: string;
  dependsOn?: string[];
  isOptional?: boolean;
  timeoutAt?: Date;
}

interface CreateDealEventParams {
  dealId: number;
  eventType: string;
  title: string;
  agentType?: string;
  stepId?: string;
  description?: string;
  metadata?: any;
  actorType: string;
  actorId?: number;
}

interface CreateNotificationParams {
  userId: number;
  dealId?: number;
  title: string;
  body?: string;
  type: string;
  linkUrl?: string;
}

// ---- Service ----

export const dealService = {
  // ---- Deals ----

  async createDeal(data: CreateDealParams) {
    const result = await pool.query(
      `INSERT INTO deal (deal_type, status, property_id, tenancy_id, landlord_id, tenant_id, buyer_id, deal_data, current_pipeline)
       VALUES ($1, 'active', $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [data.dealType, data.propertyId, data.tenancyId || null, data.landlordId || null, data.tenantId || null, data.buyerId || null, data.dealData ? JSON.stringify(data.dealData) : null, data.currentPipeline || null]
    );
    return result.rows[0];
  },

  async getDeal(id: number) {
    const result = await pool.query(
      `SELECT d.*,
        (SELECT COUNT(*) FROM deal_step WHERE deal_id = d.id) AS total_steps,
        (SELECT COUNT(*) FROM deal_step WHERE deal_id = d.id AND status = 'completed') AS completed_steps,
        (SELECT COUNT(*) FROM deal_step WHERE deal_id = d.id AND status = 'failed') AS failed_steps
       FROM deal d WHERE d.id = $1`,
      [id]
    );
    return result.rows[0] || null;
  },

  async updateDeal(id: number, data: Record<string, any>) {
    const fields: string[] = [];
    const values: any[] = [];
    let idx = 1;

    for (const [key, value] of Object.entries(data)) {
      // Convert camelCase to snake_case
      const snakeKey = key.replace(/[A-Z]/g, (m) => `_${m.toLowerCase()}`);
      fields.push(`${snakeKey} = $${idx}`);
      values.push(value);
      idx++;
    }
    fields.push(`updated_at = NOW()`);
    values.push(id);

    const result = await pool.query(
      `UPDATE deal SET ${fields.join(', ')} WHERE id = $${idx} RETURNING *`,
      values
    );
    return result.rows[0] || null;
  },

  async listDeals(filters: { status?: string; dealType?: string; propertyId?: number } = {}) {
    const conditions: string[] = [];
    const values: any[] = [];
    let idx = 1;

    if (filters.status) {
      conditions.push(`status = $${idx++}`);
      values.push(filters.status);
    }
    if (filters.dealType) {
      conditions.push(`deal_type = $${idx++}`);
      values.push(filters.dealType);
    }
    if (filters.propertyId) {
      conditions.push(`property_id = $${idx++}`);
      values.push(filters.propertyId);
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const result = await pool.query(
      `SELECT * FROM deal ${where} ORDER BY created_at DESC`,
      values
    );
    return result.rows;
  },

  // ---- Deal Steps ----

  async createDealStep(data: CreateDealStepParams) {
    const result = await pool.query(
      `INSERT INTO deal_step (deal_id, step_id, step_name, agent_type, status, depends_on, is_optional, timeout_at)
       VALUES ($1, $2, $3, $4, 'pending', $5, $6, $7)
       RETURNING *`,
      [data.dealId, data.stepId, data.stepName, data.agentType, data.dependsOn ? JSON.stringify(data.dependsOn) : null, data.isOptional || false, data.timeoutAt || null]
    );
    return result.rows[0];
  },

  async updateDealStep(id: number, data: Record<string, any>) {
    const fields: string[] = [];
    const values: any[] = [];
    let idx = 1;

    for (const [key, value] of Object.entries(data)) {
      const snakeKey = key.replace(/[A-Z]/g, (m) => `_${m.toLowerCase()}`);
      fields.push(`${snakeKey} = $${idx}`);
      values.push(value);
      idx++;
    }
    fields.push(`updated_at = NOW()`);
    values.push(id);

    const result = await pool.query(
      `UPDATE deal_step SET ${fields.join(', ')} WHERE id = $${idx} RETURNING *`,
      values
    );
    return result.rows[0] || null;
  },

  async getDealSteps(dealId: number) {
    const result = await pool.query(
      `SELECT * FROM deal_step WHERE deal_id = $1 ORDER BY created_at ASC`,
      [dealId]
    );
    return result.rows;
  },

  async getDealStepByStepId(dealId: number, stepId: string) {
    const result = await pool.query(
      `SELECT * FROM deal_step WHERE deal_id = $1 AND step_id = $2`,
      [dealId, stepId]
    );
    return result.rows[0] || null;
  },

  // ---- Deal Events (Timeline) ----

  async createDealEvent(data: CreateDealEventParams) {
    const result = await pool.query(
      `INSERT INTO deal_event (deal_id, event_type, agent_type, step_id, title, description, metadata, actor_type, actor_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING *`,
      [data.dealId, data.eventType, data.agentType || null, data.stepId || null, data.title, data.description || null, data.metadata ? JSON.stringify(data.metadata) : null, data.actorType, data.actorId || null]
    );
    return result.rows[0];
  },

  async getDealEvents(dealId: number) {
    const result = await pool.query(
      `SELECT * FROM deal_event WHERE deal_id = $1 ORDER BY created_at DESC`,
      [dealId]
    );
    return result.rows;
  },

  // ---- Notifications ----

  async createNotification(data: CreateNotificationParams) {
    const result = await pool.query(
      `INSERT INTO notification (user_id, deal_id, title, body, type, link_url)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [data.userId, data.dealId || null, data.title, data.body || null, data.type, data.linkUrl || null]
    );
    return result.rows[0];
  },

  async getNotifications(userId: number, unreadOnly = false) {
    const condition = unreadOnly ? 'AND is_read = false' : '';
    const result = await pool.query(
      `SELECT * FROM notification WHERE user_id = $1 ${condition} ORDER BY created_at DESC`,
      [userId]
    );
    return result.rows;
  },

  async markNotificationRead(id: number) {
    const result = await pool.query(
      `UPDATE notification SET is_read = true, read_at = NOW() WHERE id = $1 RETURNING *`,
      [id]
    );
    return result.rows[0] || null;
  },

  async markAllNotificationsRead(userId: number) {
    await pool.query(
      `UPDATE notification SET is_read = true, read_at = NOW() WHERE user_id = $1 AND is_read = false`,
      [userId]
    );
  },

  async getUnreadCount(userId: number) {
    const result = await pool.query(
      `SELECT COUNT(*) AS count FROM notification WHERE user_id = $1 AND is_read = false`,
      [userId]
    );
    return parseInt(result.rows[0].count, 10);
  },
};
