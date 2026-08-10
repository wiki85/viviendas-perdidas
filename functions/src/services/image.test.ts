import { describe, expect, it } from 'vitest';
import sharp from 'sharp';
import { sanitizeJpeg } from './image.js';

/** Un JPEG pequeño CON EXIF (incluido GPS) para comprobar que se elimina. */
async function jpegWithExif(width = 16, height = 16): Promise<Buffer> {
  return (
    sharp({
      create: { width, height, channels: 3, background: { r: 10, g: 20, b: 30 } },
    })
      // EXIF con identificadores del autor/cámara (el tipo Exif de sharp expone
      // IFD0; basta para probar que el reproceso elimina los metadatos).
      .withExif({
        IFD0: { Copyright: 'Autor Privado', Model: 'Pixel Secreto', Make: 'GPS 40.4,-3.7' },
      })
      .jpeg()
      .toBuffer()
  );
}

describe('sanitizeJpeg', () => {
  it('strips EXIF/GPS metadata from the re-encoded image', async () => {
    const withExif = await jpegWithExif();
    // Confirma que el fixture SÍ trae EXIF antes de limpiarlo.
    expect((await sharp(withExif).metadata()).exif).toBeDefined();

    const clean = await sanitizeJpeg(withExif);
    const meta = await sharp(clean).metadata();
    expect(meta.exif).toBeUndefined();
    expect(meta.format).toBe('jpeg');
  });

  it('bounds oversized dimensions to the maximum side', async () => {
    const huge = await sharp({
      create: { width: 5000, height: 4000, channels: 3, background: { r: 1, g: 2, b: 3 } },
    })
      .jpeg()
      .toBuffer();
    const meta = await sharp(await sanitizeJpeg(huge)).metadata();
    expect(Math.max(meta.width ?? 0, meta.height ?? 0)).toBeLessThanOrEqual(2560);
  });

  it('keeps a normal photo readable as JPEG', async () => {
    const normal = await sharp({
      create: { width: 800, height: 600, channels: 3, background: { r: 120, g: 130, b: 140 } },
    })
      .jpeg()
      .toBuffer();
    const meta = await sharp(await sanitizeJpeg(normal)).metadata();
    expect(meta.format).toBe('jpeg');
    expect(meta.width).toBe(800);
  });

  it('throws on bytes that are not a real image', async () => {
    await expect(sanitizeJpeg(Buffer.from('no soy una imagen'))).rejects.toThrow();
  });
});
