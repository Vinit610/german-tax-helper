// Capital income (Anlage KAP) and foreign / equity-compensation income (Anlage
// AUS) with India–Germany double-taxation relief (foreign-tax credit).
//
// Simplified educational model:
//  - Capital income is taxed at the flat 25% Abgeltungsteuer after the
//    Sparer-Pauschbetrag, plus Soli (and church tax if a member). Foreign
//    withholding tax (Quellensteuer) is credited up to that 25%.
//  - GSU/RSU & other foreign employment income is taxed at the normal rate; the
//    foreign tax paid is credited against German tax on that income, capped at
//    the German tax attributable to it (§34c Höchstbetrag / DBA Anrechnung).

import type { CapitalForeign, ChurchTaxRate } from '../../types';

export const SPARER_PAUSCHBETRAG_SINGLE = 1000;
export const SPARER_PAUSCHBETRAG_JOINT = 2000;
export const ABGELTUNGSTEUER_RATE = 0.25;

export interface CapitalResult {
  pauschbetrag: number;
  taxableCapital: number;
  abgeltungsteuer: number;
  foreignCredit: number;
  incomeTax: number;
  soli: number;
  churchTax: number;
  liability: number;
  withheld: number;
  refund: number;
}

/** Anlage KAP — flat 25% Abgeltungsteuer with Sparer-Pauschbetrag & foreign credit. */
export function computeCapital(cf: CapitalForeign, joint: boolean, churchRate: ChurchTaxRate): CapitalResult {
  const pauschbetrag = joint ? SPARER_PAUSCHBETRAG_JOINT : SPARER_PAUSCHBETRAG_SINGLE;
  const taxableCapital = Math.max(0, cf.investmentIncome - pauschbetrag);
  const abgeltungsteuer = Math.round(ABGELTUNGSTEUER_RATE * taxableCapital * 100) / 100;
  // Foreign withholding tax credited up to the German tax on that income.
  const foreignCredit = Math.min(Math.max(0, cf.foreignWithholdingTax), abgeltungsteuer);
  const incomeTax = Math.max(0, Math.round((abgeltungsteuer - foreignCredit) * 100) / 100);
  // Soli on Abgeltungsteuer has no Freigrenze (always 5.5%); church tax by rate.
  const soli = Math.round(0.055 * incomeTax * 100) / 100;
  const churchTax = Math.round(churchRate * incomeTax * 100) / 100;
  const liability = Math.round((incomeTax + soli + churchTax) * 100) / 100;
  const withheld = Math.max(0, cf.capitalTaxWithheld);
  const refund = Math.round((withheld - liability) * 100) / 100;
  return { pauschbetrag, taxableCapital, abgeltungsteuer, foreignCredit, incomeTax, soli, churchTax, liability, withheld, refund };
}

/**
 * Foreign-tax credit on GSU / foreign employment income (Anlage AUS, §34c).
 * Capped at the German income tax attributable to that income.
 */
export function foreignEmploymentCredit(
  foreignTaxPaid: number,
  gsuIncome: number,
  totalIncomeTax: number,
  taxableIncome: number,
): number {
  if (foreignTaxPaid <= 0 || gsuIncome <= 0 || taxableIncome <= 0) return 0;
  const hoechstbetrag = (totalIncomeTax * gsuIncome) / taxableIncome;
  return Math.round(Math.min(foreignTaxPaid, hoechstbetrag) * 100) / 100;
}
