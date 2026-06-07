// localStorage persistence. This is the only place state is stored — there is
// no backend and no account. The "Delete my data" control wipes this key.

import type { AppState } from '../types';
import { TAX_YEAR } from '../types';

const STORAGE_KEY = 'german-tax-helper:v1';
const SCHEMA_VERSION = 1;

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
    deductions: {
      commuteOneWayKm: 0,
      commuteDays: 0,
      homeOfficeDays: 0,
      workEquipment: 0,
      otherWorkCosts: 0,
      donations: 0,
      otherInsurance: 0,
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
    return {
      ...base,
      ...parsed,
      profile: { ...base.profile, ...parsed.profile },
      deductions: { ...base.deductions, ...parsed.deductions },
    };
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
