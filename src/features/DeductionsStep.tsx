// Step 3 — Deductions: commute, home office, equipment, donations, insurance.
// Live previews of the lump-sum calculations help the user see the impact.

import { AnlageBadge } from '../components/AnlageBadge';
import { NumberField } from '../components/NumberField';
import {
  ARBEITNEHMER_PAUSCHBETRAG,
  commuteAllowance,
  computeWerbungskosten,
  homeOfficeAllowance,
} from '../lib/tax/deductions';
import { formatEur } from '../lib/format';
import { useStore } from '../state/store';

export function DeductionsStep({ onNext, onBack }: { onNext: () => void; onBack: () => void }) {
  const { state, setDeductions } = useStore();
  const d = state.deductions;

  const commute = commuteAllowance(d.commuteOneWayKm, d.commuteDays);
  const homeOffice = homeOfficeAllowance(d.homeOfficeDays);
  const wk = computeWerbungskosten(d);

  return (
    <div className="card space-y-8">
      <header className="space-y-1">
        <div className="flex items-center gap-2">
          <h2 className="text-lg font-semibold">Deductions</h2>
          <AnlageBadge name="Anlage N" />
          <AnlageBadge name="Anlage Sonderausgaben" />
        </div>
        <p className="text-sm text-slate-500">
          Optional — but this is where most refunds come from. Leave anything blank if it doesn’t apply.
        </p>
      </header>

      {/* Werbungskosten */}
      <section className="space-y-4">
        <h3 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-slate-500">
          Work-related expenses <span className="font-normal normal-case text-slate-400">· Werbungskosten</span>
        </h3>

        <div className="grid gap-4 sm:grid-cols-2">
          <NumberField
            label="Commute distance (one way)"
            germanLabel="Entfernung"
            value={d.commuteOneWayKm}
            onChange={(v) => setDeductions({ commuteOneWayKm: v })}
            suffix="km"
            hint="€0.30/km for the first 20 km, €0.38/km beyond"
          />
          <NumberField
            label="Days commuted in 2025"
            germanLabel="Arbeitstage"
            value={d.commuteDays}
            onChange={(v) => setDeductions({ commuteDays: v })}
            suffix="days"
            hint={commute > 0 ? `Commute allowance: ${formatEur(commute)}` : 'Typically ~220 office days'}
          />
          <NumberField
            label="Home-office days"
            germanLabel="Homeoffice-Pauschale"
            value={d.homeOfficeDays}
            onChange={(v) => setDeductions({ homeOfficeDays: v })}
            suffix="days"
            hint={homeOffice > 0 ? `Flat rate: ${formatEur(homeOffice)} (max 210 days)` : '€6/day, up to €1,260'}
          />
          <NumberField
            label="Work equipment"
            germanLabel="Arbeitsmittel"
            value={d.workEquipment}
            onChange={(v) => setDeductions({ workEquipment: v })}
            hint="Laptop, desk, tools, etc."
          />
          <NumberField
            label="Other work costs"
            germanLabel="Sonstige Werbungskosten"
            value={d.otherWorkCosts}
            onChange={(v) => setDeductions({ otherWorkCosts: v })}
            hint="Training, professional memberships, applications"
          />
        </div>

        <div className="rounded-lg bg-slate-50 px-4 py-3 text-sm">
          {wk.actual >= ARBEITNEHMER_PAUSCHBETRAG ? (
            <p>
              Your work expenses total <strong>{formatEur(wk.actual)}</strong> — above the{' '}
              {formatEur(ARBEITNEHMER_PAUSCHBETRAG)} employee lump sum, so the full amount is used. 🎉
            </p>
          ) : (
            <p className="text-slate-600">
              So far {formatEur(wk.actual)}. Everyone automatically gets the{' '}
              {formatEur(ARBEITNEHMER_PAUSCHBETRAG)} employee lump sum (Arbeitnehmer-Pauschbetrag), so
              you only benefit beyond that once expenses exceed it.
            </p>
          )}
        </div>
      </section>

      {/* Sonderausgaben */}
      <section className="space-y-4">
        <h3 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-slate-500">
          Special expenses <span className="font-normal normal-case text-slate-400">· Sonderausgaben</span>
        </h3>
        <div className="grid gap-4 sm:grid-cols-2">
          <NumberField
            label="Charitable donations"
            germanLabel="Spenden"
            value={d.donations}
            onChange={(v) => setDeductions({ donations: v })}
          />
          <NumberField
            label="Additional private insurance"
            germanLabel="Weitere Versicherungen"
            value={d.otherInsurance}
            onChange={(v) => setDeductions({ otherInsurance: v })}
            hint="Liability, accident, etc. (often capped — may not change the result)"
          />
        </div>
      </section>

      <div className="flex justify-between">
        <button className="btn-ghost" onClick={onBack}>
          ← Back
        </button>
        <button className="btn-primary" onClick={onNext}>
          See my estimate →
        </button>
      </div>
    </div>
  );
}
