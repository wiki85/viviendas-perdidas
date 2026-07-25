const MAX_DIMENSION = 1600;
// Server rejects payloads above ~5.8M base64 chars (4 MiB binary).
const MAX_BASE64_LENGTH = 5_200_000;

function loadImageElement(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('No se pudo leer la imagen.'));
    };
    image.src = url;
  });
}

/**
 * Re-encodes any input image to a downscaled JPEG. Going through a canvas also
 * strips EXIF metadata (GPS position, device details) before anything is sent.
 */
export async function encodeJpegBase64(file: File): Promise<string> {
  if (!file.type.startsWith('image/')) throw new Error('Selecciona un archivo de imagen.');
  const bitmap =
    'createImageBitmap' in window
      ? await createImageBitmap(file, { imageOrientation: 'from-image' }).catch(() => null)
      : null;
  const source = bitmap ?? (await loadImageElement(file));
  const scale = Math.min(1, MAX_DIMENSION / Math.max(source.width, source.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(source.width * scale));
  canvas.height = Math.max(1, Math.round(source.height * scale));
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Tu navegador no permite procesar imágenes.');
  context.drawImage(source, 0, 0, canvas.width, canvas.height);
  if (bitmap) bitmap.close();
  for (const quality of [0.82, 0.65, 0.5]) {
    const base64 = canvas.toDataURL('image/jpeg', quality).split(',')[1] ?? '';
    if (base64.length > 0 && base64.length <= MAX_BASE64_LENGTH) return base64;
  }
  throw new Error('La imagen es demasiado pesada incluso tras reducirla.');
}
