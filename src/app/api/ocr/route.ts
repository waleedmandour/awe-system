import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';

// IMPORTANT: This prevents Vercel from timing out the OCR process
export const maxDuration = 60;

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

    // Check which OCR method to use
    if (useGemini && geminiApiKey) {
      return await performGeminiOCR(imageArray, geminiApiKey);
    } else if (apiKey) {
      return await performVisionOCR(imageArray, apiKey);
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

// Helper function for bulletproof Base64 parsing
function extractBase64AndMimeType(imageString: string) {
  let base64Data = imageString;
  let mimeType = 'image/jpeg'; // Default

  if (imageString.startsWith('data:')) {
    const parts = imageString.split(',');
    base64Data = parts[1];
    const mimeMatch = parts[0].match(/:(.*?);/);
    if (mimeMatch) {
      mimeType = mimeMatch[1];
    }
  }

  return { base64Data, mimeType };
}

// Perform OCR using Google Vision API — processes multiple images in order
async function performVisionOCR(images: string[], apiKey: string) {
  try {
    const allTexts: string[] = [];

    for (let i = 0; i < images.length; i++) {
      const { base64Data } = extractBase64AndMimeType(images[i]);

      const visionResponse = await fetch(
        `https://vision.googleapis.com/v1/images:annotate?key=${apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            requests: [{
              image: { content: base64Data },
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
async function performGeminiOCR(images: string[], geminiApiKey: string) {
  try {
    const genAI = new GoogleGenerativeAI(geminiApiKey);
    
    const model = genAI.getGenerativeModel({ 
      model: 'gemini-3-flash-preview',
      systemInstruction: 'You are an expert OCR system specialized in reading handwritten and printed text. Extract ALL text from images with the highest accuracy. When multiple images are provided, they are pages of the SAME document in order (page 1, page 2, etc.). You MUST combine the text from all pages in exact page order, preserving the logical flow — do NOT duplicate the overlapping text at page boundaries. Output ONLY the full combined extracted text with no additional commentary, no page markers, and no explanations.'
    });

    // Build parts array: all images first, then the OCR prompt
    // This ensures Gemini processes images in the correct visual order
    const imageParts = images.map((img) => {
      const { base64Data, mimeType } = extractBase64AndMimeType(img);
      return {
        inlineData: { data: base64Data, mimeType }
      };
    });

    const prompt = images.length === 1
      ? 'Extract ALL text from this image exactly as written. Preserve the original formatting, line breaks, and structure. This may be handwritten text — transcribe it carefully, preserving every word. Output ONLY the extracted text with no additional commentary or explanations.'
      : `These ${images.length} images are pages of the same essay, in order (page 1 first, page 2 second). Extract ALL text from ALL images and combine them into one continuous text in exact page order. Where text continues from one page to the next, merge seamlessly — do NOT repeat the overlapping content. Preserve paragraph breaks and formatting. Output ONLY the combined extracted text.`;

    const parts: any[] = [...imageParts, { text: prompt }];

    const result = await model.generateContent({
      contents: [{
        role: 'user',
        parts,
      }],
      generationConfig: {
        temperature: 0.1,
        mediaResolution: 'MEDIA_RESOLUTION_HIGH',
        maxOutputTokens: 8192,
      } as any
    });

    const rawText = result.response.text();
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
    return NextResponse.json(
      { error: 'Failed to process image with Gemini', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
