// Where each value goes when filing yourself on ELSTER (https://www.elster.de).
//
// The most reliable anchor is the German caption + the "lt. Nr. X der
// Lohnsteuerbescheinigung" cross-reference, because ELSTER labels its fields
// exactly that way. Line numbers refer to the 2024/2025 paper forms and can
// shift slightly between years, so we show them as a hint alongside the caption.

export interface ElsterRef {
  /** Official form, e.g. "Anlage N". */
  form: string;
  /** Line hint on the 2024/2025 form, e.g. "Zeile 6". */
  line: string;
  /** German caption as it appears in ELSTER. */
  caption: string;
}

/** Wage-statement lines → ELSTER target, keyed by Lohnsteuerbescheinigung Nr. */
export const ELSTER_LSTB: Record<string, ElsterRef> = {
  '3': { form: 'Anlage N', line: 'Zeile 6', caption: 'Bruttoarbeitslohn (lt. Nr. 3 der Lohnsteuerbescheinigung)' },
  '4': { form: 'Anlage N', line: 'Zeile 7', caption: 'Einbehaltene Lohnsteuer (lt. Nr. 4)' },
  '5': { form: 'Anlage N', line: 'Zeile 8', caption: 'Einbehaltener Solidaritätszuschlag (lt. Nr. 5)' },
  '6': { form: 'Anlage N', line: 'Zeile 9', caption: 'Einbehaltene Kirchensteuer des Arbeitnehmers (lt. Nr. 6)' },
  '22a': {
    form: 'Anlage Vorsorgeaufwand',
    line: 'Zeile 5',
    caption: 'Arbeitgeberanteil zur gesetzlichen Rentenversicherung (lt. Nr. 22a)',
  },
  '23a': {
    form: 'Anlage Vorsorgeaufwand',
    line: 'Zeile 4',
    caption: 'Arbeitnehmeranteil zur gesetzlichen Rentenversicherung (lt. Nr. 23a)',
  },
  '25': {
    form: 'Anlage Vorsorgeaufwand',
    line: 'Zeile 11–12',
    caption: 'Beiträge zur inländischen gesetzlichen Krankenversicherung (lt. Nr. 25)',
  },
  '26': {
    form: 'Anlage Vorsorgeaufwand',
    line: 'Zeile 13',
    caption: 'Beiträge zur sozialen Pflegeversicherung (lt. Nr. 26)',
  },
  '27': {
    form: 'Anlage Vorsorgeaufwand',
    line: 'Zeile 27',
    caption: 'Arbeitnehmerbeiträge zur Arbeitslosenversicherung (lt. Nr. 27)',
  },
};

/** Deduction inputs → ELSTER target, keyed by our internal id. */
export const ELSTER_DEDUCTION: Record<string, ElsterRef> = {
  commute: { form: 'Anlage N', line: 'Zeile 31–40', caption: 'Wege zwischen Wohnung und erster Tätigkeitsstätte (Entfernungspauschale)' },
  homeOffice: { form: 'Anlage N', line: 'Zeile 45', caption: 'Tagespauschale für häusliche Arbeit (Homeoffice-Pauschale)' },
  equipment: { form: 'Anlage N', line: 'Zeile 42–43', caption: 'Aufwendungen für Arbeitsmittel' },
  otherWork: { form: 'Anlage N', line: 'Zeile 46–48', caption: 'Sonstige Werbungskosten (Fortbildung, Beiträge, Bewerbungen)' },
  donations: { form: 'Anlage Sonderausgaben', line: 'Zeile 5–12', caption: 'Zuwendungen (Spenden und Mitgliedsbeiträge)' },
  otherInsurance: { form: 'Anlage Vorsorgeaufwand', line: 'Zeile 21–46', caption: 'Weitere sonstige Vorsorgeaufwendungen' },
};
