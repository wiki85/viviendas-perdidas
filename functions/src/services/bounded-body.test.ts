import { describe, expect, it } from 'vitest';
import { readBoundedBytes, readBoundedText } from './bounded-body.js';

function responseOf(chunks: Uint8Array[]): Response {
  return new Response(
    new ReadableStream<Uint8Array>({
      start(controller) {
        for (const chunk of chunks) controller.enqueue(chunk);
        controller.close();
      },
    }),
  );
}

describe('readBoundedBytes', () => {
  it('reads a normal body completely', async () => {
    const body = await readBoundedText(responseOf([new TextEncoder().encode('hola mundo')]));
    expect(body).toBe('hola mundo');
  });

  it('aborts as soon as the stream exceeds the byte cap', async () => {
    const chunk = new Uint8Array(1024).fill(65);
    await expect(readBoundedBytes(responseOf([chunk, chunk, chunk]), 2 * 1024)).rejects.toThrow(
      /superó el tope/u,
    );
  });

  it('accepts a body exactly at the cap', async () => {
    const chunk = new Uint8Array(1024).fill(66);
    const bytes = await readBoundedBytes(responseOf([chunk]), 1024);
    expect(bytes.byteLength).toBe(1024);
  });
});
