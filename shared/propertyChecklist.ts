// Grouped metadata for the property "Details (for file)" checklist.
// Single source of truth shared by the API (field whitelist) and the property
// detail UI (rendering). Keys are the Drizzle camelCase property names on the
// `propertyChecklists` table (shared/schema.ts). No drizzle imports here so this
// module is safe to bundle into the client.

export interface PropertyChecklistItem {
  key: string;
  label: string;
}

export interface PropertyChecklistGroup {
  group: string;
  items: PropertyChecklistItem[];
}

export const propertyChecklistGroups: PropertyChecklistGroup[] = [
  {
    group: 'Financial',
    items: [
      { key: 'depositAndRent', label: 'Deposit & Rent' },
      { key: 'standingOrder', label: 'Standing Order' },
    ],
  },
  {
    group: 'Legal Documents',
    items: [
      { key: 'tenancyAgreement', label: 'Tenancy Agreement' },
      { key: 'guarantorsAgreement', label: 'Guarantors Agreement' },
      { key: 'notices', label: 'Notices' },
      { key: 'authorizationToLandlord', label: 'Authorization to Landlord' },
      { key: 'termsAndConditionsToLandlord', label: 'Terms & Conditions to Landlord' },
      { key: 'informationSheetToLandlord', label: 'Information Sheet to Landlord' },
    ],
  },
  {
    group: 'Tenant Verification',
    items: [
      { key: 'tenantsId', label: "Tenant's ID" },
      { key: 'previousLandlordRef', label: 'Previous Landlord Reference' },
      { key: 'bankReference', label: 'Bank Reference' },
      { key: 'workReference', label: 'Work Reference' },
    ],
  },
  {
    group: 'Property Items',
    items: [
      { key: 'inventory', label: 'Inventory' },
      { key: 'gasSafetyCertificate', label: 'Gas Safety Certificate' },
    ],
  },
  {
    group: 'Deposit Protection',
    items: [
      { key: 'depositProtectionDps', label: 'Deposit Protection by DPS' },
      { key: 'depositProtectionTds', label: 'Deposit Protection by TDS' },
      { key: 'depositHeldByLandlord', label: 'Deposit Held by Landlord' },
    ],
  },
  {
    group: 'Keys',
    items: [
      { key: 'spareKeysInOffice', label: 'Spare Keys in Office' },
      { key: 'keysGivenToTenant', label: 'Keys Given to Tenant' },
    ],
  },
];

// Flat list of all boolean checklist item keys (19 items).
export const propertyChecklistItemKeys: string[] = propertyChecklistGroups.flatMap(
  (g) => g.items.map((i) => i.key),
);

export const propertyChecklistItemCount = propertyChecklistItemKeys.length;
