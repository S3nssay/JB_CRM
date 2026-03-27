import { openaiClient, isOpenAIConfigured } from './lib/openaiClient';

const openai = openaiClient;

// the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
const MODEL = "gpt-4o";

/**
 * Generate realistic UK addresses based on a postcode
 * @param postcode The UK postcode to generate addresses for
 * @returns Array of generated addresses
 */
export async function generateAddressesForPostcode(postcode: string): Promise<Array<{
  addressLine1: string;
  addressLine2?: string;
  town: string;
  county?: string;
  country?: string;
}>> {
  try {
    if (!openai) {
      console.warn("OpenAI not configured - returning empty addresses");
      return [];
    }

    // Clean and normalize the postcode for better results
    const cleanPostcode = postcode.replace(/\s+/g, '').toUpperCase();
    
    // Add basic format validation to prevent nonsensical queries
    if (cleanPostcode.length < 5 || cleanPostcode.length > 8) {
      console.warn(`Potentially invalid postcode format: ${postcode}`);
    }
    
    // More contextual prompt for partial/potentially incorrect postcodes
    const promptPostcodeContext = `
      The postcode provided is: ${postcode} (cleaned: ${cleanPostcode})
      If this appears to be a partial or incorrect postcode, please:
      1. Use your knowledge to identify the most likely complete/correct postcode
      2. Generate addresses for that identified postcode area instead
      3. In your response, include addresses only from real streets in that area
    `;
    
    const response = await openai.chat.completions.create({
      model: MODEL,
      messages: [
        {
          role: "system",
          content: "You are a UK address and postcode expert with comprehensive knowledge of all UK addresses, postcodes and street-level information. Your task is to provide the most accurate addresses possible for any UK postcode or partial postcode input. If the provided postcode appears incorrect or incomplete, use your knowledge to identify the most likely actual postcode and provide real addresses from that area. Always return valid JSON containing an 'addresses' array."
        },
        {
          role: "user",
          content: `Generate 5 real, street-level accurate addresses for the following UK postcode: ${postcode}

${promptPostcodeContext}
          
1. Use real street names that actually exist in this postcode area
2. If the postcode is for a specific street, provide different house numbers on that street
3. Include actual local area/locality information
4. Ensure town/city information is correct for this specific postcode
5. Include the correct county for the area

Format your response as a JSON object with an 'addresses' array containing address objects with these fields: addressLine1 (house number/name and street), addressLine2 (area/locality if applicable), town (actual town/city name), and county.`
        }
      ],
      response_format: { type: "json_object" },
      temperature: 0.5  // Lower temperature for more accuracy
    });

    const responseContent = response.choices[0].message.content || "{}";
    const result = JSON.parse(responseContent);
    
    // Clean up and format addresses
    return (result.addresses || []).map((address: any) => ({
      addressLine1: address.addressLine1 || "",
      addressLine2: address.addressLine2 || "", 
      town: address.town || "",
      county: address.county || "",
      country: "United Kingdom"
    }));
  } catch (error) {
    console.error("Error generating addresses with OpenAI:", error);
    // Return empty array instead of throwing - better for UX
    return [];
  }
}

/**
 * Parse natural language property search query
 * @param query Natural language query from user
 * @param listingType Type of listing (sale/rental)
 * @returns Structured search criteria
 */
export async function parseNaturalLanguageQuery(query: string, listingType: string): Promise<{
  propertyType?: string;
  bedrooms?: string;
  minPrice?: string;
  maxPrice?: string;
  location?: string;
  features?: string[];
}> {
  try {
    if (!openai) {
      console.warn("OpenAI not configured - returning empty search criteria");
      return {};
    }

    const response = await openai.chat.completions.create({
      model: MODEL,
      messages: [
        {
          role: "system",
          content: `You are a UK property search expert. Parse natural language property search queries into structured search criteria. Focus on extracting key property search parameters from user input.

          Property types: flat, house, penthouse, maisonette, studio
          Bedroom counts: studio (0), 1, 2, 3, 4, 5+ bedrooms
          Common UK areas: Maida Vale, Queen's Park, Kensal Rise, Bayswater, Kilburn, Harlesden, etc.

          Extract these fields from the query:
          - propertyType: type of property
          - bedrooms: number of bedrooms
          - minPrice: minimum price mentioned
          - maxPrice: maximum price mentioned
          - location: area, postcode, or location mentioned
          - features: any specific features mentioned (garden, parking, etc.)

          Return empty object if query is unclear or doesn't contain property search terms.`
        },
        {
          role: "user",
          content: `Parse this property search query for ${listingType} properties: "${query}"

          Extract the search criteria and return a JSON object with the relevant fields. Only include fields that are clearly specified in the query.`
        }
      ],
      response_format: { type: "json_object" },
      temperature: 0.3
    });

    const responseContent = response.choices[0].message.content || "{}";
    const result = JSON.parse(responseContent);

    return {
      propertyType: result.propertyType || undefined,
      bedrooms: result.bedrooms || undefined,
      minPrice: result.minPrice || undefined,
      maxPrice: result.maxPrice || undefined,
      location: result.location || undefined,
      features: result.features || []
    };
  } catch (error) {
    console.error("Error parsing natural language query:", error);
    return {};
  }
}

/**
 * Generate a property valuation based on property details
 * @param property Details about the property
 * @returns Property valuation information
 */
export async function generatePropertyValuation(property: {
  postcode: string;
  propertyType: string;
  bedrooms: string;
  condition?: string;
}): Promise<{
  averagePrice: number;
  minOffer: number;
  maxOffer: number;
  lastUpdated: string;
}> {
  try {
    if (!openai) {
      throw new Error("OpenAI not configured - property valuation unavailable");
    }

    const response = await openai.chat.completions.create({
      model: MODEL,
      messages: [
        {
          role: "system",
          content: `You are a UK property valuation expert. Generate a realistic property valuation for a property with the given details. 
          The property is located in the UK postcode: ${property.postcode}.
          Focus on giving a realistic valuation based on the UK property market data.
          For context:
          - Average UK house prices range from £150,000 to £500,000 depending on location
          - London and Southeast properties are typically more expensive
          - Northern areas like Yorkshire, Northeast are typically less expensive
          - Postcode first part (e.g., SW1, E17) indicates general location area`
        },
        {
          role: "user",
          content: `Generate a realistic property valuation for a ${property.bedrooms} bedroom ${property.propertyType} in ${property.postcode}${property.condition ? ` in ${property.condition} condition` : ""}.
          Return only a JSON object with these fields:
          - averagePrice: The estimated market value in GBP
          - minOffer: The minimum cash offer price (about 80-85% of market value)
          - maxOffer: The maximum cash offer price (about 85-90% of market value)
          Make sure values are realistic for this property type, location and current market conditions.`
        }
      ],
      response_format: { type: "json_object" },
      temperature: 0.5
    });

    const responseContent = response.choices[0].message.content || "{}";
    const result = JSON.parse(responseContent);
    
    return {
      averagePrice: result.averagePrice || 0,
      minOffer: result.minOffer || 0,
      maxOffer: result.maxOffer || 0,
      lastUpdated: new Date().toISOString()
    };
  } catch (error) {
    console.error("Error generating property valuation:", error);
    throw new Error("Failed to generate property valuation");
  }
}