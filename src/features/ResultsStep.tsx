// Step 4 — Results: the estimated refund/payment, per-Anlage breakdown, and
// plain-English explanations of how each number was derived.

import { useMemo } from 'react';
import { AnlageBadge } from '../components/AnlageBadge';
import { computeEstimate } from '../lib/tax/estimate';
import { formatEur, formatPct } from '../lib/format';
import { useStore } from '../state/store';

export function ResultsStep({ onBack }: { onBack: () => void }) {
  const { state } = useStore();
  const result = useMemo(() => computeEstimate(state), [state]);

  if (!result) {
    return (
      <div className="card">
        <p className="text-sm text-slate-600">
          No wage data yet. Go back and add your Lohnsteuerbescheinigung first.
        </p>
        <button className="btn-ghost mt-4" onClick={onBack}>
          ← Back
        </button>
      </div>
    );
  }

  const isRefund = result.refund >= 0;

  return (
    <div className="space-y-6">
      {/* Headline */}
      <div
        className={[
          'card border-2',
          isRefund ? 'border-emerald-200 bg-emerald-50/40' : 'border-rose-200 bg-rose-50/40',
        ].join(' ')}
      >
        <p className="text-sm font-medium text-slate-500">
          Estimated {isRefund ? 'refund' : 'additional payment'} for {state.taxYear}
        </p>
        <p className={`mt-1 text-4xl font-bold ${isRefund ? 'text-emerald-700' : 'text-rose-700'}`}>
          {formatEur(Math.abs(result.refund))}
        </p>
        <p className="mt-2 text-sm text-slate-600">
          {isRefund
            ? 'You likely overpaid through payroll and can expect money back.'
            : 'You may owe additional tax. Double-check your figures and deductions.'}
        </p>
        <dl className="mt-4 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
          <Stat label="Taxable income" hint="zu versteuerndes Einkommen" value={formatEur(result.taxableIncome)} />
          <Stat label="Computed tax" hint="Einkommensteuer" value={formatEur(result.incomeTax)} />
          <Stat label="Already withheld" hint="über Lohnabrechnung" value={formatEur(result.totalWithheld)} />
          <Stat label="Marginal rate" hint="Grenzsteuersatz" value={formatPct(result.marginalRatePct)} />
        </dl>
      </div>

      {/* How we got there */}
      <div className="card space-y-3">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">How this is calculated</h3>
        <Flow
          rows={[
            { label: 'Gross salary', german: 'Bruttoarbeitslohn', value: result.grossSalary, sign: '+' },
            {
              label: result.werbungskosten.usedPauschbetrag ? 'Employee lump sum' : 'Work expenses',
              german: result.werbungskosten.usedPauschbetrag ? 'Arbeitnehmer-Pauschbetrag' : 'Werbungskosten',
              value: result.werbungskosten.applied,
              sign: '−',
            },
            { label: 'Provision expenses', german: 'Vorsorgeaufwand', value: result.vorsorge.total, sign: '−' },
            { label: 'Special expenses', german: 'Sonderausgaben', value: result.sonderausgaben.applied, sign: '−' },
            { label: 'Taxable income', german: 'zu versteuerndes Einkommen', value: result.taxableIncome, sign: '=', strong: true },
          ]}
        />
        <p className="text-xs text-slate-500">
          Income tax on {formatEur(result.taxableIncome)} ({state.profile.assessmentType === 'joint' ? 'splitting tariff' : 'basic tariff'}) is{' '}
          <strong>{formatEur(result.incomeTax)}</strong>
          {result.soli > 0 && <> + {formatEur(result.soli)} solidarity surcharge</>}
          {result.churchTax > 0 && <> + {formatEur(result.churchTax)} church tax</>}. Your average tax rate is {formatPct(result.averageRatePct)}.
        </p>
      </div>

      {/* Per-Anlage breakdown */}
      {result.sections.map((section) => (
        <div key={section.id} className="card space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-base font-semibold">{section.title}</h3>
            <AnlageBadge name={section.anlage} />
          </div>
          <p className="text-sm text-slate-500">{section.description}</p>
          <table className="w-full text-sm">
            <tbody>
              {section.items.map((item, i) => (
                <tr key={i} className="border-b border-slate-100 last:border-0">
                  <td className="py-1.5">
                    <span className="text-slate-700">{item.label}</span>
                    <span className="ml-2 text-xs text-slate-400">{item.germanLabel}</span>
                    {item.note && <div className="text-xs text-slate-400">{item.note}</div>}
                  </td>
                  <td className="py-1.5 text-right font-medium tabular-nums">{formatEur(item.amount)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t border-slate-200">
                <td className="pt-2 font-semibold">{section.subtotalLabel}</td>
                <td className="pt-2 text-right font-semibold tabular-nums">{formatEur(section.subtotal)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      ))}

      {/* Deferred features */}
      <div className="card bg-slate-50">
        <h3 className="text-sm font-semibold text-slate-700">Not yet included</h3>
        <p className="mt-1 text-sm text-slate-500">
          This MVP covers salaried, full-year residents. Coming later: Indian income (RSU/ESPP via
          Anlage N-AUS, capital gains via Anlage KAP/KAP-INV) with India–Germany double-taxation
          relief, part-year residency, special rates (Progressionsvorbehalt, Abgeltungsteuer,
          Fünftelregelung), child allowances, and ELSTER export.
        </p>
      </div>

      <div className="flex justify-between">
        <button className="btn-ghost" onClick={onBack}>
          ← Back
        </button>
      </div>
    </div>
  );
}

function Stat({ label, hint, value }: { label: string; hint: string; value: string }) {
  return (
    <div className="rounded-lg bg-white/70 px-3 py-2">
      <dt className="text-xs text-slate-500">{label}</dt>
      <dd className="font-semibold tabular-nums">{value}</dd>
      <dd className="text-[11px] text-slate-400">{hint}</dd>
    </div>
  );
}

function Flow({
  rows,
}: {
  rows: { label: string; german: string; value: number; sign: string; strong?: boolean }[];
}) {
  return (
    <table className="w-full text-sm">
      <tbody>
        {rows.map((r, i) => (
          <tr key={i} className={r.strong ? 'border-t border-slate-200' : ''}>
            <td className="w-6 py-1 text-slate-400">{r.sign}</td>
            <td className={`py-1 ${r.strong ? 'font-semibold' : ''}`}>
              {r.label}
              <span className="ml-2 text-xs text-slate-400">{r.german}</span>
            </td>
            <td className={`py-1 text-right tabular-nums ${r.strong ? 'font-semibold' : ''}`}>
              {formatEur(r.value)}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
