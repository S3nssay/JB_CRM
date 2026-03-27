import dotenv from 'dotenv';
dotenv.config({ override: true });

import twilio from 'twilio';
import https from 'https';

// Initialize Twilio client with credentials
const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const fromNumber = process.env.TWILIO_PHONE_NUMBER;

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
  // Create a client with our options
  twilioClient = twilio(accountSid, authToken);

  // Configure Twilio agent with long timeouts (workaround for Replit network issues)
  // @ts-ignore - The httpsAgent property exists but TypeScript definitions might be outdated
  twilioClient.httpClient.agent = httpsAgent;
} else {
  console.log('Twilio not configured - SMS features disabled');
}

/**
 * Interface for property offer details to be sent via SMS
 */
export interface PropertyOfferDetails {
  address: string;
  marketValue: number;
  offerPrice: number;
  discountAmount: number;
  discountPercentage: number;
  phoneNumber: string;
  customerName?: string;
}

/**
 * Send a property offer via SMS
 */
export async function sendPropertyOfferSMS(offerDetails: PropertyOfferDetails): Promise<boolean> {
  // Log Twilio configuration (without exposing sensitive details)
  console.log(`Twilio Configuration:
    - Account SID: ${accountSid ? '********' + accountSid.substring(accountSid.length - 4) : 'not set'}
    - Auth Token: ${authToken ? '********' : 'not set'}
    - From Number: ${fromNumber || 'not set'}
  `);

  try {
    if (!twilioClient || !fromNumber) {
      console.error('Twilio not properly configured. Check TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, and TWILIO_PHONE_NUMBER environment variables.');
      return false;
    }

    // Format the offer details into a message
    const message = generateOfferMessage(offerDetails);
    
    // Format the number we're sending to
    const toNumber = formatPhoneNumber(offerDetails.phoneNumber);
    console.log(`Attempting to send SMS to: ${toNumber}`);

    // Send the SMS via Twilio
    const result = await twilioClient.messages.create({
      body: message,
      from: fromNumber,
      to: toNumber
    });

    console.log(`SMS sent successfully: ${result.sid}`);
    return true;
  } catch (err) {
    // Type the error for better handling
    const error = err as any;
    console.error('Error sending SMS:', error);
    
    // Add more detailed error information
    if (error.code) {
      console.error(`Twilio Error Code: ${error.code}`);
    }
    
    if (error.message) {
      console.error(`Error Message: ${error.message}`);
    }
    
    if (error.status) {
      console.error(`HTTP Status: ${error.status}`);
    }
    
    if (error.moreInfo) {
      console.error(`More Info: ${error.moreInfo}`);
    }
    
    return false;
  }
}

/**
 * Generate a formatted message for the property offer
 */
function generateOfferMessage(offer: PropertyOfferDetails): string {
  const name = offer.customerName ? `${offer.customerName}, ` : '';
  const formattedMarketValue = formatCurrency(offer.marketValue);
  const formattedOfferPrice = formatCurrency(offer.offerPrice);
  const formattedDiscount = formatCurrency(offer.discountAmount);

  return `
${name}thank you for requesting a valuation from CashPropertyBuyers.uk!

Property: ${offer.address}
Estimated Market Value (Based on Land Registry data): ${formattedMarketValue}
Our Cash Offer: ${formattedOfferPrice}
(${offer.discountPercentage}% discount of ${formattedDiscount})

This estimate is based on Land Registry records, but we're confident we may be able to offer you a better price after discussing your property in more detail.

One of our property specialists will call you within 24 hours to discuss this offer. We can complete your sale in just 7-28 days compared to the traditional 6-9 month selling process.

This offer is valid for 7 days. For immediate assistance, please call us on 01977 285 111.

CashPropertyBuyers.uk - Fast Cash Sales in 7-28 Days
22 Bank Street, Castleford WF10 1JD
  `.trim();
}

/**
 * Format a currency value in GBP
 */
function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: 'GBP',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(amount);
}

/**
 * Format a UK phone number ensuring it has the country code
 */
function formatPhoneNumber(phoneNumber: string): string {
  // Strip all non-digit characters
  const digitsOnly = phoneNumber.replace(/\D/g, '');
  
  // If it starts with '0', replace with UK country code
  if (digitsOnly.startsWith('0')) {
    return '+44' + digitsOnly.substring(1);
  }
  
  // If no country code, add UK by default
  if (!digitsOnly.startsWith('44')) {
    return '+44' + digitsOnly;
  }
  
  // Otherwise ensure it has a + prefix
  return digitsOnly.startsWith('+') ? digitsOnly : '+' + digitsOnly;
}