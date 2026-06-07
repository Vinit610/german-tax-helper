// Step 1 — Personal profile: assessment type, federal state, church tax, children.

import { AnlageBadge } from '../components/AnlageBadge';
import { useStore } from '../state/store';
import type { ChurchTaxRate } from '../types';

// 8% church tax in Bavaria & Baden-Württemberg, 9% elsewhere.
const BUNDESLAENDER: { name: string; rate: Exclude<ChurchTaxRate, 0> }[] = [
  { name: 'Baden-Württemberg', rate: 0.08 },
  { name: 'Bayern', rate: 0.08 },
  { name: 'Berlin', rate: 0.09 },
  { name: 'Brandenburg', rate: 0.09 },
  { name: 'Bremen', rate: 0.09 },
  { name: 'Hamburg', rate: 0.09 },
  { name: 'Hessen', rate: 0.09 },
  { name: 'Mecklenburg-Vorpommern', rate: 0.09 },
  { name: 'Niedersachsen', rate: 0.09 },
  { name: 'Nordrhein-Westfalen', rate: 0.09 },
  { name: 'Rheinland-Pfalz', rate: 0.09 },
  { name: 'Saarland', rate: 0.09 },
  { name: 'Sachsen', rate: 0.09 },
  { name: 'Sachsen-Anhalt', rate: 0.09 },
  { name: 'Schleswig-Holstein', rate: 0.09 },
  { name: 'Thüringen', rate: 0.09 },
];

export function ProfileStep({ onNext }: { onNext: () => void }) {
  const { state, setProfile } = useStore();
  const p = state.profile;

  const stateRate = BUNDESLAENDER.find((b) => b.name === p.bundesland)?.rate ?? 0.09;

  return (
    <div className="card space-y-6">
      <header className="space-y-1">
        <div className="flex items-center gap-2">
          <h2 className="text-lg font-semibold">Your profile</h2>
          <AnlageBadge name="Hauptvordruck ESt 1 A" />
        </div>
        <p className="text-sm text-slate-500">
          A few basics about your situation for the 2025 tax year. This shapes which forms apply.
        </p>
      </header>

      <div>
        <span className="label">Assessment type · Veranlagungsart</span>
        <div className="grid gap-3 sm:grid-cols-2">
          {(
            [
              { v: 'single', t: 'Single assessment', d: 'Einzelveranlagung — filing on your own.' },
              { v: 'joint', t: 'Joint assessment', d: 'Zusammenveranlagung — married/partnered, filing together (spouse splitting).' },
            ] as const
          ).map((opt) => (
            <button
              key={opt.v}
              type="button"
              onClick={() => setProfile({ assessmentType: opt.v })}
              className={[
                'rounded-xl border p-4 text-left transition',
                p.assessmentType === opt.v
                  ? 'border-brand-500 bg-brand-50 ring-2 ring-brand-100'
                  : 'border-slate-200 hover:border-slate-300',
              ].join(' ')}
            >
              <div className="font-medium">{opt.t}</div>
              <div className="mt-1 text-xs text-slate-500">{opt.d}</div>
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block">
          <span className="label">Federal state · Bundesland</span>
          <select
            className="input"
            value={p.bundesland}
            onChange={(e) => {
              const name = e.target.value;
              const rate = BUNDESLAENDER.find((b) => b.name === name)?.rate ?? 0.09;
              // If currently a church member, keep them a member at the new state's rate.
              setProfile({
                bundesland: name,
                churchTaxRate: p.churchTaxRate ? rate : 0,
                spouseChurchTaxRate: p.spouseChurchTaxRate ? rate : 0,
              });
            }}
          >
            {BUNDESLAENDER.map((b) => (
              <option key={b.name} value={b.name}>
                {b.name} ({Math.round(b.rate * 100)}%)
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="label">Children · Kinder</span>
          <input
            className="input"
            type="number"
            min={0}
            value={p.children}
            onChange={(e) => setProfile({ children: Math.max(0, Number.parseInt(e.target.value || '0', 10)) })}
          />
        </label>
      </div>

      <div className="space-y-3">
        <span className="label">Church membership · Kirchensteuer</span>
        <label className="flex items-center gap-3 text-sm">
          <input
            type="checkbox"
            className="h-4 w-4 rounded border-slate-300"
            checked={p.churchTaxRate > 0}
            onChange={(e) => setProfile({ churchTaxRate: e.target.checked ? stateRate : 0 })}
          />
          I pay church tax{p.churchTaxRate > 0 ? ` (${Math.round(stateRate * 100)}%)` : ''}
        </label>
        {p.assessmentType === 'joint' && (
          <label className="flex items-center gap-3 text-sm">
            <input
              type="checkbox"
              className="h-4 w-4 rounded border-slate-300"
              checked={p.spouseChurchTaxRate > 0}
              onChange={(e) => setProfile({ spouseChurchTaxRate: e.target.checked ? stateRate : 0 })}
            />
            My spouse pays church tax
          </label>
        )}
      </div>

      {p.children > 0 && (
        <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
          Note: child allowances (Kinderfreibetrag) and child benefit (Kindergeld) are handled on
          <strong> Anlage Kind</strong>. The MVP estimate does not yet model these — coming in a later phase.
        </p>
      )}

      <div className="flex justify-end">
        <button className="btn-primary" onClick={onNext}>
          Continue →
        </button>
      </div>
    </div>
  );
}
