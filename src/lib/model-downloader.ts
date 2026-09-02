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
 */

import { openDB, type IDBPDatabase } from 'idb';
import { getLocalModel, type LocalModelOption } from '@/lib/config';

const DB_NAME = 'awe-models';
const DB_VERSION = 1;
const STORE_NAME = 'models';

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

interface StoredModelRecord {
  id: string;
  name: string;
  data: ArrayBuffer;
  sizeBytes: number;
  downloadedAt: number;
}

export class ModelDownloader {
  private dbPromise: Promise<IDBPDatabase> | null = null;

  private async initDB(): Promise<IDBPDatabase> {
    if (!this.dbPromise) {
      this.dbPromise = openDB(DB_NAME, DB_VERSION, {
        upgrade(db) {
          if (!db.objectStoreNames.contains(STORE_NAME)) {
            db.createObjectStore(STORE_NAME, { keyPath: 'id' });
          }
        },
      });
    }
    return this.dbPromise;
  }

  /**
   * Download a model with streaming progress reporting and persist it in
   * IndexedDB. The download is streamed so progress can be shown on slow
   * mobile connections, and the response is validated before storage.
   */
  async downloadModel(
    modelId: string,
    onProgress?: (progress: DownloadProgress) => void,
    signal?: AbortSignal
  ): Promise<StoredModelMeta> {
    const catalogModel = getLocalModel(modelId);
    const url = catalogModel?.downloadUrl;
    if (!url) {
      throw new Error(`Unknown model: ${modelId}`);
    }

    const response = await fetch(url, { signal });
    if (!response.ok) {
      throw new Error(
        `Failed to download ${catalogModel.name}: HTTP ${response.status}. ` +
          'If this model requires accepting a license on Hugging Face, download the file manually and host it yourself (see README → Local LLM models).'
      );
    }

    const totalBytes = Number(response.headers.get('content-length')) || catalogModel?.sizeBytes || 0;
    const reader = response.body?.getReader();

    let data: ArrayBuffer;
    if (reader) {
      const chunks: Uint8Array[] = [];
      let receivedBytes = 0;
      let lastReportedPercent = -1;

      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        if (value) {
          chunks.push(value);
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
      }

      const merged = new Uint8Array(receivedBytes);
      let offset = 0;
      for (const chunk of chunks) {
        merged.set(chunk, offset);
        offset += chunk.byteLength;
      }
      data = merged.buffer;
    } else {
      // No streaming support — fall back to a single buffered read.
      data = await response.arrayBuffer();
      onProgress?.({ modelId, percent: 100, receivedBytes: data.byteLength, totalBytes: data.byteLength });
    }

    const record: StoredModelRecord = {
      id: modelId,
      name: catalogModel?.name || modelId,
      data,
      sizeBytes: data.byteLength,
      downloadedAt: Date.now(),
    };

    const db = await this.initDB();
    await db.put(STORE_NAME, record);

    return {
      id: record.id,
      name: record.name,
      sizeBytes: record.sizeBytes,
      downloadedAt: record.downloadedAt,
    };
  }

  /** Fetch a stored model as an ArrayBuffer, or null if not downloaded yet. */
  async getModel(modelId: string): Promise<ArrayBuffer | null> {
    const db = await this.initDB();
    const record = (await db.get(STORE_NAME, modelId)) as StoredModelRecord | undefined;
    return record?.data ?? null;
  }

  /** True when the model has been downloaded and stored on-device. */
  async hasModel(modelId: string): Promise<boolean> {
    const db = await this.initDB();
    const key = await db.getKey(STORE_NAME, modelId);
    return key !== undefined;
  }

  /** Delete a stored model to free up space. */
  async deleteModel(modelId: string): Promise<void> {
    const db = await this.initDB();
    await db.delete(STORE_NAME, modelId);
  }

  /** List metadata for every model stored on this device. */
  async listStoredModels(): Promise<StoredModelMeta[]> {
    const db = await this.initDB();
    const records = (await db.getAll(STORE_NAME)) as StoredModelRecord[];
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
