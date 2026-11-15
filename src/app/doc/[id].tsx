import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';
import { router, Stack, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { deleteDoc, getDoc, getPages, renameDoc, type PageRow } from '@/lib/db';
import { deleteDocFiles, toUri } from '@/lib/storage';
import { sharePdf } from '@/lib/pdf';
import { importPages, scanPages } from '@/lib/scanner';
import { setDraft } from '@/lib/draft';
import { usePro } from '@/lib/pro';

export default function DocScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const docId = Number(id);
  const [name, setName] = useState('');
  const [pages, setPages] = useState<PageRow[]>([]);
  const [index, setIndex] = useState(0);
  const [exporting, setExporting] = useState(false);
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const { isPro } = usePro();

  useFocusEffect(
    useCallback(() => {
      (async () => {
        const doc = await getDoc(docId);
        if (!doc) return router.back();
        setName(doc.name);
        setPages(await getPages(docId));
      })().catch(console.error);
    }, [docId])
  );

  async function onExport() {
    setExporting(true);
    try {
      await sharePdf(name, pages.map((p) => toUri(p.path)), !isPro);
    } catch (e) {
      Alert.alert('Export failed', String(e));
    } finally {
      setExporting(false);
    }
  }

  function onAddPages() {
    Alert.alert('Add pages', undefined, [
      { text: 'Scan', onPress: () => add('scan') },
      { text: 'Import from photos', onPress: () => add('import') },
      { text: 'Cancel', style: 'cancel' },
    ]);
  }

  async function add(source: 'scan' | 'import') {
    const uris = source === 'scan' ? await scanPages() : await importPages();
    if (!uris.length) return;
    setDraft(uris);
    router.push({ pathname: '/review', params: { docId: String(docId) } });
  }

  function onText() {
    if (isPro) router.push(`/text/${docId}`);
    else router.push({ pathname: '/paywall', params: { reason: 'ocr' } });
  }

  function onDelete() {
    Alert.alert('Delete document?', `“${name}” will be permanently deleted.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await deleteDoc(docId);
          deleteDocFiles(docId);
          router.back();
        },
      },
    ]);
  }

  return (
    <View style={styles.container}>
      <Stack.Screen
        options={{
          title: '',
          headerRight: () => (
            <Pressable onPress={onDelete} hitSlop={8}>
              <Text style={styles.deleteText}>Delete</Text>
            </Pressable>
          ),
        }}
      />
      <TextInput
        style={styles.title}
        value={name}
        onChangeText={setName}
        onEndEditing={() => name.trim() && renameDoc(docId, name.trim())}
        returnKeyType="done"
      />
      <FlatList
        data={pages}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        keyExtractor={(p) => String(p.id)}
        onMomentumScrollEnd={(e) => setIndex(Math.round(e.nativeEvent.contentOffset.x / width))}
        renderItem={({ item }) => (
          <View style={{ width, padding: 16 }}>
            <Image source={{ uri: toUri(item.path) }} style={styles.page} resizeMode="contain" />
          </View>
        )}
      />
      <Text style={styles.counter}>
        {pages.length ? `${index + 1} / ${pages.length}` : ''}
      </Text>
      <View style={[styles.bar, { paddingBottom: insets.bottom + 12 }]}>
        <Action label="Add pages" onPress={onAddPages} />
        <Action label={isPro ? 'Text' : 'Text 🔒'} onPress={onText} />
        <Pressable style={[styles.primary, exporting && { opacity: 0.6 }]} onPress={onExport} disabled={exporting}>
          {exporting ? <ActivityIndicator color="white" /> : <Text style={styles.primaryText}>Share PDF</Text>}
        </Pressable>
      </View>
    </View>
  );
}

function Action({ label, onPress, danger }: { label: string; onPress: () => void; danger?: boolean }) {
  return (
    <Pressable style={styles.action} onPress={onPress}>
      <Text style={[styles.actionText, danger && { color: '#dc2626' }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f1f5f9' },
  title: { fontSize: 22, fontWeight: '700', paddingHorizontal: 16, paddingTop: 8, color: '#0f172a' },
  page: { flex: 1, borderRadius: 8, backgroundColor: 'white' },
  counter: { textAlign: 'center', color: '#64748b', paddingVertical: 6 },
  bar: { flexDirection: 'row', gap: 8, paddingHorizontal: 12, paddingTop: 12, backgroundColor: 'white' },
  action: { flex: 1, paddingVertical: 14, borderRadius: 12, alignItems: 'center', backgroundColor: '#f1f5f9' },
  actionText: { fontSize: 15, fontWeight: '600', color: '#2563eb' },
  primary: { flex: 1.3, paddingVertical: 14, borderRadius: 12, alignItems: 'center', backgroundColor: '#2563eb' },
  deleteText: { color: '#dc2626', fontSize: 16, fontWeight: '500' },
  primaryText: { color: 'white', fontSize: 15, fontWeight: '600' },
});
