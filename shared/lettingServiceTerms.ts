/**
 * John Barclay Estate & Management - Letting Service Terms & Conditions
 * These terms define the service packages, fees, and charges for landlord services
 */

export interface ServiceCharge {
  name: string;
  description: string;
  price: number | string;
  priceType: 'fixed' | 'percentage' | 'variable' | 'hourly';
  vatIncluded: boolean;
  notes?: string;
}

export interface ServicePackage {
  id: string;
  name: string;
  feePercentage: number;
  feeType: 'upfront' | 'deducted_monthly';
  description: string;
  services: string[];
}

export const lettingServicePackages: ServicePackage[] = [
  {
    id: 'let-only',
    name: 'Let Only',
    feePercentage: 10,
    feeType: 'upfront',
    description: '10% of annual rental income payable up front on receipt of first rental income',
    services: [
      'Property Appraisal',
      'Tenant reference checks, obtained and processed',
      'Taking pictures of the property and market it on various websites including on our own website',
      'Carrying out viewings',
      'Collecting first rental income and registering deposit to an approved deposit scheme where applicable *',
      'Contacting both landlord and the tenant for tenancy renewal at the end of tenancy period'
    ]
  },
  {
    id: 'let-and-collect',
    name: 'Let & Collect',
    feePercentage: 11,
    feeType: 'deducted_monthly',
    description: '11% deducted from rental income throughout the period of the tenancy',
    services: [
      'All the services we provide for Let Only',
      'Collecting the rent in our clients account and remitting to landlord\'s account along with monthly statements',
      'Registering the tenant\'s deposit to a government authorised scheme *',
      'Registering tenant\'s details for utility services and council tax where applicable'
    ]
  },
  {
    id: 'full-management',
    name: 'Full Management',
    feePercentage: 13,
    feeType: 'deducted_monthly',
    description: '13% deducted from rental income throughout the period of the tenancy. Your letting agent will handle everything for you - finding tenants, rent collection, maintenance, compliance and more.',
    services: [
      'All the services we provide for Let Only',
      'Collecting the rent in our clients account and remitting to landlord\'s account along with monthly statements',
      'Attending to payment of regular outgoings in relation to the property, namely ground rent, rates as applicable, service charges, insurance etc.',
      'Attending day-to-day matters of repairs and maintenance',
      'Carrying out inspections - periodic inspection of the property to ensure it is being cared for *',
      'Dealing with tenancy renewals *',
      'Keyholding facilities',
      'Arranging Inventory *',
      'Check-In and Check-Out *',
      'Organizing certificates (Gas, Electricity and EPC) as well as HMO application and Floor Plan if required *'
    ]
  }
];

export const additionalCharges: ServiceCharge[] = [
  {
    name: 'Tenancy Administration Fee',
    description: 'Preparation of tenancy agreement, due diligence, document signing, tenant pack (certificates, right to rent), deposit registration with DPS, council tax and utility registration',
    price: 250,
    priceType: 'fixed',
    vatIncluded: true
  },
  {
    name: 'Renewal Fee',
    description: 'Contact landlord and tenant near end of tenancy, prepare new documents if both parties agree to renew',
    price: 150,
    priceType: 'fixed',
    vatIncluded: true
  },
  {
    name: 'Inventory - Studio/1 Bed Unfurnished',
    description: 'Full inventory report with photo-filled booklet and descriptions. Copies provided to landlord and tenant.',
    price: 100,
    priceType: 'fixed',
    vatIncluded: true,
    notes: 'Price varies between £100-£400 depending on bedrooms and furnished/unfurnished status'
  },
  {
    name: 'Inventory - 2-3 Bed Unfurnished',
    description: 'Full inventory report with photo-filled booklet and descriptions',
    price: 175,
    priceType: 'fixed',
    vatIncluded: true
  },
  {
    name: 'Inventory - 2-3 Bed Furnished',
    description: 'Full inventory report with photo-filled booklet and descriptions',
    price: 250,
    priceType: 'fixed',
    vatIncluded: true
  },
  {
    name: 'Inventory - 4+ Bed Furnished',
    description: 'Full inventory report with photo-filled booklet and descriptions',
    price: 400,
    priceType: 'fixed',
    vatIncluded: true
  },
  {
    name: 'Property Inspections',
    description: 'Periodic inspection to ensure property is being cared for, identify issues early, maintain communication between landlord, tenant and agent',
    price: 150,
    priceType: 'fixed',
    vatIncluded: true
  },
  {
    name: 'Check In',
    description: 'Meet tenant at property, handover keys, take meter readings, provide additional property information',
    price: 140,
    priceType: 'fixed',
    vatIncluded: true
  },
  {
    name: 'Check Out',
    description: 'Full property inspection at end of tenancy, check-out inventory with discrepancies noted, meter readings, cleanliness verification, deposit release coordination',
    price: 140,
    priceType: 'fixed',
    vatIncluded: true
  },
  {
    name: 'Additional Services (Deliveries, Contractor Meetings, etc.)',
    description: 'Waiting for deliveries, meeting contractor/engineer arranged by landlord, neighbour disputes',
    price: 75,
    priceType: 'hourly',
    vatIncluded: true
  },
  {
    name: 'Court Attendance - First Hour',
    description: 'Attending court on behalf of landlord',
    price: 350,
    priceType: 'fixed',
    vatIncluded: true
  },
  {
    name: 'Court Attendance - Additional Hours',
    description: 'Each additional hour after first hour',
    price: 75,
    priceType: 'hourly',
    vatIncluded: true
  }
];

export const certificatesAndCompliance: ServiceCharge[] = [
  {
    name: 'Gas Safety Certificate (CP12)',
    description: 'Annual gas safety inspection by Gas Safe registered engineer',
    price: 120,
    priceType: 'fixed',
    vatIncluded: true,
    notes: 'Required by law for all rental properties with gas appliances'
  },
  {
    name: 'Electrical Installation Condition Report (EICR)',
    description: 'Electrical safety certificate valid for 5 years',
    price: 175,
    priceType: 'fixed',
    vatIncluded: true,
    notes: 'Required by law for all rental properties'
  },
  {
    name: 'Energy Performance Certificate (EPC)',
    description: 'Energy efficiency rating certificate valid for 10 years',
    price: 95,
    priceType: 'fixed',
    vatIncluded: true,
    notes: 'Required for marketing and letting properties. Minimum E rating required.'
  },
  {
    name: 'Floor Plan',
    description: 'Professional floor plan drawing for marketing',
    price: 90,
    priceType: 'fixed',
    vatIncluded: true
  }
];

export const maintenanceTerms = {
  description: 'In case any repairs need to be carried out at the property, we will instruct the contractor to investigate the problem and supply you with the quote for it. The contractor will only be instructed to carry out repairs when it is approved by the landlord unless it\'s an emergency.',
  emergencyExamples: [
    'Water leak',
    'Gas issues',
    'Electrical issues',
    'Roof collapse',
    'Securing doors in case of robbery',
    'All extremely serious situations'
  ],
  notes: 'Emergency repairs may be authorized without prior landlord approval to protect the property and tenant safety.'
};

/**
 * Additional Professional Services offered by John Barclay
 */
export interface ProfessionalService {
  id: string;
  name: string;
  description: string;
  features: string[];
  teamQualifications?: string[];
}

export const professionalServices: ProfessionalService[] = [
  {
    id: 'refurbishments',
    name: 'Refurbishments',
    description: 'We have a fully qualified team that can offer bespoke refurbishments suitable for any property; from basic minor repairs to major refurbishments and extensions. Our expert team of builders are here to help achieve your vision.',
    features: [
      'Bespoke refurbishments tailored to your property',
      'Minor repairs to major refurbishments and extensions',
      'Property assessment and competitive pricing',
      'All health & safety protocols followed and exceeded',
      'Guaranteed workmanship'
    ],
    teamQualifications: [
      'Fully registered Builders',
      'Qualified Plumbers',
      'Certified Electricians'
    ]
  },
  {
    id: 'epc-floorplans',
    name: 'EPC / Floor Plans',
    description: 'We use a registered company for all our EPC/Floor plans that can be arranged with minimum inconvenience to you or your tenants.',
    features: [
      'Registered EPC assessors',
      'Minimal disruption to tenants',
      'Colour copies sent via email within 24 hours',
      'Valid certificates for legal compliance'
    ]
  },
  {
    id: 'gas-safety',
    name: 'Gas Safety Certificates',
    description: 'All our properties have valid Gas certificates which are renewed on an annual basis in accordance to new legislations.',
    features: [
      'Annual gas safety inspections',
      'Complete report and valid certification',
      'Gas Safety Registrar certified engineers',
      'Key pickup to completion service'
    ],
    teamQualifications: [
      'Gas Safe Registered Engineers',
      'Easily verified on Gas Safety Registrar'
    ]
  },
  {
    id: 'plumbing',
    name: 'Plumbing Services',
    description: 'Our plumbing work is carried out by reputable local companies who are efficient, reliable and cost effective. All John Barclay clients are eligible for preferential rates.',
    features: [
      'Small leak repairs',
      'Major plumbing works',
      'New bathroom installations',
      'Kitchen installations',
      'Boiler installations and repairs',
      'Highest standard within legal requirements',
      'Preferential rates for John Barclay clients'
    ],
    teamQualifications: [
      'Gas Safety Registrar registered',
      'Corgi registered'
    ]
  },
  {
    id: 'electrical',
    name: 'Electrical Services',
    description: 'We have access to qualified electricians who are available at short notice and can handle everything from small issues to major rewiring.',
    features: [
      'Short notice availability',
      'Minor fuse issues',
      'Major house rewiring',
      'Electrical safety checks',
      'Compliance with current standards and legal legislation',
      'Warranted workmanship'
    ],
    teamQualifications: [
      'Qualified Electricians',
      'Current standards certified'
    ]
  },
  {
    id: 'cleaning',
    name: 'Cleaning Services',
    description: 'We have an in-house cleaner as well as a company that can do weekly domestic cleaning, after refurbishment cleaning, and carpet shampooing.',
    features: [
      'In-house cleaners available',
      'Weekly domestic cleaning',
      'After refurbishment deep cleaning',
      'Carpet shampooing',
      'Property access management',
      'Mail collection service',
      'Ad-hoc duties as required'
    ]
  },
  {
    id: 'property-admin',
    name: 'Property Administration',
    description: 'Our dedicated administrative team can manage and arrange all your day to day maintenance and property management. All of our services are bespoke and individualistic to your needs.',
    features: [
      'Day-to-day maintenance management',
      'Property management coordination',
      'Bespoke services tailored to your needs',
      'Contractor liaison',
      'Tenant communication',
      'Documentation management'
    ]
  }
];

/**
 * Calculate fee for a service package based on rental amount
 */
export function calculatePackageFee(packageId: string, monthlyRent: number): { monthly: number; annual: number; upfront?: number } {
  const pkg = lettingServicePackages.find(p => p.id === packageId);
  if (!pkg) throw new Error(`Unknown package: ${packageId}`);

  const annualRent = monthlyRent * 12;
  const annualFee = annualRent * (pkg.feePercentage / 100);
  const monthlyFee = annualFee / 12;

  if (pkg.feeType === 'upfront') {
    return {
      monthly: 0,
      annual: annualFee,
      upfront: annualFee
    };
  }

  return {
    monthly: monthlyFee,
    annual: annualFee
  };
}

/**
 * Get inventory price based on bedrooms and furnished status
 */
export function getInventoryPrice(bedrooms: number, furnished: boolean): number {
  if (bedrooms <= 1 && !furnished) return 100;
  if (bedrooms <= 1 && furnished) return 150;
  if (bedrooms <= 3 && !furnished) return 175;
  if (bedrooms <= 3 && furnished) return 250;
  return 400; // 4+ bedrooms
}

/**
 * Get all charges for displaying in UI
 */
export function getAllServiceCharges(): ServiceCharge[] {
  return [...additionalCharges, ...certificatesAndCompliance];
}

/**
 * Format price for display
 */
export function formatServicePrice(charge: ServiceCharge): string {
  if (typeof charge.price === 'string') return charge.price;

  const formatter = new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: 'GBP',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  });

  const priceStr = formatter.format(charge.price);

  switch (charge.priceType) {
    case 'hourly':
      return `${priceStr}/hour`;
    case 'percentage':
      return `${charge.price}%`;
    default:
      return priceStr;
  }
}

/**
 * Tenant Terms and Conditions
 */
export interface TenantTerm {
  id: string;
  title: string;
  description: string;
  details?: string[];
  pricing?: string;
}

export const tenantTerms: TenantTerm[] = [
  {
    id: 'cleaning',
    title: 'Cleaning',
    description: 'It is agreed that the Tenant will have the flat professionally cleaned at the end of the tenancy at their own cost and provide the invoice from the cleaning company of their choice. Should the property not be handed back in acceptable cleaning standard John Barclay Estate & Management will organise cleaning deducting the following cost from the Security Deposit.',
    pricing: 'Cleaning cost varies from £100-£250 depending on the size of the property.'
  },
  {
    id: 'contracts',
    title: 'Contracts',
    description: 'Tenancy Agreement is in current regulation introduced by the National Associations of estate agents. This tenancy agreement is produced to keep both the Tenants and Landlord protected ensuring that all legal requirements / processes are met.'
  },
  {
    id: 'deposits',
    title: 'Deposits',
    description: 'A security deposit is a set amount of money paid at the start of renting a place. The Deposit Protection Service (DPS) is one of the government-authorised tenancy deposit protection schemes that John Barclay uses to register all of our residential properties. This provides a safeguard for the Tenants as well as the Landlord.'
  },
  {
    id: 'inventory',
    title: 'Inventory',
    description: 'At the beginning of the tenancy agreement and during the check in a full inventory will be completed with an Inventory Clerk. The clerk will complete a "walk through" of the property making notes and with essential photos of items/property.',
    details: [
      'The completed report is kept with John Barclay and a copy produced for tenants\' records.',
      'In the event of a dispute the inventory data is used for settling matters.',
      'The inventory record is vital for all check-out ensuring the tenant/s liable/non-liability for any damages as noted during the initial check-in.'
    ]
  },
  {
    id: 'check-in-out',
    title: 'Check In / Check Out',
    description: 'Professional check-in and check-out services to ensure smooth transitions.',
    details: [
      'Check In: Upon signing the tenancy agreement keys are handed to the tenant and are taken to the property for a check in. This consists of a quick overview of the basic essentials of the property.',
      'Check Out: Once a time has been agreed one of our agents will attend the property to do a simple and quick check out. We will go through the inventory that was signed at the start of the tenancy agreement to ensure that the tenants are not liable for any damages that were previously noted. Pictures of the utility meters are taken and a quick walk around to ensure that no valuables have been left in the property.'
    ]
  },
  {
    id: 'management',
    title: 'Management',
    description: 'With John Barclay you can rest assured that any issues or problems that may arise during the tenancy agreement are going to be dealt with by our Maintenance team in a prompt professional manner and at the tenant\'s convenience.',
    details: [
      'Issues are logged on our online system and a contractor is arranged accordingly.',
      'All our contractors are registered tradesmen.'
    ]
  }
];

export const tenantFees: ServiceCharge[] = [
  {
    name: 'Amendment / Early Cancellation / Change of Names Fee',
    description: 'Fee for amendments to tenancy agreement, early cancellation, or change of tenant names',
    price: 50,
    priceType: 'fixed',
    vatIncluded: true
  }
];

/**
 * Get all tenant terms for display
 */
export function getAllTenantTerms(): TenantTerm[] {
  return tenantTerms;
}

/**
 * Get tenant fees for display
 */
export function getTenantFees(): ServiceCharge[] {
  return tenantFees;
}
