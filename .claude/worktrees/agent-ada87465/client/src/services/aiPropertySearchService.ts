import { PropertySearchFilters } from './propertyListingsService';

export interface ChatMessage {
  id: string;
  type: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  searchResults?: any[];
  searchQuery?: PropertySearchFilters;
}

export interface ParsedQuery {
  filters: PropertySearchFilters;
  intent: 'search' | 'question' | 'greeting';
  confidence: number;
  explanation?: string;
}

class AIPropertySearchService {
  private chatHistory: ChatMessage[] = [];

  // Natural language processing patterns
  private patterns = {
    listingType: {
      sale: /\b(buy|purchase|sale|for sale|buying)\b/i,
      rent: /\b(rent|rental|let|letting|renting|to let)\b/i,
    },
    propertyType: {
      house: /\b(house|houses|home|homes|terraced|detached|semi)\b/i,
      flat: /\b(flat|flats|apartment|apartments)\b/i,
      studio: /\b(studio|studios|bedsit)\b/i,
      maisonette: /\b(maisonette|maisonettes)\b/i,
      penthouse: /\b(penthouse|penthouses)\b/i,
    },
    bedrooms: /\b(\d+)\s*(bed|bedroom|bedrooms?|br)\b/i,
    bathrooms: /\b(\d+)\s*(bath|bathroom|bathrooms?)\b/i,
    priceRange: {
      under: /\b(under|below|less than|up to|maximum|max)\s*£?([0-9,]+)k?\b/i,
      over: /\b(over|above|more than|minimum|min|from)\s*£?([0-9,]+)k?\b/i,
      between: /\b(between|from)\s*£?([0-9,]+)k?\s*(to|and|-)\s*£?([0-9,]+)k?\b/i,
    },
    location: {
      postcode: /\b([A-Z]{1,2}[0-9][A-Z0-9]?\s?[0-9][A-Z]{2}|W11|W10|W2|NW6|NW10)\b/i,
      area: /\b(notting hill|ladbroke grove|holland park|westbourne|kensington|bayswater|paddington)\b/i,
    },
    features: {
      garden: /\b(garden|outdoor space|terrace|balcony)\b/i,
      parking: /\b(parking|garage|drive|driveway)\b/i,
      period: /\b(period|victorian|georgian|original features)\b/i,
      modern: /\b(modern|contemporary|new|refurbished)\b/i,
      luxury: /\b(luxury|premium|high-end|upscale)\b/i,
    }
  };

  parseNaturalLanguageQuery(query: string): ParsedQuery {
    const lowerQuery = query.toLowerCase();
    const filters: PropertySearchFilters = {};
    let intent: 'search' | 'question' | 'greeting' = 'search';
    let confidence = 0.8;
    let explanation = '';

    // Check for greetings
    if (/\b(hi|hello|hey|good morning|good afternoon)\b/i.test(query)) {
      intent = 'greeting';
      return {
        filters,
        intent,
        confidence: 0.9,
        explanation: 'Greeting detected'
      };
    }

    // Check for questions
    if (/\b(what|how|where|when|why|can you|tell me)\b/i.test(query)) {
      intent = 'question';
    }

    // Parse listing type
    if (this.patterns.listingType.sale.test(lowerQuery)) {
      filters.listingType = 'sale';
      explanation += 'Looking for properties to buy. ';
      confidence += 0.1;
    } else if (this.patterns.listingType.rent.test(lowerQuery)) {
      filters.listingType = 'rent';
      explanation += 'Looking for properties to rent. ';
      confidence += 0.1;
    }

    // Parse property type
    const propertyTypes: string[] = [];
    for (const [type, pattern] of Object.entries(this.patterns.propertyType)) {
      if (pattern.test(lowerQuery)) {
        propertyTypes.push(type);
        confidence += 0.1;
      }
    }
    if (propertyTypes.length > 0) {
      filters.propertyType = propertyTypes;
      explanation += `Property type: ${propertyTypes.join(', ')}. `;
    }

    // Parse bedrooms
    const bedroomMatch = lowerQuery.match(this.patterns.bedrooms);
    if (bedroomMatch) {
      filters.bedrooms = parseInt(bedroomMatch[1]);
      explanation += `${filters.bedrooms}+ bedrooms. `;
      confidence += 0.2;
    }

    // Parse bathrooms
    const bathroomMatch = lowerQuery.match(this.patterns.bathrooms);
    if (bathroomMatch) {
      filters.bathrooms = parseInt(bathroomMatch[1]);
      explanation += `${filters.bathrooms}+ bathrooms. `;
      confidence += 0.1;
    }

    // Parse price range
    const betweenMatch = lowerQuery.match(this.patterns.priceRange.between);
    if (betweenMatch) {
      const min = this.parsePrice(betweenMatch[2]);
      const max = this.parsePrice(betweenMatch[4]);
      filters.minPrice = min;
      filters.maxPrice = max;
      explanation += `Price range: £${min.toLocaleString()} - £${max.toLocaleString()}. `;
      confidence += 0.2;
    } else {
      const underMatch = lowerQuery.match(this.patterns.priceRange.under);
      if (underMatch) {
        filters.maxPrice = this.parsePrice(underMatch[2]);
        explanation += `Maximum price: £${filters.maxPrice.toLocaleString()}. `;
        confidence += 0.2;
      }

      const overMatch = lowerQuery.match(this.patterns.priceRange.over);
      if (overMatch) {
        filters.minPrice = this.parsePrice(overMatch[2]);
        explanation += `Minimum price: £${filters.minPrice.toLocaleString()}. `;
        confidence += 0.2;
      }
    }

    // Parse location
    const postcodeMatch = lowerQuery.match(this.patterns.location.postcode);
    if (postcodeMatch) {
      filters.postcode = postcodeMatch[1];
      explanation += `Location: ${filters.postcode}. `;
      confidence += 0.3;
    }

    const areaMatch = lowerQuery.match(this.patterns.location.area);
    if (areaMatch) {
      filters.postcode = areaMatch[1];
      explanation += `Area: ${areaMatch[1]}. `;
      confidence += 0.2;
    }

    // Adjust confidence based on specificity
    const filterCount = Object.keys(filters).length;
    confidence = Math.min(confidence + (filterCount * 0.1), 1.0);

    return {
      filters,
      intent,
      confidence: Math.max(confidence, 0.3),
      explanation: explanation.trim() || 'General property search'
    };
  }

  private parsePrice(priceStr: string): number {
    const cleanStr = priceStr.replace(/,/g, '');
    const num = parseInt(cleanStr);

    // Handle 'k' suffix (thousands)
    if (priceStr.toLowerCase().includes('k')) {
      return num * 1000;
    }

    // If number is small, assume it's in thousands
    if (num < 10000 && num > 100) {
      return num * 1000;
    }

    return num;
  }

  generateResponse(query: string, searchResults?: any[]): string {
    const parsed = this.parseNaturalLanguageQuery(query);

    if (parsed.intent === 'greeting') {
      return "Hello! I'm here to help you find the perfect property. You can ask me things like:\n\n" +
             "• 'Show me 3 bedroom houses for sale in W11'\n" +
             "• 'Find rentals under £3000 per month'\n" +
             "• 'I'm looking for a modern flat with parking'\n\n" +
             "What kind of property are you looking for?";
    }

    if (parsed.intent === 'question') {
      return "I'd be happy to help answer your question! I specialize in finding properties based on your requirements. " +
             "Try asking me about specific properties you're looking for, and I'll search our database for you.";
    }

    if (searchResults) {
      const count = searchResults.length;
      if (count === 0) {
        return `I couldn't find any properties matching "${query}". ` +
               "Try broadening your search criteria or asking for something like:\n" +
               "• Properties in a different area\n" +
               "• A different price range\n" +
               "• Different number of bedrooms";
      }

      let response = `I found ${count} propert${count === 1 ? 'y' : 'ies'} matching your search`;

      if (parsed.explanation) {
        response += ` (${parsed.explanation})`;
      }

      response += ":\n\n";

      // Summarize results
      const sales = searchResults.filter(p => p.listingType === 'sale');
      const rentals = searchResults.filter(p => p.listingType === 'rent');

      if (sales.length > 0) {
        const avgSalePrice = sales.reduce((sum, p) => sum + p.price, 0) / sales.length;
        response += `📊 **${sales.length} for sale** (avg: £${Math.round(avgSalePrice).toLocaleString()})\n`;
      }

      if (rentals.length > 0) {
        const avgRentPrice = rentals.reduce((sum, p) => sum + p.price, 0) / rentals.length;
        response += `🏠 **${rentals.length} to rent** (avg: £${Math.round(avgRentPrice).toLocaleString()} pcm)\n`;
      }

      response += "\nBrowse the results below, or refine your search by asking for something more specific!";

      return response;
    }

    return `I understand you're looking for properties. Based on your query "${query}", I'll search for: ${parsed.explanation}`;
  }

  addMessage(message: Omit<ChatMessage, 'id' | 'timestamp'>): ChatMessage {
    const newMessage: ChatMessage = {
      ...message,
      id: Date.now().toString(),
      timestamp: new Date(),
    };

    this.chatHistory.push(newMessage);
    return newMessage;
  }

  getChatHistory(): ChatMessage[] {
    return [...this.chatHistory];
  }

  clearHistory(): void {
    this.chatHistory = [];
  }

  // Suggested queries for user guidance
  getSuggestedQueries(): string[] {
    return [
      "Show me 2 bedroom flats for rent under £3500",
      "Find 3 bedroom houses for sale in W11",
      "I want a studio apartment with modern features",
      "Properties with garden and parking for sale",
      "Luxury rentals in Notting Hill area",
      "Houses under £2 million near Holland Park",
      "Modern 1 bed flat with balcony to rent",
      "Period properties with original features"
    ];
  }
}

export const aiPropertySearchService = new AIPropertySearchService();