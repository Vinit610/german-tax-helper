// Rules layer: map the elektronische Lohnsteuerbescheinigung to our field model.
//
// pdf.js / OCR text comes out spatially scrambled (lines arrive out of order),
// but each amount always sits right after its caption. So we anchor on the full,
// distinctive German caption and read the amount that follows — this is far more
// robust than line-number position or short keywords (which collide, e.g.
// "Krankenversicherung" on both Nr. 24 and 25). Numbers may be German
// ("1.234,56") or US ("1,234.56"); parseAmount auto-detects.
//
// Line numbers follow the 2025 Muster (BMF). Where the regular wage and the
// specially-taxed multi-year pay each carry their own taxes, both blocks are
// captured: "von 3." (Nr. 4/5/7) and "von 9. und 10." (Nr. 11/12/13).

import type { LohnsteuerData, ParsedField } from '../../types';

/**
 * Parse a money amount, auto-detecting the decimal separator (German or US) and
 * tolerating spaced thousands and missing decimals.
 *   "156.177,33" → 156177.33   "156,177.33" → 156177.33   "45.000" → 45000
 */
export function parseAmount(raw: string): number | null {
  let s = raw.replace(/[^\d.,\s-]/g, '').trim();
  if (!s) return null;
  const negative = s.startsWith('-');
  s = s.replace(/-/g, '').trim();

  const lastDot = s.lastIndexOf('.');
  const lastComma = s.lastIndexOf(',');
  let decimalSep: string | null = null;
  if (lastDot !== -1 || lastComma !== -1) {
    const sepPos = Math.max(lastDot, lastComma);
    const trailing = s.length - sepPos - 1;
    if (trailing === 1 || trailing === 2) decimalSep = s[sepPos];
  }

  let intPart = s;
  let decPart = '';
  if (decimalSep) {
    const p = s.lastIndexOf(decimalSep);
    intPart = s.slice(0, p);
    decPart = s.slice(p + 1);
  }
  intPart = intPart.replace(/[.,\s]/g, '');
  decPart = decPart.replace(/\D/g, '');

  const n = Number.parseFloat(intPart + (decPart ? `.${decPart}` : ''));
  if (!Number.isFinite(n)) return null;
  return negative ? -n : n;
}

const AMOUNT_RE = /\d{1,3}(?:[.,\s]\d{3})+(?:[.,]\d{1,2})?|\d+[.,]\d{1,2}|\d{3,}/g;

function looksLikeDecimal(raw: string): boolean {
  return /[.,]\d{1,2}(?!\d)/.test(raw);
}

interface Candidate {
  value: number;
  hasDecimal: boolean;
  offset: number;
}

/** Best money amount in a chunk: nearest real-currency value; skip year-ints. */
function bestAmount(text: string): number | null {
  const candidates: Candidate[] = [];
  for (const m of text.matchAll(AMOUNT_RE)) {
    const value = parseAmount(m[0]);
    if (value === null) continue;
    const hasDecimal = looksLikeDecimal(m[0]);
    if (!hasDecimal && value >= 2019 && value <= 2030 && Number.isInteger(value)) continue;
    candidates.push({ value, hasDecimal, offset: m.index ?? 0 });
  }
  if (candidates.length === 0) return null;
  const withDecimal = candidates.filter((c) => c.hasDecimal);
  const pool = withDecimal.length > 0 ? withDecimal : candidates;
  pool.sort((a, b) => a.offset - b.offset);
  return pool[0].value;
}

/**
 * Find a caption and return the amount that follows it — matching against a
 * normalised view of the text (letters/digits only) so that line wraps,
 * hyphenation ("Arbeitnehmer-\nbeiträge") and extra spaces don't break it.
 * `prefix`, if given, must appear shortly before the caption (employer vs.
 * employee pension lines, which share "zur gesetzlichen Rentenversicherung").
 */
interface Normalised {
  norm: string;
  /** map[i] = index in the original text of normalised char i. */
  map: number[];
}

function normalise(text: string): Normalised {
  const map: number[] = [];
  let norm = '';
  for (let i = 0; i < text.length; i++) {
    const c = text[i].toLowerCase();
    if (/[a-z0-9äöüß]/.test(c)) {
      norm += c;
      map.push(i);
    }
  }
  return { norm, map };
}

const stripNonAlnum = (s: string) => s.toLowerCase().replace(/[^a-z0-9äöüß]/g, '');

function findByCaption(text: string, n: Normalised, captions: string[], prefix?: string): number | null {
  const nprefix = prefix ? stripNonAlnum(prefix) : '';
  for (const core of captions) {
    const ncore = stripNonAlnum(core);
    if (!ncore) continue;
    let from = 0;
    for (;;) {
      const idx = n.norm.indexOf(ncore, from);
      if (idx === -1) break;
      from = idx + ncore.length;
      if (nprefix && !n.norm.slice(Math.max(0, idx - 40), idx).includes(nprefix)) continue;
      const origStart = n.map[idx + ncore.length - 1] + 1;
      const v = bestAmount(text.slice(origStart, origStart + 120));
      if (v !== null) return v;
    }
  }
  return null;
}

interface FieldRule {
  line: string;
  label: string;
  germanLabel: string;
  /** Essential (feeds the estimate) vs. captured for reference / later phases. */
  used: boolean;
  /** Distinctive captions to try, lowercased, in priority order. */
  captions: string[];
  /** Optional word required shortly before the caption (disambiguation). */
  prefix?: string;
}

// Canonical 2025 elektronische Lohnsteuerbescheinigung lines.
const RULES: FieldRule[] = [
  // --- Wage (Anlage N) ---
  { line: '3', used: true, label: 'Gross salary (regular)', germanLabel: 'Bruttoarbeitslohn (ohne Nr. 9/10)', captions: ['bruttoarbeitslohn'] },
  { line: '6', used: false, label: 'Tax-free wage under a treaty', germanLabel: 'Steuerfreier Arbeitslohn nach DBA/ATE', captions: ['steuerfreier arbeitslohn nach', 'doppelbesteuerungsabkommen', 'steuerfreier'] },
  // Caption restricted to "Versorgungsbezüge" so it can't match inside Nr. 10's
  // wording ("…und ermäßigt besteuerte Entschädigungen"), which double-counted.
  { line: '9', used: false, label: 'Reduced-rate pension benefits', germanLabel: 'Ermäßigt besteuerte Versorgungsbezüge', captions: ['ermäßigt besteuerte versorgungsbezüge', 'ermassigt besteuerte versorgungsbezüge'] },
  { line: '10', used: false, label: 'Reduced-rate multi-year pay', germanLabel: 'Ermäßigt besteuerter Arbeitslohn für mehrere Kalenderjahre', captions: ['ermäßigt besteuerter arbeitslohn für mehrere', 'ermassigt besteuerter arbeitslohn für mehrere'] },
  { line: '19', used: false, label: 'Multi-year pay taxed normally', germanLabel: 'Steuerpflichtige Entschädigungen/Arbeitslohn mehrere Jahre (in Nr. 3)', captions: ['steuerpflichtige entschädigungen'] },

  // --- Taxes on the regular wage (essential) ---
  { line: '4', used: true, label: 'Income tax withheld (on Nr. 3)', germanLabel: 'Einbehaltene Lohnsteuer von 3.', captions: ['einbehaltene lohnsteuer von 3', 'lohnsteuer von 3', 'einbehaltene lohnsteuer'] },
  { line: '5', used: true, label: 'Solidarity surcharge (on Nr. 3)', germanLabel: 'Einbehaltener Solidaritätszuschlag von 3.', captions: ['solidaritätszuschlag von 3', 'solidaritatszuschlag von 3', 'solidaritätszuschlag'] },
  { line: '7', used: true, label: 'Church tax — you (on Nr. 3)', germanLabel: 'Einbehaltene Kirchensteuer des Arbeitnehmers von 3.', captions: ['kirchensteuer des arbeitnehmers von 3', 'kirchensteuer des arbeitnehmers'] },
  { line: '8', used: true, label: 'Church tax — spouse (on Nr. 3)', germanLabel: 'Einbehaltene Kirchensteuer des Ehegatten von 3.', captions: ['kirchensteuer des ehegatten von 3', 'kirchensteuer des ehegatten', 'kirchensteuer des lebenspartners'] },

  // --- Taxes on specially-taxed pay (Nr. 9/10) (essential) ---
  { line: '11', used: true, label: 'Income tax withheld (on Nr. 9/10)', germanLabel: 'Einbehaltene Lohnsteuer von 9. und 10.', captions: ['einbehaltene lohnsteuer von 9', 'lohnsteuer von 9'] },
  { line: '12', used: true, label: 'Solidarity surcharge (on Nr. 9/10)', germanLabel: 'Solidaritätszuschlag von 9. und 10.', captions: ['solidaritätszuschlag von 9', 'solidaritatszuschlag von 9'] },
  { line: '13', used: true, label: 'Church tax — you (on Nr. 9/10)', germanLabel: 'Kirchensteuer des Arbeitnehmers von 9. und 10.', captions: ['kirchensteuer des arbeitnehmers von 9'] },
  { line: '14', used: true, label: 'Church tax — spouse (on Nr. 9/10)', germanLabel: 'Kirchensteuer des Ehegatten von 9. und 10.', captions: ['kirchensteuer des ehegatten von 9'] },

  // --- Tax-free allowances ---
  { line: '15', used: false, label: 'Wage-replacement benefits', germanLabel: 'Kurzarbeitergeld u. a. Lohnersatzleistungen', captions: ['kurzarbeitergeld', 'lohnersatzleistungen'] },
  { line: '17', used: true, label: 'Employer commute benefit (tax-free)', germanLabel: 'Steuerfreie AG-Leistungen auf die Entfernungspauschale', captions: ['entfernungspauschale anzurechnen sind', 'die auf die entfernungspauschale anzurechnen'] },

  // --- Social insurance (Anlage Vorsorgeaufwand) (essential) ---
  { line: '22a', used: true, label: 'Pension — employer share', germanLabel: 'Arbeitgeberanteil gesetzliche Rentenversicherung', captions: ['zur gesetzlichen rentenversicherung'], prefix: 'arbeitgeber' },
  { line: '22b', used: false, label: 'Professional pension — employer', germanLabel: 'Arbeitgeberanteil berufsständische Versorgung', captions: ['berufsständische', 'berufsständischen versorgung'], prefix: 'arbeitgeber' },
  { line: '23a', used: true, label: 'Pension — employee share', germanLabel: 'Arbeitnehmeranteil gesetzliche Rentenversicherung', captions: ['zur gesetzlichen rentenversicherung'], prefix: 'arbeitnehmer' },
  { line: '25', used: true, label: 'Health insurance (employee)', germanLabel: 'Arbeitnehmerbeiträge gesetzliche Krankenversicherung', captions: ['arbeitnehmerbeiträge zur gesetzlichen krankenversicherung', 'arbeitnehmerbeiträge zur krankenversicherung'] },
  { line: '26', used: true, label: 'Long-term care insurance (employee)', germanLabel: 'Arbeitnehmerbeiträge soziale Pflegeversicherung', captions: ['arbeitnehmerbeiträge zur sozialen pflegeversicherung', 'soziale pflegeversicherung'] },
  { line: '27', used: true, label: 'Unemployment insurance (employee)', germanLabel: 'Arbeitnehmerbeiträge Arbeitslosenversicherung', captions: ['arbeitnehmerbeiträge zur arbeitslosenversicherung', 'arbeitslosenversicherung'] },
  { line: '28', used: true, label: 'Private health/care insurance or minimum provision', germanLabel: 'Beiträge zur privaten Kranken- und Pflege-Pflichtversicherung oder Mindestvorsorgepauschale', captions: ['mindestvorsorgepauschale', 'privaten kranken'] },
];

// --- Generic line capture ----------------------------------------------------
// So that *every* numbered line on the statement is visible (not only the ones
// we map by caption), we also detect line-number tokens and read the amount in
// each token's segment. Lines already covered by a caption rule are skipped.

interface LineToken {
  id: string;
  pos: number;
  contentStart: number;
}

// "12." / "22a)" / "22 a)", or a lone sub-letter "a)" following a master number.
const TOKEN_RE = /(?<![\d.,])(\d{1,2})\s*([a-c])?\s*[.)](?!\d)|(?<=\s)([a-c])\)/gi;

function detectTokens(text: string): LineToken[] {
  const tokens: LineToken[] = [];
  let master = '';
  for (const m of text.matchAll(TOKEN_RE)) {
    let id: string;
    if (m[1] !== undefined) {
      master = m[1];
      id = m[2] ? master + m[2].toLowerCase() : master;
    } else if (m[3] !== undefined && master) {
      id = master + m[3].toLowerCase();
    } else {
      continue;
    }
    const base = Number.parseInt(id, 10);
    if (!(base >= 3 && base <= 30)) continue;
    const pos = m.index ?? 0;
    tokens.push({ id, pos, contentStart: pos + m[0].length });
  }
  return tokens;
}

function segmentAmounts(text: string): Map<string, number> {
  const tokens = detectTokens(text);
  const map = new Map<string, number>();
  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i];
    const end = i + 1 < tokens.length ? tokens[i + 1].pos : Math.min(text.length, t.contentStart + 160);
    const amount = bestAmount(text.slice(t.contentStart, end));
    if (amount !== null && !map.has(t.id)) map.set(t.id, amount);
  }
  return map;
}

export interface ParseResult {
  fields: ParsedField[];
  data: LohnsteuerData;
  /** True if essentially nothing was recognised. */
  empty: boolean;
}

/** Apply the rules to extracted text and return both fields and a data object. */
export function parseLohnsteuer(text: string, source: 'pdf' | 'ocr'): ParseResult {
  const baseConfidence = source === 'pdf' ? 'high' : 'medium';
  const n = normalise(text);
  const fields: ParsedField[] = [];
  const covered = new Set<string>();

  let found = 0;
  for (const rule of RULES) {
    covered.add(rule.line);
    const v = findByCaption(text, n, rule.captions, rule.prefix);
    const matched = v !== null;
    if (matched) found++;
    fields.push({
      line: rule.line,
      label: rule.label,
      germanLabel: rule.germanLabel,
      value: v ?? 0,
      confidence: matched ? baseConfidence : 'low',
      used: rule.used,
    });
  }

  // Surface any other numbered lines present on the statement so nothing is
  // hidden. These are captured for reference (not used in the estimate).
  const seg = segmentAmounts(text);
  const extras = [...seg.keys()]
    .filter((id) => !covered.has(id) && !covered.has(`${id}a`) && !covered.has(`${id}b`))
    .sort((a, b) => Number.parseInt(a, 10) - Number.parseInt(b, 10) || a.localeCompare(b));
  for (const id of extras) {
    found++;
    fields.push({
      line: id,
      label: `Line ${id}`,
      germanLabel: KNOWN_EXTRA_LABELS[id] ?? 'Vom Beleg erfasst',
      value: seg.get(id) ?? 0,
      confidence: baseConfidence,
      used: false,
    });
  }

  return { fields, data: fieldsToData(fields), empty: found === 0 };
}

// German labels for lines we capture generically but don't map into the estimate.
const KNOWN_EXTRA_LABELS: Record<string, string> = {
  '16': 'Steuerfreie Arbeitgeberleistungen (Auswärtstätigkeit/Sammelbeförderung)',
  '18': 'Pauschal besteuerte Arbeitgeberleistungen (Fahrten Wohnung–Arbeit)',
  '20': 'Steuerfreie Verpflegungszuschüsse bei Auswärtstätigkeit',
  '21': 'Steuerfreie Arbeitgeberleistungen bei doppelter Haushaltsführung',
  '24': 'Steuerfreie Arbeitgeberzuschüsse Kranken-/Pflegeversicherung',
  '29': 'Bemessungsgrundlage für den Versorgungsfreibetrag',
};

/** Build an empty field list for fully manual entry. */
export function emptyFields(): ParsedField[] {
  return RULES.map((rule) => ({
    line: rule.line,
    label: rule.label,
    germanLabel: rule.germanLabel,
    value: 0,
    confidence: 'low' as const,
    used: rule.used,
  }));
}

/** Aggregate the per-line fields into the typed data the estimate consumes. */
export function fieldsToData(fields: ParsedField[]): LohnsteuerData {
  const byLine = new Map(fields.map((f) => [f.line, f.value]));
  const g = (line: string) => byLine.get(line) ?? 0;
  return {
    grossSalary: g('3'),
    incomeTaxWithheld: g('4'),
    soliWithheld: g('5'),
    churchTaxWithheld: g('7') + g('8'),
    incomeTaxSpecial: g('11'),
    soliSpecial: g('12'),
    churchTaxSpecial: g('13') + g('14'),
    specialIncome: g('9') + g('10'),
    dbaIncome: g('6'),
    lohnReplacement: g('15'),
    agCommuteUntaxed: g('17'),
    pensionEmployer: g('22a'),
    pensionEmployee: g('23a'),
    healthInsuranceEmployee: g('25'),
    careInsuranceEmployee: g('26'),
    unemploymentInsuranceEmployee: g('27'),
    privateHealthCare: g('28'),
  };
}

/** Rebuild a field list from stored aggregate data (migration for old sessions). */
export function dataToFields(data: LohnsteuerData): ParsedField[] {
  const map: Record<string, number> = {
    '3': data.grossSalary,
    '4': data.incomeTaxWithheld,
    '5': data.soliWithheld,
    '7': data.churchTaxWithheld,
    '11': data.incomeTaxSpecial,
    '12': data.soliSpecial,
    '10': data.specialIncome,
    '6': data.dbaIncome,
    '15': data.lohnReplacement,
    '17': data.agCommuteUntaxed,
    '22a': data.pensionEmployer,
    '23a': data.pensionEmployee,
    '25': data.healthInsuranceEmployee,
    '26': data.careInsuranceEmployee,
    '27': data.unemploymentInsuranceEmployee,
    '28': data.privateHealthCare,
  };
  return RULES.map((rule) => ({
    line: rule.line,
    label: rule.label,
    germanLabel: rule.germanLabel,
    value: map[rule.line] ?? 0,
    confidence: 'medium' as const,
    used: rule.used,
  }));
}
