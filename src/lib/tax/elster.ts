// Strict reference to the official German forms (2024/2025), so the tool's field
// names, numbers, and the wage-certificate → form mapping follow the Anlagen.
//
// IMPORTANT: line numbers (Zeilen) are taken from the official 2024 Anleitungen
// (smartsteuer / Haufe / stotax). They can shift by a row between tax years, so
// each entry carries a `verify` flag; the UI surfaces a "check against your
// form" note for anything not yet confirmed against the exact PDF. The German
// caption and the "lt. Nr. X der Lohnsteuerbescheinigung" cross-reference are
// the stable anchors inside ELSTER regardless of the row number.

export interface FormRef {
  /** Official form, e.g. "Anlage N". */
  form: string;
  /** Line on the 2024/2025 form, e.g. "Zeile 6". */
  line: string;
  /** German caption as printed on the form / shown in ELSTER. */
  caption: string;
  /** True when the row number still needs confirming against the exact PDF. */
  verify?: boolean;
}

// --- Wage-statement lines (Lohnsteuerbescheinigung Nr.) → target form -------
// These are the values that flow from the wage certificate into the return.
export const ELSTER_LSTB: Record<string, FormRef> = {
  // Income & taxes withheld → Anlage N (lines 6–10 are consistently confirmed).
  '3': { form: 'Anlage N', line: 'Zeile 6', caption: 'Bruttoarbeitslohn (lt. Nr. 3 der Lohnsteuerbescheinigung)' },
  '4': { form: 'Anlage N', line: 'Zeile 7', caption: 'Lohnsteuer (lt. Nr. 4)' },
  '5': { form: 'Anlage N', line: 'Zeile 8', caption: 'Solidaritätszuschlag (lt. Nr. 5)' },
  '6': { form: 'Anlage N', line: 'Zeile 9', caption: 'Kirchensteuer des Arbeitnehmers (lt. Nr. 6)' },
  '7': { form: 'Anlage N', line: 'Zeile 10', caption: 'Kirchensteuer des Ehegatten/Lebenspartners (lt. Nr. 7)' },

  // Social insurance → Anlage Vorsorgeaufwand.
  '22a': { form: 'Anlage Vorsorgeaufwand', line: 'Zeile 4', caption: 'Arbeitgeberanteil zur gesetzlichen Rentenversicherung (lt. Nr. 22a)' },
  '23a': { form: 'Anlage Vorsorgeaufwand', line: 'Zeile 4', caption: 'Arbeitnehmeranteil zur gesetzlichen Rentenversicherung (lt. Nr. 23a)' },
  '25': { form: 'Anlage Vorsorgeaufwand', line: 'Zeile 11', caption: 'Arbeitnehmerbeiträge zur inländischen gesetzlichen Krankenversicherung (lt. Nr. 25)' },
  '26': { form: 'Anlage Vorsorgeaufwand', line: 'Zeile 12', caption: 'Arbeitnehmerbeiträge zur sozialen Pflegeversicherung (lt. Nr. 26)' },
  '27': { form: 'Anlage Vorsorgeaufwand', line: 'Zeile 27', caption: 'Arbeitnehmerbeiträge zur Arbeitslosenversicherung (lt. Nr. 27)', verify: true },
};

// --- Deduction inputs → target form -----------------------------------------
export const ELSTER_DEDUCTION: Record<string, FormRef> = {
  commute: { form: 'Anlage N', line: 'Zeile 31–40', caption: 'Wege zwischen Wohnung und erster Tätigkeitsstätte (Entfernungspauschale)', verify: true },
  homeOffice: { form: 'Anlage N', line: 'Zeile 45', caption: 'Tagespauschale für häusliche Tätigkeit (Homeoffice-Pauschale)', verify: true },
  equipment: { form: 'Anlage N', line: 'Zeile 42–43', caption: 'Aufwendungen für Arbeitsmittel', verify: true },
  unionDues: { form: 'Anlage N', line: 'Zeile 41', caption: 'Beiträge zu Berufsverbänden', verify: true },
  training: { form: 'Anlage N', line: 'Zeile 46', caption: 'Fortbildungskosten', verify: true },
  applications: { form: 'Anlage N', line: 'Zeile 47–48', caption: 'Bewerbungskosten und weitere Werbungskosten', verify: true },
  donations: { form: 'Anlage Sonderausgaben', line: 'Zeile 5–12', caption: 'Zuwendungen (Spenden und Mitgliedsbeiträge)', verify: true },
  otherInsurance: { form: 'Anlage Vorsorgeaufwand', line: 'Zeile 11–22', caption: 'Weitere sonstige Vorsorgeaufwendungen (Haftpflicht, Unfall, Risikoleben)', verify: true },
};

// --- Reference-only: forms for later phases (capital & foreign income) -------
// Captured so the tool already speaks these forms; no data entry/calc yet.
export const ANLAGE_KAP: FormRef[] = [
  { form: 'Anlage KAP', line: 'Zeile 7', caption: 'Ausländische Kapitalerträge (ohne inländischen Steuerabzug)', verify: true },
  { form: 'Anlage KAP', line: 'Zeile 18–19', caption: 'Inländische Kapitalerträge / Kapitalerträge mit Steuerabzug', verify: true },
  { form: 'Anlage KAP', line: 'Zeile 16–17', caption: 'In Anspruch genommener Sparer-Pauschbetrag', verify: true },
  { form: 'Anlage KAP', line: 'Zeile 20', caption: 'Gewinne aus der Veräußerung von Aktien', verify: true },
  { form: 'Anlage KAP', line: 'Zeile 43–45', caption: 'Anrechenbare ausländische (Quellen-)Steuer', verify: true },
];

export const ANLAGE_AUS: FormRef[] = [
  { form: 'Anlage AUS', line: 'Zeile 7', caption: 'Ausländische Einkünfte (Einnahmen abzüglich Werbungskosten)', verify: true },
  { form: 'Anlage AUS', line: 'Zeile 12', caption: 'Anrechenbare ausländische Steuern (direkte Anrechnung)', verify: true },
  { form: 'Anlage AUS', line: 'Zeile 13', caption: 'Nach DBA fiktiv anrechenbare Steuern', verify: true },
  { form: 'Anlage AUS', line: 'Zeile 34–38', caption: 'Nach DBA steuerfreie Einkünfte (Progressionsvorbehalt)', verify: true },
];

/** Summary metadata for the four forms, for an at-a-glance reference panel. */
export const FORM_OVERVIEW: { form: string; english: string; fedFrom: string }[] = [
  { form: 'Anlage N', english: 'Employment income & work expenses', fedFrom: 'Lohnsteuerbescheinigung Nr. 3–7 (salary, taxes withheld)' },
  { form: 'Anlage Vorsorgeaufwand', english: 'Pension, health, insurance', fedFrom: 'Lohnsteuerbescheinigung Nr. 22a–28 (social insurance)' },
  { form: 'Anlage KAP', english: 'Capital income (later phase)', fedFrom: 'Bank/broker tax statements — not the wage certificate' },
  { form: 'Anlage AUS', english: 'Foreign income & tax credit (later phase)', fedFrom: 'Foreign income proof + foreign tax paid — not the wage certificate' },
];

export const LINE_NUMBER_DISCLAIMER =
  'Line numbers (Zeilen) follow the official 2024/2025 Anleitungen and can shift by a row between years — verify against your exact form. The German caption and the “lt. Nr. … der Lohnsteuerbescheinigung” reference are the reliable anchors inside ELSTER.';
