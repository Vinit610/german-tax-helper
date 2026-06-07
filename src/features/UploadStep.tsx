// Step 2 — Upload & parse the Lohnsteuerbescheinigung. Everything runs locally:
// pdf.js extracts text; if the PDF is image-only we fall back to tesseract.js
// OCR. The parsed values then appear in an editable review table.

import { useState } from 'react';
import { AnlageBadge } from '../components/AnlageBadge';
import { NumberField } from '../components/NumberField';
import { extractPdf, hasUsableText } from '../lib/parsing/pdf';
import { ocrCanvases } from '../lib/parsing/ocr';
import { emptyFields, parseLohnsteuer } from '../lib/parsing/lohnsteuer';
import { useStore } from '../state/store';
import type { ParsedField } from '../types';

type Phase = 'idle' | 'reading' | 'ocr' | 'review' | 'error';

const FOLLOW_UP_DOCS = [
  { key: 'health-statement', label: 'Health/care insurance annual statement', german: 'Beitragsbescheinigung Kranken-/Pflegeversicherung' },
  { key: 'donation-receipts', label: 'Donation receipts', german: 'Zuwendungsbestätigungen' },
  { key: 'commute-proof', label: 'Proof of commute (address + work days)', german: 'Nachweis Fahrtkosten' },
  { key: 'equipment-receipts', label: 'Work equipment receipts', german: 'Belege Arbeitsmittel' },
];

export function UploadStep({ onNext, onBack }: { onNext: () => void; onBack: () => void }) {
  const { state, setWageLines, toggleDoc } = useStore();
  const [phase, setPhase] = useState<Phase>(state.wageLines ? 'review' : 'idle');
  const [fields, setFields] = useState<ParsedField[]>(() => state.wageLines ?? emptyFields());
  const [progress, setProgress] = useState(0);
  const [source, setSource] = useState<'pdf' | 'ocr' | 'manual'>(state.wageLines ? 'pdf' : 'manual');
  const [errorMsg, setErrorMsg] = useState('');
  const [showOther, setShowOther] = useState(true);
  const [rawText, setRawText] = useState('');
  const [showRaw, setShowRaw] = useState(false);
  const [copied, setCopied] = useState(false);

  async function handleFile(file: File) {
    setErrorMsg('');
    try {
      setPhase('reading');
      const pages = await extractPdf(file);
      let text = pages.map((p) => p.text).join('\n');
      let src: 'pdf' | 'ocr' = 'pdf';

      if (!hasUsableText(pages)) {
        setPhase('ocr');
        text = await ocrCanvases(
          pages.map((p) => p.canvas),
          (_status, p) => setProgress(Math.round(p * 100)),
        );
        src = 'ocr';
      }

      setRawText(text);
      const result = parseLohnsteuer(text, src);
      setFields(result.fields);
      setSource(result.empty ? 'manual' : src);
      setWageLines(result.fields);
      setPhase('review');
    } catch (err) {
      console.error(err);
      setErrorMsg('Could not read that file. You can enter the values manually below.');
      const ef = emptyFields();
      setFields(ef);
      setWageLines(ef);
      setSource('manual');
      setPhase('review');
    }
  }

  function startManual() {
    const ef = emptyFields();
    setFields(ef);
    setWageLines(ef);
    setSource('manual');
    setPhase('review');
  }

  function updateField(line: string, value: number) {
    const next = fields.map((f) => (f.line === line ? { ...f, value, edited: true } : f));
    setFields(next);
    setWageLines(next);
  }

  const confidenceColor = (c: ParsedField['confidence']) =>
    c === 'high' ? 'text-emerald-600' : c === 'medium' ? 'text-amber-600' : 'text-slate-400';

  return (
    <div className="card space-y-6">
      <header className="space-y-1">
        <div className="flex items-center gap-2">
          <h2 className="text-lg font-semibold">Your wage statement</h2>
          <AnlageBadge name="Lohnsteuerbescheinigung" />
          <span className="text-slate-300">→</span>
          <AnlageBadge name="Anlage N" />
          <AnlageBadge name="Anlage Vorsorgeaufwand" />
        </div>
        <p className="text-sm text-slate-500">
          Upload the PDF your employer gave you (elektronische Lohnsteuerbescheinigung). It’s
          processed entirely on your device — nothing is uploaded.
        </p>
      </header>

      {phase === 'idle' && (
        <div className="space-y-4">
          <label className="flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-300 bg-slate-50 px-6 py-12 text-center transition hover:border-brand-400 hover:bg-brand-50/40">
            <span className="text-sm font-medium text-slate-700">Click to choose a PDF</span>
            <span className="mt-1 text-xs text-slate-400">Scanned image PDFs work too (OCR fallback)</span>
            <input
              type="file"
              accept="application/pdf,image/*"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void handleFile(f);
              }}
            />
          </label>
          <div className="text-center">
            <button className="text-sm text-brand-600 hover:underline" onClick={startManual}>
              or enter the values manually
            </button>
          </div>
        </div>
      )}

      {(phase === 'reading' || phase === 'ocr') && (
        <div className="rounded-xl bg-slate-50 p-6 text-center text-sm text-slate-600">
          {phase === 'reading' ? (
            <p>Reading the PDF…</p>
          ) : (
            <p>
              Scanned PDF detected — running OCR locally{progress > 0 ? ` (${progress}%)` : ''}. This
              can take a moment.
            </p>
          )}
        </div>
      )}

      {phase === 'review' && (
        <div className="space-y-5">
          <div
            className={[
              'rounded-lg px-3 py-2 text-xs',
              source === 'pdf'
                ? 'bg-emerald-50 text-emerald-800'
                : source === 'ocr'
                  ? 'bg-amber-50 text-amber-800'
                  : 'bg-slate-100 text-slate-600',
            ].join(' ')}
          >
            {source === 'pdf' && 'Values read from the PDF text. Please double-check each line below.'}
            {source === 'ocr' && 'Values read via OCR — accuracy varies, so please verify every line.'}
            {source === 'manual' && 'Enter the values from your Lohnsteuerbescheinigung. The line numbers match the form.'}
          </div>

          <div>
            <h3 className="mb-3 text-sm font-semibold text-slate-700">Used in your estimate</h3>
            <div className="grid gap-4 sm:grid-cols-2">
              {fields.filter((f) => f.used).map((f) => (
                <FieldRow key={f.line} field={f} source={source} onChange={updateField} confidenceColor={confidenceColor} />
              ))}
            </div>
          </div>

          {fields.some((f) => !f.used) && (
            <div>
              <button
                type="button"
                onClick={() => setShowOther((v) => !v)}
                className="flex w-full items-center justify-between rounded-lg bg-slate-50 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
              >
                <span>
                  Other lines on your statement
                  <span className="ml-1 font-normal text-slate-400">
                    · captured for reference ({fields.filter((f) => !f.used).length})
                  </span>
                </span>
                <span className="text-slate-400">{showOther ? '▲' : '▼'}</span>
              </button>
              {showOther && (
                <>
                  <p className="mt-2 text-xs text-slate-400">
                    These are informational or already accounted for elsewhere — e.g. amounts already
                    contained in your gross wage (Nr. 3), or tax-free employer benefits that aren’t
                    separately deductible. They’re captured so you can verify them and transfer them
                    when filing.
                  </p>
                  <div className="mt-3 grid gap-4 sm:grid-cols-2">
                    {fields.filter((f) => !f.used).map((f) => (
                      <FieldRow key={f.line} field={f} source={source} onChange={updateField} confidenceColor={confidenceColor} />
                    ))}
                  </div>
                </>
              )}
            </div>
          )}

          <FollowUpChecklist checked={state.followUpDocs} onToggle={toggleDoc} />

          {rawText && (
            <div className="rounded-xl border border-slate-200">
              <button
                type="button"
                onClick={() => setShowRaw((v) => !v)}
                className="flex w-full items-center justify-between px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
              >
                <span>
                  Show extracted text
                  <span className="ml-1 font-normal text-slate-400">· debug — what the parser read</span>
                </span>
                <span className="text-slate-400">{showRaw ? '▲' : '▼'}</span>
              </button>
              {showRaw && (
                <div className="space-y-2 border-t border-slate-100 p-3">
                  <p className="text-xs text-slate-400">
                    If a value parsed wrong, copy this text and share it so the parser can be tuned to
                    your exact statement. It stays on your device — copying is up to you.
                  </p>
                  <button
                    type="button"
                    className="btn-ghost px-3 py-1 text-xs"
                    onClick={() => {
                      navigator.clipboard?.writeText(rawText).then(
                        () => {
                          setCopied(true);
                          setTimeout(() => setCopied(false), 1500);
                        },
                        () => setCopied(false),
                      );
                    }}
                  >
                    {copied ? 'Copied ✓' : 'Copy text'}
                  </button>
                  <pre className="max-h-64 overflow-auto whitespace-pre-wrap rounded bg-slate-900/95 p-3 text-xs text-slate-100">
                    {rawText}
                  </pre>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {errorMsg && <p className="text-sm text-rose-600">{errorMsg}</p>}

      <div className="flex justify-between">
        <button className="btn-ghost" onClick={onBack}>
          ← Back
        </button>
        <button className="btn-primary" disabled={phase !== 'review'} onClick={onNext}>
          Continue →
        </button>
      </div>
    </div>
  );
}

function FieldRow({
  field: f,
  source,
  onChange,
  confidenceColor,
}: {
  field: ParsedField;
  source: 'pdf' | 'ocr' | 'manual';
  onChange: (line: string, value: number) => void;
  confidenceColor: (c: ParsedField['confidence']) => string;
}) {
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-slate-400">Line {f.line}</span>
        {source !== 'manual' && (
          <span className={`text-xs ${confidenceColor(f.confidence)}`}>
            {f.edited ? 'edited' : f.confidence}
          </span>
        )}
      </div>
      <NumberField
        label={f.label}
        germanLabel={f.germanLabel}
        value={f.value}
        onChange={(v) => onChange(f.line, v)}
      />
    </div>
  );
}

function FollowUpChecklist({
  checked,
  onToggle,
}: {
  checked: Record<string, boolean>;
  onToggle: (key: string) => void;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
      <h3 className="text-sm font-semibold text-slate-700">Helpful follow-up documents</h3>
      <p className="mt-0.5 text-xs text-slate-500">
        Optional — gather these to maximise your deductions in the next step.
      </p>
      <ul className="mt-3 space-y-2">
        {FOLLOW_UP_DOCS.map((doc) => (
          <li key={doc.key}>
            <label className="flex items-start gap-3 text-sm">
              <input
                type="checkbox"
                className="mt-0.5 h-4 w-4 rounded border-slate-300"
                checked={!!checked[doc.key]}
                onChange={() => onToggle(doc.key)}
              />
              <span>
                {doc.label}
                <span className="ml-1 text-xs text-slate-400">· {doc.german}</span>
              </span>
            </label>
          </li>
        ))}
      </ul>
    </div>
  );
}
