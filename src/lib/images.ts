import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';

export async function rotateImage(uri: string, degrees = 90): Promise<string> {
  const img = await ImageManipulator.manipulate(uri).rotate(degrees).renderAsync();
  const res = await img.saveAsync({ format: SaveFormat.JPEG, compress: 0.9 });
  return res.uri;
}

/** Downscaled JPEG as base64, for embedding in the PDF HTML. */
export async function toPdfBase64(uri: string, maxWidth = 1654): Promise<string> {
  const ctx = ImageManipulator.manipulate(uri);
  let img = await ctx.renderAsync();
  if (img.width > maxWidth) {
    img = await ctx.resize({ width: maxWidth, height: null }).renderAsync();
  }
  const res = await img.saveAsync({ format: SaveFormat.JPEG, compress: 0.75, base64: true });
  return res.base64 ?? '';
}
