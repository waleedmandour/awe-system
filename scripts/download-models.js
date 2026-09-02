#!/usr/bin/env node
/**
 * ─── AWE System — Local Model Download Script ────────────────────────────────
 *
 * Optionally pre-downloads on-device LLM weights into `public/models/` so the
 * app can serve them itself instead of relying on the Hugging Face URLs in
 * `src/lib/config.ts` (useful for restricted networks / offline labs).
 *
 * Usage:
 *   node scripts/download-models.js            # download all models
 *   node scripts/download-models.js gemma-3-1b # download a specific model
 *   node scripts/download-models.js --list     # list catalog models
 *
 * After downloading, point the model's `downloadUrl` in src/lib/config.ts at
 * `/models/<file>.task`, or serve the file and let students download it in-app.
 */

const fs = require('fs');
const path = require('path');
const https = require('https');
const { URL } = require('url');

// Keep this catalog in sync with LOCAL_MODELS in src/lib/config.ts
const MODELS = [
  {
    id: 'gemma-3-1b',
    url: 'https://huggingface.co/litert-community/Gemma3-1B-IT/resolve/main/gemma3-1b-it-int4.task',
    outputPath: 'public/models/gemma3-1b-it-int4.task',
  },
  {
    id: 'gemma-2-2b',
    url: 'https://huggingface.co/litert-community/Gemma2-2B-IT/resolve/main/gemma2-2b-it-int4.task',
    outputPath: 'public/models/gemma2-2b-it-int4.task',
  },
];

function listModels() {
  console.log('Available models:');
  for (const m of MODELS) {
    console.log(`  ${m.id.padEnd(14)} → ${m.outputPath}`);
  }
}

function downloadModel(model, redirectsLeft = 5) {
  return new Promise((resolve, reject) => {
    const dir = path.dirname(model.outputPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    const request = (url) => {
      https
        .get(url, { headers: { 'User-Agent': 'awe-system-download-script' } }, (response) => {
          // Hugging Face issues 302 redirects to its CDN — follow them.
          if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
            response.resume();
            if (redirectsLeft <= 0) {
              reject(new Error('Too many redirects'));
              return;
            }
            request(new URL(response.headers.location, url).href);
            return;
          }

          if (response.statusCode !== 200) {
            response.resume();
            reject(new Error(`HTTP ${response.statusCode} for ${model.id}`));
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

    request(model.url);
  });
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
      console.error('  (Some Hugging Face models require accepting a license first — see README → Local LLM models.)');
    }
  }

  if (failures.length > 0) {
    console.error(`\nFinished with failures: ${failures.join(', ')}`);
    process.exit(1);
  }
  console.log('\nAll models downloaded.');
}

main();
