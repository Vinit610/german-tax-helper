// localStorage persistence. This is the only place state is stored — there is
// no backend and no account. The "Delete my data" control wipes this key.

import type { AppState } from '../types';
import { TAX_YEAR } from '../types';
import { dataToFields } from './parsing/lohnsteuer';

const STORAGE_KEY = 'german-tax-helper:v1';
// Bumped whenever the persisted shape changes (wage-line set, deduction fields,
// data model). A mismatch resets to defaults so stale state can't hide newly
// parsed lines or crash the UI.
const SCHEMA_VERSION = 3;

export function defaultState(): AppState {
  return {
    schemaVersion: SCHEMA_VERSION,
    taxYear: TAX_YEAR,
    profile: {
      assessmentType: 'single',
      bundesland: 'Berlin',
      churchTaxRate: 0,
      spouseChurchTaxRate: 0,
      children: 0,
    },
    lohnsteuer: null,
    wageLines: null,
    deductions: {
      commuteOneWayKm: 0,
      commuteDays: 0,
      commuteMode: 'car',
      commutePublicCost: 0,
      firstWorkplace: '',
      homeOfficeDays: 0,
      workEquipment: 0,
      unionDues: 0,
      trainingCosts: 0,
      applicationCosts: 0,
      mealAllowance: 0,
      doubleHousehold: 0,
      donations: 0,
      liabilityInsurance: 0,
      accidentInsurance: 0,
      termLifeInsurance: 0,
    },
    capitalForeign: {
      enabled: false,
      investmentIncome: 0,
      capitalTaxWithheld: 0,
      foreignWithholdingTax: 0,
      gsuIncome: 0,
      gsuTreatyExempt: 0,
      gsuForeignTaxPaid: 0,
    },
    followUpDocs: {},
    lastStep: 'profile',
  };
}

export function loadState(): AppState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultState();
    const parsed = JSON.parse(raw) as AppState;
    if (parsed.schemaVersion !== SCHEMA_VERSION) return defaultState();
    // Merge over defaults so newly added fields are always present.
    const base = defaultState();
    const merged: AppState = {
      ...base,
      ...parsed,
      profile: { ...base.profile, ...parsed.profile },
      deductions: { ...base.deductions, ...parsed.deductions },
      capitalForeign: { ...base.capitalForeign, ...parsed.capitalForeign },
    };
    // Migration: older sessions stored only the typed wage data — rebuild the
    // editable line list from it so the review screen shows the values again.
    if (!merged.wageLines && merged.lohnsteuer) {
      merged.wageLines = dataToFields(merged.lohnsteuer);
    }
    return merged;
  } catch {
    return defaultState();
  }
}

export function saveState(state: AppState): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Storage may be unavailable (private mode / quota). Fail silently — the
    // app still works for the current session.
  }
}

export function clearState(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* no-op */
  }
}
