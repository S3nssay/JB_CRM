import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: 'GBP',
    maximumFractionDigits: 0
  }).format(amount);
}

export function generatePropertyOffer(propertyType: string, bedrooms: string, condition: string): { estimated: number, offer: number } {
  const baseValues: Record<string, number> = {
    'detached': 400000,
    'semi-detached': 300000,
    'terraced': 250000,
    'flat': 200000,
    'bungalow': 350000,
    'other': 275000
  };
  
  const bedroomMultiplier: Record<string, number> = {
    '1': 0.8,
    '2': 1.0,
    '3': 1.2,
    '4': 1.5,
    '5+': 1.8
  };
  
  const conditionMultiplier: Record<string, number> = {
    'good': 1.1,
    'average': 1.0,
    'needs_work': 0.8
  };

  const baseValue = baseValues[propertyType] || 275000;
  const bedroomFactor = bedroomMultiplier[bedrooms] || 1.0;
  const conditionFactor = conditionMultiplier[condition] || 1.0;
  
  const estimatedValue = Math.round(baseValue * bedroomFactor * conditionFactor);
  const offerValue = Math.round(estimatedValue * 0.85); // 85% of market value

  return {
    estimated: estimatedValue,
    offer: offerValue
  };
}

export const propertyTypeOptions = [
  { value: "detached", label: "Detached" },
  { value: "semi-detached", label: "Semi-Detached" },
  { value: "terraced", label: "Terraced" },
  { value: "flat", label: "Flat/Apartment" },
  { value: "bungalow", label: "Bungalow" },
  { value: "other", label: "Other" }
];

export const bedroomOptions = [
  { value: "1", label: "1" },
  { value: "2", label: "2" },
  { value: "3", label: "3" },
  { value: "4", label: "4" },
  { value: "5+", label: "5+" }
];

export const conditionOptions = [
  { value: "good" as const, label: "Good", icon: "home-smile-line", color: "text-green-500" },
  { value: "average" as const, label: "Average", icon: "home-4-line", color: "text-amber-500" },
  { value: "needs_work" as const, label: "Needs Work", icon: "home-gear-line", color: "text-red-500" }
];

export const timeframeOptions = [
  { value: "asap" as const, label: "ASAP" },
  { value: "1-3_months" as const, label: "1-3 Months" },
  { value: "3-6_months" as const, label: "3-6 Months" },
  { value: "just_curious" as const, label: "Just Curious" }
];

export const exchangeTimeframeOptions = [
  { value: "7_days" as const, label: "7 Days" },
  { value: "28_days" as const, label: "28 Days" },
  { value: "90_days" as const, label: "90+ Days" },
  { value: "longer" as const, label: "Longer/Flexible" }
];

export const yesNoOptions = [
  { value: "yes" as const, label: "Yes" },
  { value: "no" as const, label: "No" }
];

export const legalStatusOptions = [
  { value: "sole_owner", label: "Sole Owner" },
  { value: "joint_owner", label: "Joint Owner" },
  { value: "power_of_attorney", label: "Power of Attorney" },
  { value: "executor", label: "Executor" },
  { value: "other", label: "Other" }
];

export const ownershipLengthOptions = [
  { value: "less_than_1_year", label: "Less than 1 year" },
  { value: "1_to_5_years", label: "1 to 5 years" },
  { value: "5_to_10_years", label: "5 to 10 years" },
  { value: "more_than_10_years", label: "More than 10 years" }
];

export const mortgageDetailsOptions = [
  { value: "no_mortgage", label: "No Mortgage" },
  { value: "less_than_25_percent", label: "Less than 25% of property value" },
  { value: "25_to_50_percent", label: "25% to 50% of property value" },
  { value: "50_to_75_percent", label: "50% to 75% of property value" },
  { value: "more_than_75_percent", label: "More than 75% of property value" }
];

export const reasonForSellingOptions = [
  { value: "relocation", label: "Relocation" },
  { value: "upsizing", label: "Upsizing" },
  { value: "downsizing", label: "Downsizing" },
  { value: "financial_reasons", label: "Financial Reasons" },
  { value: "inheritance", label: "Inheritance" },
  { value: "other", label: "Other" }
];
