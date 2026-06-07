// Rules layer: map the Lohnsteuerbescheinigung's numbered lines to our field
// model. The source text comes from pdf.js (preferred) or OCR (fallback), so it
// is noisy — every match carries a confidence level and the user reviews/edits
// each value before anything is used in a calculation.

import type { LohnsteuerData, ParsedField } from '../../types';

/**
 * Parse a German-formatted number into a JS number. Tolerant of the messy text
 * pdf.js / OCR produces: spaced thousands ("45 000,00"), missing decimals
 * ("45.000"), or plain integers ("45000").
 *
 *   "45.000,00" → 45000   "45 000,00" → 45000   "45.000" → 45000
 *   "1.234.567,89" → 1234567.89   "0,00" → 0   "12,5" → 12.5
 */
export function parseGermanNumber(raw: string): number | null {
  let s = raw.replace(/[^\d.,\s-]/g, '').trim();
  if (!s) return null;
  const negative = s.startsWith('-');
  s = s.replace(/\s+/g, '').replace(/-/g, '');

  if (s.includes(',')) {
    // Comma is the decimal separator; dots are thousands separators.
    s = s.replace(/\./g, '').replace(',', '.');
  } else {
    // No comma: dots can only be thousands separators in this context.
    s = s.replace(/\./g, '');
  }

  const n = Number.parseFloat(s);
  if (!Number.isFinite(n)) return null;
  return negative ? -n : n;
}

interface FieldRule {
  key: keyof LohnsteuerData;
  line: string;
  label: string;
  germanLabel: string;
  /** Keywords (lowercased) that anchor the value on the form. */
  keywords: string[];
}

// Ordered by line number on the elektronische Lohnsteuerbescheinigung 2025.
const RULES: FieldRule[] = [
  { key: 'grossSalary', line: '3', label: 'Gross salary', germanLabel: 'Bruttoarbeitslohn', keywords: ['bruttoarbeitslohn'] },
  { key: 'incomeTaxWithheld', line: '4', label: 'Income tax withheld', germanLabel: 'Einbehaltene Lohnsteuer', keywords: ['einbehaltene lohnsteuer'] },
  { key: 'soliWithheld', line: '5', label: 'Solidarity surcharge withheld', germanLabel: 'Solidaritätszuschlag', keywords: ['solidaritätszuschlag', 'solidaritatszuschlag'] },
  { key: 'churchTaxWithheld', line: '6', label: 'Church tax withheld', germanLabel: 'Kirchensteuer', keywords: ['kirchensteuer'] },
  { key: 'pensionEmployer', line: '22a', label: 'Pension (employer share)', germanLabel: 'Arbeitgeberanteil Rentenversicherung', keywords: ['arbeitgeberanteil'] },
  { key: 'pensionEmployee', line: '23a', label: 'Pension (employee share)', germanLabel: 'Arbeitnehmeranteil Rentenversicherung', keywords: ['arbeitnehmeranteil'] },
  { key: 'healthInsuranceEmployee', line: '25', label: 'Health insurance (employee)', germanLabel: 'Beiträge gesetzliche Krankenversicherung', keywords: ['krankenversicherung'] },
  { key: 'careInsuranceEmployee', line: '26', label: 'Long-term care insurance (employee)', germanLabel: 'Soziale Pflegeversicherung', keywords: ['pflegeversicherung'] },
  { key: 'unemploymentInsuranceEmployee', line: '27', label: 'Unemployment insurance (employee)', germanLabel: 'Arbeitslosenversicherung', keywords: ['arbeitslosenversicherung'] },
];

// Matches money amounts in the many shapes pdf.js / OCR emit. The first
// alternative covers grouped thousands with optional spaces ("45.000,00",
// "45 000", "1.234.567,89"); the second covers plain numbers with a decimal
// comma ("450,00"); the third covers bare integers of 3+ digits ("45000"),
// which keeps us from grabbing a stray line number like "3" or "22".
const AMOUNT_RE = /\d{1,3}(?:[.\s]\d{3})+(?:,\d{1,2})?|\d+,\d{1,2}|\d{3,}/g;

interface Candidate {
  value: number;
  /** Real currency amounts carry a decimal comma — preferred over bare ints. */
  hasDecimal: boolean;
  /** Distance from the keyword; nearer is better. */
  offset: number;
}

/**
 * Collect amount candidates in a window after a keyword and pick the best one.
 * We prefer the nearest value that is formatted like real money (has a decimal
 * comma); otherwise we fall back to the nearest plausible integer. Values that
 * look like the tax year (2019–2030) are skipped to avoid matching dates.
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
      const value = parseGermanNumber(raw);
      if (value === null) continue;
      const hasDecimal = raw.includes(',');
      // Skip bare year-like integers (no decimal, looks like a date part).
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
  const data: LohnsteuerData = {
    grossSalary: 0,
    incomeTaxWithheld: 0,
    soliWithheld: 0,
    churchTaxWithheld: 0,
    pensionEmployee: 0,
    pensionEmployer: 0,
    healthInsuranceEmployee: 0,
    careInsuranceEmployee: 0,
    unemploymentInsuranceEmployee: 0,
  };

  let found = 0;
  for (const rule of RULES) {
    const value = findAmountNearKeyword(text, rule.keywords);
    const matched = value !== null;
    if (matched) found++;
    data[rule.key] = (value ?? 0) as never;
    fields.push({
      line: rule.line,
      label: rule.label,
      germanLabel: rule.germanLabel,
      value: value ?? 0,
      confidence: matched ? baseConfidence : 'low',
    });
  }

  return { fields, data, empty: found === 0 };
}

/** Build an empty field list for fully manual entry. */
export function emptyFields(): ParsedField[] {
  return RULES.map((rule) => ({
    line: rule.line,
    label: rule.label,
    germanLabel: rule.germanLabel,
    value: 0,
    confidence: 'low' as const,
  }));
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
