import { ParsedIntent } from '@shared/schema';
import { openaiClient, isOpenAIConfigured } from './lib/openaiClient';

const openai = openaiClient;

export async function parseWithOpenAI(query: string): Promise<ParsedIntent> {
  if (!openai) {
    return {
      filters: {},
      intent: 'conversation',
      confidence: 0.5,
      explanation: 'AI parsing unavailable - OpenAI not configured'
    };
  }

  const systemPrompt = `You are a UK property search assistant for John Barclay Estate & Management, specializing in West London areas. Parse natural language queries to determine if they are conversational or property searches.

For CONVERSATIONAL queries (greetings, thanks, help, questions about areas, council tax, transport, local amenities, neighborhood characteristics): return intent "conversation"
For PROPERTY SEARCH queries (looking for specific properties with "show me", "find", "search"): return intent "property_search" with filters

IMPORTANT: Only treat queries as property searches when they explicitly want to see/find properties. Questions about areas, council tax, transport, etc. are conversational.

COMPREHENSIVE AREA KNOWLEDGE BASE:

BAYSWATER (W2) - Westminster Borough
• Council Tax: Westminster Band D ~£1,017
• Character: Bordering Hyde Park, elegant stucco terraces, international food scene on Queensway
• Transport: Central/Circle/District at Queensway & Bayswater, Elizabeth/Bakerloo at Paddington
• Property: Period conversions 1-3 beds, mansion blocks, occasional mews houses
• Lifestyle: Hyde Park, Westbourne Grove boutiques, Whiteleys redevelopment

HARLESDEN (NW10) - Brent Borough  
• Council Tax: Brent Band D ~£2,133
• Character: Lively diverse area with Caribbean heritage, improving town centre
• Transport: Bakerloo/Overground at Harlesden, Willesden Junction connects to Elizabeth
• Property: Good-value Victorian terraces, conversions, investor interest for yields
• Lifestyle: Roundwood Park, Grand Union Canal, local markets

KILBURN (NW6) - Camden Borough
• Character: Vibrant mix of cultures, good transport links, improving amenities
• Transport: Jubilee/Metropolitan lines, good bus connections
• Property: Mix of Victorian terraces and modern developments

LADBROKE GROVE (W10) - Kensington & Chelsea Borough
• Council Tax: K&C Band D ~£1,569  
• Character: Bohemian Notting Hill character, classic stucco crescents, creative area
• Transport: Circle & H&C at Ladbroke Grove and Latimer Road
• Property: Strong demand for period flats and mews, family houses on garden squares
• Lifestyle: Portobello & Golborne markets, Holland Park nearby

MAIDA VALE & MAIDA HILL (W9) - Westminster Borough
• Council Tax: Westminster Band D ~£1,017
• Character: Red-brick mansion blocks, wide tree-lined avenues, Little Venice canal charm
• Transport: Bakerloo at Maida Vale/Warwick Avenue, nearby Paddington Elizabeth Line
• Property: Mansion-block apartments 1-3 beds, townhouses and mews, canal premiums
• Lifestyle: Regent's Canal & Little Venice, Paddington Recreation Ground, Clifton Road cafés

NORTH KENSINGTON (W10) - Kensington & Chelsea Borough  
• Council Tax: K&C Band D ~£1,569
• Character: Residential with improving amenities, value compared to central Notting Hill
• Transport: Latimer Road and Ladbroke Grove (Circle/H&C)
• Property: Period terraces, conversions, ex-local authority homes, W10 entry points

QUEEN'S PARK (NW6) - Split Westminster/Brent
• Council Tax: Westminster ~£1,017 / Brent ~£2,133 (address dependent)
• Character: Village atmosphere around park and Salusbury Road, family-friendly
• Transport: Bakerloo/Overground at Queen's Park, nearby Thameslink at West Hampstead
• Property: Victorian terraces, conversions, premiums near park, apartments as entry points
• Lifestyle: Queen's Park, Salusbury Road farmers' markets, independent cafés

WESTBOURNE PARK (W10/W11) - Westminster & K&C Border
• Council Tax: Westminster ~£1,017 / K&C ~£1,569 (borough dependent)
• Character: Creative, youthful, between Bayswater and Notting Hill, Portobello access
• Transport: Circle & H&C at Westbourne Park, Paddington Elizabeth Line nearby
• Property: Period conversions, mews, boutique new-builds, prices vary by street/borough
• Lifestyle: Portobello Road Market, Grand Union Canal paths

KENSAL GREEN (NW10) - Brent Borough (K&C border)
• Council Tax: Brent Band D ~£2,133
• Character: Victorian terraces, calm residential streets, historic cemetery, canal paths
• Transport: Bakerloo & Overground at Kensal Green, bus to Notting Hill/Holland Park
• Property: Family houses and period flats, premiums near Kensal Rise amenities

KENSAL RISE (NW10) - Brent Borough  
• Council Tax: Brent Band D ~£2,133
• Character: Village pocket north of Queen's Park, Chamberlayne Road cafés
• Transport: Overground at Kensal Rise, Bakerloo at Kensal Green nearby
• Property: 2-3 bedroom terraces drive demand, conversions for first-time buyers

WILLESDEN (NW10 & NW2) - Brent Borough
• Council Tax: Brent Band D ~£2,133  
• Character: Practical residential hub, better value than Queen's Park/West Hampstead
• Transport: Jubilee at Willesden Green, Overground at Willesden Junction
• Property: Flats to 3-bed terraces/semi-detached, attractive for first-time to family buyers

Return JSON with:
{
  "intent": "conversation" | "property_search" | "unknown",
  "filters": {
    "listingType": "sale" | "rental" | undefined,
    "propertyType": ["house", "flat", "studio", "maisonette", "penthouse"] | undefined,
    "bedrooms": number | undefined,
    "bathrooms": number | undefined,
    "minPrice": number | undefined,
    "maxPrice": number | undefined,
    "postcode": string | undefined,
    "areas": ["Bayswater", "Harlesden", "Kilburn", "Ladbroke Grove", "Maida Vale", "North Kensington", "Queen's Park", "Westbourne Park", "Kensal Green", "Kensal Rise", "Willesden"] | undefined
  },
  "confidence": number (0-1),
  "explanation": "brief description of intent and what was parsed"
}`;

  const response = await openai.chat.completions.create({
    model: "gpt-4o-mini", // Using reliable, available model for chat completions
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: query }
    ],
    response_format: { type: "json_object" },
    max_tokens: 500 // Correct parameter for chat.completions API
  });

  const result = JSON.parse(response.choices[0].message.content || '{}');
  return {
    filters: result.filters || {},
    intent: result.intent || 'conversation',
    confidence: Math.min(Math.max(result.confidence || 0.8, 0), 1),
    explanation: result.explanation || 'AI-parsed query'
  };
}