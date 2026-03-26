import Stripe from 'stripe';
import { db } from './db';
import { payments, paymentSchedules } from '@shared/schema';
import { eq, desc } from 'drizzle-orm';
import { findInvoiceByReference, reconcileInvoicePayment } from './reconciliationEngine';

// Initialize Stripe with secret key
const stripeSecretKey = process.env.STRIPE_SECRET_KEY;

let stripe: Stripe | null = null;

if (stripeSecretKey && stripeSecretKey.startsWith('sk_')) {
  stripe = new Stripe(stripeSecretKey, {
    apiVersion: '2025-11-17.clover' as any,
  });
} else {
  console.log('Stripe not configured - Payment features disabled');
}

/**
 * Payment intent creation parameters
 */
export interface CreatePaymentIntentParams {
  amount: number; // in pence
  currency?: string;
  tenantId?: number;
  description?: string;
  metadata?: Record<string, string>;
}

/**
 * Create a payment intent for processing payments
 */
export async function createPaymentIntent(params: CreatePaymentIntentParams): Promise<{
  clientSecret: string;
  paymentIntentId: string;
} | null> {
  if (!stripe) {
    console.error('Stripe client not initialized. Please check STRIPE_SECRET_KEY environment variable.');
    return null;
  }

  try {
    const paymentIntent = await stripe.paymentIntents.create({
      amount: params.amount,
      currency: params.currency || 'gbp',
      automatic_payment_methods: {
        enabled: true,
      },
      description: params.description,
      metadata: params.metadata,
    });

    console.log(`Payment intent created: ${paymentIntent.id}`);

    return {
      clientSecret: paymentIntent.client_secret!,
      paymentIntentId: paymentIntent.id,
    };
  } catch (error) {
    console.error('Error creating payment intent:', error);
    return null;
  }
}

/**
 * Record a payment in the database
 */
export async function recordPayment(paymentData: {
  tenantId: number;
  propertyId?: number;
  landlordId?: number;
  amount: number; // integer pence
  currency?: string;
  paymentType: string;
  paymentMethod?: string;
  status: string;
  stripePaymentId?: string;
  description?: string;
  reference?: string;
  invoiceNumber?: string;
}): Promise<number | null> {
  try {
    const [payment] = await db.insert(payments).values({
      tenantId: paymentData.tenantId,
      propertyId: paymentData.propertyId,
      landlordId: paymentData.landlordId,
      amount: paymentData.amount,
      currency: paymentData.currency || 'GBP',
      paymentType: paymentData.paymentType,
      paymentMethod: paymentData.paymentMethod,
      status: paymentData.status,
      stripePaymentId: paymentData.stripePaymentId,
      description: paymentData.description,
      reference: paymentData.reference,
      invoiceNumber: paymentData.invoiceNumber,
      paidAt: paymentData.status === 'completed' ? new Date() : null,
    }).returning({ id: payments.id });

    console.log(`Payment recorded with ID: ${payment.id}`);
    return payment.id;
  } catch (error) {
    console.error('Error recording payment:', error);
    return null;
  }
}

/**
 * Update payment status by Stripe payment ID
 */
export async function updatePaymentStatus(
  stripePaymentId: string,
  status: string
): Promise<boolean> {
  try {
    const updateData: Record<string, any> = {
      status,
      updatedAt: new Date(),
    };
    if (status === 'completed') {
      updateData.paidAt = new Date();
    } else if (status === 'failed') {
      updateData.failedAt = new Date();
    } else if (status === 'refunded') {
      updateData.refundedAt = new Date();
    }

    await db.update(payments)
      .set(updateData)
      .where(eq(payments.stripePaymentId, stripePaymentId));

    console.log(`Payment ${stripePaymentId} status updated to: ${status}`);
    return true;
  } catch (error) {
    console.error('Error updating payment status:', error);
    return false;
  }
}

/**
 * Get payments for a tenant
 */
export async function getPaymentsByTenant(tenantId: number) {
  try {
    return await db.select()
      .from(payments)
      .where(eq(payments.tenantId, tenantId))
      .orderBy(desc(payments.createdAt));
  } catch (error) {
    console.error('Error fetching tenant payments:', error);
    return [];
  }
}

/**
 * Get payment schedules for a tenant
 */
export async function getSchedulesByTenant(tenantId: number) {
  try {
    return await db.select()
      .from(paymentSchedules)
      .where(eq(paymentSchedules.tenantId, tenantId))
      .orderBy(paymentSchedules.nextDueDate);
  } catch (error) {
    console.error('Error fetching payment schedules:', error);
    return [];
  }
}

/**
 * Create a payment schedule
 */
export async function createPaymentSchedule(scheduleData: {
  tenantId: number;
  propertyId: number;
  amount: number; // integer pence
  paymentType: string;
  frequency: string;
  startDate: Date;
  endDate?: Date;
  nextDueDate?: Date;
  dayOfMonth?: number;
  paymentMethod?: string;
}): Promise<number | null> {
  try {
    const [schedule] = await db.insert(paymentSchedules).values({
      tenantId: scheduleData.tenantId,
      propertyId: scheduleData.propertyId,
      amount: scheduleData.amount,
      paymentType: scheduleData.paymentType,
      frequency: scheduleData.frequency,
      startDate: scheduleData.startDate,
      endDate: scheduleData.endDate,
      nextDueDate: scheduleData.nextDueDate || scheduleData.startDate,
      dayOfMonth: scheduleData.dayOfMonth,
      paymentMethod: scheduleData.paymentMethod,
      status: 'active',
    }).returning({ id: paymentSchedules.id });

    console.log(`Payment schedule created with ID: ${schedule.id}`);
    return schedule.id;
  } catch (error) {
    console.error('Error creating payment schedule:', error);
    return null;
  }
}

/**
 * Process webhook events from Stripe
 */
export async function handleStripeWebhook(event: Stripe.Event): Promise<boolean> {
  try {
    switch (event.type) {
      case 'payment_intent.succeeded':
        const paymentIntent = event.data.object as Stripe.PaymentIntent;
        await updatePaymentStatus(paymentIntent.id, 'completed');
        console.log(`Payment ${paymentIntent.id} succeeded`);

        // Auto-reconcile: check if metadata contains an invoice reference
        // Stripe payment links / checkout sessions should include invoice_number in metadata
        const invoiceRef = paymentIntent.metadata?.invoice_number;
        if (invoiceRef) {
          const invoice = await findInvoiceByReference(invoiceRef);
          if (invoice) {
            await reconcileInvoicePayment(
              invoice.id,
              paymentIntent.amount, // Stripe amount is in smallest currency unit (pence for GBP)
              paymentIntent.id,
              'stripe'
            );
          }
        }
        break;

      case 'payment_intent.payment_failed':
        const failedIntent = event.data.object as Stripe.PaymentIntent;
        await updatePaymentStatus(failedIntent.id, 'failed');
        console.log(`Payment ${failedIntent.id} failed`);
        break;

      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    return true;
  } catch (error) {
    console.error('Error handling webhook:', error);
    return false;
  }
}

/**
 * Get Stripe publishable key
 */
export function getPublishableKey(): string | null {
  return process.env.STRIPE_PUBLISHABLE_KEY || null;
}

/**
 * Check if Stripe is configured
 */
export function isStripeConfigured(): boolean {
  return stripe !== null;
}
