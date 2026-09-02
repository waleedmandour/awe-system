/**
 * ─── AWE System — Central AI Model Configuration ────────────────────────────
 *
 * Single source of truth for cloud (Gemini) and local (on-device) model
 * configuration. Both the API routes and the client-side local LLM service
 * read from here, so switching models only requires editing this file.
 */

// ─── Cloud (Google Gemini) ───────────────────────────────────────────────────

export const MODEL_CONFIG = {
  /**
   * Primary model. `gemini-2.5-flash-lite` is on the Google AI Studio FREE
   * tier with better rate limits than `gemini-2.5-flash`
   * (15 req/min & 1,000 req/day vs 10 req/min & 250 req/day) and lower
   * latency, which suits the 10-second serverless cap on Vercel's free tier.
   */
  current: 'gemini-2.5-flash-lite',
  /** Fallback used when the primary model fails or is rate-limited. */
  fallback: 'gemini-2.5-flash',
  /** Last-resort legacy model (kept for extra resilience). */
  legacyFallback: 'gemini-2.0-flash',

  /** Published Google AI Studio free-tier limits (per API key). */
  freeTierLimits: {
    'gemini-2.5-flash': { requestsPerMinute: 10, requestsPerDay: 250 },
    'gemini-2.5-flash-lite': { requestsPerMinute: 15, requestsPerDay: 1000 },
    'gemini-2.0-flash': { requestsPerMinute: 15, requestsPerDay: 200 },
  } as Record<string, { requestsPerMinute: number; requestsPerDay: number }>,
};

export type ModelId = string;

/**
 * Ordered model tiers for the assessment endpoint. The request tries each
 * tier in order (with rate-limit retries inside each tier) until one returns
 * a valid response.
 */
export const CLOUD_ASSESSMENT_TIERS: ModelId[] = [
  MODEL_CONFIG.current,
  MODEL_CONFIG.fallback,
  MODEL_CONFIG.legacyFallback,
];

/** Models a client may explicitly request via the `modelId` field. */
export const ALLOWED_CLOUD_MODELS: ModelId[] = Array.from(
  new Set([...CLOUD_ASSESSMENT_TIERS, MODEL_CONFIG.fallback])
);

/**
 * Ordered tiers for the OCR endpoint. Both models are vision-capable;
 * flash-lite is tried first for its higher free-tier quota.
 */
export const CLOUD_OCR_TIERS: ModelId[] = [MODEL_CONFIG.current, MODEL_CONFIG.fallback];

// ─── Local (on-device) LLMs ──────────────────────────────────────────────────

export interface LocalModelOption {
  id: string;
  name: string;
  type: 'local';
  description: string;
  /** Human-readable download size, e.g. "531 MB". */
  size: string;
  /** Exact byte size when known — used for the storage check before download. */
  sizeBytes?: number;
  /** Direct download URL (MediaPipe-compatible `.task` / `.bin` weights). */
  downloadUrl: string;
  /**
   * Backup download URLs tried in order when `downloadUrl` fails. Used so a
   * single dead link never breaks on-device assessment (for example, a
   * community mirror disappearing). Every URL must be downloadable WITHOUT
   * authentication — gated Hugging Face repos (which need license acceptance)
   * are deliberately avoided.
   */
  fallbackUrls?: string[];
  /** Verified to download & run with MediaPipe LLM Inference for Web. */
  verified: boolean;
  /** Show an "Experimental" badge in the UI. */
  experimental?: boolean;
}

/**
 * On-device model catalog. Models run fully in the browser via MediaPipe
 * LLM Inference (WebAssembly/WebGL) — essays never leave the device and
 * assessment keeps working offline after the one-time download.
 *
 * IMPORTANT — every URL below is verified to download WITHOUT authentication:
 *
 * - Google's official `litert-community` Gemma repos on Hugging Face are
 *   LICENSE-GATED (`gated: auto` → HTTP 401 for anonymous downloads), so the
 *   app cannot fetch them seamlessly. The Gemma 3 1B web conversion is
 *   therefore served from public, ungated mirrors of Google's release, with
 *   two byte-identical backup mirrors as fallbacks.
 * - The Qwen 2.5 and TinyLlama `.task` conversions are published UNGATED by
 *   Google's own litert-community account (Apache-2.0 / research licenses),
 *   so they download seamlessly and are the most stable sources.
 *
 * To swap a model for your own hosted weights, point `downloadUrl` at your
 * file (e.g. `/models/<file>.task` after `npm run download-models`).
 */
export const LOCAL_MODELS: LocalModelOption[] = [
  {
    id: 'gemma-3-1b',
    name: 'Gemma 3 1B (Local)',
    type: 'local',
    description: "Google's compact open model — fast, runs on most devices",
    size: '~668 MB',
    sizeBytes: 700_383_232,
    // Ungated public mirror of Google's gemma3-1b-it-int4-web.task (700,383,232 bytes).
    downloadUrl:
      'https://huggingface.co/darkB/gemma3-1b-it-int4-web-litert/resolve/main/gemma3-1b-it-int4-web.task',
    // Byte-identical mirrors of the official gemma3-1b-it-int4.task (554,661,243 bytes).
    fallbackUrls: [
      'https://huggingface.co/K4N4T/gemma3-1B-it-int4.task/resolve/main/gemma3-1B-it-int4.task',
      'https://huggingface.co/AfiOne/gemma3-1b-it-int4.task/resolve/main/gemma3-1b-it-int4.task',
    ],
    verified: true,
  },
  {
    id: 'qwen-2.5-0.5b',
    name: 'Qwen 2.5 0.5B (Local)',
    type: 'local',
    description: "Alibaba's ultra-light model — smallest download, works on older phones",
    size: '~521 MB',
    sizeBytes: 546_660_344,
    // Official Google litert-community conversion, published ungated (Apache-2.0).
    downloadUrl:
      'https://huggingface.co/litert-community/Qwen2.5-0.5B-Instruct/resolve/main/Qwen2.5-0.5B-Instruct_multi-prefill-seq_q8_ekv1280.task',
    verified: true,
  },
  {
    id: 'qwen-2.5-1.5b',
    name: 'Qwen 2.5 1.5B (Local)',
    type: 'local',
    description: "Alibaba's larger model — best on-device quality, needs a modern phone",
    size: '~1.5 GB',
    sizeBytes: 1_597_913_616,
    // Official Google litert-community conversion, published ungated (Apache-2.0).
    downloadUrl:
      'https://huggingface.co/litert-community/Qwen2.5-1.5B-Instruct/resolve/main/Qwen2.5-1.5B-Instruct_multi-prefill-seq_q8_ekv1280.task',
    verified: true,
  },
  {
    id: 'tinyllama-1.1b',
    name: 'TinyLlama 1.1B (Local)',
    type: 'local',
    description: 'Compact community classic — quick to run, modest essay quality',
    size: '~1.1 GB',
    sizeBytes: 1_148_331_545,
    // Official Google litert-community conversion, published ungated (Apache-2.0).
    downloadUrl:
      'https://huggingface.co/litert-community/TinyLlama-1.1B-Chat-v1.0/resolve/main/TinyLlama-1.1B-Chat-v1.0_multi-prefill-seq_q8_ekv1280.task',
    verified: false,
    experimental: true,
  },
];

export function getLocalModel(modelId: string): LocalModelOption | undefined {
  return LOCAL_MODELS.find((m) => m.id === modelId);
}

// ─── MediaPipe runtime ───────────────────────────────────────────────────────

/**
 * WASM runtime for MediaPipe LLM Inference (Web). Pinned to the exact
 * package version in package.json so the JS wrapper and WASM binaries
 * never drift apart.
 */
export const MEDIAPIPE_TASKS_GENAI_VERSION = '0.10.29';
export const MEDIAPIPE_WASM_BASE = `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-genai@${MEDIAPIPE_TASKS_GENAI_VERSION}/wasm`;

// ─── Legacy combined CONFIG export (kept for convenience) ────────────────────

export const CONFIG = {
  cloud: {
    defaultModel: MODEL_CONFIG.current,
    fallbackModel: MODEL_CONFIG.fallback,
    tiers: CLOUD_ASSESSMENT_TIERS,
    freeTierLimits: MODEL_CONFIG.freeTierLimits,
  },
  local: {
    enabled: true,
    defaultModel: 'gemma-3-1b',
    models: LOCAL_MODELS,
  },
};
