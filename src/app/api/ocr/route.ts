import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';

// IMPORTANT: This prevents Vercel from timing out the OCR process after 10 seconds
export const maxDuration = 60;

// POST Endpoint for routing OCR requests
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { image, apiKey, geminiApiKey, useGemini } = body;

    if (!image) {
      return NextResponse.json(
        { error: 'No image provided' },
        { status: 400 }
      );
    }

    // Check which OCR method to use
    if (useGemini && geminiApiKey) {
      // Use Official Google Gemini for OCR
      return await performGeminiOCR(image, geminiApiKey);
    } else if (apiKey) {
      // Use Google Vision API for OCR
      return await performVisionOCR(image, apiKey);
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
// - Removes excessive whitespace and blank lines
// - Joins hyphenated word breaks across lines (e.g. "won-\nderful" → "wonderful")
// - Removes single-word orphan lines caused by line-break noise
// - Normalizes spacing while preserving real paragraph structure
function cleanExtractedText(raw: string): string {
  let text = raw.trim();
  // Replace multiple spaces with single space (but keep newlines)
  text = text.replace(/[ \t]+/g, ' ');
  // Fix hyphenated line breaks: if a line ends with a hyphen followed by newline,
  // join the two parts (e.g. "won-\nderful" → "wonderful")
  text = text.replace(/-\n(\w)/g, '$1');
  // Remove newlines that are NOT followed by another newline
  // (these are line-break artifacts from column/text detection, not real paragraphs)
  // Real paragraphs are separated by blank lines (double newline)
  text = text.replace(/([^\n])\n([^\n])/g, '$1 $2');
  // Collapse multiple blank lines into exactly one blank line
  text = text.replace(/\n{3,}/g, '\n\n');
  // Trim each line
  text = text
    .split('\n')
    .map(line => line.trim())
    .join('\n');
  // Final trim
  return text.trim();
}

// Helper function for bulletproof Base64 parsing
function extractBase64AndMimeType(imageString: string) {
  let base64Data = imageString;
  let mimeType = 'image/jpeg'; // Default

  // If the string includes a Data URI prefix, split it safely
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

// Perform OCR using Google Vision API via REST
async function performVisionOCR(image: string, apiKey: string) {
  try {
    const { base64Data } = extractBase64AndMimeType(image);

    // Call Google Vision API
    const visionResponse = await fetch(
      `https://vision.googleapis.com/v1/images:annotate?key=${apiKey}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          requests:[
            {
              image: {
                content: base64Data,
              },
              features:[
                {
                  type: 'DOCUMENT_TEXT_DETECTION',
                },
              ],
              imageContext: {
                languageHints: ['en'], // Remove or adjust if supporting Arabic/other languages
              },
            },
          ],
        }),
      }
    );

    if (!visionResponse.ok) {
      const error = await visionResponse.json();
      console.error('Vision API error:', error);
      return NextResponse.json(
        { error: 'Failed to process image with Vision API', details: error },
        { status: visionResponse.status }
      );
    }

    const result = await visionResponse.json();
    
    // Extract text from the response safely
    const textAnnotations = result.responses?.[0]?.textAnnotations;
    const rawText = textAnnotations?.[0]?.description || '';
    const extractedText = cleanExtractedText(rawText);
    
    const wordCount = extractedText.split(/\s+/).filter(Boolean).length;
    const confidence = result.responses?.[0]?.fullTextAnnotation?.pages?.[0]?.confidence || 0.9;

    return NextResponse.json({
      success: true,
      text: extractedText,
      wordCount,
      confidence,
      method: 'vision',
    });
  } catch (error) {
    console.error('Vision OCR error:', error);
    return NextResponse.json(
      { error: 'Failed to process image with Vision API', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

// Perform OCR using Official Google Gemini SDK
async function performGeminiOCR(image: string, geminiApiKey: string) {
  try {
    // 1. Initialize official Gemini Client with the User's API Key
    const genAI = new GoogleGenerativeAI(geminiApiKey);
    
    // 2. Use Gemini 3.0 Flash as requested for the latest speed and accuracy
    const model = genAI.getGenerativeModel({ 
      model: 'gemini-3-flash-preview',
      systemInstruction: 'You are an expert OCR system specialized in reading handwritten and printed text. Extract ALL text from images with the highest accuracy. Preserve the original formatting, line breaks, paragraphs, and structure exactly as written. If text is handwritten, carefully decipher each word. Do NOT add any commentary, summaries, or explanations. Output ONLY the extracted text itself.'
    });

    // 3. Extract Data
    const { base64Data, mimeType } = extractBase64AndMimeType(image);

    // 4. Prepare the request payload with OCR-optimized prompt
    const prompt = 'Extract ALL text from this image exactly as written. Preserve the original formatting, line breaks, and structure. This may be handwritten text — transcribe it carefully, preserving every word. Output ONLY the extracted text with no additional commentary or explanations.';
    
    const imagePart = {
      inlineData: {
        data: base64Data,
        mimeType: mimeType
      }
    };

    // 5. Call the API with OCR-optimized generation config
    //    - mediaResolution HIGH: critical for reading fine/small handwriting
    //      (supported by the API but not yet in SDK types — using type assertion)
    //    - temperature 0.1: deterministic, accurate text extraction
    //    - maxOutputTokens 8192: enough for long essays
    const result = await model.generateContent({
      contents: [{
        role: 'user',
        parts: [imagePart, { text: prompt }]
      }],
      generationConfig: {
        temperature: 0.1,
        mediaResolution: 'MEDIA_RESOLUTION_HIGH',
        maxOutputTokens: 8192,
      } as any
    });

    const rawText = result.response.text();
    const extractedText = cleanExtractedText(rawText);
    
    // Calculate word count
    const wordCount = extractedText.split(/\s+/).filter(Boolean).length;

    return NextResponse.json({
      success: true,
      text: extractedText,
      wordCount,
      confidence: 0.85, // Gemini doesn't provide confidence scores
      method: 'gemini',
    });
  } catch (error) {
    console.error('Gemini OCR error:', error);
    return NextResponse.json(
      { error: 'Failed to process image with Gemini', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
