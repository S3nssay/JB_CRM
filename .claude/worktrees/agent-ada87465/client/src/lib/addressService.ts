import { apiRequest } from './queryClient';

// Interface for address lookup responses
export interface Address {
  addressLine1: string;
  addressLine2?: string;
  town: string;
  county?: string;
  country?: string;
  postcode?: string;
}

export interface PropertyPriceInfo {
  postcode: string;
  region: string;
  propertyType: string;
  bedrooms: number;
  condition?: string;
  averagePrice: number;
  recentSales: number;
  minPrice: number;
  maxPrice: number;
  minOffer: number;
  maxOffer: number;
  lastUpdated: string;
  source: string;
}

export interface OfferDetails {
  offerPrice: number;
  discountAmount: number;
  discountPercentage: number;
}

export interface AddressLookupResponse {
  valid: boolean;
  postcode?: string;
  region?: string;
  district?: string;
  addresses: Address[];
  message?: string;
}

export interface ValuationEstimateResponse {
  priceInfo: PropertyPriceInfo;
  offerDetails: OfferDetails;
}

// Validate a UK postcode format (less strict for better UX)
export function isValidUKPostcode(postcode: string): boolean {
  // Basic UK postcode validation - simplified for better user experience
  const cleanPostcode = postcode.replace(/\s+/g, '').toUpperCase();
  
  // Check basic length requirements (UK postcodes are 5-7 chars without spaces)
  if (cleanPostcode.length < 5 || cleanPostcode.length > 8) return false;
  
  // Very basic format check - must start with letters and contain numbers
  const hasLetters = /[A-Z]/i.test(cleanPostcode.substring(0, 2));
  const hasNumbers = /[0-9]/.test(cleanPostcode);
  
  return hasLetters && hasNumbers;
}

// Format a postcode to the standard format (e.g., "SW1A1AA" to "SW1A 1AA")
export function formatPostcode(postcode: string): string {
  const cleanPostcode = postcode.replace(/\s+/g, '').toUpperCase();
  const length = cleanPostcode.length;
  
  // Handle different postcode lengths appropriately
  if (length < 5) return cleanPostcode; // Too short, return as is
  
  if (length === 5) {
    // For short postcodes like A9 9AA
    return `${cleanPostcode.substring(0, 2)} ${cleanPostcode.substring(2)}`;
  } else if (length === 6) {
    // For postcodes like AB9 9AA
    return `${cleanPostcode.substring(0, 3)} ${cleanPostcode.substring(3)}`;
  } else {
    // Standard format for longer postcodes
    return `${cleanPostcode.substring(0, length - 3)} ${cleanPostcode.substring(length - 3)}`;
  }
}

// Find addresses and validate postcode with UK data sources
export async function findAddressesByPostcode(postcode: string): Promise<{
  addresses: Address[],
  valid: boolean,
  region?: string,
  district?: string,
  message?: string
}> {
  try {
    // Clean and format the postcode
    const cleanPostcode = postcode.replace(/\s+/g, '').toUpperCase();
    const formattedPostcode = formatPostcode(cleanPostcode);
    
    console.log(`Validating postcode: ${formattedPostcode}`);
    
    // Call our backend API which uses UK Postcodes.io, GetAddress.io, or other UK data sources
    const response = await apiRequest<AddressLookupResponse>(`/api/addresses/lookup?postcode=${encodeURIComponent(formattedPostcode)}`);
    
    return {
      addresses: response.addresses || [],
      valid: response.valid,
      region: response.region,
      district: response.district,
      message: response.message
    };
  } catch (error) {
    console.error('Error validating postcode or fetching addresses:', error);
    return {
      addresses: [],
      valid: false,
      message: 'Postcode validation service unavailable'
    };
  }
}

// Get property price information for a postcode using UK HPI data
export async function getPropertyPriceInfo(
  postcode: string, 
  propertyType: string, 
  bedrooms: string,
  condition?: string
): Promise<{priceInfo: PropertyPriceInfo | null, offerDetails: OfferDetails | null, error?: string}> {
  try {
    console.log(`Getting valuation for ${postcode}, ${propertyType}, ${bedrooms} bedrooms`);
    
    // Validate parameters
    if (!postcode || !propertyType || !bedrooms) {
      return {
        priceInfo: null,
        offerDetails: null,
        error: 'Missing required property information'
      };
    }
    
    // Call our backend API which uses UK Land Registry / House Price Index data
    const response = await apiRequest<ValuationEstimateResponse>(
      `/api/valuations/estimate`, 
      'POST', 
      {
        postcode: postcode.trim(),
        propertyType,
        bedrooms,
        condition: condition || 'average'
      }
    );
    
    console.log('Property valuation response:', response);
    
    if (!response || !response.priceInfo) {
      return {
        priceInfo: null,
        offerDetails: null,
        error: 'Unable to retrieve property valuation data'
      };
    }
    
    return {
      priceInfo: response.priceInfo,
      offerDetails: response.offerDetails
    };
  } catch (error: any) {
    console.error('Error fetching property price info:', error);
    
    // Check for validation errors from the API
    if (error.status === 400 && error.data?.validationError) {
      return {
        priceInfo: null,
        offerDetails: null,
        error: error.data.error || 'Invalid postcode or property information'
      };
    }
    
    // Generic error
    return {
      priceInfo: null,
      offerDetails: null,
      error: error.message || 'An error occurred while generating your property valuation'
    };
  }
}