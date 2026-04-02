import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from '@google/generative-ai';

// Word count targets by exam type for Foundation courses
const EXAM_WORD_COUNTS: Record<string, { min: number; max: number; ideal: number; label: string }> = {
  'mid-semester': { min: 110, max: 130, ideal: 120, label: 'Mid-semester Exam' },
  'final':        { min: 190, max: 210, ideal: 200, label: 'Final Exam' },
};

// Default word count target (used when no exam type is specified)
const DEFAULT_FOUNDATION_WORD_COUNT = { min: 110, max: 130, ideal: 120 };

// Detailed assessment rubrics for Foundation courses (0230, 0340)
const FOUNDATION_RUBRICS = {
  criteria:[
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
  specialRules:[
    'If the text is somewhat off-topic, deduct 50% of the mark obtained for Task Response and Lexical Resource.',
    'A completely off-topic text should receive a zero for Task Response and Lexical Resource.'
  ]
};

// Post-foundation/Credit course criteria (LANC2160) — Synthesis Essay
const CREDIT_CRITERIA = [
  { name: 'Task Achievement', maxScore: 5, description: 'How well the essay achieves the task requirements' },
  { name: 'Coherence & Cohesion', maxScore: 5, description: 'Logical organization and linking of ideas' },
  { name: 'Lexical Resource', maxScore: 5, description: 'Range and accuracy of vocabulary' },
  { name: 'Grammatical Range & Accuracy', maxScore: 5, description: 'Range and accuracy of grammar' },
];

// Summary Writing criteria for LANC2160 (A2-B1 level, 0-5 per criterion)
const SUMMARY_CRITERIA = [
  {
    name: 'Task Achievement',
    maxScore: 5,
    description: 'How effectively the summary captures the main points of the source text using the student\'s own words.'
  },
  {
    name: 'Coherence & Cohesion',
    maxScore: 5,
    description: 'How logically the summary is organized and how well ideas are linked together.'
  },
  {
    name: 'Lexical Resource',
    maxScore: 5,
    description: 'The range and accuracy of vocabulary used, including paraphrasing ability.'
  },
  {
    name: 'Grammar & Accuracy',
    maxScore: 5,
    description: 'The range and accuracy of grammatical structures, sentence variety, and punctuation.'
  },
];

// Detailed rubric band descriptors for Summary Writing (A2-B1 level)
const SUMMARY_RUBRICS = {
  criteria: [
    {
      name: 'Task Achievement',
      maxScore: 5,
      rubric: {
        '0': 'No attempt or completely irrelevant. The student has not written a summary, or the text has no connection to the source material whatsoever. No main ideas are identified or represented.',
        '0.5': 'Minimal attempt. The student has written a few disconnected words or phrases that vaguely relate to the source text, but no main ideas are captured. The response shows almost no understanding of the original text.',
        '1': 'Very poor achievement. The summary identifies at most one minor point from the source text. Most or all of the main ideas are missing. The response may consist largely of copied phrases without comprehension. The summary does not reflect the overall message of the original text.',
        '1.5': 'Poor achievement. The summary captures one main idea but misses several key points. The student may include irrelevant details or personal opinions. Large portions of the source text\'s main arguments are omitted. Paraphrasing is minimal, with heavy reliance on copying from the original.',
        '2': 'Unsatisfactory achievement. The summary captures some main ideas but omits at least two key points. The student includes some irrelevant or minor details. Paraphrasing is limited — the student copies phrases or sentences directly from the source text rather than using their own words. The summary does not accurately reflect the overall message.',
        '2.5': 'Below expectations. The summary captures most of the main ideas but may miss one or two supporting points. Some paraphrasing is attempted, but there is still noticeable copying from the source text. The student generally understands the overall message but does not clearly distinguish between main and minor ideas.',
        '3': 'Satisfactory achievement. The summary captures the main ideas of the source text adequately. The student demonstrates reasonable understanding of the original text. Some paraphrasing is used, though some phrases may still be copied directly. The distinction between main and minor ideas is generally clear, though minor points may occasionally be included.',
        '3.5': 'Good achievement. The summary captures all or nearly all main ideas and the overall message effectively. The student demonstrates solid understanding of the source text. Paraphrasing is used consistently, with only minor instances of copied phrases. Supporting details are appropriately selected and not confused with main ideas.',
        '4': 'Very good achievement. The summary captures all main ideas clearly and accurately reflects the overall message of the source text. The student demonstrates strong comprehension. Effective paraphrasing is used throughout — the student consistently uses their own words to convey the meaning. The summary is focused and excludes irrelevant details.',
        '4.5': 'Excellent achievement. The summary captures all main ideas and key supporting details with precision and clarity. The student demonstrates excellent comprehension of the source text. The paraphrasing is highly effective and natural-sounding. The summary flows as a cohesive text that accurately represents the source.',
        '5': 'Outstanding achievement. The summary is a highly accurate and comprehensive reflection of the source text\'s main ideas and overall message. The student demonstrates sophisticated comprehension. Paraphrasing is consistently natural and effective throughout. The summary reads as a well-constructed, independent text that faithfully represents the source material.',
      }
    },
    {
      name: 'Coherence & Cohesion',
      maxScore: 5,
      rubric: {
        '0': 'No coherence whatsoever. The text is a random collection of words or fragments with no logical connection or structure. Ideas cannot be followed at all.',
        '0.5': 'Minimal coherence. The text consists of a few loosely related fragments. There is no discernible organizational pattern. No linking words or transitional devices are used.',
        '1': 'Very poor coherence. Ideas are presented in a random or confusing order. There may be some recognizable individual sentences, but they do not connect logically. No linking words are used. The reader must guess the intended meaning.',
        '1.5': 'Poor coherence. There is minimal organization — ideas may be listed but not connected. Very few or no linking words are used. The text is difficult to follow, and the reader must re-read to understand the relationships between ideas.',
        '2': 'Unsatisfactory coherence. There is an attempt at organization, but ideas are presented in a somewhat disjointed manner. Basic linking words (e.g., "and", "but") may be used but are often incorrect or repetitive. The text requires effort from the reader to follow the logic.',
        '2.5': 'Below expectations. Basic organization is present but inconsistent. Some simple linking words (e.g., "first", "also", "however") are used, but transitions between ideas are often abrupt. Paragraph structure may be weak or absent. The text is generally understandable but not smooth.',
        '3': 'Satisfactory coherence. The summary has a logical structure that is generally easy to follow. Simple linking words and basic transitional devices are used appropriately. Ideas are connected in a way that the reader can follow without significant difficulty. Basic paragraphing may be used.',
        '3.5': 'Good coherence. The summary is well-organized with clear logical progression. A range of linking words and transitional devices are used correctly (e.g., "moreover", "in addition", "as a result"). The text flows smoothly from one idea to the next. Paragraph structure is appropriate.',
        '4': 'Very good coherence. The summary is clearly and logically organized with strong progression of ideas. A good range of cohesive devices is used effectively and naturally. The text reads smoothly and is easy to follow. Paragraphing supports the overall structure well.',
        '4.5': 'Excellent coherence. The summary demonstrates sophisticated organization with seamless flow between ideas. A wide range of cohesive devices is used naturally and accurately. The text is highly readable and engaging. The organizational structure enhances the clarity of the content.',
        '5': 'Outstanding coherence. The summary is exceptionally well-organized with flawless logical flow. Cohesive devices are used with mastery, creating a text that is seamless and highly effective. The structure clearly serves the content and enhances reader comprehension.',
      }
    },
    {
      name: 'Lexical Resource',
      maxScore: 5,
      rubric: {
        '0': 'No meaningful vocabulary. The text contains no recognizable vocabulary related to the task, or vocabulary is so limited that no meaning can be conveyed.',
        '0.5': 'Extremely limited vocabulary. A few isolated words are used, but they are insufficient to convey meaning. Vocabulary is largely inappropriate for the task.',
        '1': 'Very poor vocabulary. The student uses a very narrow range of words, many of which are repeated. Word choice is frequently inaccurate or inappropriate. Spelling errors are pervasive and impede understanding.',
        '1.5': 'Poor vocabulary. The student uses a limited range of vocabulary with frequent repetition. Word choice is often inaccurate, and many words are used inappropriately. Spelling errors are frequent and sometimes affect communication.',
        '2': 'Unsatisfactory vocabulary. The student uses a basic range of vocabulary that is adequate for simple communication but lacks variety. Some attempt at paraphrasing is made but word choice is often awkward or inaccurate. Several spelling errors are present but generally do not prevent understanding.',
        '2.5': 'Below expectations. The vocabulary is limited but generally adequate for the task. The student attempts paraphrasing with some success, though word choice may be awkward at times. Core vocabulary is used correctly, but there is little evidence of range or variety. Some spelling errors occur.',
        '3': 'Satisfactory vocabulary. The student uses an adequate range of vocabulary for the summary task. Basic paraphrasing is attempted and usually effective. Core vocabulary is generally accurate and appropriate. Spelling errors are present but do not significantly affect communication.',
        '3.5': 'Good vocabulary. The student uses a good range of vocabulary appropriate for the task. Paraphrasing is generally effective, showing the student can express source text ideas in their own words. Some less common vocabulary may be attempted. Spelling is generally accurate.',
        '4': 'Very good vocabulary. The student uses a varied and appropriate range of vocabulary. Paraphrasing is effective and natural-sounding. The student shows awareness of word choice and can select appropriate synonyms. Spelling is mostly accurate with only minor errors.',
        '4.5': 'Excellent vocabulary. The student uses a wide and precise range of vocabulary that enhances the quality of the summary. Paraphrasing is highly effective and natural. The student demonstrates strong control of word choice and collocation. Spelling is consistently accurate.',
        '5': 'Outstanding vocabulary. The student uses a sophisticated and precise range of vocabulary with excellent control. Paraphrasing is consistently natural, accurate, and effective. Word choice enhances the clarity and quality of the summary. Spelling is consistently accurate throughout.',
      }
    },
    {
      name: 'Grammar & Accuracy',
      maxScore: 5,
      rubric: {
        '0': 'No grammatical control. The text consists of random words or fragments with no attempt at sentence construction. No grammatical structures are used correctly.',
        '0.5': 'Extremely limited grammar. One or two recognizable simple sentences may be present, but grammatical control is almost non-existent. Errors in every sentence prevent meaningful communication.',
        '1': 'Very poor grammar. Only the simplest sentence structures are attempted, and most contain errors. Subject-verb agreement, tense usage, and article usage are consistently incorrect. Punctuation is largely absent or inaccurate.',
        '1.5': 'Poor grammar. Simple sentence structures are attempted with limited success. Frequent grammatical errors in tense, subject-verb agreement, and word order are present. The student struggles to form complete, correct sentences. Punctuation is inconsistent.',
        '2': 'Unsatisfactory grammar. Simple sentences can be formed but often contain errors. There is limited variety in sentence structure — most sentences follow the same basic pattern. Common grammatical errors (articles, prepositions, tenses) occur frequently. Basic punctuation is used but often incorrectly.',
        '2.5': 'Below expectations. The student can form simple sentences with reasonable accuracy, but complex sentences contain errors. Some variety in sentence structure is attempted. Common grammatical errors still occur (articles, prepositions, tenses) but do not always impede understanding. Basic punctuation is generally correct.',
        '3': 'Satisfactory grammar. The student uses simple sentences accurately and attempts some complex structures with varying success. A reasonable range of grammatical structures is evident. Errors in articles, prepositions, and tenses occur but do not significantly affect meaning. Punctuation is generally effective.',
        '3.5': 'Good grammar. The student uses a good range of simple and some complex sentence structures with reasonable accuracy. Errors are present but are typically minor and do not impede communication. Sentence variety is evident. Punctuation is generally accurate and supports readability.',
        '4': 'Very good grammar. The student demonstrates good control of a range of grammatical structures including simple and complex sentences. Errors are infrequent and minor. Sentence variety enhances the quality of the summary. Punctuation is accurate and effective.',
        '4.5': 'Excellent grammar. The student demonstrates strong control of a wide range of grammatical structures. Errors are rare and minor. Complex sentence structures are used naturally and accurately. Punctuation is consistently accurate and enhances clarity.',
        '5': 'Outstanding grammar. The student demonstrates near-native control of grammatical structures. A wide variety of sentence structures is used naturally and accurately. Errors are virtually non-existent. Punctuation is flawless and supports the text\'s readability and clarity.',
      }
    },
  ],
};

// Build detailed rubric prompt for Foundation courses
function buildFoundationPrompt(text: string, topic: string | null, wordCount: number, targetWordCount: { min: number; max: number; ideal: number; label?: string }): string {
  const rubrics = FOUNDATION_RUBRICS;
  const wordCountStatus = wordCount < targetWordCount.min 
    ? `WARNING: Word count (${wordCount}) is BELOW the required range of ${targetWordCount.min}-${targetWordCount.max} words. This MUST lower the Task Response score.`
    : wordCount > targetWordCount.max
    ? `NOTE: Word count (${wordCount}) exceeds the target range of ${targetWordCount.min}-${targetWordCount.max} words. Minor flexibility is acceptable.`
    : `Word count (${wordCount}) is within the acceptable range of ${targetWordCount.min}-${targetWordCount.max} words.`;

  const criteriaDetails = rubrics.criteria.map(c => {
    const rubricLevels = Object.entries(c.rubric)
      .map(([score, desc]) => `  Score ${score}: ${desc}`)
      .join('\n');
    return `${c.name} (0-${c.maxScore}):\n${rubricLevels}`;
  }).join('\n\n');

  return `You are an expert writing assessor evaluating a Foundation level student essay for Sultan Qaboos University's Center for Preparatory Studies.

STUDENT LEVEL: CEFR A1-A2 (Basic User). Feedback must use simple, clear language that A1-A2 learners can understand. Be encouraging while maintaining appropriate standards. Avoid overly technical linguistic terminology.

${topic ? `Essay Topic: ${topic}` : 'No specific topic provided.'}

Student Essay:
"""
${text}
"""

WORD COUNT: ${wordCountStatus}

ASSESSMENT RUBRICS (Foundation Courses - FP0230 and FP0340):

${criteriaDetails}

SPECIAL RULES:
${rubrics.specialRules.map((r, i) => `${i + 1}. ${r}`).join('\n')}

============================================================
SCORING AND FEEDBACK INSTRUCTIONS (CRITICAL — FOLLOW EXACTLY):
============================================================

STEP 1 — SCORE each criterion using WHOLE or HALF numbers (0, 0.5, 1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5, 5.5, or 6). If the essay's quality falls between two adjacent score bands, award a half-point (e.g., 3.5). Use 0.5 increments only — never use 0.25 or 0.75.

STEP 2 — For EACH criterion, write a "Justification" paragraph that:
  (a) Explicitly names the score band you chose (e.g. "Score 3.5" meaning between Satisfactory and Good)
  (b) Quotes at least ONE specific phrase or sentence from the student's essay as evidence
  (c) Explains why the essay fits that band descriptor — connect the evidence to the rubric
  (d) If you awarded a half-point, explain which aspects place it in the lower band and which aspects place it in the higher band
  (e) If the score is below 4, clearly state what is missing compared to the next higher band
  (f) If the score is 5 or 6, explain what the student did beyond expectations

This justification must make the score transparent and defensible. A reader should understand exactly why that score was given based on the evidence.

STEP 3 — For each criterion, list SPECIFIC errors found in the text. Format each as:
  - "[exact quoted text]" — explanation of the error and how to fix it

STEP 4 — For each criterion, provide 1-2 concrete, achievable suggestions for improvement appropriate for an A1-A2 learner.

STEP 5 — overallFeedback must be a comprehensive summary (3-5 sentences) that:
  - Highlights the student's strongest criterion and what they did well
  - Identifies the weakest area needing the most attention
  - Gives one prioritized action item to focus on next

STEP 6 — Calculate totalScore = sum of all criterion scores (max 24). Scores may include 0.5 increments (e.g., 3.5, 4.5). Calculate percentage = round(totalScore / 24 * 100).

============================================================
CRITICAL OUTPUT RULES:
- Respond with ONLY the raw JSON object. No markdown, no code fences, no commentary.
- Do NOT wrap the JSON in triple-backtick code blocks.
- Use straight double quotes, not smart/curly quotes.
- Do NOT add trailing commas after the last item in arrays or objects.
- All string values must have properly escaped quotes inside them.

JSON OUTPUT FORMAT:
============================================================
{
  "scores": [
    {
      "criterionName": "Task Response",
      "score": 4,
      "maxScore": 6,
      "justification": "Score 4: Good. The essay addresses the task by [explanation]. For example, the student writes: \\"[exact quote]\\" which shows [specific rubric alignment].",
      "strengths": "The student clearly addresses the topic and provides relevant examples. The opening sentence introduces the subject effectively.",
      "mistakes": [
        "[exact quoted text]" — Explanation of the error and how to fix it
      ],
      "suggestions": "Try to add a clear concluding sentence that summarizes your main point. Use transition words like 'In conclusion' or 'To sum up'."
    }
  ],
  "totalScore": 16,
  "maxScore": 24,
  "percentage": 67,
  "overallFeedback": "Your strongest area is [criterion] where you [specific strength]. The area that needs the most improvement is [criterion] because [reason]. Focus on [one prioritized action] to improve your next essay."
}`;
}

// Build prompt for Credit/Post-foundation courses
function buildCreditPrompt(text: string, topic: string | null, wordCount: number): string {
  const criteria = CREDIT_CRITERIA;
  const totalMaxScore = criteria.reduce((sum, c) => sum + c.maxScore, 0);

  return `You are an expert writing assessor evaluating a Credit level student essay for Sultan Qaboos University's Center for Preparatory Studies.

STUDENT LEVEL: CEFR A1-A2 (Basic User). Feedback must use simple, clear language that A1-A2 learners can understand. Be encouraging while maintaining appropriate standards. Avoid overly technical linguistic terminology.

${topic ? `Essay Topic: ${topic}` : 'No specific topic provided.'}

Student Essay:
"""
${text}
"""

WORD COUNT: ${wordCount} words

ASSESSMENT CRITERIA (Credit Course - LANC2160):
${criteria.map(c => `- ${c.name} (0-${c.maxScore}): ${c.description}`).join('\n')}

============================================================
SCORING AND FEEDBACK INSTRUCTIONS (CRITICAL — FOLLOW EXACTLY):
============================================================

STEP 1 — SCORE each criterion using WHOLE or HALF numbers (0, 0.5, 1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, or 5). If the essay's quality falls between two adjacent score bands, award a half-point (e.g., 2.5). Use 0.5 increments only — never use 0.25 or 0.75.

STEP 2 — For EACH criterion, write a "Justification" paragraph that:
  (a) Explicitly names the score band you chose (e.g. "Score 2.5" meaning between Unsatisfactory and Satisfactory)
  (b) Quotes at least ONE specific phrase or sentence from the student's essay as evidence
  (c) Explains why the essay earned that score based on the criterion description
  (d) If you awarded a half-point, explain which aspects place it in the lower band and which aspects place it in the higher band
  (e) If the score is below 3, clearly state what is missing compared to a higher score
  (f) If the score is 4 or 5, explain what the student did beyond basic expectations

STEP 3 — For each criterion, list SPECIFIC errors found in the text. Format each as:
  - "[exact quoted text]" — explanation of the error and how to fix it

STEP 4 — For each criterion, provide 1-2 concrete, achievable suggestions for improvement appropriate for an A1-A2 learner.

STEP 5 — overallFeedback must be a comprehensive summary (3-5 sentences) that highlights the student's strongest criterion, identifies the weakest area, and gives one prioritized action item.

STEP 6 — Calculate totalScore = sum of all criterion scores (max ${totalMaxScore}). Calculate percentage = round(totalScore / ${totalMaxScore} * 100).

============================================================
CRITICAL OUTPUT RULES:
- Respond with ONLY the raw JSON object. No markdown, no code fences, no commentary.
- Do NOT wrap the JSON in triple-backtick code blocks.
- Use straight double quotes, not smart/curly quotes.
- Do NOT add trailing commas after the last item in arrays or objects.
- All string values must have properly escaped quotes inside them.

JSON OUTPUT FORMAT:
============================================================
{
  "scores": [
    {
      "criterionName": "Task Achievement",
      "score": 4,
      "maxScore": 5,
      "justification": "The essay achieves the task well by [explanation]. For example, \\"[exact quote]\\" shows [specific alignment with criterion].",
      "strengths": "The student captures the main points effectively and demonstrates good comprehension of the source material.",
      "mistakes": [
        "[exact quoted text]" — Explanation of the error and how to fix it
      ],
      "suggestions": "Make sure every main point from the original text is represented in your summary. Use your own words rather than copying phrases."
    }
  ],
  "totalScore": 16,
  "maxScore": ${totalMaxScore},
  "percentage": 80,
  "overallFeedback": "Your strongest area is [criterion] where you [specific strength]. The area that needs the most improvement is [criterion] because [reason]. Focus on [one prioritized action] to improve your next essay."
}`;
}

// Build prompt for Summary Writing (LANC2160)
function buildSummaryPrompt(
  studentText: string,
  sourceText: string,
  sourceTitle: string,
  wordCount: number,
  targetWordCount: { min: number; max: number; ideal: number }
): string {
  const rubrics = SUMMARY_RUBRICS;
  const totalMaxScore = SUMMARY_CRITERIA.reduce((sum, c) => sum + c.maxScore, 0); // 20

  const wordCountStatus = wordCount < 20
    ? `WARNING: Word count (${wordCount}) is BELOW the minimum of 20 words. This MUST significantly lower the Task Achievement score.`
    : wordCount < targetWordCount.min
    ? `WARNING: Word count (${wordCount}) is BELOW the recommended range of ${targetWordCount.min}-${targetWordCount.max} words. The summary should be approximately one-third of the original text length. This should lower the Task Achievement score.`
    : wordCount > targetWordCount.max
    ? `NOTE: Word count (${wordCount}) exceeds the recommended range of ${targetWordCount.min}-${targetWordCount.max} words. A summary should be concise and approximately one-third of the original text length. Minor flexibility is acceptable, but excessive length may indicate the student included unnecessary details rather than summarizing.`
    : `Word count (${wordCount}) is within the acceptable range of ${targetWordCount.min}-${targetWordCount.max} words.`;

  const criteriaDetails = rubrics.criteria.map(c => {
    const rubricLevels = Object.entries(c.rubric)
      .map(([score, desc]) => `  Score ${score}: ${desc}`)
      .join('\n');
    return `${c.name} (0-${c.maxScore}):\n${rubricLevels}`;
  }).join('\n\n');

  return `You are an expert writing assessor evaluating a Credit level student's summary for Sultan Qaboos University's Center for Preparatory Studies, course LANC2160 (Academic English: Summary Writing & Synthesis Essay).

STUDENT LEVEL: CEFR A2-B1 (Elementary to Pre-Intermediate). Feedback must use simple, clear language that A2-B1 learners can understand. Be encouraging while maintaining appropriate academic standards. Avoid overly technical linguistic terminology.

TASK: The student was asked to read the source text below and write a summary of approximately one-third of the original text length.

SOURCE TEXT:
Title: "${sourceTitle}"
"""
${sourceText}
"""

STUDENT'S SUMMARY:
"""
${studentText}
"""

${wordCountStatus}
Target summary length: ${targetWordCount.min}-${targetWordCount.max} words (approximately one-third of the ${sourceText.trim().split(/\s+/).filter(Boolean).length}-word source text).

SUMMARY WRITING ASSESSMENT RUBRICS (LANC2160 — Summary Writing):

${criteriaDetails}

SUMMARY-SPECIFIC ASSESSMENT RULES:
1. A summary must capture the MAIN IDEAS of the source text — focus on key points, not minor details.
2. The student must use their OWN WORDS (paraphrasing). Direct copying of phrases or sentences from the source text without paraphrasing indicates poor summarizing skills and should lower the Task Achievement and Lexical Resource scores.
3. A summary should NOT include the student's personal opinions, arguments, or new information not present in the source text.
4. The summary should be approximately one-third of the original text length. Significantly shorter summaries likely miss key points; significantly longer ones likely include unnecessary details.
5. If the summary is off-topic (not about the source text at all), give Task Achievement = 0.
6. If the student has simply copied large portions of the source text, this is NOT an acceptable summary — it should score low on Task Achievement and Lexical Resource regardless of how "accurate" the text is.

============================================================
SCORING AND FEEDBACK INSTRUCTIONS (CRITICAL — FOLLOW EXACTLY):
============================================================

STEP 1 — SCORE each criterion using WHOLE or HALF numbers (0, 0.5, 1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, or 5). Use 0.5 increments only — never use 0.25 or 0.75. If the summary's quality falls between two adjacent score bands, award a half-point (e.g., 3.5).

STEP 2 — For EACH criterion, write a "Justification" paragraph that:
  (a) Explicitly names the score band you chose (e.g. "Score 3.5 — Good achievement")
  (b) Quotes at least ONE specific phrase or sentence from the student's summary as evidence
  (c) Explains why the summary fits that band descriptor — connect the evidence to the rubric
  (d) If you awarded a half-point, explain which aspects place it in the lower band and which aspects place it in the higher band
  (e) For Task Achievement: specifically address how many main ideas from the source text were captured, whether paraphrasing was used, and whether irrelevant details were excluded
  (f) If the score is below 3, clearly state what is missing compared to a higher score
  (g) If the score is 4 or 5, explain what the student did beyond basic expectations

STEP 3 — For each criterion, list SPECIFIC errors found in the text. Format each as:
  - "[exact quoted text]" — explanation of the error and how to fix it

STEP 4 — For each criterion, provide 1-2 concrete, achievable suggestions for improvement appropriate for an A2-B1 learner. For example: "Try using linking words like 'Furthermore' or 'In addition' to connect your ideas."

STEP 5 — overallFeedback must be a comprehensive summary (4-6 sentences) that:
  - Identifies which main ideas from the source text the student captured and which ones were missing
  - Highlights the student's strongest criterion and what they did well
  - Identifies the weakest area needing the most attention
  - Comments on the paraphrasing quality (own words vs. copied text)
  - Gives one prioritized action item to focus on next

STEP 6 — Calculate totalScore = sum of all criterion scores (max ${totalMaxScore}). Scores may include 0.5 increments (e.g., 3.5, 4.5). Calculate percentage = round(totalScore / ${totalMaxScore} * 100).

============================================================
CRITICAL OUTPUT RULES:
- Respond with ONLY the raw JSON object. No markdown, no code fences, no commentary.
- Do NOT wrap the JSON in triple-backtick code blocks.
- Use straight double quotes, not smart/curly quotes.
- Do NOT add trailing commas after the last item in arrays or objects.
- All string values must have properly escaped quotes inside them.

JSON OUTPUT FORMAT:
============================================================
{
  "scores": [
    {
      "criterionName": "Task Achievement",
      "score": 3.5,
      "maxScore": 5,
      "justification": "Score 3.5 — Good achievement. The summary captures most main ideas effectively. For example, the student writes: \\"[exact quote]\\" which shows [specific rubric alignment]. The student paraphrased well in most places, though some phrases were copied directly from the source text.",
      "strengths": "The student captures the main points about [X] and [Y] effectively. The paraphrasing shows reasonable comprehension of the source text.",
      "mistakes": [
        "[exact quoted text]" — Explanation of the error and how to fix it
      ],
      "suggestions": "Try to capture ALL main ideas from the source text. Remember to use your own words rather than copying phrases directly."
    },
    {
      "criterionName": "Coherence & Cohesion",
      "score": 3,
      "maxScore": 5,
      "justification": "Score 3 — Satisfactory coherence. [explanation with quoted evidence]",
      "strengths": "[specific strengths]",
      "mistakes": ["[exact quoted text]" — explanation],
      "suggestions": "[1-2 improvement suggestions]"
    },
    {
      "criterionName": "Lexical Resource",
      "score": 3,
      "maxScore": 5,
      "justification": "Score 3 — Satisfactory vocabulary. [explanation with quoted evidence]",
      "strengths": "[specific strengths]",
      "mistakes": ["[exact quoted text]" — explanation],
      "suggestions": "[1-2 improvement suggestions]"
    },
    {
      "criterionName": "Grammar & Accuracy",
      "score": 3.5,
      "maxScore": 5,
      "justification": "Score 3.5 — Good grammar. [explanation with quoted evidence]",
      "strengths": "[specific strengths]",
      "mistakes": ["[exact quoted text]" — explanation],
      "suggestions": "[1-2 improvement suggestions]"
    }
  ],
  "totalScore": 13,
  "maxScore": ${totalMaxScore},
  "percentage": 65,
  "overallFeedback": "Your summary captures the main ideas about [X, Y, Z] from the source text, but misses [key point]. Your strongest area is [criterion] where you [specific strength]. The area that needs the most improvement is [criterion] because [reason]. [Comment on paraphrasing]. Focus on [one prioritized action] to improve your next summary."
}`;
}

/**
 * Robustly extract a JSON object from LLM output that may be:
 *  - Wrapped in markdown code fences (```json ... ```)
 *  - Preceded or followed by conversational text
 *  - Containing control characters or BOM markers
 *  - Truncated (incomplete JSON due to token limit)
 *  - Using smart quotes instead of straight quotes
 */
function extractJSON(raw: string): any {
  let text = raw.trim();

  // Remove BOM if present
  if (text.charCodeAt(0) === 0xFEFF) {
    text = text.slice(1);
  }

  // Remove markdown code fences
  text = text.replace(/```json\s*/gi, '');
  text = text.replace(/```\s*/g, '');

  // Replace smart/curly quotes with straight quotes (LLMs often produce these)
  text = text.replace(/[\u2018\u2019]/g, "'");   // ' → '
  text = text.replace(/[\u201C\u201D]/g, '"');   // " → "

  // Find the first '{' and last '}' to extract just the JSON object
  const firstBrace = text.indexOf('{');
  const lastBrace = text.lastIndexOf('}');
  if (firstBrace !== -1 && lastBrace > firstBrace) {
    text = text.substring(firstBrace, lastBrace + 1);
  }

  // Remove control characters (except newline, tab, carriage return)
  text = text.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');

  // Attempt 1: Direct parse
  try {
    return JSON.parse(text);
  } catch (_e) {
    // continue to cleanup
  }

  // Attempt 2: Remove trailing commas (common LLM artifact)
  // Remove commas before } or ] (with optional whitespace)
  let cleaned = text.replace(/,\s*([\]}])/g, '$1');

  try {
    return JSON.parse(cleaned);
  } catch (_e) {
    // continue
  }

  // Attempt 3: Fix unescaped quotes in string values
  // This handles cases where the LLM puts unescaped double quotes inside strings
  cleaned = attemptFixUnescapedQuotes(cleaned);

  try {
    return JSON.parse(cleaned);
  } catch (_e) {
    // continue
  }

  // Attempt 4: If all else fails, try to extract using a bracket-matching approach
  const extracted = extractJsonObject(cleaned);
  if (extracted) {
    return JSON.parse(extracted);
  }

  throw new Error('Could not extract valid JSON from AI response');
}

/**
 * Attempt to fix unescaped double quotes inside JSON string values.
 * This is a best-effort heuristic — not a full JSON parser.
 */
function attemptFixUnescapedQuotes(json: string): string {
  const result: string[] = [];
  let i = 0;
  let inString = false;
  let escaped = false;

  while (i < json.length) {
    const ch = json[i];

    if (escaped) {
      result.push(ch);
      escaped = false;
      i++;
      continue;
    }

    if (ch === '\\') {
      result.push(ch);
      escaped = true;
      i++;
      continue;
    }

    if (ch === '"') {
      if (inString) {
        // Check if the next non-whitespace char looks like it's outside a string
        // (i.e., it's a JSON structural character)
        const afterStr = json.substring(i + 1).trimStart();
        const nextChar = afterStr[0];
        if (nextChar === ':' || nextChar === ',' || nextChar === '}' || nextChar === ']' || nextChar === undefined) {
          // This quote ends the string — normal JSON behavior
          inString = false;
        } else {
          // This quote is likely an unescaped quote inside the string — escape it
          result.push('\\"');
          i++;
          continue;
        }
      } else {
        inString = true;
      }
      result.push(ch);
      i++;
      continue;
    }

    result.push(ch);
    i++;
  }

  return result.join('');
}

/**
 * Extract a JSON object by finding balanced braces from the first '{'.
 * Returns the substring from first '{' to its matching '}'.
 */
function extractJsonObject(text: string): string | null {
  const start = text.indexOf('{');
  if (start === -1) return null;

  let depth = 0;
  let inStr = false;
  let escaped = false;

  for (let i = start; i < text.length; i++) {
    const ch = text[i];

    if (escaped) {
      escaped = false;
      continue;
    }

    if (ch === '\\' && inStr) {
      escaped = true;
      continue;
    }

    if (ch === '"' && !escaped) {
      inStr = !inStr;
      continue;
    }

    if (!inStr) {
      if (ch === '{') depth++;
      if (ch === '}') {
        depth--;
        if (depth === 0) {
          return text.substring(start, i + 1);
        }
      }
    }
  }

  // If we got here, JSON is truncated — try to close it manually
  if (depth > 0) {
    let partial = text.substring(start);
    // Remove any trailing incomplete key/value
    partial = partial.replace(/,\s*"[^"]*"\s*:?\s*$/, '');
    // Add closing braces
    while (depth > 0) {
      partial += '}';
      depth--;
    }
    // Try to fix any trailing issues
    partial = partial.replace(/,\s*([\]}])/g, '$1');
    try {
      JSON.parse(partial);
      return partial;
    } catch (_e) {
      // still broken
    }
  }

  return null;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { text, courseCode, topic, apiKey, examType, writingType, sourceTextId } = body;

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
    const isSummaryWriting = courseCode === 'LANC2160' && writingType === 'summary';

    // Resolve target word count based on exam type (for FP0340) or summary target
    let activeTargetWordCount: { min: number; max: number; ideal: number; label?: string } | null = null;
    let prompt: string;
    let criteria: any[];

    if (isFoundation) {
      // Foundation courses (FP0230, FP0340)
      if (examType && EXAM_WORD_COUNTS[examType]) {
        activeTargetWordCount = EXAM_WORD_COUNTS[examType];
      } else {
        activeTargetWordCount = { ...DEFAULT_FOUNDATION_WORD_COUNT };
      }
      prompt = buildFoundationPrompt(text, topic, wordCount, activeTargetWordCount);
      criteria = FOUNDATION_RUBRICS.criteria;
    } else if (isSummaryWriting) {
      // Summary Writing for LANC2160 — look up source text
      const { SUMMARY_SOURCE_TEXTS } = await import('@/lib/store');
      const sourceTextData = SUMMARY_SOURCE_TEXTS.find(s => s.id === sourceTextId);
      
      if (!sourceTextData) {
        return NextResponse.json(
          { error: 'Source text not found. Please select a valid source text for summary writing.' },
          { status: 400 }
        );
      }
      
      activeTargetWordCount = {
        min: sourceTextData.targetMin,
        max: sourceTextData.targetMax,
        ideal: sourceTextData.targetIdeal,
        label: `Summary of "${sourceTextData.title}"`
      };
      prompt = buildSummaryPrompt(text, sourceTextData.originalText, sourceTextData.title, wordCount, activeTargetWordCount);
      criteria = SUMMARY_CRITERIA;
    } else {
      // Credit/Post-foundation — Synthesis Essay or general
      activeTargetWordCount = null;
      prompt = buildCreditPrompt(text, topic, wordCount);
      criteria = CREDIT_CRITERIA;
    }

    // 1. Initialize Official Google Gemini SDK
    const genAI = new GoogleGenerativeAI(apiKey);
    
    // 2. Initialize Model with Strict Instructions
    const systemInstruction = isSummaryWriting
      ? 'You are an expert writing assessment AI for the Credit level course LANC2160 (Academic English: Summary Writing & Synthesis Essay) at Sultan Qaboos University. For summary writing tasks, students are at CEFR A2-B1 level. Your feedback must use simple, clear language appropriate for this proficiency level. CRITICAL: You MUST (1) compare the student summary against the provided source text, (2) quote exact words from the student summary as evidence, (3) explicitly justify why the score matches the rubric band, (4) list specific errors with quoted text, (5) assess paraphrasing quality, and (6) give actionable suggestions. You respond only with valid JSON. No markdown formatting or code blocks.'
      : 'You are an expert writing assessment AI for Foundation and Credit level university courses at Sultan Qaboos University. All students are at CEFR A1-A2 level (Basic User). Your feedback must use simple, clear language appropriate for this proficiency level. Focus on fundamental skills and provide encouraging, constructive guidance. CRITICAL: For each criterion you MUST (1) quote exact words from the student essay as evidence, (2) explicitly justify why the score matches the rubric band, (3) list specific errors with quoted text, and (4) give actionable suggestions. You respond only with valid JSON. No markdown formatting or code blocks.';

    const model = genAI.getGenerativeModel({ 
      model: 'gemini-3-flash-preview',
      systemInstruction,
    });

    // 3. Generate Content — do NOT use responseMimeType because
    //    gemini-3-flash-preview doesn't reliably support it.
    //    Instead, ask for JSON in the prompt and parse robustly.
    //
    //    SAFETY: Lower safety thresholds to prevent student essay content
    //    (e.g., essays about smoking, pollution, social issues) from being
    //    blocked by Gemini's default safety filters.
    const safetySettings = [
      { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
      { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
      { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
      { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
    ];

    // Try generation with increasing token limits on truncation
    let responseText = '';
    let parsedOk = false;
    const tokenLimits = [8192, 16384, 32768];

    for (const maxTokens of tokenLimits) {
      try {
        const result = await model.generateContent({
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.2,
            maxOutputTokens: maxTokens,
          },
          safetySettings,
        });

        // ── Check for prompt-level blocking ──
        const promptFeedback = (result.response as any)?.promptFeedback;
        if (promptFeedback?.blockReason) {
          const reason = promptFeedback.blockReason;
          console.error(`Gemini prompt blocked: ${reason}`);
          return NextResponse.json(
            { error: 'AI content filter blocked the submission. Please try rephrasing your essay or contact your instructor.', details: `Prompt blocked: ${reason}` },
            { status: 422 }
          );
        }

        // ── Check for response-level blocking / truncation ──
        const candidate = (result.response as any)?.candidates?.[0];
        const finishReason = candidate?.finishReason;

        // SAFETY / RECITATION / LANGUAGE — content is blocked entirely
        if (finishReason === 'SAFETY' || finishReason === 'RECITATION' || finishReason === 'LANGUAGE') {
          console.error(`Gemini response blocked, finishReason: ${finishReason}`);
          return NextResponse.json(
            { error: 'AI content filter blocked the assessment response. This may happen if the essay discusses sensitive topics. Please try rephrasing or contact your instructor.', details: `Response blocked: ${finishReason}` },
            { status: 422 }
          );
        }

        // Extract text — handle null/undefined safely
        const rawText = result.response?.text?.() || '';
        if (!rawText || rawText.trim().length === 0) {
          console.error('Gemini returned empty response. finishReason:', finishReason);
          return NextResponse.json(
            { error: 'AI returned an empty response. Please try again.', details: `Empty response, finishReason: ${finishReason || 'unknown'}` },
            { status: 500 }
          );
        }

        // MAX_TOKENS — response is truncated, may cause JSON parse failure
        if (finishReason === 'MAX_TOKENS') {
          console.warn(`Response truncated at ${maxTokens} tokens, attempting to parse anyway...`);
        }

        // Try to parse the JSON
        try {
          const assessment = extractJSON(rawText);
          if (assessment && assessment.scores && Array.isArray(assessment.scores)) {
            responseText = rawText;
            parsedOk = true;
            // If it parsed successfully even with MAX_TOKENS, use it
            break;
          }
        } catch (_e) {
          // JSON parse failed — if truncated, try next token limit
          if (finishReason === 'MAX_TOKENS' && maxTokens !== tokenLimits[tokenLimits.length - 1]) {
            console.warn(`JSON parse failed after truncation at ${maxTokens} tokens, retrying with higher limit...`);
            continue;
          }
          // Otherwise, fall through to error
          console.error('Failed to parse assessment response. Raw text (first 500 chars):', rawText.substring(0, 500));
          return NextResponse.json(
            { error: 'Failed to parse AI assessment response. The AI returned an invalid format. Please try again.', details: 'The AI response could not be parsed. This is a temporary issue — retrying usually works.' },
            { status: 500 }
          );
        }

        // Parsed OK with STOP
        responseText = rawText;
        parsedOk = true;
        break;

      } catch (genError: any) {
        // If this is the last attempt, throw
        if (maxTokens === tokenLimits[tokenLimits.length - 1]) {
          throw genError;
        }
        console.warn(`Generation error with ${maxTokens} tokens:`, genError.message);
        continue;
      }
    }

    if (!parsedOk) {
      return NextResponse.json(
        { error: 'Failed to get a valid assessment from the AI after multiple attempts. Please try again.' },
        { status: 500 }
      );
    }

    // Parse the JSON response with aggressive cleanup
    let assessment;
    try {
      assessment = extractJSON(responseText);
    } catch (parseError) {
      console.error('Failed to parse assessment response. Raw text:', responseText.substring(0, 500));
      console.error('Parse error:', parseError);
      return NextResponse.json(
        { error: 'Failed to parse AI assessment response', details: 'The AI returned an invalid response. Please try again.' },
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
      missingCriteria.forEach(c => {
        assessment.scores.push({
          criterionName: c.name,
          score: 0,
          maxScore: c.maxScore,
          justification: 'Unable to assess this criterion from the provided text.',
          strengths: '',
          mistakes: [],
          suggestions: 'Unable to provide suggestions.',
          feedback: 'Unable to assess this criterion from the provided text.'
        });
      });
    }

    // Normalize scores: allow 0.5 increments, round to nearest 0.5, clamp
    assessment.scores.forEach((s: any) => {
      const rawScore = Number(s.score) || 0;
      // Round to nearest 0.5
      s.score = Math.round(rawScore * 2) / 2;
      s.maxScore = Math.round(Number(s.maxScore) || 0);

      // Strip markdown from Gemini-returned fields before building feedback
      const clean = (str: string) => {
        if (!str) return '';
        return str
          .replace(/\*\*/g, '')           // Remove bold markers
          .replace(/\*(?!\*)/g, '')        // Remove italic markers
          .replace(/^#+\s+/gm, '')         // Remove heading markers
          .replace(/^---+$/gm, '')         // Remove horizontal rules
          .trim();
      };

      s.strengths = clean(s.strengths);
      s.justification = clean(s.justification);
      s.suggestions = clean(s.suggestions);

      // Clean mistakes array items
      if (Array.isArray(s.mistakes)) {
        s.mistakes = s.mistakes.map((m: any) => {
          if (typeof m === 'string') {
            // Strip leading "- " or "* " list markers
            let cleaned = m.replace(/^[\-\*]\s+/, '').trim();
            // Remove surrounding quotes
            cleaned = cleaned.replace(/^["\u201C\u201D]/, '').replace(/["\u201C\u201D]$/, '');
            // Remove em-dash and replace with colon separator
            cleaned = cleaned.replace(/\s*[—\-]\s*/, ': ').trim();
            return cleaned;
          } else {
            // Object format: { quote, explanation, text, reason }
            const quote = clean(typeof m.quote === 'string' ? m.quote : (m.text || ''));
            const explanation = clean(typeof m.explanation === 'string' ? m.explanation : (m.reason || ''));
            return { quote, explanation };
          }
        }).filter((m: any) => {
          if (typeof m === 'string') return m.length > 0;
          return m.quote || m.explanation;
        });
      }

      // Build a clean, professional feedback string (no markdown)
      const parts: string[] = [];

      if (s.strengths) {
        parts.push(s.strengths);
      }
      if (s.justification) {
        parts.push(s.justification);
      }
      if (Array.isArray(s.mistakes) && s.mistakes.length > 0) {
        const mistakeLines = s.mistakes
          .map((m: any) => {
            if (typeof m === 'string') return m;
            return m.quote ? `${m.quote}: ${m.explanation}` : m.explanation;
          })
          .join('\n');
        parts.push(mistakeLines);
      }
      if (s.suggestions) {
        parts.push(s.suggestions);
      }

      // Use the clean structured string, fallback to raw feedback
      if (parts.length > 0) {
        s.feedback = parts.join('\n\n');
      } else if (s.feedback) {
        // If no structured fields, clean the raw feedback
        s.feedback = clean(s.feedback);
      } else {
        s.feedback = 'No feedback provided.';
      }
    });

    // Recalculate total score to ensure accuracy
    // Use integer math to avoid floating-point precision issues with 0.5 increments
    // e.g., 3.5 + 2.5 + 4.0 + 3.0 = 13.0 (not 12.999999...)
    assessment.totalScore = Math.round(
      assessment.scores.reduce((sum: number, s: any) => sum + s.score, 0) * 2
    ) / 2;
    assessment.maxScore = assessment.scores.reduce((sum: number, s: any) => sum + s.maxScore, 0);
    assessment.percentage = assessment.maxScore > 0 ? Math.round((assessment.totalScore / assessment.maxScore) * 100) : 0;

    // Clean overallFeedback from any markdown residue
    if (typeof assessment.overallFeedback === 'string') {
      assessment.overallFeedback = assessment.overallFeedback
        .replace(/\*\*/g, '')
        .replace(/\*(?!\*)/g, '')
        .replace(/^#+\s+/gm, '')
        .replace(/^---+$/gm, '')
        .trim();
    }

    // Add word count info
    assessment.wordCount = wordCount;
    assessment.targetWordCount = (isFoundation || isSummaryWriting) ? activeTargetWordCount : null;

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
