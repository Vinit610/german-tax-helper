// Core domain types for the German salaried MVP (tax year 2025).
//
// Naming convention: English field names, with the official German term in a
// comment where it matters. The UI always shows the German "Anlage" name next
// to each section so users can cross-reference with official forms / ELSTER.

export const TAX_YEAR = 2025 as const;

/** Single vs. joint assessment (Zusammenveranlagung). */
export type AssessmentType = 'single' | 'joint';

/** Church-tax (Kirchensteuer) rate by federal state. 0 = not a member. */
export type ChurchTaxRate = 0 | 0.08 | 0.09;

export interface PersonalProfile {
  /** Einzel- vs. Zusammenveranlagung. */
  assessmentType: AssessmentType;
  /** Federal state (Bundesland) — affects church-tax rate. */
  bundesland: string;
  /** Church membership / Kirchensteuer rate (8% BY+BW, otherwise 9%). */
  churchTaxRate: ChurchTaxRate;
  /** For joint assessment: is the spouse also a church member? */
  spouseChurchTaxRate: ChurchTaxRate;
  /** Number of children (Kinder) — used for child allowance hints. */
  children: number;
}

/**
 * Fields parsed from the Lohnsteuerbescheinigung (employer's annual wage-tax
 * statement). The German form numbers each line; we keep the line number so the
 * UI can show exactly where a value came from.
 */
export interface LohnsteuerData {
  /** Line 3 — Bruttoarbeitslohn (gross salary). */
  grossSalary: number;
  /** Line 4 — Einbehaltene Lohnsteuer (income tax withheld). */
  incomeTaxWithheld: number;
  /** Line 5 — Einbehaltener Solidaritätszuschlag. */
  soliWithheld: number;
  /** Line 6 — Einbehaltene Kirchensteuer (church tax withheld). */
  churchTaxWithheld: number;
  /** Lines 22/23 — Arbeitnehmer-/Arbeitgeberanteil gesetzliche Rentenversicherung. */
  pensionEmployee: number;
  pensionEmployer: number;
  /** Line 25 — Arbeitnehmeranteil gesetzliche Krankenversicherung (health). */
  healthInsuranceEmployee: number;
  /** Line 26 — Arbeitnehmeranteil soziale Pflegeversicherung (long-term care). */
  careInsuranceEmployee: number;
  /** Line 27 — Arbeitnehmeranteil Arbeitslosenversicherung (unemployment). */
  unemploymentInsuranceEmployee: number;
  /** eTIN / tax number if detected (optional, informational only). */
  eTIN?: string;
}

/** A single parsed field with provenance, for the review screen. */
export interface ParsedField<T = number> {
  line: string;
  label: string;
  germanLabel: string;
  value: T;
  /** How confident the parser is (text extraction beats OCR). */
  confidence: 'high' | 'medium' | 'low';
  /** Whether the user has edited/confirmed the value. */
  edited?: boolean;
  /** Whether this line feeds the estimate (vs. captured for reference). */
  used?: boolean;
}

export interface Deductions {
  // --- Werbungskosten (income-related expenses) → Anlage N ---
  /** Commute: one-way distance to work in km (Entfernungspauschale). */
  commuteOneWayKm: number;
  /** Number of days commuted to the workplace in the year. */
  commuteDays: number;
  /** Home-office days (Homeoffice-Pauschale, €6/day, max 210 days). */
  homeOfficeDays: number;
  /** Work equipment / tools (Arbeitsmittel) total in EUR. */
  workEquipment: number;
  /** Professional memberships, training, applications, etc. */
  otherWorkCosts: number;

  // --- Sonderausgaben (special expenses) ---
  /** Charitable donations (Spenden). */
  donations: number;
  /** Additional private insurance premiums not on the wage statement. */
  otherInsurance: number;
}

/** Everything the user has entered/parsed, persisted to localStorage. */
export interface AppState {
  schemaVersion: number;
  taxYear: number;
  profile: PersonalProfile;
  lohnsteuer: LohnsteuerData | null;
  /** Full set of captured/edited wage-statement lines (incl. informational). */
  wageLines: ParsedField[] | null;
  deductions: Deductions;
  /** Follow-up document checklist the user can tick off. */
  followUpDocs: Record<string, boolean>;
  /** Last step the user reached, for resuming. */
  lastStep: string;
}
