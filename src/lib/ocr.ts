import { getUnindexedPages, setPageText } from './db';
import { toUri } from './storage';

type Extractor = typeof import('expo-text-extractor');

let extractor: Extractor | null | undefined;

/** Lazily loads the native OCR module (missing in Expo Go / web, where requiring it throws). */
function getExtractor(): Extractor | null {
  if (extractor === undefined) {
    try {
      const mod: Extractor = require('expo-text-extractor');
      extractor = mod.isSupported ? mod : null;
    } catch {
      extractor = null;
    }
  }
  return extractor;
}

export function ocrAvailable() {
  return getExtractor() !== null;
}

/** Recognizes text in one image, on-device. Returns '' if nothing found or OCR unavailable. */
export async function recognize(uri: string): Promise<string> {
  const ex = getExtractor();
  if (!ex) return '';
  const lines = await ex.extractTextFromImage(uri);
  return lines.map((l) => l.trim()).filter(Boolean).join('\n');
}

let running: Promise<void> | null = null;

/**
 * Runs OCR on every saved page that hasn't been processed yet, one at a time,
 * in the background. Safe to call often: concurrent calls share one run.
 */
export function indexPendingPages(): Promise<void> {
  if (!ocrAvailable()) return Promise.resolve();
  if (!running) {
    running = (async () => {
      try {
        for (;;) {
          const batch = await getUnindexedPages();
          if (batch.length === 0) break;
          for (const page of batch) {
            let text = '';
            try {
              text = await recognize(toUri(page.path));
            } catch (e) {
              console.warn('[ocr] failed for page', page.id, e);
            }
            // Store '' on failure too, so a bad image isn't retried forever.
            await setPageText(page.id, text);
          }
        }
      } finally {
        running = null;
      }
    })();
  }
  return running;
}
