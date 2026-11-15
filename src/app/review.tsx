import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { takeDraft } from '@/lib/draft';
import { rotateImage } from '@/lib/images';
import { importPages, scanPages } from '@/lib/scanner';
import { addPages, createDoc } from '@/lib/db';
import { persistImages } from '@/lib/storage';
import { indexPendingPages } from '@/lib/ocr';

type Page = { key: string; uri: string };

let keySeq = 0;
const toPages = (uris: string[]): Page[] => uris.map((uri) => ({ key: String(keySeq++), uri }));

function defaultName() {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `Scan ${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}.${pad(d.getMinutes())}`;
}

export default function Review() {
  // When docId is set we're appending pages to an existing document.
  const { docId } = useLocalSearchParams<{ docId?: string }>();
  const [pages, setPages] = useState<Page[]>(() => toPages(takeDraft()));
  const [name, setName] = useState(defaultName);
  const [busy, setBusy] = useState(false);
  const insets = useSafeAreaInsets();

  function move(i: number, dir: -1 | 1) {
    const j = i + dir;
    if (j < 0 || j >= pages.length) return;
    const next = [...pages];
    [next[i], next[j]] = [next[j], next[i]];
    setPages(next);
  }

  async function rotate(i: number) {
    try {
      const uri = await rotateImage(pages[i].uri);
      setPages((p) => p.map((pg, idx) => (idx === i ? { ...pg, uri } : pg)));
    } catch (e) {
      Alert.alert('Could not rotate', String(e));
    }
  }

  async function addMore(source: 'scan' | 'import') {
    const uris = source === 'scan' ? await scanPages() : await importPages();
    if (uris.length) setPages((p) => [...p, ...toPages(uris)]);
  }

  async function save() {
    if (pages.length === 0) return;
    setBusy(true);
    try {
      const id = docId ? Number(docId) : await createDoc(name.trim() || defaultName());
      const paths = await persistImages(id, pages.map((p) => p.uri));
      await addPages(id, paths);
      indexPendingPages().catch(console.warn); // OCR in the background
      router.dismiss();
      if (!docId) router.push(`/doc/${id}`);
    } catch (e) {
      Alert.alert('Could not save', String(e));
      setBusy(false);
    }
  }

  return (
    <View style={styles.container}>
      {!docId && (
        <TextInput style={styles.nameInput} value={name} onChangeText={setName} placeholder="Document name" />
      )}
      <FlatList
        data={pages}
        keyExtractor={(p) => p.key}
        contentContainerStyle={{ padding: 12, gap: 12 }}
        ListEmptyComponent={<Text style={styles.empty}>No pages. Add some below.</Text>}
        renderItem={({ item, index }) => (
          <View style={styles.card}>
            <Image source={{ uri: item.uri }} style={styles.preview} resizeMode="contain" />
            <View style={styles.tools}>
              <Text style={styles.pageNo}>Page {index + 1}</Text>
              <Tool label="↑" onPress={() => move(index, -1)} disabled={index === 0} />
              <Tool label="↓" onPress={() => move(index, 1)} disabled={index === pages.length - 1} />
              <Tool label="⟳" onPress={() => rotate(index)} />
              <Tool
                label="🗑"
                onPress={() => setPages((p) => p.filter((_, idx) => idx !== index))}
              />
            </View>
          </View>
        )}
      />
      <View style={[styles.bar, { paddingBottom: insets.bottom + 12 }]}>
        <Pressable style={[styles.btn, styles.btnSecondary]} onPress={() => addMore('scan')}>
          <Text style={styles.btnSecondaryText}>+ Scan</Text>
        </Pressable>
        <Pressable style={[styles.btn, styles.btnSecondary]} onPress={() => addMore('import')}>
          <Text style={styles.btnSecondaryText}>+ Import</Text>
        </Pressable>
        <Pressable
          style={[styles.btn, styles.btnPrimary, (busy || !pages.length) && { opacity: 0.5 }]}
          onPress={save}
          disabled={busy || !pages.length}
        >
          {busy ? <ActivityIndicator color="white" /> : <Text style={styles.btnText}>Save</Text>}
        </Pressable>
      </View>
    </View>
  );
}

function Tool({ label, onPress, disabled }: { label: string; onPress: () => void; disabled?: boolean }) {
  return (
    <Pressable onPress={onPress} disabled={disabled} style={[styles.tool, disabled && { opacity: 0.3 }]} hitSlop={6}>
      <Text style={styles.toolText}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f1f5f9' },
  nameInput: {
    margin: 12,
    marginBottom: 0,
    padding: 12,
    borderRadius: 10,
    backgroundColor: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  empty: { textAlign: 'center', color: '#64748b', marginTop: 40 },
  card: { backgroundColor: 'white', borderRadius: 12, overflow: 'hidden' },
  preview: { width: '100%', height: 320, backgroundColor: '#e2e8f0' },
  tools: { flexDirection: 'row', alignItems: 'center', padding: 8, gap: 8 },
  pageNo: { flex: 1, color: '#334155', fontWeight: '600' },
  tool: { width: 40, height: 36, borderRadius: 8, backgroundColor: '#f1f5f9', alignItems: 'center', justifyContent: 'center' },
  toolText: { fontSize: 18 },
  bar: { flexDirection: 'row', gap: 8, paddingHorizontal: 12, paddingTop: 12, backgroundColor: 'white' },
  btn: { flex: 1, paddingVertical: 14, borderRadius: 12, alignItems: 'center' },
  btnPrimary: { backgroundColor: '#2563eb' },
  btnSecondary: { backgroundColor: '#dbeafe' },
  btnText: { color: 'white', fontSize: 16, fontWeight: '600' },
  btnSecondaryText: { color: '#2563eb', fontSize: 16, fontWeight: '600' },
});
