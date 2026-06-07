// Top-level estimate: combine wage data + deductions into taxable income, the
// computed tax liability, and the estimated refund or additional payment.
//
// The output is organised per Anlage (official German form) so users can map
// each value back to ELSTER / the paper forms.

import type { AppState } from '../../types';
import {
  computeOtherSonderausgaben,
  computeVorsorge,
  computeWerbungskosten,
  type LineItem,
  type VorsorgeResult,
  type WerbungskostenResult,
} from './deductions';
import { einkommensteuerGesamt, kirchensteuer, marginalRate, soli } from './incomeTax';
import { ELSTER_DEDUCTION, ELSTER_LSTB } from './elster';

export interface AnlageSection {
  id: string;
  /** Official German form name, e.g. "Anlage N". */
  anlage: string;
  title: string;
  description: string;
  items: LineItem[];
  subtotalLabel: string;
  subtotal: number;
}

export interface EstimateResult {
  /** Per-Anlage breakdown for the UI. */
  sections: AnlageSection[];

  // Headline figures
  grossSalary: number;
  werbungskosten: WerbungskostenResult;
  vorsorge: VorsorgeResult;
  sonderausgaben: { donations: number; pauschbetrag: number; applied: number };

  /** zu versteuerndes Einkommen (taxable income). */
  taxableIncome: number;
  /** Computed income tax (Einkommensteuer). */
  incomeTax: number;
  soli: number;
  churchTax: number;
  /** Total computed liability (tax + soli + church). */
  totalLiability: number;

  /** Withheld on the regular wage (Nr. 4+5+7+8) — basis of the estimate. */
  totalWithheld: number;
  /** Positive = refund expected; negative = additional payment due. */
  refund: number;

  // Special-rate items now folded into the estimate.
  /** Nr. 9/10 — extraordinary income taxed via the Fünftelregelung. */
  specialIncome: number;
  /** Tax withheld on the special block (Nr. 11/12/13). */
  specialTaxWithheld: number;
  /** Nr. 6 — treaty-exempt wage (Progressionsvorbehalt). */
  dbaIncome: number;
  /** Nr. 15 — wage-replacement benefits (Progressionsvorbehalt). */
  lohnReplacement: number;
  /** Tax-free income raising the rate (Nr. 6 + 15). */
  progIncome: number;
  /** Whether the Fünftelregelung / Progressionsvorbehalt affected the result. */
  usesSpecialRates: boolean;

  marginalRatePct: number;
  averageRatePct: number;
}

export function computeEstimate(state: AppState): EstimateResult | null {
  const { lohnsteuer: l, deductions: d, profile: p } = state;
  if (!l) return null;

  const joint = p.assessmentType === 'joint';

  const werbungskosten = computeWerbungskosten(d, l.agCommuteUntaxed);
  const vorsorge = computeVorsorge(l, d, joint);
  const sonderausgaben = computeOtherSonderausgaben(d, joint);

  const taxableIncome = Math.max(
    0,
    l.grossSalary - werbungskosten.applied - vorsorge.total - sonderausgaben.applied,
  );

  // Tax-free income subject to Progressionsvorbehalt (raises the rate): treaty-
  // exempt wages (Nr. 6) + wage-replacement benefits (Nr. 15).
  const progIncome = l.dbaIncome + l.lohnReplacement;
  // Extraordinary income taxed via the Fünftelregelung (Nr. 9/10).
  const extraordinary = l.specialIncome;

  const incomeTax = einkommensteuerGesamt(taxableIncome, extraordinary, progIncome, p.assessmentType);
  const soliAmount = soli(incomeTax, p.assessmentType);
  // Combined church rate for joint members (simplified): both same rate → rate × tax.
  const churchRate = (joint
    ? Math.max(p.churchTaxRate, p.spouseChurchTaxRate)
    : p.churchTaxRate) as typeof p.churchTaxRate;
  const churchTax = kirchensteuer(incomeTax, churchRate);
  const totalLiability = incomeTax + soliAmount + churchTax;

  // All tax withheld across both blocks (regular Nr. 4/5/7/8 + special Nr. 11–14).
  const totalWithheld =
    l.incomeTaxWithheld +
    l.soliWithheld +
    l.churchTaxWithheld +
    l.incomeTaxSpecial +
    l.soliSpecial +
    l.churchTaxSpecial;
  const refund = Math.round((totalWithheld - totalLiability) * 100) / 100;

  const sections: AnlageSection[] = [
    {
      id: 'anlage-n',
      anlage: 'Anlage N',
      title: 'Employment income & work expenses',
      description:
        'Your salary and income-related expenses (Werbungskosten). The €1,230 employee lump sum applies automatically unless your actual expenses are higher.',
      items: [
        {
          label: 'Gross salary',
          germanLabel: 'Bruttoarbeitslohn (Zeile 3)',
          amount: l.grossSalary,
          elster: ELSTER_LSTB['3'],
        },
        ...werbungskosten.items,
        {
          label: werbungskosten.usedPauschbetrag
            ? 'Employee lump sum applied'
            : 'Total work expenses applied',
          germanLabel: werbungskosten.usedPauschbetrag
            ? 'Arbeitnehmer-Pauschbetrag'
            : 'Summe Werbungskosten',
          amount: werbungskosten.applied,
          note: werbungskosten.usedPauschbetrag
            ? 'Your actual expenses were below €1,230, so the lump sum is used.'
            : 'Your actual expenses exceed the €1,230 lump sum.',
        },
      ],
      subtotalLabel: 'Income after work expenses',
      subtotal: Math.max(0, l.grossSalary - werbungskosten.applied),
    },
    {
      id: 'anlage-vorsorge',
      anlage: 'Anlage Vorsorgeaufwand',
      title: 'Pension, health & insurance',
      description:
        'Provision expenses (Vorsorgeaufwendungen): statutory pension plus health and long-term care insurance, which reduce your taxable income.',
      items: vorsorge.items,
      subtotalLabel: 'Total provision expenses',
      subtotal: vorsorge.total,
    },
    {
      id: 'sonderausgaben',
      anlage: 'Anlage Sonderausgaben',
      title: 'Donations & other special expenses',
      description: 'Charitable donations and the standard special-expenses lump sum.',
      items: [
        { label: 'Donations', germanLabel: 'Spenden', amount: sonderausgaben.donations, elster: ELSTER_DEDUCTION.donations },
        {
          label: 'Applied (incl. lump sum)',
          germanLabel: 'Sonderausgaben-Pauschbetrag',
          amount: sonderausgaben.applied,
        },
      ],
      subtotalLabel: 'Special expenses applied',
      subtotal: sonderausgaben.applied,
    },
  ];

  return {
    sections,
    grossSalary: l.grossSalary,
    werbungskosten,
    vorsorge,
    sonderausgaben,
    taxableIncome,
    incomeTax,
    soli: soliAmount,
    churchTax,
    totalLiability,
    totalWithheld,
    refund,
    specialIncome: l.specialIncome,
    specialTaxWithheld: Math.round((l.incomeTaxSpecial + l.soliSpecial + l.churchTaxSpecial) * 100) / 100,
    dbaIncome: l.dbaIncome,
    lohnReplacement: l.lohnReplacement,
    progIncome,
    usesSpecialRates: extraordinary > 0 || progIncome > 0,
    marginalRatePct: Math.round(marginalRate(taxableIncome, p.assessmentType) * 1000) / 10,
    averageRatePct: taxableIncome > 0 ? Math.round((incomeTax / taxableIncome) * 1000) / 10 : 0,
  };
}
