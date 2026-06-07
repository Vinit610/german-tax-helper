// Rules layer: map the Lohnsteuerbescheinigung's numbered lines to our field
// model. The source text comes from pdf.js (preferred) or OCR (fallback), so it
// is noisy — every match carries a confidence level and the user reviews/edits
// each value before anything is used in a calculation.

import type { LohnsteuerData, ParsedField } from '../../types';

/**
 * Parse a money amount, auto-detecting the decimal separator so it works for
 * both German ("156.177,33") and English/US ("156,177.33") formatting, as well
 * as the messy output pdf.js / OCR produce (spaced thousands, missing decimals,
 * bare integers).
 *
 *   "156.177,33" → 156177.33   "156,177.33" → 156177.33
 *   "45 000,00" → 45000        "45.000" → 45000        "62000" → 62000
 *   "612,50" → 612.5           "0,00" → 0
 *
 * Rule: when a separator is followed by exactly 1–2 digits it is the decimal
 * point; otherwise all separators are thousands separators.
 */
export function parseAmount(raw: string): number | null {
  let s = raw.replace(/[^\d.,\s-]/g, '').trim();
  if (!s) return null;
  const negative = s.startsWith('-');
  s = s.replace(/-/g, '').trim();

  const lastDot = s.lastIndexOf('.');
  const lastComma = s.lastIndexOf(',');
  let decimalSep: string | null = null;
  if (lastDot !== -1 || lastComma !== -1) {
    const sepPos = Math.max(lastDot, lastComma);
    const trailing = s.length - sepPos - 1;
    if (trailing === 1 || trailing === 2) decimalSep = s[sepPos];
  }

  let intPart = s;
  let decPart = '';
  if (decimalSep) {
    const p = s.lastIndexOf(decimalSep);
    intPart = s.slice(0, p);
    decPart = s.slice(p + 1);
  }
  intPart = intPart.replace(/[.,\s]/g, '');
  decPart = decPart.replace(/\D/g, '');

  const n = Number.parseFloat(intPart + (decPart ? `.${decPart}` : ''));
  if (!Number.isFinite(n)) return null;
  return negative ? -n : n;
}

interface FieldRule {
  /** Calculation field this line feeds, if any. Display-only lines omit it. */
  key?: keyof LohnsteuerData;
  line: string;
  label: string;
  germanLabel: string;
  /** Whether this value is used in the estimate (vs. captured for reference). */
  used: boolean;
  /** Keywords (lowercased) that anchor the value on the form, in priority order. */
  keywords: string[];
}

// Ordered by line number on the elektronische Lohnsteuerbescheinigung. Lines
// marked `used` feed the estimate; the rest are captured for transparency so the
// user can see (and correct) everything the document contains.
const RULES: FieldRule[] = [
  // --- Income & taxes withheld (Anlage N) ---
  { key: 'grossSalary', line: '3', used: true, label: 'Gross salary', germanLabel: 'Bruttoarbeitslohn', keywords: ['bruttoarbeitslohn'] },
  { key: 'incomeTaxWithheld', line: '4', used: true, label: 'Income tax withheld', germanLabel: 'Einbehaltene Lohnsteuer', keywords: ['einbehaltene lohnsteuer'] },
  { key: 'soliWithheld', line: '5', used: true, label: 'Solidarity surcharge withheld', germanLabel: 'Solidaritätszuschlag', keywords: ['solidaritätszuschlag', 'solidaritatszuschlag'] },
  { key: 'churchTaxWithheld', line: '6', used: true, label: 'Church tax withheld (you)', germanLabel: 'Kirchensteuer des Arbeitnehmers', keywords: ['kirchensteuer des arbeitnehmers', 'kirchensteuer'] },
  { line: '7', used: false, label: 'Church tax withheld (spouse)', germanLabel: 'Kirchensteuer des Ehegatten/Lebenspartners', keywords: ['kirchensteuer des ehegatten', 'kirchensteuer des lebenspartners', 'ehegatten'] },

  // --- Tax-free / specially-taxed wage components (later phases) ---
  { line: '15', used: false, label: 'Wage-replacement benefits', germanLabel: 'Kurzarbeitergeld u. a. Lohnersatzleistungen', keywords: ['kurzarbeitergeld', 'lohnersatzleistungen', 'aufstockungsbetr'] },
  { line: '16', used: false, label: 'Tax-free wages under a tax treaty', germanLabel: 'Steuerfreier Arbeitslohn nach DBA/ATE', keywords: ['doppelbesteuerungsabkommen', 'nach dba', 'auslandstätigkeit', 'auslandstatigkeit'] },
  { line: '17', used: false, label: 'Tax-free commute/transport benefits', germanLabel: 'Steuerfreie Arbeitgeberleistungen (Fahrten/Sammelbeförderung)', keywords: ['sammelbeförderung', 'sammelbeforderung', 'job-ticket', 'jobticket'] },
  { line: '18', used: false, label: 'Flat-taxed commute benefits', germanLabel: 'Pauschal besteuerte Arbeitgeberleistungen (Fahrten)', keywords: ['pauschal besteuert'] },
  { line: '19', used: false, label: 'Reduced-rate multi-year pay', germanLabel: 'Ermäßigt besteuerter Arbeitslohn für mehrere Jahre', keywords: ['mehrere kalenderjahre', 'ermäßigt besteuert', 'ermassigt besteuert'] },
  { line: '20', used: false, label: 'Meal allowances', germanLabel: 'Steuerfreie Verpflegungszuschüsse', keywords: ['verpflegungsmehraufwand', 'verpflegungszuschuss', 'verpflegung'] },
  { line: '21', used: false, label: 'Double-household allowance', germanLabel: 'Steuerfreie Leistungen doppelte Haushaltsführung', keywords: ['doppelte haushaltsführung', 'doppelte haushaltsfuhrung'] },

  // --- Social-insurance contributions (Anlage Vorsorgeaufwand) ---
  { key: 'pensionEmployer', line: '22a', used: true, label: 'Pension (employer share)', germanLabel: 'Arbeitgeberanteil gesetzliche Rentenversicherung', keywords: ['arbeitgeberanteil'] },
  { line: '22b', used: false, label: 'Professional pension (employer)', germanLabel: 'Arbeitgeberanteil berufsständische Versorgung', keywords: ['arbeitgeberanteil berufsständ', 'berufsständische versorgung'] },
  { key: 'pensionEmployee', line: '23a', used: true, label: 'Pension (employee share)', germanLabel: 'Arbeitnehmeranteil gesetzliche Rentenversicherung', keywords: ['arbeitnehmeranteil'] },
  { line: '24', used: false, label: 'Employer health/care subsidy', germanLabel: 'Steuerfreie Arbeitgeberzuschüsse Kranken-/Pflegeversicherung', keywords: ['arbeitgeberzuschuss', 'steuerfreie zuschüsse', 'zuschuss zur kranken'] },
  { key: 'healthInsuranceEmployee', line: '25', used: true, label: 'Health insurance (employee)', germanLabel: 'Arbeitnehmerbeiträge gesetzliche Krankenversicherung', keywords: ['krankenversicherung'] },
  { key: 'careInsuranceEmployee', line: '26', used: true, label: 'Long-term care insurance (employee)', germanLabel: 'Arbeitnehmerbeiträge soziale Pflegeversicherung', keywords: ['pflegeversicherung'] },
  { key: 'unemploymentInsuranceEmployee', line: '27', used: true, label: 'Unemployment insurance (employee)', germanLabel: 'Arbeitnehmerbeiträge Arbeitslosenversicherung', keywords: ['arbeitslosenversicherung'] },
  { line: '28', used: false, label: 'Private health/care insurance', germanLabel: 'Beiträge zur privaten Kranken-/Pflegeversicherung', keywords: ['private kranken', 'basiskranken', 'private pflege'] },
];

/** Lines that feed the estimate (used to map fields → typed data). */
const USED_LINES = RULES.filter((r) => r.key).map((r) => r.line);

// Matches money amounts in the many shapes pdf.js / OCR emit, in either German
// or US separator style. First alt: grouped thousands with optional spaces
// ("45.000,00", "156,177.33", "45 000"); second: a plain number with a decimal
// separator ("450,00", "3,456.78"); third: a bare integer of 3+ digits
// ("45000"), which avoids grabbing a stray line number like "3" or "22".
const AMOUNT_RE = /\d{1,3}(?:[.,\s]\d{3})+(?:[.,]\d{1,2})?|\d+[.,]\d{1,2}|\d{3,}/g;

/** True when the token ends in a separator + 1–2 digits (i.e. real currency). */
function looksLikeDecimal(raw: string): boolean {
  return /[.,]\d{1,2}(?!\d)/.test(raw);
}

interface Candidate {
  value: number;
  hasDecimal: boolean;
  offset: number;
}

/**
 * Collect amount candidates in a window after a keyword and pick the best one:
 * the nearest value formatted like real money (a decimal separator), else the
 * nearest plausible integer. Year-like bare integers are skipped (dates).
 */
function findAmountNearKeyword(text: string, keywords: string[]): number | null {
  const lower = text.toLowerCase();
  for (const kw of keywords) {
    const idx = lower.indexOf(kw);
    if (idx === -1) continue;
    const window = text.slice(idx + kw.length, idx + kw.length + 140);

    const candidates: Candidate[] = [];
    for (const m of window.matchAll(AMOUNT_RE)) {
      const raw = m[0];
      const value = parseAmount(raw);
      if (value === null) continue;
      const hasDecimal = looksLikeDecimal(raw);
      if (!hasDecimal && value >= 2019 && value <= 2030 && Number.isInteger(value)) continue;
      candidates.push({ value, hasDecimal, offset: m.index ?? 0 });
    }
    if (candidates.length === 0) continue;

    const withDecimal = candidates.filter((c) => c.hasDecimal);
    const pool = withDecimal.length > 0 ? withDecimal : candidates;
    pool.sort((a, b) => a.offset - b.offset);
    return pool[0].value;
  }
  return null;
}

export interface ParseResult {
  fields: ParsedField[];
  data: LohnsteuerData;
  /** True if essentially nothing was recognised. */
  empty: boolean;
}

/** Apply the rules to extracted text and return both fields and a data object. */
export function parseLohnsteuer(text: string, source: 'pdf' | 'ocr'): ParseResult {
  const baseConfidence = source === 'pdf' ? 'high' : 'medium';
  const fields: ParsedField[] = [];

  let found = 0;
  for (const rule of RULES) {
    const value = findAmountNearKeyword(text, rule.keywords);
    const matched = value !== null;
    if (matched) found++;
    fields.push({
      line: rule.line,
      label: rule.label,
      germanLabel: rule.germanLabel,
      value: value ?? 0,
      confidence: matched ? baseConfidence : 'low',
      used: rule.used,
    });
  }

  return { fields, data: fieldsToData(fields), empty: found === 0 };
}

/** Build an empty field list for fully manual entry. */
export function emptyFields(): ParsedField[] {
  return RULES.map((rule) => ({
    line: rule.line,
    label: rule.label,
    germanLabel: rule.germanLabel,
    value: 0,
    confidence: 'low' as const,
    used: rule.used,
  }));
}

/** Rebuild the field list from stored data (used when resuming a session). */
export function dataToFields(data: LohnsteuerData): ParsedField[] {
  const byLine = lineToKey();
  return RULES.map((rule) => {
    const key = byLine.get(rule.line);
    return {
      line: rule.line,
      label: rule.label,
      germanLabel: rule.germanLabel,
      value: key ? Number(data[key] ?? 0) : 0,
      confidence: 'medium' as const,
      used: rule.used,
    };
  });
}

function lineToKey(): Map<string, keyof LohnsteuerData> {
  const m = new Map<string, keyof LohnsteuerData>();
  for (const r of RULES) if (r.key) m.set(r.line, r.key);
  return m;
}

export function fieldsToData(fields: ParsedField[]): LohnsteuerData {
  const byLine = new Map(fields.map((f) => [f.line, f.value]));
  const get = (line: string) => byLine.get(line) ?? 0;
  return {
    grossSalary: get('3'),
    incomeTaxWithheld: get('4'),
    soliWithheld: get('5'),
    churchTaxWithheld: get('6'),
    pensionEmployer: get('22a'),
    pensionEmployee: get('23a'),
    healthInsuranceEmployee: get('25'),
    careInsuranceEmployee: get('26'),
    unemploymentInsuranceEmployee: get('27'),
  };
}

export { USED_LINES };
