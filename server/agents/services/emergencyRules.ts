/**
 * Emergency Rules Engine
 *
 * Rules-based urgency classification for maintenance fault reports.
 * Pure function -- no database calls. Takes date as parameter for testability.
 *
 * Emergency classification categories:
 * - Gas/CO: score 10 (immediate danger to life)
 * - Flood/burst pipe: score 10 (immediate property damage)
 * - Electrical danger: score 10 (immediate danger to life)
 * - No heating in winter: score 9 (vulnerable tenants at risk)
 * - Security breach: score 9 (personal safety)
 * - No hot water: score 6 (urgent but not emergency)
 * - General urgent: score 5-6
 * - Routine: score 3
 * - Low/cosmetic: score 1-2
 */

export interface EmergencyClassification {
  urgency: 'emergency' | 'urgent' | 'routine' | 'low';
  score: number;
  reasoning: string;
  isEmergency: boolean;
}

interface SystemInfo {
  vulnerableTenant?: boolean;
  make?: string;
  model?: string;
  warrantyStatus?: string;
}

// Winter months: October (9) through March (2)
function isWinter(date: Date): boolean {
  const month = date.getMonth(); // 0-indexed
  return month >= 9 || month <= 2;
}

// Pattern definitions ordered by severity
const EMERGENCY_PATTERNS: Array<{
  pattern: RegExp;
  urgency: 'emergency' | 'urgent' | 'routine' | 'low';
  score: number;
  reasoning: string;
  seasonalOverride?: (date: Date, systemInfo: SystemInfo | null) => EmergencyClassification | null;
}> = [
  // Gas / CO -- score 10
  {
    pattern: /gas\s*leak|smell(ing)?\s*gas|carbon\s*monoxide|co\s*alarm/i,
    urgency: 'emergency',
    score: 10,
    reasoning: 'Gas leak or carbon monoxide risk reported -- immediate danger to life',
  },
  // Flood / burst pipe -- score 10
  {
    pattern: /burst\s*pipe|flood(ing)?|water\s*pour(ing)?|ceiling\s*leak(ing)?|water\s*(is\s*)?coming\s*(through|in)/i,
    urgency: 'emergency',
    score: 10,
    reasoning: 'Flooding or burst pipe reported -- immediate property damage risk',
  },
  // Electrical danger -- score 10
  {
    pattern: /electric(al)?\s*shock|sparking|burning\s*smell|exposed\s*wir(e|ing)/i,
    urgency: 'emergency',
    score: 10,
    reasoning: 'Electrical hazard reported -- immediate danger to life',
  },
  // Security breach -- score 9
  {
    pattern: /break[\s-]*in|door\s*(won't|can't|cannot)\s*lock|window\s*(smashed|broken|shattered)|lock\s*(broken|jammed)/i,
    urgency: 'emergency',
    score: 9,
    reasoning: 'Security breach reported -- property cannot be secured',
  },
  // No heating -- seasonal (winter = emergency 9, summer = urgent 7)
  {
    pattern: /no\s*heating|heating\s*(broken|not\s*working|off|failed)|boiler\s*(not\s*working|broken|failed|off)/i,
    urgency: 'emergency',
    score: 9,
    reasoning: 'No heating during winter months -- vulnerable tenants at risk',
    seasonalOverride: (date: Date, _systemInfo: SystemInfo | null) => {
      if (isWinter(date)) {
        return {
          urgency: 'emergency',
          score: 9,
          reasoning: 'No heating during winter months -- vulnerable tenants at risk',
          isEmergency: true,
        };
      }
      return {
        urgency: 'urgent',
        score: 7,
        reasoning: 'Boiler or heating fault reported outside winter months',
        isEmergency: false,
      };
    },
  },
  // No hot water -- urgent score 6
  {
    pattern: /no\s*hot\s*water/i,
    urgency: 'urgent',
    score: 6,
    reasoning: 'No hot water reported -- essential service disruption',
  },
  // General urgent patterns
  {
    pattern: /pest|infest/i,
    urgency: 'urgent',
    score: 5,
    reasoning: 'Pest or infestation issue reported -- health risk',
  },
  // Routine patterns
  {
    pattern: /washing\s*machine|dishwasher|oven|appliance/i,
    urgency: 'routine',
    score: 3,
    reasoning: 'Appliance issue reported -- routine maintenance',
  },
  // Low/cosmetic patterns
  {
    pattern: /drip(ping)?|minor/i,
    urgency: 'low',
    score: 2,
    reasoning: 'Minor plumbing or maintenance issue reported',
  },
  {
    pattern: /cosmetic|paint(ing)?|scuff|scratch|decoration/i,
    urgency: 'low',
    score: 1,
    reasoning: 'Cosmetic or decorative issue reported -- low priority',
  },
];

/**
 * Classify the urgency of a maintenance fault report using rules-based analysis.
 *
 * @param description - The fault description text from the tenant
 * @param category - The fault category (heating, plumbing, electrical, etc.)
 * @param systemInfo - Optional property system information (for vulnerability checks)
 * @param currentDate - The current date (for seasonal heating rules)
 * @returns EmergencyClassification with urgency level, score, reasoning, and isEmergency flag
 */
export function classifyUrgency(
  description: string,
  category: string,
  systemInfo: SystemInfo | null,
  currentDate?: Date,
): EmergencyClassification {
  const date = currentDate ?? new Date();

  for (const rule of EMERGENCY_PATTERNS) {
    if (rule.pattern.test(description)) {
      // Check for seasonal override (e.g., heating in winter vs summer)
      if (rule.seasonalOverride) {
        const override = rule.seasonalOverride(date, systemInfo);
        if (override) return override;
      }

      return {
        urgency: rule.urgency,
        score: rule.score,
        reasoning: rule.reasoning,
        isEmergency: rule.urgency === 'emergency',
      };
    }
  }

  // Default: routine
  return {
    urgency: 'routine',
    score: 3,
    reasoning: 'No specific urgency patterns matched -- classified as routine maintenance',
    isEmergency: false,
  };
}
