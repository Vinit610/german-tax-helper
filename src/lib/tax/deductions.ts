// Deduction calculations and the official lump sums (Pauschbeträge) for 2025.
//
// Each function returns a structured breakdown so the results screen can show a
// plain-English explanation of every euro. Simplified for the MVP — see the
// disclaimers in the UI.

import type { Deductions, LohnsteuerData } from '../../types';
import { ELSTER_DEDUCTION, ELSTER_LSTB, type ElsterRef } from './elster';

// --- Official 2025 lump sums & caps -----------------------------------------

/** Arbeitnehmer-Pauschbetrag (employee lump sum for Werbungskosten), 2025. */
export const ARBEITNEHMER_PAUSCHBETRAG = 1230;
/** Sonderausgaben-Pauschbetrag (single / joint). */
export const SONDERAUSGABEN_PAUSCHBETRAG_SINGLE = 36;
export const SONDERAUSGABEN_PAUSCHBETRAG_JOINT = 72;
/** Entfernungspauschale rates: first 20 km vs. from the 21st km. */
export const COMMUTE_RATE_NEAR = 0.3;
export const COMMUTE_RATE_FAR = 0.38;
export const COMMUTE_NEAR_KM = 20;
/** Homeoffice-Pauschale: €6/day, capped at 210 days (= €1,260). */
export const HOME_OFFICE_RATE = 6;
export const HOME_OFFICE_MAX_DAYS = 210;
/** Höchstbetrag for Altersvorsorge (pension) special expenses, 2025, single. */
export const PENSION_CAP_SINGLE = 29344;
/** Cap for "other" provision expenses (sonstige Vorsorgeaufwendungen), employee. */
export const SONSTIGE_VORSORGE_CAP = 1900;

export interface LineItem {
  label: string;
  germanLabel: string;
  amount: number;
  note?: string;
  /** Where to enter this value when filing on ELSTER. */
  elster?: ElsterRef;
}

export interface WerbungskostenResult {
  items: LineItem[];
  /** Sum of actual expenses. */
  actual: number;
  /** The figure actually applied = max(actual, Arbeitnehmer-Pauschbetrag). */
  applied: number;
  usedPauschbetrag: boolean;
}

/** Entfernungspauschale: distance lump sum based on one-way km × work days. */
export function commuteAllowance(oneWayKm: number, days: number): number {
  if (oneWayKm <= 0 || days <= 0) return 0;
  const near = Math.min(oneWayKm, COMMUTE_NEAR_KM) * COMMUTE_RATE_NEAR;
  const far = Math.max(0, oneWayKm - COMMUTE_NEAR_KM) * COMMUTE_RATE_FAR;
  return Math.round((near + far) * days * 100) / 100;
}

export function homeOfficeAllowance(days: number): number {
  const capped = Math.min(Math.max(0, days), HOME_OFFICE_MAX_DAYS);
  return capped * HOME_OFFICE_RATE;
}

/** Werbungskosten (income-related expenses) → Anlage N. */
export function computeWerbungskosten(d: Deductions): WerbungskostenResult {
  const commute = commuteAllowance(d.commuteOneWayKm, d.commuteDays);
  const homeOffice = homeOfficeAllowance(d.homeOfficeDays);
  const items: LineItem[] = [
    {
      label: 'Commute allowance',
      germanLabel: 'Entfernungspauschale',
      amount: commute,
      note: `${d.commuteOneWayKm} km one-way × ${d.commuteDays} days`,
      elster: ELSTER_DEDUCTION.commute,
    },
    {
      label: 'Home-office flat rate',
      germanLabel: 'Homeoffice-Pauschale',
      amount: homeOffice,
      note: `${Math.min(d.homeOfficeDays, HOME_OFFICE_MAX_DAYS)} days × €6`,
      elster: ELSTER_DEDUCTION.homeOffice,
    },
    { label: 'Work equipment', germanLabel: 'Arbeitsmittel', amount: d.workEquipment, elster: ELSTER_DEDUCTION.equipment },
    { label: 'Other work costs', germanLabel: 'Sonstige Werbungskosten', amount: d.otherWorkCosts, elster: ELSTER_DEDUCTION.otherWork },
  ];
  const actual = items.reduce((s, i) => s + i.amount, 0);
  const applied = Math.max(actual, ARBEITNEHMER_PAUSCHBETRAG);
  return { items, actual, applied, usedPauschbetrag: applied === ARBEITNEHMER_PAUSCHBETRAG && actual < ARBEITNEHMER_PAUSCHBETRAG };
}

export interface VorsorgeResult {
  items: LineItem[];
  /** Pension (Altersvorsorge) deductible portion. */
  pension: number;
  /** Basic health + care, fully deductible (Basisvorsorge). */
  basisHealthCare: number;
  /** Other provision expenses within the remaining cap. */
  otherProvision: number;
  total: number;
}

/**
 * Vorsorgeaufwand (provision expenses) → Anlage Vorsorgeaufwand.
 *
 * Simplified model:
 *  - Pension: since 2023, contributions are 100% deductible up to the cap. The
 *    employer share is added then subtracted again, so the net deductible is
 *    essentially the employee share (when below the cap).
 *  - Basic health (×0.96 for the statutory sick-pay component) + care insurance
 *    are always fully deductible.
 *  - Unemployment + other private insurance count only within the €1,900 cap,
 *    which is usually already exhausted by health+care — so often €0 extra.
 */
export function computeVorsorge(l: LohnsteuerData, d: Deductions, joint: boolean): VorsorgeResult {
  const pensionCap = joint ? PENSION_CAP_SINGLE * 2 : PENSION_CAP_SINGLE;
  const pensionContributions = l.pensionEmployee + l.pensionEmployer;
  const pension = Math.max(0, Math.min(pensionContributions, pensionCap) - l.pensionEmployer);

  const basisHealthCare = Math.round((l.healthInsuranceEmployee * 0.96 + l.careInsuranceEmployee) * 100) / 100;

  const cap = joint ? SONSTIGE_VORSORGE_CAP * 2 : SONSTIGE_VORSORGE_CAP;
  const remaining = Math.max(0, cap - basisHealthCare);
  const otherProvision = Math.min(l.unemploymentInsuranceEmployee + d.otherInsurance, remaining);

  const items: LineItem[] = [
    {
      label: 'Statutory pension (deductible share)',
      germanLabel: 'Altersvorsorge (Rentenversicherung)',
      amount: pension,
      elster: ELSTER_LSTB['23a'],
    },
    {
      label: 'Health + long-term care (basic)',
      germanLabel: 'Basis-Kranken- und Pflegeversicherung',
      amount: basisHealthCare,
      elster: ELSTER_LSTB['25'],
    },
    {
      label: 'Other insurance (within cap)',
      germanLabel: 'Sonstige Vorsorgeaufwendungen',
      amount: otherProvision,
      elster: ELSTER_DEDUCTION.otherInsurance,
    },
  ];
  const total = pension + basisHealthCare + otherProvision;
  return { items, pension, basisHealthCare, otherProvision, total };
}

/** Sonderausgaben beyond Vorsorge (donations etc.). */
export function computeOtherSonderausgaben(d: Deductions, joint: boolean): { donations: number; pauschbetrag: number; applied: number } {
  const pauschbetrag = joint ? SONDERAUSGABEN_PAUSCHBETRAG_JOINT : SONDERAUSGABEN_PAUSCHBETRAG_SINGLE;
  const donations = Math.max(0, d.donations);
  // The €36/€72 lump sum applies if actual donations are lower.
  const applied = Math.max(donations, pauschbetrag);
  return { donations, pauschbetrag, applied };
}
