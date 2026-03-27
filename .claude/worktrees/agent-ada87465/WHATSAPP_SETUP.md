# WhatsApp Business API Setup Guide

## Overview
Your CashPropertyBuyers.uk application is configured to send property valuations via WhatsApp instead of email. This provides instant delivery and higher engagement rates.

## Current Status
- WhatsApp integration code: ✅ Complete
- Twilio credentials: ✅ Configured
- WhatsApp Business API: ⏳ Needs setup

## Step-by-Step Setup

### 1. Apply for WhatsApp Business API Access
1. Log into your Twilio Console: https://console.twilio.com
2. Navigate to "Messaging" → "Try it out" → "Send a WhatsApp message"
3. Click "Request Access to WhatsApp"
4. Complete the business verification form with these details:
   - Business Name: CashPropertyBuyers.uk
   - Business Type: Real Estate Services
   - Use Case: Property valuation notifications
   - Monthly Volume: Expected message volume

### 2. Business Verification Requirements
Twilio will require:
- Business registration documents
- Proof of business address
- Business website (cashpropertybuyers.uk)
- Valid business phone number
- Business email address

### 3. WhatsApp Business Profile Setup
Once approved, configure your business profile:
- Business Name: CashPropertyBuyers.uk
- Business Description: "Fast cash property buyers - Get your valuation in minutes"
- Business Category: Real Estate
- Business Address: Your registered business address
- Website: https://cashpropertybuyers.uk

### 4. Get Your WhatsApp Business Number
After approval, Twilio will provide:
- A dedicated WhatsApp Business phone number
- This number will be in format: whatsapp:+44XXXXXXXXXX

### 5. Update Environment Variables
Once you receive your WhatsApp Business number, add it to your secrets:
```
TWILIO_WHATSAPP_NUMBER=whatsapp:+44XXXXXXXXXX
```

### 6. Message Template Approval (Optional)
For higher volume usage, you may want to create approved message templates:
- Property valuation confirmation
- Follow-up messages
- Appointment scheduling

## Testing Your Setup

### Test with Sandbox (Current)
Currently using Twilio sandbox number. Recipients must:
1. Send "join <sandbox-code>" to your Twilio WhatsApp number
2. Then they can receive messages

### Test with Business API (After Setup)
Once approved, test with:
```bash
curl -X POST http://localhost:5000/api/test-whatsapp \
  -H "Content-Type: application/json" \
  -d '{"phoneNumber": "+447376153163"}'
```

## Benefits of WhatsApp Business API

### For Your Business:
- Higher open rates (98% vs 20% for email)
- Instant delivery confirmation
- Read receipts
- Professional business verification
- Customer support via WhatsApp

### For Your Customers:
- Instant notifications on their phone
- No email to check or lose in spam
- Can reply directly to ask questions
- Familiar messaging platform

## Expected Timeline
- Application submission: 5 minutes
- Business verification: 1-3 business days
- WhatsApp approval: 1-2 business days
- Total setup time: 2-5 business days

## Next Steps
1. Submit your WhatsApp Business API application today
2. Prepare your business verification documents
3. Once approved, update your TWILIO_WHATSAPP_NUMBER
4. Test the integration with your phone number
5. Monitor delivery rates and customer engagement

## Support
If you encounter issues during setup:
- Twilio WhatsApp Business API documentation
- Twilio support team via console
- WhatsApp Business API requirements guide

## Current Message Format
Your property valuations will be sent with this format:

```
Hi [Customer Name]! 🏠

Your property valuation is ready:

📍 Property: [Address]
💷 Market Value: £[Amount]
💰 Our Cash Offer: £[Amount]
📊 Savings vs Estate Agent: £[Amount] ([X]% faster sale)

⚡ Why choose us?
• Cash payment in 7-28 days
• No estate agent fees
• No surveys or valuations needed
• Complete in weeks, not months

📞 Ready to proceed? Reply to this message or call us to discuss your sale.

CashPropertyBuyers.uk
The faster way to sell your home
```

This professional format ensures high engagement and clear communication of your value proposition.