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
 * Gemma models are Google's officially supported models for MediaPipe LLM
 * Inference and are hosted as int4 `.task` conversions by the LiteRT
 * community on Hugging Face. Qwen/Phi require community `.task` conversions
 * and are marked experimental — if a URL is unavailable, convert the model
 * yourself with the MediaPipe converter and host it (or place it in
 * `public/models/` and point `downloadUrl` at it).
 */
export const LOCAL_MODELS: LocalModelOption[] = [
  {
    id: 'gemma-3-1b',
    name: 'Gemma 3 1B (Local)',
    type: 'local',
    description: "Google's compact open model — fast, runs on most devices",
    size: '~531 MB',
    sizeBytes: 556_832_078,
    downloadUrl:
      'https://huggingface.co/litert-community/Gemma3-1B-IT/resolve/main/gemma3-1b-it-int4.task',
    verified: true,
  },
  {
    id: 'gemma-2-2b',
    name: 'Gemma 2 2B (Local)',
    type: 'local',
    description: "Google's larger open model — higher quality, needs a modern phone",
    size: '~1.3 GB',
    sizeBytes: 1_394_604_032,
    downloadUrl:
      'https://huggingface.co/litert-community/Gemma2-2B-IT/resolve/main/gemma2-2b-it-int4.task',
    verified: true,
  },
  {
    id: 'qwen-2.5-0.5b',
    name: 'Qwen 2.5 0.5B (Local)',
    type: 'local',
    description: "Alibaba's ultra-light model — smallest download, modest quality",
    size: '~500 MB',
    downloadUrl:
      'https://huggingface.co/litert-community/Qwen2.5-0.5B-Instruct/resolve/main/qwen2.5-0.5b-instruct-q8_0.task',
    verified: false,
    experimental: true,
  },
  {
    id: 'phi-2',
    name: 'Phi-2 (Local)',
    type: 'local',
    description: "Microsoft's model with strong reasoning — larger memory footprint",
    size: '~1.2 GB',
    downloadUrl:
      'https://huggingface.co/litert-community/Phi-2/resolve/main/phi-2-int4.task',
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
