/**
 * Payment Link Service
 *
 * Generates payment links for arrears cases via Stripe (one-off payments)
 * or GoCardless (existing Direct Debit mandates). Auto-detects the best
 * method based on whether the tenant already has an active GC mandate.
 */

import Stripe from 'stripe';
import { db } from '../../db';
import { gocardlessMandates, gocardlessPayments } from '@shared/schema';
import { eq, and } from 'drizzle-orm';

// ---- Stripe lazy init (same pattern as paymentService.ts) ----

let stripe: Stripe | null = null;

function getStripe(): Stripe | null {
  if (stripe) return stripe;
  const key = process.env.STRIPE_SECRET_KEY;
  if (key && key.startsWith('sk_')) {
    stripe = new Stripe(key, { apiVersion: '2025-11-17.clover' as any });
  }
  return stripe;
}

// ---- GoCardless helper (lazy import) ----

async function gcRequest(method: string, path: string, body?: any): Promise<any> {
  const gcMod = await import('../../gocardlessService');
  if (!gcMod.isGoCardlessConfigured()) return null;
  // Use the module-level gcRequest via dynamic import hack:
  // gocardlessService exports gcRequest only internally, so we call collectPayment
  // Instead we'll replicate the fetch call pattern here for arrears-specific collections
  const GC_ACCESS_TOKEN = process.env.GOCARDLESS_ACCESS_TOKEN;
  if (!GC_ACCESS_TOKEN) return null;

  const GC_ENVIRONMENT = process.env.GOCARDLESS_ENVIRONMENT || 'sandbox';
  const GC_BASE_URL = GC_ENVIRONMENT === 'live'
    ? 'https://api.gocardless.com'
    : 'https://api-sandbox.gocardless.com';

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

// ---- PaymentLinkService ----

export class PaymentLinkService {
  /**
   * Generate a Stripe Payment Link for a one-off arrears payment.
   */
  async generateStripeLink(
    amount: number,
    tenantId: number,
    arrearsId: number,
    description: string,
  ): Promise<{ url: string; paymentLinkId: string } | null> {
    const s = getStripe();
    if (!s) {
      console.warn('[PaymentLinkService] Stripe not configured -- cannot generate payment link');
      return null;
    }

    try {
      const paymentLink = await s.paymentLinks.create({
        line_items: [{
          price_data: {
            currency: 'gbp',
            product_data: { name: description },
            unit_amount: amount,
          },
          quantity: 1,
        }],
        metadata: {
          tenantId: String(tenantId),
          arrearsId: String(arrearsId),
          type: 'arrears_payment',
        },
        after_completion: {
          type: 'redirect',
          redirect: {
            url: `${process.env.APP_URL || 'https://johnbarclay.co.uk'}/payment/thank-you`,
          },
        },
      });

      return { url: paymentLink.url, paymentLinkId: paymentLink.id };
    } catch (err) {
      console.error('[PaymentLinkService] Stripe payment link creation failed:', err);
      return null;
    }
  }

  /**
   * Collect a payment via GoCardless against an existing Direct Debit mandate.
   */
  async collectViaGoCardless(
    mandateDbId: number,
    amount: number,
    arrearsId: number,
    description: string,
  ): Promise<{ paymentId: string; status: string } | null> {
    try {
      // Look up the mandate to get the GoCardless mandate ID
      const mandateRows = await db
        .select()
        .from(gocardlessMandates)
        .where(eq(gocardlessMandates.id, mandateDbId))
        .limit(1);

      if (mandateRows.length === 0 || !mandateRows[0].gocardlessMandateId) {
        console.warn('[PaymentLinkService] Mandate not found or not yet active');
        return null;
      }

      const gcMandateId = mandateRows[0].gocardlessMandateId;

      const result = await gcRequest('POST', '/payments', {
        payments: {
          amount,
          currency: 'GBP',
          description,
          links: { mandate: gcMandateId },
          metadata: { arrearsId: String(arrearsId) },
        },
      });

      if (!result) return null;

      const gcPayment = result.payments;

      // Store in our database
      await db.insert(gocardlessPayments).values({
        mandateId: mandateDbId,
        gocardlessPaymentId: gcPayment.id,
        amount,
        currency: 'GBP',
        description,
        status: gcPayment.status || 'pending_submission',
      });

      return { paymentId: gcPayment.id, status: gcPayment.status || 'pending_submission' };
    } catch (err) {
      console.error('[PaymentLinkService] GoCardless collection failed:', err);
      return null;
    }
  }

  /**
   * Auto-detect the best payment method for a tenant and generate/collect accordingly.
   * If tenant has an active GoCardless mandate, collect via GC.
   * Otherwise, generate a Stripe payment link.
   */
  async generateLink(
    tenantId: number,
    arrearsId: number,
    amount: number,
  ): Promise<{ url: string | null; method: 'stripe' | 'gocardless'; paymentRef: string | null }> {
    // Check for active GoCardless mandate
    try {
      const mandateRows = await db
        .select()
        .from(gocardlessMandates)
        .where(
          and(
            eq(gocardlessMandates.tenantId, tenantId),
            eq(gocardlessMandates.status, 'active'),
          ),
        )
        .limit(1);

      if (mandateRows.length > 0) {
        const gcResult = await this.collectViaGoCardless(
          mandateRows[0].id,
          amount,
          arrearsId,
          `Arrears payment - John Barclay Estate Agents`,
        );

        if (gcResult) {
          return { url: null, method: 'gocardless', paymentRef: gcResult.paymentId };
        }
      }
    } catch (err) {
      console.warn('[PaymentLinkService] GoCardless mandate check failed, falling back to Stripe:', err);
    }

    // Fall back to Stripe
    const stripeResult = await this.generateStripeLink(
      amount,
      tenantId,
      arrearsId,
      'Rent arrears payment - John Barclay Estate Agents',
    );

    if (stripeResult) {
      return { url: stripeResult.url, method: 'stripe', paymentRef: stripeResult.paymentLinkId };
    }

    // Neither configured
    console.warn('[PaymentLinkService] Neither Stripe nor GoCardless configured');
    return { url: null, method: 'stripe', paymentRef: null };
  }
}

/** Singleton instance */
export const paymentLinkService = new PaymentLinkService();
