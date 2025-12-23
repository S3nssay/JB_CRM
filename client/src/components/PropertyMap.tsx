import { useState, useEffect } from 'react';
import { MapPin } from 'lucide-react';

interface PropertyMapProps {
  address: string;
  postcode: string;
  latitude?: number | null;
  longitude?: number | null;
  width?: string;
  height?: string;
  zoom?: number;
  className?: string;
}

// Helper to check if we have valid coordinates
const hasCoordinates = (lat?: number | null, lng?: number | null) => {
  return lat !== undefined && lat !== null && lng !== undefined && lng !== null &&
    !isNaN(Number(lat)) && !isNaN(Number(lng)) &&
    Number(lat) !== 0 && Number(lng) !== 0; // Basic check for invalid 0,0 default
};

export function PropertyMap({
  address,
  postcode,
  latitude,
  longitude,
  width = '100%',
  height = '150px',
  zoom = 15,
  className = ''
}: PropertyMapProps) {
  const [apiKey, setApiKey] = useState<string>('');

  // In a real implementation this would come from env vars passed to client build
  // For now we assume it's available globally or we might need to fetch a config endpoint
  // Using a placeholder that the user should have configured in their environment
  const googleMapsKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '';

  // If we don't have coordinates, we can try to use Embed API with Q parameter (address/postcode)
  // If we have coordinates, we can use the Embed API with specific coords

  const mapSrc = (() => {
    if (!googleMapsKey) return '';

    // Priority 1: Use specific coordinates if available
    if (hasCoordinates(latitude, longitude)) {
      return `https://www.google.com/maps/embed/v1/view?key=${googleMapsKey}&center=${latitude},${longitude}&zoom=${zoom}&maptype=roadmap`;
    }

    // Priority 2: Use postcode + "UK" for embed search
    if (postcode) {
      const query = encodeURIComponent(`${postcode}, UK`);
      return `https://www.google.com/maps/embed/v1/place?key=${googleMapsKey}&q=${query}&zoom=${zoom}`;
    }

    return '';
  })();

  if (!googleMapsKey) {
    return (
      <div
        className={`bg-gray-100 rounded-lg flex items-center justify-center ${className}`}
        style={{ width, height }}
      >
        <div className="text-center text-gray-400 p-4">
          <MapPin className="h-6 w-6 mx-auto mb-1" />
          <p className="text-xs">Map configuration missing</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`relative overflow-hidden rounded-lg ${className}`} style={{ width, height }}>
      {mapSrc ? (
        <iframe
          src={mapSrc}
          style={{ width: '100%', height: '100%', border: 0 }}
          title={`Map of ${postcode}`}
          loading="lazy"
        />
      ) : (
        <div className="w-full h-full bg-gray-100 flex items-center justify-center">
          <div className="text-center text-gray-400">
            <MapPin className="h-6 w-6 mx-auto mb-1" />
            <p className="text-xs">Location not found</p>
          </div>
        </div>
      )}

      {/* Address overlay */}
      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent p-2 pointer-events-none">
        <div className="flex items-center text-white text-xs">
          <MapPin className="h-3 w-3 mr-1 flex-shrink-0" />
          <span className="truncate">{postcode}</span>
        </div>
      </div>
    </div>
  );
}

// Mini map for property cards 
// Uses Google Static Maps API for better performance in lists
export function PropertyMiniMap({
  postcode,
  latitude,
  longitude,
  className = ''
}: {
  postcode: string;
  latitude?: number | null;
  longitude?: number | null;
  className?: string;
}) {
  const googleMapsKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '';

  if (!googleMapsKey || (!postcode && !hasCoordinates(latitude, longitude))) {
    return (
      <div className={`bg-gray-100 rounded flex items-center justify-center ${className}`}>
        <MapPin className="h-4 w-4 text-gray-400" />
      </div>
    );
  }

  let mapUrl = '';

  if (hasCoordinates(latitude, longitude)) {
    mapUrl = `https://maps.googleapis.com/maps/api/staticmap?center=${latitude},${longitude}&zoom=15&size=400x400&maptype=roadmap&markers=color:purple%7C${latitude},${longitude}&key=${googleMapsKey}`;
  } else {
    const center = encodeURIComponent(`${postcode}, UK`);
    mapUrl = `https://maps.googleapis.com/maps/api/staticmap?center=${center}&zoom=15&size=400x400&maptype=roadmap&markers=color:purple%7C${center}&key=${googleMapsKey}`;
  }

  return (
    <img
      src={mapUrl}
      alt={`Map for ${postcode}`}
      className={`object-cover rounded w-full h-full ${className}`}
      loading="lazy"
    />
  );
}

export default PropertyMap;
