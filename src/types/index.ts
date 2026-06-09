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
  /** Nr. 17 (+18) — Steuerfreie AG-Leistungen, auf die Entfernungspauschale anrechenbar. */
  agCommuteUntaxed: number;
  /** Nr. 20 — Steuerfrei ersetzte Verpflegungsmehraufwendungen (reduces the meal claim). */
  mealReimbursed: number;
  /** Nr. 21 — Steuerfreie Vergütungen bei doppelter Haushaltsführung (reduces that claim). */
  doubleHouseholdReimbursed: number;

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
  /** Meal allowance for business travel (Verpflegungsmehraufwand). */
  mealAllowance: number;
  /** Double-household running costs (doppelte Haushaltsführung). */
  doubleHousehold: number;

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

/**
 * A single RSU/ESPP vesting tranche, for the grant/vest allocation helper.
 * Each vest is taxed in Germany at vest; only the share attributable to German
 * workdays during the grant→vest window is German-source (the rest is relieved
 * under the India–Germany treaty).
 */
export interface RsuTranche {
  id: string;
  /** Human label, e.g. "2022 grant — tranche 3 (22%)". */
  label: string;
  /** Vest date (ISO yyyy-mm-dd). Determines which German tax year it falls in. */
  vestDate: string;
  /** Fair market value at vest, in EUR. */
  vestValue: number;
  /** Workdays performed in Germany during the grant→vest window. */
  germanWorkdays: number;
  /** Total workdays in the grant→vest window. */
  totalWorkdays: number;
  /** True if this vest is already reported on the German wage statement (line 3/10). */
  onCertificate: boolean;
  /** Indian (or other foreign) tax paid on this specific vest, in EUR. */
  indianTaxPaid: number;
}

/** How to relieve the foreign-source share of equity income. */
export type RsuReliefMethod = 'exemption' | 'credit';

/** Optional capital income (Anlage KAP) & foreign/GSU income (Anlage AUS). */
export interface CapitalForeign {
  /** Whether the user has any of this income (otherwise the step is skipped). */
  enabled: boolean;

  // --- Capital income → Anlage KAP (Abgeltungsteuer 25%) ---
  /** Dividends, interest and realised gains (gross). */
  investmentIncome: number;
  /** Kapitalertragsteuer already withheld by German banks/brokers. */
  capitalTaxWithheld: number;
  /** Creditable foreign withholding tax on capital income (Quellensteuer). */
  foreignWithholdingTax: number;

  // --- Foreign / equity-compensation income → Anlage N + AUS ---
  /** RSU/ESPP (GSU) income taxed at the normal rate, NOT already on the wage statement. */
  gsuIncome: number;
  /**
   * Income that IS already on the wage statement (e.g. RSUs in line 3 or 10) but
   * was ALSO taxed abroad. Not added to income again — used only to size the
   * foreign-tax credit. This is how you claim relief without double-counting.
   */
  foreignTaxedIncomeOnCert: number;
  /** Portion exempt under the India–Germany treaty (Progressionsvorbehalt). */
  gsuTreatyExempt: number;
  /**
   * Income already on the wage statement (line 3/10) that is treaty-EXEMPT, so it
   * is subtracted from German-taxable income and instead raises the rate only.
   */
  treatyExemptOnCert: number;
  /** Total foreign tax paid abroad (e.g. India) on the GSU/foreign income, creditable. */
  gsuForeignTaxPaid: number;
  /** Relief method for the foreign-source share of equity income. */
  rsuReliefMethod: RsuReliefMethod;
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
  capitalForeign: CapitalForeign;
  /** RSU/ESPP vesting tranches (multi-year record for the allocation helper). */
  rsuTranches: RsuTranche[];
  /** Follow-up document checklist the user can tick off. */
  followUpDocs: Record<string, boolean>;
  /** Last step the user reached, for resuming. */
  lastStep: string;
}
