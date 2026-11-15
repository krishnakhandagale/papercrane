import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { PACKAGE_TYPE, type PurchasesPackage } from 'react-native-purchases';
import { usePro } from '@/lib/pro';
import { APP_NAME, FREE_DOC_LIMIT, PRIVACY_URL, TERMS_URL } from '@/lib/config';

const BENEFITS = [
  'Unlimited documents',
  'No watermark on PDFs',
  'Copy text from any scan',
  'Search inside your documents',
  'Everything stays private on your device',
];

const ORDER: PACKAGE_TYPE[] = [
  PACKAGE_TYPE.ANNUAL,
  PACKAGE_TYPE.SIX_MONTH,
  PACKAGE_TYPE.THREE_MONTH,
  PACKAGE_TYPE.MONTHLY,
  PACKAGE_TYPE.WEEKLY,
  PACKAGE_TYPE.LIFETIME,
];

function label(pkg: PurchasesPackage) {
  switch (pkg.packageType) {
    case PACKAGE_TYPE.ANNUAL: return { title: 'Yearly', unit: '/ year' };
    case PACKAGE_TYPE.SIX_MONTH: return { title: '6 months', unit: '/ 6 months' };
    case PACKAGE_TYPE.THREE_MONTH: return { title: '3 months', unit: '/ 3 months' };
    case PACKAGE_TYPE.MONTHLY: return { title: 'Monthly', unit: '/ month' };
    case PACKAGE_TYPE.WEEKLY: return { title: 'Weekly', unit: '/ week' };
    case PACKAGE_TYPE.LIFETIME: return { title: 'Lifetime', unit: 'one-time' };
    default: return { title: pkg.product.title, unit: '' };
  }
}

export default function Paywall() {
  const { reason } = useLocalSearchParams<{ reason?: string }>();
  const pro = usePro();
  const insets = useSafeAreaInsets();
  const [selected, setSelected] = useState<PurchasesPackage | null>(null);
  const [busy, setBusy] = useState<'buy' | 'restore' | null>(null);

  const packages = useMemo(() => {
    const list = [...(pro.offering?.availablePackages ?? [])];
    const rank = (p: PurchasesPackage) => {
      const i = ORDER.indexOf(p.packageType);
      return i === -1 ? ORDER.length : i;
    };
    return list.sort((a, b) => rank(a) - rank(b));
  }, [pro.offering]);

  useEffect(() => {
    if (!selected && packages.length) setSelected(packages[0]);
  }, [packages, selected]);

  useEffect(() => {
    if (pro.available && !pro.offering) pro.refreshOfferings();
  }, [pro.available]); // eslint-disable-line react-hooks/exhaustive-deps

  async function buy() {
    if (!selected) return;
    setBusy('buy');
    try {
      if (await pro.purchase(selected)) {
        Alert.alert('Welcome to Pro! 🎉', 'Thanks for supporting the app.');
        router.back();
      }
    } catch (e: any) {
      Alert.alert('Purchase failed', e?.message ?? String(e));
    } finally {
      setBusy(null);
    }
  }

  async function restore() {
    setBusy('restore');
    try {
      const ok = await pro.restore();
      Alert.alert(ok ? 'Purchases restored' : 'Nothing to restore', ok ? 'Pro is active again.' : 'No active Pro purchase was found for this account.');
      if (ok) router.back();
    } catch (e: any) {
      Alert.alert('Restore failed', e?.message ?? String(e));
    } finally {
      setBusy(null);
    }
  }

  if (pro.isPro) {
    return (
      <View style={[styles.container, styles.center]}>
        <Text style={styles.h1}>You're Pro ✓</Text>
        <Text style={styles.sub}>All features are unlocked.</Text>
        {pro.managementURL && (
          <Pressable onPress={() => Linking.openURL(pro.managementURL!)} style={{ marginTop: 24 }}>
            <Text style={styles.link}>Manage subscription</Text>
          </Pressable>
        )}
        {__DEV__ && !pro.available && (
          <Pressable onPress={() => pro.devSetPro(false)} style={{ marginTop: 24 }}>
            <Text style={styles.link}>[dev] Turn off simulated Pro</Text>
          </Pressable>
        )}
      </View>
    );
  }

  const isSub = selected && selected.packageType !== PACKAGE_TYPE.LIFETIME;
  const trial = selected?.product.introPrice;

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={{ padding: 24, paddingBottom: 12 }}>
        <Text style={styles.h1}>{APP_NAME} Pro</Text>
        <Text style={styles.sub}>
          {reason === 'limit'
            ? `The free version holds up to ${FREE_DOC_LIMIT} documents. Upgrade to keep scanning.`
            : reason === 'ocr'
              ? 'Turn scans into text you can copy, share and search.'
              : 'Scan without limits.'}
        </Text>

        <View style={{ marginVertical: 24, gap: 10 }}>
          {BENEFITS.map((b) => (
            <Text key={b} style={styles.benefit}>✓  {b}</Text>
          ))}
        </View>

        {!pro.ready ? (
          <ActivityIndicator />
        ) : packages.length === 0 ? (
          <View style={styles.notice}>
            <Text style={styles.noticeText}>
              {pro.available
                ? 'Plans could not be loaded. Check your connection and try again.'
                : 'Purchases are not set up yet (no RevenueCat API key).'}
            </Text>
            {__DEV__ && (
              <Pressable onPress={() => { pro.devSetPro(true); router.back(); }} style={{ marginTop: 12 }}>
                <Text style={styles.link}>[dev] Simulate Pro</Text>
              </Pressable>
            )}
          </View>
        ) : (
          <View style={{ gap: 10 }}>
            {packages.map((pkg, i) => {
              const l = label(pkg);
              const active = selected?.identifier === pkg.identifier;
              return (
                <Pressable
                  key={pkg.identifier}
                  onPress={() => setSelected(pkg)}
                  style={[styles.plan, active && styles.planActive]}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={styles.planTitle}>
                      {l.title}
                      {i === 0 && packages.length > 1 ? '  · Best value' : ''}
                    </Text>
                    {pkg.packageType === PACKAGE_TYPE.ANNUAL && pkg.product.pricePerMonthString && (
                      <Text style={styles.planSub}>{pkg.product.pricePerMonthString} / month</Text>
                    )}
                  </View>
                  <Text style={styles.planPrice}>
                    {pkg.product.priceString} <Text style={styles.planSub}>{l.unit}</Text>
                  </Text>
                </Pressable>
              );
            })}
          </View>
        )}
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + 12 }]}>
        <Pressable
          style={[styles.cta, (!selected || busy) && { opacity: 0.5 }]}
          disabled={!selected || !!busy}
          onPress={buy}
        >
          {busy === 'buy' ? (
            <ActivityIndicator color="white" />
          ) : (
            <Text style={styles.ctaText}>{trial && trial.price === 0 ? 'Start free trial' : 'Continue'}</Text>
          )}
        </Pressable>
        {isSub && selected && (
          <Text style={styles.legal}>
            {trial && trial.price === 0 ? `Free for ${trial.periodNumberOfUnits} ${trial.periodUnit.toLowerCase()}(s), then ` : ''}
            {selected.product.priceString} {label(selected).unit}. Renews automatically until cancelled. Cancel anytime in
            your store account settings at least 24 hours before renewal.
          </Text>
        )}
        <View style={styles.links}>
          <Pressable onPress={restore} disabled={!!busy || !pro.available}>
            <Text style={styles.link}>{busy === 'restore' ? 'Restoring…' : 'Restore purchases'}</Text>
          </Pressable>
          <Pressable onPress={() => Linking.openURL(TERMS_URL)}>
            <Text style={styles.link}>Terms</Text>
          </Pressable>
          <Pressable onPress={() => Linking.openURL(PRIVACY_URL)}>
            <Text style={styles.link}>Privacy</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: 'white' },
  center: { alignItems: 'center', justifyContent: 'center', padding: 24 },
  h1: { fontSize: 30, fontWeight: '800', color: '#0f172a', textAlign: 'center' },
  sub: { fontSize: 16, color: '#475569', textAlign: 'center', marginTop: 8 },
  benefit: { fontSize: 17, color: '#0f172a' },
  notice: { padding: 16, borderRadius: 12, backgroundColor: '#fef3c7' },
  noticeText: { color: '#92400e', fontSize: 15 },
  plan: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: '#e2e8f0',
  },
  planActive: { borderColor: '#2563eb', backgroundColor: '#eff6ff' },
  planTitle: { fontSize: 17, fontWeight: '700', color: '#0f172a' },
  planSub: { fontSize: 13, color: '#64748b', fontWeight: '400' },
  planPrice: { fontSize: 17, fontWeight: '700', color: '#0f172a' },
  footer: { paddingHorizontal: 24, paddingTop: 12, borderTopWidth: StyleSheet.hairlineWidth, borderColor: '#e2e8f0' },
  cta: { backgroundColor: '#2563eb', paddingVertical: 16, borderRadius: 14, alignItems: 'center' },
  ctaText: { color: 'white', fontSize: 18, fontWeight: '700' },
  legal: { fontSize: 11, color: '#64748b', textAlign: 'center', marginTop: 10, lineHeight: 15 },
  links: { flexDirection: 'row', justifyContent: 'center', gap: 24, marginTop: 12 },
  link: { color: '#2563eb', fontSize: 14, fontWeight: '500' },
});
