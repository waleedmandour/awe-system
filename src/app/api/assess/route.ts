import { NextRequest, NextResponse } from 'next/server';
import ZAI from 'z-ai-web-dev-sdk';

// Assessment criteria for different course types
const FOUNDATION_CRITERIA = [
  { name: 'Task Response', maxScore: 6, description: 'How well the essay addresses the task' },
  { name: 'Coherence & Cohesion', maxScore: 6, description: 'Logical organization and linking of ideas' },
  { name: 'Lexical Resource', maxScore: 6, description: 'Range and accuracy of vocabulary' },
  { name: 'Grammatical Range & Accuracy', maxScore: 6, description: 'Range and accuracy of grammar' },
];

const POST_FOUNDATION_CRITERIA = [
  { name: 'Task Achievement', maxScore: 5, description: 'How well the summary captures main points' },
  { name: 'Coherence & Cohesion', maxScore: 5, description: 'Logical organization and linking of ideas' },
  { name: 'Lexical Resource', maxScore: 5, description: 'Range and accuracy of vocabulary' },
  { name: 'Grammatical Range & Accuracy', maxScore: 5, description: 'Range and accuracy of grammar' },
];

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { text, courseCode, topic, apiKey } = body;

    if (!text) {
      return NextResponse.json(
        { error: 'No text provided for assessment' },
        { status: 400 }
      );
    }

    if (!apiKey) {
      return NextResponse.json(
        { error: 'Gemini API key is required' },
        { status: 400 }
      );
    }

    // Determine criteria based on course
    const isFoundation = ['0230', '0340'].includes(courseCode);
    const criteria = isFoundation ? FOUNDATION_CRITERIA : POST_FOUNDATION_CRITERIA;
    const totalMaxScore = criteria.reduce((sum, c) => sum + c.maxScore, 0);

    // Build the assessment prompt
    const prompt = `You are an expert IELTS writing examiner. Assess the following ${isFoundation ? 'foundation level' : 'post-foundation level'} student essay.

${topic ? `Essay Topic: ${topic}` : ''}

Student Essay:
"""
${text}
"""

Assess this essay based on the following criteria. For each criterion, provide:
1. A score (0-${criteria[0].maxScore} for each criterion)
2. Specific, constructive feedback explaining the score
3. Actionable suggestions for improvement

Criteria to assess:
${criteria.map(c => `- ${c.name} (0-${c.maxScore}): ${c.description}`).join('\n')}

IMPORTANT INSTRUCTIONS:
- Be fair and encouraging while maintaining academic standards
- Provide specific examples from the text to support your feedback
- Focus on constructive, actionable feedback
- Consider the student's level (${isFoundation ? 'Foundation' : 'Post-Foundation'})

Respond in the following JSON format ONLY (no additional text):
{
  "scores": [
    {
      "criterionName": "Task Response",
      "score": 4,
      "maxScore": ${criteria[0].maxScore},
      "feedback": "Your specific feedback here..."
    }
  ],
  "totalScore": 16,
  "maxScore": ${totalMaxScore},
  "percentage": 66.67,
  "bandScore": 5.5,
  "overallFeedback": "Your comprehensive overall feedback here..."
}`;

    // Use the AI SDK for assessment
    const zai = await ZAI.create();
    
    const completion = await zai.chat.completions.create({
      messages: [
        {
          role: 'system',
          content: 'You are an expert writing assessment AI. You respond only with valid JSON. No markdown formatting or code blocks.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      temperature: 0.3,
      max_tokens: 2000,
    });

    const responseText = completion.choices?.[0]?.message?.content || '';
    
    // Parse the JSON response
    let assessment;
    try {
      // Clean the response - remove markdown code blocks if present
      const cleanedResponse = responseText
        .replace(/```json\n?/g, '')
        .replace(/```\n?/g, '')
        .trim();
      assessment = JSON.parse(cleanedResponse);
    } catch (parseError) {
      console.error('Failed to parse assessment response:', responseText);
      return NextResponse.json(
        { error: 'Failed to parse AI assessment response' },
        { status: 500 }
      );
    }

    // Validate the assessment structure
    if (!assessment.scores || !Array.isArray(assessment.scores)) {
      return NextResponse.json(
        { error: 'Invalid assessment structure' },
        { status: 500 }
      );
    }

    // Ensure all criteria are assessed
    const assessedCriteria = assessment.scores.map(s => s.criterionName);
    const missingCriteria = criteria.filter(c => !assessedCriteria.includes(c.name));
    
    if (missingCriteria.length > 0) {
      // Add missing criteria with default scores
      missingCriteria.forEach(c => {
        assessment.scores.push({
          criterionName: c.name,
          score: 0,
          maxScore: c.maxScore,
          feedback: 'Unable to assess this criterion from the provided text.'
        });
      });
    }

    return NextResponse.json({
      success: true,
      assessment: {
        ...assessment,
        createdAt: new Date().toISOString(),
      }
    });
  } catch (error) {
    console.error('Assessment error:', error);
    return NextResponse.json(
      { error: 'Failed to assess essay', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
