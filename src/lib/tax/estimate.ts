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
import { computeCapital, foreignEmploymentCredit, type CapitalResult } from './capitalForeign';
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

  // Phase 2: capital & foreign income.
  /** Anlage KAP result, when capital income was entered. */
  capital: CapitalResult | null;
  /** GSU/RSU & foreign employment income taxed at the normal rate. */
  gsuIncome: number;
  /** Treaty-exempt GSU portion (Progressionsvorbehalt). */
  gsuTreatyExempt: number;
  /** Foreign-tax credit applied to employment income (Anlage AUS). */
  foreignCredit: number;

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

  const cf = state.capitalForeign;
  const cfOn = cf.enabled;
  // GSU/RSU & other foreign employment income taxed at the normal rate.
  const gsuIncome = cfOn ? Math.max(0, cf.gsuIncome) : 0;

  const taxableIncome = Math.max(
    0,
    l.grossSalary + gsuIncome - werbungskosten.applied - vorsorge.total - sonderausgaben.applied,
  );

  // Tax-free income subject to Progressionsvorbehalt (raises the rate): treaty-
  // exempt wages (Nr. 6) + wage-replacement benefits (Nr. 15) + treaty-exempt GSU.
  const progIncome = l.dbaIncome + l.lohnReplacement + (cfOn ? Math.max(0, cf.gsuTreatyExempt) : 0);
  // Extraordinary income taxed via the Fünftelregelung (Nr. 9/10).
  const extraordinary = l.specialIncome;

  const grossIncomeTax = einkommensteuerGesamt(taxableIncome, extraordinary, progIncome, p.assessmentType);
  // Foreign-tax credit on GSU/foreign employment income (§34c / DBA), capped.
  const foreignCredit = cfOn
    ? foreignEmploymentCredit(cf.gsuForeignTaxPaid, gsuIncome, grossIncomeTax, taxableIncome)
    : 0;
  const incomeTax = Math.max(0, Math.round((grossIncomeTax - foreignCredit) * 100) / 100);

  const soliAmount = soli(incomeTax, p.assessmentType);
  // Combined church rate for joint members (simplified): both same rate → rate × tax.
  const churchRate = (joint
    ? Math.max(p.churchTaxRate, p.spouseChurchTaxRate)
    : p.churchTaxRate) as typeof p.churchTaxRate;
  const churchTax = kirchensteuer(incomeTax, churchRate);

  // Capital income (Anlage KAP) is taxed separately at 25% Abgeltungsteuer.
  const capital: CapitalResult | null = cfOn && cf.investmentIncome > 0 ? computeCapital(cf, joint, churchRate) : null;

  const totalLiability =
    Math.round((incomeTax + soliAmount + churchTax + (capital ? capital.liability : 0)) * 100) / 100;

  // All tax withheld: wage (regular Nr. 4/5/7/8 + special Nr. 11–14) + capital tax.
  const totalWithheld =
    Math.round(
      (l.incomeTaxWithheld +
        l.soliWithheld +
        l.churchTaxWithheld +
        l.incomeTaxSpecial +
        l.soliSpecial +
        l.churchTaxSpecial +
        (capital ? capital.withheld : 0)) *
        100,
    ) / 100;
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
    capital,
    gsuIncome,
    gsuTreatyExempt: cfOn ? Math.max(0, cf.gsuTreatyExempt) : 0,
    foreignCredit,
    marginalRatePct: Math.round(marginalRate(taxableIncome, p.assessmentType) * 1000) / 10,
    averageRatePct: taxableIncome > 0 ? Math.round((incomeTax / taxableIncome) * 1000) / 10 : 0,
  };
}
