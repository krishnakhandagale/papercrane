import { Platform } from 'react-native';

export const APP_NAME = 'Papercrane';

/** RevenueCat entitlement identifier (create it in the RevenueCat dashboard with this exact id). */
export const ENTITLEMENT_ID = 'pro';

/** Free-tier limits. */
export const FREE_DOC_LIMIT = 5;

/**
 * RevenueCat API keys come from environment variables (put them in `.env`, see `.env.example`).
 * During development, set EXPO_PUBLIC_RC_TEST_KEY to your Test Store key (starts with `test_`).
 * It works in Expo Go and dev builds without any App Store / Play Store setup.
 */
export function revenueCatKey(): string | undefined {
  const test = process.env.EXPO_PUBLIC_RC_TEST_KEY;
  if (__DEV__ && test) return test;
  return Platform.select({
    ios: process.env.EXPO_PUBLIC_RC_IOS_KEY,
    android: process.env.EXPO_PUBLIC_RC_ANDROID_KEY,
    default: test,
  });
}

// Required by Apple for subscription apps. Replace with your real pages before submitting.
export const TERMS_URL = 'https://www.apple.com/legal/internet-services/itunes/dev/stdeula/';
export const PRIVACY_URL = 'https://krishnakhandagale.github.io/papercrane/privacy.html';
