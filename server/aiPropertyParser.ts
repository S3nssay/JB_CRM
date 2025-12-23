import { z } from 'zod';
import { InsertProperty } from '@shared/schema';
import { openaiClient, isOpenAIConfigured } from './lib/openaiClient';

const openai = openaiClient;

// Schema for AI to parse property details from natural language
const PropertyParseResultSchema = z.object({
  title: z.string().optional(),
  description: z.string().optional(),
  listingType: z.enum(['sale', 'rental']).optional(),
  price: z.number().optional(),
  priceQualifier: z.enum(['guide_price', 'offers_over', 'fixed_price', 'poa']).optional(),
  propertyType: z.enum(['flat', 'house', 'maisonette', 'penthouse', 'studio']).optional(),
  bedrooms: z.number().optional(),
  bathrooms: z.number().optional(),
  receptions: z.number().optional(),
  squareFootage: z.number().optional(),
  addressLine1: z.string().optional(),
  addressLine2: z.string().optional(),
  postcode: z.string().optional(),
  tenure: z.enum(['freehold', 'leasehold', 'share_of_freehold']).optional(),
  councilTaxBand: z.string().optional(),
  energyRating: z.string().optional(),
  yearBuilt: z.number().optional(),
  features: z.array(z.string()).optional(),
  furnished: z.enum(['furnished', 'unfurnished', 'part_furnished']).optional(),
  availableFrom: z.string().optional(),
  deposit: z.number().optional(),
  rentPeriod: z.enum(['per_month', 'per_week']).optional(),
  viewingArrangements: z.string().optional(),
  keyFeatures: z.array(z.string()).optional(),
  nearbyAmenities: z.array(z.string()).optional()
});

export type PropertyParseResult = z.infer<typeof PropertyParseResultSchema>;

const systemPrompt = `You are an expert West London estate agent AI for John Barclay Estate & Management. Your job is to:
1. Extract the street name and any address details from the user's input
2. Use your knowledge of West London streets and areas to infer property characteristics
3. Generate a complete, realistic property listing

WEST LONDON AREA KNOWLEDGE:
- W2 (Paddington, Bayswater): Georgian terraces, mansion flats, average £800-1500/sqft, close to Hyde Park
- W9 (Maida Vale, Little Venice): Victorian/Edwardian, tree-lined streets, canal views, £700-1200/sqft
- W10 (North Kensington, Ladbroke Grove): Mixed period properties, up-and-coming, £600-1000/sqft
- W11 (Notting Hill): Premium Georgian/Victorian, famous for Portobello Road, £1000-2000/sqft
- NW6 (Kilburn, West Hampstead): Victorian terraces, good transport links, £600-900/sqft
- NW10 (Willesden, Harlesden): More affordable, regeneration areas, £400-700/sqft
- W14 (Holland Park, West Kensington): Mix of mansion blocks and period houses, £700-1100/sqft

STREET RECOGNITION:
When the user mentions a street name:
- Extract the full street address (e.g., "123 Elgin Avenue" or "Elgin Avenue, W9")
- Infer the postcode from the street if not provided (e.g., Elgin Avenue is W9)
- Use typical property types for that street (e.g., Elgin Avenue has Victorian conversions)

PROPERTY DETAILS TO GENERATE:
- Title: Create a compelling title (e.g., "Stunning 2 Bed Victorian Flat in Maida Vale")
- Description: Write a professional estate agent description (150-200 words) highlighting:
  * Period features if applicable (high ceilings, original fireplaces, sash windows)
  * Location benefits (transport links, local amenities, parks)
  * Layout and accommodation
  * Any special features
- Price: Estimate based on area, size, and property type (in pence for accuracy)
- Features: List 5-10 relevant features for the property type and area
- All other fields: Fill in realistic values based on typical properties in that area

DEFAULTS:
- If listing type not specified, assume "rental" for flats, "sale" for houses
- If bedrooms not specified, estimate from property type (studio=0, flat=1-2, house=3-4)
- Council tax bands: W11/W2 typically E-H, W9/W10 typically D-F, NW6/NW10 typically C-E
- Energy ratings: Period properties typically D-E, modern typically B-C

Return a complete JSON object with ALL fields populated based on your knowledge.`;

export async function parsePropertyFromNaturalLanguage(
  description: string
): Promise<PropertyParseResult> {
  try {
    if (!openai) {
      throw new Error('OpenAI client not configured');
    }
    
    const completion = await openai.chat.completions.create({
      model: 'gpt-4.1',
      messages: [
        { role: 'system', content: systemPrompt },
        { 
          role: 'user', 
          content: `Create a complete property listing from this input. Extract the street name/address and use your knowledge of West London to generate all property details:\n\n"${description}"\n\nReturn a complete JSON object with title, description, price, bedrooms, bathrooms, propertyType, addressLine1, postcode, features, and all other relevant fields.` 
        }
      ],
      response_format: { type: 'json_object' },
      temperature: 0.4,
      max_tokens: 2000
    });

    const content = completion.choices[0]?.message?.content;
    if (!content) {
      throw new Error('No response from AI');
    }

    const parsed = JSON.parse(content);
    
    // Normalize enum fields to lowercase (AI sometimes returns capitalized values)
    if (parsed.propertyType) {
      parsed.propertyType = parsed.propertyType.toLowerCase();
    }
    if (parsed.listingType) {
      parsed.listingType = parsed.listingType.toLowerCase();
    }
    if (parsed.furnished) {
      parsed.furnished = parsed.furnished.toLowerCase().replace(' ', '_');
    }
    if (parsed.tenure) {
      // Extract base tenure type (handle AI responses like "leasehold (approx. 120 years remaining)")
      const tenureLower = parsed.tenure.toLowerCase();
      if (tenureLower.includes('share') && tenureLower.includes('freehold')) {
        parsed.tenure = 'share_of_freehold';
      } else if (tenureLower.includes('leasehold')) {
        parsed.tenure = 'leasehold';
      } else if (tenureLower.includes('freehold')) {
        parsed.tenure = 'freehold';
      } else {
        parsed.tenure = tenureLower.replace(/ /g, '_');
      }
    }
    if (parsed.priceQualifier) {
      parsed.priceQualifier = parsed.priceQualifier.toLowerCase().replace(/ /g, '_');
    }
    if (parsed.rentPeriod) {
      parsed.rentPeriod = parsed.rentPeriod.toLowerCase().replace(/ /g, '_');
    }
    
    // Coerce numeric fields from strings (AI sometimes returns numbers as strings)
    const numericFields = ['yearBuilt', 'bedrooms', 'bathrooms', 'receptions', 'sqft', 'price', 'deposit', 'serviceCharge', 'groundRent'];
    for (const field of numericFields) {
      if (parsed[field] !== undefined && typeof parsed[field] === 'string') {
        const num = parseInt(parsed[field], 10);
        parsed[field] = isNaN(num) ? undefined : num;
      }
    }
    
    const validated = PropertyParseResultSchema.parse(parsed);
    
    return validated;
  } catch (error) {
    console.error('Error parsing property with AI:', error);
    throw new Error('Failed to parse property description');
  }
}

export async function enhancePropertyDescription(
  property: Partial<InsertProperty>
): Promise<string> {
  try {
    const prompt = `Create a compelling, SEO-optimized property description for this ${property.listingType} listing:
    
Property Type: ${property.propertyType}
Bedrooms: ${property.bedrooms}
Bathrooms: ${property.bathrooms}
Location: ${property.addressLine1}, ${property.postcode}
Price: £${property.price ? (property.price / 100).toLocaleString() : 'POA'}
Features: ${property.features?.join(', ') || 'Not specified'}

Create a description that:
1. Highlights the property's best features
2. Mentions the local area and transport links
3. Appeals to the target buyer/renter
4. Includes relevant keywords for SEO
5. Is engaging and informative
6. Mentions nearby amenities and attractions

Keep it professional but engaging, around 150-200 words.`;

    const completion = await openai.chat.completions.create({
      model: 'gpt-4.1-mini',
      messages: [
        { role: 'system', content: 'You are an expert estate agent copywriter specializing in London properties.' },
        { role: 'user', content: prompt }
      ],
      temperature: 0.7,
      max_tokens: 400
    });

    return completion.choices[0]?.message?.content || property.description || '';
  } catch (error) {
    console.error('Error enhancing property description:', error);
    return property.description || '';
  }
}

export async function generatePropertyTitle(
  property: Partial<InsertProperty>
): Promise<string> {
  try {
    const prompt = `Generate a concise, SEO-friendly title for this property listing:
    
Property Type: ${property.propertyType}
Bedrooms: ${property.bedrooms}
Location: ${property.postcode}
Listing Type: ${property.listingType}

Create a title that is:
- Maximum 60 characters
- Includes bedroom count, property type, and area
- SEO optimized
- Professional and appealing

Example: "2 Bed Flat to Rent in Maida Vale W9"`;

    const completion = await openai.chat.completions.create({
      model: 'gpt-4.1-mini',
      messages: [
        { role: 'user', content: prompt }
      ],
      temperature: 0.5,
      max_tokens: 50
    });

    return completion.choices[0]?.message?.content?.trim() || 
           `${property.bedrooms} Bed ${property.propertyType} in ${property.postcode}`;
  } catch (error) {
    console.error('Error generating property title:', error);
    return `${property.bedrooms} Bed ${property.propertyType} in ${property.postcode}`;
  }
}

export async function suggestPropertyFeatures(
  propertyType: string,
  description: string
): Promise<string[]> {
  try {
    const prompt = `Based on this ${propertyType} property description, suggest relevant features and amenities:
    
"${description}"

Return a JSON array of 5-10 relevant property features that would appeal to buyers/renters.
Focus on practical features like:
- Parking, garden, balcony, terrace
- Modern kitchen, ensuite bathroom
- Period features, high ceilings
- Transport links, local amenities
- Storage, workspace, views

Return only the JSON array, no explanation.`;

    const completion = await openai.chat.completions.create({
      model: 'gpt-4.1-mini',
      messages: [
        { role: 'user', content: prompt }
      ],
      temperature: 0.5,
      max_tokens: 200
    });

    const content = completion.choices[0]?.message?.content;
    if (!content) return [];
    
    try {
      return JSON.parse(content);
    } catch {
      return [];
    }
  } catch (error) {
    console.error('Error suggesting property features:', error);
    return [];
  }
}