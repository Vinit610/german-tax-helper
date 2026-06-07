// App shell: header, educational disclaimer, the guided 4-step flow, and the
// privacy/"delete my data" footer.

import { useState } from 'react';
import { Stepper, type Step } from './components/Stepper';
import { ProfileStep } from './features/ProfileStep';
import { UploadStep } from './features/UploadStep';
import { DeductionsStep } from './features/DeductionsStep';
import { ResultsStep } from './features/ResultsStep';
import { useStore } from './state/store';

const STEPS: Step[] = [
  { id: 'profile', label: 'Profile' },
  { id: 'upload', label: 'Wage statement' },
  { id: 'deductions', label: 'Deductions' },
  { id: 'results', label: 'Estimate' },
];

export default function App() {
  const { state, setStep, deleteAllData } = useStore();
  const [showDisclaimer, setShowDisclaimer] = useState(true);
  const current = STEPS.some((s) => s.id === state.lastStep) ? state.lastStep : 'profile';

  // A step is reachable once the prerequisite data exists.
  const reachable = new Set<string>(['profile', 'upload']);
  if (state.lohnsteuer) {
    reachable.add('deductions');
    reachable.add('results');
  }

  const go = (id: string) => setStep(id);

  function confirmDelete() {
    if (
      window.confirm(
        'Delete all locally stored data (profile, wage figures, deductions)? This cannot be undone.',
      )
    ) {
      deleteAllData();
      setStep('profile');
    }
  }

  return (
    <div className="min-h-full">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-4">
          <div>
            <h1 className="flex items-center gap-2 text-lg font-bold">
              <span className="inline-block h-5 w-5 rounded bg-gradient-to-b from-black via-rose-600 to-amber-400" />
              German Tax Helper
            </h1>
            <p className="text-xs text-slate-500">Steuererklärung 2025, in plain English</p>
          </div>
          <button
            onClick={confirmDelete}
            className="text-xs font-medium text-slate-400 hover:text-rose-600"
            title="Delete all locally stored data"
          >
            Delete my data
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-3xl space-y-6 px-4 py-6">
        {showDisclaimer && (
          <div className="flex items-start justify-between gap-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            <p>
              <strong>Educational tool, not tax advice.</strong> This gives a simplified estimate to
              help you understand your German tax return. Everything runs in your browser — your
              documents never leave your device. For binding figures, consult a Steuerberater or use{' '}
              <a className="underline" href="https://www.elster.de" target="_blank" rel="noreferrer">
                ELSTER
              </a>
              .
            </p>
            <button
              onClick={() => setShowDisclaimer(false)}
              className="shrink-0 text-amber-500 hover:text-amber-700"
              aria-label="Dismiss"
            >
              ✕
            </button>
          </div>
        )}

        <Stepper steps={STEPS} current={current} reachable={reachable} onJump={go} />

        {current === 'profile' && <ProfileStep onNext={() => go('upload')} />}
        {current === 'upload' && <UploadStep onNext={() => go('deductions')} onBack={() => go('profile')} />}
        {current === 'deductions' && (
          <DeductionsStep onNext={() => go('results')} onBack={() => go('upload')} />
        )}
        {current === 'results' && <ResultsStep onBack={() => go('deductions')} />}
      </main>

      <footer className="mx-auto max-w-3xl px-4 py-8 text-center text-xs text-slate-400">
        <p>
          No accounts · No backend · Data stored only in your browser (localStorage). Tax year{' '}
          {state.taxYear}.
        </p>
      </footer>
    </div>
  );
}
