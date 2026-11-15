import { useEffect } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { ProProvider } from '@/lib/pro';
import { indexPendingPages } from '@/lib/ocr';

export default function RootLayout() {
  // Catch up on OCR for any pages saved before (or interrupted).
  useEffect(() => {
    indexPendingPages().catch(console.warn);
  }, []);

  return (
    <ProProvider>
      <StatusBar style="auto" />
      <Stack screenOptions={{ headerTintColor: '#2563eb' }}>
        <Stack.Screen name="index" options={{ title: 'Documents' }} />
        <Stack.Screen name="review" options={{ title: 'Review pages', presentation: 'modal' }} />
        <Stack.Screen name="doc/[id]" options={{ title: '' }} />
        <Stack.Screen name="text/[id]" options={{ title: 'Text' }} />
        <Stack.Screen name="paywall" options={{ title: '', presentation: 'modal' }} />
      </Stack>
    </ProProvider>
  );
}
