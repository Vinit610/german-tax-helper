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
  /** Nr. 3 — Bruttoarbeitslohn (regular wage, excludes Nr. 9/10). */
  grossSalary: number;
  /** Nr. 4 — Einbehaltene Lohnsteuer von 3. (tax on the regular wage). */
  incomeTaxWithheld: number;
  /** Nr. 5 — Einbehaltener Solidaritätszuschlag von 3. */
  soliWithheld: number;
  /** Nr. 7 (+8) — Einbehaltene Kirchensteuer (you + spouse) von 3. */
  churchTaxWithheld: number;

  /** Nr. 11 — Einbehaltene Lohnsteuer von 9. und 10. (on specially-taxed pay). */
  incomeTaxSpecial: number;
  /** Nr. 12 — Solidaritätszuschlag von 9. und 10. */
  soliSpecial: number;
  /** Nr. 13 (+14) — Kirchensteuer von 9. und 10. */
  churchTaxSpecial: number;
  /** Nr. 9 + 10 — Ermäßigt besteuerter Arbeitslohn (Fünftelregelung, deferred). */
  specialIncome: number;
  /** Nr. 6 — Steuerfreier Arbeitslohn nach DBA/ATE (Progressionsvorbehalt). */
  dbaIncome: number;
  /** Nr. 15 — Kurzarbeitergeld u. a. Lohnersatzleistungen (Progressionsvorbehalt). */
  lohnReplacement: number;
  /** Nr. 17 — Steuerfreie AG-Leistungen, auf die Entfernungspauschale anrechenbar. */
  agCommuteUntaxed: number;

  /** Nr. 22a — Arbeitgeberanteil gesetzliche Rentenversicherung. */
  pensionEmployer: number;
  /** Nr. 23a — Arbeitnehmeranteil gesetzliche Rentenversicherung. */
  pensionEmployee: number;
  /** Nr. 25 — Arbeitnehmerbeiträge gesetzliche Krankenversicherung. */
  healthInsuranceEmployee: number;
  /** Nr. 26 — Arbeitnehmerbeiträge soziale Pflegeversicherung. */
  careInsuranceEmployee: number;
  /** Nr. 27 — Arbeitnehmerbeiträge Arbeitslosenversicherung. */
  unemploymentInsuranceEmployee: number;
  /** Nr. 28 — Private Kranken-/Pflege-Pflichtversicherung oder Mindestvorsorgepauschale. */
  privateHealthCare: number;
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
  /** Main mode of transport — affects the €4,500 cap (no cap when using a car). */
  commuteMode: 'car' | 'public' | 'other';
  /** Actual annual public-transport cost (claimable if above the Pauschale). */
  commutePublicCost: number;
  /** Address of the first place of work (Anlage N asks for it; optional here). */
  firstWorkplace: string;
  /** Home-office days (Homeoffice-Pauschale, €6/day, max 210 days). */
  homeOfficeDays: number;
  /** Work equipment / tools (Arbeitsmittel) total in EUR. */
  workEquipment: number;
  /** Professional association / union dues (Beiträge zu Berufsverbänden). */
  unionDues: number;
  /** Training / further education (Fortbildungskosten). */
  trainingCosts: number;
  /** Job-application costs and other minor Werbungskosten. */
  applicationCosts: number;

  // --- Sonderausgaben (special expenses) ---
  /** Charitable donations (Spenden). */
  donations: number;
  /** Private liability insurance (Haftpflichtversicherung). */
  liabilityInsurance: number;
  /** Accident insurance (Unfallversicherung, private share). */
  accidentInsurance: number;
  /** Term life / risk insurance (Risikolebensversicherung). */
  termLifeInsurance: number;
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
