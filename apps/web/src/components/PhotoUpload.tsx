import { useRef, useState } from 'react';
import { Camera, LoaderCircle, Trash2 } from 'lucide-react';

type Props = {
  value: string | null;
  consent: boolean;
  onChange: (imageBase64: string | null) => void;
  onConsentChange: (consent: boolean) => void;
};

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

/** Optional facade-photo field for the registration wizard. */
export function PhotoField({ value, consent, onChange, onConsentChange }: Props) {
  const fileInput = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pickFile = async (file: File | undefined) => {
    if (!file) return;
    setError(null);
    setBusy(true);
    try {
      onChange(await encodeJpegBase64(file));
    } catch (cause) {
      onChange(null);
      setError(cause instanceof Error ? cause.message : 'No se pudo preparar la imagen.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="photo-upload">
      <div className="photo-upload__header">
        <strong>Foto propia de la fachada</strong>
        <em>opcional</em>
      </div>
      <p className="photo-upload__help">
        ¿Street View no muestra bien el edificio? Añade tu foto. No se publicará hasta que la
        apruebe la moderación.
      </p>
      <input
        ref={fileInput}
        type="file"
        accept="image/*"
        capture="environment"
        className="sr-only"
        onChange={(event) => {
          void pickFile(event.target.files?.[0]);
          event.target.value = '';
        }}
      />
      {value && (
        <img
          className="photo-upload__preview"
          src={`data:image/jpeg;base64,${value}`}
          alt="Previsualización de la foto seleccionada"
        />
      )}
      <div className="photo-upload__actions">
        <button
          className="button button--ghost"
          type="button"
          disabled={busy}
          onClick={() => fileInput.current?.click()}
        >
          {busy ? <LoaderCircle className="spin" size={17} /> : <Camera size={17} />}
          {value ? 'Cambiar foto' : 'Elegir o hacer foto'}
        </button>
        {value && (
          <button
            className="button button--ghost"
            type="button"
            disabled={busy}
            onClick={() => {
              onChange(null);
              onConsentChange(false);
            }}
          >
            <Trash2 size={16} /> Quitar
          </button>
        )}
      </div>
      {value && (
        <label className="photo-upload__consent">
          <input
            type="checkbox"
            checked={consent}
            onChange={(event) => onConsentChange(event.target.checked)}
          />
          <span>
            La foto es mía, muestra solo la fachada y no incluye personas, matrículas ni interiores.
          </span>
        </label>
      )}
      {error && (
        <p className="form-message" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
