// PDF text extraction via pdf.js. Runs entirely in the browser; the file is
// read with FileReader and never uploaded anywhere.

import * as pdfjsLib from 'pdfjs-dist';
// Vite resolves this to a hashed asset URL for the worker bundle.
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl;

export interface PageRender {
  /** Concatenated text content of the page. */
  text: string;
  /** A rendered canvas (used as OCR input when text extraction is sparse). */
  canvas: HTMLCanvasElement;
}

/** Extract text from every page; also render each page for a possible OCR pass. */
export async function extractPdf(file: File): Promise<PageRender[]> {
  const buffer = await file.arrayBuffer();
  const doc = await pdfjsLib.getDocument({ data: buffer }).promise;
  const pages: PageRender[] = [];

  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    const text = content.items
      .map((item) => ('str' in item ? item.str : ''))
      .join(' ');

    // Render to canvas at 2x scale for OCR fallback quality.
    const viewport = page.getViewport({ scale: 2 });
    const canvas = document.createElement('canvas');
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      await page.render({ canvasContext: ctx, viewport }).promise;
    }

    pages.push({ text, canvas });
  }

  return pages;
}

/** Heuristic: does the extracted text look like real content or an image-only PDF? */
export function hasUsableText(pages: PageRender[]): boolean {
  const total = pages.reduce((n, p) => n + p.text.replace(/\s/g, '').length, 0);
  return total > 80;
}
