# German Tax Helper 🇩🇪

An **English-first**, fully client-side assistant for the German income-tax
return (Einkommensteuererklärung), aimed at Indians living and working in
Germany. It’s an **educational tool, not tax advice**.

> Every section shows the official German **Anlage** name in English context, so
> you can cross-reference with the paper forms and [ELSTER](https://www.elster.de).

## Principles

- **Private by design.** No backend, no accounts. Your documents are parsed in
  the browser and **never leave your device**.
- **Your data, your control.** State lives in `localStorage` with a one-click
  **“Delete my data”** button.
- **Transparent.** Every euro in the estimate comes with a plain-English
  explanation of how it was derived.

## MVP scope (Phase 1)

German salaried, **full-year resident**, **tax year 2025**:

1. **Profile** — assessment type (single vs. *Zusammenveranlagung*), federal
   state, church membership (*Kirchensteuer*), children.
2. **Wage statement** — upload the *Lohnsteuerbescheinigung* PDF; parsed into
   **Anlage N** + **Anlage Vorsorgeaufwand** with an editable review table.
   Prompts for helpful follow-up documents.
3. **Deductions** — commute (*Entfernungspauschale*), home-office flat rate,
   work equipment, donations, insurance.
4. **Estimate** — per-Anlage values, plain-English explanations, and an
   estimated refund / additional payment.

## Tech

- **Vite + React + TypeScript + Tailwind**, static deploy.
- **Parsing:** [pdf.js](https://mozilla.github.io/pdf.js/) for text extraction,
  with a [tesseract.js](https://tesseract.projectnaptha.com/) **OCR fallback**
  for scanned/image PDFs → a **rules layer** mapping the numbered
  Lohnsteuerbescheinigung lines to form fields.
- **Tax engine:** the official §32a EStG 2025 tariff (basic + splitting),
  solidarity surcharge, and church tax.

### Project layout

```
src/
  lib/
    parsing/   pdf.ts · ocr.ts · lohnsteuer.ts (numbered-line rules)
    tax/       incomeTax.ts · deductions.ts · estimate.ts
    storage.ts · format.ts
  state/store.tsx        Context + reducer, auto-persisted to localStorage
  components/            AnlageBadge · NumberField · Stepper
  features/              ProfileStep · UploadStep · DeductionsStep · ResultsStep
```

## Develop

```bash
npm install
npm run dev        # local dev server
npm run build      # typecheck + production build
npm run preview    # preview the production build
```

## Deferred (later phases)

- **Indian income:** RSU/ESPP (GSU) via Anlage N / **N-AUS**; capital gains via
  Anlage **KAP / KAP-INV / AUS** with India–Germany **DTAA** / foreign-tax credit.
- **Part-year residency.**
- **Special rates:** Progressionsvorbehalt, Abgeltungsteuer (25%), Fünftelregelung.
- **Anlage Kind** (child allowances) and **ELSTER export**.

## Disclaimer

This project provides a **simplified estimate** for educational purposes and is
**not tax advice**. Calculations make simplifying assumptions (e.g. the
Vorsorgeaufwand model). For binding figures, consult a *Steuerberater* or file
via ELSTER.
