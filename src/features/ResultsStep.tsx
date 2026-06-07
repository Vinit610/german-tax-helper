// Step 4 — Results: the estimated refund/payment, per-Anlage breakdown, and
// plain-English explanations of how each number was derived.

import { useMemo } from 'react';
import { AnlageBadge } from '../components/AnlageBadge';
import { computeEstimate } from '../lib/tax/estimate';
import { ANLAGE_AUS, ANLAGE_KAP, ELSTER_LSTB, FORM_OVERVIEW, LINE_NUMBER_DISCLAIMER } from '../lib/tax/elster';
import { findMissing } from '../lib/tax/checks';
import { formatEur, formatPct } from '../lib/format';
import { useStore } from '../state/store';

export function ResultsStep({ onBack }: { onBack: () => void }) {
  const { state, setStep } = useStore();
  const result = useMemo(() => computeEstimate(state), [state]);
  const missing = useMemo(() => findMissing(state), [state]);

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

  // result is non-null only when wage data exists.
  const l = state.lohnsteuer!;
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

      {/* Missing information the forms need */}
      {missing.length > 0 && (
        <div className="card space-y-3 border-amber-200 bg-amber-50/40">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-amber-700">
            To complete your forms, please add
          </h3>
          <ul className="space-y-2">
            {missing.map((m, i) => (
              <li key={i} className="flex items-start justify-between gap-3 rounded-lg bg-white/70 px-3 py-2">
                <div>
                  <div className="flex items-center gap-2">
                    <span className={`text-sm font-medium ${m.severity === 'warn' ? 'text-rose-700' : 'text-slate-700'}`}>
                      {m.title}
                    </span>
                    <span className="anlage-badge">{m.form}</span>
                  </div>
                  <p className="mt-0.5 text-xs text-slate-500">{m.detail}</p>
                </div>
                <button className="btn-ghost shrink-0 px-3 py-1 text-xs" onClick={() => setStep(m.step)}>
                  Fix →
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

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

      {(result.specialIncome > 0 || result.specialTaxWithheld > 0 || result.dbaIncome > 0) && (
        <div className="card space-y-2 border-indigo-200 bg-indigo-50/40">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-indigo-700">
            Captured, but taxed specially — not in this estimate
          </h3>
          <p className="text-sm text-slate-600">
            Your statement includes income that isn’t taxed at the normal rate, so it’s shown here for
            completeness but kept out of the simple refund figure above (it needs the Fünftelregelung
            and Progressionsvorbehalt, planned for a later phase):
          </p>
          <table className="w-full text-sm">
            <tbody>
              {result.specialIncome > 0 && (
                <tr className="border-t border-indigo-100">
                  <td className="py-1.5">Multi-year / reduced-rate pay <span className="text-xs text-slate-400">ermäßigt besteuert · Nr. 9/10</span></td>
                  <td className="py-1.5 text-right tabular-nums">{formatEur(result.specialIncome)}</td>
                </tr>
              )}
              {result.specialTaxWithheld > 0 && (
                <tr className="border-t border-indigo-100">
                  <td className="py-1.5">Tax withheld on that pay <span className="text-xs text-slate-400">Nr. 11/12/13 — counts toward your final bill</span></td>
                  <td className="py-1.5 text-right tabular-nums">{formatEur(result.specialTaxWithheld)}</td>
                </tr>
              )}
              {result.dbaIncome > 0 && (
                <tr className="border-t border-indigo-100">
                  <td className="py-1.5">Treaty-exempt wage <span className="text-xs text-slate-400">steuerfrei nach DBA · Nr. 6 — raises your rate (Progressionsvorbehalt)</span></td>
                  <td className="py-1.5 text-right tabular-nums">{formatEur(result.dbaIncome)}</td>
                </tr>
              )}
              <tr className="border-t border-indigo-200 font-medium">
                <td className="py-1.5">Total tax withheld on your statement (all blocks)</td>
                <td className="py-1.5 text-right tabular-nums">{formatEur(result.totalTaxWithheldAll)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      )}

      {/* Filing it yourself on ELSTER */}
      <div className="card space-y-3">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
          Filing this yourself on ELSTER
        </h3>
        <p className="text-sm text-slate-600">
          The easiest route: in ELSTER use <strong>“Belegabruf”</strong> (vorausgefüllte
          Steuererklärung) and your wage data fills in automatically. To type it in by hand, the table
          below — and the green “ELSTER:” hints under each line further down — tell you exactly which
          form and field each value goes in. Your withheld taxes go on Anlage N:
        </p>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-slate-400">
              <th className="py-1 font-medium">Value</th>
              <th className="py-1 font-medium">From wage statement</th>
              <th className="py-1 font-medium">Enter on ELSTER</th>
              <th className="py-1 text-right font-medium">Amount</th>
            </tr>
          </thead>
          <tbody>
            {[
              { ref: ELSTER_LSTB['3'], label: 'Gross salary', amount: l.grossSalary },
              { ref: ELSTER_LSTB['4'], label: 'Income tax withheld', amount: l.incomeTaxWithheld },
              { ref: ELSTER_LSTB['5'], label: 'Solidarity surcharge', amount: l.soliWithheld },
              { ref: ELSTER_LSTB['7'], label: 'Church tax withheld', amount: l.churchTaxWithheld },
            ].map((row, i) => (
              <tr key={i} className="border-t border-slate-100">
                <td className="py-1.5 text-slate-700">{row.label}</td>
                <td className="py-1.5 text-xs text-slate-400">Nr. {row.ref.caption.match(/Nr\. ([\w]+)/)?.[1] ?? ''}</td>
                <td className="py-1.5">
                  <span className="font-medium text-brand-700">{row.ref.form}</span>, {row.ref.line}
                </td>
                <td className="py-1.5 text-right tabular-nums">{formatEur(row.amount)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="text-xs text-slate-400">{LINE_NUMBER_DISCLAIMER}</p>
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
                    {item.elster && (
                      <div className="mt-0.5 text-xs text-brand-600">
                        ELSTER: <span className="font-medium">{item.elster.form}</span>, {item.elster.line} —{' '}
                        {item.elster.caption}
                        {item.elster.verify && <span className="ml-1 text-amber-500" title="Verify line number against your form">⚠ verify line</span>}
                      </div>
                    )}
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

      {/* Which form each thing goes on */}
      <div className="card space-y-3">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
          The forms & where your data comes from
        </h3>
        <table className="w-full text-sm">
          <tbody>
            {FORM_OVERVIEW.map((f) => (
              <tr key={f.form} className="border-b border-slate-100 last:border-0">
                <td className="py-1.5 align-top">
                  <AnlageBadge name={f.form} />
                </td>
                <td className="py-1.5 align-top text-slate-700">
                  {f.english}
                  <div className="text-xs text-slate-400">Fed from: {f.fedFrom}</div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Reference-only forms for later phases */}
      <div className="card bg-slate-50 space-y-4">
        <div>
          <h3 className="text-sm font-semibold text-slate-700">Capital & foreign income — reference only</h3>
          <p className="mt-1 text-sm text-slate-500">
            Not part of this salaried MVP, but the tool already speaks these forms. When the
            India-income phase lands, your data will map to these exact lines (capital gains incl.
            RSU/ESPP and India–Germany DTAA / foreign-tax credit):
          </p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          {[
            { name: 'Anlage KAP', rows: ANLAGE_KAP },
            { name: 'Anlage AUS', rows: ANLAGE_AUS },
          ].map((g) => (
            <div key={g.name}>
              <div className="mb-1">
                <AnlageBadge name={g.name} />
              </div>
              <ul className="space-y-1 text-xs text-slate-500">
                {g.rows.map((r, i) => (
                  <li key={i}>
                    <span className="font-medium text-slate-600">{r.line}</span> — {r.caption}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <p className="text-xs text-slate-400">
          Also coming later: part-year residency, special rates (Progressionsvorbehalt,
          Abgeltungsteuer, Fünftelregelung), Anlage Kind, and ELSTER export. {LINE_NUMBER_DISCLAIMER}
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
