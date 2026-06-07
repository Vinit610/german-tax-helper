// Detects data the official forms need that the wage certificate doesn't supply,
// so the tool can prompt the user instead of silently filing an incomplete form.

import type { AppState } from '../../types';

export interface MissingItem {
  /** Form the gap relates to. */
  form: string;
  title: string;
  detail: string;
  /** Step id to jump to so the user can fix it. */
  step: 'profile' | 'upload' | 'deductions';
  severity: 'warn' | 'info';
}

export function findMissing(state: AppState): MissingItem[] {
  const out: MissingItem[] = [];
  const { lohnsteuer: l, deductions: d, profile: p } = state;
  if (!l) return out;

  // --- Anlage Vorsorgeaufwand needs the social-insurance figures ---
  if (l.healthInsuranceEmployee === 0) {
    out.push({
      form: 'Anlage Vorsorgeaufwand',
      title: 'Health-insurance contribution missing',
      detail:
        'No health insurance (Nr. 25) was captured. This is one of the largest deductions for employees — check Nr. 25 on your wage statement or your insurer’s annual statement.',
      step: 'upload',
      severity: 'warn',
    });
  }
  if (l.pensionEmployee === 0) {
    out.push({
      form: 'Anlage Vorsorgeaufwand',
      title: 'Pension contribution missing',
      detail: 'No employee pension contribution (Nr. 23a) was captured. Verify Nr. 23a on your statement.',
      step: 'upload',
      severity: 'warn',
    });
  }

  // --- Church-tax consistency between profile and statement ---
  if (l.churchTaxWithheld > 0 && p.churchTaxRate === 0) {
    out.push({
      form: 'Anlage N',
      title: 'Church tax was withheld but you’re marked as not a member',
      detail:
        'Your statement shows church tax (Nr. 6), but your profile has no church membership. Update your profile so the calculation matches.',
      step: 'profile',
      severity: 'warn',
    });
  }

  // --- Anlage N: encourage the common Werbungskosten ---
  if (d.commuteDays === 0 && d.homeOfficeDays === 0) {
    out.push({
      form: 'Anlage N',
      title: 'No commute or home-office days entered',
      detail:
        'Almost every employee can claim either a commute (Entfernungspauschale) or home-office days. Add them to likely increase your refund.',
      step: 'deductions',
      severity: 'info',
    });
  }
  if (d.commuteDays > 0 && d.commuteOneWayKm === 0) {
    out.push({
      form: 'Anlage N',
      title: 'Commute days set, but distance is 0 km',
      detail: 'Enter the one-way distance to your first place of work so the Entfernungspauschale can be calculated.',
      step: 'deductions',
      severity: 'warn',
    });
  }
  if ((d.commuteDays > 0 || d.commutePublicCost > 0) && !d.firstWorkplace.trim()) {
    out.push({
      form: 'Anlage N',
      title: 'First place of work not entered',
      detail: 'Anlage N asks for the address of your first place of work (Erste Tätigkeitsstätte) alongside the commute.',
      step: 'deductions',
      severity: 'info',
    });
  }

  return out;
}
