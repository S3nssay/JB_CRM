import { z } from 'zod';

// Using node's native fetch in recent versions
const fetch = globalThis.fetch;

// Interface for API responses
interface GetAddressResponse {
  addresses: string[];
  latitude?: number;
  longitude?: number;
  thoroughfare?: string;
  postcode?: string;
  town?: string;
  locality?: string;
}

export interface FormattedAddress {
  addressLine1: string;
  addressLine2?: string;
  town: string;
  county?: string;
  country: string;
}

/**
 * UK Land Registry Price Paid Data integration
 */
export interface PropertyPriceData {
  averagePrice: number;
  recentSales: number;
  minPrice: number;
  maxPrice: number;
  lastUpdated: string;
}

/**
 * Lookup UK addresses using Postcodes.io API (free, no API key required)
 * @param term The search term (postcode or address fragment)
 */
export async function lookupAddressesUsingPostcodesIO(term: string): Promise<FormattedAddress[]> {
  try {
    // Clean up postcode input
    const cleanPostcode = term.replace(/\s+/g, '').trim().toUpperCase();

    console.log(`Looking up UK addresses using Postcodes.io API for: ${cleanPostcode}`);

    // First validate the postcode
    const validateUrl = `https://api.postcodes.io/postcodes/${encodeURIComponent(cleanPostcode)}/validate`;

    const validateResponse = await fetch(validateUrl);
    if (!validateResponse.ok) {
      throw new Error(`Postcodes.io validation error: ${validateResponse.status}`);
    }

    const validateData = await validateResponse.json();

    if (!validateData.result) {
      console.log(`Invalid postcode: ${cleanPostcode}`);
      return []; // Invalid postcode
    }

    // Get postcode data
    const lookupUrl = `https://api.postcodes.io/postcodes/${encodeURIComponent(cleanPostcode)}`;

    const lookupResponse = await fetch(lookupUrl);
    if (!lookupResponse.ok) {
      throw new Error(`Postcodes.io lookup error: ${lookupResponse.status}`);
    }

    const postcodeData = await lookupResponse.json();

    if (!postcodeData.result) {
      console.log(`No data found for postcode: ${cleanPostcode}`);
      return [];
    }

    // Create at least a basic address from the postcode
    const postcode = postcodeData.result.postcode;
    const district = postcodeData.result.admin_district || '';
    const ward = postcodeData.result.admin_ward || '';
    const parish = postcodeData.result.parish || '';
    const town = postcodeData.result.admin_district || postcodeData.result.parish || postcodeData.result.admin_ward || '';
    const county = postcodeData.result.admin_county || postcodeData.result.nuts || '';

    // Create a minimal address entry for this postcode
    const address: FormattedAddress = {
      addressLine1: postcode,
      town: town,
      county: county,
      country: 'United Kingdom'
    };

    return [address];

  } catch (error) {
    console.error('Error looking up addresses with Postcodes.io:', error);
    throw new Error(`Failed to lookup addresses: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Geocode a postcode using Google Maps Geocoding API
 */
export async function geocodePostcode(postcode: string): Promise<{ lat: number; lng: number } | null> {
  try {
    const apiKey = process.env.GOOGLE_MAPS_API_KEY;
    if (!apiKey) {
      console.warn('Google Maps API key not configured for geocoding');
      return null;
    }

    // Clean postcode
    const cleanPostcode = postcode.trim().toUpperCase();

    // Add UK to ensure we get UK results
    const query = `${cleanPostcode}, UK`;

    console.log(`Geocoding postcode: ${query}`);

    const geocodeUrl = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(query)}&key=${apiKey}`;

    const response = await fetch(geocodeUrl);
    if (!response.ok) {
      throw new Error(`Geocoding API error: ${response.status}`);
    }

    const data = await response.json();

    if (data.status !== 'OK') {
      console.warn(`Geocoding failed for ${cleanPostcode}: ${data.status} - ${data.error_message || ''}`);
      return null;
    }

    if (data.results && data.results.length > 0) {
      const location = data.results[0].geometry.location;
      return {
        lat: location.lat,
        lng: location.lng
      };
    }

    return null;
  } catch (error) {
    console.error('Error geocoding postcode:', error);
    return null;
  }
}

/**
 * Validate a UK postcode and return location data
 */
export async function validateUkPostcode(postcode: string): Promise<{
  valid: boolean;
  postcode?: string;
  region?: string;
  district?: string;
}> {
  // Clean and format the postcode
  const cleanPostcode = postcode.replace(/\s+/g, '').trim().toUpperCase();
  const formattedPostcode = cleanPostcode.replace(/^(.+?)([0-9][A-Z]{2})$/, '$1 $2');

  try {
    // Check with Postcodes.io API
    const url = `https://api.postcodes.io/postcodes/${encodeURIComponent(formattedPostcode)}`;
    const response = await fetch(url);

    if (!response.ok) {
      if (response.status === 404) {
        return { valid: false };
      }
      throw new Error(`Postcode validation error: ${response.status}`);
    }

    const data = await response.json();

    if (!data.result) {
      return { valid: false };
    }

    return {
      valid: true,
      postcode: formattedPostcode,
      region: data.result.region || '',
      district: data.result.admin_district || ''
    };

  } catch (error) {
    console.error('Error validating postcode:', error);
    return { valid: false };
  }
}

/**
 * Get property price data from UK HPI (House Price Index) API
 */
export async function getLandRegistryPriceData(
  postcode: string,
  propertyType: string,
  bedrooms: number
): Promise<PropertyPriceData> {
  try {
    // Format and clean the postcode
    const formattedPostcode = postcode.replace(/\s+/g, ' ').trim().toUpperCase();

    // Extract outcode (first part of postcode) for area-based lookup
    let postcodeOutcode = formattedPostcode.split(' ')[0];

    if (!postcodeOutcode) {
      postcodeOutcode = formattedPostcode;
    }

    console.log(`Extracting HPI data for area with postcode: ${postcode} (outcode: ${postcodeOutcode})`);

    // First, we'll get the region/local authority for this postcode
    const postcodeInfoUrl = `https://api.postcodes.io/postcodes/${encodeURIComponent(postcode)}`;
    const postcodeResponse = await fetch(postcodeInfoUrl);

    if (!postcodeResponse.ok) {
      throw new Error(`Failed to get postcode area information: ${postcodeResponse.status}`);
    }

    const postcodeData = await postcodeResponse.json();
    if (!postcodeData.result) {
      throw new Error('Invalid postcode or no data available for this postcode');
    }

    // Get the region code and local authority
    const region = postcodeData.result.region;
    const localAuthority = postcodeData.result.admin_district;

    console.log(`Property in ${region}, Local Authority: ${localAuthority}`);

    // Fetch the latest UK HPI data for this region
    // The UK HPI API provides data by region, local authority and property type
    const areaCode = getHpiAreaCode(localAuthority) || getHpiAreaCode(region);

    if (!areaCode) {
      console.log('Could not map region to HPI area code, using national average');
    }

    // Get the latest average price data from UK Land Registry / UK HPI
    // Using the Land Registry SPARQL API which is more reliable
    // We'll use a simplified approach with direct URL parameters

    // Construct proper date format (most recent month)
    const today = new Date();
    const month = String(today.getMonth()).padStart(2, '0'); // Previous month
    const year = today.getFullYear();
    const dateStr = `${year}-${month}`;

    // Format region for the query
    const regionForQuery = areaCode ? areaCode : 'UK';
    const propertyTypeForQuery = mapPropertyTypeToHpi(propertyType);

    // New Land Registry API endpoint - direct data URL
    const hpiUrl = `https://landregistry.data.gov.uk/data/ukhpi/region/${regionForQuery}/month/${dateStr}`;

    console.log(`Fetching Land Registry price data from: ${hpiUrl}`);

    const hpiResponse = await fetch(hpiUrl, {
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'CashPropertyBuyers/1.0'
      }
    });

    if (!hpiResponse.ok) {
      console.error(`Failed to get Land Registry data: ${hpiResponse.status}`);

      // If regional data fails, try national average
      if (areaCode) {
        console.log('Falling back to UK-wide average');
        return getNationalAverageHpiData(propertyType, bedrooms);
      }

      throw new Error(`Failed to fetch Land Registry data: ${hpiResponse.status}`);
    }

    const hpiData = await hpiResponse.json();

    // The Land Registry API returns data in a different format than the old HPI API
    if (!hpiData.result || !hpiData.result.items || hpiData.result.items.length === 0) {
      throw new Error('No Land Registry data available for this area');
    }

    // Sort by date to get the latest data (most recent first)
    const sortedData = hpiData.result.items.sort((a: any, b: any) => {
      return new Date(b.date).getTime() - new Date(a.date).getTime();
    });

    // Get the latest data point
    const latestData = sortedData[0];

    // Calculate recentSales from sales_volume if available
    let recentSales = 5; // Default
    if (latestData.salesVolume && !isNaN(latestData.salesVolume)) {
      recentSales = Math.max(1, Math.min(100, Math.round(latestData.salesVolume / 10)));
    }

    // Get average price and apply adjustments for property type and bedrooms
    let basePrice = latestData.averagePrice || 250000;

    // Adjust for property type if not already filtered in API
    if (propertyType) {
      const typeMultiplier = propertyType === 'detached' ? 1.4 :
        propertyType === 'semi-detached' ? 1.2 :
          propertyType === 'terraced' ? 1.0 :
            propertyType === 'flat' ? 0.9 : 1.1;
      basePrice = basePrice * typeMultiplier;
    }

    // Adjust for number of bedrooms (HPI doesn't segment by bedrooms)
    const bedroomMultiplier = bedrooms === 1 ? 0.7 :
      bedrooms === 2 ? 0.9 :
        bedrooms === 3 ? 1.0 :
          bedrooms === 4 ? 1.3 : 1.5;

    const estimatedValue = Math.round(basePrice * bedroomMultiplier);

    // Calculate price range based on price variance
    // Use 10% as default variance
    const priceVariance = 0.1;

    return {
      averagePrice: estimatedValue,
      recentSales: recentSales,
      minPrice: Math.round(estimatedValue * (1 - priceVariance)),
      maxPrice: Math.round(estimatedValue * (1 + priceVariance)),
      lastUpdated: latestData.date || new Date().toISOString()
    };
  } catch (error) {
    console.error('Error getting UK Land Registry data:', error);

    // Fall back to national average if API fails
    return getNationalAverageHpiData(propertyType, bedrooms);
  }
}

/**
 * Get national average property price data
 */
async function getNationalAverageHpiData(
  propertyType: string,
  bedrooms: number
): Promise<PropertyPriceData> {
  try {
    // UK average house prices by property type
    // These are fallback values if the API fails
    const baseValues = {
      'detached': 425000,
      'semi-detached': 275000,
      'terraced': 240000,
      'flat': 210000,
      'bungalow': 350000,
      'other': 290000
    };

    // Bedroom multipliers
    const bedroomMultipliers = {
      1: 0.7,
      2: 0.9,
      3: 1.0,
      4: 1.3,
      5: 1.5
    };

    // Try to get UK-wide data from Land Registry
    const today = new Date();
    const month = String(today.getMonth()).padStart(2, '0');
    const year = today.getFullYear();
    const dateStr = `${year}-${month}`;

    const hpiUrl = `https://landregistry.data.gov.uk/data/ukhpi/region/United_Kingdom/month/${dateStr}`;

    console.log(`Fetching national UK house price data from: ${hpiUrl}`);

    try {
      const response = await fetch(hpiUrl, {
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'CashPropertyBuyers/1.0'
        }
      });

      if (response.ok) {
        const data = await response.json();

        if (data.result && data.result.items && data.result.items.length > 0) {
          // Get most recent average price
          const latestItem = data.result.items[0];
          const nationalAvgPrice = latestItem.averagePrice || baseValues[propertyType as keyof typeof baseValues] || 275000;

          // Apply property type adjustment
          const propertyMultiplier =
            propertyType === 'detached' ? 1.4 :
              propertyType === 'semi-detached' ? 1.2 :
                propertyType === 'terraced' ? 1.0 :
                  propertyType === 'flat' ? 0.9 : 1.1;

          // Apply bedroom adjustment
          const bedroomMultiplier = bedroomMultipliers[bedrooms as keyof typeof bedroomMultipliers] || 1.0;

          // Calculate final price
          const estimatedValue = Math.round(nationalAvgPrice * propertyMultiplier * bedroomMultiplier);

          return {
            averagePrice: estimatedValue,
            recentSales: 5,
            minPrice: Math.round(estimatedValue * 0.9),
            maxPrice: Math.round(estimatedValue * 1.1),
            lastUpdated: latestItem.date || new Date().toISOString()
          };
        }
      }
    } catch (error) {
      console.error('Error fetching from national Land Registry API:', error);
      // Continue to fallback
    }

    // If API fails, use fallback values
    console.log('Using fallback property values');
    const basePrice = baseValues[propertyType as keyof typeof baseValues] || 275000;
    const bedroomMultiplier = bedroomMultipliers[bedrooms as keyof typeof bedroomMultipliers] || 1.0;
    const estimatedValue = Math.round(basePrice * bedroomMultiplier);

    return {
      averagePrice: estimatedValue,
      recentSales: 5,
      minPrice: Math.round(estimatedValue * 0.9),
      maxPrice: Math.round(estimatedValue * 1.1),
      lastUpdated: new Date().toISOString()
    };
  } catch (fallbackError) {
    console.error('Fatal error in property valuation:', fallbackError);

    // Last resort fallback
    return {
      averagePrice: 275000,
      recentSales: 5,
      minPrice: 247500,
      maxPrice: 302500,
      lastUpdated: new Date().toISOString()
    };
  }
}

/**
 * Map property type to HPI API format
 */
function mapPropertyTypeToHpi(propertyType: string): string {
  switch (propertyType) {
    case 'detached':
      return 'detached-houses';
    case 'semi-detached':
      return 'semi-detached-houses';
    case 'terraced':
      return 'terraced-houses';
    case 'flat':
      return 'flats-and-maisonettes';
    default:
      return 'all-property-types';
  }
}

/**
 * Map region name to HPI area code
 */
function getHpiAreaCode(region: string): string | null {
  if (!region) return null;

  const normalized = region.toLowerCase().trim();

  // Map UK regions to HPI area codes
  const regionMapping: Record<string, string> = {
    'north east': 'E12000001',
    'north west': 'E12000002',
    'yorkshire and the humber': 'E12000003',
    'east midlands': 'E12000004',
    'west midlands': 'E12000005',
    'east of england': 'E12000006',
    'london': 'E12000007',
    'south east': 'E12000008',
    'south west': 'E12000009',
    'wales': 'W92000004',
    'scotland': 'S92000003',
    'northern ireland': 'N92000002'
  };

  // Try exact match first
  if (regionMapping[normalized]) {
    return regionMapping[normalized];
  }

  // Try partial matches
  for (const [key, value] of Object.entries(regionMapping)) {
    if (normalized.includes(key) || key.includes(normalized)) {
      return value;
    }
  }

  return null;
}

/**
 * Calculate offer price based on market value with a 15% discount
 */
export function calculateOfferPrice(marketValue: number): {
  offerPrice: number;
  discountAmount: number;
  discountPercentage: number;
} {
  const discountPercentage = 15;
  const discountAmount = Math.round(marketValue * (discountPercentage / 100));
  const offerPrice = marketValue - discountAmount;

  return {
    offerPrice,
    discountAmount,
    discountPercentage
  };
}