import { getDemoProperties } from './propertyData';

export interface PropertyListing {
  id: string;
  address: string;
  postcode: string;
  price: number;
  bedrooms: number;
  bathrooms: number;
  propertyType: 'house' | 'flat' | 'studio' | 'maisonette' | 'penthouse';
  listingType: 'sale' | 'rent';
  description: string;
  features: string[];
  keyFeatures?: string[];
  propertyFeatures?: {
    detached?: boolean;
    semiDetached?: boolean;
    frontGarden?: boolean;
    backGarden?: boolean;
    driveway?: boolean;
    garage?: boolean;
  };
  images: string[];
  floorPlan?: string;
  epcRating?: string;
  councilTaxBand?: string;
  tenure: 'freehold' | 'leasehold';
  dateAdded: string;
  agent: {
    name: string;
    phone: string;
    email: string;
  };
  location: {
    latitude?: number;
    longitude?: number;
  };
}

export interface PropertySearchFilters {
  listingType?: 'sale' | 'rent';
  minPrice?: number;
  maxPrice?: number;
  bedrooms?: number;
  bathrooms?: number;
  propertyType?: string[];
  postcode?: string;
  propertyFeatures?: {
    detached?: boolean;
    semiDetached?: boolean;
    frontGarden?: boolean;
    backGarden?: boolean;
    driveway?: boolean;
    garage?: boolean;
  };
}

class PropertyListingsService {
  private properties: PropertyListing[] = [];
  private isLoaded = false;

  async loadProperties(): Promise<void> {
    if (this.isLoaded) return;

    try {
      // In the future, this could load from the Excel file
      // For now, we'll use demo data
      this.properties = getDemoProperties();
      this.isLoaded = true;
    } catch (error) {
      console.error('Failed to load property data:', error);
      this.properties = getDemoProperties();
      this.isLoaded = true;
    }
  }

  async searchProperties(filters: PropertySearchFilters = {}): Promise<PropertyListing[]> {
    try {
      // Build query parameters
      const params = new URLSearchParams();
      
      if (filters.listingType) {
        params.append('listingType', filters.listingType);
      }
      if (filters.minPrice !== undefined) {
        params.append('minPrice', filters.minPrice.toString());
      }
      if (filters.maxPrice !== undefined) {
        params.append('maxPrice', filters.maxPrice.toString());
      }
      if (filters.bedrooms !== undefined) {
        params.append('bedrooms', filters.bedrooms.toString());
      }
      if (filters.bathrooms !== undefined) {
        params.append('bathrooms', filters.bathrooms.toString());
      }
      if (filters.propertyType && filters.propertyType.length > 0) {
        params.append('propertyType', filters.propertyType.join(','));
      }
      if (filters.postcode) {
        params.append('postcode', filters.postcode);
      }

      // Call the real API
      const response = await fetch(`/api/properties?${params.toString()}`);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const apiProperties = await response.json();
      
      // Convert API response to PropertyListing format
      return apiProperties.map((prop: any) => this.convertToPropertyListing(prop));
      
    } catch (error) {
      console.error('Error fetching properties from API:', error);
      // Fallback to demo data if API fails
      await this.loadProperties();
      let filtered = [...this.properties];

      if (filters.listingType) {
        filtered = filtered.filter(p => p.listingType === filters.listingType);
      }

      if (filters.minPrice !== undefined) {
        filtered = filtered.filter(p => p.price >= filters.minPrice!);
      }

      if (filters.maxPrice !== undefined) {
        filtered = filtered.filter(p => p.price <= filters.maxPrice!);
      }

      if (filters.bedrooms !== undefined) {
        filtered = filtered.filter(p => p.bedrooms >= filters.bedrooms!);
      }

      if (filters.bathrooms !== undefined) {
        filtered = filtered.filter(p => p.bathrooms >= filters.bathrooms!);
      }

      if (filters.propertyType && filters.propertyType.length > 0) {
        filtered = filtered.filter(p => filters.propertyType!.includes(p.propertyType));
      }

      if (filters.postcode) {
        filtered = filtered.filter(p =>
          p.postcode.toLowerCase().includes(filters.postcode!.toLowerCase()) ||
          p.address.toLowerCase().includes(filters.postcode!.toLowerCase())
        );
      }

      return filtered;
    }
  }

  // Convert API property data to PropertyListing format
  private convertToPropertyListing(apiProperty: any): PropertyListing {
    return {
      id: apiProperty.id?.toString() || Math.random().toString(),
      address: apiProperty.addressLine1 ? `${apiProperty.addressLine1}${apiProperty.addressLine2 ? ', ' + apiProperty.addressLine2 : ''}` : (apiProperty.address || ''),
      postcode: apiProperty.postcode || '',
      price: apiProperty.price || 0, // Price already in correct format from backend
      bedrooms: apiProperty.bedrooms || 0,
      bathrooms: apiProperty.bathrooms || 0,
      propertyType: apiProperty.propertyType || 'flat',
      listingType: apiProperty.listingType || 'sale',
      description: apiProperty.description || '',
      features: apiProperty.features || [],
      keyFeatures: apiProperty.keyFeatures || [],
      propertyFeatures: apiProperty.propertyFeatures || {},
      images: apiProperty.images || [],
      floorPlan: apiProperty.floorPlan,
      epcRating: apiProperty.energyRating || apiProperty.epcRating,
      councilTaxBand: apiProperty.councilTaxBand,
      tenure: apiProperty.tenure || 'leasehold',
      dateAdded: apiProperty.createdAt || new Date().toISOString(),
      agent: {
        name: apiProperty.agentContact || 'John Barclay Estate & Management',
        phone: '+44 20 7724 0000',
        email: apiProperty.agentContact || 'info@johnbarclay.com'
      },
      location: {
        latitude: undefined,
        longitude: undefined
      }
    };
  }

  async getPropertyById(id: string): Promise<PropertyListing | null> {
    await this.loadProperties();
    return this.properties.find(p => p.id === id) || null;
  }

  formatPrice(price: number, listingType: 'sale' | 'rent'): string {
    if (listingType === 'rent') {
      return `£${price.toLocaleString()} pcm`;
    } else {
      if (price >= 1000000) {
        return `£${(price / 1000000).toFixed(1)}M`;
      } else {
        return `£${price.toLocaleString()}`;
      }
    }
  }

  getPropertyTypeLabel(type: string): string {
    const labels: Record<string, string> = {
      house: 'House',
      flat: 'Flat',
      studio: 'Studio',
      maisonette: 'Maisonette',
      penthouse: 'Penthouse'
    };
    return labels[type] || type;
  }
}

export const propertyListingsService = new PropertyListingsService();