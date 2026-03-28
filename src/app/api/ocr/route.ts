import { NextRequest, NextResponse } from 'next/server';
import ZAI from 'z-ai-web-dev-sdk';

// Google Vision OCR API endpoint
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
      // Use Gemini for OCR
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

// Perform OCR using Google Vision API
async function performVisionOCR(image: string, apiKey: string) {
  try {
    // Call Google Vision API
    const visionResponse = await fetch(
      `https://vision.googleapis.com/v1/images:annotate?key=${apiKey}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          requests: [
            {
              image: {
                content: image.replace(/^data:image\/[a-z]+;base64,/, ''),
              },
              features: [
                {
                  type: 'DOCUMENT_TEXT_DETECTION',
                  maxResults: 1,
                },
              ],
              imageContext: {
                languageHints: ['en'], // English language hint
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
    
    // Extract text from the response
    const textAnnotations = result.responses?.[0]?.textAnnotations;
    const extractedText = textAnnotations?.[0]?.description || '';
    
    // Calculate word count
    const wordCount = extractedText.trim().split(/\s+/).filter(Boolean).length;

    return NextResponse.json({
      success: true,
      text: extractedText,
      wordCount,
      confidence: result.responses?.[0]?.fullTextAnnotation?.pages?.[0]?.confidence || 0.9,
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

// Perform OCR using Gemini (via z-ai-web-dev-sdk)
async function performGeminiOCR(image: string, geminiApiKey: string) {
  try {
    const zai = await ZAI.create();

    // Extract the base64 data from the data URL
    const base64Data = image.replace(/^data:image\/[a-z]+;base64,/, '');
    
    // Determine image type from data URL
    const imageTypeMatch = image.match(/data:image\/([a-z]+);base64,/);
    const imageType = imageTypeMatch ? imageTypeMatch[1] : 'jpeg';

    // Create the prompt for text extraction
    const completion = await zai.chat.completions.create({
      messages: [
        {
          role: 'system',
          content: 'You are an OCR assistant. Your task is to extract ALL text from the provided image exactly as it appears. Preserve the original formatting, line breaks, and structure. Only output the extracted text, nothing else. Do not add any commentary, explanations, or formatting markers.'
        },
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: 'Extract all text from this image. Preserve the original formatting and structure. Output only the extracted text.'
            },
            {
              type: 'image_url',
              image_url: {
                url: `data:image/${imageType};base64,${base64Data}`
              }
            }
          ]
        }
      ],
      temperature: 0.1,
      max_tokens: 4000,
    });

    const extractedText = completion.choices?.[0]?.message?.content || '';
    
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
