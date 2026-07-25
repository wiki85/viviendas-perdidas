import { useRef, useState } from 'react';
import { Camera, LoaderCircle, Trash2 } from 'lucide-react';
import { encodeJpegBase64 } from '../lib/photo';

type Props = {
  value: string | null;
  consent: boolean;
  onChange: (imageBase64: string | null) => void;
  onConsentChange: (consent: boolean) => void;
};

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
