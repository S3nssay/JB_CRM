import dotenv from 'dotenv';
dotenv.config({ override: true });

import twilio from 'twilio';
import https from 'https';

// Initialize Twilio client with credentials
const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const fromWhatsApp = process.env.TWILIO_WHATSAPP_NUMBER || 'whatsapp:+14155238886'; // Will be updated with your business number

let twilioClient: twilio.Twilio | null = null;

// Create a custom HTTPS agent with longer timeout and keepalive
const httpsAgent = new https.Agent({
  keepAlive: true,
  keepAliveMsecs: 3000,
  timeout: 60000, // 60 seconds
  maxSockets: 5,
  rejectUnauthorized: false // Allow self-signed certificates
});

// Initialize the client only if valid credentials are provided
if (accountSid && authToken && accountSid.startsWith('AC')) {
  twilioClient = twilio(accountSid, authToken);

  // Configure Twilio agent with long timeouts
  // @ts-ignore
  twilioClient.httpClient.agent = httpsAgent;
} else {
  console.log('Twilio not configured - WhatsApp features disabled');
}

/**
 * Interface for property offer details to be sent via WhatsApp
 */
export interface PropertyOfferWhatsAppDetails {
  address: string;
  marketValue: number;
  offerPrice: number;
  discountAmount: number;
  discountPercentage: number;
  phoneNumber: string;
  customerName?: string;
}

/**
 * Interface for property details to be sent via WhatsApp
 */
export interface PropertyDetailsWhatsAppMessage {
  propertyId: number;
  title: string;
  price: number;
  propertyType: string;
  bedrooms: number;
  bathrooms: number;
  address: string;
  description: string;
  features: string[];
  phoneNumber: string;
  customerName?: string;
}

/**
 * Interface for property alert via WhatsApp
 */
export interface PropertyAlertWhatsAppMessage {
  phoneNumber: string;
  customerName?: string;
  criteria: {
    minPrice?: number;
    maxPrice?: number;
    propertyType?: string;
    bedrooms?: number;
    area?: string;
  };
}

/**
 * Send a property offer via WhatsApp
 */
export async function sendPropertyOfferWhatsApp(offerDetails: PropertyOfferWhatsAppDetails): Promise<boolean> {
  if (!twilioClient) {
    console.error('Twilio client not initialized. Please check TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN environment variables.');
    return false;
  }

  try {
    console.log(`Sending WhatsApp message to ${offerDetails.phoneNumber}`);
    
    const message = generateWhatsAppOfferMessage(offerDetails);
    const toWhatsApp = `whatsapp:${formatPhoneNumber(offerDetails.phoneNumber)}`;
    
    const result = await twilioClient.messages.create({
      body: message,
      from: fromWhatsApp,
      to: toWhatsApp
    });

    console.log(`WhatsApp message sent successfully. SID: ${result.sid}`);
    return true;
    
  } catch (error) {
    console.error('Error sending WhatsApp message:', error);
    return false;
  }
}

/**
 * Generate a formatted WhatsApp message for the property offer
 */
function generateWhatsAppOfferMessage(offer: PropertyOfferWhatsAppDetails): string {
  const customerGreeting = offer.customerName ? `Hi ${offer.customerName}` : 'Hello';
  
  return `${customerGreeting}! 🏠

Your property valuation is ready:

📍 *Property:* ${offer.address}
💷 *Market Value:* ${formatCurrency(offer.marketValue)}
💰 *Our Cash Offer:* ${formatCurrency(offer.offerPrice)}
📊 *Savings vs Estate Agent:* ${formatCurrency(offer.discountAmount)} (${offer.discountPercentage}% faster sale)

⚡ *Why choose us?*
• Cash payment in 7-28 days
• No estate agent fees
• No surveys or valuations needed
• Complete in weeks, not months

📞 Ready to proceed? Reply to this message or call us to discuss your sale.

*CashPropertyBuyers.uk*
The faster way to sell your home`;
}

/**
 * Format a currency value in GBP
 */
function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: 'GBP',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

/**
 * Format a UK phone number ensuring it has the country code
 */
function formatPhoneNumber(phoneNumber: string): string {
  // Remove all non-digit characters
  let cleaned = phoneNumber.replace(/\D/g, '');
  
  // Handle UK numbers
  if (cleaned.startsWith('0')) {
    // Replace leading 0 with +44
    cleaned = '+44' + cleaned.substring(1);
  } else if (cleaned.startsWith('44')) {
    // Add + if missing
    cleaned = '+' + cleaned;
  } else if (!cleaned.startsWith('+44')) {
    // Assume it's a UK number without country code
    cleaned = '+44' + cleaned;
  }
  
  return cleaned;
}

/**
 * Send property details via WhatsApp
 */
export async function sendPropertyDetailsWhatsApp(propertyDetails: PropertyDetailsWhatsAppMessage): Promise<boolean> {
  if (!twilioClient) {
    console.error('Twilio client not initialized. Please check TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN environment variables.');
    return false;
  }

  try {
    console.log(`Sending property details via WhatsApp to ${propertyDetails.phoneNumber}`);

    const message = generatePropertyDetailsMessage(propertyDetails);
    const toWhatsApp = `whatsapp:${formatPhoneNumber(propertyDetails.phoneNumber)}`;

    const result = await twilioClient.messages.create({
      body: message,
      from: fromWhatsApp,
      to: toWhatsApp
    });

    console.log(`Property details WhatsApp message sent successfully. SID: ${result.sid}`);
    return true;

  } catch (error) {
    console.error('Error sending property details WhatsApp message:', error);
    return false;
  }
}

/**
 * Send property alert setup confirmation via WhatsApp
 */
export async function sendPropertyAlertWhatsApp(alertDetails: PropertyAlertWhatsAppMessage): Promise<boolean> {
  if (!twilioClient) {
    console.error('Twilio client not initialized. Please check TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN environment variables.');
    return false;
  }

  try {
    console.log(`Sending property alert confirmation via WhatsApp to ${alertDetails.phoneNumber}`);

    const message = generatePropertyAlertMessage(alertDetails);
    const toWhatsApp = `whatsapp:${formatPhoneNumber(alertDetails.phoneNumber)}`;

    const result = await twilioClient.messages.create({
      body: message,
      from: fromWhatsApp,
      to: toWhatsApp
    });

    console.log(`Property alert WhatsApp message sent successfully. SID: ${result.sid}`);
    return true;

  } catch (error) {
    console.error('Error sending property alert WhatsApp message:', error);
    return false;
  }
}

/**
 * Generate a formatted WhatsApp message for property details
 */
function generatePropertyDetailsMessage(property: PropertyDetailsWhatsAppMessage): string {
  const customerGreeting = property.customerName ? `Hi ${property.customerName}` : 'Hello';
  const featuresText = property.features.length > 0 ? property.features.slice(0, 5).join(', ') : 'Contact us for more details';

  return `${customerGreeting}! 🏠

Here are the details for the property you're interested in:

🏡 *${property.title}*
💷 *Price:* ${formatCurrency(property.price)}
📍 *Address:* ${property.address}

🔍 *Property Details:*
• Type: ${property.propertyType}
• Bedrooms: ${property.bedrooms}
• Bathrooms: ${property.bathrooms}

✨ *Key Features:* ${featuresText}

📝 *Description:* ${property.description}

💬 *Interested?* Reply to this message or call us to arrange a viewing!

*John Barclay Estate Agents*
Your premium property experts`;
}

/**
 * Generate a formatted WhatsApp message for property alert setup
 */
function generatePropertyAlertMessage(alert: PropertyAlertWhatsAppMessage): string {
  const customerGreeting = alert.customerName ? `Hi ${alert.customerName}` : 'Hello';
  const criteria = alert.criteria;

  let criteriaText = [];
  if (criteria.minPrice || criteria.maxPrice) {
    const priceRange = criteria.minPrice && criteria.maxPrice
      ? `${formatCurrency(criteria.minPrice)} - ${formatCurrency(criteria.maxPrice)}`
      : criteria.minPrice
        ? `From ${formatCurrency(criteria.minPrice)}`
        : `Up to ${formatCurrency(criteria.maxPrice)}`;
    criteriaText.push(`• Price: ${priceRange}`);
  }
  if (criteria.propertyType) criteriaText.push(`• Type: ${criteria.propertyType}`);
  if (criteria.bedrooms) criteriaText.push(`• Bedrooms: ${criteria.bedrooms}+`);
  if (criteria.area) criteriaText.push(`• Area: ${criteria.area}`);

  return `${customerGreeting}! 🔔

Your property alert has been set up successfully!

🎯 *Your Search Criteria:*
${criteriaText.join('\n')}

📱 *What happens next?*
• We'll send you WhatsApp messages when new properties match your criteria
• You'll be among the first to know about new listings
• You can update or cancel this alert anytime

📞 *Need help?* Reply to this message or call us!

*John Barclay Estate Agents*
Never miss your perfect property!`;
}