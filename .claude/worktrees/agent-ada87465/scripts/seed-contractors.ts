import 'dotenv/config';
import { db } from '../server/db';
import { contractors } from '../shared/schema';

const contractorData = [
  {
    companyName: 'Gansukh',
    contactName: 'Gansukh',
    email: 'gansukh@contractor.com',
    phone: '+447883580505',
    specializations: ['plumbing', 'gas', 'heating'],
    availableEmergency: false,
    responseTime: '24 hours',
    preferredContractor: false,
    isActive: true
  },
  {
    companyName: 'Mustapha',
    contactName: 'Mustapha',
    email: 'mustapha@contractor.com',
    phone: '+447912041796',
    specializations: ['plumbing', 'gas', 'heating'],
    availableEmergency: true,
    responseTime: '4 hours',
    preferredContractor: true,
    isActive: true
  },
  {
    companyName: "Ahmed's Plumber",
    contactName: 'Ahmed',
    email: 'ahmed@contractor.com',
    phone: '+447925287198',
    specializations: ['plumbing', 'gas', 'heating'],
    availableEmergency: false,
    responseTime: '24 hours',
    preferredContractor: false,
    isActive: true
  },
  {
    companyName: 'Sarder (Oasis)',
    contactName: 'Sarder',
    email: 'sarder@contractor.com',
    phone: '+447717122229',
    specializations: ['removals'],
    availableEmergency: false,
    responseTime: '48 hours',
    preferredContractor: false,
    isActive: true
  },
  {
    companyName: 'Elias Appliances',
    contactName: 'Elias',
    email: 'elias@contractor.com',
    phone: '+447000000001',
    specializations: ['appliances'],
    availableEmergency: false,
    responseTime: '24 hours',
    preferredContractor: false,
    isActive: true
  },
  {
    companyName: 'George Electrical',
    contactName: 'George',
    email: 'george@contractor.com',
    phone: '+447000000002',
    specializations: ['electrical'],
    availableEmergency: true,
    responseTime: '4 hours',
    preferredContractor: true,
    isActive: true
  },
  {
    companyName: 'Rilind Electrical',
    contactName: 'Rilind',
    email: 'rilind@contractor.com',
    phone: '+447000000003',
    specializations: ['electrical'],
    availableEmergency: false,
    responseTime: '24 hours',
    preferredContractor: false,
    isActive: true
  },
  {
    companyName: 'Quick Pest Control',
    contactName: 'Quick Pest',
    email: 'quickpest@contractor.com',
    phone: '+447000000004',
    specializations: ['pest_control'],
    availableEmergency: true,
    responseTime: '4 hours',
    preferredContractor: true,
    isActive: true
  },
  {
    companyName: 'Nadel Maintenance',
    contactName: 'Nadel',
    email: 'nadel@contractor.com',
    phone: '+447000000005',
    specializations: ['general', 'handyman', 'roofing'],
    availableEmergency: false,
    responseTime: '24 hours',
    preferredContractor: false,
    isActive: true
  },
  {
    companyName: 'Assis Handyman',
    contactName: 'Assis',
    email: 'assis@contractor.com',
    phone: '+447000000006',
    specializations: ['general', 'handyman'],
    availableEmergency: false,
    responseTime: '24 hours',
    preferredContractor: false,
    isActive: true
  },
  {
    companyName: 'Ericson Services',
    contactName: 'Ericson',
    email: 'ericson@contractor.com',
    phone: '+447000000007',
    specializations: ['general', 'handyman'],
    availableEmergency: false,
    responseTime: '24 hours',
    preferredContractor: false,
    isActive: true
  },
  {
    companyName: 'Waldorf Carpet - Said',
    contactName: 'Said',
    email: 'said@waldorfcarpet.com',
    phone: '+447000000008',
    specializations: ['cleaning', 'carpet'],
    availableEmergency: false,
    responseTime: '48 hours',
    preferredContractor: false,
    isActive: true
  },
  {
    companyName: 'Waldorf Carpet - Fatima',
    contactName: 'Fatima',
    email: 'fatima@waldorfcarpet.com',
    phone: '+447000000009',
    specializations: ['cleaning', 'carpet'],
    availableEmergency: false,
    responseTime: '48 hours',
    preferredContractor: false,
    isActive: true
  },
  {
    companyName: 'Tayz Cleaning',
    contactName: 'Tayz',
    email: 'tayz@contractor.com',
    phone: '+447000000010',
    specializations: ['cleaning'],
    availableEmergency: false,
    responseTime: '24 hours',
    preferredContractor: false,
    isActive: true
  }
];

async function seedContractors() {
  console.log('Seeding contractors...');

  try {
    // Check if contractors already exist
    const existing = await db.select().from(contractors);
    if (existing.length > 0) {
      console.log(`Found ${existing.length} existing contractors. Skipping seed.`);
      console.log('To re-seed, delete existing contractors first.');
      process.exit(0);
    }

    // Insert all contractors
    for (const contractor of contractorData) {
      await db.insert(contractors).values(contractor);
      console.log(`Added: ${contractor.companyName}`);
    }

    console.log(`\nSuccessfully seeded ${contractorData.length} contractors.`);
    process.exit(0);
  } catch (error) {
    console.error('Error seeding contractors:', error);
    process.exit(1);
  }
}

seedContractors();
