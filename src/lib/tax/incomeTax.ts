// German income-tax tariff for 2025 (§ 32a EStG), plus solidarity surcharge
// (Solidaritätszuschlag) and church tax (Kirchensteuer).
//
// IMPORTANT: This is a simplified educational estimate, not tax advice. The
// official tariff operates on the "zu versteuerndes Einkommen" (zvE, taxable
// income), floored to whole euros; the resulting tax is also floored.

import type { AssessmentType, ChurchTaxRate } from '../../types';

/** 2025 basic tax-free allowance (Grundfreibetrag), single. */
export const GRUNDFREIBETRAG_2025 = 12096;

/**
 * Base income-tax tariff for a single person (Grundtabelle), 2025.
 * Source: § 32a EStG in the version applicable for the 2025 assessment year.
 */
export function einkommensteuerGrundtabelle(zvERaw: number): number {
  const zvE = Math.floor(Math.max(0, zvERaw));

  let tax: number;
  if (zvE <= 12096) {
    tax = 0;
  } else if (zvE <= 17443) {
    const y = (zvE - 12096) / 10000;
    tax = (932.3 * y + 1400) * y;
  } else if (zvE <= 68480) {
    const z = (zvE - 17443) / 10000;
    tax = (176.64 * z + 2397) * z + 1015.13;
  } else if (zvE <= 277825) {
    tax = 0.42 * zvE - 10911.92;
  } else {
    tax = 0.45 * zvE - 19246.67;
  }
  return Math.floor(tax);
}

/**
 * Income tax with assessment type applied. Joint assessment uses the
 * Ehegattensplitting: tax(zvE/2) doubled (Splittingtabelle).
 */
export function einkommensteuer(zvE: number, assessment: AssessmentType): number {
  if (assessment === 'joint') {
    return einkommensteuerGrundtabelle(zvE / 2) * 2;
  }
  return einkommensteuerGrundtabelle(zvE);
}

/**
 * Marginal tax rate at a given taxable income (for plain-English explanations).
 */
export function marginalRate(zvE: number, assessment: AssessmentType): number {
  const base = einkommensteuer(zvE, assessment);
  const bumped = einkommensteuer(zvE + 100, assessment);
  return (bumped - base) / 100;
}

/**
 * Solidarity surcharge (Solidaritätszuschlag), 2025. 5.5% of income tax, but
 * only above a Freigrenze with a phase-in zone (Milderungszone). For the vast
 * majority of salaried employees this is now €0.
 */
export function soli(incomeTax: number, assessment: AssessmentType): number {
  const freigrenze = assessment === 'joint' ? 39900 : 19950;
  if (incomeTax <= freigrenze) return 0;
  const full = 0.055 * incomeTax;
  const milderung = 0.119 * (incomeTax - freigrenze);
  return Math.round(Math.min(full, milderung) * 100) / 100;
}

/** Church tax (Kirchensteuer): rate × income tax. */
export function kirchensteuer(incomeTax: number, rate: ChurchTaxRate): number {
  return Math.round(rate * incomeTax * 100) / 100;
}
