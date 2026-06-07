// OCR fallback via tesseract.js, for scanned/image-only Lohnsteuerbescheinigungen.
// The German language model is fetched on demand; everything runs client-side.

import Tesseract from 'tesseract.js';

export type OcrProgress = (status: string, progress: number) => void;

/** Run OCR over one or more rendered page canvases and return the combined text. */
export async function ocrCanvases(
  canvases: HTMLCanvasElement[],
  onProgress?: OcrProgress,
): Promise<string> {
  const worker = await Tesseract.createWorker('deu', 1, {
    logger: (m) => {
      if (onProgress && typeof m.progress === 'number') {
        onProgress(m.status, m.progress);
      }
    },
  });

  try {
    const parts: string[] = [];
    for (const canvas of canvases) {
      const { data } = await worker.recognize(canvas);
      parts.push(data.text);
    }
    return parts.join('\n');
  } finally {
    await worker.terminate();
  }
}
