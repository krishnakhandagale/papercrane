import { Alert } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { normalizeUri } from './storage';

/**
 * Opens the native document scanner (VisionKit on iOS, ML Kit on Android).
 * Returns cropped page image URIs, or [] if cancelled/unavailable.
 * The native module is required lazily: it doesn't exist in Expo Go or on
 * web, and importing it at the top level would crash the app there.
 */
export async function scanPages(): Promise<string[]> {
  let scanner: typeof import('react-native-document-scanner-plugin');
  try {
    scanner = require('react-native-document-scanner-plugin');
  } catch {
    Alert.alert(
      'Scanner not available',
      'The camera scanner needs a development build (it does not work in Expo Go). Use "Import" to add photos instead.'
    );
    return [];
  }
  try {
    const { scannedImages, status } = await scanner.default.scanDocument({ croppedImageQuality: 85 });
    if (status !== scanner.ScanDocumentResponseStatus.Success || !scannedImages) return [];
    return scannedImages.map(normalizeUri);
  } catch (e) {
    Alert.alert('Scan failed', String(e));
    return [];
  }
}

export async function importPages(): Promise<string[]> {
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsMultipleSelection: true,
    orderedSelection: true,
    quality: 0.85,
  });
  if (result.canceled) return [];
  return result.assets.map((a) => a.uri);
}
