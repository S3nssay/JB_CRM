import { PropertyListing } from './propertyListingsService';

export const getDemoProperties = (): PropertyListing[] => {
  return [
    // SALES PROPERTIES - 20 properties
    // W11 Sales Properties (7)
    {
      id: 'sale-1',
      address: '123 Portobello Road',
      postcode: 'W11 2DY',
      price: 1250000,
      bedrooms: 3,
      bathrooms: 2,
      propertyType: 'house',
      listingType: 'sale',
      description: 'Stunning Victorian terraced house in the heart of Notting Hill. Beautifully renovated with period features throughout.',
      features: ['Garden', 'Period Features', 'High Ceilings', 'Natural Light', 'Quiet Street'],
      keyFeatures: [
        'Three spacious bedrooms with fitted wardrobes',
        'South-facing garden with decking area',
        'Original Victorian features including fireplaces',
        'Modern kitchen with integrated appliances',
        'Close to Portobello Road Market',
        'EPC Rating = C'
      ],
      propertyFeatures: {
        detached: false,
        semiDetached: false,
        frontGarden: true,
        backGarden: true,
        driveway: false,
        garage: false
      },
      images: ['/api/placeholder/400/300', '/api/placeholder/400/300', '/api/placeholder/400/300'],
      floorPlan: '/api/placeholder/floorplan/1',
      epcRating: 'C',
      councilTaxBand: 'F',
      tenure: 'freehold',
      dateAdded: '2025-01-10',
      agent: {
        name: 'Aslam Noor',
        phone: '+44 20 7123 4567',
        email: 'aslam@johnbarclay.co.uk'
      },
      location: {
        latitude: 51.5158,
        longitude: -0.2058
      }
    },
    {
      id: 'sale-2',
      address: '78 Ladbroke Grove',
      postcode: 'W11 2PA',
      price: 2100000,
      bedrooms: 4,
      bathrooms: 3,
      propertyType: 'house',
      listingType: 'sale',
      description: 'Elegant four bedroom Victorian house with modern kitchen and beautiful rear garden.',
      features: ['Garden', 'Modern Kitchen', 'Victorian Features', 'Off-Street Parking'],
      keyFeatures: [
        'Four double bedrooms with master en-suite',
        'Landscaped rear garden approximately 50ft',
        'Stunning modern kitchen with island',
        'Off-street parking for two vehicles',
        'Original Victorian architectural details',
        'Recently renovated to high specification'
      ],
      propertyFeatures: {
        detached: false,
        semiDetached: true,
        frontGarden: true,
        backGarden: true,
        driveway: true,
        garage: false
      },
      images: ['/api/placeholder/400/300', '/api/placeholder/400/300'],
      floorPlan: '/api/placeholder/floorplan/2',
      epcRating: 'B',
      councilTaxBand: 'G',
      tenure: 'freehold',
      dateAdded: '2025-01-08',
      agent: {
        name: 'Iury Campos',
        phone: '+44 20 7123 4568',
        email: 'iury@johnbarclay.co.uk'
      },
      location: {
        latitude: 51.5151,
        longitude: -0.2081
      }
    },
    {
      id: 'sale-3',
      address: '156 Clarendon Road',
      postcode: 'W11 2HR',
      price: 875000,
      bedrooms: 2,
      bathrooms: 1,
      propertyType: 'flat',
      listingType: 'sale',
      description: 'Bright and spacious two bedroom flat with high ceilings and period charm.',
      features: ['High Ceilings', 'Period Features', 'Natural Light', 'Balcony'],
      images: ['/api/placeholder/400/300'],
      epcRating: 'C',
      councilTaxBand: 'E',
      tenure: 'leasehold',
      dateAdded: '2025-01-05',
      agent: {
        name: 'Mayssaa Sabrah',
        phone: '+44 20 7123 4569',
        email: 'mayssaa@johnbarclay.co.uk'
      },
      location: {
        latitude: 51.5142,
        longitude: -0.2053
      }
    },
    {
      id: 'sale-4',
      address: '45 Blenheim Crescent',
      postcode: 'W11 2EF',
      price: 1650000,
      bedrooms: 3,
      bathrooms: 2,
      propertyType: 'maisonette',
      listingType: 'sale',
      description: 'Charming maisonette over two floors with private garden and period features.',
      features: ['Private Garden', 'Period Features', 'Two Floors', 'Quiet Location'],
      images: ['/api/placeholder/400/300', '/api/placeholder/400/300'],
      epcRating: 'D',
      councilTaxBand: 'F',
      tenure: 'leasehold',
      dateAdded: '2025-01-12',
      agent: {
        name: 'Aslam Noor',
        phone: '+44 20 7123 4567',
        email: 'aslam@johnbarclay.co.uk'
      },
      location: {
        latitude: 51.5149,
        longitude: -0.2043
      }
    },
    {
      id: 'sale-5',
      address: '234 Westbourne Grove',
      postcode: 'W11 2RH',
      price: 3250000,
      bedrooms: 5,
      bathrooms: 4,
      propertyType: 'house',
      listingType: 'sale',
      description: 'Magnificent Victorian house with contemporary extension and luxury finishes.',
      features: ['Garden', 'Contemporary Extension', 'Luxury Finishes', 'Wine Cellar'],
      keyFeatures: [
        'Five luxury bedrooms including two master suites',
        'Award-winning contemporary glass extension',
        'Temperature-controlled wine cellar',
        'Private landscaped garden with summer house',
        'High-end integrated smart home technology',
        'Bespoke fitted kitchen with Gaggenau appliances'
      ],
      propertyFeatures: {
        detached: true,
        semiDetached: false,
        frontGarden: true,
        backGarden: true,
        driveway: true,
        garage: true
      },
      images: ['/api/placeholder/400/300', '/api/placeholder/400/300', '/api/placeholder/400/300'],
      floorPlan: '/api/placeholder/floorplan/5',
      epcRating: 'B',
      councilTaxBand: 'H',
      tenure: 'freehold',
      dateAdded: '2025-01-03',
      agent: {
        name: 'Iury Campos',
        phone: '+44 20 7123 4568',
        email: 'iury@johnbarclay.co.uk'
      },
      location: {
        latitude: 51.5184,
        longitude: -0.2019
      }
    },
    {
      id: 'sale-6',
      address: '67 Kensington Park Road',
      postcode: 'W11 3BU',
      price: 1950000,
      bedrooms: 4,
      bathrooms: 3,
      propertyType: 'house',
      listingType: 'sale',
      description: 'Beautiful family home with original features and modern amenities.',
      features: ['Family Home', 'Original Features', 'Modern Kitchen', 'Garden'],
      propertyFeatures: {
        detached: false,
        semiDetached: false,
        frontGarden: false,
        backGarden: true,
        driveway: false,
        garage: false
      },
      images: ['/api/placeholder/400/300', '/api/placeholder/400/300'],
      epcRating: 'C',
      councilTaxBand: 'G',
      tenure: 'freehold',
      dateAdded: '2025-01-07',
      agent: {
        name: 'Mayssaa Sabrah',
        phone: '+44 20 7123 4569',
        email: 'mayssaa@johnbarclay.co.uk'
      },
      location: {
        latitude: 51.5140,
        longitude: -0.2055
      }
    },
    {
      id: 'sale-7',
      address: '89 Elgin Crescent',
      postcode: 'W11 2JA',
      price: 2800000,
      bedrooms: 5,
      bathrooms: 3,
      propertyType: 'house',
      listingType: 'sale',
      description: 'Exceptional period house with stunning interior design and private garden.',
      features: ['Period House', 'Designer Interior', 'Private Garden', 'Study'],
      propertyFeatures: {
        detached: true,
        semiDetached: false,
        frontGarden: true,
        backGarden: true,
        driveway: false,
        garage: true
      },
      images: ['/api/placeholder/400/300'],
      epcRating: 'C',
      councilTaxBand: 'H',
      tenure: 'freehold',
      dateAdded: '2025-01-14',
      agent: {
        name: 'Aslam Noor',
        phone: '+44 20 7123 4567',
        email: 'aslam@johnbarclay.co.uk'
      },
      location: {
        latitude: 51.5161,
        longitude: -0.2041
      }
    },

    // W10 Sales Properties (5)
    {
      id: 'sale-8',
      address: '145 Harrow Road',
      postcode: 'W10 4RH',
      price: 950000,
      bedrooms: 3,
      bathrooms: 2,
      propertyType: 'house',
      listingType: 'sale',
      description: 'Charming Victorian terrace with modern renovations and private garden.',
      features: ['Victorian Features', 'Modern Renovation', 'Private Garden', 'Parking'],
      propertyFeatures: {
        detached: false,
        semiDetached: false,
        frontGarden: false,
        backGarden: true,
        driveway: true,
        garage: false
      },
      images: ['/api/placeholder/400/300', '/api/placeholder/400/300'],
      epcRating: 'C',
      councilTaxBand: 'E',
      tenure: 'freehold',
      dateAdded: '2025-01-09',
      agent: {
        name: 'Iury Campos',
        phone: '+44 20 7123 4568',
        email: 'iury@johnbarclay.co.uk'
      },
      location: {
        latitude: 51.5286,
        longitude: -0.2198
      }
    },
    {
      id: 'sale-9',
      address: '78 Kensal Road',
      postcode: 'W10 5BN',
      price: 725000,
      bedrooms: 2,
      bathrooms: 1,
      propertyType: 'flat',
      listingType: 'sale',
      description: 'Spacious two bedroom flat with excellent transport links and modern fixtures.',
      features: ['Transport Links', 'Modern Fixtures', 'Spacious', 'Natural Light'],
      images: ['/api/placeholder/400/300'],
      epcRating: 'B',
      councilTaxBand: 'D',
      tenure: 'leasehold',
      dateAdded: '2025-01-11',
      agent: {
        name: 'Mayssaa Sabrah',
        phone: '+44 20 7123 4569',
        email: 'mayssaa@johnbarclay.co.uk'
      },
      location: {
        latitude: 51.5312,
        longitude: -0.2234
      }
    },
    {
      id: 'sale-10',
      address: '234 Ladbroke Grove',
      postcode: 'W10 6HB',
      price: 1850000,
      bedrooms: 4,
      bathrooms: 3,
      propertyType: 'house',
      listingType: 'sale',
      description: 'Impressive four bedroom house with period charm and contemporary touches.',
      features: ['Period Charm', 'Contemporary Design', 'Garden', 'Study'],
      propertyFeatures: {
        detached: false,
        semiDetached: true,
        frontGarden: true,
        backGarden: true,
        driveway: true,
        garage: false
      },
      images: ['/api/placeholder/400/300', '/api/placeholder/400/300'],
      epcRating: 'C',
      councilTaxBand: 'F',
      tenure: 'freehold',
      dateAdded: '2025-01-06',
      agent: {
        name: 'Aslam Noor',
        phone: '+44 20 7123 4567',
        email: 'aslam@johnbarclay.co.uk'
      },
      location: {
        latitude: 51.5201,
        longitude: -0.2156
      }
    },
    {
      id: 'sale-11',
      address: '56 Bramley Road',
      postcode: 'W10 6SZ',
      price: 1150000,
      bedrooms: 3,
      bathrooms: 2,
      propertyType: 'maisonette',
      listingType: 'sale',
      description: 'Delightful maisonette with original features and modern kitchen.',
      features: ['Original Features', 'Modern Kitchen', 'Maisonette', 'Balcony'],
      images: ['/api/placeholder/400/300'],
      epcRating: 'D',
      councilTaxBand: 'E',
      tenure: 'leasehold',
      dateAdded: '2025-01-13',
      agent: {
        name: 'Iury Campos',
        phone: '+44 20 7123 4568',
        email: 'iury@johnbarclay.co.uk'
      },
      location: {
        latitude: 51.5223,
        longitude: -0.2187
      }
    },
    {
      id: 'sale-12',
      address: '123 Golborne Road',
      postcode: 'W10 5NL',
      price: 675000,
      bedrooms: 1,
      bathrooms: 1,
      propertyType: 'flat',
      listingType: 'sale',
      description: 'Modern one bedroom flat with excellent amenities and transport connections.',
      features: ['Modern Design', 'Transport Links', 'Amenities', 'Balcony'],
      images: ['/api/placeholder/400/300'],
      epcRating: 'B',
      councilTaxBand: 'C',
      tenure: 'leasehold',
      dateAdded: '2025-01-15',
      agent: {
        name: 'Mayssaa Sabrah',
        phone: '+44 20 7123 4569',
        email: 'mayssaa@johnbarclay.co.uk'
      },
      location: {
        latitude: 51.5298,
        longitude: -0.2198
      }
    },

    // W9 Sales Properties (3)
    {
      id: 'sale-13',
      address: '89 Warwick Avenue',
      postcode: 'W9 2PT',
      price: 1450000,
      bedrooms: 3,
      bathrooms: 2,
      propertyType: 'flat',
      listingType: 'sale',
      description: 'Elegant three bedroom flat with canal views and period features.',
      features: ['Canal Views', 'Period Features', 'Elegant', 'Central Location'],
      images: ['/api/placeholder/400/300', '/api/placeholder/400/300'],
      epcRating: 'C',
      councilTaxBand: 'F',
      tenure: 'leasehold',
      dateAdded: '2025-01-04',
      agent: {
        name: 'Aslam Noor',
        phone: '+44 20 7123 4567',
        email: 'aslam@johnbarclay.co.uk'
      },
      location: {
        latitude: 51.5234,
        longitude: -0.1834
      }
    },
    {
      id: 'sale-14',
      address: '156 Formosa Street',
      postcode: 'W9 2JS',
      price: 2250000,
      bedrooms: 4,
      bathrooms: 3,
      propertyType: 'house',
      listingType: 'sale',
      description: 'Beautiful Victorian house near Little Venice with private garden.',
      features: ['Victorian House', 'Little Venice', 'Private Garden', 'Period Features'],
      propertyFeatures: {
        detached: true,
        semiDetached: false,
        frontGarden: true,
        backGarden: true,
        driveway: false,
        garage: false
      },
      images: ['/api/placeholder/400/300', '/api/placeholder/400/300'],
      epcRating: 'C',
      councilTaxBand: 'G',
      tenure: 'freehold',
      dateAdded: '2025-01-02',
      agent: {
        name: 'Iury Campos',
        phone: '+44 20 7123 4568',
        email: 'iury@johnbarclay.co.uk'
      },
      location: {
        latitude: 51.5218,
        longitude: -0.1856
      }
    },
    {
      id: 'sale-15',
      address: '67 Clifton Gardens',
      postcode: 'W9 1DT',
      price: 1850000,
      bedrooms: 4,
      bathrooms: 2,
      propertyType: 'maisonette',
      listingType: 'sale',
      description: 'Stunning maisonette with canal views and contemporary interior.',
      features: ['Canal Views', 'Contemporary Interior', 'Maisonette', 'Garden Access'],
      images: ['/api/placeholder/400/300'],
      epcRating: 'B',
      councilTaxBand: 'F',
      tenure: 'leasehold',
      dateAdded: '2025-01-16',
      agent: {
        name: 'Mayssaa Sabrah',
        phone: '+44 20 7123 4569',
        email: 'mayssaa@johnbarclay.co.uk'
      },
      location: {
        latitude: 51.5201,
        longitude: -0.1823
      }
    },

    // NW6 Sales Properties (3)
    {
      id: 'sale-16',
      address: '234 Kilburn High Road',
      postcode: 'NW6 2DB',
      price: 825000,
      bedrooms: 2,
      bathrooms: 2,
      propertyType: 'flat',
      listingType: 'sale',
      description: 'Modern two bedroom flat with excellent transport links and amenities.',
      features: ['Modern Design', 'Transport Links', 'Two Bathrooms', 'Amenities'],
      images: ['/api/placeholder/400/300'],
      epcRating: 'B',
      councilTaxBand: 'D',
      tenure: 'leasehold',
      dateAdded: '2025-01-01',
      agent: {
        name: 'Aslam Noor',
        phone: '+44 20 7123 4567',
        email: 'aslam@johnbarclay.co.uk'
      },
      location: {
        latitude: 51.5467,
        longitude: -0.1947
      }
    },
    {
      id: 'sale-17',
      address: '78 West End Lane',
      postcode: 'NW6 1LX',
      price: 1650000,
      bedrooms: 4,
      bathrooms: 3,
      propertyType: 'house',
      listingType: 'sale',
      description: 'Charming family home with garden and period character.',
      features: ['Family Home', 'Garden', 'Period Character', 'Four Bedrooms'],
      propertyFeatures: {
        detached: false,
        semiDetached: true,
        frontGarden: false,
        backGarden: true,
        driveway: true,
        garage: true
      },
      images: ['/api/placeholder/400/300', '/api/placeholder/400/300'],
      epcRating: 'C',
      councilTaxBand: 'F',
      tenure: 'freehold',
      dateAdded: '2024-12-28',
      agent: {
        name: 'Iury Campos',
        phone: '+44 20 7123 4568',
        email: 'iury@johnbarclay.co.uk'
      },
      location: {
        latitude: 51.5523,
        longitude: -0.1934
      }
    },
    {
      id: 'sale-18',
      address: '145 Fortune Green Road',
      postcode: 'NW6 1UN',
      price: 1125000,
      bedrooms: 3,
      bathrooms: 2,
      propertyType: 'house',
      listingType: 'sale',
      description: 'Victorian terrace with modern kitchen and beautiful rear garden.',
      features: ['Victorian Terrace', 'Modern Kitchen', 'Rear Garden', 'Period Features'],
      propertyFeatures: {
        detached: false,
        semiDetached: false,
        frontGarden: false,
        backGarden: true,
        driveway: false,
        garage: false
      },
      images: ['/api/placeholder/400/300'],
      epcRating: 'C',
      councilTaxBand: 'E',
      tenure: 'freehold',
      dateAdded: '2024-12-30',
      agent: {
        name: 'Mayssaa Sabrah',
        phone: '+44 20 7123 4569',
        email: 'mayssaa@johnbarclay.co.uk'
      },
      location: {
        latitude: 51.5589,
        longitude: -0.1923
      }
    },

    // NW10 Sales Properties (2)
    {
      id: 'sale-19',
      address: '89 High Street',
      postcode: 'NW10 4TR',
      price: 675000,
      bedrooms: 2,
      bathrooms: 1,
      propertyType: 'flat',
      listingType: 'sale',
      description: 'Bright two bedroom flat with excellent transport connections.',
      features: ['Transport Links', 'Bright', 'Two Bedrooms', 'Modern'],
      images: ['/api/placeholder/400/300'],
      epcRating: 'B',
      councilTaxBand: 'D',
      tenure: 'leasehold',
      dateAdded: '2024-12-27',
      agent: {
        name: 'Aslam Noor',
        phone: '+44 20 7123 4567',
        email: 'aslam@johnbarclay.co.uk'
      },
      location: {
        latitude: 51.5334,
        longitude: -0.2456
      }
    },
    {
      id: 'sale-20',
      address: '234 Harlesden Road',
      postcode: 'NW10 3RN',
      price: 950000,
      bedrooms: 3,
      bathrooms: 2,
      propertyType: 'house',
      listingType: 'sale',
      description: 'Family house with garden and good transport links.',
      features: ['Family House', 'Garden', 'Transport Links', 'Three Bedrooms'],
      propertyFeatures: {
        detached: false,
        semiDetached: true,
        frontGarden: true,
        backGarden: true,
        driveway: false,
        garage: false
      },
      images: ['/api/placeholder/400/300', '/api/placeholder/400/300'],
      epcRating: 'C',
      councilTaxBand: 'E',
      tenure: 'freehold',
      dateAdded: '2024-12-26',
      agent: {
        name: 'Iury Campos',
        phone: '+44 20 7123 4568',
        email: 'iury@johnbarclay.co.uk'
      },
      location: {
        latitude: 51.5367,
        longitude: -0.2489
      }
    },

    // RENTAL PROPERTIES - 20 properties
    // W11 Rental Properties (7)
    {
      id: 'rent-1',
      address: '45 Ladbroke Grove',
      postcode: 'W11 3BG',
      price: 3500,
      bedrooms: 2,
      bathrooms: 1,
      propertyType: 'flat',
      listingType: 'rent',
      description: 'Modern 2-bedroom apartment with excellent transport links. Perfect for professionals.',
      features: ['Balcony', 'Modern Kitchen', 'Fitted Wardrobes', 'Transport Links'],
      images: ['/api/placeholder/400/300', '/api/placeholder/400/300'],
      epcRating: 'B',
      councilTaxBand: 'D',
      tenure: 'leasehold',
      dateAdded: '2025-01-08',
      agent: {
        name: 'Iury Campos',
        phone: '+44 20 7123 4568',
        email: 'iury@johnbarclay.co.uk'
      },
      location: {
        latitude: 51.5145,
        longitude: -0.2076
      }
    },
    {
      id: 'rent-2',
      address: '22 Pembridge Crescent',
      postcode: 'W11 3HL',
      price: 4200,
      bedrooms: 3,
      bathrooms: 2,
      propertyType: 'maisonette',
      listingType: 'rent',
      description: 'Beautiful maisonette in prestigious Pembridge Crescent. Spacious and elegant with period charm.',
      features: ['Period Charm', 'Spacious', 'Prestigious Location', 'High Ceilings'],
      images: ['/api/placeholder/400/300', '/api/placeholder/400/300', '/api/placeholder/400/300'],
      epcRating: 'C',
      councilTaxBand: 'F',
      tenure: 'leasehold',
      dateAdded: '2025-01-07',
      agent: {
        name: 'Mayssaa Sabrah',
        phone: '+44 20 7123 4569',
        email: 'mayssaa@johnbarclay.co.uk'
      },
      location: {
        latitude: 51.5121,
        longitude: -0.2042
      }
    },
    {
      id: 'rent-3',
      address: '134 Talbot Road',
      postcode: 'W11 1JA',
      price: 2800,
      bedrooms: 2,
      bathrooms: 1,
      propertyType: 'flat',
      listingType: 'rent',
      description: 'Charming two bedroom flat with period features and modern amenities.',
      features: ['Period Features', 'Modern Amenities', 'Natural Light', 'Quiet Street'],
      images: ['/api/placeholder/400/300'],
      epcRating: 'C',
      councilTaxBand: 'E',
      tenure: 'leasehold',
      dateAdded: '2025-01-12',
      agent: {
        name: 'Aslam Noor',
        phone: '+44 20 7123 4567',
        email: 'aslam@johnbarclay.co.uk'
      },
      location: {
        latitude: 51.5167,
        longitude: -0.2089
      }
    },
    {
      id: 'rent-4',
      address: '67 Lancaster Road',
      postcode: 'W11 1QQ',
      price: 5200,
      bedrooms: 4,
      bathrooms: 3,
      propertyType: 'house',
      listingType: 'rent',
      description: 'Stunning four bedroom house with garden and period features throughout.',
      features: ['Garden', 'Period Features', 'Four Bedrooms', 'Parking'],
      propertyFeatures: {
        detached: false,
        semiDetached: true,
        frontGarden: true,
        backGarden: true,
        driveway: true,
        garage: true
      },
      images: ['/api/placeholder/400/300', '/api/placeholder/400/300'],
      epcRating: 'C',
      councilTaxBand: 'G',
      tenure: 'freehold',
      dateAdded: '2025-01-09',
      agent: {
        name: 'Iury Campos',
        phone: '+44 20 7123 4568',
        email: 'iury@johnbarclay.co.uk'
      },
      location: {
        latitude: 51.5178,
        longitude: -0.2034
      }
    },
    {
      id: 'rent-5',
      address: '189 Westbourne Park Road',
      postcode: 'W11 2QA',
      price: 2400,
      bedrooms: 1,
      bathrooms: 1,
      propertyType: 'studio',
      listingType: 'rent',
      description: 'Modern studio apartment with excellent facilities and transport links.',
      features: ['Modern', 'Studio', 'Transport Links', 'Facilities'],
      images: ['/api/placeholder/400/300'],
      epcRating: 'A',
      councilTaxBand: 'C',
      tenure: 'leasehold',
      dateAdded: '2025-01-11',
      agent: {
        name: 'Mayssaa Sabrah',
        phone: '+44 20 7123 4569',
        email: 'mayssaa@johnbarclay.co.uk'
      },
      location: {
        latitude: 51.5198,
        longitude: -0.2012
      }
    },
    {
      id: 'rent-6',
      address: '78 Colville Terrace',
      postcode: 'W11 2BP',
      price: 3800,
      bedrooms: 3,
      bathrooms: 2,
      propertyType: 'flat',
      listingType: 'rent',
      description: 'Spacious three bedroom flat in popular Colville Terrace.',
      features: ['Spacious', 'Popular Location', 'Three Bedrooms', 'Balcony'],
      images: ['/api/placeholder/400/300', '/api/placeholder/400/300'],
      epcRating: 'C',
      councilTaxBand: 'E',
      tenure: 'leasehold',
      dateAdded: '2025-01-06',
      agent: {
        name: 'Aslam Noor',
        phone: '+44 20 7123 4567',
        email: 'aslam@johnbarclay.co.uk'
      },
      location: {
        latitude: 51.5156,
        longitude: -0.2067
      }
    },
    {
      id: 'rent-7',
      address: '234 All Saints Road',
      postcode: 'W11 1HH',
      price: 4500,
      bedrooms: 3,
      bathrooms: 2,
      propertyType: 'maisonette',
      listingType: 'rent',
      description: 'Stylish maisonette with contemporary design and period character.',
      features: ['Contemporary Design', 'Period Character', 'Stylish', 'Garden Access'],
      images: ['/api/placeholder/400/300'],
      epcRating: 'B',
      councilTaxBand: 'F',
      tenure: 'leasehold',
      dateAdded: '2025-01-14',
      agent: {
        name: 'Iury Campos',
        phone: '+44 20 7123 4568',
        email: 'iury@johnbarclay.co.uk'
      },
      location: {
        latitude: 51.5189,
        longitude: -0.2098
      }
    },

    // W10 Rental Properties (5)
    {
      id: 'rent-8',
      address: '123 Kensal Road',
      postcode: 'W10 5BN',
      price: 2600,
      bedrooms: 2,
      bathrooms: 1,
      propertyType: 'flat',
      listingType: 'rent',
      description: 'Comfortable two bedroom flat with good transport connections.',
      features: ['Transport Links', 'Comfortable', 'Two Bedrooms', 'Modern Kitchen'],
      images: ['/api/placeholder/400/300'],
      epcRating: 'C',
      councilTaxBand: 'D',
      tenure: 'leasehold',
      dateAdded: '2025-01-10',
      agent: {
        name: 'Mayssaa Sabrah',
        phone: '+44 20 7123 4569',
        email: 'mayssaa@johnbarclay.co.uk'
      },
      location: {
        latitude: 51.5312,
        longitude: -0.2234
      }
    },
    {
      id: 'rent-9',
      address: '67 Golborne Road',
      postcode: 'W10 5NR',
      price: 1900,
      bedrooms: 1,
      bathrooms: 1,
      propertyType: 'flat',
      listingType: 'rent',
      description: 'Cozy one bedroom flat in vibrant Golborne Road area.',
      features: ['Vibrant Area', 'Cozy', 'One Bedroom', 'Local Amenities'],
      images: ['/api/placeholder/400/300'],
      epcRating: 'C',
      councilTaxBand: 'C',
      tenure: 'leasehold',
      dateAdded: '2025-01-13',
      agent: {
        name: 'Aslam Noor',
        phone: '+44 20 7123 4567',
        email: 'aslam@johnbarclay.co.uk'
      },
      location: {
        latitude: 51.5298,
        longitude: -0.2198
      }
    },
    {
      id: 'rent-10',
      address: '189 Ladbroke Grove',
      postcode: 'W10 6HG',
      price: 3200,
      bedrooms: 2,
      bathrooms: 2,
      propertyType: 'flat',
      listingType: 'rent',
      description: 'Modern two bedroom flat with two bathrooms and excellent amenities.',
      features: ['Modern', 'Two Bathrooms', 'Amenities', 'Spacious'],
      images: ['/api/placeholder/400/300', '/api/placeholder/400/300'],
      epcRating: 'B',
      councilTaxBand: 'D',
      tenure: 'leasehold',
      dateAdded: '2025-01-05',
      agent: {
        name: 'Iury Campos',
        phone: '+44 20 7123 4568',
        email: 'iury@johnbarclay.co.uk'
      },
      location: {
        latitude: 51.5201,
        longitude: -0.2156
      }
    },
    {
      id: 'rent-11',
      address: '78 Bramley Road',
      postcode: 'W10 6SZ',
      price: 2900,
      bedrooms: 2,
      bathrooms: 1,
      propertyType: 'maisonette',
      listingType: 'rent',
      description: 'Charming maisonette with period features and modern kitchen.',
      features: ['Period Features', 'Modern Kitchen', 'Charming', 'Maisonette'],
      images: ['/api/placeholder/400/300'],
      epcRating: 'C',
      councilTaxBand: 'E',
      tenure: 'leasehold',
      dateAdded: '2025-01-15',
      agent: {
        name: 'Mayssaa Sabrah',
        phone: '+44 20 7123 4569',
        email: 'mayssaa@johnbarclay.co.uk'
      },
      location: {
        latitude: 51.5223,
        longitude: -0.2187
      }
    },
    {
      id: 'rent-12',
      address: '145 Harrow Road',
      postcode: 'W10 4RH',
      price: 3600,
      bedrooms: 3,
      bathrooms: 2,
      propertyType: 'house',
      listingType: 'rent',
      description: 'Three bedroom house with garden and period character.',
      features: ['Three Bedrooms', 'Garden', 'Period Character', 'Family Home'],
      propertyFeatures: {
        detached: false,
        semiDetached: false,
        frontGarden: true,
        backGarden: true,
        driveway: false,
        garage: false
      },
      images: ['/api/placeholder/400/300', '/api/placeholder/400/300'],
      epcRating: 'C',
      councilTaxBand: 'F',
      tenure: 'freehold',
      dateAdded: '2025-01-04',
      agent: {
        name: 'Aslam Noor',
        phone: '+44 20 7123 4567',
        email: 'aslam@johnbarclay.co.uk'
      },
      location: {
        latitude: 51.5286,
        longitude: -0.2198
      }
    },

    // W9 Rental Properties (3)
    {
      id: 'rent-13',
      address: '89 Westbourne Park Road',
      postcode: 'W2 5QH',
      price: 2800,
      bedrooms: 1,
      bathrooms: 1,
      propertyType: 'studio',
      listingType: 'rent',
      description: 'Stylish studio apartment in sought-after Westbourne Park. Perfect for young professionals.',
      features: ['Concierge', 'Gym', 'Modern', 'Transport Links'],
      images: ['/api/placeholder/400/300', '/api/placeholder/400/300'],
      epcRating: 'A',
      councilTaxBand: 'C',
      tenure: 'leasehold',
      dateAdded: '2025-01-12',
      agent: {
        name: 'Aslam Noor',
        phone: '+44 20 7123 4567',
        email: 'aslam@johnbarclay.co.uk'
      },
      location: {
        latitude: 51.5205,
        longitude: -0.2015
      }
    },
    {
      id: 'rent-14',
      address: '234 Warwick Avenue',
      postcode: 'W9 2PT',
      price: 4800,
      bedrooms: 3,
      bathrooms: 2,
      propertyType: 'flat',
      listingType: 'rent',
      description: 'Elegant three bedroom flat with canal views and period features.',
      features: ['Canal Views', 'Period Features', 'Elegant', 'Three Bedrooms'],
      images: ['/api/placeholder/400/300', '/api/placeholder/400/300'],
      epcRating: 'C',
      councilTaxBand: 'F',
      tenure: 'leasehold',
      dateAdded: '2025-01-03',
      agent: {
        name: 'Iury Campos',
        phone: '+44 20 7123 4568',
        email: 'iury@johnbarclay.co.uk'
      },
      location: {
        latitude: 51.5234,
        longitude: -0.1834
      }
    },
    {
      id: 'rent-15',
      address: '78 Formosa Street',
      postcode: 'W9 2JS',
      price: 3900,
      bedrooms: 2,
      bathrooms: 2,
      propertyType: 'maisonette',
      listingType: 'rent',
      description: 'Beautiful maisonette near Little Venice with modern amenities.',
      features: ['Little Venice', 'Modern Amenities', 'Maisonette', 'Two Bathrooms'],
      images: ['/api/placeholder/400/300'],
      epcRating: 'B',
      councilTaxBand: 'E',
      tenure: 'leasehold',
      dateAdded: '2025-01-01',
      agent: {
        name: 'Mayssaa Sabrah',
        phone: '+44 20 7123 4569',
        email: 'mayssaa@johnbarclay.co.uk'
      },
      location: {
        latitude: 51.5218,
        longitude: -0.1856
      }
    },

    // NW6 Rental Properties (3)
    {
      id: 'rent-16',
      address: '145 Kilburn High Road',
      postcode: 'NW6 2DB',
      price: 2200,
      bedrooms: 1,
      bathrooms: 1,
      propertyType: 'flat',
      listingType: 'rent',
      description: 'Modern one bedroom flat with excellent transport links.',
      features: ['Modern', 'Transport Links', 'One Bedroom', 'Amenities'],
      images: ['/api/placeholder/400/300'],
      epcRating: 'B',
      councilTaxBand: 'D',
      tenure: 'leasehold',
      dateAdded: '2025-01-02',
      agent: {
        name: 'Aslam Noor',
        phone: '+44 20 7123 4567',
        email: 'aslam@johnbarclay.co.uk'
      },
      location: {
        latitude: 51.5467,
        longitude: -0.1947
      }
    },
    {
      id: 'rent-17',
      address: '67 West End Lane',
      postcode: 'NW6 1LX',
      price: 3500,
      bedrooms: 2,
      bathrooms: 2,
      propertyType: 'flat',
      listingType: 'rent',
      description: 'Spacious two bedroom flat with two bathrooms and garden access.',
      features: ['Spacious', 'Two Bathrooms', 'Garden Access', 'Two Bedrooms'],
      images: ['/api/placeholder/400/300', '/api/placeholder/400/300'],
      epcRating: 'C',
      councilTaxBand: 'E',
      tenure: 'leasehold',
      dateAdded: '2024-12-29',
      agent: {
        name: 'Iury Campos',
        phone: '+44 20 7123 4568',
        email: 'iury@johnbarclay.co.uk'
      },
      location: {
        latitude: 51.5523,
        longitude: -0.1934
      }
    },
    {
      id: 'rent-18',
      address: '234 Fortune Green Road',
      postcode: 'NW6 1UN',
      price: 4200,
      bedrooms: 3,
      bathrooms: 2,
      propertyType: 'house',
      listingType: 'rent',
      description: 'Family house with garden and period features.',
      features: ['Family House', 'Garden', 'Period Features', 'Three Bedrooms'],
      propertyFeatures: {
        detached: false,
        semiDetached: true,
        frontGarden: true,
        backGarden: true,
        driveway: true,
        garage: false
      },
      images: ['/api/placeholder/400/300'],
      epcRating: 'C',
      councilTaxBand: 'F',
      tenure: 'freehold',
      dateAdded: '2024-12-31',
      agent: {
        name: 'Mayssaa Sabrah',
        phone: '+44 20 7123 4569',
        email: 'mayssaa@johnbarclay.co.uk'
      },
      location: {
        latitude: 51.5589,
        longitude: -0.1923
      }
    },

    // NW10 Rental Properties (2)
    {
      id: 'rent-19',
      address: '123 High Street',
      postcode: 'NW10 4TR',
      price: 1800,
      bedrooms: 1,
      bathrooms: 1,
      propertyType: 'flat',
      listingType: 'rent',
      description: 'Comfortable one bedroom flat with transport links.',
      features: ['Transport Links', 'Comfortable', 'One Bedroom', 'Modern'],
      images: ['/api/placeholder/400/300'],
      epcRating: 'B',
      councilTaxBand: 'C',
      tenure: 'leasehold',
      dateAdded: '2024-12-28',
      agent: {
        name: 'Aslam Noor',
        phone: '+44 20 7123 4567',
        email: 'aslam@johnbarclay.co.uk'
      },
      location: {
        latitude: 51.5334,
        longitude: -0.2456
      }
    },
    {
      id: 'rent-20',
      address: '189 Harlesden Road',
      postcode: 'NW10 3RN',
      price: 2900,
      bedrooms: 2,
      bathrooms: 1,
      propertyType: 'house',
      listingType: 'rent',
      description: 'Two bedroom house with garden and parking.',
      features: ['Two Bedrooms', 'Garden', 'Parking', 'House'],
      propertyFeatures: {
        detached: false,
        semiDetached: true,
        frontGarden: false,
        backGarden: true,
        driveway: true,
        garage: false
      },
      images: ['/api/placeholder/400/300', '/api/placeholder/400/300'],
      epcRating: 'C',
      councilTaxBand: 'D',
      tenure: 'freehold',
      dateAdded: '2024-12-25',
      agent: {
        name: 'Iury Campos',
        phone: '+44 20 7123 4568',
        email: 'iury@johnbarclay.co.uk'
      },
      location: {
        latitude: 51.5367,
        longitude: -0.2489
      }
    },

    // COMMERCIAL PROPERTIES - 20 properties
    // W11 Commercial Properties (7)
    {
      id: 'commercial-1',
      address: '123 Portobello Road',
      postcode: 'W11 2DX',
      price: 8500,
      bedrooms: 0,
      bathrooms: 2,
      propertyType: 'flat',
      listingType: 'rent',
      description: 'Prime retail space on famous Portobello Road with high footfall.',
      features: ['Prime Location', 'High Footfall', 'Retail Space', 'Portobello Road'],
      images: ['/api/placeholder/400/300', '/api/placeholder/400/300'],
      epcRating: 'C',
      councilTaxBand: 'A',
      tenure: 'leasehold',
      dateAdded: '2025-01-10',
      agent: {
        name: 'Aslam Noor',
        phone: '+44 20 7123 4567',
        email: 'aslam@johnbarclay.co.uk'
      },
      location: {
        latitude: 51.5158,
        longitude: -0.2058
      }
    },
    {
      id: 'commercial-2',
      address: '234 Westbourne Grove',
      postcode: 'W11 2RH',
      price: 12000,
      bedrooms: 0,
      bathrooms: 1,
      propertyType: 'flat',
      listingType: 'rent',
      description: 'Elegant boutique space in prestigious Westbourne Grove shopping area.',
      features: ['Boutique Space', 'Prestigious Location', 'Shopping Area', 'Ground Floor'],
      images: ['/api/placeholder/400/300'],
      epcRating: 'B',
      councilTaxBand: 'A',
      tenure: 'leasehold',
      dateAdded: '2025-01-08',
      agent: {
        name: 'Iury Campos',
        phone: '+44 20 7123 4568',
        email: 'iury@johnbarclay.co.uk'
      },
      location: {
        latitude: 51.5184,
        longitude: -0.2019
      }
    },
    {
      id: 'commercial-3',
      address: '67 Ladbroke Grove',
      postcode: 'W11 2PA',
      price: 6500,
      bedrooms: 0,
      bathrooms: 1,
      propertyType: 'flat',
      listingType: 'rent',
      description: 'Modern office space with excellent transport connections.',
      features: ['Office Space', 'Modern', 'Transport Links', 'Professional'],
      images: ['/api/placeholder/400/300', '/api/placeholder/400/300'],
      epcRating: 'A',
      councilTaxBand: 'A',
      tenure: 'leasehold',
      dateAdded: '2025-01-05',
      agent: {
        name: 'Mayssaa Sabrah',
        phone: '+44 20 7123 4569',
        email: 'mayssaa@johnbarclay.co.uk'
      },
      location: {
        latitude: 51.5151,
        longitude: -0.2081
      }
    },
    {
      id: 'commercial-4',
      address: '189 Kensington Park Road',
      postcode: 'W11 2ES',
      price: 15000,
      bedrooms: 0,
      bathrooms: 3,
      propertyType: 'house',
      listingType: 'rent',
      description: 'Premium restaurant space with kitchen facilities and outdoor seating.',
      features: ['Restaurant Space', 'Kitchen Facilities', 'Outdoor Seating', 'Premium'],
      propertyFeatures: {
        detached: false,
        semiDetached: false,
        frontGarden: false,
        backGarden: true,
        driveway: false,
        garage: false
      },
      images: ['/api/placeholder/400/300', '/api/placeholder/400/300'],
      epcRating: 'B',
      councilTaxBand: 'A',
      tenure: 'leasehold',
      dateAdded: '2025-01-12',
      agent: {
        name: 'Aslam Noor',
        phone: '+44 20 7123 4567',
        email: 'aslam@johnbarclay.co.uk'
      },
      location: {
        latitude: 51.5140,
        longitude: -0.2055
      }
    },
    {
      id: 'commercial-5',
      address: '78 Elgin Crescent',
      postcode: 'W11 2JN',
      price: 4500,
      bedrooms: 0,
      bathrooms: 1,
      propertyType: 'studio',
      listingType: 'rent',
      description: 'Creative studio space perfect for artists and designers.',
      features: ['Creative Studio', 'Artists Space', 'Natural Light', 'Flexible Layout'],
      images: ['/api/placeholder/400/300'],
      epcRating: 'C',
      councilTaxBand: 'A',
      tenure: 'leasehold',
      dateAdded: '2025-01-03',
      agent: {
        name: 'Iury Campos',
        phone: '+44 20 7123 4568',
        email: 'iury@johnbarclay.co.uk'
      },
      location: {
        latitude: 51.5161,
        longitude: -0.2041
      }
    },
    {
      id: 'commercial-6',
      address: '145 Blenheim Crescent',
      postcode: 'W11 2EE',
      price: 7800,
      bedrooms: 0,
      bathrooms: 2,
      propertyType: 'flat',
      listingType: 'rent',
      description: 'Professional office suite with meeting rooms and reception area.',
      features: ['Office Suite', 'Meeting Rooms', 'Reception Area', 'Professional'],
      images: ['/api/placeholder/400/300', '/api/placeholder/400/300'],
      epcRating: 'B',
      councilTaxBand: 'A',
      tenure: 'leasehold',
      dateAdded: '2025-01-07',
      agent: {
        name: 'Mayssaa Sabrah',
        phone: '+44 20 7123 4569',
        email: 'mayssaa@johnbarclay.co.uk'
      },
      location: {
        latitude: 51.5149,
        longitude: -0.2043
      }
    },
    {
      id: 'commercial-7',
      address: '234 All Saints Road',
      postcode: 'W11 1HH',
      price: 5200,
      bedrooms: 0,
      bathrooms: 1,
      propertyType: 'flat',
      listingType: 'rent',
      description: 'Trendy cafe space in vibrant All Saints Road.',
      features: ['Cafe Space', 'Trendy Area', 'Vibrant Location', 'Food Service'],
      images: ['/api/placeholder/400/300'],
      epcRating: 'C',
      councilTaxBand: 'A',
      tenure: 'leasehold',
      dateAdded: '2025-01-14',
      agent: {
        name: 'Aslam Noor',
        phone: '+44 20 7123 4567',
        email: 'aslam@johnbarclay.co.uk'
      },
      location: {
        latitude: 51.5189,
        longitude: -0.2098
      }
    },

    // W10 Commercial Properties (5)
    {
      id: 'commercial-8',
      address: '123 Harrow Road',
      postcode: 'W10 4RH',
      price: 4200,
      bedrooms: 0,
      bathrooms: 1,
      propertyType: 'flat',
      listingType: 'rent',
      description: 'Versatile commercial space suitable for various business needs.',
      features: ['Versatile Space', 'Business Use', 'Ground Floor', 'Parking Available'],
      images: ['/api/placeholder/400/300'],
      epcRating: 'C',
      councilTaxBand: 'A',
      tenure: 'leasehold',
      dateAdded: '2025-01-09',
      agent: {
        name: 'Iury Campos',
        phone: '+44 20 7123 4568',
        email: 'iury@johnbarclay.co.uk'
      },
      location: {
        latitude: 51.5286,
        longitude: -0.2198
      }
    },
    {
      id: 'commercial-9',
      address: '67 Kensal Road',
      postcode: 'W10 5BN',
      price: 3500,
      bedrooms: 0,
      bathrooms: 1,
      propertyType: 'studio',
      listingType: 'rent',
      description: 'Industrial-style workspace perfect for creative businesses.',
      features: ['Industrial Style', 'Creative Space', 'High Ceilings', 'Workspace'],
      images: ['/api/placeholder/400/300', '/api/placeholder/400/300'],
      epcRating: 'D',
      councilTaxBand: 'A',
      tenure: 'leasehold',
      dateAdded: '2025-01-11',
      agent: {
        name: 'Mayssaa Sabrah',
        phone: '+44 20 7123 4569',
        email: 'mayssaa@johnbarclay.co.uk'
      },
      location: {
        latitude: 51.5312,
        longitude: -0.2234
      }
    },
    {
      id: 'commercial-10',
      address: '189 Ladbroke Grove',
      postcode: 'W10 6HB',
      price: 6800,
      bedrooms: 0,
      bathrooms: 2,
      propertyType: 'flat',
      listingType: 'rent',
      description: 'Modern showroom space with large windows and excellent visibility.',
      features: ['Showroom', 'Large Windows', 'Excellent Visibility', 'Modern'],
      images: ['/api/placeholder/400/300'],
      epcRating: 'B',
      councilTaxBand: 'A',
      tenure: 'leasehold',
      dateAdded: '2025-01-06',
      agent: {
        name: 'Aslam Noor',
        phone: '+44 20 7123 4567',
        email: 'aslam@johnbarclay.co.uk'
      },
      location: {
        latitude: 51.5201,
        longitude: -0.2156
      }
    },
    {
      id: 'commercial-11',
      address: '78 Bramley Road',
      postcode: 'W10 6SZ',
      price: 2900,
      bedrooms: 0,
      bathrooms: 1,
      propertyType: 'studio',
      listingType: 'rent',
      description: 'Compact office space ideal for startups and small businesses.',
      features: ['Compact Office', 'Startup Friendly', 'Small Business', 'Affordable'],
      images: ['/api/placeholder/400/300'],
      epcRating: 'C',
      councilTaxBand: 'A',
      tenure: 'leasehold',
      dateAdded: '2025-01-13',
      agent: {
        name: 'Iury Campos',
        phone: '+44 20 7123 4568',
        email: 'iury@johnbarclay.co.uk'
      },
      location: {
        latitude: 51.5223,
        longitude: -0.2187
      }
    },
    {
      id: 'commercial-12',
      address: '234 Golborne Road',
      postcode: 'W10 5NL',
      price: 5500,
      bedrooms: 0,
      bathrooms: 1,
      propertyType: 'flat',
      listingType: 'rent',
      description: 'Retail unit in bustling Golborne Road market area.',
      features: ['Retail Unit', 'Market Area', 'High Footfall', 'Golborne Road'],
      images: ['/api/placeholder/400/300', '/api/placeholder/400/300'],
      epcRating: 'C',
      councilTaxBand: 'A',
      tenure: 'leasehold',
      dateAdded: '2025-01-15',
      agent: {
        name: 'Mayssaa Sabrah',
        phone: '+44 20 7123 4569',
        email: 'mayssaa@johnbarclay.co.uk'
      },
      location: {
        latitude: 51.5298,
        longitude: -0.2198
      }
    },

    // W9 Commercial Properties (3)
    {
      id: 'commercial-13',
      address: '123 Warwick Avenue',
      postcode: 'W9 2PT',
      price: 9500,
      bedrooms: 0,
      bathrooms: 2,
      propertyType: 'flat',
      listingType: 'rent',
      description: 'Premium office space near Little Venice with canal views.',
      features: ['Premium Office', 'Canal Views', 'Little Venice', 'Executive'],
      images: ['/api/placeholder/400/300', '/api/placeholder/400/300'],
      epcRating: 'A',
      councilTaxBand: 'A',
      tenure: 'leasehold',
      dateAdded: '2025-01-04',
      agent: {
        name: 'Aslam Noor',
        phone: '+44 20 7123 4567',
        email: 'aslam@johnbarclay.co.uk'
      },
      location: {
        latitude: 51.5234,
        longitude: -0.1834
      }
    },
    {
      id: 'commercial-14',
      address: '67 Formosa Street',
      postcode: 'W9 2JS',
      price: 7200,
      bedrooms: 0,
      bathrooms: 1,
      propertyType: 'maisonette',
      listingType: 'rent',
      description: 'Unique commercial maisonette suitable for professional services.',
      features: ['Commercial Maisonette', 'Professional Services', 'Unique Space', 'Two Levels'],
      images: ['/api/placeholder/400/300'],
      epcRating: 'B',
      councilTaxBand: 'A',
      tenure: 'leasehold',
      dateAdded: '2025-01-02',
      agent: {
        name: 'Iury Campos',
        phone: '+44 20 7123 4568',
        email: 'iury@johnbarclay.co.uk'
      },
      location: {
        latitude: 51.5218,
        longitude: -0.1856
      }
    },
    {
      id: 'commercial-15',
      address: '189 Clifton Gardens',
      postcode: 'W9 1DT',
      price: 4800,
      bedrooms: 0,
      bathrooms: 1,
      propertyType: 'studio',
      listingType: 'rent',
      description: 'Boutique therapy and wellness space with peaceful canal setting.',
      features: ['Therapy Space', 'Wellness Centre', 'Peaceful Setting', 'Canal Views'],
      images: ['/api/placeholder/400/300'],
      epcRating: 'B',
      councilTaxBand: 'A',
      tenure: 'leasehold',
      dateAdded: '2025-01-16',
      agent: {
        name: 'Mayssaa Sabrah',
        phone: '+44 20 7123 4569',
        email: 'mayssaa@johnbarclay.co.uk'
      },
      location: {
        latitude: 51.5201,
        longitude: -0.1823
      }
    },

    // NW6 Commercial Properties (3)
    {
      id: 'commercial-16',
      address: '123 Kilburn High Road',
      postcode: 'NW6 2DB',
      price: 3800,
      bedrooms: 0,
      bathrooms: 1,
      propertyType: 'flat',
      listingType: 'rent',
      description: 'High street retail space with excellent footfall and transport links.',
      features: ['High Street', 'Retail Space', 'High Footfall', 'Transport Links'],
      images: ['/api/placeholder/400/300'],
      epcRating: 'C',
      councilTaxBand: 'A',
      tenure: 'leasehold',
      dateAdded: '2025-01-01',
      agent: {
        name: 'Aslam Noor',
        phone: '+44 20 7123 4567',
        email: 'aslam@johnbarclay.co.uk'
      },
      location: {
        latitude: 51.5467,
        longitude: -0.1947
      }
    },
    {
      id: 'commercial-17',
      address: '67 West End Lane',
      postcode: 'NW6 1LX',
      price: 5200,
      bedrooms: 0,
      bathrooms: 2,
      propertyType: 'flat',
      listingType: 'rent',
      description: 'Professional office space with meeting facilities and parking.',
      features: ['Professional Office', 'Meeting Facilities', 'Parking', 'Modern'],
      images: ['/api/placeholder/400/300', '/api/placeholder/400/300'],
      epcRating: 'B',
      councilTaxBand: 'A',
      tenure: 'leasehold',
      dateAdded: '2024-12-28',
      agent: {
        name: 'Iury Campos',
        phone: '+44 20 7123 4568',
        email: 'iury@johnbarclay.co.uk'
      },
      location: {
        latitude: 51.5523,
        longitude: -0.1934
      }
    },
    {
      id: 'commercial-18',
      address: '189 Fortune Green Road',
      postcode: 'NW6 1UN',
      price: 2800,
      bedrooms: 0,
      bathrooms: 1,
      propertyType: 'studio',
      listingType: 'rent',
      description: 'Creative workspace with natural light and flexible layout.',
      features: ['Creative Workspace', 'Natural Light', 'Flexible Layout', 'Studio'],
      images: ['/api/placeholder/400/300'],
      epcRating: 'C',
      councilTaxBand: 'A',
      tenure: 'leasehold',
      dateAdded: '2024-12-30',
      agent: {
        name: 'Mayssaa Sabrah',
        phone: '+44 20 7123 4569',
        email: 'mayssaa@johnbarclay.co.uk'
      },
      location: {
        latitude: 51.5589,
        longitude: -0.1923
      }
    },

    // NW10 Commercial Properties (2)
    {
      id: 'commercial-19',
      address: '78 High Street',
      postcode: 'NW10 4TR',
      price: 2400,
      bedrooms: 0,
      bathrooms: 1,
      propertyType: 'flat',
      listingType: 'rent',
      description: 'Affordable commercial unit perfect for local businesses.',
      features: ['Affordable', 'Local Business', 'Commercial Unit', 'High Street'],
      images: ['/api/placeholder/400/300'],
      epcRating: 'C',
      councilTaxBand: 'A',
      tenure: 'leasehold',
      dateAdded: '2024-12-27',
      agent: {
        name: 'Aslam Noor',
        phone: '+44 20 7123 4567',
        email: 'aslam@johnbarclay.co.uk'
      },
      location: {
        latitude: 51.5334,
        longitude: -0.2456
      }
    },
    {
      id: 'commercial-20',
      address: '145 Harlesden Road',
      postcode: 'NW10 3RN',
      price: 3200,
      bedrooms: 0,
      bathrooms: 1,
      propertyType: 'flat',
      listingType: 'rent',
      description: 'Workshop and storage space with loading access.',
      features: ['Workshop', 'Storage Space', 'Loading Access', 'Industrial'],
      images: ['/api/placeholder/400/300', '/api/placeholder/400/300'],
      epcRating: 'D',
      councilTaxBand: 'A',
      tenure: 'leasehold',
      dateAdded: '2024-12-26',
      agent: {
        name: 'Iury Campos',
        phone: '+44 20 7123 4568',
        email: 'iury@johnbarclay.co.uk'
      },
      location: {
        latitude: 51.5367,
        longitude: -0.2489
      }
    }
  ];
};