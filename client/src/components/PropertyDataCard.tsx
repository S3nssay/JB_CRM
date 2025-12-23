import React from 'react';
import { PropertyData, propertyDataService } from '@/services/propertyDataService';
import { MapPin, Home, Receipt, Shield, TrendingUp } from 'lucide-react';

interface PropertyDataCardProps {
  data: PropertyData;
  className?: string;
}

export const PropertyDataCard: React.FC<PropertyDataCardProps> = ({ data, className = '' }) => {
  return (
    <div className={`bg-white/10 backdrop-blur-sm rounded-lg p-6 border border-white/20 ${className}`}>
      <div className="flex items-center gap-3 mb-4">
        <MapPin className="w-6 h-6 text-white" />
        <h3 className="text-xl font-bold text-white">{data.borough}</h3>
      </div>

      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <Home className="w-5 h-5 text-[#791E75]300" />
          <div>
            <p className="text-sm text-white/70">Average House Price</p>
            <p className="text-lg font-semibold text-white">
              {propertyDataService.formatPrice(data.avgHousePrice)}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Receipt className="w-5 h-5 text-[#791E75]300" />
          <div>
            <p className="text-sm text-white/70">Council Tax (Band D)</p>
            <p className="text-lg font-semibold text-white">
              {propertyDataService.formatCouncilTax(data.councilTax)}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Shield className="w-5 h-5 text-[#F8B324]300" />
          <div>
            <p className="text-sm text-white/70">Crime Rate</p>
            <p className="text-lg font-semibold text-white">
              {propertyDataService.formatCrimeRate(data.crimeRate)}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

interface PropertyStatsOverviewProps {
  className?: string;
}

export const PropertyStatsOverview: React.FC<PropertyStatsOverviewProps> = ({ className = '' }) => {
  const [stats, setStats] = React.useState<any>(null);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    const loadStats = async () => {
      try {
        const marketStats = await propertyDataService.getMarketStats();
        setStats(marketStats);
      } catch (error) {
        console.error('Failed to load property stats:', error);
      } finally {
        setLoading(false);
      }
    };

    loadStats();
  }, []);

  if (loading) {
    return (
      <div className={`bg-white/10 backdrop-blur-sm rounded-lg p-6 border border-white/20 ${className}`}>
        <div className="animate-pulse">
          <div className="h-6 bg-white/20 rounded mb-4"></div>
          <div className="space-y-3">
            <div className="h-4 bg-white/10 rounded"></div>
            <div className="h-4 bg-white/10 rounded"></div>
            <div className="h-4 bg-white/10 rounded"></div>
          </div>
        </div>
      </div>
    );
  }

  if (!stats) {
    return null;
  }

  return (
    <div className={`bg-white/10 backdrop-blur-sm rounded-lg p-6 border border-white/20 ${className}`}>
      <div className="flex items-center gap-3 mb-6">
        <TrendingUp className="w-6 h-6 text-white" />
        <h3 className="text-xl font-bold text-white">London Market Overview</h3>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <h4 className="text-sm font-semibold text-white/70 mb-3">Property Prices</h4>
          <div className="space-y-2">
            <div className="flex justify-between">
              <span className="text-sm text-white/60">Average:</span>
              <span className="text-sm font-semibold text-white">
                {propertyDataService.formatPrice(stats.averagePrice)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-white/60">Most Affordable:</span>
              <span className="text-sm font-semibold text-[#791E75]300">
                {stats.priceRange.minBorough} ({propertyDataService.formatPrice(stats.priceRange.min)})
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-white/60">Most Expensive:</span>
              <span className="text-sm font-semibold text-red-300">
                {stats.priceRange.maxBorough} ({propertyDataService.formatPrice(stats.priceRange.max)})
              </span>
            </div>
          </div>
        </div>

        <div>
          <h4 className="text-sm font-semibold text-white/70 mb-3">Safety & Living Costs</h4>
          <div className="space-y-2">
            <div className="flex justify-between">
              <span className="text-sm text-white/60">Avg Crime Rate:</span>
              <span className="text-sm font-semibold text-white">
                {propertyDataService.formatCrimeRate(stats.crimeStats.average)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-white/60">Safest Area:</span>
              <span className="text-sm font-semibold text-[#791E75]300">
                {stats.crimeStats.safestBorough} ({propertyDataService.formatCrimeRate(stats.crimeStats.safestRate)})
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-white/60">Council Tax Range:</span>
              <span className="text-sm font-semibold text-white">
                {propertyDataService.formatCouncilTax(stats.councilTaxRange.min)} - {propertyDataService.formatCouncilTax(stats.councilTaxRange.max)}
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-4 pt-4 border-t border-white/20">
        <p className="text-xs text-white/50 text-center">
          Data covering {stats.totalBoroughs} London boroughs • Updated 2025
        </p>
      </div>
    </div>
  );
};