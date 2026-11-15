// In-memory hand-off of freshly scanned/imported pages to the review screen.
// (Avoids stuffing long file URIs into route params.)
let pending: string[] = [];

export function setDraft(uris: string[]) {
  pending = uris;
}

export function takeDraft(): string[] {
  const out = pending;
  pending = [];
  return out;
}
