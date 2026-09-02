'use client';

/**
 * ─── AWE System — Device Readiness Check for On-Device Assessment ───────────
 *
 * On-device LLM inference is CPU/GPU- and battery-hungry. Before a student
 * commits to a local model, we check two things the browser can tell us:
 *
 *  1. Battery (Battery Status API — Chrome/Edge/Android; unavailable on iOS
 *     Safari, in which case we simply skip the check).
 *  2. Hardware capability (navigator.hardwareConcurrency and, where
 *     available, navigator.deviceMemory) versus the size of the model.
 *
 * Everything here is WARNING-only — the user's explicit choice of local
 * assessment is never blocked, because the app already falls back to the
 * cloud path automatically if local inference fails.
 */

export interface DeviceCheckInput {
  /** Battery level, 0–1. Null when the Battery API is unavailable. */
  batteryLevel?: number | null;
  /** True when the device is plugged in / charging. Null when unknown. */
  batteryCharging?: boolean | null;
  /** Whether the browser exposes the Battery Status API at all. */
  batterySupported?: boolean;
  /** navigator.hardwareConcurrency (logical cores). Null when unknown. */
  cores?: number | null;
  /** navigator.deviceMemory in GB (Chrome only). Null when unknown. */
  memoryGB?: number | null;
  /** Size in bytes of the model the user wants to run. Null when unknown. */
  modelBytes?: number | null;
}

/** Models at or above this size are considered "large" for phone hardware. */
const LARGE_MODEL_BYTES = 1_000_000_000; // ~1 GB
/** Below this battery level (and not charging) we warn before inference. */
const LOW_BATTERY_LEVEL = 0.2;
/** Devices with this few logical cores are considered entry-level. */
const MIN_COMFORTABLE_CORES = 6;
/** Devices reporting less RAM than this (Chrome, in GB) are entry-level. */
const MIN_COMFORTABLE_MEMORY_GB = 3;

/**
 * Pure warning calculator — no browser APIs, fully unit-testable.
 * Returns a list of human-readable warnings (empty when the device looks fine).
 */
export function computeDeviceWarnings(input: DeviceCheckInput): string[] {
  const warnings: string[] = [];
  const {
    batteryLevel,
    batteryCharging,
    batterySupported,
    cores,
    memoryGB,
    modelBytes,
  } = input;

  // ── Battery ────────────────────────────────────────────────────────────
  if (batterySupported && typeof batteryLevel === 'number' && Number.isFinite(batteryLevel)) {
    if (batteryLevel < LOW_BATTERY_LEVEL && batteryCharging === false) {
      warnings.push(
        `Battery is low (${Math.round(batteryLevel * 100)}%) and not charging. On-device assessment is battery-intensive — plug in, or use the cloud model.`
      );
    }
  }

  // ── Hardware capability vs model size ─────────────────────────────────
  const bigModel = typeof modelBytes === 'number' && modelBytes >= LARGE_MODEL_BYTES;
  const weakCores = typeof cores === 'number' && cores > 0 && cores < MIN_COMFORTABLE_CORES;
  const weakMemory = typeof memoryGB === 'number' && memoryGB > 0 && memoryGB < MIN_COMFORTABLE_MEMORY_GB;

  if (bigModel && (weakCores || weakMemory)) {
    const sizeGb = ((modelBytes ?? 0) / (1024 * 1024 * 1024)).toFixed(1);
    const reasons: string[] = [];
    if (weakCores) reasons.push(`${cores} processing cores`);
    if (weakMemory) reasons.push(`~${memoryGB} GB RAM`);
    warnings.push(
      `This model is ~${sizeGb} GB and your device reports ${reasons.join(' and ')}. Inference may be slow (well over the usual 2–3 seconds) or the browser may reload under memory pressure — a smaller model or the cloud model is safer.`
    );
  } else if (weakCores && typeof modelBytes === 'number' && modelBytes > 0) {
    warnings.push(
      `Your device reports ${cores} processing cores, so on-device assessment may run slower than the usual 2–3 seconds.`
    );
  } else if (weakMemory && typeof modelBytes === 'number' && modelBytes > 0) {
    warnings.push(
      `Your device reports ~${memoryGB} GB RAM. Loading the model fully into memory may be slow on this phone.`
    );
  }

  return warnings;
}

export interface DeviceReadiness {
  /** Human-readable warnings; empty when the device looks fine. */
  warnings: string[];
  /** True when the browser exposed the Battery Status API. */
  batterySupported: boolean;
}

/**
 * Browser wrapper: gather battery/hardware info and compute warnings for the
 * given model size. Safe on every browser — missing APIs are simply skipped.
 */
export async function checkDeviceReadiness(modelBytes?: number | null): Promise<DeviceReadiness> {
  if (typeof navigator === 'undefined') {
    return { warnings: [], batterySupported: false };
  }

  const nav = navigator as Navigator & {
    getBattery?: () => Promise<{ level: number; charging: boolean }>;
    deviceMemory?: number;
  };

  let batteryLevel: number | null = null;
  let batteryCharging: boolean | null = null;
  let batterySupported = false;

  try {
    if (typeof nav.getBattery === 'function') {
      const battery = await nav.getBattery();
      batteryLevel = battery.level;
      batteryCharging = battery.charging;
      batterySupported = true;
    }
  } catch {
    // Battery info refused/unavailable — skip that check.
  }

  const warnings = computeDeviceWarnings({
    batteryLevel,
    batteryCharging,
    batterySupported,
    cores: typeof nav.hardwareConcurrency === 'number' ? nav.hardwareConcurrency : null,
    memoryGB: typeof nav.deviceMemory === 'number' ? nav.deviceMemory : null,
    modelBytes: modelBytes ?? null,
  });

  return { warnings, batterySupported };
}
