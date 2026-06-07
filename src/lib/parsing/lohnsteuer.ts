// Rules layer: map the Lohnsteuerbescheinigung's numbered lines to our field
// model. The source text comes from pdf.js (preferred) or OCR (fallback), so it
// is noisy — every match carries a confidence level and the user reviews/edits
// each value before anything is used in a calculation.

import type { LohnsteuerData, ParsedField } from '../../types';

/** Parse a German-formatted number ("45.000,00" → 45000). */
export function parseGermanNumber(raw: string): number | null {
  const cleaned = raw
    .replace(/[^0-9.,-]/g, '')
    .replace(/\.(?=\d{3}(\D|$))/g, '') // strip thousands separators
    .replace(',', '.');
  const n = Number.parseFloat(cleaned);
  return Number.isFinite(n) ? n : null;
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

const NUMBER_RE = /-?\d{1,3}(?:\.\d{3})*(?:,\d{2})|-?\d+,\d{2}/g;

/**
 * Find the first plausible amount near a keyword occurrence. We look at a window
 * of text starting at the keyword and take the first German-formatted number.
 */
function findAmountNearKeyword(text: string, keywords: string[]): number | null {
  const lower = text.toLowerCase();
  for (const kw of keywords) {
    const idx = lower.indexOf(kw);
    if (idx === -1) continue;
    const window = text.slice(idx, idx + 120);
    const matches = window.match(NUMBER_RE);
    if (matches && matches.length > 0) {
      const value = parseGermanNumber(matches[0]);
      if (value !== null) return value;
    }
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
