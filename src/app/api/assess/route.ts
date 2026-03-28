import { NextRequest, NextResponse } from 'next/server';
import ZAI from 'z-ai-web-dev-sdk';

// Detailed assessment rubrics for Foundation courses (0230, 0340)
const FOUNDATION_RUBRICS = {
  targetWordCount: { min: 110, max: 130, ideal: 120 },
  criteria: [
    {
      name: 'Task Response',
      maxScore: 6,
      description: 'How well the essay addresses the task requirements, audience, purpose, and genre.',
      rubric: {
        '0-2': 'Very Poor: Text fails to fulfill any task requirements and shows no understanding of audience, purpose or genre. Length of text may be inappropriate.',
        '3': 'Unsatisfactory: Response does not adequately fulfill task requirements and shows little awareness of audience, purpose and genre. Little or no attempt at topic development. Length of text may be inappropriate.',
        '3.5': 'Satisfactory: Response fulfills most task requirements and shows adequate awareness of audience, purpose and genre. Topic development is attempted but may be limited, predictable, and/or irrelevant in places. Length of text may be inappropriate.',
        '4': 'Good: Response fulfills specific task requirements. Little more could reasonably be expected for the level. Response shows a good level of awareness of audience, purpose and genre. Topic is developed and explored well.',
        '4.5-6': 'Excellent: Response fulfills all specific task requirements and exceeds expectations for this level. Response shows a high level of awareness of audience, purpose and genre. Topic is fully developed and explored.'
      }
    },
    {
      name: 'Coherence and Cohesion',
      maxScore: 6,
      description: 'Logical organization, paragraphing, and use of cohesive devices.',
      rubric: {
        '0-2': 'Very Poor: Very little control of organizational features. The text is largely confused and incoherent, making it challenging for the reader to process.',
        '3': 'Unsatisfactory: Organization is limited, compromising coherence. Some re-reading may be necessary. Ideas lack progression and may be repeated. There may be no paragraphs. Some simple cohesive devices are used but usually inaccurately and repetitively.',
        '3.5': 'Satisfactory: Organization provides an underlying coherence although progression may be inconsistent. Text may be stilted in places. Paragraphing is generally appropriate although ideas may not always be supported. Cohesive devices may be over or under used, or used mechanically in places. Text may be repetitive due to lack of referencing.',
        '4': 'Good: Organization of information and ideas makes text clear and easy to understand. Each paragraph has a main topic supported by some relevant details. Cohesive devices are frequently used accurately both within and/or between sentences.',
        '4.5-6': 'Excellent: Information and ideas are organized so effectively that text has a fluent progression throughout. Opening and closing sections are appropriate and fully developed. Each paragraph has a clear main topic supported by well-organised, relevant details. Cohesive devices are consistently used accurately both within and/or between sentences.'
      }
    },
    {
      name: 'Lexical Resource',
      maxScore: 6,
      description: 'Range and accuracy of vocabulary, word choice, and spelling.',
      rubric: {
        '0-2': 'Very Poor: Vocabulary is very limited and may be unrelated to the task or consists largely of inappropriate memorized chunks. Poor word choice and spelling prevent the communication of ideas.',
        '3': 'Unsatisfactory: Vocabulary is inadequate or inappropriate for the level and task and may be used repetitively. Errors in word choice and spelling frequently affect communication.',
        '3.5': 'Satisfactory: Text has a limited but adequate range of vocabulary for the level and task. Core vocabulary is usually used accurately and appropriately. If there are attempts to extend beyond this range, there may be some inaccuracy or inappropriacy which affects communication in places.',
        '4': 'Good: Text has a good range of vocabulary for the level and task. Core vocabulary is frequently used accurately and appropriately. If there are attempts to extend beyond this range, there may be some inaccuracy or inappropriacy, although communication is not affected.',
        '4.5-6': 'Excellent: Text has a significantly wider range of vocabulary than is expected for the level and task. Core vocabulary is consistently used accurately and appropriately. There may be occasional errors in word choice and spelling where more complex/creative lexis is attempted but communication is not affected.'
      }
    },
    {
      name: 'Grammatical Range and Accuracy',
      maxScore: 6,
      description: 'Range and accuracy of grammatical structures and punctuation.',
      rubric: {
        '0-2': 'Very Poor: Structures are inaccurate and errors predominate, preventing meaningful communication. Punctuation may be inadequate and/or inaccurate.',
        '3': 'Unsatisfactory: Structures are very limited and inadequate for the level and task. Errors are noticeable and may often affect communication. Punctuation may be inadequate and/or inaccurate.',
        '3.5': 'Satisfactory: Text has a limited but adequate range of structures for the level and task. Core structures for the level are usually used accurately and appropriately although they may sometimes be used mechanically. Grammatical errors may affect communication in places. Punctuation is generally effective.',
        '4': 'Good: Text has a good range of structures for the level and task. Core structures for the level are frequently used accurately and appropriately. If there are attempts to extend beyond this range, there may be some inaccuracy or inappropriacy, without affecting communication. Punctuation is well managed and effective.',
        '4.5-6': 'Excellent: Text has a significantly wider range of structures than is expected for the level and task. Core structures are consistently used accurately and appropriately. There may be occasional errors where more complex structures are attempted but communication is not affected. Punctuation is well managed and effective.'
      }
    }
  ],
  specialRules: [
    'If the text is somewhat off-topic, deduct 50% of the mark obtained for Task Response and Lexical Resource.',
    'A completely off-topic text should receive a zero for Task Response and Lexical Resource.'
  ]
};

// Post-foundation/Credit course criteria (LANC2160)
const CREDIT_CRITERIA = [
  { name: 'Task Achievement', maxScore: 5, description: 'How well the summary captures main points' },
  { name: 'Coherence & Cohesion', maxScore: 5, description: 'Logical organization and linking of ideas' },
  { name: 'Lexical Resource', maxScore: 5, description: 'Range and accuracy of vocabulary' },
  { name: 'Grammatical Range & Accuracy', maxScore: 5, description: 'Range and accuracy of grammar' },
];

// Build detailed rubric prompt for Foundation courses
function buildFoundationPrompt(text: string, topic: string | null, wordCount: number): string {
  const rubrics = FOUNDATION_RUBRICS;
  const wordCountStatus = wordCount < rubrics.targetWordCount.min 
    ? `WARNING: Word count (${wordCount}) is BELOW the required range of ${rubrics.targetWordCount.min}-${rubrics.targetWordCount.max} words. This may affect the Task Response score.`
    : wordCount > rubrics.targetWordCount.max
    ? `NOTE: Word count (${wordCount}) exceeds the target range of ${rubrics.targetWordCount.min}-${rubrics.targetWordCount.max} words. Minor flexibility is acceptable.`
    : `Word count (${wordCount}) is within the acceptable range of ${rubrics.targetWordCount.min}-${rubrics.targetWordCount.max} words.`;

  const criteriaDetails = rubrics.criteria.map(c => {
    const rubricLevels = Object.entries(c.rubric)
      .map(([score, desc]) => `  Score ${score}: ${desc}`)
      .join('\n');
    return `${c.name} (0-${c.maxScore}):\n${rubricLevels}`;
  }).join('\n\n');

  return `You are an expert writing assessor evaluating a Foundation level student essay for Sultan Qaboos University's Center for Preparatory Studies.

IMPORTANT CONTEXT: Students at this level are at CEFR A1-A2 level (Basic User). Your feedback MUST be appropriate for this proficiency level:
- A1 (Breakthrough): Can understand and use familiar everyday expressions and very basic phrases aimed at the satisfaction of needs of a concrete type.
- A2 (Waystage): Can understand sentences and frequently used expressions related to areas of most immediate relevance. Can communicate in simple and routine tasks requiring a simple and direct exchange of information.

When providing feedback:
- Use simple, clear language that A1-A2 learners can understand
- Focus on fundamental writing skills appropriate for this level
- Provide concrete, achievable improvement suggestions
- Avoid overly technical linguistic terminology
- Be encouraging while maintaining appropriate standards for the level

${topic ? `Essay Topic: ${topic}` : 'No specific topic provided.'}

Student Essay:
"""
${text}
"""

WORD COUNT: ${wordCountStatus}

DETAILED ASSESSMENT RUBRICS (Foundation Courses - FP0230 and FP0340):

${criteriaDetails}

SPECIAL RULES:
${rubrics.specialRules.map((r, i) => `${i + 1}. ${r}`).join('\n')}

SCORING INSTRUCTIONS:
1. For each criterion, carefully read the rubric descriptors and determine which band best matches the student's performance.
2. Assign a specific score within the band (you may use 0.5 increments between 0-6).
3. For each criterion, provide structured feedback that includes:
   - A brief positive comment on what the student did well
   - SPECIFIC MISTAKES OR ERRORS found in the text (quote the exact words/phrases from the essay)
   - Clear explanation of why each is a mistake
   - Concrete suggestions for improvement
4. Calculate the total score as the sum of all criterion scores (max 24).
5. Calculate the percentage as (totalScore / 24) * 100.

FEEDBACK FORMAT: Structure each criterion's feedback as:
**Strengths:** [What was done well]
**Mistakes Found:**
- "[exact quote from text]" - [explanation of the error]
- "[another exact quote]" - [explanation]
**Suggestions:** [How to improve]

Respond in the following JSON format ONLY (no additional text or markdown):
{
  "scores": [
    {
      "criterionName": "Task Response",
      "score": 4,
      "maxScore": 6,
      "feedback": "**Strengths:** ...\\n**Mistakes Found:**\\n- \\"...\\",\\n**Suggestions:** ..."
    }
  ],
  "totalScore": 16,
  "maxScore": 24,
  "percentage": 66.67,
  "overallFeedback": "Your comprehensive overall feedback summarizing strengths and main areas for improvement...",
  "wordCount": ${wordCount},
  "wordCountPenalty": false
}`;
}

// Build prompt for Credit/Post-foundation courses
function buildCreditPrompt(text: string, topic: string | null, wordCount: number): string {
  const criteria = CREDIT_CRITERIA;
  const totalMaxScore = criteria.reduce((sum, c) => sum + c.maxScore, 0);

  return `You are an expert writing assessor evaluating a Credit level student essay for Sultan Qaboos University's Center for Preparatory Studies.

IMPORTANT CONTEXT: Students at this level are at CEFR A1-A2 level (Basic User). Your feedback MUST be appropriate for this proficiency level:
- A1 (Breakthrough): Can understand and use familiar everyday expressions and very basic phrases aimed at the satisfaction of needs of a concrete type.
- A2 (Waystage): Can understand sentences and frequently used expressions related to areas of most immediate relevance. Can communicate in simple and routine tasks requiring a simple and direct exchange of information.

When providing feedback:
- Use simple, clear language that A1-A2 learners can understand
- Focus on fundamental writing skills appropriate for this level
- Provide concrete, achievable improvement suggestions
- Avoid overly technical linguistic terminology
- Be encouraging while maintaining appropriate standards for the level

${topic ? `Essay Topic: ${topic}` : 'No specific topic provided.'}

Student Essay:
"""
${text}
"""

WORD COUNT: ${wordCount} words

ASSESSMENT CRITERIA (Credit Course - LANC2160):
${criteria.map(c => `- ${c.name} (0-${c.maxScore}): ${c.description}`).join('\n')}

SCORING INSTRUCTIONS:
1. For each criterion, assess the student's performance and assign a score (0-${criteria[0].maxScore}).
2. For each criterion, provide structured feedback that includes:
   - A brief positive comment on what the student did well
   - SPECIFIC MISTAKES OR ERRORS found in the text (quote the exact words/phrases from the essay)
   - Clear explanation of why each is a mistake
   - Concrete suggestions for improvement
3. Calculate the total score as the sum of all criterion scores (max ${totalMaxScore}).
4. Calculate the percentage as (totalScore / ${totalMaxScore}) * 100.

FEEDBACK FORMAT: Structure each criterion's feedback as:
**Strengths:** [What was done well]
**Mistakes Found:**
- "[exact quote from text]" - [explanation of the error]
- "[another exact quote]" - [explanation]
**Suggestions:** [How to improve]

Respond in the following JSON format ONLY (no additional text or markdown):
{
  "scores": [
    {
      "criterionName": "Task Achievement",
      "score": 4,
      "maxScore": 5,
      "feedback": "**Strengths:** ...\\n**Mistakes Found:**\\n- \\"...\\",\\n**Suggestions:** ..."
    }
  ],
  "totalScore": 16,
  "maxScore": ${totalMaxScore},
  "percentage": 80,
  "overallFeedback": "Your comprehensive overall feedback..."
}`;
}

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

    // Calculate word count
    const wordCount = text.trim().split(/\s+/).filter(Boolean).length;

    // Determine course type and build appropriate prompt
    const isFoundation = ['0230', '0340'].includes(courseCode);
    const prompt = isFoundation 
      ? buildFoundationPrompt(text, topic, wordCount)
      : buildCreditPrompt(text, topic, wordCount);

    const criteria = isFoundation 
      ? FOUNDATION_RUBRICS.criteria 
      : CREDIT_CRITERIA;
    const totalMaxScore = criteria.reduce((sum, c) => sum + c.maxScore, 0);

    // Use the AI SDK for assessment
    const zai = await ZAI.create();
    
    const completion = await zai.chat.completions.create({
      messages: [
        {
          role: 'system',
          content: 'You are an expert writing assessment AI for Foundation and Credit level university courses at Sultan Qaboos University. All students are at CEFR A1-A2 level (Basic User). Your feedback must use simple, clear language appropriate for this proficiency level. Focus on fundamental skills and provide encouraging, constructive guidance. Always highlight specific mistakes by quoting exact words from the student\'s text. You respond only with valid JSON. No markdown formatting or code blocks.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      temperature: 0.3,
      max_tokens: 4000,
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
    const assessedCriteria = assessment.scores.map((s: any) => s.criterionName);
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

    // Recalculate total score to ensure accuracy
    assessment.totalScore = assessment.scores.reduce((sum: number, s: any) => sum + s.score, 0);
    assessment.maxScore = assessment.scores.reduce((sum: number, s: any) => sum + s.maxScore, 0);
    assessment.percentage = (assessment.totalScore / assessment.maxScore) * 100;

    // Add word count info
    assessment.wordCount = wordCount;
    assessment.targetWordCount = isFoundation ? FOUNDATION_RUBRICS.targetWordCount : null;

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
