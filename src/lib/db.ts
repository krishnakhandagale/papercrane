import * as SQLite from 'expo-sqlite';

export type DocRow = {
  id: number;
  name: string;
  created_at: number;
  updated_at: number;
  page_count: number;
  thumb: string | null; // relative path of first page
};

export type PageRow = {
  id: number;
  doc_id: number;
  position: number;
  path: string; // relative to the app's document directory
  text: string | null; // OCR result; null = not processed yet
};

let dbPromise: Promise<SQLite.SQLiteDatabase> | null = null;

export function getDb() {
  if (!dbPromise) {
    dbPromise = (async () => {
      const db = await SQLite.openDatabaseAsync('docscanner.db');
      await db.execAsync(`
        PRAGMA journal_mode = WAL;
        PRAGMA foreign_keys = ON;
        CREATE TABLE IF NOT EXISTS documents (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL,
          created_at INTEGER NOT NULL,
          updated_at INTEGER NOT NULL
        );
        CREATE TABLE IF NOT EXISTS pages (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          doc_id INTEGER NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
          position INTEGER NOT NULL,
          path TEXT NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_pages_doc ON pages(doc_id, position);
      `);
      await migrate(db);
      return db;
    })();
  }
  return dbPromise;
}

async function migrate(db: SQLite.SQLiteDatabase) {
  const row = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
  let version = row?.user_version ?? 0;
  if (version < 1) {
    await db.execAsync('ALTER TABLE pages ADD COLUMN text TEXT');
    version = 1;
  }
  await db.execAsync(`PRAGMA user_version = ${version}`);
}

/** Escapes LIKE wildcards so a search for "50%" matches literally. */
const likeArg = (s: string) => `%${s.replace(/[\\%_]/g, (c) => '\\' + c)}%`;

/** @param searchText also match documents whose recognized page text contains `search` (Pro). */
export async function listDocs(search = '', searchText = false): Promise<DocRow[]> {
  const db = await getDb();
  const q = likeArg(search.trim());
  return db.getAllAsync<DocRow>(
    `SELECT d.*,
       (SELECT COUNT(*) FROM pages p WHERE p.doc_id = d.id) AS page_count,
       (SELECT path FROM pages p WHERE p.doc_id = d.id ORDER BY position LIMIT 1) AS thumb
     FROM documents d
     WHERE d.name LIKE ? ESCAPE '\\'
        ${searchText ? "OR EXISTS (SELECT 1 FROM pages p WHERE p.doc_id = d.id AND p.text LIKE ? ESCAPE '\\')" : ''}
     ORDER BY d.updated_at DESC`,
    searchText ? [q, q] : [q]
  );
}

export async function getUnindexedPages(limit = 20) {
  const db = await getDb();
  return db.getAllAsync<PageRow>('SELECT * FROM pages WHERE text IS NULL ORDER BY id LIMIT ?', limit);
}

export async function setPageText(pageId: number, text: string) {
  const db = await getDb();
  await db.runAsync('UPDATE pages SET text = ? WHERE id = ?', text, pageId);
}

export async function getDoc(id: number) {
  const db = await getDb();
  return db.getFirstAsync<{ id: number; name: string; created_at: number; updated_at: number }>(
    'SELECT * FROM documents WHERE id = ?',
    id
  );
}

export async function getPages(docId: number): Promise<PageRow[]> {
  const db = await getDb();
  return db.getAllAsync<PageRow>('SELECT * FROM pages WHERE doc_id = ? ORDER BY position', docId);
}

export async function createDoc(name: string): Promise<number> {
  const db = await getDb();
  const now = Date.now();
  const r = await db.runAsync(
    'INSERT INTO documents (name, created_at, updated_at) VALUES (?, ?, ?)',
    name,
    now,
    now
  );
  return r.lastInsertRowId;
}

export async function addPages(docId: number, paths: string[]) {
  const db = await getDb();
  await db.withTransactionAsync(async () => {
    const row = await db.getFirstAsync<{ maxPos: number | null }>(
      'SELECT MAX(position) AS maxPos FROM pages WHERE doc_id = ?',
      docId
    );
    let pos = (row?.maxPos ?? -1) + 1;
    for (const path of paths) {
      await db.runAsync('INSERT INTO pages (doc_id, position, path) VALUES (?, ?, ?)', docId, pos++, path);
    }
    await db.runAsync('UPDATE documents SET updated_at = ? WHERE id = ?', Date.now(), docId);
  });
}

export async function renameDoc(id: number, name: string) {
  const db = await getDb();
  await db.runAsync('UPDATE documents SET name = ?, updated_at = ? WHERE id = ?', name, Date.now(), id);
}

export async function deleteDoc(id: number) {
  const db = await getDb();
  await db.runAsync('DELETE FROM documents WHERE id = ?', id);
}

export async function countDocs(): Promise<number> {
  const db = await getDb();
  const row = await db.getFirstAsync<{ n: number }>('SELECT COUNT(*) AS n FROM documents');
  return row?.n ?? 0;
}
