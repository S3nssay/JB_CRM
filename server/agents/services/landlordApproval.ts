/**
 * Landlord Approval Service
 *
 * Handles landlord approval workflow for maintenance work:
 * - Emergency work: auto-approves and sends notification to landlord
 * - Non-emergency work: sends approval request to landlord
 */

import { pool } from '../../db';
import { messageSender } from './messageSender';
import { auditLogger } from '../middleware/auditLogger';

export interface ApprovalRequest {
  ticketId: number;
  landlordId: number;
  quoteAmount: number; // in pence
  contractorName: string;
  faultDescription: string;
  isEmergency: boolean;
}

export interface ApprovalResult {
  status: 'auto_approved' | 'pending';
  reason?: string;
  landlordContacted: boolean;
}

export class LandlordApprovalService {
  /**
   * Request landlord approval for maintenance work.
   * Emergency work is auto-approved with notification; non-emergency sends approval request.
   */
  async requestApproval(params: ApprovalRequest): Promise<ApprovalResult> {
    // 1. Look up landlord
    const { rows: landlords } = await pool.query(
      'SELECT id, name, email, mobile, phone FROM landlord WHERE id = $1',
      [params.landlordId],
    );

    if (landlords.length === 0) {
      throw new Error(`Landlord not found: ${params.landlordId}`);
    }

    const landlord = landlords[0];
    const amountFormatted = `£${(params.quoteAmount / 100).toFixed(2)}`;

    if (params.isEmergency) {
      return this.handleEmergencyApproval(params, landlord, amountFormatted);
    }

    return this.handleStandardApproval(params, landlord, amountFormatted);
  }

  /**
   * Handle landlord response to approval request.
   */
  async handleApprovalResponse(
    landlordId: number,
    response: 'approve' | 'reject',
    ticketId?: number,
  ): Promise<void> {
    if (response === 'approve') {
      // Find pending quote for this landlord's property ticket
      const condition = ticketId
        ? 'cq.ticket_id = $1 AND cq.status = $2'
        : 'cq.status = $1';
      const queryParams = ticketId
        ? [ticketId, 'pending']
        : ['pending'];

      await pool.query(
        `UPDATE contractor_quote SET status = 'approved', approved_at = NOW()
         WHERE id = (
           SELECT cq.id FROM contractor_quote cq
           WHERE ${condition}
           ORDER BY cq.sent_at DESC LIMIT 1
         )`,
        queryParams,
      );
    } else {
      // Reject and escalate to staff for re-selection
      if (ticketId) {
        await pool.query(
          `UPDATE contractor_quote SET status = 'rejected'
           WHERE ticket_id = $1 AND status = 'pending'`,
          [ticketId],
        );
      }
    }
  }

  private async handleEmergencyApproval(
    params: ApprovalRequest,
    landlord: any,
    amountFormatted: string,
  ): Promise<ApprovalResult> {
    // Auto-approve: update quote status
    await pool.query(
      `UPDATE contractor_quote SET status = 'approved', approval_notes = 'Emergency auto-approved', approved_at = NOW()
       WHERE ticket_id = $1 AND status = 'pending'
       ORDER BY sent_at DESC LIMIT 1`,
      [params.ticketId],
    );

    // Send NOTIFICATION (not request) to landlord
    const message = [
      `Dear ${landlord.name},`,
      '',
      `Emergency maintenance at your property:`,
      `Fault: ${params.faultDescription}`,
      `Contractor: ${params.contractorName}`,
      `Quoted: ${amountFormatted}`,
      '',
      'The contractor has been dispatched immediately due to the emergency nature of this issue. We will update you on completion.',
      '',
      'John Barclay Estate Agents',
    ].join('\n');

    let contacted = false;
    const contactPhone = landlord.mobile || landlord.phone;
    if (contactPhone) {
      contacted = await messageSender.sendPreferred(contactPhone, message);
    }
    if (landlord.email) {
      await messageSender.send('email', landlord.email, message, {
        subject: `Emergency Maintenance - MT-${params.ticketId}`,
      });
      if (!contacted) contacted = true;
    }

    // Audit log the emergency bypass
    await auditLogger.logToolCall({
      agentType: 'maintenance',
      toolName: 'request_landlord_approval',
      toolInput: params,
      toolOutput: { status: 'auto_approved', reason: 'Emergency: landlord approval bypassed' },
      durationMs: 0,
    });

    return {
      status: 'auto_approved',
      reason: 'Emergency: landlord approval bypassed',
      landlordContacted: contacted,
    };
  }

  private async handleStandardApproval(
    params: ApprovalRequest,
    landlord: any,
    amountFormatted: string,
  ): Promise<ApprovalResult> {
    // Send APPROVAL REQUEST to landlord
    const message = [
      `Dear ${landlord.name},`,
      '',
      `Maintenance request at your property:`,
      '',
      `Fault: ${params.faultDescription}`,
      `Contractor: ${params.contractorName}`,
      `Quoted amount: ${amountFormatted}`,
      '',
      'Reply APPROVE to proceed or REJECT to decline.',
      '',
      'John Barclay Estate Agents',
    ].join('\n');

    let contacted = false;
    const contactPhone = landlord.mobile || landlord.phone;
    if (contactPhone) {
      contacted = await messageSender.sendPreferred(contactPhone, message);
    }
    if (landlord.email) {
      await messageSender.send('email', landlord.email, message, {
        subject: `Approval Required - Maintenance MT-${params.ticketId}`,
      });
      if (!contacted) contacted = true;
    }

    return {
      status: 'pending',
      landlordContacted: contacted,
    };
  }
}

/** Singleton instance */
export const landlordApprovalService = new LandlordApprovalService();
