import sharp from 'sharp';

/**
 * Reproceso de imágenes en servidor. La eliminación de EXIF que hace el
 * cliente (reencode por canvas) NO es garantía: un cliente que llame directo
 * al callable puede subir un JPEG con GPS/modelo de cámara del autor. Aquí
 * decodificamos y reescribimos los píxeles, de modo que la salida no lleva
 * ningún segmento APPn/EXIF (VP-03) y deja de ser un JPEG-polyglot. Si los
 * bytes no decodifican como imagen real, `sharp` lanza y el callable rechaza.
 */

/** Lado máximo del JPEG resultante; acota imágenes desproporcionadas. */
const MAX_DIMENSION = 2560;

export async function sanitizeJpeg(bytes: Buffer): Promise<Buffer> {
  return (
    sharp(bytes, { failOn: 'error' })
      // Aplica la orientación EXIF y luego la descarta al reescribir.
      .rotate()
      .resize({
        width: MAX_DIMENSION,
        height: MAX_DIMENSION,
        fit: 'inside',
        withoutEnlargement: true,
      })
      // Sin withMetadata(): la salida no conserva EXIF, GPS ni perfil ICC.
      .jpeg({ quality: 82, mozjpeg: true })
      .toBuffer()
  );
}
