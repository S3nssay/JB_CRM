import { Home, Calendar, Layout } from 'lucide-react';
import { Button } from '@/components/ui/button';

const properties = [
  {
    id: 1,
    type: 'Detached House',
    location: 'Manchester, M1',
    bedrooms: '4',
    propertyType: 'Detached',
    completionTime: '14 Days',
    image: 'https://images.unsplash.com/photo-1580587771525-78b9dba3b914'
  },
  {
    id: 2,
    type: 'Terraced House',
    location: 'Birmingham, B1',
    bedrooms: '3',
    propertyType: 'Terraced',
    completionTime: '21 Days',
    image: 'https://images.unsplash.com/photo-1568605114967-8130f3a36994'
  },
  {
    id: 3,
    type: 'Apartment',
    location: 'London, E1',
    bedrooms: '2',
    propertyType: 'Flat',
    completionTime: '7 Days',
    image: 'https://images.unsplash.com/photo-1599619351208-3e6c839d6828'
  },
  {
    id: 4,
    type: 'Semi-Detached',
    location: 'Bristol, BS1',
    bedrooms: '3',
    propertyType: 'Semi',
    completionTime: '14 Days',
    image: 'https://images.unsplash.com/photo-1574362848149-11496d93a7c7'
  },
  {
    id: 5,
    type: 'Bungalow',
    location: 'Leeds, LS1',
    bedrooms: '2',
    propertyType: 'Bungalow',
    completionTime: '21 Days',
    image: 'https://images.unsplash.com/photo-1576941089067-2de3c901e126'
  },
  {
    id: 6,
    type: 'Cottage',
    location: 'Bath, BA1',
    bedrooms: '2',
    propertyType: 'Cottage',
    completionTime: '28 Days',
    image: 'https://images.unsplash.com/photo-1592595896616-c37162298647'
  }
];

const FeaturedProperties = () => {
  const scrollToValuationForm = () => {
    const element = document.getElementById('valuation-form');
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <section className="py-16 md:py-24 bg-neutral-100">
      <div className="container mx-auto px-4">
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-bold text-primary mb-4">Properties We've Purchased</h2>
          <p className="text-lg text-neutral-600 max-w-3xl mx-auto">
            From modern apartments to charming family homes, we buy all types of properties across the UK, regardless of condition.
          </p>
        </div>
        
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {properties.map((property) => (
            <div key={property.id} className="bg-white rounded-xl overflow-hidden shadow-sm">
              <div className="h-48 bg-neutral-200 flex items-center justify-center">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-16 w-16 text-neutral-400"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1}
                    d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"
                  />
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1}
                    d="M9 22V12h6v10"
                  />
                </svg>
              </div>
              <div className="p-4">
                <div className="flex justify-between items-start mb-2">
                  <h3 className="font-bold">{property.type}</h3>
                  <span className="bg-secondary-light bg-opacity-20 text-secondary text-sm px-2 py-1 rounded">
                    Completed
                  </span>
                </div>
                <p className="text-sm text-neutral-600 mb-2">{property.location}</p>
                <div className="flex items-center text-sm text-neutral-500">
                  <span className="flex items-center mr-3">
                    <Home className="h-4 w-4 mr-1" /> {property.bedrooms} Bed
                  </span>
                  <span className="flex items-center mr-3">
                    <Layout className="h-4 w-4 mr-1" /> {property.propertyType}
                  </span>
                  <span className="flex items-center">
                    <Calendar className="h-4 w-4 mr-1" /> {property.completionTime}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
        
        <div className="mt-10 text-center">
          <Button 
            onClick={scrollToValuationForm}
            className="bg-accent hover:bg-accent-light text-white"
          >
            Get Your Property Valuation
          </Button>
        </div>
      </div>
    </section>
  );
};

export default FeaturedProperties;
