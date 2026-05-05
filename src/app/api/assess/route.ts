import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from '@google/generative-ai';

// IMPORTANT: Vercel Hobby plan ($20/mo) allows maxDuration = 60.
// On the FREE tier, Vercel caps serverless functions at 10 seconds regardless of this setting.
// LANC2070 prompts are optimised to complete within the 10-second free tier limit.
export const maxDuration = 60;

// Word count targets by course and exam type for Foundation courses
const FOUNDATION_WORD_COUNTS: Record<string, Record<string, { min: number; max: number; ideal: number; label: string }>> = {
  '0230': {
    'mid-semester': { min: 90, max: 130, ideal: 120, label: 'FP0230 Mid-semester Exam' },
    'final':        { min: 110, max: 140, ideal: 120, label: 'FP0230 Final Exam' },
  },
  '0340': {
    'mid-semester': { min: 110, max: 150, ideal: 120, label: 'FP0340 Mid-semester Exam' },
    'final':        { min: 140, max: 220, ideal: 200, label: 'FP0340 Final Exam' },
  },
};

// Default word count target per course (used when no exam type is specified)
const DEFAULT_FOUNDATION_WORD_COUNTS: Record<string, { min: number; max: number; ideal: number; label: string }> = {
  '0230': { min: 90, max: 130, ideal: 120, label: 'FP0230 Foundation Exam' },
  '0340': { min: 110, max: 150, ideal: 120, label: 'FP0340 Foundation Exam' },
};

// Detailed assessment rubrics for Foundation courses (0230, 0340)
const FOUNDATION_RUBRICS = {
  criteria:[
    {
      name: 'Task Response',
      maxScore: 6,
      description: 'How well the essay addresses the task requirements, audience, purpose, and genre.',
      rubric: {
        '0-1.5': 'Very Poor: Text fails to fulfill any task requirements and shows no understanding of audience, purpose or genre. Length of text may be inappropriate.',
        '2-2.5': 'Weak: Response shows minimal awareness of the task, audience, purpose or genre. Very limited topic development. Length of text is likely inappropriate.',
        '3': 'Unsatisfactory: Response does not adequately fulfill task requirements and shows little awareness of audience, purpose and genre. Little or no attempt at topic development. Length of text may be inappropriate.',
        '3.5': 'Satisfactory: Response fulfills most task requirements and shows adequate awareness of audience, purpose and genre. Topic development is attempted but may be limited, predictable, and/or irrelevant in places. Length of text may be inappropriate.',
        '4': 'Good: Response fulfills specific task requirements. Little more could reasonably be expected for the level. Response shows a good level of awareness of audience, purpose and genre. Topic is developed and explored well.',
        '4.5': 'Very Good: Response fulfills all specific task requirements. Response shows a very good level of awareness of audience, purpose and genre. Topic is well developed and explored with some depth.',
        '5-6': 'Excellent: Response fulfills all specific task requirements and exceeds expectations for this level. Response shows a high level of awareness of audience, purpose and genre. Topic is fully developed and explored.'
      }
    },
    {
      name: 'Coherence and Cohesion',
      maxScore: 6,
      description: 'Logical organization, paragraphing, and use of cohesive devices.',
      rubric: {
        '0-1.5': 'Very Poor: Very little control of organizational features. The text is largely confused and incoherent, making it challenging for the reader to process.',
        '2-2.5': 'Weak: Minimal organization. Ideas are disconnected and difficult to follow. No paragraphs or very poor paragraphing. Cohesive devices are absent or misused.',
        '3': 'Unsatisfactory: Organization is limited, compromising coherence. Some re-reading may be necessary. Ideas lack progression and may be repeated. There may be no paragraphs. Some simple cohesive devices are used but usually inaccurately and repetitively.',
        '3.5': 'Satisfactory: Organization provides an underlying coherence although progression may be inconsistent. Text may be stilted in places. Paragraphing is generally appropriate although ideas may not always be supported. Cohesive devices may be over or under used, or used mechanically in places. Text may be repetitive due to lack of referencing.',
        '4': 'Good: Organization of information and ideas makes text clear and easy to understand. Each paragraph has a main topic supported by some relevant details. Cohesive devices are frequently used accurately both within and/or between sentences.',
        '4.5': 'Very Good: Information and ideas are clearly and logically organized. Each paragraph has a clear main topic supported by relevant details. Cohesive devices are consistently used accurately within and between sentences.',
        '5-6': 'Excellent: Information and ideas are organized so effectively that text has a fluent progression throughout. Opening and closing sections are appropriate and fully developed. Each paragraph has a clear main topic supported by well-organised, relevant details. Cohesive devices are consistently used accurately both within and/or between sentences.'
      }
    },
    {
      name: 'Lexical Resource',
      maxScore: 6,
      description: 'Range and accuracy of vocabulary, word choice, and spelling.',
      rubric: {
        '0-1.5': 'Very Poor: Vocabulary is very limited and may be unrelated to the task or consists largely of inappropriate memorized chunks. Poor word choice and spelling prevent the communication of ideas.',
        '2-2.5': 'Weak: Vocabulary is extremely limited and frequently inappropriate. Word choice and spelling errors are pervasive and severely impede communication. Only isolated words or phrases are comprehensible.',
        '3': 'Unsatisfactory: Vocabulary is inadequate or inappropriate for the level and task and may be used repetitively. Errors in word choice and spelling frequently affect communication.',
        '3.5': 'Satisfactory: Text has a limited but adequate range of vocabulary for the level and task. Core vocabulary is usually used accurately and appropriately. If there are attempts to extend beyond this range, there may be some inaccuracy or inappropriacy which affects communication in places.',
        '4': 'Good: Text has a good range of vocabulary for the level and task. Core vocabulary is frequently used accurately and appropriately. If there are attempts to extend beyond this range, there may be some inaccuracy or inappropriacy, although communication is not affected.',
        '4.5': 'Very Good: Text has a very good range of vocabulary for the level and task. Vocabulary is used accurately and appropriately with only rare minor errors. Communication is clear and effective.',
        '5-6': 'Excellent: Text has a significantly wider range of vocabulary than is expected for the level and task. Core vocabulary is consistently used accurately and appropriately. There may be occasional errors in word choice and spelling where more complex/creative lexis is attempted but communication is not affected.'
      }
    },
    {
      name: 'Grammatical Range and Accuracy',
      maxScore: 6,
      description: 'Range and accuracy of grammatical structures and punctuation.',
      rubric: {
        '0-1.5': 'Very Poor: Structures are inaccurate and errors predominate, preventing meaningful communication. Punctuation may be inadequate and/or inaccurate.',
        '2-2.5': 'Weak: Very limited grammatical structures with frequent serious errors. Most sentences contain errors that impede understanding. Punctuation is largely absent or inaccurate.',
        '3': 'Unsatisfactory: Structures are very limited and inadequate for the level and task. Errors are noticeable and may often affect communication. Punctuation may be inadequate and/or inaccurate.',
        '3.5': 'Satisfactory: Text has a limited but adequate range of structures for the level and task. Core structures for the level are usually used accurately and appropriately although they may sometimes be used mechanically. Grammatical errors may affect communication in places. Punctuation is generally effective.',
        '4': 'Good: Text has a good range of structures for the level and task. Core structures for the level are frequently used accurately and appropriately. If there are attempts to extend beyond this range, there may be some inaccuracy or inappropriacy, without affecting communication. Punctuation is well managed and effective.',
        '4.5': 'Very Good: Text has a very good range of structures for the level. Most structures are used accurately and appropriately. Minor errors do not impede communication. Punctuation is well managed and effective.',
        '5-6': 'Excellent: Text has a significantly wider range of structures than is expected for the level and task. Core structures are consistently used accurately and appropriately. There may be occasional errors where more complex structures are attempted but communication is not affected. Punctuation is well managed and effective.'
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

// Condensed rubric band descriptors for Summary Writing (A2-B1 level)
// Optimised: shorter descriptors reduce prompt token count for faster free-tier response
const SUMMARY_RUBRICS = {
  criteria: [
    {
      name: 'Task Achievement',
      maxScore: 5,
      rubric: {
        '0-1': 'No summary, irrelevant, or isolated words. No main ideas captured. Largely copied.',
        '2': 'Captures at most one main idea. Misses most key points. Minimal paraphrasing, heavy copying.',
        '2.5-3': 'Captures main ideas adequately but may miss 1-2 points. Some paraphrasing with noticeable copying.',
        '3.5': 'Captures all main ideas effectively. Consistent paraphrasing with minor copied phrases.',
        '4-4.5': 'All main ideas captured clearly. Effective paraphrasing throughout. Focused, cohesive.',
        '5': 'Comprehensive, accurate reflection of source. Natural paraphrasing. Reads as independent text.',
      }
    },
    {
      name: 'Coherence & Cohesion',
      maxScore: 5,
      rubric: {
        '0-1': 'No coherence. Random fragments. No linking words. Ideas cannot be followed.',
        '2': 'Minimal organisation. Ideas listed, not connected. Very few linking words. Disjointed.',
        '2.5-3': 'Basic organisation. Simple linking words used appropriately. Generally easy to follow.',
        '3.5': 'Well-organised with clear logical progression. Good range of cohesive devices. Smooth flow.',
        '4-4.5': 'Clearly organised with strong progression. Cohesive devices used effectively and naturally.',
        '5': 'Exceptional organisation with flawless logical flow. Cohesive devices used with mastery.',
      }
    },
    {
      name: 'Lexical Resource',
      maxScore: 5,
      rubric: {
        '0-1': 'Extremely limited vocabulary. Inaccurate word choice. Pervasive spelling errors.',
        '2': 'Limited vocabulary, frequent repetition. Awkward word choice. Frequent spelling errors.',
        '2.5-3': 'Adequate vocabulary range. Basic paraphrasing usually effective. Some spelling errors.',
        '3.5': 'Good vocabulary range. Paraphrasing effective. Some less common vocabulary attempted.',
        '4-4.5': 'Varied vocabulary. Natural paraphrasing. Strong word choice and collocation.',
        '5': 'Sophisticated, precise vocabulary. Consistently natural paraphrasing. Flawless spelling.',
      }
    },
    {
      name: 'Grammar & Accuracy',
      maxScore: 5,
      rubric: {
        '0-1': 'No grammatical control. Random fragments. Errors prevent communication.',
        '2': 'Simple structures with frequent errors. Limited variety. Common errors (articles, tenses).',
        '2.5-3': 'Simple sentences accurate, some complex attempted. Errors occur but do not significantly affect meaning.',
        '3.5': 'Good range of structures with reasonable accuracy. Minor errors. Good sentence variety.',
        '4-4.5': 'Strong control including complex sentences. Errors infrequent/rare. Sentence variety enhances quality.',
        '5': 'Near-native control. Wide variety of structures used naturally and accurately. Flawless punctuation.',
      }
    },
  ],
};

// Synthesis Essay criteria for LANC2160 (A2-B1 level, 0-5 per criterion)
const SYNTHESIS_CRITERIA = [
  {
    name: 'Task Achievement',
    maxScore: 5,
    description: 'How effectively the synthesis essay fulfils the task requirements, synthesizes information from all source texts, and stays within the word count.',
  },
  {
    name: 'Coherence and Cohesion',
    maxScore: 5,
    description: 'How logically the synthesis essay is organized, how well ideas are linked, and how effectively information flows.',
  },
  {
    name: 'Lexical Resource',
    maxScore: 5,
    description: 'The range and accuracy of vocabulary, including paraphrasing ability and appropriate word choice.',
  },
  {
    name: 'Grammatical Range and Accuracy',
    maxScore: 5,
    description: 'The range and accuracy of grammatical structures, sentence variety, and punctuation.',
  },
];

// Condensed rubric band descriptors for Synthesis Essay (A2-B1 level, TWO-POINT ESSAY WRITING MARKING CRITERIA)
// Optimised: shorter descriptors reduce prompt token count for faster free-tier response
const SYNTHESIS_RUBRICS = {
  criteria: [
    {
      name: 'Task Achievement',
      maxScore: 5,
      rubric: {
        '0-1.5': 'Fails task requirements. Most details unimportant. 10%+ outside word count.',
        '2-2.5': 'Does not adequately fulfil requirements. Many unimportant details. 10%+ outside word count.',
        '3-3.5': 'Adequately fulfils requirements. Most main ideas present, generally accurate meaning. Up to 10% outside word count.',
        '4-4.5': 'Fulfils all requirements. Main ideas present, meaning mostly accurate, details relevant. Within word count.',
        '5': 'Exceeds expectations. All main ideas present, meaning accurate, all details relevant. Within word count.',
      }
    },
    {
      name: 'Coherence and Cohesion',
      maxScore: 5,
      rubric: {
        '0-1.5': 'Lacks organisation. Text confused and incoherent.',
        '2-2.5': 'Limited organisation. Simple, inaccurate cohesive devices used mechanically.',
        '3-3.5': 'Adequate organisation. Supporting ideas may be limited. Cohesive devices sometimes inaccurate/repetitive.',
        '4-4.5': 'Clear and easy to understand. Cohesive devices almost always accurate within and between sentences.',
        '5': 'Effective organisation with logical flow. Good range of cohesive devices used accurately.',
      }
    },
    {
      name: 'Lexical Resource',
      maxScore: 5,
      rubric: {
        '0-1.5': 'Paraphrasing largely absent. Poor word choice, form, spelling prevent communication.',
        '2-2.5': 'Minimal paraphrasing, >15% copied. Inadequate vocabulary. Errors predominate and affect communication.',
        '3-3.5': 'Generally paraphrased, <15% copied. Adequate vocabulary. Errors sometimes affect communication.',
        '4-4.5': 'Well paraphrased with very little copying. Good vocabulary range. Spelling mostly correct.',
        '5': 'Completely paraphrased. Wider vocabulary than expected. Spelling accurate.',
      }
    },
    {
      name: 'Grammatical Range and Accuracy',
      maxScore: 5,
      rubric: {
        '0-1.5': 'Inaccurate structures predominate, preventing communication. Punctuation inadequate.',
        '2-2.5': 'Very limited structures. Errors noticeable and often affect communication.',
        '3-3.5': 'Adequate structures for the task. Errors may affect communication in places. Punctuation generally correct.',
        '4-4.5': 'Good range of structures. Some inaccuracy but communication not affected. Punctuation well managed.',
        '5': 'Wider range than expected. Most sentences error-free. Punctuation well managed.',
      }
    },
  ],
};

// ─── LANC2146 Report Writing — Discussion & Conclusion Assessment ─────────────

// Lab Report Discussion and Conclusion criteria (A2-B1 level, 0-5 per criterion)
const LANC2146_CRITERIA = [
  {
    name: 'Task Response',
    maxScore: 5,
    description: 'Analysis and interpretation of data with details/examples/statistics; quality of the discussion section; adequacy of the conclusion (most obvious result, reference to previous research, restatement of aim, solutions/recommendations).',
  },
  {
    name: 'Coherence and Cohesion',
    maxScore: 5,
    description: 'Logical organization of information and ideas; use of cohesive devices (conjunctions and linkers); paragraphing.',
  },
  {
    name: 'Grammatical Range and Accuracy',
    maxScore: 5,
    description: 'Use of grammatical functions (cause/effect, compare/contrast, prediction, recommendation/suggestion/solution); grammar structures accuracy; punctuation.',
  },
  {
    name: 'Lexical Resource',
    maxScore: 5,
    description: 'Vocabulary range and genre-specific register; spelling, word formation, and capitalization.',
  },
];

// Detailed rubric band descriptors for LANC2146 Discussion & Conclusion (A2-B1 level)
const LANC2146_RUBRICS = {
  criteria: [
    {
      name: 'Task Response',
      maxScore: 5,
      rubric: {
        '1': 'Poor (1-1.5): The analysis and interpretation of the main trend lacks specific details, examples, and statistics. The conclusion is missing or irrelevant.',
        '2': 'Unsatisfactory (2-2.5): The analysis and interpretation of the main trend is supported by few details, examples, and statistics. The conclusion is insufficient, may not refer to previous research, may not restate the aim, and provides irrelevant recommendations.',
        '3': 'Satisfactory (3-3.5): The analysis and interpretation of one clear main trend is supported by relevant details and examples, including some statistics. The conclusion adequately summarizes the most obvious result, refers to previous research, restates the aim, and provides solutions/general recommendations, but there may be gaps in coverage.',
        '4': 'Good (4-4.5): The analysis and interpretation of one clear main trend is supported by adequate details, examples, and relevant statistics. The conclusion adequately summarizes the most obvious result, refers to previous research, restates the aim, and provides solutions/general recommendations.',
        '5': 'Excellent (5): The analysis and interpretation of one clear main trend is supported by carefully chosen details and examples, including comprehensive statistics. The conclusion provides an insightful and effective summary of the most obvious result, refers to previous research, restates the aim, and provides solutions/specific recommendations.',
      }
    },
    {
      name: 'Coherence and Cohesion',
      maxScore: 5,
      rubric: {
        '1': 'Poor (1-1.5): Lacks coherent development of ideas, with disjointed or illogical writing which is largely confused and incoherent. Cohesive devices are missing or used inaccurately. Paragraphs lack clear organization and unity, with ideas scattered or unrelated.',
        '2': 'Unsatisfactory (2-2.5): Only basic understanding of information in the text through illogical and/or incoherent writing with limited development of ideas, and connections between concepts are unclear or inconsistent. Cohesive devices are used inaccurately and inappropriately. Paragraphs demonstrate some attempt at organization.',
        '3': 'Satisfactory (3-3.5): Generally logical and coherent writing, but may not be completely successful, possibly due to some misunderstanding of the data. Cohesive devices used may be accurate but not appropriate or too simple, over or under used, creating many abrupt or weak transitions. Paragraphs demonstrate development of ideas, but the organization is not sustained.',
        '4': 'Good (4-4.5): Sufficient depth of analysis and interpretation, but with some abrupt or weak transitions. Cohesive devices are usually used accurately and appropriately. Paragraphs exhibit clear organization and unity.',
        '5': 'Excellent (5): Seamless flow of ideas with effective transitions that guide the reader through the in-depth analysis and interpretation. An extensive range of cohesive devices is used accurately and appropriately. Paragraphs are exceptionally well-organized and unified.',
      }
    },
    {
      name: 'Grammatical Range and Accuracy',
      maxScore: 5,
      rubric: {
        '1': 'Poor (1-1.5): Little control of grammar, with basic faulty sentence structures. Severe grammar errors that significantly impede understanding. Numerous instances of incorrect or missing punctuation throughout the text, hindering readability and comprehension.',
        '2': 'Unsatisfactory (2-2.5): Limited control of grammar, with repetitive sentence structures. Noticeable grammar errors throughout the text, making comprehension difficult. Noticeable errors in punctuation, hindering readability and comprehension.',
        '3': 'Satisfactory (3-3.5): Adequate control of grammar, with repetitive sentence structures. Occasional errors which impede understanding. Occasional instances of incorrect or missing punctuation, but overall punctuation usage is adequate for understanding.',
        '4': 'Good (4-4.5): Proficient use of grammar, with a wide range of sentence structures with a few errors that do not impede understanding. The majority of sentences are error-free. Generally correct and appropriately-used punctuation, with only minor errors that do not significantly affect readability and comprehension.',
        '5': 'Excellent (5): Exemplary command of grammar, with a variety of sentence structures with no errors, allowing for clear and precise communication of ideas. All sentences are error-free. Punctuation is error-free and effectively used to enhance readability and comprehension.',
      }
    },
    {
      name: 'Lexical Resource',
      maxScore: 5,
      rubric: {
        '1': 'Poor (1-1.5): Basic vocabulary which may be repetitive or inappropriate for the task, hindering understanding. Limited control of word formation and/or spelling; numerous severe spelling and capitalization errors.',
        '2': 'Unsatisfactory (2-2.5): Uses a limited range of vocabulary (vocabulary choices are often inappropriate or ineffective, detracting from the overall quality of the description), but this is minimally adequate for the task. May make frequent and noticeable errors in spelling and/or word formation throughout the text, making it difficult to understand.',
        '3': 'Satisfactory (3-3.5): Uses an adequate range of vocabulary for the task (vocabulary choices are generally appropriate with some awareness of style and collocation, but there is some repetition or lack of variety). Makes some errors in spelling and/or word formation that may cause some difficulty for the reader.',
        '4': 'Good (4-4.5): Uses a wide range of vocabulary with uncommon lexical items to allow some flexibility and precision, but there may be occasional inaccuracies in word choice and collocation. Produces rare errors in spelling and/or word formation and capitalization but they do not impede communication.',
        '5': 'Excellent (5): Uses a wide range of vocabulary (rich, varied, and perfectly suited to the context) with very natural and sophisticated control of lexical features; rare minor errors occur only as slips. Produces no errors in spelling and/or word formation and capitalization.',
      }
    },
  ],
};

// Build prompt for LANC2146 Report Writing (Discussion & Conclusion)
function buildLanc2146Prompt(
  studentText: string,
  reportSections: { title: string; content: string }[],
  resultsCaption: string | null,
  resultsGraphDescription: string | null,
  assignmentTitle: string,
  wordCount: number,
  targetWordCount: { min: number; max: number; ideal: number }
): string {
  const rubrics = LANC2146_RUBRICS;
  const totalMaxScore = LANC2146_CRITERIA.reduce((sum, c) => sum + c.maxScore, 0); // 20

  // Word count tolerance: +/-20 words beyond the target range is acceptable without penalty
  const toleranceBelow = targetWordCount.min - 20;
  const toleranceAbove = targetWordCount.max + 20;

  const wordCountStatus = wordCount < toleranceBelow
    ? `WARNING: Word count (${wordCount}) is SIGNIFICANTLY BELOW the required range of ${targetWordCount.min}-${targetWordCount.max} words (more than 20 words below minimum). This MUST lower the Task Response score.`
    : wordCount < targetWordCount.min
    ? `NOTE: Word count (${wordCount}) is slightly below the required range of ${targetWordCount.min}-${targetWordCount.max} words (within 20-word tolerance). Minor flexibility is acceptable — do NOT penalize.`
    : wordCount > toleranceAbove
    ? `NOTE: Word count (${wordCount}) SIGNIFICANTLY exceeds the target range of ${targetWordCount.min}-${targetWordCount.max} words (more than 20 words above maximum). This should lower the Task Response score.`
    : wordCount > targetWordCount.max
    ? `Word count (${wordCount}) is slightly above the target range of ${targetWordCount.min}-${targetWordCount.max} words (within 20-word tolerance). Minor flexibility is acceptable — do NOT penalize.`
    : `Word count (${wordCount}) is within the acceptable range of ${targetWordCount.min}-${targetWordCount.max} words.`;

  const criteriaDetails = rubrics.criteria.map(c => {
    const rubricLevels = Object.entries(c.rubric)
      .map(([score, desc]) => `  Score ${score}: ${desc}`)
      .join('\n');
    return `${c.name} (0-${c.maxScore}):\n${rubricLevels}`;
  }).join('\n\n');

  const sectionsText = reportSections.map(s => `=== ${s.title} ===\n${s.content}`).join('\n\n');

  return `You are an expert writing assessor evaluating a Credit level student's lab report Discussion and Conclusion for Sultan Qaboos University's Center for Preparatory Studies, course LANC2146 (Report Writing).

STUDENT LEVEL: CEFR A2-B1 (Elementary to Pre-Intermediate). Feedback must use simple, clear language appropriate for A2-B1 learners. Be encouraging while maintaining appropriate academic standards. Avoid overly technical linguistic terminology.

ASSIGNMENT: ${assignmentTitle}

WRITING TASK: Write an appropriate Discussion and Conclusion for the report based on the provided sections.

TARGET WORD COUNT: ${targetWordCount.min}-${targetWordCount.max} words (ideal: ${targetWordCount.ideal}). A tolerance of +/-20 words is acceptable (effective range: ${toleranceBelow}-${toleranceAbove}).

${wordCountStatus}

PROVIDED REPORT SECTIONS:
${sectionsText}
${resultsCaption ? `\nRESULTS FIGURE CAPTION: ${resultsCaption}${resultsGraphDescription ? `\nNote: The student was expected to read the bar graph showing the results of the experiment. ${resultsGraphDescription}` : ''}` : ''}

STUDENT'S DISCUSSION AND CONCLUSION:
"""
${studentText}
"""

ASSESSMENT RUBRICS (LANC2146 - Discussion and Conclusion of a Lab Report):

${criteriaDetails}

POINTS TO CONSIDER FOR EACH CRITERION:

Task Response:
- Discussion: analysis and interpretation with details/examples/statistics; reference to the hypothesis
- Conclusion: most obvious result, reference to previous research; restatement of the aim; solutions/recommendations

Coherence and Cohesion:
- Logical organization of information and ideas
- Cohesive devices (conjunctions and linkers)
- Paragraphing

Grammatical Range and Accuracy:
- Functions: cause/effect, compare/contrast, prediction, recommendation/suggestion/solution
- Grammar structures
- Punctuation

Lexical Resource:
- Vocabulary range and genre-specific register
- Spelling and/or word formation and capitalization

============================================================
SCORING AND FEEDBACK INSTRUCTIONS (CRITICAL — FOLLOW EXACTLY):
============================================================

STEP 1 — SCORE each criterion using WHOLE or HALF numbers (1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, or 5). If the text's quality falls between two adjacent score bands, award a half-point (e.g., 3.5). Use 0.5 increments only — never use 0.25 or 0.75.

STEP 2 — For EACH criterion, write a "Justification" paragraph that:
  (a) Explicitly names the score band you chose (e.g. "Score 3.5 — Satisfactory")
  (b) Quotes at least ONE specific phrase or sentence from the student's text as evidence
  (c) Explains why the text fits that band descriptor — connect the evidence to the rubric
  (d) If you awarded a half-point, explain which aspects place it in the lower band and which in the higher band
  (e) If the score is below 4, clearly state what is missing compared to the next higher band
  (f) If the score is 5, explain what the student did beyond expectations

STEP 3 — For each criterion, list SPECIFIC errors found in the text. Format each as:
  - "[exact quoted text]" — highlight the mistake and explain why it is wrong, but do NOT provide the corrected version

STEP 4 — For each criterion, provide 1-2 concrete, achievable suggestions for improvement appropriate for an A2-B1 level writer.

STEP 5 — overallFeedback must be a comprehensive summary (4-6 sentences) that:
  - Highlights the student's strongest criterion and what they did well
  - Identifies the weakest area needing the most attention
  - Evaluates whether the Discussion section effectively analyzes and interprets the data
  - Evaluates whether the Conclusion section adequately summarizes results and provides recommendations
  - Gives one prioritized action item to focus on next

STEP 6 — Calculate totalScore = sum of all criterion scores (max ${totalMaxScore}). Calculate percentage = round(totalScore / ${totalMaxScore} * 100).

============================================================
CRITICAL OUTPUT RULES:
- Respond with ONLY the raw JSON object. No markdown, no code fences, no commentary.
- Do NOT wrap the JSON in triple-backtick code blocks.
- Use straight double quotes, not smart/curly quotes.
- Do NOT add trailing commas after the last item in arrays or objects.
- All string values must have properly escaped quotes inside them.
- FORMAT: Write justification, strengths, suggestions, and overallFeedback using bullet points (•) or numbered lists (1. 2. 3.) wherever possible. Each bullet should be a separate, clear point. This makes the report easier to read for students.

JSON OUTPUT FORMAT:
============================================================
{
  "scores": [
    {
      "criterionName": "Task Response",
      "score": 4,
      "maxScore": 5,
      "justification": "Score 4: Good. The discussion section analyses the main trend with adequate details and statistics. For example, the student writes: \\"[exact quote]\\" which shows [specific rubric alignment]. The conclusion restates the aim and provides general recommendations.",
      "strengths": "The student demonstrates solid analysis of the main trend with supporting details.",
      "mistakes": [
        "[exact quoted text]" — Highlight the mistake and explain why it is wrong, but do NOT provide the corrected version
      ],
      "suggestions": "Include more specific statistics from the results to strengthen your analysis. Reference previous research more explicitly in the conclusion."
    }
  ],
  "totalScore": 16,
  "maxScore": ${totalMaxScore},
  "percentage": 80,
  "overallFeedback": "Your strongest area is [criterion] where you [specific strength]. The area that needs the most improvement is [criterion] because [reason]. Your discussion effectively [evaluation]. Your conclusion could be improved by [suggestion]. Focus on [one prioritized action] to improve your next report."
}`;
}

// Build detailed rubric prompt for Foundation courses
function buildFoundationPrompt(text: string, topic: string | null, wordCount: number, targetWordCount: { min: number; max: number; ideal: number; label?: string }): string {
  const rubrics = FOUNDATION_RUBRICS;
  const totalMaxScore = rubrics.criteria.reduce((sum, c) => sum + c.maxScore, 0); // 24

  // Word count tolerance: +/-10 words beyond the target range is acceptable without penalty
  const toleranceBelow = targetWordCount.min - 10;
  const toleranceAbove = targetWordCount.max + 10;

  const wordCountStatus = wordCount < toleranceBelow
    ? `WARNING: Word count (${wordCount}) is SIGNIFICANTLY BELOW the required range of ${targetWordCount.min}-${targetWordCount.max} words (more than 10 words below minimum). This MUST lower the Task Response score.`
    : wordCount < targetWordCount.min
    ? `NOTE: Word count (${wordCount}) is slightly below the required range of ${targetWordCount.min}-${targetWordCount.max} words (within 10-word tolerance). Minor flexibility is acceptable — do NOT penalize.`
    : wordCount > toleranceAbove
    ? `NOTE: Word count (${wordCount}) SIGNIFICANTLY exceeds the target range of ${targetWordCount.min}-${targetWordCount.max} words (more than 10 words above maximum). This should lower the Task Response score.`
    : wordCount > targetWordCount.max
    ? `Word count (${wordCount}) is slightly above the target range of ${targetWordCount.min}-${targetWordCount.max} words (within 10-word tolerance). Minor flexibility is acceptable — do NOT penalize.`
    : `Word count (${wordCount}) is within the acceptable range of ${targetWordCount.min}-${targetWordCount.max} words.`;

  const examLabel = targetWordCount.label || 'Foundation Exam';

  const criteriaDetails = rubrics.criteria.map(c => {
    const rubricLevels = Object.entries(c.rubric)
      .map(([score, desc]) => `  Score ${score}: ${desc}`)
      .join('\n');
    return `${c.name} (0-${c.maxScore}):\n${rubricLevels}`;
  }).join('\n\n');

  return `You are an expert writing assessor evaluating a Foundation level student essay for Sultan Qaboos University's Center for Preparatory Studies.

STUDENT LEVEL: CEFR A1-A2 (Basic User). Feedback must use simple, clear language that A1-A2 learners can understand. Be encouraging while maintaining appropriate standards. Avoid overly technical linguistic terminology.

EXAM TYPE: ${examLabel}
${topic ? `Essay Topic: ${topic}` : 'No specific topic provided.'}

Student Essay:
"""
${text}
"""

TARGET WORD COUNT: ${targetWordCount.min}-${targetWordCount.max} words (ideal: ${targetWordCount.ideal}). A tolerance of +/-10 words is acceptable (effective range: ${toleranceBelow}-${toleranceAbove}).

${wordCountStatus}

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
  (g) For Task Response: specifically address whether the essay addresses the topic, stays within the word count, and follows the expected essay structure for a ${examLabel}

This justification must make the score transparent and defensible. A reader should understand exactly why that score was given based on the evidence.

STEP 3 — For each criterion, list SPECIFIC errors found in the text. Format each as:
  - "[exact quoted text]" — highlight the mistake and explain why it is wrong, but do NOT provide the corrected version

STEP 4 — For each criterion, provide 1-2 concrete, achievable suggestions for improvement appropriate for an A1-A2 learner.

STEP 5 — overallFeedback must be a comprehensive summary (3-5 sentences) that:
  - Highlights the student's strongest criterion and what they did well
  - Identifies the weakest area needing the most attention
  - Comments on whether the word count meets the ${examLabel} requirements
  - Gives one prioritized action item to focus on next

STEP 6 — Calculate totalScore = sum of all criterion scores (max ${totalMaxScore}). Scores may include 0.5 increments (e.g., 3.5, 4.5). Calculate percentage = round(totalScore / ${totalMaxScore} * 100).

============================================================
CRITICAL OUTPUT RULES:
- You MUST score ALL FOUR criteria: Task Response, Coherence and Cohesion, Lexical Resource, and Grammatical Range and Accuracy. Do NOT omit any criterion.
- Respond with ONLY the raw JSON object. No markdown, no code fences, no commentary.
- Do NOT wrap the JSON in triple-backtick code blocks.
- Use straight double quotes, not smart/curly quotes.
- Do NOT add trailing commas after the last item in arrays or objects.
- All string values must have properly escaped quotes inside them.
- FORMAT: Write justification, strengths, suggestions, and overallFeedback using bullet points (•) or numbered lists (1. 2. 3.) wherever possible. Each bullet should be a separate, clear point. This makes the report easier to read for students.

JSON OUTPUT FORMAT (you MUST include exactly 4 score entries — one for EACH criterion):
============================================================
{
  "scores": [
    {
      "criterionName": "Task Response",
      "score": 4,
      "maxScore": 6,
      "justification": "Score 4: Good. The essay addresses the task by [explanation]. For example, the student writes: \\"[exact quote]\\" which shows [specific rubric alignment].",
      "strengths": "The student clearly addresses the topic and provides relevant examples.",
      "mistakes": [
        "[exact quoted text]: Highlight the mistake and explain why it is wrong, but do NOT provide the corrected version"
      ],
      "suggestions": "Try to add a clear concluding sentence that summarizes your main point. Use transition words like 'In conclusion' or 'To sum up'."
    },
    {
      "criterionName": "Coherence and Cohesion",
      "score": 3.5,
      "maxScore": 6,
      "justification": "Score 3.5: [justification with quoted evidence]",
      "strengths": "[specific strengths]",
      "mistakes": ["[exact quoted text]: explanation"],
      "suggestions": "[1-2 improvement suggestions]"
    },
    {
      "criterionName": "Lexical Resource",
      "score": 3,
      "maxScore": 6,
      "justification": "Score 3: [justification with quoted evidence]",
      "strengths": "[specific strengths]",
      "mistakes": ["[exact quoted text]: explanation"],
      "suggestions": "[1-2 improvement suggestions]"
    },
    {
      "criterionName": "Grammatical Range and Accuracy",
      "score": 3.5,
      "maxScore": 6,
      "justification": "Score 3.5: [justification with quoted evidence]",
      "strengths": "[specific strengths]",
      "mistakes": ["[exact quoted text]: explanation"],
      "suggestions": "[1-2 improvement suggestions]"
    }
  ],
  "totalScore": 14,
  "maxScore": ${totalMaxScore},
  "percentage": 58,
  "overallFeedback": "Your strongest area is [criterion] where you [specific strength]. The area that needs the most improvement is [criterion] because [reason]. [Comment on word count if relevant]. Focus on [one prioritized action] to improve your next essay."
}`;
}

// Build prompt for Credit/Post-foundation courses
function buildCreditPrompt(text: string, topic: string | null, wordCount: number): string {
  const criteria = CREDIT_CRITERIA;
  const totalMaxScore = criteria.reduce((sum, c) => sum + c.maxScore, 0);

  return `You are an expert writing assessor evaluating a Credit level student essay for Sultan Qaboos University's Center for Preparatory Studies.

STUDENT LEVEL: CEFR A2-B1 (Elementary to Pre-Intermediate). Feedback must use simple, clear language that A2-B1 learners can understand. Be encouraging while maintaining appropriate academic standards. Avoid overly technical linguistic terminology.

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
  - "[exact quoted text]" — highlight the mistake and explain why it is wrong, but do NOT provide the corrected version

STEP 4 — For each criterion, provide 1-2 concrete, achievable suggestions for improvement appropriate for an A2-B1 learner.

STEP 5 — overallFeedback must be a comprehensive summary (3-5 sentences) that highlights the student's strongest criterion, identifies the weakest area, and gives one prioritized action item.

STEP 6 — Calculate totalScore = sum of all criterion scores (max ${totalMaxScore}). Calculate percentage = round(totalScore / ${totalMaxScore} * 100).

============================================================
CRITICAL OUTPUT RULES:
- Respond with ONLY the raw JSON object. No markdown, no code fences, no commentary.
- Do NOT wrap the JSON in triple-backtick code blocks.
- Use straight double quotes, not smart/curly quotes.
- Do NOT add trailing commas after the last item in arrays or objects.
- All string values must have properly escaped quotes inside them.
- FORMAT: Write justification, strengths, suggestions, and overallFeedback using bullet points (•) or numbered lists (1. 2. 3.) wherever possible. Each bullet should be a separate, clear point. This makes the report easier to read for students.

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
        "[exact quoted text]" — Highlight the mistake and explain why it is wrong, but do NOT provide the corrected version
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

  return `You are an expert writing assessor for LANC2160 (Summary Writing & Synthesis) at Sultan Qaboos University. CEFR A2-B1 level. Use simple, clear language.

TASK: The student read the source text and wrote a summary of approximately one-third of the original length.

SOURCE TEXT:
"${sourceTitle}" (${sourceText.trim().split(/\s+/).filter(Boolean).length} words)
"""
${sourceText}
"""

STUDENT'S SUMMARY:
"""
${studentText}
"""

${wordCountStatus}
Target summary length: ${targetWordCount.min}-${targetWordCount.max} words.

ASSESSMENT RUBRICS (LANC2160 — Summary Writing):
${criteriaDetails}

SUMMARY-SPECIFIC RULES:
1. Capture MAIN IDEAS only — no minor details.
2. Use OWN WORDS (paraphrasing). Direct copying = poor summarising.
3. NO personal opinions or new information not in the source.
4. Target ~1/3 of source text length.
5. Off-topic summary → Task Achievement = 0.
6. Large copied portions → low Task Achievement and Lexical Resource.

============================================================
SCORING INSTRUCTIONS:
============================================================
1. Score each criterion 0-5 (0.5 increments only).
2. For each criterion provide:
   - justification: Name the score band, quote evidence from summary, explain why it fits. If half-point, explain what places it between bands. For Task Achievement: address how many main ideas were captured and paraphrasing quality. Keep to 2-3 sentences.
   - strengths: What the student did well (1 sentence).
   - mistakes: List up to 3 specific errors as "[quoted text]" — explain the error. Do NOT give corrections.
   - suggestions: 1 actionable improvement tip for A2-B1 level.
3. overallFeedback: 2-3 sentences covering main ideas captured/missed, strongest area, weakest area, paraphrasing quality, and one priority action.
4. totalScore = sum of scores (max ${totalMaxScore}). percentage = round(totalScore/${totalMaxScore}*100).

OUTPUT: Valid JSON only. No markdown, no code fences, no commentary. Use straight double quotes.
{
  "scores": [
    {
      "criterionName": "Task Achievement",
      "score": 3.5,
      "maxScore": 5,
      "justification": "Score 3.5 — [Brief evidence quote and rubric alignment in 2-3 sentences].",
      "strengths": "[1 sentence].",
      "mistakes": ["[quoted text] — explanation"],
      "suggestions": "[1 tip]."
    }
  ],
  "totalScore": 13,
  "maxScore": ${totalMaxScore},
  "percentage": 65,
  "overallFeedback": "[2-3 sentences: main ideas captured/missed, strongest area, weakest area, paraphrasing, one action item]."
}`;
}

// Synthesis assignments data (defined here to avoid import issues with @/lib/store in server-side route)
// NOTE: Synthesis assignment data is imported dynamically from the store
// to avoid duplicating data and causing ID mismatches between frontend and API.

// ─── LANC2070 Article Review Assessment ──────────────────────────────────────

// Article Review criteria for LANC2070 (A2-B1 level, 0-5 per criterion)
const LANC2070_CRITERIA = [
  {
    name: 'Task Response',
    maxScore: 5,
    description: '4-paragraph article review (introduction, summary, critique of 2 points, conclusion); synthesis of minimum 2 excerpts; analysis and evaluation of 2 points; word count adherence.',
  },
  {
    name: 'Coherence and Cohesion',
    maxScore: 5,
    description: 'Flow of ideas; focus and thesis statements; attributive and reporting phrases with APA referencing; cohesive devices.',
  },
  {
    name: 'Lexical Resource',
    maxScore: 5,
    description: 'Paraphrasing quality (synonyms, word form changes, sentence restructuring); vocabulary range; word choice and form; spelling.',
  },
  {
    name: 'Grammatical Range and Accuracy',
    maxScore: 5,
    description: 'Grammatical range (compound and complex sentences, relative clauses); grammatical accuracy (subject-verb agreement, verb tense, pronouns, articles); punctuation and capitalization.',
  },
];

// Condensed rubric band descriptors for LANC2070 Article Review (A2-B1 level)
// Optimised: shorter descriptors reduce prompt token count for faster free-tier response
const LANC2070_RUBRICS = {
  criteria: [
    {
      name: 'Task Response',
      maxScore: 5,
      rubric: {
        '0-1.5': 'Fails task requirements. No use of excerpts. No analysis or evaluation. Below 300 words.',
        '2': 'Incomplete structure, 0-1 excerpts, minimal analysis/evaluation. Below word count.',
        '3': 'Adequate summary, attempts 2 excerpts with limited synthesis. Basic analysis, weak evaluation. Word count met.',
        '4': 'Good summary of main ideas, 2 excerpts synthesised well. Logical analysis with some evaluation.',
        '5': 'All main ideas captured, 2 excerpts fluently synthesised. Insightful analysis, clear evaluation.',
      }
    },
    {
      name: 'Coherence and Cohesion',
      maxScore: 5,
      rubric: {
        '0-1': 'No organisation. No focus/thesis. No attribution. No cohesive devices.',
        '2': 'Weak or missing intro/conclusion/thesis. Attribution missing. Cohesive devices inaccurate.',
        '3': 'Adequate intro/conclusion. Thesis may be unclear. Attribution attempted but inconsistent. Cohesive devices repetitive.',
        '4': 'Clear intro/conclusion with focus and thesis. Some attributive phrases. Cohesive devices mostly accurate.',
        '5': 'Strong intro/conclusion with clear thesis. Varied attributive phrases and reporting verbs. Cohesive devices used accurately.',
      }
    },
    {
      name: 'Lexical Resource',
      maxScore: 5,
      rubric: {
        '0-1': 'Largely copied. Very limited vocabulary. Poor word choice, form, spelling.',
        '2': 'Minimal paraphrasing, frequent copied chunks (>4 words). Inadequate vocabulary range.',
        '3': 'Generally paraphrased, minor copying (≤3 words). Adequate vocabulary. Some word choice/spelling errors.',
        '4': 'Well paraphrased with variety of techniques. Good vocabulary. Spelling/word form mostly accurate.',
        '5': 'Fully paraphrased with no copying. Wide, flexible vocabulary. Accurate spelling and word form.',
      }
    },
    {
      name: 'Grammatical Range and Accuracy',
      maxScore: 5,
      rubric: {
        '0-1': 'Extremely limited structures. Core structures inaccurate. Punctuation/capitalisation consistently wrong.',
        '2': 'Very limited structures. Core structures often inaccurate, impairing communication.',
        '3': 'Limited but adequate structures with some inaccuracies. Punctuation sometimes inaccurate.',
        '4': 'Good range of structures. Core structures mostly accurate. Punctuation mostly error-free.',
        '5': 'Wide range exceeding expectations. Core structures accurate. Effective punctuation and capitalisation.',
      }
    },
  ],
};

// Build prompt for LANC1070 Synthesis Essay (single source text)
function buildLanc1070Prompt(
  studentText: string,
  sourceContent: string,
  sourceTitle: string,
  assignmentTitle: string,
  assignmentDescription: string,
  wordCount: number,
  targetWordCount: { min: number; max: number; ideal: number }
): string {
  const rubrics = SYNTHESIS_RUBRICS;
  const totalMaxScore = SYNTHESIS_CRITERIA.reduce((sum, c) => sum + c.maxScore, 0); // 20

  const tenPercentBelow = Math.round(targetWordCount.min * 0.9);
  const tenPercentAbove = Math.round(targetWordCount.max * 1.1);

  const wordCountStatus = wordCount < tenPercentBelow
    ? `WARNING: Word count (${wordCount}) is MORE THAN 10% BELOW the required minimum of ${targetWordCount.min} words. This MUST lower the Task Achievement score per the rubric.`
    : wordCount < targetWordCount.min
    ? `NOTE: Word count (${wordCount}) is below the required range of ${targetWordCount.min}-${targetWordCount.max} words. Up to 10% below is acceptable for the Satisfactory band.`
    : wordCount > tenPercentAbove
    ? `WARNING: Word count (${wordCount}) is MORE THAN 10% ABOVE the required maximum of ${targetWordCount.max} words. This MUST lower the Task Achievement score per the rubric.`
    : wordCount > targetWordCount.max
    ? `NOTE: Word count (${wordCount}) exceeds the recommended range of ${targetWordCount.min}-${targetWordCount.max} words. Up to 10% above is acceptable for the Satisfactory band.`
    : `Word count (${wordCount}) is within the acceptable range of ${targetWordCount.min}-${targetWordCount.max} words.`;

  const criteriaDetails = rubrics.criteria.map(c => {
    const rubricLevels = Object.entries(c.rubric)
      .map(([score, desc]) => `  Score ${score}: ${desc}`)
      .join('\n');
    return `${c.name} (0-${c.maxScore}):\n${rubricLevels}`;
  }).join('\n\n');

  return `You are an expert writing assessor evaluating a Credit level student's synthesis essay for Sultan Qaboos University's Center for Preparatory Studies, course LANC1070 (Academic English).

STUDENT LEVEL: CEFR A2-B1 (Elementary to Pre-Intermediate). Feedback must use simple, clear language appropriate for A2-B1 learners. Be encouraging while maintaining appropriate academic standards. Avoid overly technical linguistic terminology.

ASSIGNMENT: ${assignmentTitle}

WRITING TASK: ${assignmentDescription}

TARGET WORD COUNT: ${targetWordCount.min}-${targetWordCount.max} words (ideal: ${targetWordCount.ideal}). A tolerance of +/-10% is acceptable (effective range: ${tenPercentBelow}-${tenPercentAbove}).

${wordCountStatus}

SOURCE TEXT:
Title: "${sourceTitle}"
"""
${sourceContent}
"""

STUDENT'S ESSAY:
"""
${studentText}
"""

ASSESSMENT RUBRICS (LANC1070 - Synthesis Essay based on a single source text):

${criteriaDetails}

POINTS TO CONSIDER FOR EACH CRITERION:

Task Achievement:
- Does the essay address the required discussion points from the assignment?
- Is information from the source text synthesized effectively?
- Does the essay stay within the target word count?

Coherence and Cohesion:
- Logical organization of information and ideas
- Use of cohesive devices (conjunctions and linkers)
- Paragraphing and essay structure

Lexical Resource:
- Vocabulary range and accuracy
- Paraphrasing quality (student uses own words rather than copying)
- Spelling and word formation

Grammatical Range and Accuracy:
- Range and accuracy of grammatical structures
- Sentence variety
- Punctuation

============================================================
SCORING AND FEEDBACK INSTRUCTIONS (CRITICAL — FOLLOW EXACTLY):
============================================================

STEP 1 — SCORE each criterion using WHOLE or HALF numbers (0, 0.5, 1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, or 5). If the essay's quality falls between two adjacent score bands, award a half-point (e.g., 3.5). Use 0.5 increments only — never use 0.25 or 0.75.

STEP 2 — For EACH criterion, write a "Justification" paragraph that:
  (a) Explicitly names the score band you chose (e.g. "Score 3.5 — Satisfactory")
  (b) Quotes at least ONE specific phrase or sentence from the student's essay as evidence
  (c) Explains why the essay fits that band descriptor — connect the evidence to the rubric
  (d) If you awarded a half-point, explain which aspects place it in the lower band and which in the higher band
  (e) If the score is below 4, clearly state what is missing compared to the next higher band
  (f) If the score is 5, explain what the student did beyond expectations

STEP 3 — For each criterion, list SPECIFIC errors found in the text. Format each as:
  - "[exact quoted text]" — highlight the mistake and explain why it is wrong, but do NOT provide the corrected version

STEP 4 — For each criterion, provide 1-2 concrete, achievable suggestions for improvement appropriate for an A2-B1 level writer.

STEP 5 — overallFeedback must be a comprehensive summary (4-6 sentences) that:
  - Highlights the student's strongest criterion and what they did well
  - Identifies the weakest area needing the most attention
  - Evaluates how well the essay addresses the assigned discussion points
  - Evaluates how effectively the student used the source text (paraphrasing vs copying)
  - Gives one prioritized action item to focus on next

STEP 6 — Calculate totalScore = sum of all criterion scores (max ${totalMaxScore}). Calculate percentage = round(totalScore / ${totalMaxScore} * 100).

============================================================
CRITICAL OUTPUT RULES:
- Respond with ONLY the raw JSON object. No markdown, no code fences, no commentary.
- Do NOT wrap the JSON in triple-backtick code blocks.
- Use straight double quotes, not smart/curly quotes.
- Do NOT add trailing commas after the last item in arrays or objects.
- All string values must have properly escaped quotes inside them.
- FORMAT: Write justification, strengths, suggestions, and overallFeedback using bullet points (•) or numbered lists (1. 2. 3.) wherever possible. Each bullet should be a separate, clear point. This makes the report easier to read for students.

JSON OUTPUT FORMAT:
============================================================
{
  "scores": [
    {
      "criterionName": "Task Achievement",
      "score": 4,
      "maxScore": 5,
      "justification": "Score 4: Good. The essay addresses the task by [explanation]. For example, the student writes: \\"[exact quote]\\" which shows [specific rubric alignment].",
      "strengths": "The student demonstrates solid understanding of the source material and addresses the main discussion points.",
      "mistakes": [
        "[exact quoted text]" — Highlight the mistake and explain why it is wrong, but do NOT provide the corrected version
      ],
      "suggestions": "Include more specific examples from the source text to support your discussion points. Use your own words more consistently when paraphrasing."
    }
  ],
  "totalScore": 16,
  "maxScore": ${totalMaxScore},
  "percentage": 80,
  "overallFeedback": "Your strongest area is [criterion] where you [specific strength]. The area that needs the most improvement is [criterion] because [reason]. Focus on [one prioritized action] to improve your next essay."
}`;
}

// Build prompt for LANC2070 Article Review (main article + source excerpts)
function buildLanc2070Prompt(
  studentText: string,
  mainArticleContent: string,
  mainArticleTitle: string,
  mainArticleAuthor: string,
  mainArticleYear: number,
  excerpts: { id: string; author: string; year: number; title: string; content: string }[],
  assignmentTitle: string,
  assignmentDescription: string,
  writingPrompt: string,
  wordCount: number,
  targetWordCount: { min: number; max: number; ideal: number }
): string {
  const rubrics = LANC2070_RUBRICS;
  const totalMaxScore = LANC2070_CRITERIA.reduce((sum, c) => sum + c.maxScore, 0); // 20

  const wordCountStatus = wordCount < 300
    ? `WARNING: Word count (${wordCount}) is BELOW the minimum of 300 words. Per the rubric, this MUST result in a Poor (0-1.5) score for Task Response.`
    : wordCount < targetWordCount.min
    ? `NOTE: Word count (${wordCount}) is below the required range of ${targetWordCount.min}-${targetWordCount.max} words. This should be reflected in the Task Response score.`
    : wordCount > targetWordCount.max
    ? `NOTE: Word count (${wordCount}) exceeds the recommended maximum of ${targetWordCount.max} words. This should be reflected in the Task Response score.`
    : `Word count (${wordCount}) is within the acceptable range of ${targetWordCount.min}-${targetWordCount.max} words.`;

  const criteriaDetails = rubrics.criteria.map(c => {
    const rubricLevels = Object.entries(c.rubric)
      .map(([score, desc]) => `  Score ${score}: ${desc}`)
      .join('\n');
    return `${c.name} (0-${c.maxScore}):\n${rubricLevels}`;
  }).join('\n\n');

  const hasExcerpts = excerpts && excerpts.length > 0;
  const excerptsList = hasExcerpts
    ? excerpts.map((e, i) => `${i + 1}. ${e.author} (${e.year}). ${e.title}\n   "${e.content}"`).join('\n\n')
    : '';

  // Build essay structure instructions based on whether excerpts are provided
  const essayStructure = hasExcerpts
    ? `- Paragraph 1 (Introduction): Introduce the article, write a focus statement, and present a clear thesis statement.
- Paragraph 2 (Summary): Summarise the main ideas of the article concisely and accurately, without unnecessary detail.
- Paragraph 3 (Critique): Analyse and evaluate two points from the article, synthesising a minimum of two excerpts from the provided source texts.
- Paragraph 4 (Conclusion): Restate the thesis statement, summarise the critique, and end with a final thought.`
    : `- Paragraph 1 (Introduction): Introduce the topic, write a focus statement, and present a clear thesis statement.
- Paragraph 2 (Body Paragraph 1): Discuss the first way colleges can prepare students for future jobs, using evidence from the source text.
- Paragraph 3 (Body Paragraph 2): Discuss the second way colleges can prepare students for future jobs, using evidence from the source text.
- Paragraph 4 (Conclusion): Restate the thesis statement, summarise the main points, and end with a final thought.`;

  const excerptsSection = hasExcerpts
    ? `AVAILABLE SOURCE EXCERPTS (student must use at least 2):
${excerptsList}

NOTE: The student must cite all sources in-text using APA format (e.g., Author, year). All source material must be paraphrased — copying chunks of 3 or more words is not allowed.`
    : `NOTE: The student must cite the source article in-text using APA format (e.g., Author, year). All source material must be paraphrased — copying chunks of 3 or more words is not allowed.`;

  const taskResponsePoints = hasExcerpts
    ? `- Does the review have exactly 4 paragraphs (Introduction, Summary, Critique, Conclusion)?
- Does the summary capture the main ideas of the article without unnecessary detail?
- Does the critique analyse and evaluate exactly 2 points from the article?
- Are at least 2 excerpts from the provided sources used and synthesised effectively?
- Is there evidence of analysis (original insights about how/why) and evaluation (critical judgment about value/validity)?
- Is the word count within the required range?`
    : `- Does the essay have exactly 4 paragraphs (Introduction, Body 1, Body 2, Conclusion)?
- Does each body paragraph discuss one distinct way colleges can prepare students for future jobs?
- Are ideas from the source text used effectively to support the discussion?
- Is there evidence of analysis (original insights about how/why) and evaluation (critical judgment)?
- Is the word count within the required range?`;

  return `You are an expert writing assessor for LANC2070 (Academic English: Article Review) at Sultan Qaboos University. CEFR A2-B1 level. Use simple, clear language.

ASSIGNMENT: ${assignmentTitle}
WRITING TASK: ${assignmentDescription}
WRITING PROMPT: ${writingPrompt}

TARGET WORD COUNT: ${targetWordCount.min}-${targetWordCount.max} words (ideal: ${targetWordCount.ideal}). Below 300 words = Poor for Task Response.
${wordCountStatus}

REQUIRED STRUCTURE (4 paragraphs):
${essayStructure}

SOURCE TEXT:
"${mainArticleTitle}" by ${mainArticleAuthor} (${mainArticleYear})
"""
${mainArticleContent}
"""

${excerptsSection}

STUDENT'S ESSAY:
"""
${studentText}
"""

ASSESSMENT RUBRICS (LANC2070):
${criteriaDetails}

KEY CHECKS PER CRITERION:

Task Response: ${hasExcerpts
    ? '4-paragraph structure (Intro, Summary, Critique, Conclusion)? Summary captures main ideas? Critique analyses + evaluates 2 points? At least 2 excerpts synthesised? Word count met?'
    : '4-paragraph structure (Intro, Body 1, Body 2, Conclusion)? Each body paragraph discusses one distinct point? Source text evidence used? Word count met?'}

Coherence & Cohesion: Clear focus/thesis statement in intro? Intro and conclusion thorough? Attributive phrases + APA citations? Cohesive devices accurate?

Lexical Resource: Source material paraphrased (not copied)? Any copied chunks of 3+ words? Vocabulary range and accuracy? Spelling?

Grammar: Range of structures (compound/complex, relative clauses)? Core structures accurate (subject-verb, tense, articles)? Punctuation?

============================================================
SCORING INSTRUCTIONS:
============================================================
1. Score each criterion 0-5 (0.5 increments only).
2. For each criterion provide:
   - justification: Name the score band, quote evidence from essay, explain why it fits. If half-point, explain what places it between bands. Keep to 2-3 sentences.
   - strengths: What the student did well (1 sentence).
   - mistakes: List up to 3 specific errors as "[quoted text]" — explain the error. Do NOT give corrections.
   - suggestions: 1 actionable improvement tip for A2-B1 level.
3. overallFeedback: 2-3 sentences covering strongest area, weakest area, paraphrasing quality, and one priority action.
4. totalScore = sum of scores (max ${totalMaxScore}). percentage = round(totalScore/${totalMaxScore}*100).

OUTPUT: Valid JSON only. No markdown, no code fences, no commentary. Use straight double quotes.
{
  "scores": [
    {
      "criterionName": "Task Response",
      "score": 4,
      "maxScore": 5,
      "justification": "Score 4: Good. [Brief evidence quote and rubric alignment in 2-3 sentences].",
      "strengths": "[1 sentence].",
      "mistakes": ["[quoted text] — explanation"],
      "suggestions": "[1 tip]."
    }
  ],
  "totalScore": 16,
  "maxScore": ${totalMaxScore},
  "percentage": 80,
  "overallFeedback": "[2-3 sentences: strongest area, weakest area, paraphrasing, one action item]."
}`;
}

// Build prompt for Synthesis Essay (LANC2160)
function buildSynthesisPrompt(
  studentText: string,
  sources: { title: string; content: string }[],
  assignmentTitle: string,
  assignmentDescription: string,
  wordCount: number,
  targetWordCount: { min: number; max: number; ideal: number }
): string {
  const rubrics = SYNTHESIS_RUBRICS;
  const totalMaxScore = SYNTHESIS_CRITERIA.reduce((sum, c) => sum + c.maxScore, 0); // 20

  const tenPercentBelow = Math.round(targetWordCount.min * 0.9);
  const tenPercentAbove = Math.round(targetWordCount.max * 1.1);

  const wordCountStatus = wordCount < tenPercentBelow
    ? `WARNING: Word count (${wordCount}) is MORE THAN 10% BELOW the required minimum of ${targetWordCount.min} words. This MUST lower the Task Achievement score per the rubric.`
    : wordCount < targetWordCount.min
    ? `NOTE: Word count (${wordCount}) is below the required range of ${targetWordCount.min}-${targetWordCount.max} words. Up to 10% below is acceptable for the Satisfactory band.`
    : wordCount > tenPercentAbove
    ? `WARNING: Word count (${wordCount}) is MORE THAN 10% ABOVE the required maximum of ${targetWordCount.max} words. This MUST lower the Task Achievement score per the rubric.`
    : wordCount > targetWordCount.max
    ? `NOTE: Word count (${wordCount}) exceeds the recommended range of ${targetWordCount.min}-${targetWordCount.max} words. Up to 10% above is acceptable for the Satisfactory band.`
    : `Word count (${wordCount}) is within the acceptable range of ${targetWordCount.min}-${targetWordCount.max} words.`;

  const criteriaDetails = rubrics.criteria.map(c => {
    const rubricLevels = Object.entries(c.rubric)
      .map(([score, desc]) => `  Score ${score}: ${desc}`)
      .join('\n');
    return `${c.name} (0-${c.maxScore}):\n${rubricLevels}`;
  }).join('\n\n');

  const sourceTextsBlock = sources.map((s, i) => {
    return `SOURCE ${i + 1}: "${s.title}"
"""
${s.content}
"""`;
  }).join('\n\n');

  return `You are an expert writing assessor for LANC2160 (Summary Writing & Synthesis) at Sultan Qaboos University. CEFR A2-B1 level. Use simple, clear language.

TASK: The student read ALL THREE source texts and wrote a 4-paragraph synthesis essay (${targetWordCount.min}-${targetWordCount.max} words).

ASSIGNMENT: ${assignmentTitle}
INSTRUCTIONS: ${assignmentDescription}

${sourceTextsBlock}

STUDENT'S SYNTHESIS ESSAY:
"""
${studentText}
"""

${wordCountStatus}

SYNTHESIS ESSAY ASSESSMENT RUBRICS (LANC2160):
${criteriaDetails}

SYNTHESIS-SPECIFIC RULES:
1. Must combine information from ALL THREE sources — not just one or two.
2. Must address the assignment prompt: "${assignmentTitle}".
3. Must be exactly 4 paragraphs (intro, body 1, body 2, conclusion).
4. Must use OWN WORDS (paraphrasing). Copying > 15% = low Task Achievement and Lexical Resource.
5. NO personal opinions or new information not in the sources.
6. Off-topic essay → Task Achievement = 0.
7. Word count 10%+ outside range → lower Task Achievement per rubric.

============================================================
SCORING INSTRUCTIONS:
============================================================
1. Score each criterion 0-5 (0.5 increments only).
2. For each criterion provide:
   - justification: Name the score band, quote evidence from essay, explain why it fits. If half-point, explain what places it between bands. For Task Achievement: specifically address whether ALL THREE sources were synthesised, assignment prompt addressed, word count met, paraphrasing used. Keep to 2-3 sentences.
   - strengths: What the student did well (1 sentence).
   - mistakes: List up to 3 specific errors as "[quoted text]" — explain the error. Do NOT give corrections.
   - suggestions: 1 actionable improvement tip for A2-B1 level.
3. overallFeedback: 2-3 sentences covering which sources were used (all 3?), strongest area, weakest area, paraphrasing/copied text %, and one priority action.
4. totalScore = sum of scores (max ${totalMaxScore}). percentage = round(totalScore/${totalMaxScore}*100).

OUTPUT: Valid JSON only. No markdown, no code fences, no commentary. Use straight double quotes.
{
  "scores": [
    {
      "criterionName": "Task Achievement",
      "score": 3.5,
      "maxScore": 5,
      "justification": "Score 3.5 — [Brief evidence quote and rubric alignment in 2-3 sentences].",
      "strengths": "[1 sentence].",
      "mistakes": ["[quoted text] — explanation"],
      "suggestions": "[1 tip]."
    }
  ],
  "totalScore": 13,
  "maxScore": ${totalMaxScore},
  "percentage": 65,
  "overallFeedback": "[2-3 sentences: sources used, strongest area, weakest area, paraphrasing %, one action item]."
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
        { error: 'No text provided for assessment', details: 'The text field is empty or missing from the request.' },
        { status: 400 }
      );
    }

    if (!apiKey) {
      return NextResponse.json(
        { error: 'Gemini API key is required', details: 'No API key was provided in the request. Please add a Gemini API key in Settings.' },
        { status: 400 }
      );
    }

    // Calculate word count
    const wordCount = text.trim().split(/\s+/).filter(Boolean).length;

    // Determine course type and build appropriate prompt
    const isFoundation = ['0230', '0340'].includes(courseCode);
    const isSummaryWriting = courseCode === 'LANC2160' && writingType === 'summary';
    const isSynthesisWriting = courseCode === 'LANC2160' && writingType === 'synthesis';
    const isLanc1070 = courseCode === 'LANC1070';
    const isLanc2146 = courseCode === 'LANC2146';
    const isLanc2070 = courseCode === 'LANC2070';

    // Validate that LANC2160 has a writingType selected
    if (courseCode === 'LANC2160' && !writingType) {
      return NextResponse.json(
        { error: 'Writing type is required for LANC2160. Please select either "Summary" or "Synthesis" before assessing.', details: 'Missing writingType parameter for LANC2160' },
        { status: 400 }
      );
    }

    // Validate that courses requiring a sourceTextId have one provided
    if ((isLanc1070 || isLanc2146 || isLanc2070 || isSummaryWriting || isSynthesisWriting) && !sourceTextId) {
      return NextResponse.json(
        { error: 'A source text or assignment must be selected before assessment. Please go back and select one.', details: `Missing sourceTextId for course ${courseCode}` },
        { status: 400 }
      );
    }

    // Resolve target word count based on exam type (for FP0340) or summary target
    let activeTargetWordCount: { min: number; max: number; ideal: number; label?: string } | null = null;
    let prompt: string;
    let criteria: any[];

    if (isFoundation) {
      // Foundation courses (FP0230, FP0340) — per-course word count targets
      const courseWordCounts = FOUNDATION_WORD_COUNTS[courseCode];
      const courseDefault = DEFAULT_FOUNDATION_WORD_COUNTS[courseCode];
      if (examType && courseWordCounts && courseWordCounts[examType]) {
        activeTargetWordCount = courseWordCounts[examType];
      } else if (courseDefault) {
        activeTargetWordCount = { ...courseDefault };
      } else {
        activeTargetWordCount = { min: 110, max: 130, ideal: 120, label: 'Foundation Exam' };
      }
      prompt = buildFoundationPrompt(text, topic, wordCount, activeTargetWordCount);
      criteria = FOUNDATION_RUBRICS.criteria;
    } else if (isSummaryWriting) {
      // Summary Writing for LANC2160 — look up source text
      const { SUMMARY_SOURCE_TEXTS } = await import('@/lib/store');
      const sourceTextData = SUMMARY_SOURCE_TEXTS.find(s => s.id === sourceTextId);
      
      if (!sourceTextData) {
        return NextResponse.json(
          { error: 'Source text not found. Please select a valid source text for summary writing.', details: `No source text found for sourceTextId: ${sourceTextId}` },
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
    } else if (isSynthesisWriting) {
      // Synthesis Essay for LANC2160 — look up assignment by sourceTextId (import from store to stay in sync)
      const { SYNTHESIS_ASSIGNMENTS } = await import('@/lib/store');
      const assignmentData = SYNTHESIS_ASSIGNMENTS.find(a => a.id === sourceTextId);
      
      if (!assignmentData) {
        return NextResponse.json(
          { error: 'Synthesis assignment not found. Please select a valid assignment for synthesis essay writing.', details: `No synthesis assignment found for sourceTextId: ${sourceTextId}` },
          { status: 400 }
        );
      }
      
      activeTargetWordCount = {
        min: assignmentData.targetWordCount.min,
        max: assignmentData.targetWordCount.max,
        ideal: assignmentData.targetWordCount.ideal,
        label: `Synthesis: "${assignmentData.title}"`
      };
      prompt = buildSynthesisPrompt(
        text,
        assignmentData.sources.map(s => ({ title: s.title, content: s.content })),
        assignmentData.title,
        assignmentData.description,
        wordCount,
        activeTargetWordCount
      );
      criteria = SYNTHESIS_CRITERIA;
    } else if (isLanc2146) {
      // LANC2146 Report Writing — Discussion & Conclusion
      const { LANC2146_PRACTICE_TESTS } = await import('@/lib/store');
      const practiceData = LANC2146_PRACTICE_TESTS.find(t => t.id === sourceTextId);

      if (!practiceData) {
        return NextResponse.json(
          { error: 'Report writing assignment not found. Please select a valid practice test.', details: `No LANC2146 practice test found for sourceTextId: ${sourceTextId}` },
          { status: 400 }
        );
      }

      activeTargetWordCount = {
        min: practiceData.targetWordCount.min,
        max: practiceData.targetWordCount.max,
        ideal: practiceData.targetWordCount.ideal,
        label: `Report: "${practiceData.title}"`
      };
      prompt = buildLanc2146Prompt(
        text,
        practiceData.reportSections.map(s => ({ title: s.title, content: s.content })),
        practiceData.resultsFigure?.caption || null,
        practiceData.resultsFigure?.graphDescription || null,
        practiceData.title,
        wordCount,
        activeTargetWordCount
      );
      criteria = LANC2146_CRITERIA;
    } else if (isLanc1070) {
      // LANC1070 Synthesis Essay — single source text practice tests
      const { LANC1070_PRACTICE_TESTS } = await import('@/lib/store');
      const practiceData = LANC1070_PRACTICE_TESTS.find(t => t.id === sourceTextId);

      if (!practiceData) {
        return NextResponse.json(
          { error: 'LANC1070 practice test not found. Please select a valid practice test.', details: `No LANC1070 practice test found for sourceTextId: ${sourceTextId}` },
          { status: 400 }
        );
      }

      activeTargetWordCount = {
        min: practiceData.targetWordCount.min,
        max: practiceData.targetWordCount.max,
        ideal: practiceData.targetWordCount.ideal,
        label: `LANC1070: "${practiceData.title}"`
      };
      prompt = buildLanc1070Prompt(
        text,
        practiceData.sourceText.content,
        practiceData.sourceText.title,
        practiceData.title,
        practiceData.description,
        wordCount,
        activeTargetWordCount
      );
      criteria = SYNTHESIS_CRITERIA; // Reuse synthesis criteria (A2-B1, 0-5 scale)
    } else if (isLanc2070) {
      // LANC2070 Article Review — main article + source excerpts
      const { LANC2070_PRACTICE_TESTS } = await import('@/lib/store');
      const practiceData = LANC2070_PRACTICE_TESTS.find(t => t.id === sourceTextId);

      if (!practiceData) {
        return NextResponse.json(
          { error: 'LANC2070 practice test not found. Please select a valid practice test.', details: `No LANC2070 practice test found for sourceTextId: ${sourceTextId}` },
          { status: 400 }
        );
      }

      activeTargetWordCount = {
        min: practiceData.targetWordCount.min,
        max: practiceData.targetWordCount.max,
        ideal: practiceData.targetWordCount.ideal,
        label: `LANC2070: "${practiceData.title}"`
      };
      prompt = buildLanc2070Prompt(
        text,
        practiceData.mainArticle.content,
        practiceData.mainArticle.title,
        practiceData.mainArticle.author,
        practiceData.mainArticle.year,
        practiceData.excerpts,
        practiceData.title,
        practiceData.description,
        practiceData.writingPrompt,
        wordCount,
        activeTargetWordCount
      );
      criteria = LANC2070_CRITERIA;
    } else {
      // Credit/Post-foundation — general
      activeTargetWordCount = null;
      prompt = buildCreditPrompt(text, topic, wordCount);
      criteria = CREDIT_CRITERIA;
    }

    // 1. Initialize Official Google Gemini SDK
    const genAI = new GoogleGenerativeAI(apiKey);
    
    // 2. Initialize Model with Strict Instructions
    const systemInstruction = isSummaryWriting
      ? 'You are an expert writing assessment AI for the Credit level course LANC2160 (Academic English: Summary Writing & Synthesis Essay) at Sultan Qaboos University. For summary writing tasks, students are at CEFR A2-B1 level. Your feedback must use simple, clear language appropriate for this proficiency level. CRITICAL: You MUST (1) compare the student summary against the provided source text, (2) quote exact words from the student summary as evidence, (3) explicitly justify why the score matches the rubric band, (4) list specific errors with quoted text, (5) assess paraphrasing quality, and (6) give actionable suggestions. You respond only with valid JSON. No markdown formatting or code blocks.'
      : isSynthesisWriting
      ? 'You are an expert writing assessment AI for the Credit level course LANC2160 (Academic English: Summary Writing & Synthesis Essay) at Sultan Qaboos University. For synthesis essay tasks, students are at CEFR A2-B1 level. Your feedback must use simple, clear language appropriate for this proficiency level. CRITICAL: You MUST (1) compare the student essay against ALL THREE provided source texts, (2) check that information from all sources is synthesized, (3) quote exact words from the student essay as evidence, (4) explicitly justify why the score matches the rubric band, (5) list specific errors with quoted text, (6) assess paraphrasing quality and estimate copying percentage, (7) check word count against the target range, and (8) give actionable suggestions. You respond only with valid JSON. No markdown formatting or code blocks.'
      : isLanc1070
      ? 'You are an expert writing assessment AI for the Credit level course LANC1070 (Academic English) at Sultan Qaboos University. For synthesis essay tasks based on a single source text, students are at CEFR A2-B1 level. Your feedback must use simple, clear language appropriate for this proficiency level. CRITICAL: You MUST (1) compare the student essay against the provided source text, (2) check that the student addresses the required discussion points, (3) quote exact words from the student essay as evidence, (4) explicitly justify why the score matches the rubric band, (5) list specific errors with quoted text, (6) assess paraphrasing quality and estimate copying percentage, (7) check word count against the target range, and (8) give actionable suggestions. You respond only with valid JSON. No markdown formatting or code blocks.'
      : isLanc2146
      ? 'You are an expert writing assessment AI for the Credit level course LANC2146 (Report Writing) at Sultan Qaboos University. For lab report Discussion and Conclusion tasks, students are at CEFR A2-B1 level. Your feedback must use simple, clear language appropriate for this proficiency level. CRITICAL: You MUST (1) evaluate the Discussion section for analysis and interpretation of data with details/examples/statistics, (2) evaluate the Conclusion for summary of results, reference to previous research, restatement of aim, and recommendations, (3) quote exact words from the student text as evidence, (4) explicitly justify why the score matches the rubric band, (5) list specific errors with quoted text, (6) check word count against the target range specified in the prompt, and (7) give actionable suggestions. You respond only with valid JSON. No markdown formatting or code blocks.'
      : isLanc2070
      ? 'You are an expert writing assessment AI for the Credit level course LANC2070 (Academic English: Article Review) at Sultan Qaboos University. For article review tasks, students are at CEFR A2-B1 level. Your feedback must use simple, clear language appropriate for this proficiency level. CRITICAL: You MUST (1) check that the review has exactly 4 paragraphs (Introduction, Summary, Critique, Conclusion), (2) evaluate the quality of analysis (original insights about how/why) and evaluation (critical judgment about value/validity) of 2 points from the main article, (3) verify that at least 2 excerpts from the provided source texts are used and synthesised, (4) check APA in-text citation format and attributive phrases, (5) assess paraphrasing quality — copied chunks of 3+ words must be penalised, (6) quote exact words from the student review as evidence, (7) explicitly justify why the score matches the rubric band, (8) list specific errors with quoted text, and (9) give actionable suggestions. You respond only with valid JSON. No markdown formatting or code blocks.'
      : 'You are an expert writing assessment AI for university courses at Sultan Qaboos University. Students are at CEFR A2-B1 level (Elementary to Pre-Intermediate). Your feedback must use simple, clear language appropriate for this proficiency level. Focus on fundamental skills and provide encouraging, constructive guidance. CRITICAL: For each criterion you MUST (1) quote exact words from the student essay as evidence, (2) explicitly justify why the score matches the rubric band, (3) list specific errors with quoted text, and (4) give actionable suggestions. You respond only with valid JSON. No markdown formatting or code blocks.';

    const model = genAI.getGenerativeModel({
      model: 'gemini-2.5-flash',
      systemInstruction,
      generationConfig: {
        responseMimeType: 'application/json',
      },
    });

    // 3. Generate Content — gemini-2.5-flash is a "thinking" model by default.
    //    We MUST disable thinking because:
    //    (a) thinking tokens waste the maxOutputTokens budget, causing truncated JSON
    //    (b) thinking text can bleed into the response, breaking JSON parsing
    //    (c) we only need structured JSON output, not reasoning
    //    We also use responseMimeType: 'application/json' to force valid JSON.
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

    // Retry configuration for rate-limit errors (429 / RESOURCE_EXHAUSTED)
    const RATE_LIMIT_RETRIES = 3;
    const RATE_LIMIT_DELAYS = [5000, 15000, 30000]; // 5s, 15s, 30s

    // Try generation with increasing token limits on truncation
    // NOTE: Gemini free tier caps maxOutputTokens at 8192. Start there to avoid
    // API errors on free-tier keys. If response is truncated, retry at 16384
    // (which works on paid tiers and will be silently capped on free tier).
    let responseText = '';
    let parsedOk = false;
    const tokenLimits = [8192, 16384];

    for (const maxTokens of tokenLimits) {
      // Inner retry loop for rate-limit (429) errors
      for (let rateLimitAttempt = 0; rateLimitAttempt < RATE_LIMIT_RETRIES; rateLimitAttempt++) {
        try {
          const result = await model.generateContent({
            contents: [{ role: 'user', parts: [{ text: prompt }] }],
            generationConfig: {
              temperature: 0.1,
              maxOutputTokens: maxTokens,
              thinkingConfig: {
                thinkingBudget: 0,  // Disable thinking — prevents thought tokens from consuming output budget or polluting JSON
              },
            } as any,
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

          // Extract text — manually filter out "thought" parts from thinking models
          // Gemini 2.5 models may include thought parts in the response even with thinkingBudget: 0
          // We only want the actual text (non-thought) parts for JSON parsing
          let rawText = '';
          if (candidate?.content?.parts) {
            // Filter out thought parts and concatenate only text parts
            for (const part of candidate.content.parts) {
              if (part.text && !part.thought) {
                rawText += part.text;
              }
            }
          }
          // Fallback to the SDK's text() method if manual extraction failed
          if (!rawText) {
            rawText = result.response?.text?.() || '';
          }
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

          // Try to parse the JSON and validate structure
          let assessment: any = null;
          let parseFailed = false;
          try {
            assessment = extractJSON(rawText);
          } catch (_e) {
            parseFailed = true;
            // JSON parse failed — if truncated, break to try next token limit
            if (finishReason === 'MAX_TOKENS' && maxTokens !== tokenLimits[tokenLimits.length - 1]) {
              console.warn(`JSON parse failed after truncation at ${maxTokens} tokens, retrying with higher limit...`);
              break; // Break out of rate-limit loop to try next token limit
            }
            // Otherwise, fall through to error
            console.error('Failed to parse assessment response. Raw text (first 500 chars):', rawText.substring(0, 500));
            return NextResponse.json(
              { error: 'Failed to parse AI assessment response. The AI returned an invalid format. Please try again.', details: 'The AI response could not be parsed. This is a temporary issue — retrying usually works.' },
              { status: 500 }
            );
          }

          // Validate structure: must have a scores array
          if (assessment && assessment.scores && Array.isArray(assessment.scores)) {
            responseText = rawText;
            parsedOk = true;
            break;
          }

          // JSON parsed but structure invalid (no scores array) — treat as parse failure
          console.error('Assessment JSON parsed but has no valid scores array. Raw text (first 500 chars):', rawText.substring(0, 500));
          if (finishReason === 'MAX_TOKENS' && maxTokens !== tokenLimits[tokenLimits.length - 1]) {
            console.warn('Truncated response missing scores array, retrying with higher token limit...');
            break; // Break to try next token limit
          }
          return NextResponse.json(
            { error: 'AI returned an invalid assessment structure. Please try again.', details: 'No scores array in response.' },
            { status: 500 }
          );

        } catch (genError: any) {
          const errMsg = genError?.message || String(genError);
          const isRateLimit =
            errMsg.includes('429') ||
            errMsg.includes('RESOURCE_EXHAUSTED') ||
            errMsg.includes('quota') ||
            errMsg.includes('rate') && errMsg.includes('limit');

          // If rate-limited and we have retries left, wait and retry
          if (isRateLimit && rateLimitAttempt < RATE_LIMIT_RETRIES - 1) {
            const delay = RATE_LIMIT_DELAYS[rateLimitAttempt];
            console.warn(`Rate limit hit (attempt ${rateLimitAttempt + 1}/${RATE_LIMIT_RETRIES}), retrying in ${delay / 1000}s...`);
            await new Promise(resolve => setTimeout(resolve, delay));
            continue; // retry inner loop
          }

          // If rate-limited and out of retries, return a helpful error
          if (isRateLimit) {
            console.error('Rate limit exhausted after all retries.');
            return NextResponse.json(
              { error: 'Gemini API rate limit reached. Your free tier has a limited number of requests per minute. Please wait 1-2 minutes and try again. Tip: Add a second Gemini API key in Settings (one for OCR, one for assessment) to double your quota.', details: errMsg },
              { status: 429 }
            );
          }

          // Non-rate-limit error: if this is the last token limit attempt, throw
          if (maxTokens === tokenLimits[tokenLimits.length - 1]) {
            throw genError;
          }
          console.warn(`Generation error with ${maxTokens} tokens:`, errMsg);
          break; // break inner loop, try next token limit
        }
      }

      if (parsedOk) break;
    }

    if (!parsedOk) {
      return NextResponse.json(
        { error: 'Failed to get a valid assessment from the AI after multiple attempts. Please try again.', details: 'All token limit attempts and rate-limit retries exhausted without a valid response.' },
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
        { error: 'Invalid assessment structure', details: 'The parsed assessment JSON does not contain a valid scores array.' },
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

      // Ensure strengths, mistakes, and suggestions are never empty
      // This prevents the UI from silently hiding these sections
      if (!s.strengths) {
        s.strengths = 'No specific strengths identified for this criterion.';
      }
      if (!s.suggestions) {
        s.suggestions = 'No specific suggestions for this criterion.';
      }
      if (!Array.isArray(s.mistakes) || s.mistakes.length === 0) {
        s.mistakes = [{ quote: '', explanation: 'No specific mistakes identified for this criterion.' }];
      }

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

      // Build a clean, professional feedback string with section headers
      // These headers are required by parseFeedback() in scoring-utils.ts
      // to reliably identify each section (avoids fragile heuristic parsing)
      const parts: string[] = [];

      if (s.justification) {
        parts.push(`Justification: ${s.justification}`);
      }
      if (s.strengths) {
        parts.push(`Strengths: ${s.strengths}`);
      }
      if (Array.isArray(s.mistakes) && s.mistakes.length > 0) {
        const mistakeLines = s.mistakes
          .map((m: any) => {
            if (typeof m === 'string') return `- "${m}"`;
            return m.quote ? `- "${m.quote}": ${m.explanation}` : `- ${m.explanation}`;
          })
          .join('\n');
        parts.push(`Mistakes found:\n${mistakeLines}`);
      }
      if (s.suggestions) {
        parts.push(`Suggestions: ${s.suggestions}`);
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
    assessment.targetWordCount = (isFoundation || isSummaryWriting || isSynthesisWriting || isLanc1070 || isLanc2146 || isLanc2070) ? activeTargetWordCount : null;

    return NextResponse.json({
      success: true,
      assessment: {
        ...assessment,
        createdAt: new Date().toISOString(),
      }
    });
  } catch (error) {
    console.error('Assessment error:', error);
    const msg = error instanceof Error ? error.message : 'Unknown error';
    // Provide more specific error messages for common Gemini API failures
    let userError = 'Failed to assess essay';
    if (msg.includes('API key not valid') || msg.includes('API_KEY_INVALID') || msg.includes('invalid API key')) {
      userError = 'Gemini API key is invalid. Please update your API key in Settings.';
    } else if (msg.includes('model not found') || msg.includes('does not exist') || msg.includes('MODEL_NOT_FOUND')) {
      userError = 'The AI model is currently unavailable. Please try again later.';
    } else if (msg.includes('quota') || msg.includes('RESOURCE_EXHAUSTED')) {
      userError = 'Gemini API quota exceeded. Please wait a few minutes and try again.';
    } else if (msg.includes('PERMISSION_DENIED') || msg.includes('forbidden')) {
      userError = 'Gemini API access denied. The API key may not have permission to use this model.';
    } else if (msg.includes('timeout') || msg.includes('TIMEOUT') || msg.includes('Function exceeded time limits') || msg.includes('504')) {
      userError = 'Assessment timed out. The AI took too long to respond. This can happen on the free plan for complex assignments. Please try again.';
    }
    return NextResponse.json(
      { error: userError, details: msg },
      { status: 500 }
    );
  }
}
