#!/usr/bin/env node
/**
 * ─── AWE System — Local Model Download Script ────────────────────────────────
 *
 * Optionally pre-downloads on-device LLM weights into `public/models/` so the
 * app can serve them itself instead of relying on the remote URLs in
 * `src/lib/config.ts` (useful for restricted networks / offline labs).
 *
 * Usage:
 *   node scripts/download-models.mjs            # download all models
 *   node scripts/download-models.mjs gemma-3-1b # download a specific model
 *   node scripts/download-models.mjs --list     # list catalog models
 *
 * After downloading, point the model's `downloadUrl` in src/lib/config.ts at
 * `/models/<file>.task`, or serve the file and let students download it in-app.
 *
 * Every URL below is verified to work WITHOUT authentication (gated Hugging
 * Face repos — those requiring license acceptance — are deliberately avoided;
 * see README → On-Device Models).
 */

import fs from 'node:fs';
import path from 'node:path';
import https from 'node:https';
import { URL } from 'node:url';

// Keep this catalog in sync with LOCAL_MODELS in src/lib/config.ts
const MODELS = [
  {
    id: 'gemma-3-1b',
    // Ungated public mirror of Google's gemma3-1b-it-int4-web.task, plus
    // byte-identical mirrors of the official gemma3-1b-it-int4.task.
    urls: [
      'https://huggingface.co/darkB/gemma3-1b-it-int4-web-litert/resolve/main/gemma3-1b-it-int4-web.task',
      'https://huggingface.co/K4N4T/gemma3-1B-it-int4.task/resolve/main/gemma3-1B-it-int4.task',
      'https://huggingface.co/AfiOne/gemma3-1b-it-int4.task/resolve/main/gemma3-1b-it-int4.task',
    ],
    outputPath: 'public/models/gemma3-1b-it-int4-web.task',
  },
  {
    id: 'qwen-2.5-0.5b',
    // Official Google litert-community conversion, published ungated (Apache-2.0).
    urls: [
      'https://huggingface.co/litert-community/Qwen2.5-0.5B-Instruct/resolve/main/Qwen2.5-0.5B-Instruct_multi-prefill-seq_q8_ekv1280.task',
    ],
    outputPath: 'public/models/qwen2.5-0.5b-instruct-q8-ekv1280.task',
  },
  {
    id: 'qwen-2.5-1.5b',
    // Official Google litert-community conversion, published ungated (Apache-2.0).
    urls: [
      'https://huggingface.co/litert-community/Qwen2.5-1.5B-Instruct/resolve/main/Qwen2.5-1.5B-Instruct_multi-prefill-seq_q8_ekv1280.task',
    ],
    outputPath: 'public/models/qwen2.5-1.5b-instruct-q8-ekv1280.task',
  },
  {
    id: 'tinyllama-1.1b',
    // Official Google litert-community conversion, published ungated (Apache-2.0).
    urls: [
      'https://huggingface.co/litert-community/TinyLlama-1.1B-Chat-v1.0/resolve/main/TinyLlama-1.1B-Chat-v1.0_multi-prefill-seq_q8_ekv1280.task',
    ],
    outputPath: 'public/models/tinyllama-1.1b-chat-q8-ekv1280.task',
  },
];

function listModels() {
  console.log('Available models:');
  for (const m of MODELS) {
    console.log(`  ${m.id.padEnd(14)} → ${m.outputPath}`);
  }
}

function fetchToFile(model, url, redirectsLeft = 5) {
  return new Promise((resolve, reject) => {
    const dir = path.dirname(model.outputPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    const request = (target) => {
      https
        .get(target, { headers: { 'User-Agent': 'awe-system-download-script' } }, (response) => {
          // Hugging Face issues 302 redirects to its CDN — follow them.
          if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
            response.resume();
            if (redirectsLeft <= 0) {
              reject(new Error('Too many redirects'));
              return;
            }
            request(new URL(response.headers.location, target).href);
            return;
          }

          if (response.statusCode !== 200) {
            response.resume();
            reject(new Error(`HTTP ${response.statusCode}`));
            return;
          }

          const totalBytes = Number(response.headers['content-length']) || 0;
          let receivedBytes = 0;
          let lastPercent = -1;

          const file = fs.createWriteStream(model.outputPath);
          response.on('data', (chunk) => {
            receivedBytes += chunk.length;
            if (totalBytes > 0) {
              const percent = Math.floor((receivedBytes / totalBytes) * 100);
              if (percent !== lastPercent) {
                lastPercent = percent;
                process.stdout.write(`\r  ${model.id}: ${percent}% (${(receivedBytes / 1048576).toFixed(0)} MB)`);
              }
            }
          });
          response.pipe(file);
          file.on('finish', () => {
            file.close();
            process.stdout.write('\n');
            console.log(`  Downloaded ${model.id} → ${model.outputPath}`);
            resolve();
          });
          file.on('error', (err) => {
            fs.unlink(model.outputPath, () => {});
            reject(err);
          });
        })
        .on('error', (err) => {
          fs.unlink(model.outputPath, () => {});
          reject(err);
        });
    };

    request(url);
  });
}

async function downloadModel(model) {
  // Try each source in order (mirrors first, then fallbacks) so a single
  // dead link never blocks the pre-download.
  const errors = [];
  for (const url of model.urls) {
    try {
      await fetchToFile(model, url);
      return;
    } catch (err) {
      errors.push(`${new URL(url).host}: ${err.message}`);
    }
  }
  throw new Error(errors.join('; '));
}

async function main() {
  const args = process.argv.slice(2);

  if (args.includes('--list')) {
    listModels();
    return;
  }

  let selected = MODELS;
  const idArg = args.find((a) => !a.startsWith('--'));
  if (idArg) {
    selected = MODELS.filter((m) => m.id === idArg);
    if (selected.length === 0) {
      console.error(`Unknown model id: ${idArg}`);
      listModels();
      process.exit(1);
    }
  }

  console.log(`Downloading ${selected.length} model(s)…`);
  const failures = [];
  for (const model of selected) {
    try {
      await downloadModel(model);
    } catch (err) {
      failures.push(model.id);
      console.error(`  Failed to download ${model.id}: ${err.message}`);
      console.error('  (All listed sources failed — check your network or see README → On-Device Models.)');
    }
  }

  if (failures.length > 0) {
    console.error(`\nFinished with failures: ${failures.join(', ')}`);
    process.exit(1);
  }
  console.log('\nAll models downloaded.');
}

main();
