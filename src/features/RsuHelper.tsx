// RSU/ESPP grant→vest allocation helper. Add each vesting tranche; the tool
// splits each vest into a German-source share (German workdays in the grant→vest
// window) and a treaty-relieved foreign share, and flows the current tax year's
// tranches into the estimate. All tranches are kept as a multi-year record.

import { computeRsu } from '../lib/tax/rsu';
import { formatEur, formatPct } from '../lib/format';
import { useStore } from '../state/store';
import type { RsuTranche } from '../types';

function newId(): string {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `t${Date.now()}${Math.random().toString(36).slice(2, 7)}`;
}

export function RsuHelper() {
  const { state, addRsuTranche, updateRsuTranche, removeRsuTranche, setCapital } = useStore();
  const tranches = state.rsuTranches;
  const relief = state.capitalForeign.rsuReliefMethod;
  const comp = computeRsu(tranches, state.taxYear, relief);

  function add() {
    const t: RsuTranche = {
      id: newId(),
      label: `Tranche ${tranches.length + 1}`,
      vestDate: `${state.taxYear}-01-01`,
      vestValue: 0,
      germanWorkdays: 0,
      totalWorkdays: 0,
      onCertificate: true,
      indianTaxPaid: 0,
    };
    addRsuTranche(t);
  }

  return (
    <section className="space-y-4">
      <div>
        <h3 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-slate-500">
          RSU / ESPP allocation helper <span className="font-normal normal-case text-slate-400">· grant → vest</span>
        </h3>
        <p className="mt-1 text-xs text-slate-500">
          Add each vesting tranche. We split every vest by where you worked during its grant→vest
          window: the German-workday share is taxed here; the rest is relieved under the treaty. Only
          tranches vesting in {state.taxYear} affect this year’s estimate.
        </p>
      </div>

      <div>
        <span className="label">Treaty relief method · Anrechnung vs. Freistellung</span>
        <div className="grid gap-3 sm:grid-cols-2">
          {(
            [
              { v: 'exemption', t: 'Exemption (Progressionsvorbehalt)', d: 'Foreign share is tax-free in Germany but raises your rate. Usual treatment for employment income — needs proof it was taxed in India.' },
              { v: 'credit', t: 'Credit (Anrechnung)', d: 'Foreign share stays German-taxable; Indian tax is credited up to the German tax on it. Use if exemption is denied.' },
            ] as const
          ).map((opt) => (
            <button
              key={opt.v}
              type="button"
              onClick={() => setCapital({ rsuReliefMethod: opt.v })}
              className={[
                'rounded-xl border p-3 text-left text-sm transition',
                relief === opt.v ? 'border-brand-500 bg-brand-50 ring-2 ring-brand-100' : 'border-slate-200 hover:border-slate-300',
              ].join(' ')}
            >
              <div className="font-medium">{opt.t}</div>
              <div className="mt-1 text-xs text-slate-500">{opt.d}</div>
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-4">
        {comp.perTranche.map((line, i) => {
          const t = tranches[i];
          return (
            <div
              key={t.id}
              className={[
                'rounded-xl border p-4',
                line.inTaxYear ? 'border-brand-200 bg-brand-50/30' : 'border-slate-200 bg-slate-50/50',
              ].join(' ')}
            >
              <div className="mb-3 flex items-center justify-between gap-2">
                <input
                  className="input max-w-xs"
                  value={t.label}
                  onChange={(e) => updateRsuTranche(t.id, { label: e.target.value })}
                />
                <button className="text-xs text-slate-400 hover:text-rose-600" onClick={() => removeRsuTranche(t.id)}>
                  Remove
                </button>
              </div>

              <div className="grid gap-3 sm:grid-cols-3">
                <label className="block text-sm">
                  <span className="mb-1 block text-xs font-medium text-slate-600">Vest date</span>
                  <input
                    type="date"
                    className="input"
                    value={t.vestDate}
                    onChange={(e) => updateRsuTranche(t.id, { vestDate: e.target.value })}
                  />
                </label>
                <NumCell label="Value at vest (€)" value={t.vestValue} onChange={(v) => updateRsuTranche(t.id, { vestValue: v })} />
                <NumCell label="Indian tax paid (€)" value={t.indianTaxPaid} onChange={(v) => updateRsuTranche(t.id, { indianTaxPaid: v })} />
                <NumCell label="German workdays (window)" value={t.germanWorkdays} onChange={(v) => updateRsuTranche(t.id, { germanWorkdays: v })} />
                <NumCell label="Total workdays (window)" value={t.totalWorkdays} onChange={(v) => updateRsuTranche(t.id, { totalWorkdays: v })} />
                <label className="flex items-end gap-2 pb-2 text-sm">
                  <input
                    type="checkbox"
                    className="h-4 w-4 rounded border-slate-300"
                    checked={t.onCertificate}
                    onChange={(e) => updateRsuTranche(t.id, { onCertificate: e.target.checked })}
                  />
                  Already on my wage statement
                </label>
              </div>

              <div className="mt-3 flex flex-wrap gap-x-6 gap-y-1 border-t border-slate-200 pt-2 text-xs text-slate-600">
                <span>German share: <strong>{formatPct(line.germanShare * 100)}</strong></span>
                <span>German-taxable: <strong>{formatEur(line.germanTaxable)}</strong></span>
                <span>Treaty-relieved: <strong>{formatEur(line.foreignPortion)}</strong></span>
                <span className={line.inTaxYear ? 'text-brand-700' : 'text-slate-400'}>
                  {line.inTaxYear ? `in ${state.taxYear} return` : `vests ${new Date(line.vestDate).getFullYear()} — other year`}
                </span>
              </div>
            </div>
          );
        })}

        <button className="btn-ghost w-full" onClick={add}>
          + Add a vesting tranche
        </button>
      </div>

      {comp.perTranche.some((l) => l.inTaxYear) && (
        <div className="rounded-lg bg-slate-50 px-4 py-3 text-sm text-slate-600">
          For {state.taxYear}: <strong>{formatEur(comp.addedToTaxable)}</strong> added as German-taxable,{' '}
          <strong>{formatEur(comp.exemptSubtractOnCert + comp.exemptProgression)}</strong> treaty-relieved
          {relief === 'credit' && comp.indianTaxPaid > 0 && <> , <strong>{formatEur(comp.indianTaxPaid)}</strong> Indian tax credited</>}.
          {' '}These flow into your estimate automatically.
        </div>
      )}
    </section>
  );
}

function NumCell({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <label className="block text-sm">
      <span className="mb-1 block text-xs font-medium text-slate-600">{label}</span>
      <input
        className="input"
        type="number"
        value={value || ''}
        placeholder="0"
        onChange={(e) => {
          const n = Number.parseFloat(e.target.value);
          onChange(Number.isFinite(n) ? n : 0);
        }}
      />
    </label>
  );
}
