import { useCallback, useState } from 'react';
import { FlatList, Image, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { router, Stack, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { countDocs, listDocs, type DocRow } from '@/lib/db';
import { toUri } from '@/lib/storage';
import { importPages, scanPages } from '@/lib/scanner';
import { setDraft } from '@/lib/draft';
import { usePro } from '@/lib/pro';
import { FREE_DOC_LIMIT } from '@/lib/config';

export default function Home() {
  const [docs, setDocs] = useState<DocRow[]>([]);
  const [search, setSearch] = useState('');
  const insets = useSafeAreaInsets();
  const { isPro } = usePro();

  useFocusEffect(
    useCallback(() => {
      listDocs(search, isPro).then(setDocs).catch(console.error);
    }, [search, isPro])
  );

  async function start(source: 'scan' | 'import') {
    if (!isPro && (await countDocs()) >= FREE_DOC_LIMIT) {
      router.push({ pathname: '/paywall', params: { reason: 'limit' } });
      return;
    }
    const uris = source === 'scan' ? await scanPages() : await importPages();
    if (uris.length === 0) return;
    setDraft(uris);
    router.push('/review');
  }

  return (
    <View style={styles.container}>
      <Stack.Screen
        options={{
          headerRight: () => (
            <Pressable onPress={() => router.push('/paywall')} hitSlop={8}>
              <Text style={[styles.proBadge, isPro && styles.proBadgeActive]}>{isPro ? 'PRO ✓' : 'Go Pro'}</Text>
            </Pressable>
          ),
        }}
      />
      <TextInput
        style={styles.search}
        placeholder={isPro ? 'Search names and text' : 'Search documents'}
        value={search}
        onChangeText={setSearch}
        clearButtonMode="while-editing"
      />
      <FlatList
        data={docs}
        keyExtractor={(d) => String(d.id)}
        contentContainerStyle={docs.length === 0 && styles.emptyWrap}
        ListEmptyComponent={
          <Text style={styles.empty}>
            {search ? 'No matching documents.' : 'No documents yet.\nTap “Scan” to get started.'}
          </Text>
        }
        renderItem={({ item }) => (
          <Pressable style={styles.row} onPress={() => router.push(`/doc/${item.id}`)}>
            {item.thumb ? (
              <Image source={{ uri: toUri(item.thumb) }} style={styles.thumb} />
            ) : (
              <View style={[styles.thumb, styles.thumbEmpty]} />
            )}
            <View style={{ flex: 1 }}>
              <Text style={styles.name} numberOfLines={1}>
                {item.name}
              </Text>
              <Text style={styles.meta}>
                {new Date(item.updated_at).toLocaleDateString()} · {item.page_count}{' '}
                {item.page_count === 1 ? 'page' : 'pages'}
              </Text>
            </View>
          </Pressable>
        )}
      />
      <View style={[styles.bar, { paddingBottom: insets.bottom + 12 }]}>
        <Pressable style={[styles.btn, styles.btnSecondary]} onPress={() => start('import')}>
          <Text style={[styles.btnText, { color: '#2563eb' }]}>Import</Text>
        </Pressable>
        <Pressable style={[styles.btn, styles.btnPrimary]} onPress={() => start('scan')}>
          <Text style={styles.btnText}>Scan</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  proBadge: {
    color: 'white',
    backgroundColor: '#f59e0b',
    fontWeight: '700',
    fontSize: 13,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    overflow: 'hidden',
  },
  proBadgeActive: { backgroundColor: '#16a34a' },
  search: {
    margin: 12,
    padding: 10,
    borderRadius: 10,
    backgroundColor: '#e2e8f0',
    fontSize: 16,
  },
  emptyWrap: { flexGrow: 1, justifyContent: 'center' },
  empty: { textAlign: 'center', color: '#64748b', fontSize: 16, lineHeight: 24 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: 'white',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: '#e2e8f0',
  },
  thumb: { width: 48, height: 64, borderRadius: 4, backgroundColor: '#e2e8f0' },
  thumbEmpty: { borderWidth: 1, borderColor: '#cbd5e1' },
  name: { fontSize: 16, fontWeight: '600', color: '#0f172a' },
  meta: { fontSize: 13, color: '#64748b', marginTop: 2 },
  bar: { flexDirection: 'row', gap: 12, paddingHorizontal: 16, paddingTop: 12, backgroundColor: 'white' },
  btn: { flex: 1, paddingVertical: 14, borderRadius: 12, alignItems: 'center' },
  btnPrimary: { backgroundColor: '#2563eb' },
  btnSecondary: { backgroundColor: '#dbeafe' },
  btnText: { color: 'white', fontSize: 17, fontWeight: '600' },
});
