// RSU/ESPP (GSU) grant→vest allocation, with India–Germany treaty relief.
//
// Each vesting tranche is a separate taxable event in Germany at vest. Only the
// share attributable to workdays performed in Germany during the grant→vest
// window is German-source; the rest relates to work done abroad (India) and is
// relieved under the treaty — either by EXEMPTION (Progressionsvorbehalt, the
// usual treatment for employment income) or by CREDIT for the foreign tax paid.
//
// The German return is per calendar year, so only tranches vesting in the
// selected tax year affect the estimate; all tranches are kept as a record and
// produce a workpaper (the allocation schedule the Finanzamt expects).

import type { RsuReliefMethod, RsuTranche } from '../../types';

export interface RsuTrancheLine {
  id: string;
  label: string;
  vestDate: string;
  inTaxYear: boolean;
  vestValue: number;
  /** German workdays ÷ total workdays in the window (0–1). */
  germanShare: number;
  /** German-source (taxable in Germany). */
  germanTaxable: number;
  /** Foreign-source (treaty-relieved). */
  foreignPortion: number;
  indianTaxPaid: number;
}

export interface RsuComputation {
  perTranche: RsuTrancheLine[];
  /** German-taxable RSU not yet on the wage statement → added to income. */
  addedToTaxable: number;
  /** Treaty-exempt portion already in the wage statement → subtract from income. */
  exemptSubtractOnCert: number;
  /** Treaty-exempt portion not on the statement → progression only. */
  exemptProgression: number;
  /** German-taxable income that was also foreign-taxed → credit base. */
  creditIncome: number;
  /** Foreign tax on the current year's vests (credited only under the credit method). */
  indianTaxPaid: number;
  reliefMethod: RsuReliefMethod;
}

function share(t: RsuTranche): number {
  if (t.totalWorkdays <= 0) return 1;
  return Math.min(1, Math.max(0, t.germanWorkdays / t.totalWorkdays));
}

export function computeRsu(
  tranches: RsuTranche[],
  taxYear: number,
  reliefMethod: RsuReliefMethod,
): RsuComputation {
  let addedToTaxable = 0;
  let exemptSubtractOnCert = 0;
  let exemptProgression = 0;
  let creditIncome = 0;
  let indianTaxPaid = 0;

  const perTranche: RsuTrancheLine[] = tranches.map((t) => {
    const s = share(t);
    const germanTaxable = Math.round(t.vestValue * s * 100) / 100;
    const foreignPortion = Math.round((t.vestValue - germanTaxable) * 100) / 100;
    const inTaxYear = new Date(t.vestDate).getFullYear() === taxYear;

    if (inTaxYear) {
      if (reliefMethod === 'credit') {
        // The whole vest is taxable in Germany; foreign tax on the foreign-source
        // share is credited.
        if (!t.onCertificate) addedToTaxable += t.vestValue;
        creditIncome += foreignPortion;
        indianTaxPaid += t.indianTaxPaid;
      } else {
        // Exemption: the foreign-source share is exempt (rate only).
        if (t.onCertificate) {
          exemptSubtractOnCert += foreignPortion;
        } else {
          addedToTaxable += germanTaxable;
          exemptProgression += foreignPortion;
        }
        indianTaxPaid += t.indianTaxPaid; // informational under exemption
      }
    }

    return {
      id: t.id,
      label: t.label,
      vestDate: t.vestDate,
      inTaxYear,
      vestValue: t.vestValue,
      germanShare: s,
      germanTaxable,
      foreignPortion,
      indianTaxPaid: t.indianTaxPaid,
    };
  });

  return {
    perTranche,
    addedToTaxable: round2(addedToTaxable),
    exemptSubtractOnCert: round2(exemptSubtractOnCert),
    exemptProgression: round2(exemptProgression),
    creditIncome: round2(creditIncome),
    indianTaxPaid: round2(indianTaxPaid),
    reliefMethod,
  };
}

const round2 = (n: number) => Math.round(n * 100) / 100;
