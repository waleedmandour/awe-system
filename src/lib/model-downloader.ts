'use client';

/**
 * ─── AWE System — On-Device Model Downloader & Storage ──────────────────────
 *
 * Downloads MediaPipe-compatible LLM weights (`.task` files) once, stores them
 * in IndexedDB, and serves them to the local LLM runtime as Blob URLs.
 *
 * Everything here runs in the BROWSER (IndexedDB is a browser API). Models
 * never touch a server, which keeps the on-device assessment flow fully
 * private and offline-capable.
 *
 * ── Memory safety (critical for mobile) ─────────────────────────────────────
 * Models are 0.5–1.6 GB. The downloader therefore NEVER assembles the whole
 * file in JavaScript memory:
 *
 * 1. Download: the response stream is flushed to IndexedDB in fixed 8 MB
 *    chunk records. Peak JS-heap usage during download is one chunk, so the
 *    browser tab cannot be OOM-killed when the progress bar reaches 100%.
 * 2. Read: chunks are appended to a disk-backed `Blob` one record at a time
 *    (Blob concatenation does not copy existing bytes), and the runtime is
 *    given a Blob URL instead of a giant ArrayBuffer.
 */

import { openDB, type IDBPDatabase } from 'idb';
import { getLocalModel, type LocalModelOption } from '@/lib/config';

const DB_NAME = 'awe-models';
const DB_VERSION = 2;
const META_STORE = 'models';
const CHUNK_STORE = 'chunks';

/** Bytes per IndexedDB chunk record. Small enough for cheap writes/reads, large enough to keep transaction overhead low. */
export const CHUNK_SIZE = 8 * 1024 * 1024;

export interface StoredModelMeta {
  id: string;
  name: string;
  sizeBytes: number;
  downloadedAt: number;
}

export interface DownloadProgress {
  modelId: string;
  /** 0–100, or -1 when total size is unknown. */
  percent: number;
  receivedBytes: number;
  totalBytes: number;
}

/** Metadata record in the `models` store. */
interface StoredModelMetaRecord {
  id: string;
  name: string;
  sizeBytes: number;
  downloadedAt: number;
  /** True for the chunked layout (DB v2+). Absent on legacy v1 records. */
  chunked?: boolean;
  /** Legacy v1 layout: the whole file in one record. Only read, never written. */
  data?: ArrayBuffer;
}

/** One 8 MB piece of a model in the `chunks` store. */
interface StoredModelChunkRecord {
  id: string;
  modelId: string;
  index: number;
  data: Uint8Array<ArrayBuffer>;
}

/** Stable, lexicographically sortable key for a model chunk. */
export function chunkKeyFor(modelId: string, index: number): string {
  return `${modelId}#${String(index).padStart(6, '0')}`;
}

/** Key range covering every chunk of one model. */
function chunkRange(modelId: string): IDBKeyRange {
  return IDBKeyRange.bound(`${modelId}#`, `${modelId}#\uffff`);
}

export class ModelDownloader {
  private dbPromise: Promise<IDBPDatabase> | null = null;

  private async initDB(): Promise<IDBPDatabase> {
    if (!this.dbPromise) {
      this.dbPromise = openDB(DB_NAME, DB_VERSION, {
        upgrade(db) {
          if (!db.objectStoreNames.contains(META_STORE)) {
            db.createObjectStore(META_STORE, { keyPath: 'id' });
          }
          if (!db.objectStoreNames.contains(CHUNK_STORE)) {
            db.createObjectStore(CHUNK_STORE, { keyPath: 'id' });
          }
        },
      });
    }
    return this.dbPromise;
  }

  /**
   * Download a model with streaming progress reporting and persist it in
   * IndexedDB chunk-by-chunk (constant memory footprint).
   *
   * Tries `downloadUrl` first, then every entry in `fallbackUrls`, so a
   * single dead or gated mirror never blocks on-device assessment.
   */
  async downloadModel(
    modelId: string,
    onProgress?: (progress: DownloadProgress) => void,
    signal?: AbortSignal
  ): Promise<StoredModelMeta> {
    const catalogModel = getLocalModel(modelId);
    const candidateUrls = [catalogModel?.downloadUrl, ...(catalogModel?.fallbackUrls ?? [])].filter(
      (url): url is string => typeof url === 'string' && url.length > 0
    );
    if (candidateUrls.length === 0) {
      throw new Error(`Unknown model: ${modelId}`);
    }

    const attempted: string[] = [];
    for (const url of candidateUrls) {
      try {
        return await this.downloadAndStore(url, modelId, catalogModel, onProgress, signal);
      } catch (err) {
        // User cancellation must never fall through to the next mirror.
        if (signal?.aborted || (err instanceof Error && err.name === 'AbortError')) {
          throw err;
        }
        attempted.push(`${new URL(url).host}: ${err instanceof Error ? err.message : String(err)}`);
      }
    }

    throw new Error(
      `Failed to download ${catalogModel?.name ?? modelId}. All sources failed — ${attempted.join('; ')}. ` +
        'You can download the file manually and host it yourself (see README → Local LLM models).'
    );
  }

  /**
   * Fetch one URL and persist it as 8 MB IndexedDB chunks while streaming.
   * Only one chunk is ever held in JS memory, which keeps peak usage at
   * ~16 MB regardless of the model size (0.5 GB or 1.6 GB — same cost).
   */
  private async downloadAndStore(
    url: string,
    modelId: string,
    catalogModel: LocalModelOption | undefined,
    onProgress?: (progress: DownloadProgress) => void,
    signal?: AbortSignal
  ): Promise<StoredModelMeta> {
    const response = await fetch(url, { signal });
    if (!response.ok) {
      const hint =
        response.status === 401 || response.status === 403
          ? ' (source requires license acceptance on Hugging Face)'
          : '';
      throw new Error(`HTTP ${response.status}${hint}`);
    }

    const totalBytes = Number(response.headers.get('content-length')) || catalogModel?.sizeBytes || 0;
    const db = await this.initDB();
    const reader = response.body?.getReader();

    try {
      if (!reader) {
        // No streaming support (very old browsers) — single-buffer fallback.
        const data = new Uint8Array(await response.arrayBuffer());
        await db.put(CHUNK_STORE, {
          id: chunkKeyFor(modelId, 0),
          modelId,
          index: 0,
          data,
        } satisfies StoredModelChunkRecord);
        onProgress?.({ modelId, percent: 100, receivedBytes: data.byteLength, totalBytes: data.byteLength });
        return await this.writeMeta(db, modelId, catalogModel, data.byteLength, false);
      }

      // Streaming path — flush into IndexedDB every CHUNK_SIZE bytes.
      const staging: Uint8Array[] = [];
      let stagingBytes = 0;
      let receivedBytes = 0;
      let chunkIndex = 0;
      let lastReportedPercent = -1;

      const flush = async () => {
        if (stagingBytes === 0) return;
        const merged = new Uint8Array(stagingBytes);
        let offset = 0;
        for (const part of staging) {
          merged.set(part, offset);
          offset += part.byteLength;
        }
        staging.length = 0;
        stagingBytes = 0;
        await db.put(CHUNK_STORE, {
          id: chunkKeyFor(modelId, chunkIndex),
          modelId,
          index: chunkIndex,
          data: merged,
        } satisfies StoredModelChunkRecord);
        chunkIndex += 1;
      };

      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        if (!value) continue;
        // Flush BEFORE crossing the boundary so a stored chunk never exceeds
        // CHUNK_SIZE (real fetch streams deliver values far smaller than 8 MB).
        if (stagingBytes > 0 && stagingBytes + value.byteLength > CHUNK_SIZE) {
          await flush();
        }
        staging.push(value);
        stagingBytes += value.byteLength;
        receivedBytes += value.byteLength;
        if (onProgress) {
          const percent = totalBytes > 0 ? Math.min(100, Math.round((receivedBytes / totalBytes) * 100)) : -1;
          // Report only on integer percent changes to keep the UI cheap.
          if (percent !== lastReportedPercent) {
            lastReportedPercent = percent;
            onProgress({ modelId, percent, receivedBytes, totalBytes });
          }
        }
      }
      await flush();

      return await this.writeMeta(db, modelId, catalogModel, receivedBytes, true);
    } catch (err) {
      // A failed/partial download must not leave orphan chunk records behind
      // (they would silently eat the device's storage quota).
      await this.purgeChunks(db, modelId).catch(() => {
        /* best-effort cleanup */
      });
      throw err;
    }
  }

  private async writeMeta(
    db: IDBPDatabase,
    modelId: string,
    catalogModel: LocalModelOption | undefined,
    sizeBytes: number,
    chunked: boolean
  ): Promise<StoredModelMeta> {
    const meta: StoredModelMetaRecord = {
      id: modelId,
      name: catalogModel?.name || modelId,
      sizeBytes,
      downloadedAt: Date.now(),
      chunked,
    };
    await db.put(META_STORE, meta);
    return { id: meta.id, name: meta.name, sizeBytes: meta.sizeBytes, downloadedAt: meta.downloadedAt };
  }

  /** Delete every chunk record belonging to one model. */
  private async purgeChunks(db: IDBPDatabase, modelId: string): Promise<void> {
    const tx = db.transaction(CHUNK_STORE, 'readwrite');
    const store = tx.objectStore(CHUNK_STORE);
    let cursor = await store.openCursor(chunkRange(modelId));
    while (cursor) {
      await cursor.delete();
      cursor = await cursor.continue();
    }
    await tx.done;
  }

  /**
   * Memory-safe read: assemble the model as a disk-backed Blob by appending
   * one chunk record at a time. Blob concatenation does not copy the bytes
   * already accumulated, so JS-heap usage stays at roughly one chunk.
   * Returns null when the model is not downloaded.
   */
  async getModelBlob(modelId: string): Promise<Blob | null> {
    const db = await this.initDB();
    const meta = (await db.get(META_STORE, modelId)) as StoredModelMetaRecord | undefined;
    if (!meta) return null;

    if (!meta.chunked) {
      // Legacy v1 record holding the whole file.
      return new Blob([meta.data ?? new ArrayBuffer(0)], { type: 'application/octet-stream' });
    }

    let blob = new Blob([], { type: 'application/octet-stream' });
    const tx = db.transaction(CHUNK_STORE);
    const store = tx.objectStore(CHUNK_STORE);
    let cursor = await store.openCursor(chunkRange(modelId));
    while (cursor) {
      const record = cursor.value as StoredModelChunkRecord;
      blob = new Blob([blob, record.data], { type: 'application/octet-stream' });
      cursor = await cursor.continue();
    }
    return blob;
  }

  /**
   * Full-buffer read (legacy convenience API). Prefer `getModelBlob` — this
   * materializes the entire model in JS memory and can exceed tab memory
   * limits on mobile devices.
   */
  async getModel(modelId: string): Promise<ArrayBuffer | null> {
    const blob = await this.getModelBlob(modelId);
    return blob ? blob.arrayBuffer() : null;
  }

  /** True when the model has been downloaded and stored on-device. */
  async hasModel(modelId: string): Promise<boolean> {
    const db = await this.initDB();
    const key = await db.getKey(META_STORE, modelId);
    return key !== undefined;
  }

  /** Delete a stored model (metadata + all chunk records) to free up space. */
  async deleteModel(modelId: string): Promise<void> {
    const db = await this.initDB();
    await this.purgeChunks(db, modelId);
    await db.delete(META_STORE, modelId);
  }

  /** List metadata for every model stored on this device. */
  async listStoredModels(): Promise<StoredModelMeta[]> {
    const db = await this.initDB();
    const records = (await db.getAll(META_STORE)) as StoredModelMetaRecord[];
    return records.map((r) => ({
      id: r.id,
      name: r.name,
      sizeBytes: r.sizeBytes,
      downloadedAt: r.downloadedAt,
    }));
  }

  /**
   * Rough storage check: is there enough free quota to fit the model?
   * Uses the Storage Manager API where available (all modern browsers).
   */
  async hasEnoughStorage(modelId: string): Promise<{ ok: boolean; freeBytes: number | null; requiredBytes: number | null }> {
    const model = getLocalModel(modelId);
    const requiredBytes = model?.sizeBytes ?? null;
    if (!requiredBytes || typeof navigator === 'undefined' || !navigator.storage?.estimate) {
      return { ok: true, freeBytes: null, requiredBytes: null };
    }
    try {
      const { quota = 0, usage = 0 } = await navigator.storage.estimate();
      const freeBytes = quota - usage;
      // Require 15% headroom over the model size for inference overhead.
      return { ok: freeBytes > requiredBytes * 1.15, freeBytes, requiredBytes };
    } catch {
      return { ok: true, freeBytes: null, requiredBytes };
    }
  }
}
