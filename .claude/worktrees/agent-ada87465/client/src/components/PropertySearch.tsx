import React, { useState, useEffect } from 'react';
import { PropertyData, propertyDataService } from '@/services/propertyDataService';
import { PropertyDataCard } from './PropertyDataCard';
import { Search, Filter, SortAsc, SortDesc, MapPin } from 'lucide-react';
import { Button } from '@/components/ui/button';

type SortField = 'borough' | 'avgHousePrice' | 'councilTax' | 'crimeRate';
type SortDirection = 'asc' | 'desc';

interface PropertySearchProps {
  className?: string;
  maxResults?: number;
  showFilters?: boolean;
}

export const PropertySearch: React.FC<PropertySearchProps> = ({
  className = '',
  maxResults = 8,
  showFilters = true
}) => {
  const [allData, setAllData] = useState<PropertyData[]>([]);
  const [filteredData, setFilteredData] = useState<PropertyData[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortField, setSortField] = useState<SortField>('avgHousePrice');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [priceFilter, setPriceFilter] = useState<{ min: number; max: number }>({ min: 0, max: 2000000 });

  useEffect(() => {
    const loadData = async () => {
      try {
        const data = await propertyDataService.getAllData();
        setAllData(data);
        setFilteredData(data.slice(0, maxResults));
      } catch (error) {
        console.error('Failed to load property data:', error);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [maxResults]);

  useEffect(() => {
    let filtered = allData.filter(item => {
      const matchesSearch = item.borough.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesPrice = item.avgHousePrice >= priceFilter.min && item.avgHousePrice <= priceFilter.max;
      return matchesSearch && matchesPrice;
    });

    // Sort the data
    filtered.sort((a, b) => {
      let aValue = a[sortField];
      let bValue = b[sortField];

      if (sortField === 'borough') {
        aValue = aValue.toString().toLowerCase();
        bValue = bValue.toString().toLowerCase();
      }

      if (sortDirection === 'asc') {
        return aValue < bValue ? -1 : aValue > bValue ? 1 : 0;
      } else {
        return aValue > bValue ? -1 : aValue < bValue ? 1 : 0;
      }
    });

    setFilteredData(filtered.slice(0, maxResults));
  }, [allData, searchTerm, sortField, sortDirection, priceFilter, maxResults]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  const getSortIcon = (field: SortField) => {
    if (sortField !== field) return null;
    return sortDirection === 'asc' ? <SortAsc className="w-4 h-4" /> : <SortDesc className="w-4 h-4" />;
  };

  if (loading) {
    return (
      <div className={`${className}`}>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {Array.from({ length: maxResults }).map((_, i) => (
            <div key={i} className="bg-white/10 backdrop-blur-sm rounded-lg p-6 border border-white/20">
              <div className="animate-pulse">
                <div className="h-6 bg-white/20 rounded mb-4"></div>
                <div className="space-y-3">
                  <div className="h-4 bg-white/10 rounded"></div>
                  <div className="h-4 bg-white/10 rounded"></div>
                  <div className="h-4 bg-white/10 rounded"></div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className={`${className}`}>
      {showFilters && (
        <div className="mb-8 space-y-4">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-white/50 w-5 h-5" />
            <input
              type="text"
              placeholder="Search by borough name..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-3 bg-white/10 backdrop-blur-sm border border-white/20 rounded-lg text-white placeholder-white/50 focus:outline-none focus:border-white/40"
            />
          </div>

          {/* Filters and Sort */}
          <div className="flex flex-wrap gap-4 items-center">
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-white/70" />
              <span className="text-sm text-white/70">Sort by:</span>
            </div>

            <Button
              variant="ghost"
              size="sm"
              onClick={() => handleSort('avgHousePrice')}
              className="text-white/70 hover:text-white hover:bg-white/10"
            >
              Price {getSortIcon('avgHousePrice')}
            </Button>

            <Button
              variant="ghost"
              size="sm"
              onClick={() => handleSort('councilTax')}
              className="text-white/70 hover:text-white hover:bg-white/10"
            >
              Council Tax {getSortIcon('councilTax')}
            </Button>

            <Button
              variant="ghost"
              size="sm"
              onClick={() => handleSort('crimeRate')}
              className="text-white/70 hover:text-white hover:bg-white/10"
            >
              Safety {getSortIcon('crimeRate')}
            </Button>

            <Button
              variant="ghost"
              size="sm"
              onClick={() => handleSort('borough')}
              className="text-white/70 hover:text-white hover:bg-white/10"
            >
              Borough {getSortIcon('borough')}
            </Button>
          </div>

          {/* Price Range Filter */}
          <div className="flex items-center gap-4">
            <span className="text-sm text-white/70">Price range:</span>
            <input
              type="range"
              min="0"
              max="2000000"
              step="50000"
              value={priceFilter.max}
              onChange={(e) => setPriceFilter({ ...priceFilter, max: Number(e.target.value) })}
              className="flex-1 max-w-xs"
            />
            <span className="text-sm text-white/70">
              Up to {propertyDataService.formatPrice(priceFilter.max)}
            </span>
          </div>
        </div>
      )}

      {/* Results */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {filteredData.map((property, index) => (
          <PropertyDataCard
            key={`${property.borough}-${index}`}
            data={property}
            className="transform hover:scale-105 transition-transform duration-200"
          />
        ))}
      </div>

      {filteredData.length === 0 && !loading && (
        <div className="text-center py-12">
          <MapPin className="w-12 h-12 text-white/30 mx-auto mb-4" />
          <p className="text-white/70 text-lg">No properties found matching your criteria</p>
          <p className="text-white/50 text-sm mt-2">Try adjusting your search or filters</p>
        </div>
      )}

      {filteredData.length > 0 && (
        <div className="mt-8 text-center">
          <p className="text-white/50 text-sm">
            Showing {filteredData.length} of {allData.length} London boroughs
          </p>
        </div>
      )}
    </div>
  );
};