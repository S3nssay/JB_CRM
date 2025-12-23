export interface BoroughData {
  borough: string;
  avgHousePrice: number;
  councilTax: number;
  crimeRate: number;
}

export interface BoroughMarketStats {
  totalBoroughs: number;
  averagePrice: number;
  priceRange: {
    min: number;
    max: number;
    minBorough: string;
    maxBorough: string;
  };
  councilTaxRange: {
    min: number;
    max: number;
  };
  crimeStats: {
    average: number;
    safestBorough: string;
    safestRate: number;
  };
}

class PropertyDataService {
  private data: PropertyData[] = [];
  private isLoaded = false;

  async loadData(): Promise<void> {
    if (this.isLoaded) return;

    try {
      const response = await fetch('/attached_assets/london_borough_property_snapshot_2025_1757301217438.csv');
      const csvText = await response.text();
      this.data = this.parseCSV(csvText);
      this.isLoaded = true;
    } catch (error) {
      console.error('Failed to load property data:', error);
      // Fallback to dummy data for development
      this.data = this.getDummyData();
      this.isLoaded = true;
    }
  }

  private parseCSV(csvText: string): PropertyData[] {
    const lines = csvText.trim().split('\n');
    const data: PropertyData[] = [];

    // Skip header row
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      // Parse CSV line accounting for quoted values
      const values = this.parseCSVLine(line);
      if (values.length >= 4) {
        data.push({
          borough: values[0].replace(/"/g, ''),
          avgHousePrice: parseInt(values[1].replace(/[£,]/g, '')) || 0,
          councilTax: parseFloat(values[2]) || 0,
          crimeRate: parseFloat(values[3]) || 0,
        });
      }
    }

    return data;
  }

  private parseCSVLine(line: string): string[] {
    const values: string[] = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];

      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        values.push(current);
        current = '';
      } else {
        current += char;
      }
    }
    values.push(current);
    return values;
  }

  private getDummyData(): PropertyData[] {
    return [
      { borough: 'Westminster', avgHousePrice: 1035000, councilTax: 1017.18, crimeRate: 144 },
      { borough: 'Kensington & Chelsea', avgHousePrice: 1463000, councilTax: 1569.46, crimeRate: 116 },
      { borough: 'Brent', avgHousePrice: 541000, councilTax: 2133.15, crimeRate: 110 },
      { borough: 'Camden', avgHousePrice: 789000, councilTax: 1456.78, crimeRate: 128 },
      { borough: 'Hammersmith & Fulham', avgHousePrice: 678000, councilTax: 1234.56, crimeRate: 95 },
      { borough: 'Wandsworth', avgHousePrice: 612000, councilTax: 987.65, crimeRate: 87 },
      { borough: 'Richmond upon Thames', avgHousePrice: 742000, councilTax: 1543.21, crimeRate: 67 },
      { borough: 'Islington', avgHousePrice: 694000, councilTax: 1678.90, crimeRate: 134 },
    ];
  }

  async getAllData(): Promise<PropertyData[]> {
    await this.loadData();
    return [...this.data];
  }

  async getDataByBorough(borough: string): Promise<PropertyData | null> {
    await this.loadData();
    return this.data.find(item =>
      item.borough.toLowerCase().includes(borough.toLowerCase())
    ) || null;
  }

  async getMarketStats(): Promise<PropertyMarketStats> {
    await this.loadData();

    if (this.data.length === 0) {
      throw new Error('No property data available');
    }

    const prices = this.data.map(d => d.avgHousePrice);
    const councilTaxes = this.data.map(d => d.councilTax);
    const crimeRates = this.data.map(d => d.crimeRate);

    const minPrice = Math.min(...prices);
    const maxPrice = Math.max(...prices);
    const minPriceData = this.data.find(d => d.avgHousePrice === minPrice)!;
    const maxPriceData = this.data.find(d => d.avgHousePrice === maxPrice)!;

    const safestCrimeRate = Math.min(...crimeRates);
    const safestData = this.data.find(d => d.crimeRate === safestCrimeRate)!;

    return {
      totalBoroughs: this.data.length,
      averagePrice: Math.round(prices.reduce((a, b) => a + b, 0) / prices.length),
      priceRange: {
        min: minPrice,
        max: maxPrice,
        minBorough: minPriceData.borough,
        maxBorough: maxPriceData.borough,
      },
      councilTaxRange: {
        min: Math.min(...councilTaxes),
        max: Math.max(...councilTaxes),
      },
      crimeStats: {
        average: Math.round(crimeRates.reduce((a, b) => a + b, 0) / crimeRates.length),
        safestBorough: safestData.borough,
        safestRate: safestCrimeRate,
      },
    };
  }

  formatPrice(price: number): string {
    if (price >= 1000000) {
      return `£${(price / 1000000).toFixed(1)}M`;
    } else if (price >= 1000) {
      return `£${(price / 1000).toFixed(0)}K`;
    } else {
      return `£${price.toFixed(0)}`;
    }
  }

  formatCouncilTax(tax: number): string {
    return `£${tax.toFixed(2)}`;
  }

  formatCrimeRate(rate: number): string {
    return `${rate.toFixed(1)} per 1,000`;
  }
}

export const propertyDataService = new PropertyDataService();