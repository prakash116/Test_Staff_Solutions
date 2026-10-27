// ---- Domain vocabulary -------------------------------------------------------

export type Role = 'chef' | 'helper' | 'waiter' | 'cleaner' | 'bartender';

export type Subcategory =
  | 'chinese_chef'
  | 'tandoor_chef'
  | 'continental_chef'
  | 'south_indian_chef'
  | 'pastry_chef'
  | 'kitchen_helper'
  | 'waiter'
  | 'deep_cleaner'
  | 'bartender';

export const ROLES: Role[] = ['chef', 'helper', 'waiter', 'cleaner', 'bartender'];

export const ROLE_LABEL: Record<Role, string> = {
  chef: 'Chef',
  helper: 'Helper',
  waiter: 'Waiter',
  cleaner: 'Cleaner',
  bartender: 'Bartender',
};

export const SUBCATEGORY_LABEL: Record<Subcategory, string> = {
  chinese_chef: 'Chinese chef',
  tandoor_chef: 'Tandoor chef',
  continental_chef: 'Continental chef',
  south_indian_chef: 'South Indian chef',
  pastry_chef: 'Pastry chef',
  kitchen_helper: 'Kitchen helper',
  waiter: 'Waiter',
  deep_cleaner: 'Deep cleaner',
  bartender: 'Bartender',
};

export const SUBCATEGORIES_BY_ROLE: Record<Role, Subcategory[]> = {
  chef: ['chinese_chef', 'tandoor_chef', 'continental_chef', 'south_indian_chef', 'pastry_chef'],
  helper: ['kitchen_helper'],
  waiter: ['waiter'],
  cleaner: ['deep_cleaner'],
  bartender: ['bartender'],
};

export const ROLE_OF_SUBCATEGORY: Record<Subcategory, Role> = {
  chinese_chef: 'chef',
  tandoor_chef: 'chef',
  continental_chef: 'chef',
  south_indian_chef: 'chef',
  pastry_chef: 'chef',
  kitchen_helper: 'helper',
  waiter: 'waiter',
  deep_cleaner: 'cleaner',
  bartender: 'bartender',
};

// ---- Parse output schema -----------------------------------------------------
//
// Every extracted field carries its own confidence and a reason. The review
// screen reads `confidence` to decide what to highlight, and `reason` to tell
// the owner why we are unsure, so a correction is one tap, not a guess.

export type Confidence = 'high' | 'medium' | 'low' | 'missing';

export interface Field<T> {
  value: T | null;
  confidence: Confidence;
  /** Short human reason shown under the field when confidence is below high. */
  reason?: string;
  /** Quick picks offered when the owner taps the field. */
  suggestions?: T[];
}

export interface StaffLine {
  id: string;
  role: Field<Role>;
  subcategory: Field<Subcategory>;
  count: Field<number>;
}

export interface DraftRequest {
  id: string;
  raw: string;
  lines: StaffLine[];
  /** ISO yyyy-mm-dd of the first day. */
  date: Field<string>;
  /** ISO date of the last day for multi-day bookings; null for a single day. */
  endDate: Field<string | null>;
  /** 24h "HH:MM". */
  startTime: Field<string>;
  endTime: Field<string>;
  /** Area name as the owner would say it, e.g. "Connaught Place". */
  location: Field<string>;
  budgetPerDay: Field<number | null>;
  notes: string[];
}

export type Intent = 'book' | 'cancel_and_book' | 'cancel_only' | 'unclear';

export interface ParseResult {
  intent: Intent;
  /** One draft per distinct day group. Test request 9 produces two. */
  drafts: DraftRequest[];
  /** Validator messages that apply to the whole request. */
  warnings: string[];
  /** Which engine produced the parse. Shown in the UI so nobody is fooled. */
  engine: 'rules' | 'llm';
}

// ---- Partners ---------------------------------------------------------------

export interface TimeWindow {
  start: string; // "HH:MM"
  end: string;
}

export interface Partner {
  id: string;
  name: string;
  subcategory: Subcategory;
  area: string;
  lat: number;
  lng: number;
  /** 0..5 */
  reliability: number;
  completedJobs: number;
  dayRate: number;
  /** "0" = Sunday ... "6" = Saturday */
  weeklyAvailability: Record<string, TimeWindow[]>;
  blockedDates: string[];
  avatarSeed: string;
}

// ---- Matching ---------------------------------------------------------------

export interface ScoreComponents {
  fit: number; // 0..1
  distanceKm: number;
  distance: number; // 0..1
  availability: number; // 0..1  (1 full, 0.5 partial, 0 none)
  reliability: number; // 0..1
  overBudget: boolean;
}

export interface RankedPartner {
  partner: Partner;
  total: number;
  components: ScoreComponents;
  explanation: string;
}

// ---- Bookings --------------------------------------------------------------

export type BookingStatus = 'confirmed' | 'cancelled' | 'pending';

export interface Booking {
  id: string;
  createdAt: string;
  status: BookingStatus;
  draft: DraftRequest;
  partnerIds: string[];
  summary: string;
}
