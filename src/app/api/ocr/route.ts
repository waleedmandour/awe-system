import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';

// IMPORTANT: This prevents Vercel from timing out the OCR process
export const maxDuration = 60;

// Maximum image size in bytes (20MB) — Gemini API limit
const MAX_IMAGE_SIZE = 20 * 1024 * 1024;

// MIME types that Gemini supports
const SUPPORTED_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/bmp',
  'image/tiff',
];

// POST Endpoint for routing OCR requests
// Accepts both legacy `image` (single string) and new `images` (string array)
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { image, images, apiKey, geminiApiKey, useGemini } = body;

    // Normalize to array: support both `image` (legacy) and `images` (new multi-page)
    const imageArray: string[] = [];
    if (Array.isArray(images) && images.length > 0) {
      imageArray.push(...images);
    } else if (image) {
      imageArray.push(image);
    }

    if (imageArray.length === 0) {
      return NextResponse.json(
        { error: 'No image(s) provided' },
        { status: 400 }
      );
    }

    // Pre-process and validate all images upfront — fail fast before calling any API
    const processedImages: { base64: string; mimeType: string }[] = [];

    for (let i = 0; i < imageArray.length; i++) {
      try {
        const processed = processImageForAPI(imageArray[i]);
        processedImages.push(processed);
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Unknown error';
        console.error(`Image processing error (page ${i + 1}):`, msg);
        return NextResponse.json(
          { error: `Failed to process page ${i + 1}: ${msg}` },
          { status: 400 }
        );
      }
    }

    // Check which OCR method to use
    if (useGemini && geminiApiKey) {
      return await performGeminiOCR(processedImages, geminiApiKey);
    } else if (apiKey) {
      return await performVisionOCR(processedImages, apiKey);
    } else {
      return NextResponse.json(
        { error: 'Either Vision API key or Gemini API key is required' },
        { status: 400 }
      );
    }
  } catch (error) {
    console.error('OCR processing error:', error);
    return NextResponse.json(
      { error: 'Failed to process image', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

/**
 * Process and validate an image string for API consumption.
 * Handles data URIs, base64 sanitization, MIME type validation,
 * HEIC/HEIF detection, and size limits.
 */
function processImageForAPI(imageString: string): { base64: string; mimeType: string } {
  if (!imageString || typeof imageString !== 'string') {
    throw new Error('No image data provided');
  }

  let rawBase64: string;
  let mimeType: string;

  if (imageString.startsWith('data:')) {
    // Parse data URI: data:[<mimeType>][;base64],<data>
    const commaIndex = imageString.indexOf(',');
    if (commaIndex === -1) {
      throw new Error('Invalid data URI format — missing comma separator');
    }

    const headerPart = imageString.substring(0, commaIndex);
    rawBase64 = imageString.substring(commaIndex + 1);

    // Extract MIME type from header
    const mimeMatch = headerPart.match(/data:([^;]+)/);
    mimeType = mimeMatch ? mimeMatch[1].toLowerCase().trim() : 'image/jpeg';

    // Verify the data is actually base64 encoded (check for base64 marker)
    const isBase64 = headerPart.includes(';base64');
    if (!isBase64) {
      // Data URI without ;base64 means the data is URL-encoded, not base64
      throw new Error(
        `Image is not base64-encoded (found "${mimeType}" without ;base64). ` +
        `Please use a standard image format (JPEG, PNG, WEBP).`
      );
    }
  } else {
    // Raw base64 string without data URI prefix
    rawBase64 = imageString;
    mimeType = 'image/jpeg';
  }

  // Sanitize base64: remove ALL whitespace, newlines, and control characters
  // Mobile platforms (especially iOS) can embed newlines in FileReader output
  const sanitizedBase64 = rawBase64
    .replace(/[\s\r\n\t\f\v\u00A0\u2028\u2029]/g, '');

  if (sanitizedBase64.length === 0) {
    throw new Error('Image data is empty after processing');
  }

  // Validate that the sanitized string is valid base64
  // Base64 alphabet: A-Z, a-z, 0-9, +, /, and = for padding
  if (!/^[A-Za-z0-9+/]*={0,2}$/.test(sanitizedBase64)) {
    throw new Error(
      'Image data contains invalid base64 characters. ' +
      'This can happen with HEIC/HEIF images from iOS devices. ' +
      'Please convert the image to JPEG or PNG before uploading.'
    );
  }

  // Check for HEIC/HEIF format — NOT supported by Gemini or Vision API
  if (mimeType === 'image/heic' || mimeType === 'image/heif') {
    throw new Error(
      'HEIC/HEIF format is not supported. ' +
      'On iPhone: go to Settings → Camera → Formats → select "Most Compatible" ' +
      'to take photos in JPEG format, or use a different image.'
    );
  }

  // Warn for unsupported but potentially valid MIME types
  if (!SUPPORTED_MIME_TYPES.includes(mimeType)) {
    // Don't throw — try anyway with a fallback to JPEG
    console.warn(`Unsupported MIME type "${mimeType}", falling back to image/jpeg`);
    mimeType = 'image/jpeg';
  }

  // Check decoded size limit (~4/3 ratio for base64 to binary)
  const estimatedByteSize = Math.floor(sanitizedBase64.length * 0.75);
  if (estimatedByteSize > MAX_IMAGE_SIZE) {
    throw new Error(
      `Image is too large (~${Math.round(estimatedByteSize / 1024 / 1024)}MB). ` +
      `Maximum allowed size is ${Math.round(MAX_IMAGE_SIZE / 1024 / 1024)}MB. ` +
      `Please resize the image or take a photo with lower resolution.`
    );
  }

  return { base64: sanitizedBase64, mimeType };
}

// Clean OCR output into proper running lines for editing and assessment
function cleanExtractedText(raw: string): string {
  let text = raw.trim();
  // Replace multiple spaces with single space (but keep newlines)
  text = text.replace(/[ \t]+/g, ' ');
  // Fix hyphenated line breaks
  text = text.replace(/-\n(\w)/g, '$1');
  // Remove single newlines (line-break artifacts, not real paragraphs)
  text = text.replace(/([^\n])\n([^\n])/g, '$1 $2');
  // Collapse multiple blank lines into exactly one
  text = text.replace(/\n{3,}/g, '\n\n');
  // Trim each line
  text = text
    .split('\n')
    .map(line => line.trim())
    .join('\n');
  return text.trim();
}

// Perform OCR using Google Vision API — processes multiple images in order
async function performVisionOCR(images: { base64: string; mimeType: string }[], apiKey: string) {
  try {
    const allTexts: string[] = [];

    for (let i = 0; i < images.length; i++) {
      const { base64, mimeType } = images[i];

      const visionResponse = await fetch(
        `https://vision.googleapis.com/v1/images:annotate?key=${apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            requests: [{
              image: { content: base64 },
              features: [{ type: 'DOCUMENT_TEXT_DETECTION' }],
              imageContext: { languageHints: ['en'] },
            }],
          }),
        }
      );

      if (!visionResponse.ok) {
        const error = await visionResponse.json();
        console.error(`Vision API error (page ${i + 1}):`, error);
        // If first page fails, bubble up; if subsequent pages fail, skip
        if (i === 0) {
          return NextResponse.json(
            { error: 'Failed to process image with Vision API', details: error },
            { status: visionResponse.status }
          );
        }
        continue;
      }

      const result = await visionResponse.json();
      const textAnnotations = result.responses?.[0]?.textAnnotations;
      const rawText = textAnnotations?.[0]?.description || '';
      const cleanedText = cleanExtractedText(rawText);
      if (cleanedText) allTexts.push(cleanedText);
    }

    // Combine all pages with a paragraph break between them
    const combinedText = allTexts.join('\n\n');
    const wordCount = combinedText.split(/\s+/).filter(Boolean).length;

    return NextResponse.json({
      success: true,
      text: combinedText,
      wordCount,
      confidence: 0.9,
      method: 'vision',
      pageCount: images.length,
    });
  } catch (error) {
    console.error('Vision OCR error:', error);
    return NextResponse.json(
      { error: 'Failed to process image with Vision API', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

// Perform OCR using Google Gemini — processes multiple images in a single call
// This is the optimal approach: Gemini receives ALL images at once with a
// clear ordering instruction, so it naturally concatenates the text in the
// correct page order without duplication or reordering issues.
async function performGeminiOCR(images: { base64: string; mimeType: string }[], geminiApiKey: string) {
  try {
    const genAI = new GoogleGenerativeAI(geminiApiKey);

    const model = genAI.getGenerativeModel({
      model: 'gemini-3-flash-preview',
      systemInstruction: 'You are an expert OCR system specialized in reading handwritten and printed text. Extract ALL text from images with the highest accuracy. When multiple images are provided, they are pages of the SAME document in order (page 1, page 2, etc.). You MUST combine the text from all pages in exact page order, preserving the logical flow — do NOT duplicate the overlapping text at page boundaries. Output ONLY the full combined extracted text with no additional commentary, no page markers, and no explanations.'
    });

    // Build parts array: all images first, then the OCR prompt
    // This ensures Gemini processes images in the correct visual order
    const imageParts = images.map((img) => ({
      inlineData: { data: img.base64, mimeType: img.mimeType }
    }));

    const prompt = images.length === 1
      ? 'Extract ALL text from this image exactly as written. Preserve the original formatting, line breaks, and structure. This may be handwritten text — transcribe it carefully, preserving every word. Output ONLY the extracted text with no additional commentary or explanations.'
      : `These ${images.length} images are pages of the same essay, in order (page 1 first, page 2 second). Extract ALL text from ALL images and combine them into one continuous text in exact page order. Where text continues from one page to the next, merge seamlessly — do NOT repeat the overlapping content. Preserve paragraph breaks and formatting. Output ONLY the combined extracted text.`;

    const parts: any[] = [...imageParts, { text: prompt }];

    // Safety settings: lower thresholds to prevent blocking of handwritten essays
    const safetySettings = [
      { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_ONLY_HIGH' },
      { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_ONLY_HIGH' },
      { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_ONLY_HIGH' },
      { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_ONLY_HIGH' },
      { category: 'HARM_CATEGORY_CIVIC_INTEGRITY', threshold: 'BLOCK_ONLY_HIGH' },
    ];

    const result = await model.generateContent({
      contents: [{
        role: 'user',
        parts,
      }],
      generationConfig: {
        temperature: 0.1,
        mediaResolution: 'MEDIA_RESOLUTION_HIGH',
        maxOutputTokens: 8192,
      } as any,
      safetySettings,
    });

    // ── Check for blocking / truncation ──
    const promptFeedback = (result.response as any)?.promptFeedback;
    if (promptFeedback?.blockReason) {
      return NextResponse.json(
        { error: 'AI content filter blocked the image. Please try a different image or rephrase the content.', details: `Prompt blocked: ${promptFeedback.blockReason}` },
        { status: 422 }
      );
    }

    const candidate = (result.response as any)?.candidates?.[0];
    const finishReason = candidate?.finishReason;

    if (finishReason === 'SAFETY' || finishReason === 'RECITATION' || finishReason === 'LANGUAGE') {
      return NextResponse.json(
        { error: 'AI content filter blocked the OCR response. The essay may contain sensitive topics. Please try again or use the Vision API instead.', details: `Response blocked: ${finishReason}` },
        { status: 422 }
      );
    }

    // Handle null/undefined response safely
    const rawText = result.response?.text?.() || '';
    if (!rawText || rawText.trim().length === 0) {
      return NextResponse.json(
        { error: 'AI returned an empty response for the image. Please try again or use the Vision API instead.', details: `Empty response, finishReason: ${finishReason || 'unknown'}` },
        { status: 500 }
      );
    }

    if (finishReason === 'MAX_TOKENS') {
      console.warn('Gemini OCR response was truncated (MAX_TOKENS). The extracted text may be incomplete.');
    }

    const extractedText = cleanExtractedText(rawText);
    const wordCount = extractedText.split(/\s+/).filter(Boolean).length;

    return NextResponse.json({
      success: true,
      text: extractedText,
      wordCount,
      confidence: 0.85,
      method: 'gemini',
      pageCount: images.length,
    });
  } catch (error) {
    console.error('Gemini OCR error:', error);
    // Provide a user-friendly error message for common platform issues
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';
    let userMessage = 'Failed to process image with Gemini.';

    if (errorMsg.includes('string') && (errorMsg.includes('platform') || errorMsg.includes('match') || errorMsg.includes('invalid'))) {
      userMessage =
        'The image format is not supported. ' +
        'This commonly occurs with HEIC/HEIF photos from iPhones. ' +
        'Solution: Go to Settings → Camera → Formats → select "Most Compatible" to use JPEG. ' +
        'Alternatively, take a screenshot of the image and upload that instead.';
    } else if (errorMsg.includes('quota') || errorMsg.includes('RESOURCE_EXHAUSTED') || errorMsg.includes('429')) {
      userMessage = 'API quota exceeded. Please wait a moment and try again.';
    } else if (errorMsg.includes('API key') || errorMsg.includes('401') || errorMsg.includes('403')) {
      userMessage = 'Invalid API key. Please check your Gemini API key in settings.';
    }

    return NextResponse.json(
      { error: userMessage, details: errorMsg },
      { status: 500 }
    );
  }
}
