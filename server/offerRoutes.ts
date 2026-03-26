/**
 * Offer Management API Routes
 *
 * CRUD endpoints for property offers with notification (bell + email) triggers.
 * Every new offer creates an in-CRM notification and sends an email to the
 * assigned agent/negotiator so offers are never missed.
 */
import { Router, Request, Response } from 'express';
import { pool } from './db';
import { emailService } from './emailService';

export const offerRouter = Router();

// ---- Helpers ----

function formatGBP(pence: number): string {
  return new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' }).format(pence / 100);
}

function isAuthenticated(req: Request, res: Response, next: Function) {
  if (req.isAuthenticated?.()) return next();
  res.status(401).json({ error: 'Not authenticated' });
}

// All offer routes require authentication
offerRouter.use('/offers', isAuthenticated);

// ---- 1. GET /offers -- List all offers with optional filters ----

offerRouter.get('/offers', async (req: Request, res: Response) => {
  try {
    const { propertyId, status, dateFrom, dateTo } = req.query;

    const conditions: string[] = [];
    const params: any[] = [];
    let idx = 1;

    if (propertyId) {
      conditions.push(`o.property_id = $${idx++}`);
      params.push(Number(propertyId));
    }
    if (status) {
      conditions.push(`o.status = $${idx++}`);
      params.push(status);
    }
    if (dateFrom) {
      conditions.push(`o.created_at >= $${idx++}`);
      params.push(dateFrom);
    }
    if (dateTo) {
      conditions.push(`o.created_at <= $${idx++}`);
      params.push(dateTo);
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const result = await pool.query(
      `SELECT o.*, p.address AS property_address
       FROM property_offer o
       LEFT JOIN properties p ON p.id = o.property_id
       ${where}
       ORDER BY o.created_at DESC`,
      params
    );

    res.json(result.rows);
  } catch (error: any) {
    console.error('[offerRoutes] GET /offers error:', error);
    res.status(500).json({ error: 'Failed to fetch offers' });
  }
});

// ---- 2. GET /offers/:id -- Get single offer with full details ----

offerRouter.get('/offers/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const result = await pool.query(
      `SELECT o.*, p.address AS property_address,
              u.username AS decision_by_name
       FROM property_offer o
       LEFT JOIN properties p ON p.id = o.property_id
       LEFT JOIN users u ON u.id = o.decision_by
       WHERE o.id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Offer not found' });
    }

    res.json(result.rows[0]);
  } catch (error: any) {
    console.error('[offerRoutes] GET /offers/:id error:', error);
    res.status(500).json({ error: 'Failed to fetch offer' });
  }
});

// ---- 3. POST /offers -- Create a new offer ----

offerRouter.post('/offers', async (req: Request, res: Response) => {
  try {
    const {
      propertyId, offerAmount, offerType,
      buyerName, buyerEmail, buyerPhone, buyerPosition,
      isInChain, chainDetails, conditions, proposedCompletionDate,
      employmentStatus, rentalReferences, moveInTimeline, offerSource
    } = req.body;

    if (!propertyId || !offerAmount || !buyerName || !buyerEmail || !buyerPhone) {
      return res.status(400).json({ error: 'Missing required fields: propertyId, offerAmount, buyerName, buyerEmail, buyerPhone' });
    }

    // Insert the offer
    const insertResult = await pool.query(
      `INSERT INTO property_offer
        (property_id, offer_amount, offer_type, buyer_name, buyer_email, buyer_phone,
         buyer_position, is_in_chain, chain_details, conditions, proposed_completion_date,
         employment_status, rental_references, move_in_timeline, offer_source,
         status, created_at, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,'pending',NOW(),NOW())
       RETURNING *`,
      [
        propertyId, offerAmount, offerType || null,
        buyerName, buyerEmail, buyerPhone, buyerPosition || null,
        isInChain || false, chainDetails || null,
        conditions || null, proposedCompletionDate || null,
        employmentStatus || null, rentalReferences || null,
        moveInTimeline || null, offerSource || 'agent'
      ]
    );

    const offer = insertResult.rows[0];

    // Look up property address and assigned agent
    const propResult = await pool.query(
      `SELECT p.address, p.agent_id, p.property_manager_id
       FROM properties p WHERE p.id = $1`,
      [propertyId]
    );

    const property = propResult.rows[0];
    const propertyAddress = property?.address || `Property #${propertyId}`;

    // Determine who to notify: agent_id -> property_manager_id -> first admin
    let notifyUserId: number | null = property?.agent_id || property?.property_manager_id || null;
    let notifyEmail: string | null = null;

    if (notifyUserId) {
      const userResult = await pool.query(
        `SELECT id, email, username FROM users WHERE id = $1`,
        [notifyUserId]
      );
      if (userResult.rows.length > 0) {
        notifyEmail = userResult.rows[0].email;
      }
    }

    // Fallback to first admin user
    if (!notifyUserId) {
      const adminResult = await pool.query(
        `SELECT id, email, username FROM users WHERE role = 'admin' ORDER BY id LIMIT 1`
      );
      if (adminResult.rows.length > 0) {
        notifyUserId = adminResult.rows[0].id;
        notifyEmail = adminResult.rows[0].email;
      }
    }

    // a. Create in-CRM bell notification
    if (notifyUserId) {
      const formattedAmount = formatGBP(offerAmount);
      await pool.query(
        `INSERT INTO notification (user_id, title, body, type, link_url, is_read, created_at)
         VALUES ($1, $2, $3, 'info', '/crm/offers', false, NOW())`,
        [
          notifyUserId,
          `New offer: ${formattedAmount} on ${propertyAddress}`,
          `Buyer: ${buyerName} | Position: ${buyerPosition || 'Not specified'} | Chain: ${isInChain ? 'Yes' : 'No'}`
        ]
      );
    }

    // b. Send email notification to the assigned agent
    if (notifyEmail) {
      const formattedAmount = formatGBP(offerAmount);
      const crmLink = `${process.env.APP_URL || 'http://localhost:5000'}/crm/offers`;

      const conditionsHtml = conditions && conditions.length > 0
        ? conditions.map((c: string) => `<li>${c}</li>`).join('')
        : '<li>None</li>';

      const completionDateStr = proposedCompletionDate
        ? new Date(proposedCompletionDate).toLocaleDateString('en-GB')
        : 'Not specified';

      const emailHtml = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background: #791E75; color: white; padding: 20px; text-align: center;">
            <h1 style="margin: 0; font-size: 22px;">John Barclay</h1>
            <p style="margin: 5px 0 0 0;">Estate & Management</p>
          </div>
          <div style="padding: 24px; border: 1px solid #e5e5e5; border-top: none;">
            <h2 style="color: #333; margin-top: 0;">New Offer Received</h2>
            <p style="color: #666; font-size: 14px;">A new offer has been submitted for:</p>
            <p style="font-size: 16px; font-weight: bold; color: #333;">${propertyAddress}</p>

            <table style="width: 100%; border-collapse: collapse; margin: 16px 0;">
              <tr>
                <td style="padding: 8px 0; border-bottom: 1px solid #eee; color: #666;">Offer Amount</td>
                <td style="padding: 8px 0; border-bottom: 1px solid #eee; font-weight: bold; color: #333;">${formattedAmount}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; border-bottom: 1px solid #eee; color: #666;">Buyer Name</td>
                <td style="padding: 8px 0; border-bottom: 1px solid #eee; color: #333;">${buyerName}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; border-bottom: 1px solid #eee; color: #666;">Buyer Position</td>
                <td style="padding: 8px 0; border-bottom: 1px solid #eee; color: #333;">${buyerPosition || 'Not specified'}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; border-bottom: 1px solid #eee; color: #666;">In Chain</td>
                <td style="padding: 8px 0; border-bottom: 1px solid #eee; color: #333;">${isInChain ? 'Yes' : 'No'}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; border-bottom: 1px solid #eee; color: #666;">Chain Details</td>
                <td style="padding: 8px 0; border-bottom: 1px solid #eee; color: #333;">${chainDetails || 'N/A'}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; border-bottom: 1px solid #eee; color: #666;">Conditions</td>
                <td style="padding: 8px 0; border-bottom: 1px solid #eee; color: #333;"><ul style="margin: 0; padding-left: 16px;">${conditionsHtml}</ul></td>
              </tr>
              <tr>
                <td style="padding: 8px 0; border-bottom: 1px solid #eee; color: #666;">Proposed Completion</td>
                <td style="padding: 8px 0; border-bottom: 1px solid #eee; color: #333;">${completionDateStr}</td>
              </tr>
            </table>

            <div style="text-align: center; margin: 24px 0;">
              <a href="${crmLink}" style="display: inline-block; background: #791E75; color: white; padding: 12px 28px; text-decoration: none; border-radius: 4px; font-weight: bold;">View in CRM</a>
            </div>
          </div>
          <div style="padding: 12px; text-align: center; font-size: 12px; color: #999;">
            John Barclay Estate & Management
          </div>
        </div>`;

      try {
        await emailService.sendEmail(
          notifyEmail,
          `New Offer Received - ${propertyAddress}`,
          emailHtml
        );
      } catch (emailErr) {
        console.error('[offerRoutes] Failed to send offer email:', emailErr);
        // Non-blocking: offer still created even if email fails
      }
    }

    res.status(201).json(offer);
  } catch (error: any) {
    console.error('[offerRoutes] POST /offers error:', error);
    res.status(500).json({ error: 'Failed to create offer' });
  }
});

// ---- 4. PATCH /offers/:id/status -- Update offer status ----

offerRouter.patch('/offers/:id/status', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { status, rejectionReason, counterOfferAmount, finalAgreedAmount } = req.body;
    const userId = (req.user as any)?.id;

    if (!status) {
      return res.status(400).json({ error: 'status is required' });
    }

    const validStatuses = ['accepted', 'rejected', 'withdrawn', 'under_review', 'countered'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ error: `Invalid status. Must be one of: ${validStatuses.join(', ')}` });
    }

    // Build dynamic SET clause
    const sets: string[] = ['status = $1', 'decision_date = NOW()', 'updated_at = NOW()'];
    const params: any[] = [status];
    let idx = 2;

    if (userId) {
      sets.push(`decision_by = $${idx++}`);
      params.push(userId);
    }

    if (rejectionReason !== undefined) {
      sets.push(`rejection_reason = $${idx++}`);
      params.push(rejectionReason);
    }

    if (counterOfferAmount !== undefined) {
      sets.push(`counter_offer_amount = $${idx++}`);
      params.push(counterOfferAmount);
      sets.push('counter_offer_date = NOW()');
    }

    if (finalAgreedAmount !== undefined) {
      sets.push(`final_agreed_amount = $${idx++}`);
      params.push(finalAgreedAmount);
    }

    params.push(id);
    const result = await pool.query(
      `UPDATE property_offer SET ${sets.join(', ')} WHERE id = $${idx} RETURNING *`,
      params
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Offer not found' });
    }

    res.json(result.rows[0]);
  } catch (error: any) {
    console.error('[offerRoutes] PATCH /offers/:id/status error:', error);
    res.status(500).json({ error: 'Failed to update offer status' });
  }
});

// ---- 5. GET /properties/:id/offers -- List offers for a specific property ----

offerRouter.get('/properties/:id/offers', isAuthenticated, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      `SELECT o.*, p.address AS property_address
       FROM property_offer o
       LEFT JOIN properties p ON p.id = o.property_id
       WHERE o.property_id = $1
       ORDER BY o.created_at DESC`,
      [id]
    );

    res.json(result.rows);
  } catch (error: any) {
    console.error('[offerRoutes] GET /properties/:id/offers error:', error);
    res.status(500).json({ error: 'Failed to fetch property offers' });
  }
});
