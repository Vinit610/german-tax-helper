// Step 4 (optional) — Capital income (Anlage KAP) and foreign / equity-
// compensation income (Anlage AUS), incl. India–Germany double-taxation relief.
// Fully skippable: if you have none of this, continue straight to the estimate.

import { AnlageBadge } from '../components/AnlageBadge';
import { NumberField } from '../components/NumberField';
import { RsuHelper } from './RsuHelper';
import { computeCapital } from '../lib/tax/capitalForeign';
import { formatEur } from '../lib/format';
import { useStore } from '../state/store';

export function CapitalForeignStep({ onNext, onBack }: { onNext: () => void; onBack: () => void }) {
  const { state, setCapital } = useStore();
  const cf = state.capitalForeign;
  const joint = state.profile.assessmentType === 'joint';
  const churchRate = (joint
    ? Math.max(state.profile.churchTaxRate, state.profile.spouseChurchTaxRate)
    : state.profile.churchTaxRate) as typeof state.profile.churchTaxRate;

  const cap = cf.investmentIncome > 0 ? computeCapital(cf, joint, churchRate) : null;

  return (
    <div className="card space-y-6">
      <header className="space-y-1">
        <div className="flex items-center gap-2">
          <h2 className="text-lg font-semibold">Capital & foreign income</h2>
          <AnlageBadge name="Anlage KAP" />
          <AnlageBadge name="Anlage AUS" />
        </div>
        <p className="text-sm text-slate-500">
          Optional. Investments, plus equity compensation (RSU/ESPP “GSU”) and other foreign income —
          with India–Germany double-taxation relief. Skip if none applies.
        </p>
      </header>

      <label className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm">
        <input
          type="checkbox"
          className="h-4 w-4 rounded border-slate-300"
          checked={cf.enabled}
          onChange={(e) => setCapital({ enabled: e.target.checked })}
        />
        <span className="font-medium">I have capital income and/or foreign / GSU income to declare</span>
      </label>

      {cf.enabled && (
        <>
          {/* Anlage KAP */}
          <section className="space-y-4">
            <h3 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-slate-500">
              Capital income <span className="font-normal normal-case text-slate-400">· Anlage KAP — 25% Abgeltungsteuer</span>
            </h3>
            <div className="grid gap-4 sm:grid-cols-2">
              <NumberField
                label="Investment income (dividends, interest, gains)"
                germanLabel="Kapitalerträge"
                value={cf.investmentIncome}
                onChange={(v) => setCapital({ investmentIncome: v })}
                hint={`Sparer-Pauschbetrag of €${joint ? '2,000' : '1,000'} is applied automatically`}
              />
              <NumberField
                label="German capital tax already withheld"
                germanLabel="Kapitalertragsteuer"
                value={cf.capitalTaxWithheld}
                onChange={(v) => setCapital({ capitalTaxWithheld: v })}
                hint="From your bank/broker tax statement"
              />
              <NumberField
                label="Foreign withholding tax paid"
                germanLabel="Anrechenbare Quellensteuer"
                value={cf.foreignWithholdingTax}
                onChange={(v) => setCapital({ foreignWithholdingTax: v })}
                hint="Credited up to 25% (DBA cap, e.g. 15% on dividends)"
              />
            </div>
            {cap && (
              <div className="rounded-lg bg-slate-50 px-4 py-3 text-sm text-slate-600">
                Taxable after allowance: <strong>{formatEur(cap.taxableCapital)}</strong> → Abgeltungsteuer{' '}
                {formatEur(cap.abgeltungsteuer)}
                {cap.foreignCredit > 0 && <> − {formatEur(cap.foreignCredit)} foreign credit</>} ={' '}
                <strong>{formatEur(cap.incomeTax)}</strong> tax{cap.soli > 0 && <> + {formatEur(cap.soli)} Soli</>}.
              </div>
            )}
          </section>

          {/* Anlage AUS / N — GSU */}
          <section className="space-y-4">
            <h3 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-slate-500">
              Equity comp & foreign income <span className="font-normal normal-case text-slate-400">· Anlage N / AUS</span>
            </h3>
            <div className="grid gap-4 sm:grid-cols-2">
              <NumberField
                label="GSU/RSU income NOT already on your wage statement"
                germanLabel="Geldwerter Vorteil (RSU/ESPP)"
                value={cf.gsuIncome}
                onChange={(v) => setCapital({ gsuIncome: v })}
                hint="Only if a foreign employer didn’t report it — adds to your taxable income"
              />
              <NumberField
                label="Income already on your statement that was also taxed abroad"
                germanLabel="Bereits in der Lohnsteuerbescheinigung enthalten"
                value={cf.foreignTaxedIncomeOnCert}
                onChange={(v) => setCapital({ foreignTaxedIncomeOnCert: v })}
                hint="e.g. RSUs in line 3 or 10 — used only to size the credit, not added again"
              />
              <NumberField
                label="Total foreign tax paid abroad (e.g. India)"
                germanLabel="Anrechenbare ausländische Steuer"
                value={cf.gsuForeignTaxPaid}
                onChange={(v) => setCapital({ gsuForeignTaxPaid: v })}
                hint="Credited up to the German tax on this income (§34c / DBA)"
              />
              <NumberField
                label="Of the above, treaty-exempt (work done abroad)"
                germanLabel="Steuerfrei nach DBA"
                value={cf.gsuTreatyExempt}
                onChange={(v) => setCapital({ gsuTreatyExempt: v })}
                hint="Tax-free in Germany but raises your rate (Progressionsvorbehalt)"
              />
            </div>
            <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-900">
              Already taxed in India on RSUs that are <strong>also</strong> in your German wage
              statement (line 3 or 10)? Don’t re-enter the income as “GSU income” — put that amount in
              “income already on your statement that was also taxed abroad,” and your Indian tax in
              “total foreign tax paid.” You’ll get the double-taxation credit without counting the
              income twice.
            </p>
            <p className="rounded-lg bg-indigo-50 px-3 py-2 text-xs text-indigo-800">
              India–Germany treaty: income is generally taxed where the work is performed; the foreign
              share is relieved either by exemption (raising your rate) or by crediting the Indian tax.
              Simplified estimate — confirm the treaty article and amounts before filing.
            </p>

            <div className="rounded-xl border border-slate-200 p-4">
              <RsuHelper />
            </div>
          </section>
        </>
      )}

      <div className="flex justify-between">
        <button className="btn-ghost" onClick={onBack}>
          ← Back
        </button>
        <button className="btn-primary" onClick={onNext}>
          {cf.enabled ? 'See my estimate →' : 'Skip — see my estimate →'}
        </button>
      </div>
    </div>
  );
}
