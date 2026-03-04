import { storage } from './storage';
import { recordPaymentAndReconcile } from './reconciliationEngine';
import crypto from 'crypto';

/**
 * GoCardless Direct Debit integration service.
 * Handles mandate setup via redirect flows, payment collection, and webhook processing.
 *
 * Environment variables:
 * - GOCARDLESS_ACCESS_TOKEN: API access token
 * - GOCARDLESS_ENVIRONMENT: 'sandbox' or 'live' (default: sandbox)
 * - GOCARDLESS_WEBHOOK_SECRET: Webhook endpoint secret for signature verification
 */

const GC_ACCESS_TOKEN = process.env.GOCARDLESS_ACCESS_TOKEN;
const GC_ENVIRONMENT = process.env.GOCARDLESS_ENVIRONMENT || 'sandbox';
const GC_WEBHOOK_SECRET = process.env.GOCARDLESS_WEBHOOK_SECRET;

const GC_BASE_URL = GC_ENVIRONMENT === 'live'
  ? 'https://api.gocardless.com'
  : 'https://api-sandbox.gocardless.com';

export function isGoCardlessConfigured(): boolean {
  return !!GC_ACCESS_TOKEN;
}

async function gcRequest(method: string, path: string, body?: any): Promise<any> {
  if (!GC_ACCESS_TOKEN) {
    throw new Error('GoCardless not configured. Set GOCARDLESS_ACCESS_TOKEN environment variable.');
  }

  const response = await fetch(`${GC_BASE_URL}${path}`, {
    method,
    headers: {
      'Authorization': `Bearer ${GC_ACCESS_TOKEN}`,
      'GoCardless-Version': '2015-07-06',
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`GoCardless API error ${response.status}: ${errorBody}`);
  }

  return response.json();
}

/**
 * Create a redirect flow for a tenant to set up a Direct Debit mandate.
 * Returns a URL to redirect the tenant to for bank authorisation.
 */
export async function createRedirectFlow(
  tenantId: number,
  tenancyId: number | undefined,
  propertyId: number | undefined,
  description: string,
  successRedirectUrl: string
): Promise<{ redirectUrl: string; mandateId: number }> {
  // Create the redirect flow via GoCardless API
  const result = await gcRequest('POST', '/redirect_flows', {
    redirect_flows: {
      description,
      session_token: `tenant_${tenantId}_${Date.now()}`,
      success_redirect_url: successRedirectUrl,
      scheme: 'bacs', // UK Direct Debit
    },
  });

  const flow = result.redirect_flows;

  // Store the mandate record (pending)
  const mandate = await storage.createGocardlessMandate({
    tenantId,
    tenancyId: tenancyId || null,
    propertyId: propertyId || null,
    status: 'pending_submission',
    redirectFlowId: flow.id,
    redirectFlowUrl: flow.redirect_url,
  });

  return { redirectUrl: flow.redirect_url, mandateId: mandate.id };
}

/**
 * Complete a redirect flow after the tenant has authorised the mandate.
 * Call this from the success redirect URL callback.
 */
export async function completeRedirectFlow(redirectFlowId: string): Promise<{ mandateId: string; customerId: string }> {
  const result = await gcRequest('POST', `/redirect_flows/${redirectFlowId}/actions/complete`, {
    data: {
      session_token: redirectFlowId, // GoCardless requires this to match
    },
  });

  const flow = result.redirect_flows;
  const gcMandateId = flow.links.mandate;
  const gcCustomerId = flow.links.customer;

  // Get mandate details from GoCardless
  const mandateDetails = await gcRequest('GET', `/mandates/${gcMandateId}`);
  const mandateInfo = mandateDetails.mandates;

  // Find and update our mandate record
  const mandates = await storage.getAllGocardlessMandates();
  const ourMandate = mandates.find(m => m.redirectFlowId === redirectFlowId);

  if (ourMandate) {
    await storage.updateGocardlessMandate(ourMandate.id, {
      gocardlessMandateId: gcMandateId,
      gocardlessCustomerId: gcCustomerId,
      status: 'active',
      reference: mandateInfo.reference,
      bankName: mandateInfo.links?.customer_bank_account ? 'UK Bank' : undefined,
    });
  }

  return { mandateId: gcMandateId, customerId: gcCustomerId };
}

/**
 * Create a payment (collect money) from an active mandate for an invoice.
 */
export async function collectPayment(
  mandateDbId: number,
  invoiceId: number,
  amount: number, // pence
  description: string,
  chargeDate?: string // YYYY-MM-DD format, defaults to earliest possible
): Promise<{ gcPaymentId: string; dbPaymentId: number }> {
  const mandate = await storage.getGocardlessMandateByTenant(0); // we'll get by ID instead
  const mandates = await storage.getAllGocardlessMandates();
  const ourMandate = mandates.find(m => m.id === mandateDbId);

  if (!ourMandate || !ourMandate.gocardlessMandateId) {
    throw new Error('Mandate not found or not yet active');
  }

  if (ourMandate.status !== 'active') {
    throw new Error(`Mandate is not active (status: ${ourMandate.status})`);
  }

  const paymentBody: any = {
    payments: {
      amount: amount, // GoCardless uses pence for GBP
      currency: 'GBP',
      description,
      metadata: { invoice_id: String(invoiceId) },
      links: {
        mandate: ourMandate.gocardlessMandateId,
      },
    },
  };

  if (chargeDate) {
    paymentBody.payments.charge_date = chargeDate;
  }

  const result = await gcRequest('POST', '/payments', paymentBody);
  const gcPayment = result.payments;

  // Store in our database
  const dbPayment = await storage.createGocardlessPayment({
    mandateId: ourMandate.id,
    invoiceId,
    gocardlessPaymentId: gcPayment.id,
    amount,
    currency: 'GBP',
    description,
    chargeDate: gcPayment.charge_date ? new Date(gcPayment.charge_date) : null,
    status: gcPayment.status,
  });

  return { gcPaymentId: gcPayment.id, dbPaymentId: dbPayment.id };
}

/**
 * Cancel a mandate.
 */
export async function cancelMandate(mandateDbId: number): Promise<void> {
  const mandates = await storage.getAllGocardlessMandates();
  const ourMandate = mandates.find(m => m.id === mandateDbId);

  if (!ourMandate || !ourMandate.gocardlessMandateId) {
    throw new Error('Mandate not found');
  }

  await gcRequest('POST', `/mandates/${ourMandate.gocardlessMandateId}/actions/cancel`);

  await storage.updateGocardlessMandate(mandateDbId, {
    status: 'cancelled',
  });
}

/**
 * Verify GoCardless webhook signature.
 */
export function verifyWebhookSignature(body: string, signature: string): boolean {
  if (!GC_WEBHOOK_SECRET) return false;
  const computed = crypto
    .createHmac('sha256', GC_WEBHOOK_SECRET)
    .update(body)
    .digest('hex');
  return crypto.timingSafeEqual(Buffer.from(computed), Buffer.from(signature));
}

/**
 * Process GoCardless webhook events.
 * Handles mandate and payment status changes.
 */
export async function processWebhookEvents(events: any[]): Promise<{ processed: number; errors: number }> {
  let processed = 0;
  let errors = 0;

  for (const event of events) {
    try {
      const resourceType = event.resource_type;
      const action = event.action;

      if (resourceType === 'mandates') {
        await handleMandateEvent(event);
        processed++;
      } else if (resourceType === 'payments') {
        await handlePaymentEvent(event);
        processed++;
      } else {
        console.log(`Unhandled GoCardless webhook: ${resourceType}.${action}`);
        processed++;
      }
    } catch (e) {
      console.error('Error processing GoCardless webhook event:', e);
      errors++;
    }
  }

  return { processed, errors };
}

async function handleMandateEvent(event: any): Promise<void> {
  const gcMandateId = event.links?.mandate;
  if (!gcMandateId) return;

  const mandate = await storage.getGocardlessMandateByGcId(gcMandateId);
  if (!mandate) {
    console.warn(`GoCardless mandate ${gcMandateId} not found in database`);
    return;
  }

  const statusMap: Record<string, string> = {
    created: 'submitted',
    submitted: 'submitted',
    active: 'active',
    failed: 'failed',
    cancelled: 'cancelled',
    expired: 'expired',
    reinstated: 'active',
  };

  const newStatus = statusMap[event.action];
  if (newStatus) {
    await storage.updateGocardlessMandate(mandate.id, { status: newStatus });
  }
}

async function handlePaymentEvent(event: any): Promise<void> {
  const gcPaymentId = event.links?.payment;
  if (!gcPaymentId) return;

  const gcPayment = await storage.getGocardlessPaymentByGcId(gcPaymentId);
  if (!gcPayment) {
    console.warn(`GoCardless payment ${gcPaymentId} not found in database`);
    return;
  }

  const statusMap: Record<string, string> = {
    created: 'pending_submission',
    submitted: 'submitted',
    confirmed: 'confirmed',
    paid_out: 'paid_out',
    failed: 'failed',
    cancelled: 'cancelled',
    charged_back: 'failed',
  };

  const newStatus = statusMap[event.action];
  if (newStatus) {
    await storage.updateGocardlessPayment(gcPayment.id, { status: newStatus });
  }

  // When payment is confirmed, record it in our system and reconcile with invoice
  if (event.action === 'confirmed' && gcPayment.invoiceId) {
    const mandate = (await storage.getAllGocardlessMandates()).find(m => m.id === gcPayment.mandateId);
    if (mandate) {
      const result = await recordPaymentAndReconcile(
        {
          tenantId: mandate.tenantId,
          propertyId: mandate.propertyId || undefined,
          amount: gcPayment.amount,
          paymentMethod: 'direct_debit',
          reference: `GoCardless ${gcPaymentId}`,
          description: gcPayment.description || 'Direct Debit payment',
          paidAt: new Date(),
        },
        gcPayment.invoiceId
      );

      // Link payment ID back to GoCardless payment record
      await storage.updateGocardlessPayment(gcPayment.id, {
        paymentId: result.paymentId,
      });
    }
  }

  // Handle paid_out (funds arrived in our bank)
  if (event.action === 'paid_out') {
    await storage.updateGocardlessPayment(gcPayment.id, {
      paidOutAt: new Date(),
    });
  }
}
