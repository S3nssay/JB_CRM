import Stripe from 'stripe';
import { db } from './db';
import { payments, paymentSchedules } from '@shared/schema';
import { eq } from 'drizzle-orm';

// Initialize Stripe with secret key
const stripeSecretKey = process.env.STRIPE_SECRET_KEY;

let stripe: Stripe | null = null;

if (stripeSecretKey && stripeSecretKey.startsWith('sk_')) {
  stripe = new Stripe(stripeSecretKey, {
    apiVersion: '2023-10-16',
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
  customerId?: number;
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
  customerId: number;
  propertyId?: number;
  amount: number;
  currency?: string;
  paymentType: string;
  status: string;
  stripePaymentIntentId?: string;
  description?: string;
}): Promise<number | null> {
  try {
    const [payment] = await db.insert(payments).values({
      customerId: paymentData.customerId,
      propertyId: paymentData.propertyId,
      amount: paymentData.amount.toString(),
      currency: paymentData.currency || 'GBP',
      paymentType: paymentData.paymentType,
      status: paymentData.status,
      stripePaymentIntentId: paymentData.stripePaymentIntentId,
      description: paymentData.description,
      paymentDate: new Date(),
    }).returning({ id: payments.id });

    console.log(`Payment recorded with ID: ${payment.id}`);
    return payment.id;
  } catch (error) {
    console.error('Error recording payment:', error);
    return null;
  }
}

/**
 * Update payment status
 */
export async function updatePaymentStatus(
  paymentIntentId: string,
  status: string
): Promise<boolean> {
  try {
    await db.update(payments)
      .set({
        status,
        updatedAt: new Date()
      })
      .where(eq(payments.stripePaymentIntentId, paymentIntentId));

    console.log(`Payment ${paymentIntentId} status updated to: ${status}`);
    return true;
  } catch (error) {
    console.error('Error updating payment status:', error);
    return false;
  }
}

/**
 * Get payments for a customer
 */
export async function getCustomerPayments(customerId: number) {
  try {
    return await db.select()
      .from(payments)
      .where(eq(payments.customerId, customerId))
      .orderBy(payments.paymentDate);
  } catch (error) {
    console.error('Error fetching customer payments:', error);
    return [];
  }
}

/**
 * Get payment schedules for a customer
 */
export async function getPaymentSchedules(customerId: number) {
  try {
    return await db.select()
      .from(paymentSchedules)
      .where(eq(paymentSchedules.customerId, customerId))
      .orderBy(paymentSchedules.dueDate);
  } catch (error) {
    console.error('Error fetching payment schedules:', error);
    return [];
  }
}

/**
 * Create a payment schedule
 */
export async function createPaymentSchedule(scheduleData: {
  customerId: number;
  propertyId?: number;
  amount: number;
  currency?: string;
  scheduleType: string;
  frequency: string;
  dueDate: Date;
  description?: string;
}): Promise<number | null> {
  try {
    const [schedule] = await db.insert(paymentSchedules).values({
      customerId: scheduleData.customerId,
      propertyId: scheduleData.propertyId,
      amount: scheduleData.amount.toString(),
      currency: scheduleData.currency || 'GBP',
      scheduleType: scheduleData.scheduleType,
      frequency: scheduleData.frequency,
      dueDate: scheduleData.dueDate,
      description: scheduleData.description,
      status: 'pending',
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
