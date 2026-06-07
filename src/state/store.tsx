// App state container: a small Context + reducer, auto-persisted to localStorage.
// Kept dependency-free on purpose (no external state library) — the state is
// simple and fully client-side.

import { createContext, useContext, useEffect, useMemo, useReducer, type ReactNode } from 'react';
import type { AppState, CapitalForeign, Deductions, LohnsteuerData, ParsedField, PersonalProfile } from '../types';
import { clearState, defaultState, loadState, saveState } from '../lib/storage';
import { fieldsToData } from '../lib/parsing/lohnsteuer';

type Action =
  | { type: 'setProfile'; patch: Partial<PersonalProfile> }
  | { type: 'setLohnsteuer'; data: LohnsteuerData | null }
  | { type: 'setWageLines'; fields: ParsedField[] | null }
  | { type: 'setDeductions'; patch: Partial<Deductions> }
  | { type: 'setCapital'; patch: Partial<CapitalForeign> }
  | { type: 'toggleDoc'; key: string }
  | { type: 'setStep'; step: string }
  | { type: 'reset' };

function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case 'setProfile':
      return { ...state, profile: { ...state.profile, ...action.patch } };
    case 'setLohnsteuer':
      return { ...state, lohnsteuer: action.data };
    case 'setWageLines':
      return {
        ...state,
        wageLines: action.fields,
        lohnsteuer: action.fields ? fieldsToData(action.fields) : null,
      };
    case 'setDeductions':
      return { ...state, deductions: { ...state.deductions, ...action.patch } };
    case 'setCapital':
      return { ...state, capitalForeign: { ...state.capitalForeign, ...action.patch } };
    case 'toggleDoc':
      return {
        ...state,
        followUpDocs: { ...state.followUpDocs, [action.key]: !state.followUpDocs[action.key] },
      };
    case 'setStep':
      return { ...state, lastStep: action.step };
    case 'reset':
      return defaultState();
    default:
      return state;
  }
}

interface StoreValue {
  state: AppState;
  setProfile: (patch: Partial<PersonalProfile>) => void;
  setLohnsteuer: (data: LohnsteuerData | null) => void;
  setWageLines: (fields: ParsedField[] | null) => void;
  setDeductions: (patch: Partial<Deductions>) => void;
  setCapital: (patch: Partial<CapitalForeign>) => void;
  toggleDoc: (key: string) => void;
  setStep: (step: string) => void;
  deleteAllData: () => void;
}

const StoreContext = createContext<StoreValue | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, undefined, loadState);

  useEffect(() => {
    saveState(state);
  }, [state]);

  const value = useMemo<StoreValue>(
    () => ({
      state,
      setProfile: (patch) => dispatch({ type: 'setProfile', patch }),
      setLohnsteuer: (data) => dispatch({ type: 'setLohnsteuer', data }),
      setWageLines: (fields) => dispatch({ type: 'setWageLines', fields }),
      setDeductions: (patch) => dispatch({ type: 'setDeductions', patch }),
      setCapital: (patch) => dispatch({ type: 'setCapital', patch }),
      toggleDoc: (key) => dispatch({ type: 'toggleDoc', key }),
      setStep: (step) => dispatch({ type: 'setStep', step }),
      deleteAllData: () => {
        clearState();
        dispatch({ type: 'reset' });
      },
    }),
    [state],
  );

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useStore(): StoreValue {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error('useStore must be used within StoreProvider');
  return ctx;
}
