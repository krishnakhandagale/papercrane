import { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, Share, StyleSheet, Text, View } from 'react-native';
import { Stack, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Clipboard from 'expo-clipboard';
import { getDoc, getPages, setPageText } from '@/lib/db';
import { ocrAvailable, recognize } from '@/lib/ocr';
import { toUri } from '@/lib/storage';

type PageText = { id: number; text: string };

export default function TextScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const docId = Number(id);
  const insets = useSafeAreaInsets();
  const [name, setName] = useState('');
  const [pages, setPages] = useState<PageText[] | null>(null);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      (async () => {
        const doc = await getDoc(docId);
        setName(doc?.name ?? '');
        const rows = await getPages(docId);
        const out: PageText[] = [];
        for (const p of rows) {
          let text = p.text;
          // Not indexed yet (e.g. just saved): recognize now instead of waiting for the background job.
          if (text === null) {
            text = await recognize(toUri(p.path)).catch(() => '');
            await setPageText(p.id, text);
          }
          out.push({ id: p.id, text });
        }
        if (!cancelled) setPages(out);
      })().catch((e) => Alert.alert('Could not read text', String(e)));
      return () => {
        cancelled = true;
      };
    }, [docId])
  );

  const allText = (pages ?? [])
    .map((p, i) => (pages!.length > 1 ? `— Page ${i + 1} —\n${p.text}` : p.text))
    .join('\n\n');
  const hasText = (pages ?? []).some((p) => p.text.length > 0);

  async function copyAll() {
    await Clipboard.setStringAsync(allText);
    Alert.alert('Copied', 'The text is on your clipboard.');
  }

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ title: name ? `Text · ${name}` : 'Text' }} />
      {pages === null ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" />
          <Text style={styles.muted}>Reading text…</Text>
        </View>
      ) : !hasText ? (
        <View style={styles.center}>
          <Text style={styles.muted}>
            {ocrAvailable()
              ? 'No text was found in this document.'
              : 'Text recognition needs a development build (not available in Expo Go).'}
          </Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={{ padding: 16, gap: 16 }}>
          {pages.map((p, i) => (
            <View key={p.id} style={styles.card}>
              <View style={styles.cardHeader}>
                <Text style={styles.pageLabel}>Page {i + 1}</Text>
                {p.text.length > 0 && (
                  <Pressable onPress={() => Clipboard.setStringAsync(p.text)} hitSlop={8}>
                    <Text style={styles.link}>Copy</Text>
                  </Pressable>
                )}
              </View>
              <Text selectable style={styles.body}>
                {p.text || 'No text on this page.'}
              </Text>
            </View>
          ))}
        </ScrollView>
      )}
      {hasText && (
        <View style={[styles.bar, { paddingBottom: insets.bottom + 12 }]}>
          <Pressable style={[styles.btn, styles.secondary]} onPress={() => Share.share({ message: allText, title: name })}>
            <Text style={styles.secondaryText}>Share text</Text>
          </Pressable>
          <Pressable style={[styles.btn, styles.primary]} onPress={copyAll}>
            <Text style={styles.primaryText}>Copy all</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f1f5f9' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 12 },
  muted: { color: '#64748b', fontSize: 15, textAlign: 'center' },
  card: { backgroundColor: 'white', borderRadius: 12, padding: 14 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  pageLabel: { fontWeight: '700', color: '#334155' },
  body: { fontSize: 16, lineHeight: 23, color: '#0f172a' },
  link: { color: '#2563eb', fontWeight: '600' },
  bar: { flexDirection: 'row', gap: 8, paddingHorizontal: 12, paddingTop: 12, backgroundColor: 'white' },
  btn: { flex: 1, paddingVertical: 14, borderRadius: 12, alignItems: 'center' },
  primary: { backgroundColor: '#2563eb' },
  secondary: { backgroundColor: '#dbeafe' },
  primaryText: { color: 'white', fontSize: 16, fontWeight: '600' },
  secondaryText: { color: '#2563eb', fontSize: 16, fontWeight: '600' },
});
