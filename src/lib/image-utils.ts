/**
 * Convert and resize an image file to JPEG using an off-screen canvas.
 * This handles:
 *  - HEIC/HEIF detection (unsupported format, gives clear error)
 *  - Oversized images (resizes to max dimension while preserving aspect ratio)
 *  - Non-standard MIME types (normalizes to JPEG)
 *  - Multi-page optimization: reduces resolution and quality for 2-page uploads
 *    to stay within Vercel's ~4.5MB serverless body size limit
 *  - Returns a clean data:image/jpeg;base64,... string
 */

// Target maximum base64 payload size per image (in characters)
// Vercel serverless body limit is ~4.5MB; for 2 images we aim for ~2MB each
// base64 is ~4/3 of binary, so 1.5MB binary = ~2MB base64
const TARGET_BASE64_SIZE = 1.8 * 1024 * 1024; // ~1.8MB per image in base64 chars

// Quality steps to try when reducing file size (from high to low)
const QUALITY_STEPS = [0.92, 0.85, 0.78, 0.70, 0.62, 0.55];

export function processImageFile(file: File, totalPages: number = 1): Promise<string> {
  return new Promise((resolve, reject) => {
    // Detect HEIC/HEIF early — canvas cannot load these
    const mimeType = (file.type || '').toLowerCase();
    if (mimeType === 'image/heic' || mimeType === 'image/heif') {
      reject(new Error(
        'HEIC/HEIF format is not supported. ' +
        'On iPhone: go to Settings \u2192 Camera \u2192 Formats \u2192 select "Most Compatible". ' +
        'Or take a screenshot of the image and upload that instead.'
      ));
      return;
    }

    // Check if it's a valid image type
    if (!file.type.startsWith('image/')) {
      reject(new Error('Please select an image file (JPEG, PNG, or WEBP).'));
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const dataUri = e.target?.result as string;
      if (!dataUri) {
        reject(new Error('Failed to read image file.'));
        return;
      }

      // Load into an Image element to get dimensions and enable canvas resize
      const img = new Image();
      img.onload = () => {
        // Reduce max dimension for multi-page uploads to keep total payload under Vercel limit
        // Single page: 2000px max dimension, quality 0.92
        // Two pages: 1600px max dimension, quality 0.82 — reduces each image by ~50%
        let maxDimension: number;
        let initialQuality: number;

        if (totalPages >= 2) {
          maxDimension = 1600;
          initialQuality = 0.82;
        } else {
          maxDimension = 2000;
          initialQuality = 0.92;
        }

        let { width, height } = img;

        // Resize if needed
        if (width > maxDimension || height > maxDimension) {
          const scale = maxDimension / Math.max(width, height);
          width = Math.round(width * scale);
          height = Math.round(height * scale);
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) { reject(new Error('Canvas not supported')); return; }
        ctx.drawImage(img, 0, 0, width, height);

        // For multi-page uploads, aggressively optimize size to fit Vercel body limit
        if (totalPages >= 2) {
          const optimized = optimizeJpegSize(canvas, initialQuality);
          resolve(optimized);
        } else {
          // Single page: use standard quality
          const jpegDataUri = canvas.toDataURL('image/jpeg', initialQuality);
          resolve(jpegDataUri);
        }
      };
      img.onerror = () => {
        reject(new Error(
          'Failed to load image. The file may be corrupted or in an unsupported format. ' +
          'Try converting to JPEG and uploading again.'
        ));
      };
      img.src = dataUri;
    };
    reader.onerror = () => {
      reject(new Error('Failed to read the file. Please try again.'));
    };
    reader.readAsDataURL(file);
  });
}

/**
 * Iteratively reduce JPEG quality and dimensions to keep base64 size under target.
 * This ensures multi-page uploads stay within Vercel's serverless body limit.
 */
function optimizeJpegSize(canvas: HTMLCanvasElement, startQuality: number): string {
  let currentCanvas = canvas;
  let quality = startQuality;

  // Start with the initial quality
  let result = currentCanvas.toDataURL('image/jpeg', quality);

  // If already under target, return immediately
  if (result.length <= TARGET_BASE64_SIZE) {
    return result;
  }

  // Try reducing quality first (faster, no re-rendering)
  for (const q of QUALITY_STEPS) {
    if (q >= quality) continue; // skip qualities we've already tried or that are higher
    result = currentCanvas.toDataURL('image/jpeg', q);
    if (result.length <= TARGET_BASE64_SIZE) {
      return result;
    }
  }

  // If still too large, progressively reduce dimensions by 20% and retry
  let w = currentCanvas.width;
  let h = currentCanvas.height;
  for (let attempt = 0; attempt < 3; attempt++) {
    w = Math.round(w * 0.8);
    h = Math.round(h * 0.8);

    const smallerCanvas = document.createElement('canvas');
    smallerCanvas.width = w;
    smallerCanvas.height = h;
    const ctx = smallerCanvas.getContext('2d');
    if (!ctx) break;
    ctx.drawImage(currentCanvas, 0, 0, w, h);
    currentCanvas = smallerCanvas;

    // Try with decent quality on smaller canvas
    for (const q of [0.82, 0.75, 0.68, 0.60]) {
      result = currentCanvas.toDataURL('image/jpeg', q);
      if (result.length <= TARGET_BASE64_SIZE) {
        return result;
      }
    }
  }

  // Last resort: return the smallest we could get
  return result;
}
