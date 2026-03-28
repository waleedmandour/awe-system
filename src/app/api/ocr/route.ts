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
    const extractedText = textAnnotations?.[0]?.description || '';
    
    const wordCount = extractedText.trim().split(/\s+/).filter(Boolean).length;
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
    const model = genAI.getGenerativeModel({ model: 'gemini-3.0-flash' });

    // 3. Extract Data
    const { base64Data, mimeType } = extractBase64AndMimeType(image);

    // 4. Prepare the request payload
    const prompt = 'Extract ALL text from this image exactly as it appears. Preserve the original formatting, line breaks, and structure. Output ONLY the extracted text with no additional commentary or explanations.';
    
    const imagePart = {
      inlineData: {
        data: base64Data,
        mimeType: mimeType
      }
    };

    // 5. Call the API
    const result = await model.generateContent([prompt, imagePart]);
    const extractedText = result.response.text();
    
    // Calculate word count
    const wordCount = extractedText.trim().split(/\s+/).filter(Boolean).length;

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
