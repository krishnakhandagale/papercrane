import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { File, Paths } from 'expo-file-system';
import { toPdfBase64 } from './images';
import { APP_NAME } from './config';

// A4 at 72 PPI
const A4 = { width: 595, height: 842 };

export async function buildPdf(name: string, pageUris: string[], watermark = false): Promise<string> {
  const parts: string[] = [];
  for (const uri of pageUris) {
    // iOS WKWebView can't load local file:// images in print HTML, so inline as base64.
    const b64 = await toPdfBase64(uri);
    const wm = watermark ? `<div class="wm">Scanned with ${APP_NAME}</div>` : '';
    parts.push(`<div class="page"><img src="data:image/jpeg;base64,${b64}" />${wm}</div>`);
  }
  const html = `<!DOCTYPE html><html><head><meta charset="utf-8" />
<style>
  @page { margin: 0; size: A4; }
  html, body { margin: 0; padding: 0; }
  .page { width: 100vw; height: 100vh; display: flex; align-items: center; justify-content: center;
          page-break-after: always; overflow: hidden; position: relative; }
  .page:last-child { page-break-after: auto; }
  img { max-width: 100%; max-height: 100%; object-fit: contain; }
  .wm { position: absolute; bottom: 10px; right: 14px; font: 600 10px -apple-system, Roboto, sans-serif;
        color: #475569; background: rgba(255,255,255,0.85); padding: 3px 8px; border-radius: 4px; }
</style></head><body>${parts.join('')}</body></html>`;

  const { uri } = await Print.printToFileAsync({ html, ...A4, margins: { top: 0, bottom: 0, left: 0, right: 0 } });

  // Give the file a friendly name so it shows up nicely when shared.
  const safe = name.replace(/[^\w\- ]+/g, '').trim() || 'Scan';
  const target = new File(Paths.cache, `${safe}.pdf`);
  if (target.exists) target.delete();
  await new File(uri).move(target);
  return target.uri;
}

export async function sharePdf(name: string, pageUris: string[], watermark = false) {
  const uri = await buildPdf(name, pageUris, watermark);
  await Sharing.shareAsync(uri, { mimeType: 'application/pdf', UTI: 'com.adobe.pdf', dialogTitle: name });
}
