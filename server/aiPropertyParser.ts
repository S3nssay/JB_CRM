import { z } from 'zod';
import { InsertProperty } from '@shared/schema';
import { openaiClient, isOpenAIConfigured } from './lib/openaiClient';

const openai = openaiClient;

// Schema for AI to parse property details from natural language
const PropertyParseResultSchema = z.object({
  title: z.string().optional(),
  description: z.string().optional(),
  isRental: z.boolean().optional(), // true = rental, false = sale
  isResidential: z.boolean().optional(), // true = residential, false = commercial
  price: z.number().optional(),
  priceQualifier: z.enum(['guide_price', 'offers_over', 'fixed_price', 'poa']).optional(),
  propertyType: z.enum([
    // Residential types
    'flat', 'house', 'maisonette', 'penthouse', 'studio', 'bungalow', 'cottage',
    'mansion', 'villa', 'townhouse', 'detached', 'semi_detached', 'terraced', 'end_terrace',
    // Commercial types
    'office', 'retail', 'warehouse', 'industrial', 'mixed_use', 'restaurant', 'shop',
    'land', 'other'
  ]).optional(),
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
  rentPeriod: z.enum(['per_month', 'per_week', 'per_annum']).optional(),
  viewingArrangements: z.string().optional(),
  keyFeatures: z.array(z.string()).optional(),
  nearbyAmenities: z.array(z.string()).optional()
});

export type PropertyParseResult = z.infer<typeof PropertyParseResultSchema>;

const systemPrompt = `You are an expert West London estate agent AI for John Barclay Estate & Management. Your job is to:
1. Extract the street name and any address details from the user's input
2. Determine if this is a RESIDENTIAL or COMMERCIAL property
3. Use your knowledge of West London streets and areas to infer property characteristics
4. Generate a complete, realistic property listing

PROPERTY CATEGORY DETECTION:
COMMERCIAL properties include:
- Restaurants, cafes, takeaways (A3/A5 use class)
- Shops, retail units (A1 use class)
- Offices (B1 use class)
- Warehouses, industrial units (B2/B8 use class)
- Mixed use properties
- Any property described as "premises", "unit", "shop", "office", "restaurant"
- Properties mentioned with "trading as", "business", "fixtures and fittings"

RESIDENTIAL properties include:
- Flats, apartments, maisonettes
- Houses (detached, semi-detached, terraced)
- Studios, penthouses, bungalows

WEST LONDON AREA KNOWLEDGE:
- W2 (Paddington, Bayswater): Georgian terraces, mansion flats, average £800-1500/sqft residential, busy commercial streets
- W9 (Maida Vale, Little Venice): Victorian/Edwardian, tree-lined streets, canal views, £700-1200/sqft
- W10 (North Kensington, Ladbroke Grove): Mixed period properties, up-and-coming, £600-1000/sqft
- W11 (Notting Hill): Premium Georgian/Victorian, famous for Portobello Road, £1000-2000/sqft
- NW6 (Kilburn, West Hampstead): Victorian terraces, good transport links, £600-900/sqft
- NW10 (Willesden, Harlesden): More affordable, regeneration areas, £400-700/sqft
- W14 (Holland Park, West Kensington): Mix of mansion blocks and period houses, £700-1100/sqft

COMMERCIAL PROPERTY DETAILS:
For commercial properties:
- isResidential: false
- propertyType: "retail", "restaurant", "office", "warehouse", "industrial", "mixed_use", "shop", or "other"
- Do NOT include bedrooms/bathrooms for commercial (set to 0 or omit)
- Include squareFootage (sqft) - estimate from description
- rentPeriod: typically "per_annum" for commercial leases
- Features should include: Use class, frontage, storage, kitchen facilities, customer seating, extraction, etc.
- Title example: "A3 Restaurant Premises on Busy High Street" or "Prime Retail Unit with Basement Storage"

RESIDENTIAL PROPERTY DETAILS:
For residential properties:
- isResidential: true
- propertyType: "flat", "house", "maisonette", "penthouse", "studio", etc.
- Include bedrooms, bathrooms, receptions
- rentPeriod: typically "per_month" for residential

STREET RECOGNITION:
When the user mentions a street name:
- Extract the full street address (e.g., "123 Elgin Avenue" or "Elgin Avenue, W9")
- Infer the postcode from the street if not provided
- Use typical property types for that street

DEFAULTS:
- If isRental not specified, assume false (sale) for commercial with "fixtures and fittings", otherwise true (rental)
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
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: systemPrompt },
        {
          role: 'user',
          content: `Create a complete property listing from this input. First determine if this is a RESIDENTIAL or COMMERCIAL property, then extract the address and generate all property details:\n\n"${description}"\n\nReturn a complete JSON object with isResidential (true for residential, false for commercial), isRental (true for rental, false for sale), title, description, price, propertyType, addressLine1, postcode, squareFootage, features, and all other relevant fields. For commercial properties, omit bedrooms/bathrooms. For residential, include bedrooms, bathrooms, receptions.`
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

    // Convert propertyCategory to isResidential boolean (for backward compatibility with AI responses)
    if (parsed.propertyCategory !== undefined && parsed.isResidential === undefined) {
      const category = String(parsed.propertyCategory).toLowerCase();
      parsed.isResidential = category !== 'commercial';
      delete parsed.propertyCategory;
    }
    // Ensure isResidential is a boolean
    if (parsed.isResidential !== undefined && typeof parsed.isResidential !== 'boolean') {
      parsed.isResidential = parsed.isResidential === true || parsed.isResidential === 'true';
    }
    if (parsed.propertyType) {
      let pt = parsed.propertyType.toLowerCase().replace(/ /g, '_').replace(/-/g, '_');
      // Map common variations to valid enum values
      if (pt === 'a3_premises' || pt === 'a3' || pt === 'cafe' || pt === 'takeaway') pt = 'restaurant';
      if (pt === 'a1' || pt === 'retail_unit' || pt === 'unit') pt = 'retail';
      if (pt === 'b1' || pt === 'office_space') pt = 'office';
      if (pt === 'b2' || pt === 'b8' || pt === 'storage') pt = 'warehouse';
      if (pt === 'apartment') pt = 'flat';
      parsed.propertyType = pt;
    }
    // Convert listingType to isRental boolean for backwards compatibility
    if (parsed.listingType !== undefined && parsed.isRental === undefined) {
      const lt = String(parsed.listingType).toLowerCase();
      parsed.isRental = lt === 'rental' || lt === 'let' || lt === 'rent';
      delete parsed.listingType;
    }
    // Ensure isRental is a boolean
    if (parsed.isRental !== undefined && typeof parsed.isRental !== 'boolean') {
      parsed.isRental = parsed.isRental === true || parsed.isRental === 'true';
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
      let rp = parsed.rentPeriod.toLowerCase().replace(/ /g, '_');
      // Normalize rent period variations
      if (rp === 'pa' || rp === 'annually' || rp === 'yearly' || rp === 'per_year') rp = 'per_annum';
      if (rp === 'pm' || rp === 'monthly' || rp === 'pcm') rp = 'per_month';
      if (rp === 'pw' || rp === 'weekly') rp = 'per_week';
      parsed.rentPeriod = rp;
    }

    // Coerce numeric fields from strings (AI sometimes returns numbers as strings)
    const numericFields = ['yearBuilt', 'bedrooms', 'bathrooms', 'receptions', 'sqft', 'squareFootage', 'price', 'deposit', 'serviceCharge', 'groundRent'];
    for (const field of numericFields) {
      if (parsed[field] !== undefined && typeof parsed[field] === 'string') {
        const num = parseInt(parsed[field], 10);
        parsed[field] = isNaN(num) ? undefined : num;
      }
    }
    
    // Try to validate, but if it fails due to strict enum, be more permissive
    try {
      const validated = PropertyParseResultSchema.parse(parsed);
      return validated;
    } catch (zodError: any) {
      console.warn('Zod validation failed, returning raw parsed data:', zodError.message);
      // Return raw parsed data without strict validation
      return parsed as any;
    }
  } catch (error: any) {
    console.error('Error parsing property with AI:', error);
    console.error('Error details:', error.message);
    if (error.response) {
      console.error('API Response:', error.response.data);
    }
    throw new Error('Failed to parse property description: ' + error.message);
  }
}

export async function enhancePropertyDescription(
  property: Partial<InsertProperty>
): Promise<string> {
  try {
    const prompt = `Create a compelling, SEO-optimized property description for this ${property.isRental ? 'rental' : 'sale'} listing:
    
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
      model: 'gpt-4o-mini',
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
Listing Type: ${property.isRental ? 'rental' : 'sale'}

Create a title that is:
- Maximum 60 characters
- Includes bedroom count, property type, and area
- SEO optimized
- Professional and appealing

Example: "2 Bed Flat to Rent in Maida Vale W9"`;

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
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
      model: 'gpt-4o-mini',
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