import { db } from './db.js';
import { properties } from '@shared/schema';
import { eq } from 'drizzle-orm';
import { collaborationHub } from './collaborationHubService.js';
import { unifiedCommunicationService } from './services/unifiedCommunicationService.js';

/**
 * Format a currency value for display
 */
function formatPrice(amount: number | null): string {
  if (!amount) return 'Price on Application';
  return new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP', maximumFractionDigits: 0 }).format(amount);
}

/**
 * Send a rich property card via WhatsApp
 * Used by: voice agent during calls, WhatsApp AI agent, CRM manual send
 */
export async function sendPropertyCardWhatsApp(
  propertyId: number,
  phone: string,
  options?: {
    staffUserId?: number;
    entityType?: 'tenant' | 'landlord' | 'lead' | 'property' | 'maintenance';
    entityId?: number;
  }
): Promise<{ success: boolean; message?: string; error?: string }> {
  try {
    // Fetch property from database
    const [property] = await db
      .select()
      .from(properties)
      .where(eq(properties.id, propertyId))
      .limit(1);

    if (!property) {
      return { success: false, error: `Property ${propertyId} not found` };
    }

    // Build rich property card message
    const isRental = property.isListedRental || property.isRental;
    const price = isRental
      ? `${formatPrice(property.rentAmount)} ${property.rentPeriod || 'pcm'}`
      : formatPrice(property.price);

    const features: string[] = [];
    if (property.bedrooms) features.push(`${property.bedrooms} bed`);
    if (property.bathrooms) features.push(`${property.bathrooms} bath`);
    if (property.receptions) features.push(`${property.receptions} reception`);
    if (property.squareFootage) features.push(`${property.squareFootage} sq ft`);

    const propertyUrl = `${process.env.BASE_URL || 'https://johnbarclay.co.uk'}/property/${propertyId}`;

    const message = [
      `🏠 *${property.title || property.address || 'Property Details'}*`,
      '',
      `📍 ${property.addressLine1 || property.address || ''}${property.city ? ', ' + property.city : ''}${property.postcode ? ' ' + property.postcode : ''}`,
      `💷 ${price}`,
      `🏘️ ${property.propertyType || 'Property'}${features.length ? ' | ' + features.join(' | ') : ''}`,
      '',
      property.description
        ? property.description.substring(0, 200) + (property.description.length > 200 ? '...' : '')
        : '',
      '',
      `🔗 View full details: ${propertyUrl}`,
      '',
      `📞 Call us: ${process.env.TWILIO_PHONE_NUMBER || '+442046345656'}`,
      `_Sent by John Barclay Estate Agents_`,
    ].filter(Boolean).join('\n');

    // Send via WhatsApp
    const result = await collaborationHub.sendWhatsAppMessage(phone, message);

    if (!result.success) {
      return { success: false, error: result.error || 'WhatsApp send failed' };
    }

    // Log to unified communications table if entity context provided
    if (options?.entityType && options?.entityId) {
      await unifiedCommunicationService.logManual({
        channel: 'whatsapp',
        direction: 'outbound',
        content: message,
        entityType: options.entityType,
        entityId: options.entityId,
        staffUserId: options.staffUserId || 0,
        externalMessageId: result.messageId,
      });
    }

    return {
      success: true,
      message: `Property card for "${property.title || property.address}" sent via WhatsApp`,
    };
  } catch (error: any) {
    console.error('[PropertyCard] Failed to send WhatsApp property card:', error.message);
    return { success: false, error: error.message };
  }
}
