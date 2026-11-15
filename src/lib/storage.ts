import { Directory, File, Paths } from 'expo-file-system';

// We store paths RELATIVE to the document directory, because on iOS the
// absolute app container path changes between app updates.
const SCANS = 'scans';

function docDir(docId: number) {
  return new Directory(Paths.document, SCANS, String(docId));
}

export function toUri(relPath: string) {
  return new File(Paths.document, ...relPath.split('/')).uri;
}

function normalize(uri: string) {
  return uri.startsWith('file://') || uri.includes('://') ? uri : `file://${uri}`;
}

/** Copies temporary images (scanner/picker/cache) into permanent storage. Returns relative paths. */
export async function persistImages(docId: number, tempUris: string[]): Promise<string[]> {
  const dir = docDir(docId);
  if (!dir.exists) dir.create({ intermediates: true, idempotent: true });
  const out: string[] = [];
  for (const uri of tempUris) {
    const name = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.jpg`;
    const src = new File(normalize(uri));
    await src.copy(new File(dir, name));
    out.push(`${SCANS}/${docId}/${name}`);
  }
  return out;
}

export function deleteDocFiles(docId: number) {
  const dir = docDir(docId);
  if (dir.exists) dir.delete();
}

export { normalize as normalizeUri };
