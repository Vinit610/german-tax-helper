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

  const commute = commuteAllowance(d.commuteOneWayKm, d.commuteDays, d.commuteMode);
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
          <label className="block">
            <span className="label">
              Main transport · <span className="font-normal text-slate-400">Verkehrsmittel</span>
            </span>
            <select
              className="input"
              value={d.commuteMode}
              onChange={(e) => setDeductions({ commuteMode: e.target.value as 'car' | 'public' | 'other' })}
            >
              <option value="car">Own car (no €4,500 cap)</option>
              <option value="public">Public transport</option>
              <option value="other">Bike / walk / carpool</option>
            </select>
            <span className="mt-1 block text-xs text-slate-400">
              Non-car commuting is capped at €4,500/year (Entfernungspauschale).
            </span>
          </label>
          {d.commuteMode === 'public' && (
            <NumberField
              label="Actual public-transport cost (year)"
              germanLabel="Tatsächliche ÖPNV-Kosten"
              value={d.commutePublicCost}
              onChange={(v) => setDeductions({ commutePublicCost: v })}
              hint="Deductible if higher than the distance allowance"
            />
          )}
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
            label="Professional / union dues"
            germanLabel="Beiträge zu Berufsverbänden"
            value={d.unionDues}
            onChange={(v) => setDeductions({ unionDues: v })}
            hint="Union or professional-association membership"
          />
          <NumberField
            label="Training / further education"
            germanLabel="Fortbildungskosten"
            value={d.trainingCosts}
            onChange={(v) => setDeductions({ trainingCosts: v })}
            hint="Courses, seminars, professional literature"
          />
          <NumberField
            label="Application & other costs"
            germanLabel="Bewerbungskosten u. a."
            value={d.applicationCosts}
            onChange={(v) => setDeductions({ applicationCosts: v })}
            hint="Job applications, account fees, etc."
          />
          <label className="block sm:col-span-2">
            <span className="label">
              First place of work (optional) ·{' '}
              <span className="font-normal text-slate-400">Erste Tätigkeitsstätte</span>
            </span>
            <input
              className="input"
              type="text"
              placeholder="Employer address — Anlage N asks for it"
              value={d.firstWorkplace}
              onChange={(e) => setDeductions({ firstWorkplace: e.target.value })}
            />
          </label>
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
            label="Liability insurance"
            germanLabel="Haftpflichtversicherung"
            value={d.liabilityInsurance}
            onChange={(v) => setDeductions({ liabilityInsurance: v })}
          />
          <NumberField
            label="Accident insurance (private)"
            germanLabel="Unfallversicherung"
            value={d.accidentInsurance}
            onChange={(v) => setDeductions({ accidentInsurance: v })}
          />
          <NumberField
            label="Term life / risk insurance"
            germanLabel="Risikolebensversicherung"
            value={d.termLifeInsurance}
            onChange={(v) => setDeductions({ termLifeInsurance: v })}
          />
        </div>
        <p className="rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-500">
          These “other” insurances count only within the €1,900 cap for sonstige
          Vorsorgeaufwendungen, which your statutory health + care contributions usually already use
          up — so they often won’t change the result, but the tool still maps them to the form.
        </p>
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
