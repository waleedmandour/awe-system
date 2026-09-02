import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Regression tests for the chunked model downloader.
 *
 * Background: the original implementation buffered the ENTIRE model (up to
 * 1.6 GB) in JavaScript memory during download and again when saving to
 * IndexedDB, which crashed mobile browser tabs at 100% progress. These tests
 * pin down the memory-safe behavior:
 *   - the download is flushed to IndexedDB in fixed-size chunks,
 *   - no chunk ever exceeds CHUNK_SIZE,
 *   - the assembled Blob is byte-identical to the source,
 *   - failed/aborted downloads leave no orphan chunk records behind.
 */

// ── Node lacks IDBKeyRange — provide a minimal polyfill used by chunkRange() ──
type FakeRange = { lower: string; upper: string };
if (typeof (globalThis as Record<string, unknown>).IDBKeyRange === 'undefined') {
  (globalThis as Record<string, unknown>).IDBKeyRange = {
    bound: (lower: string, upper: string): FakeRange => ({ lower, upper }),
  };
}

// ── In-memory IndexedDB replacement injected through the `idb` module mock ──
const { idbState } = vi.hoisted(() => ({ idbState: { db: null as never } }));

vi.mock('idb', () => ({
  openDB: async () => idbState.db,
}));

import { CHUNK_SIZE, ModelDownloader, chunkKeyFor } from '@/lib/model-downloader';

const MODEL_ID = 'gemma-3-1b'; // must exist in src/lib/config.ts

interface FakeCursor {
  key: string;
  value: unknown;
  delete: () => Promise<void>;
  continue: () => Promise<FakeCursor | null>;
}

function makeFakeDB() {
  const stores: Record<string, Map<string, unknown>> = {
    models: new Map(),
    chunks: new Map(),
  };

  const openCursor = (storeName: string, range?: FakeRange): Promise<FakeCursor | null> => {
    const lo = range?.lower ?? '';
    const hi = range?.upper ?? '\uffff';
    const matched = [...stores[storeName].keys()].filter((k) => k >= lo && k <= hi).sort();
    let index = 0;
    const next = async (): Promise<FakeCursor | null> => {
      if (index >= matched.length) return null;
      const key = matched[index++];
      return {
        key,
        value: stores[storeName].get(key),
        delete: async () => {
          stores[storeName].delete(key);
        },
        continue: next,
      };
    };
    return next();
  };

  const db = {
    stores,
    objectStoreNames: { contains: (name: string) => name in stores },
    put: async (store: string, value: { id: string }) => {
      stores[store].set(value.id, value);
    },
    get: async (store: string, key: string) => stores[store].get(key),
    getKey: async (store: string, key: string) => (stores[store].has(key) ? key : undefined),
    getAll: async (store: string) => [...stores[store].values()],
    delete: async (store: string, key: string) => {
      stores[store].delete(key);
    },
    transaction: (storeName: string) => ({
      done: Promise.resolve(),
      objectStore: (name: string) => ({
        openCursor: (range?: FakeRange) => openCursor(name ?? storeName, range),
      }),
    }),
  };

  return db;
}

// ── Test data: 20 MiB of deterministic pseudo-random bytes ───────────────────
const SOURCE = new Uint8Array(20 * 1024 * 1024);
{
  let seed = 123456789;
  for (let i = 0; i < SOURCE.length; i += 1) {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    SOURCE[i] = seed & 0xff;
  }
}

/** Split the source into the variable-sized chunks a real reader would emit. */
function readerChunksFor(src: Uint8Array): Uint8Array[] {
  const sizes = [1024 * 1024, 700 * 1024, 2 * 1024 * 1024, 512 * 1024, 100 * 1024];
  const parts: Uint8Array[] = [];
  let offset = 0;
  let i = 0;
  while (offset < src.length) {
    const size = Math.min(sizes[i % sizes.length], src.length - offset);
    parts.push(src.subarray(offset, offset + size));
    offset += size;
    i += 1;
  }
  return parts;
}

function streamFrom(parts: Uint8Array[]): ReadableStream<Uint8Array> {
  return new ReadableStream<Uint8Array>({
    start(controller) {
      for (const part of parts) controller.enqueue(part);
      controller.close();
    },
  });
}

function okResponse(body: ReadableStream<Uint8Array>, byteLength: number): Response {
  return new Response(body, {
    status: 200,
    headers: { 'content-length': String(byteLength) },
  });
}

beforeEach(() => {
  idbState.db = makeFakeDB() as never;
});

describe('chunkKeyFor', () => {
  it('produces lexicographically sortable keys', () => {
    const keys = [chunkKeyFor('m', 0), chunkKeyFor('m', 1), chunkKeyFor('m', 9), chunkKeyFor('m', 10), chunkKeyFor('m', 999)];
    const sorted = [...keys].sort();
    expect(sorted).toEqual(keys);
    expect(chunkKeyFor('m', 5)).toBe('m#000005');
  });
});

describe('ModelDownloader — chunked streaming storage', () => {
  it('stores the download as byte-exact chunks and assembles an identical Blob', async () => {
    const downloader = new ModelDownloader();
    const fetchMock = vi.fn(async () => okResponse(streamFrom(readerChunksFor(SOURCE)), SOURCE.byteLength));
    vi.stubGlobal('fetch', fetchMock);

    const progressEvents: Array<{ percent: number; receivedBytes: number; totalBytes: number }> = [];
    const meta = await downloader.downloadModel(MODEL_ID, (p) => progressEvents.push({ ...p }));

    // Metadata is complete and matches the transferred byte count.
    expect(meta.id).toBe(MODEL_ID);
    expect(meta.sizeBytes).toBe(SOURCE.byteLength);
    const last = progressEvents[progressEvents.length - 1];
    expect(last.percent).toBe(100);
    expect(last.receivedBytes).toBe(SOURCE.byteLength);
    expect(progressEvents.every((e) => e.receivedBytes <= e.totalBytes)).toBe(true);

    // The chunk store holds ceil(20 MiB / 8 MiB) records, none over the limit.
    const db = idbState.db as ReturnType<typeof makeFakeDB>;
    expect(db.stores.chunks.size).toBe(Math.ceil(SOURCE.byteLength / CHUNK_SIZE));
    for (const [key, record] of db.stores.chunks as Map<string, { data: Uint8Array }>) {
      expect(key).toMatch(/^gemma-3-1b#\d{6}$/);
      expect(record.data.byteLength).toBeLessThanOrEqual(CHUNK_SIZE);
    }

    // Metadata record exists; hasModel/listStoredModels agree.
    expect(await downloader.hasModel(MODEL_ID)).toBe(true);
    expect((await downloader.listStoredModels()).map((m) => m.id)).toContain(MODEL_ID);

    // The assembled Blob is byte-identical to the original file.
    const blob = await downloader.getModelBlob(MODEL_ID);
    expect(blob).not.toBeNull();
    expect(blob!.size).toBe(SOURCE.byteLength);
    const assembled = new Uint8Array(await blob!.arrayBuffer());
    expect(Buffer.compare(Buffer.from(assembled), Buffer.from(SOURCE))).toBe(0);

    // deleteModel removes both metadata and every chunk record.
    await downloader.deleteModel(MODEL_ID);
    expect(db.stores.chunks.size).toBe(0);
    expect(await downloader.hasModel(MODEL_ID)).toBe(false);
    vi.unstubAllGlobals();
  });

  it('falls back to the next mirror when a source fails', async () => {
    const downloader = new ModelDownloader();
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response('server error', { status: 500 }))
      .mockImplementation(async () => okResponse(streamFrom(readerChunksFor(SOURCE)), SOURCE.byteLength));
    vi.stubGlobal('fetch', fetchMock);

    const meta = await downloader.downloadModel(MODEL_ID);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(meta.sizeBytes).toBe(SOURCE.byteLength);
    vi.unstubAllGlobals();
  });

  it('reports a licensing hint when every mirror returns 401', async () => {
    const downloader = new ModelDownloader();
    const fetchMock = vi.fn(async () => new Response('unauthorized', { status: 401 }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(downloader.downloadModel(MODEL_ID)).rejects.toThrow(/license acceptance/);
    // downloadUrl + 2 fallbacks in the catalog were all tried.
    expect(fetchMock).toHaveBeenCalledTimes(3);
    vi.unstubAllGlobals();
  });

  it('leaves no orphan chunk records behind when the stream aborts mid-download', async () => {
    const downloader = new ModelDownloader();
    const abortError = Object.assign(new Error('The user aborted a request.'), { name: 'AbortError' });

    // First chunk forces one IndexedDB flush (it exceeds CHUNK_SIZE), then the
    // stream dies — exactly what happens when a user cancels or the network drops.
    const failingStream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new Uint8Array(CHUNK_SIZE + 1234));
        controller.error(abortError);
      },
    });
    const fetchMock = vi.fn(async () => okResponse(failingStream, 700_383_232));
    vi.stubGlobal('fetch', fetchMock);

    await expect(downloader.downloadModel(MODEL_ID)).rejects.toThrow(abortError);
    const db = idbState.db as ReturnType<typeof makeFakeDB>;
    expect(db.stores.chunks.size).toBe(0);
    expect(await downloader.hasModel(MODEL_ID)).toBe(false);
    // An aborted download must not silently continue to the next mirror.
    expect(fetchMock).toHaveBeenCalledTimes(1);
    vi.unstubAllGlobals();
  });

  it('returns null for models that were never downloaded', async () => {
    const downloader = new ModelDownloader();
    expect(await downloader.getModelBlob(MODEL_ID)).toBeNull();
    expect(await downloader.getModel(MODEL_ID)).toBeNull();
  });
});
