import dotenv from 'dotenv';
dotenv.config();

import { db } from '../server/db.js';
import { londonAreas, properties } from '../shared/schema.js';

async function seedDatabase() {
  console.log('🌱 Starting database seeding...');

  try {
    // First, clear existing data
    await db.delete(properties);
    await db.delete(londonAreas);
    console.log('✅ Cleared existing data');

    // Insert London Areas
    const areasData = [
      {
        name: "Bayswater",
        postcode: "W2",
        description: "Elegant Victorian garden squares with excellent transport links and international dining scene.",
        investmentPerspective: "Strong rental demand from young professionals. Hyde Park proximity adds premium. Crossrail impact positive.",
        marketAnalysis: "Properties range from £800k studio flats to £5M+ houses. Rental yields 3-4%. High international buyer interest.",
        positiveAspects: ["Hyde Park proximity", "Excellent transport", "International community", "Period architecture", "Strong rental market"],
        negativeAspects: ["Tourist crowds", "Limited parking", "High service charges", "Short-term rental competition"],
        averagePrice: 1250000,
        priceGrowthPercentage: "4.2",
        nearestTubeStation: "Bayswater, Paddington"
      },
      {
        name: "Maida Vale",
        postcode: "W9",
        description: "Tree-lined streets with white stucco mansion blocks and canal-side living. Popular with media professionals.",
        investmentPerspective: "Consistent growth area with strong fundamentals. Little Venice location premium. Good long-term prospects.",
        marketAnalysis: "Mix of mansion flats and period houses. Average £900k-£2.5M. Stable rental market with 3.5% yields.",
        positiveAspects: ["Little Venice canals", "Period mansion blocks", "Village feel", "Good schools nearby", "Stable market"],
        negativeAspects: ["Limited new development", "Flood risk areas", "Expensive parking", "Council tax band variations"],
        averagePrice: 1100000,
        priceGrowthPercentage: "3.8",
        nearestTubeStation: "Maida Vale, Warwick Avenue"
      },
      {
        name: "St Johns Wood",
        postcode: "NW8",
        description: "Prestigious residential area with cricket ground proximity, excellent schools and embassy quarter location.",
        investmentPerspective: "Prime London location with strong capital growth. International school proximity drives demand.",
        marketAnalysis: "Premium market £1.5M-£10M+. Strong international buyer base. Rental yields 2.5-3.5%.",
        positiveAspects: ["Lord's Cricket Ground", "American School nearby", "Embassy quarter", "Low crime", "Excellent transport"],
        negativeAspects: ["Very expensive", "Limited starter homes", "Parking restrictions", "High council tax"],
        averagePrice: 2250000,
        priceGrowthPercentage: "5.1",
        nearestTubeStation: "St John's Wood, Baker Street"
      },
      {
        name: "Queens Park",
        postcode: "NW6",
        description: "Trendy area with young families, excellent local schools, independent shops and strong community feel.",
        investmentPerspective: "Rapid gentrification with strong growth potential. Family market driving demand. Good value vs central areas.",
        marketAnalysis: "Victorian terraces £800k-£2M. Strong rental demand from families. Yields 3.5-4.5%.",
        positiveAspects: ["Excellent schools", "Family-friendly", "Independent shops", "Community feel", "Growth potential"],
        negativeAspects: ["Gentrification displacement", "Limited commercial area", "Parking pressure", "School catchment competition"],
        averagePrice: 950000,
        priceGrowthPercentage: "6.2",
        nearestTubeStation: "Queen's Park, Kilburn Park"
      },
      {
        name: "Kilburn",
        postcode: "NW6",
        description: "Diverse multicultural area with excellent transport links, developing food scene and good value properties.",
        investmentPerspective: "Emerging area with regeneration potential. Crossrail will boost accessibility. Good entry-level pricing.",
        marketAnalysis: "Mixed housing stock £500k-£1.5M. Strong rental yields 4-5%. First-time buyer market active.",
        positiveAspects: ["Affordable by London standards", "Excellent transport", "Cultural diversity", "Developing area", "High rental yields"],
        negativeAspects: ["Some rough areas", "Limited green space", "Traffic congestion", "Gentrification concerns"],
        averagePrice: 650000,
        priceGrowthPercentage: "4.8",
        nearestTubeStation: "Kilburn, Kilburn Park"
      },
      {
        name: "Kensal Green",
        postcode: "NW10",
        description: "Up-and-coming area with canal-side developments, creative community and improving transport links.",
        investmentPerspective: "Regeneration hotspot with significant upside potential. HS2 and Crossrail accessibility improvements.",
        marketAnalysis: "Rapid price growth £600k-£1.8M. New developments driving market. Yields 4-6%.",
        positiveAspects: ["Regeneration area", "Creative community", "Transport improvements", "Canal location", "Growth potential"],
        negativeAspects: ["Construction disruption", "Limited amenities", "Industrial heritage", "Uneven development"],
        averagePrice: 750000,
        priceGrowthPercentage: "7.1",
        nearestTubeStation: "Kensal Green, Kensal Rise"
      },
      {
        name: "Ladbroke Grove",
        postcode: "W10",
        description: "Vibrant multicultural area famous for Notting Hill Carnival, antique markets and diverse dining scene.",
        investmentPerspective: "Established area with tourist appeal. Portobello Market proximity adds character premium.",
        marketAnalysis: "Victorian terraces and mansion flats £700k-£3M. Tourist rental potential. Yields 3.5-4.5%.",
        positiveAspects: ["Portobello Market", "Cultural scene", "Transport links", "Period properties", "Tourist appeal"],
        negativeAspects: ["Carnival disruption", "Tourist crowds", "Parking issues", "Social housing mix"],
        averagePrice: 880000,
        priceGrowthPercentage: "3.9",
        nearestTubeStation: "Ladbroke Grove, Westbourne Park"
      }
    ];

    const insertedAreas = await db.insert(londonAreas).values(areasData).returning();
    console.log(`✅ Inserted ${insertedAreas.length} London areas`);

    // Create a map of area names to IDs for property insertion
    const areaMap = insertedAreas.reduce((acc, area) => {
      acc[area.name] = area.id;
      return acc;
    }, {} as Record<string, number>);

    // Generate Properties Data
    const propertiesData = [
      // HOUSES (5)
      {
        listingType: "sale",
        status: "active",
        title: "Stunning 4-Bedroom Victorian Terrace in Bayswater",
        description: "Beautifully restored Victorian terrace house offering elegant family living across four floors. Features include period details, modern kitchen, landscaped garden, and off-street parking. Close to Hyde Park and excellent schools.",
        price: 285000000, // £2.85M in pence
        priceQualifier: "guide_price",
        propertyType: "house",
        bedrooms: 4,
        bathrooms: 3,
        receptions: 2,
        squareFootage: 2100,
        addressLine1: "42 Gloucester Terrace",
        addressLine2: "",
        postcode: "W2 3HB",
        areaId: areaMap["Bayswater"],
        tenure: "freehold",
        councilTaxBand: "G",
        energyRating: "C",
        yearBuilt: 1885,
        features: ["period_features", "garden", "parking", "high_ceilings", "modern_kitchen", "wooden_floors"],
        amenities: ["Hyde Park 2 mins", "Paddington Station 5 mins", "Local shops", "Restaurants"],
        images: ["/images/house1-1.jpg", "/images/house1-2.jpg", "/images/house1-3.jpg"],
        floorPlan: "/images/house1-floorplan.jpg",
        viewingArrangements: "by_appointment",
        agentContact: "John Barclay - 020 7946 0958"
      },
      {
        listingType: "sale",
        status: "active",
        title: "Elegant 5-Bedroom Family Home in St Johns Wood",
        description: "Magnificent family residence on a prestigious tree-lined street. This beautifully appointed house offers spacious accommodation, private garden, garage, and is perfectly positioned near Lord's Cricket Ground and excellent schools.",
        price: 425000000, // £4.25M in pence
        priceQualifier: "offers_over",
        propertyType: "house",
        bedrooms: 5,
        bathrooms: 4,
        receptions: 3,
        squareFootage: 3200,
        addressLine1: "15 Grove End Road",
        addressLine2: "",
        postcode: "NW8 9LL",
        areaId: areaMap["St Johns Wood"],
        tenure: "freehold",
        councilTaxBand: "H",
        energyRating: "D",
        yearBuilt: 1920,
        features: ["garden", "parking", "period_features", "high_ceilings", "modern_kitchen", "ensuite_bathroom"],
        amenities: ["Lord's Cricket Ground", "American School nearby", "Regent's Park", "St John's Wood High Street"],
        images: ["/images/house2-1.jpg", "/images/house2-2.jpg", "/images/house2-3.jpg"],
        floorPlan: "/images/house2-floorplan.jpg",
        viewingArrangements: "by_appointment",
        agentContact: "John Barclay - 020 7946 0958"
      },
      {
        listingType: "sale",
        status: "active",
        title: "Charming 3-Bedroom Victorian House in Queens Park",
        description: "Beautifully presented Victorian terraced house in the heart of Queens Park. Retains original character with modern updates throughout. South-facing garden, period features, and close to excellent local schools and transport.",
        price: 135000000, // £1.35M in pence
        priceQualifier: "guide_price",
        propertyType: "house",
        bedrooms: 3,
        bathrooms: 2,
        receptions: 2,
        squareFootage: 1450,
        addressLine1: "28 Kempe Road",
        addressLine2: "",
        postcode: "NW6 6SB",
        areaId: areaMap["Queens Park"],
        tenure: "freehold",
        councilTaxBand: "E",
        energyRating: "C",
        yearBuilt: 1895,
        features: ["period_features", "garden", "wooden_floors", "high_ceilings", "recently_renovated"],
        amenities: ["Queens Park School", "Local shops", "Salusbury Road", "Queens Park"],
        images: ["/images/house3-1.jpg", "/images/house3-2.jpg", "/images/house3-3.jpg"],
        floorPlan: "/images/house3-floorplan.jpg",
        viewingArrangements: "by_appointment",
        agentContact: "John Barclay - 020 7946 0958"
      },
      {
        listingType: "rental",
        status: "active",
        title: "Beautiful 4-Bedroom House Available for Rent in Maida Vale",
        description: "Stunning recently refurbished family house in sought-after Maida Vale location. Four bedrooms, modern kitchen, private garden, and parking. Close to Little Venice and excellent transport connections.",
        price: 650000, // £6,500 per month in pence
        priceQualifier: null,
        propertyType: "house",
        bedrooms: 4,
        bathrooms: 3,
        receptions: 2,
        squareFootage: 1850,
        addressLine1: "67 Clifton Gardens",
        addressLine2: "",
        postcode: "W9 1DT",
        areaId: areaMap["Maida Vale"],
        tenure: "leasehold",
        councilTaxBand: "F",
        energyRating: "B",
        yearBuilt: 1910,
        rentPeriod: "per_month",
        furnished: "unfurnished",
        availableFrom: new Date('2024-02-01'),
        minimumTenancy: 12,
        deposit: 1300000, // £13,000 in pence
        features: ["garden", "parking", "recently_renovated", "modern_kitchen", "period_features"],
        amenities: ["Little Venice", "Warwick Avenue Station", "Canal walks", "Local amenities"],
        images: ["/images/house4-1.jpg", "/images/house4-2.jpg", "/images/house4-3.jpg"],
        floorPlan: "/images/house4-floorplan.jpg",
        viewingArrangements: "by_appointment",
        agentContact: "John Barclay - 020 7946 0958"
      },
      {
        listingType: "sale",
        status: "under_offer",
        title: "Period 3-Bedroom House with Development Potential in Kensal Green",
        description: "Characterful Victorian terrace house requiring modernisation. Excellent opportunity for renovation with scope to extend (STPP). Large garden, period features intact, and in up-and-coming Kensal Green location.",
        price: 89500000, // £895K in pence
        priceQualifier: "guide_price",
        propertyType: "house",
        bedrooms: 3,
        bathrooms: 1,
        receptions: 2,
        squareFootage: 1200,
        addressLine1: "124 Chevening Road",
        addressLine2: "",
        postcode: "NW10 3LR",
        areaId: areaMap["Kensal Green"],
        tenure: "freehold",
        councilTaxBand: "D",
        energyRating: "E",
        yearBuilt: 1890,
        features: ["period_features", "garden", "high_ceilings", "original_features"],
        amenities: ["Kensal Green Station", "Local shops", "Canal nearby", "Regeneration area"],
        images: ["/images/house5-1.jpg", "/images/house5-2.jpg", "/images/house5-3.jpg"],
        floorPlan: "/images/house5-floorplan.jpg",
        viewingArrangements: "by_appointment",
        agentContact: "John Barclay - 020 7946 0958"
      },

      // FLATS (5)
      {
        listingType: "sale",
        status: "active",
        title: "Luxury 2-Bedroom Apartment with Balcony in Bayswater",
        description: "Contemporary apartment in prestigious portered building. Two double bedrooms, modern kitchen, reception room, balcony overlooking garden square. Lift access, concierge, and prime Hyde Park location.",
        price: 112500000, // £1.125M in pence
        priceQualifier: "guide_price",
        propertyType: "flat",
        bedrooms: 2,
        bathrooms: 2,
        receptions: 1,
        squareFootage: 900,
        addressLine1: "Flat 15, Lancaster Gate Mansions",
        addressLine2: "Lancaster Gate",
        postcode: "W2 3LN",
        areaId: areaMap["Bayswater"],
        tenure: "leasehold",
        councilTaxBand: "F",
        energyRating: "B",
        yearBuilt: 2018,
        features: ["balcony", "lift", "concierge", "modern_kitchen", "ensuite_bathroom", "air_conditioning"],
        amenities: ["Hyde Park opposite", "Lancaster Gate Station", "Restaurants", "Shopping"],
        images: ["/images/flat1-1.jpg", "/images/flat1-2.jpg", "/images/flat1-3.jpg"],
        floorPlan: "/images/flat1-floorplan.jpg",
        viewingArrangements: "by_appointment",
        agentContact: "John Barclay - 020 7946 0958"
      },
      {
        listingType: "rental",
        status: "active",
        title: "Spacious 1-Bedroom Flat for Rent in Kilburn",
        description: "Well-presented one-bedroom apartment in converted Victorian house. Open-plan living, modern kitchen, good storage, and excellent transport links. Perfect for young professional.",
        price: 175000, // £1,750 per month in pence
        priceQualifier: null,
        propertyType: "flat",
        bedrooms: 1,
        bathrooms: 1,
        receptions: 1,
        squareFootage: 550,
        addressLine1: "Flat 3, 89 Kilburn High Road",
        addressLine2: "",
        postcode: "NW6 6JE",
        areaId: areaMap["Kilburn"],
        tenure: "leasehold",
        councilTaxBand: "C",
        energyRating: "C",
        yearBuilt: 1890,
        rentPeriod: "per_month",
        furnished: "part_furnished",
        availableFrom: new Date('2024-01-15'),
        minimumTenancy: 12,
        deposit: 350000, // £3,500 in pence
        features: ["modern_kitchen", "recently_renovated", "good_storage"],
        amenities: ["Kilburn Station", "High Road shops", "Buses to central London", "Local amenities"],
        images: ["/images/flat2-1.jpg", "/images/flat2-2.jpg", "/images/flat2-3.jpg"],
        floorPlan: "/images/flat2-floorplan.jpg",
        viewingArrangements: "by_appointment",
        agentContact: "John Barclay - 020 7946 0958"
      },
      {
        listingType: "sale",
        status: "active",
        title: "Elegant 3-Bedroom Mansion Flat in Maida Vale",
        description: "Beautiful period conversion in white stucco mansion block. Three bedrooms, period features, high ceilings, communal gardens. Located on tree-lined avenue close to Little Venice canals.",
        price: 145000000, // £1.45M in pence
        priceQualifier: "offers_over",
        propertyType: "flat",
        bedrooms: 3,
        bathrooms: 2,
        receptions: 1,
        squareFootage: 1200,
        addressLine1: "Flat 2, 45 Maida Avenue",
        addressLine2: "",
        postcode: "W2 1TH",
        areaId: areaMap["Maida Vale"],
        tenure: "leasehold",
        councilTaxBand: "E",
        energyRating: "D",
        yearBuilt: 1900,
        features: ["period_features", "high_ceilings", "communal_gardens", "wooden_floors"],
        amenities: ["Little Venice", "Maida Vale Station", "Canal walks", "Local restaurants"],
        images: ["/images/flat3-1.jpg", "/images/flat3-2.jpg", "/images/flat3-3.jpg"],
        floorPlan: "/images/flat3-floorplan.jpg",
        viewingArrangements: "by_appointment",
        agentContact: "John Barclay - 020 7946 0958"
      },
      {
        listingType: "rental",
        status: "active",
        title: "Modern 2-Bedroom Flat in Queens Park",
        description: "Contemporary apartment in purpose-built development. Two double bedrooms, open-plan living, private balcony, parking space. Close to Queens Park and excellent local schools.",
        price: 285000, // £2,850 per month in pence
        priceQualifier: null,
        propertyType: "flat",
        bedrooms: 2,
        bathrooms: 2,
        receptions: 1,
        squareFootage: 750,
        addressLine1: "Apartment 8, The Quadrant",
        addressLine2: "Salusbury Road",
        postcode: "NW6 6RG",
        areaId: areaMap["Queens Park"],
        tenure: "leasehold",
        councilTaxBand: "D",
        energyRating: "B",
        yearBuilt: 2015,
        rentPeriod: "per_month",
        furnished: "unfurnished",
        availableFrom: new Date('2024-03-01'),
        minimumTenancy: 12,
        deposit: 570000, // £5,700 in pence
        features: ["balcony", "parking", "modern_kitchen", "ensuite_bathroom", "lift"],
        amenities: ["Queens Park Station", "Local schools", "Salusbury Road shops", "Brondesbury Park"],
        images: ["/images/flat4-1.jpg", "/images/flat4-2.jpg", "/images/flat4-3.jpg"],
        floorPlan: "/images/flat4-floorplan.jpg",
        viewingArrangements: "by_appointment",
        agentContact: "John Barclay - 020 7946 0958"
      },
      {
        listingType: "sale",
        status: "active",
        title: "Converted 1-Bedroom Loft Apartment in Ladbroke Grove",
        description: "Unique loft-style apartment in converted warehouse. Industrial features, exposed brick, mezzanine bedroom, roof terrace access. Close to Portobello Market and vibrant local scene.",
        price: 78500000, // £785K in pence
        priceQualifier: "guide_price",
        propertyType: "flat",
        bedrooms: 1,
        bathrooms: 1,
        receptions: 1,
        squareFootage: 650,
        addressLine1: "Unit 12, The Warehouse",
        addressLine2: "Golborne Road",
        postcode: "W10 5NW",
        areaId: areaMap["Ladbroke Grove"],
        tenure: "leasehold",
        councilTaxBand: "D",
        energyRating: "C",
        yearBuilt: 2010,
        features: ["roof_terrace", "exposed_brick", "high_ceilings", "unique_character", "mezzanine"],
        amenities: ["Portobello Market", "Ladbroke Grove Station", "Local pubs", "Golborne Road"],
        images: ["/images/flat5-1.jpg", "/images/flat5-2.jpg", "/images/flat5-3.jpg"],
        floorPlan: "/images/flat5-floorplan.jpg",
        viewingArrangements: "by_appointment",
        agentContact: "John Barclay - 020 7946 0958"
      },

      // COMMERCIAL PROPERTIES (5)
      {
        listingType: "sale",
        status: "active",
        title: "Prime Retail Unit on Kilburn High Road",
        description: "Prominent retail premises with excellent footfall on busy Kilburn High Road. Ground floor retail with storage basement. Suitable for various retail uses. Strong rental potential in developing area.",
        price: 89500000, // £895K in pence
        priceQualifier: "guide_price",
        propertyType: "commercial",
        bedrooms: 0,
        bathrooms: 2,
        receptions: 0,
        squareFootage: 1200,
        addressLine1: "156-158 Kilburn High Road",
        addressLine2: "",
        postcode: "NW6 4JD",
        areaId: areaMap["Kilburn"],
        tenure: "freehold",
        councilTaxBand: null,
        energyRating: "C",
        yearBuilt: 1920,
        features: ["high_street_location", "storage_basement", "prominent_frontage", "excellent_footfall"],
        amenities: ["Kilburn Station", "Bus routes", "High street location", "Parking nearby"],
        images: ["/images/commercial1-1.jpg", "/images/commercial1-2.jpg", "/images/commercial1-3.jpg"],
        floorPlan: "/images/commercial1-floorplan.jpg",
        viewingArrangements: "by_appointment",
        agentContact: "John Barclay - 020 7946 0958"
      },
      {
        listingType: "rental",
        status: "active",
        title: "Modern Office Space in Bayswater",
        description: "Contemporary office accommodation in prestigious Bayswater location. Open-plan layout, modern facilities, excellent natural light. Perfect for creative or professional services business.",
        price: 850000, // £8,500 per month in pence
        priceQualifier: null,
        propertyType: "commercial",
        bedrooms: 0,
        bathrooms: 3,
        receptions: 0,
        squareFootage: 2500,
        addressLine1: "Second Floor, 88 Westbourne Grove",
        addressLine2: "",
        postcode: "W2 5RT",
        areaId: areaMap["Bayswater"],
        tenure: "leasehold",
        councilTaxBand: null,
        energyRating: "B",
        yearBuilt: 2005,
        rentPeriod: "per_month",
        furnished: "unfurnished",
        availableFrom: new Date('2024-02-15'),
        minimumTenancy: 36,
        deposit: 2550000, // £25,500 in pence
        features: ["air_conditioning", "lift", "modern_facilities", "excellent_natural_light"],
        amenities: ["Bayswater Station", "Westbourne Grove shops", "Hyde Park nearby", "Restaurants"],
        images: ["/images/commercial2-1.jpg", "/images/commercial2-2.jpg", "/images/commercial2-3.jpg"],
        floorPlan: "/images/commercial2-floorplan.jpg",
        viewingArrangements: "by_appointment",
        agentContact: "John Barclay - 020 7946 0958"
      },
      {
        listingType: "sale",
        status: "active",
        title: "Investment Opportunity - Restaurant Premises in Queens Park",
        description: "Established restaurant with full commercial kitchen, seating for 50, and external seating area. Long lease in place with good covenant tenant. Strong investment yield in popular dining location.",
        price: 165000000, // £1.65M in pence
        priceQualifier: "offers_invited",
        propertyType: "commercial",
        bedrooms: 0,
        bathrooms: 4,
        receptions: 0,
        squareFootage: 1800,
        addressLine1: "The Corner Restaurant",
        addressLine2: "2-4 Salusbury Road",
        postcode: "NW6 6NN",
        areaId: areaMap["Queens Park"],
        tenure: "leasehold",
        councilTaxBand: null,
        energyRating: "C",
        yearBuilt: 1910,
        features: ["commercial_kitchen", "external_seating", "established_business", "good_covenant_tenant"],
        amenities: ["Queens Park Station", "Salusbury Road shops", "Local community", "Evening economy"],
        images: ["/images/commercial3-1.jpg", "/images/commercial3-2.jpg", "/images/commercial3-3.jpg"],
        floorPlan: "/images/commercial3-floorplan.jpg",
        viewingArrangements: "by_appointment",
        agentContact: "John Barclay - 020 7946 0958"
      },
      {
        listingType: "rental",
        status: "active",
        title: "Creative Studio Space in Kensal Green",
        description: "Flexible studio space in converted industrial building. High ceilings, excellent natural light, loading access. Suitable for creative industries, storage, or light industrial use.",
        price: 425000, // £4,250 per month in pence
        priceQualifier: null,
        propertyType: "commercial",
        bedrooms: 0,
        bathrooms: 2,
        receptions: 0,
        squareFootage: 3000,
        addressLine1: "Unit 7, Kensal Works",
        addressLine2: "Ladbroke Grove",
        postcode: "NW10 6BJ",
        areaId: areaMap["Kensal Green"],
        tenure: "leasehold",
        councilTaxBand: null,
        energyRating: "D",
        yearBuilt: 1950,
        rentPeriod: "per_month",
        furnished: "unfurnished",
        availableFrom: new Date('2024-01-20'),
        minimumTenancy: 24,
        deposit: 1275000, // £12,750 in pence
        features: ["high_ceilings", "loading_access", "flexible_space", "industrial_character"],
        amenities: ["Kensal Green Station", "Creative community", "Canal nearby", "Good transport links"],
        images: ["/images/commercial4-1.jpg", "/images/commercial4-2.jpg", "/images/commercial4-3.jpg"],
        floorPlan: "/images/commercial4-floorplan.jpg",
        viewingArrangements: "by_appointment",
        agentContact: "John Barclay - 020 7946 0958"
      },
      {
        listingType: "sale",
        status: "active",
        title: "Medical Suite in St Johns Wood",
        description: "Purpose-built medical centre with 6 consulting rooms, reception area, and parking. Fully fitted with medical facilities. Prime location near medical district with excellent accessibility.",
        price: 285000000, // £2.85M in pence
        priceQualifier: "guide_price",
        propertyType: "commercial",
        bedrooms: 0,
        bathrooms: 6,
        receptions: 1,
        squareFootage: 2200,
        addressLine1: "The Medical Centre",
        addressLine2: "Wellington Road",
        postcode: "NW8 9SX",
        areaId: areaMap["St Johns Wood"],
        tenure: "freehold",
        councilTaxBand: null,
        energyRating: "B",
        yearBuilt: 1995,
        features: ["medical_facilities", "parking", "consulting_rooms", "disabled_access"],
        amenities: ["St John's Wood Station", "Medical district", "Excellent accessibility", "Professional area"],
        images: ["/images/commercial5-1.jpg", "/images/commercial5-2.jpg", "/images/commercial5-3.jpg"],
        floorPlan: "/images/commercial5-floorplan.jpg",
        viewingArrangements: "by_appointment",
        agentContact: "John Barclay - 020 7946 0958"
      }
    ];

    // Insert all properties
    const insertedProperties = await db.insert(properties).values(propertiesData).returning();
    console.log(`✅ Inserted ${insertedProperties.length} properties`);

    console.log('🎉 Database seeding completed successfully!');
    console.log(`📊 Summary:`);
    console.log(`   • ${insertedAreas.length} London areas`);
    console.log(`   • ${insertedProperties.length} properties (5 houses, 5 flats, 5 commercial)`);
    console.log(`   • Mix of sale and rental listings`);
    console.log(`   • Realistic pricing across all areas`);

  } catch (error) {
    console.error('❌ Error seeding database:', error);
    throw error;
  }
}

// Run the seeding if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  seedDatabase()
    .then(() => {
      console.log('✅ Database seeding completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Database seeding failed:', error);
      process.exit(1);
    });
}

export { seedDatabase };