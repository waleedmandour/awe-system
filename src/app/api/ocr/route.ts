import { NextRequest, NextResponse } from 'next/server';

// Google Vision OCR API endpoint
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { image, apiKey } = body;

    if (!image) {
      return NextResponse.json(
        { error: 'No image provided' },
        { status: 400 }
      );
    }

    if (!apiKey) {
      return NextResponse.json(
        { error: 'Vision API key is required' },
        { status: 400 }
      );
    }

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
    });
  } catch (error) {
    console.error('OCR processing error:', error);
    return NextResponse.json(
      { error: 'Failed to process image', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
