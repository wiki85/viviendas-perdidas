/**
 * Lectura acotada del cuerpo de una respuesta HTTP (VP-12). Los volcados
 * autonómicos se cargan enteros en memoria; `AbortSignal.timeout` limita el
 * tiempo pero no el tamaño, así que un upstream comprometido podría enviar
 * gigas y tumbar la función por memoria. Estos helpers cortan la lectura en
 * cuanto se supera el tope y fallan con un error claro — la sincronización
 * aborta sin escribir nada, igual que ante una descarga truncada.
 */

/** Ningún volcado legítimo actual pasa de ~15 MB (Canarias); 64 MB deja
 * margen de crecimiento holgado sin permitir un payload absurdo. */
export const MAX_SOURCE_BODY_BYTES = 64 * 1024 * 1024;

export async function readBoundedBytes(
  response: Response,
  maximumBytes: number = MAX_SOURCE_BODY_BYTES,
): Promise<Buffer> {
  const body = response.body;
  if (body === null) return Buffer.alloc(0);
  const reader = body.getReader();
  const chunks: Uint8Array[] = [];
  let received = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    received += value.byteLength;
    if (received > maximumBytes) {
      await reader.cancel().catch(() => undefined);
      throw new Error(
        `La descarga superó el tope de ${Math.round(maximumBytes / 1024 / 1024)} MB; sincronización abortada.`,
      );
    }
    chunks.push(value);
  }
  return Buffer.concat(chunks);
}

export async function readBoundedText(
  response: Response,
  maximumBytes: number = MAX_SOURCE_BODY_BYTES,
): Promise<string> {
  return (await readBoundedBytes(response, maximumBytes)).toString('utf8');
}

export async function readBoundedJson(
  response: Response,
  maximumBytes: number = MAX_SOURCE_BODY_BYTES,
): Promise<unknown> {
  return JSON.parse(await readBoundedText(response, maximumBytes)) as unknown;
}
