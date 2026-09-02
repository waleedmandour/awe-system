import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold, SchemaType, Schema } from '@google/generative-ai';
import { CLOUD_ASSESSMENT_TIERS, ALLOWED_CLOUD_MODELS, type ModelId } from '@/lib/config';

// IMPORTANT: Vercel Hobby plan ($20/mo) allows maxDuration = 60.
// On the FREE tier, Vercel caps serverless functions at 10 seconds regardless of this setting.
// Prompts are optimised to complete within the 10-second free tier limit where possible.
export const maxDuration = 60;

// ─── Word Count Targets ─────────────────────────────────────────────────────

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

const DEFAULT_FOUNDATION_WORD_COUNTS: Record<string, { min: number; max: number; ideal: number; label: string }> = {
  '0230': { min: 90, max: 130, ideal: 120, label: 'FP0230 Foundation Exam' },
  '0340': { min: 110, max: 150, ideal: 120, label: 'FP0340 Foundation Exam' },
};

// ─── Rubric Data ─────────────────────────────────────────────────────────────

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

const CREDIT_CRITERIA = [
  { name: 'Task Achievement', maxScore: 5, description: 'How well the essay achieves the task requirements' },
  { name: 'Coherence & Cohesion', maxScore: 5, description: 'Logical organization and linking of ideas' },
  { name: 'Lexical Resource', maxScore: 5, description: 'Range and accuracy of vocabulary' },
  { name: 'Grammatical Range & Accuracy', maxScore: 5, description: 'Range and accuracy of grammar' },
];

const SUMMARY_CRITERIA = [
  { name: 'Task Achievement', maxScore: 5, description: 'How effectively the summary captures the main points of the source text using the student\'s own words.' },
  { name: 'Coherence & Cohesion', maxScore: 5, description: 'How logically the summary is organized and how well ideas are linked together.' },
  { name: 'Lexical Resource', maxScore: 5, description: 'The range and accuracy of vocabulary used, including paraphrasing ability.' },
  { name: 'Grammar & Accuracy', maxScore: 5, description: 'The range and accuracy of grammatical structures, sentence variety, and punctuation.' },
];

const SUMMARY_RUBRICS = {
  criteria: [
    {
      name: 'Task Achievement', maxScore: 5,
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
      name: 'Coherence and Cohesion', maxScore: 5,
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
      name: 'Lexical Resource', maxScore: 5,
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
      name: 'Grammar & Accuracy', maxScore: 5,
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

const SYNTHESIS_CRITERIA = [
  { name: 'Task Achievement', maxScore: 5, description: 'How effectively the synthesis essay fulfils the task requirements, synthesizes information from all source texts, and addresses the assignment prompt.' },
  { name: 'Coherence and Cohesion', maxScore: 5, description: 'How logically the synthesis essay is organized, how well ideas are linked, and how effectively information flows.' },
  { name: 'Lexical Resource', maxScore: 5, description: 'The range and accuracy of vocabulary, including paraphrasing ability and appropriate word choice.' },
  { name: 'Grammatical Range and Accuracy', maxScore: 5, description: 'The range and accuracy of grammatical structures, sentence variety, and punctuation.' },
];

const SYNTHESIS_RUBRICS = {
  criteria: [
    {
      name: 'Task Achievement', maxScore: 5,
      rubric: {
        '0-1.5': 'Poor: Fails to fulfil any task requirements. 10% or more outside word count.',
        '2-2.5': 'Unsatisfactory: Does not adequately fulfil task requirements. Most details are unimportant. 10% or more outside word count.',
        '3-3.5': 'Satisfactory: Adequately fulfils task requirements. Most main ideas present. Meaning generally accurate; some unimportant details may be included. Up to 10% outside word count.',
        '4-4.5': 'Good: Fulfils all task requirements but a little more could be expected. Main ideas present. Meaning mostly accurate, most details relevant. Stays within word count.',
        '5': 'Excellent: Fulfils all task requirements and exceeds expectations. All main ideas present. Meaning accurate, all details relevant. Stays within word count.',
      }
    },
    {
      name: 'Coherence and Cohesion', maxScore: 5,
      rubric: {
        '0-1.5': 'Poor: Lacks organization and coherence. Text largely confused and incoherent, challenging for reader to process.',
        '2-2.5': 'Unsatisfactory: Organization and coherence limited. Some re-reading necessary. Most cohesive devices are simple, used inaccurately and mechanically.',
        '3-3.5': 'Satisfactory: Organization and coherence often adequate, but supporting ideas may be limited. Text may be stilted. Cohesive devices sometimes inaccurate, repetitive, or over/under used.',
        '4-4.5': 'Good: Organization makes text clear and easy to understand. Cohesive devices almost always used accurately and appropriately within and between sentences.',
        '5': 'Excellent: Effective organization with logical flow throughout. Good range of cohesive devices used accurately and appropriately.',
      }
    },
    {
      name: 'Lexical Resource', maxScore: 5,
      rubric: {
        '0-1.5': 'Poor: Paraphrasing largely absent. Poor word choice, word form, and spelling prevent communication.',
        '2-2.5': 'Unsatisfactory: Very little paraphrasing; more than 15% directly copied. Inadequate vocabulary range. Errors in word choice, word form, and spelling predominate and affect communication.',
        '3-3.5': 'Satisfactory: Generally paraphrased; some copying but less than 15%. Limited but adequate vocabulary. Errors in word choice and spelling sometimes affect communication.',
        '4-4.5': 'Good: Well paraphrased with very little copying. Good vocabulary range. Spelling mostly correct.',
        '5': 'Excellent: Completely and accurately paraphrased. Wider vocabulary range than expected for the level. Spelling accurate.',
      }
    },
    {
      name: 'Grammatical Range and Accuracy', maxScore: 5,
      rubric: {
        '0-1.5': 'Poor: Inaccurate structures, errors predominate, preventing communication. Punctuation inadequate and/or inaccurate.',
        '2-2.5': 'Unsatisfactory: Very limited structures inadequate for the level. Grammatical errors noticeable and often affect communication. Punctuation may be inadequate/inaccurate.',
        '3-3.5': 'Satisfactory: Structures sometimes limited but adequate for the task. Grammatical errors may affect communication in places. Punctuation generally correct and effective.',
        '4-4.5': 'Good: Good range of structures. Some inaccuracy but communication not affected. Punctuation well managed and effective.',
        '5': 'Excellent: Wider range of structures than expected for the level. Most sentences error-free. Punctuation well managed and effective.',
      }
    },
  ],
};

const LANC2146_CRITERIA = [
  { name: 'Task Response', maxScore: 5, description: 'Analysis and interpretation of data with details/examples/statistics; quality of the discussion section; adequacy of the conclusion (most obvious result, reference to previous research, restatement of aim, solutions/recommendations).' },
  { name: 'Coherence and Cohesion', maxScore: 5, description: 'Logical organization of information and ideas; use of cohesive devices (conjunctions and linkers); paragraphing.' },
  { name: 'Grammatical Range and Accuracy', maxScore: 5, description: 'Use of grammatical functions (cause/effect, compare/contrast, prediction, recommendation/suggestion/solution); grammar structures accuracy; punctuation.' },
  { name: 'Lexical Resource', maxScore: 5, description: 'Vocabulary range and genre-specific register; spelling, word formation, and capitalization.' },
];

const LANC2146_RUBRICS = {
  criteria: [
    {
      name: 'Task Response', maxScore: 5,
      rubric: {
        '1': 'Poor (1-1.5): The analysis and interpretation of the main trend lacks specific details, examples, and statistics. The conclusion is missing or irrelevant.',
        '2': 'Unsatisfactory (2-2.5): The analysis and interpretation of the main trend is supported by few details, examples, and statistics. The conclusion is insufficient, may not refer to previous research, may not restate the aim, and provides irrelevant recommendations.',
        '3': 'Satisfactory (3-3.5): The analysis and interpretation of one clear main trend is supported by relevant details and examples, including some statistics. The conclusion adequately summarizes the most obvious result, refers to previous research, restates the aim, and provides solutions/general recommendations, but there may be gaps in coverage.',
        '4': 'Good (4-4.5): The analysis and interpretation of one clear main trend is supported by adequate details, examples, and relevant statistics. The conclusion adequately summarizes the most obvious result, refers to previous research, restates the aim, and provides solutions/general recommendations.',
        '5': 'Excellent (5): The analysis and interpretation of one clear main trend is supported by carefully chosen details and examples, including comprehensive statistics. The conclusion provides an insightful and effective summary of the most obvious result, refers to previous research, restates the aim, and provides solutions/specific recommendations.',
      }
    },
    {
      name: 'Coherence and Cohesion', maxScore: 5,
      rubric: {
        '1': 'Poor (1-1.5): Lacks coherent development of ideas, with disjointed or illogical writing which is largely confused and incoherent. Cohesive devices are missing or used inaccurately. Paragraphs lack clear organization and unity, with ideas scattered or unrelated.',
        '2': 'Unsatisfactory (2-2.5): Only basic understanding of information in the text through illogical and/or incoherent writing with limited development of ideas, and connections between concepts are unclear or inconsistent. Cohesive devices are used inaccurately and inappropriately. Paragraphs demonstrate some attempt at organization.',
        '3': 'Satisfactory (3-3.5): Generally logical and coherent writing, but may not be completely successful, possibly due to some misunderstanding of the data. Cohesive devices used may be accurate but not appropriate or too simple, over or under used, creating many abrupt or weak transitions. Paragraphs demonstrate development of ideas, but the organization is not sustained.',
        '4': 'Good (4-4.5): Sufficient depth of analysis and interpretation, but with some abrupt or weak transitions. Cohesive devices are usually used accurately and appropriately. Paragraphs exhibit clear organization and unity.',
        '5': 'Excellent (5): Seamless flow of ideas with effective transitions that guide the reader through the in-depth analysis and interpretation. An extensive range of cohesive devices is used accurately and appropriately. Paragraphs are exceptionally well-organized and unified.',
      }
    },
    {
      name: 'Grammatical Range and Accuracy', maxScore: 5,
      rubric: {
        '1': 'Poor (1-1.5): Little control of grammar, with basic faulty sentence structures. Severe grammar errors that significantly impede understanding. Numerous instances of incorrect or missing punctuation throughout the text, hindering readability and comprehension.',
        '2': 'Unsatisfactory (2-2.5): Limited control of grammar, with repetitive sentence structures. Noticeable grammar errors throughout the text, making comprehension difficult. Noticeable errors in punctuation, hindering readability and comprehension.',
        '3': 'Satisfactory (3-3.5): Adequate control of grammar, with repetitive sentence structures. Occasional errors which impede understanding. Occasional instances of incorrect or missing punctuation, but overall punctuation usage is adequate for understanding.',
        '4': 'Good (4-4.5): Proficient use of grammar, with a wide range of sentence structures with a few errors that do not impede understanding. The majority of sentences are error-free. Generally correct and appropriately-used punctuation, with only minor errors that do not significantly affect readability and comprehension.',
        '5': 'Excellent (5): Exemplary command of grammar, with a variety of sentence structures with no errors, allowing for clear and precise communication of ideas. All sentences are error-free. Punctuation is error-free and effectively used to enhance readability and comprehension.',
      }
    },
    {
      name: 'Lexical Resource', maxScore: 5,
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

// ─── Gemini Structured Output Schema ────────────────────────────────────────
// totalScore, maxScore, and percentage are NOT included — LLMs hallucinate
// arithmetic. Those are computed purely in TypeScript after the response.
// ─────────────────────────────────────────────────────────────────────────────

const ASSESSMENT_SCHEMA: Schema = {
  type: SchemaType.OBJECT,
  properties: {
    scores: {
      type: SchemaType.ARRAY,
      items: {
        type: SchemaType.OBJECT,
        properties: {
          criterionName: { type: SchemaType.STRING },
          score: { type: SchemaType.NUMBER },
          maxScore: { type: SchemaType.NUMBER },
          justification: { type: SchemaType.STRING },
          strengths: { type: SchemaType.STRING },
          mistakes: {
            type: SchemaType.ARRAY,
            items: {
              type: SchemaType.OBJECT,
              properties: {
                quote: { type: SchemaType.STRING },
                explanation: { type: SchemaType.STRING },
              },
              required: ['quote', 'explanation'],
            },
          },
          suggestions: { type: SchemaType.STRING },
        },
        required:['criterionName', 'score', 'maxScore', 'justification', 'strengths', 'mistakes', 'suggestions'],
      },
    },
    overallFeedback: { type: SchemaType.STRING },
  },
  required:['scores', 'overallFeedback'],
};

const CREDIT_HUMANIZATION = `
BAND CALIBRATION FOR CEFR A2-B1 (what each band looks like at this level):
- 4.5-5/5 (Excellent): Exceptional for A2-B1. Approaches B1+ level. Very rare.
- 4/5 (Good): Strong for A2-B1. Clear communication with minor expected errors.
- 3-3.5/5 (Satisfactory): Average for A2-B1. Meaning usually clear despite grammar/vocabulary errors. Most credit students score here.
- 2-2.5/5 (Unsatisfactory): Below expectations even for A2-B1. Frequent errors impede understanding.
- 0-1.5/5 (Poor): Incomprehensible, completely off-task, or large-scale copying. Reserve for genuine failures.

ERROR CLASSIFICATION (apply per criterion — this is critical):
1. Expected A2/B1 errors (missing articles a/an/the, wrong prepositions in/on/at, subject-verb agreement for 3rd person singular, awkward paraphrasing from sources, limited sentence variety, minor spelling) → Do NOT lower the score. These are normal developmental errors at this level.
2. Non-impeding errors (meaning still clear; repetitive vocabulary, minor punctuation, occasional awkward phrasing) → Only minor score impact if frequent.
3. Impeding errors (reader cannot understand; wrong text type; large-scale copying without paraphrasing; task fundamentally not met) → Significant score impact.
Rate each criterion based primarily on COMMUNICATION SUCCESS and IMPEDING errors, not total error count.

SPECIAL RULES:
1. Reward successful communication of ideas. Do not be overly harsh on A2/B1 grammatical/spelling errors if the overall meaning is clear.
2. For error listings: classify each error as expected, non-impeding, or impeding. Do NOT provide corrections.

SCORING FLOW (follow in this order):
Step 1 — Identify what the student communicated successfully (strengths first).
Step 2 — Determine the overall CEFR demonstrated level.
Step 3 — Score each criterion 0-5 (0.5 increments) relative to A2-B1 expectations, not B2+ standards.
Step 4 — Only deduct for errors that genuinely impede meaning or show a gap below A2 level.
`;

// ─── Prompt Builders (Lean — no JSON formatting instructions) ────────────────
// Structured Outputs (responseSchema) guarantees valid JSON.
// We only need rubrics + scoring quality instructions.

function buildCriteriaText(rubrics: any): string {
  return rubrics.criteria.map(c => {
    const rubricLevels = Object.entries(c.rubric)
      .map(([score, desc]) => `  Score ${score}: ${desc}`)
      .join('\n');
    return `${c.name} (0-${c.maxScore}):\n${rubricLevels}`;
  }).join('\n\n');
}

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
  const toleranceBelow = targetWordCount.min - 20;
  const toleranceAbove = targetWordCount.max + 20;

  const wordCountStatus = wordCount < toleranceBelow
    ? `WARNING: Word count (${wordCount}) is SIGNIFICANTLY BELOW ${targetWordCount.min}-${targetWordCount.max} (more than 20 words below minimum). This MUST lower the Task Response score.`
    : wordCount < targetWordCount.min
    ? `NOTE: Word count (${wordCount}) is slightly below ${targetWordCount.min}-${targetWordCount.max} (within 20-word tolerance). Do NOT penalize.`
    : wordCount > toleranceAbove
    ? `NOTE: Word count (${wordCount}) significantly exceeds ${targetWordCount.min}-${targetWordCount.max}. Do NOT deduct marks. Mention in feedback.`
    : wordCount > targetWordCount.max
    ? `Word count (${wordCount}) is slightly above ${targetWordCount.min}-${targetWordCount.max} (within tolerance). Do NOT deduct marks.`
    : `Word count (${wordCount}) is within ${targetWordCount.min}-${targetWordCount.max}.`;

  const sectionsText = reportSections.map(s => `=== ${s.title} ===\n${s.content}`).join('\n\n');

  return `You are an expert writing assessor for LANC2146 (Report Writing — Discussion & Conclusion) at Sultan Qaboos University. CEFR A2-B1 level.

ASSIGNMENT: ${assignmentTitle}
TARGET WORD COUNT: ${targetWordCount.min}-${targetWordCount.max} (ideal: ${targetWordCount.ideal}). Tolerance: +/-20 words.
${wordCountStatus}

PROVIDED REPORT SECTIONS:
${sectionsText}
${resultsCaption ? `\nRESULTS FIGURE CAPTION: ${resultsCaption}${resultsGraphDescription ? `\nNote: The student was expected to read the bar graph showing the results. ${resultsGraphDescription}` : ''}` : ''}

STUDENT'S DISCUSSION AND CONCLUSION:
"""
${studentText}
"""

ASSESSMENT RUBRICS:
${buildCriteriaText(rubrics)}

${CREDIT_HUMANIZATION}
SCORING INSTRUCTIONS:
1. Score each criterion 0-5 (0.5 increments). Use the FULL range — do NOT default to middle scores.
2. For each criterion: quote at least ONE exact phrase from the student text as evidence in your justification.
3. List up to 3 specific errors per criterion as { "quote": "[exact text]", "explanation": "[why wrong]" }. Do NOT provide corrections.
4. Write 1-2 specific strengths and 1-2 actionable suggestions per criterion.
5. overallFeedback (3-4 sentences): strongest/weakest criterion, Discussion analysis quality, Conclusion adequacy, one prioritized action item.
6. Do NOT calculate totalScore or percentage — those are computed automatically.`;
}

function buildFoundationPrompt(
  text: string,
  topic: string | null,
  wordCount: number,
  targetWordCount: { min: number; max: number; ideal: number; label?: string }
): string {
  const rubrics = FOUNDATION_RUBRICS;
  const toleranceBelow = targetWordCount.min - 10;
  const toleranceAbove = targetWordCount.max + 10;
  const examLabel = targetWordCount.label || 'Foundation Exam';

  const wordCountStatus = wordCount < toleranceBelow
    ? `WARNING: Word count (${wordCount}) is SIGNIFICANTLY BELOW ${targetWordCount.min}-${targetWordCount.max}. This MUST lower the Task Response score.`
    : wordCount < targetWordCount.min
    ? `NOTE: Word count (${wordCount}) is slightly below ${targetWordCount.min}-${targetWordCount.max} (within 10-word tolerance). Do NOT penalize.`
    : wordCount > toleranceAbove
    ? `NOTE: Word count (${wordCount}) significantly exceeds ${targetWordCount.min}-${targetWordCount.max}. Do NOT deduct marks. Mention in feedback.`
    : wordCount > targetWordCount.max
    ? `Word count (${wordCount}) is slightly above ${targetWordCount.min}-${targetWordCount.max} (within tolerance). Do NOT deduct marks.`
    : `Word count (${wordCount}) is within ${targetWordCount.min}-${targetWordCount.max}.`;

  return `You are an expert, encouraging writing assessor for Foundation level students at Sultan Qaboos University. CEFR A1-A2 level.

EXAM TYPE: ${examLabel}
${topic ? `Essay Topic: ${topic}` : 'No specific topic provided.'}

Student Essay:
"""
${text}
"""

TARGET WORD COUNT: ${targetWordCount.min}-${targetWordCount.max} (ideal: ${targetWordCount.ideal}). Tolerance: +/-10 words.
${wordCountStatus}

ASSESSMENT RUBRICS (FP0230 and FP0340):
${buildCriteriaText(rubrics)}

BAND CALIBRATION FOR CEFR A1-A2 (what each band looks like at this level):
- 5-6/6 (Excellent): Exceptional for A1-A2. Near-fluent grammar, rich vocabulary, perfect structure. Very rare at this level.
- 4-4.5/6 (Good): Strong for A1-A2. Clear communication with minor expected errors. This is the typical range for strong foundation students.
- 3-3.5/6 (Satisfactory): Average for A1-A2. Meaning is usually clear despite frequent grammar/vocabulary errors. Most foundation students score here.
- 2-2.5/6 (Weak): Below expectations even for A1-A2. Meaning often unclear, very limited vocabulary or severe structural issues.
- 0-1.5/6 (Very Poor): Incomprehensible or completely off-topic. Reserve for genuine failures to communicate.

ERROR CLASSIFICATION (apply per criterion — this is critical):
1. Expected A1/A2 errors (e.g., missing articles, wrong preposition, subject-verb agreement for 3rd person singular, incorrect word order in complex sentences) → Do NOT lower the score. These are normal developmental errors at this level.
2. Non-impeding errors (meaning is still clear despite the error; e.g., wrong tense form, spelling that does not obscure meaning) → Only minor score impact if the error is frequent.
3. Impeding errors (reader genuinely cannot understand the intended meaning) → Significant score impact.
Rate each criterion based primarily on COMMUNICATION SUCCESS and IMPEDING errors, not total error count.

SPECIAL RULES:
1. Deduct marks for Task Response ONLY IF the text is severely off-topic. Do not penalize minor tangents.
2. Reward successful communication of ideas. Do not be overly harsh on minor A1/A2 grammatical/spelling errors if the overall meaning is clear.

SCORING FLOW (follow in this order):
Step 1 — Identify what the student communicated successfully (strengths first).
Step 2 — Determine the overall CEFR demonstrated level from the essay.
Step 3 — Score each criterion 0-6 (0.5 increments) relative to A1-A2 expectations, not B2+ academic standards.
Step 4 — Only deduct for errors that genuinely impede meaning or show a gap below A1 level.
Step 5 — For each criterion: quote at least ONE exact phrase from the essay as evidence in your justification.
Step 6 — List up to 3 specific errors per criterion as { "quote": "[exact text]", "explanation": "[why wrong]" }. Classify each as expected, non-impeding, or impeding. Do NOT provide corrections.
Step 7 — Write 1-2 specific strengths and 1-2 actionable suggestions per criterion.
Step 8 — overallFeedback (3-4 sentences): strongest/weakest criterion, what the student communicated well, one prioritized action item.
Step 9 — For Task Response: address topic adherence and essay structure. If the word count exceeds the target, mention it but do NOT deduct marks.
Step 10 — Do NOT calculate totalScore or percentage — those are computed automatically.`;
}
function buildCreditPrompt(text: string, topic: string | null, wordCount: number): string {
  const criteria = CREDIT_CRITERIA;

  return `You are an expert writing assessor for Credit level students at Sultan Qaboos University. CEFR A2-B1 level.

${topic ? `Essay Topic: ${topic}` : 'No specific topic provided.'}

Student Essay:
"""
${text}
"""

WORD COUNT: ${wordCount} words

ASSESSMENT CRITERIA (Credit Course - LANC2160):
${criteria.map(c => `- ${c.name} (0-${c.maxScore}): ${c.description}`).join('\n')}

${CREDIT_HUMANIZATION}
SCORING INSTRUCTIONS:
1. Score each criterion 0-5 (0.5 increments). Use the FULL range — do NOT default to middle scores.
2. For each criterion: quote at least ONE exact phrase from the essay as evidence in your justification.
3. List up to 3 specific errors per criterion as { "quote": "[exact text]", "explanation": "[why wrong]" }. Do NOT provide corrections.
4. Write 1-2 specific strengths and 1-2 actionable suggestions per criterion.
5. overallFeedback (3-4 sentences): strongest/weakest criterion, one prioritized action item.
6. Do NOT calculate totalScore or percentage — those are computed automatically.`;
}

function buildSummaryPrompt(
  studentText: string,
  sourceText: string,
  sourceTitle: string,
  wordCount: number,
  targetWordCount: { min: number; max: number; ideal: number }
): string {
  const rubrics = SUMMARY_RUBRICS;
  const sourceWordCount = sourceText.trim().split(/\s+/).filter(Boolean).length;

  const wordCountStatus = wordCount < 20
    ? `WARNING: Word count (${wordCount}) is BELOW 20 words. This MUST significantly lower the Task Achievement score.`
    : wordCount < targetWordCount.min
    ? `WARNING: Word count (${wordCount}) is BELOW ${targetWordCount.min}-${targetWordCount.max}. This should lower the Task Achievement score.`
    : wordCount > targetWordCount.max
    ? `NOTE: Word count (${wordCount}) exceeds ${targetWordCount.min}-${targetWordCount.max}. Do NOT deduct marks. Mention in feedback.`
    : `Word count (${wordCount}) is within ${targetWordCount.min}-${targetWordCount.max}.`;

  return `You are an expert writing assessor for LANC2160 (Summary Writing) at Sultan Qaboos University. CEFR A2-B1 level.

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
Target summary length: ${targetWordCount.min}-${targetWordCount.max} (approximately one-third of the ${sourceWordCount}-word source text).

SUMMARY RUBRICS:
${buildCriteriaText(rubrics)}

SUMMARY RULES:
1. Capture MAIN IDEAS only. No personal opinions or new information.
2. Student must use OWN WORDS (paraphrasing). Copied phrases lower TA and LR scores.
3. Off-topic summary = Task Achievement 0. Large-scale copying = low TA and LR.

${CREDIT_HUMANIZATION}
SCORING INSTRUCTIONS:
1. Score each criterion 0-5 (0.5 increments). Use the FULL range — do NOT default to middle scores.
2. For each criterion: quote at least ONE exact phrase from the summary as evidence.
3. List up to 3 specific errors per criterion as { "quote": "[exact text]", "explanation": "[why wrong]" }. Do NOT provide corrections.
4. Write 1-2 specific strengths and 1-2 actionable suggestions per criterion.
5. overallFeedback (3-4 sentences): which main ideas were captured/missed, strongest/weakest criterion, paraphrasing quality, one prioritized action item.
6. Do NOT calculate totalScore or percentage — those are computed automatically.`;
}

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
  const tenPercentBelow = Math.round(targetWordCount.min * 0.9);
  const tenPercentAbove = Math.round(targetWordCount.max * 1.1);

  const wordCountStatus = wordCount < tenPercentBelow
    ? `WARNING: Word count is MORE THAN 10% BELOW ${targetWordCount.min}. This MUST lower the Task Achievement score.`
    : wordCount < targetWordCount.min
    ? `NOTE: Word count is below ${targetWordCount.min}-${targetWordCount.max}. Up to 10% below is acceptable.`
    : wordCount > tenPercentAbove
    ? `NOTE: Word count is MORE THAN 10% ABOVE ${targetWordCount.max}. Do NOT deduct marks. Mention in feedback.`
    : wordCount > targetWordCount.max
    ? `NOTE: Word count exceeds ${targetWordCount.min}-${targetWordCount.max}. Do NOT deduct marks.`
    : `Word count is within ${targetWordCount.min}-${targetWordCount.max}.`;

  return `You are an expert writing assessor for LANC1070 (Synthesis Essay) at Sultan Qaboos University. CEFR A2-B1 level.

ASSIGNMENT: ${assignmentTitle}
WRITING TASK: ${assignmentDescription}
TARGET WORD COUNT: ${targetWordCount.min}-${targetWordCount.max} (ideal: ${targetWordCount.ideal}). Tolerance: +/-10%.
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

SYNTHESIS RUBRICS:
${buildCriteriaText(rubrics)}

${CREDIT_HUMANIZATION}
SCORING INSTRUCTIONS:
1. Score each criterion 0-5 (0.5 increments). Use the FULL range — do NOT default to middle scores.
2. For each criterion: quote at least ONE exact phrase from the essay as evidence.
3. List up to 3 specific errors per criterion as { "quote": "[exact text]", "explanation": "[why wrong]" }. Do NOT provide corrections.
4. Write 1-2 specific strengths and 1-2 actionable suggestions per criterion.
5. overallFeedback (3-4 sentences): strongest/weakest criterion, discussion points addressed, paraphrasing quality, one prioritized action item.
6. Do NOT calculate totalScore or percentage — those are computed automatically.`;
}

function buildSynthesisPrompt(
  studentText: string,
  sources: { title: string; content: string }[],
  assignmentTitle: string,
  assignmentDescription: string,
  wordCount: number,
  targetWordCount: { min: number; max: number; ideal: number }
): string {
  const rubrics = SYNTHESIS_RUBRICS;
  const tenPercentBelow = Math.round(targetWordCount.min * 0.9);
  const tenPercentAbove = Math.round(targetWordCount.max * 1.1);

  const wordCountStatus = wordCount < tenPercentBelow
    ? `WARNING: Word count is MORE THAN 10% BELOW ${targetWordCount.min}. This MUST lower the Task Achievement score.`
    : wordCount < targetWordCount.min
    ? `NOTE: Word count is below ${targetWordCount.min}-${targetWordCount.max}. Up to 10% below is acceptable.`
    : wordCount > tenPercentAbove
    ? `NOTE: Word count is MORE THAN 10% ABOVE ${targetWordCount.max}. Do NOT deduct marks. Mention in feedback.`
    : wordCount > targetWordCount.max
    ? `NOTE: Word count exceeds ${targetWordCount.min}-${targetWordCount.max}. Do NOT deduct marks.`
    : `Word count is within ${targetWordCount.min}-${targetWordCount.max}.`;

  const sourceTextsBlock = sources.map((s, i) => {
    const wc = s.content.trim().split(/\s+/).filter(Boolean).length;
    return `SOURCE TEXT ${i + 1}: "${s.title}" (${wc} words)\n"""\n${s.content}\n"""`;
  }).join('\n\n');

  return `You are an expert writing assessor for LANC2160 (Synthesis Essay) at Sultan Qaboos University. CEFR A2-B1 level.

TASK: The student read ALL THREE source texts and wrote a 4-paragraph synthesis essay (${targetWordCount.min}-${targetWordCount.max} words).
ASSIGNMENT: ${assignmentTitle}
INSTRUCTIONS: ${assignmentDescription}

${sourceTextsBlock}

STUDENT'S SYNTHESIS ESSAY:
"""
${studentText}
"""

${wordCountStatus}

SYNTHESIS RUBRICS (LANC2160 — Two-Point Essay Writing Marking Criteria):
${buildCriteriaText(rubrics)}

SYNTHESIS RULES:
1. Synthesize ALL THREE source texts. Address "${assignmentTitle}".
2. Use OWN WORDS (paraphrasing). Copied phrases/sentences lower TA and LR.
3. Structure: exactly 4 paragraphs (intro, body 1, body 2, conclusion). Note deviations in C&C.
4. No personal opinions or new information. Off-topic = TA 0.
5. Do NOT deduct marks if word count exceeds target. If 10%+ BELOW, lower TA per rubric.

${CREDIT_HUMANIZATION}
SCORING INSTRUCTIONS:
1. Score each criterion 0-5 (0.5 increments). Use the FULL range — do NOT default to middle scores.
2. For each criterion: quote at least ONE exact phrase from the essay as evidence.
3. List up to 3 specific errors per criterion as { "quote": "[exact text]", "explanation": "[why wrong]" }. Do NOT provide corrections.
4. Write 1-2 specific strengths and 1-2 actionable suggestions per criterion.
5. overallFeedback (3-4 sentences): which sources were used (all 3?), strongest/weakest criterion, paraphrasing/copied text %, one prioritized action item.
6. Do NOT calculate totalScore or percentage — those are computed automatically.`;
}

// ─── Shared helpers ──────────────────────────────────────────────────────────

/**
 * Resolve the ordered cloud model tiers for this request.
 *
 * Default order comes from MODEL_CONFIG in `src/lib/config.ts`
 * (gemini-2.5-flash-lite → gemini-2.5-flash → gemini-2.0-flash). If the client
 * explicitly requests a model via `modelId` (chosen in Settings), that model is
 * moved to the front of the queue and the remaining tiers act as fallbacks.
 */
function resolveModelTiers(preferredModelId?: string | null): ModelId[] {
  const tiers = [...CLOUD_ASSESSMENT_TIERS];
  if (preferredModelId && ALLOWED_CLOUD_MODELS.includes(preferredModelId)) {
    const idx = tiers.indexOf(preferredModelId);
    if (idx > 0) tiers.splice(idx, 1);
    if (idx !== 0) tiers.unshift(preferredModelId);
  }
  return tiers;
}

const safetySettings = [
  { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
  { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
  { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
  { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
];

const RATE_LIMIT_RETRIES = 3;
const RATE_LIMIT_DELAYS = [5000, 15000, 30000];

/**
 * Strip markdown residue from Gemini-returned strings.
 * Coerces non-string values (arrays, objects) to strings to prevent
 * "e.replace is not a function" runtime errors.
 */
function clean(val: any): string {
  if (val == null) return '';
  let str: string;
  if (typeof val === 'string') {
    str = val;
  } else if (Array.isArray(val)) {
    str = val.map((item: any) => (typeof item === 'string' ? item : JSON.stringify(item))).join(' ');
  } else {
    str = JSON.stringify(val);
  }
  return str
    .replace(/\*\*/g, '')
    .replace(/\*(?!\*)/g, '')
    .replace(/^#+\s+/gm, '')
    .replace(/^---+$/gm, '')
    .trim();
}

/**
 * Build a clean, professional feedback string from structured fields.
 * These headers are required by parseFeedback() in scoring-utils.ts
 * to reliably identify each section.
 */
function buildFeedback(s: any): string {
  const parts: string[] = [];

  if (s.justification) parts.push(`Justification: ${s.justification}`);
  if (s.strengths) parts.push(`Strengths: ${s.strengths}`);
  if (Array.isArray(s.mistakes) && s.mistakes.length > 0) {
    const lines = s.mistakes
      .map((m: any) => m.quote ? `- "${m.quote}": ${m.explanation}` : `- ${m.explanation}`)
      .join('\n');
    parts.push(`Mistakes found:\n${lines}`);
  }
  if (s.suggestions) parts.push(`Suggestions: ${s.suggestions}`);

  return parts.length > 0 ? parts.join('\n\n') : 'No feedback provided.';
}

// ─── POST Handler ────────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  try {
    let body;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: 'Invalid request: expected JSON body.', details: 'The request body could not be parsed as JSON.' },
        { status: 400 }
      );
    }
    const { text, courseCode, topic, examType, writingType, sourceTextId, modelId, apiKey: clientApiKey } = body;

    if (!text || !text.trim()) {
      return NextResponse.json(
        { error: 'No text provided for assessment', details: 'The text field is empty or missing from the request.' },
        { status: 400 }
      );
    }

    // Accept API key from the client request body (student app) or fall back to
    // the server-side environment variable (teacher app).  The client-side key
    // takes precedence when provided, matching how the OCR route works.
    const apiKey = clientApiKey || process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: 'API key required. Please enter your Gemini API key in Settings to continue.', details: 'No API key provided via request body or GEMINI_API_KEY environment variable.' },
        { status: 500 }
      );
    }

    const wordCount = text.trim().split(/\s+/).filter(Boolean).length;

    const isFoundation = ['0230', '0340'].includes(courseCode);
    const isSummaryWriting = courseCode === 'LANC2160' && writingType === 'summary';
    const isSynthesisWriting = courseCode === 'LANC2160' && writingType === 'synthesis';
    const isLanc1070 = courseCode === 'LANC1070';
    const isLanc2146 = courseCode === 'LANC2146';

    if (courseCode === 'LANC2160' && !writingType) {
      return NextResponse.json(
        { error: 'Writing type is required for LANC2160. Please select either "Summary" or "Synthesis" before assessing.', details: 'Missing writingType parameter for LANC2160' },
        { status: 400 }
      );
    }

    if ((isLanc1070 || isLanc2146 || isSummaryWriting || isSynthesisWriting) && !sourceTextId) {
      return NextResponse.json(
        { error: 'A source text or assignment must be selected before assessment. Please go back and select one.', details: `Missing sourceTextId for course ${courseCode}` },
        { status: 400 }
      );
    }

    let activeTargetWordCount: { min: number; max: number; ideal: number; label?: string } | null = null;
    let prompt: string;
    let criteria: any[];

    if (isFoundation) {
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
      const { SUMMARY_SOURCE_TEXTS } = await import('@/lib/store');
      const sourceTextData = SUMMARY_SOURCE_TEXTS.find(s => s.id === sourceTextId);
      if (!sourceTextData) {
        return NextResponse.json(
          { error: 'Source text not found. Please select a valid source text for summary writing.', details: `No source text found for sourceTextId: ${sourceTextId}` },
          { status: 400 }
        );
      }
      activeTargetWordCount = { min: sourceTextData.targetMin, max: sourceTextData.targetMax, ideal: sourceTextData.targetIdeal, label: `Summary of "${sourceTextData.title}"` };
      prompt = buildSummaryPrompt(text, sourceTextData.originalText, sourceTextData.title, wordCount, activeTargetWordCount);
      criteria = SUMMARY_CRITERIA;
    } else if (isSynthesisWriting) {
      const { SYNTHESIS_ASSIGNMENTS } = await import('@/lib/store');
      const assignmentData = SYNTHESIS_ASSIGNMENTS.find(a => a.id === sourceTextId);
      if (!assignmentData) {
        return NextResponse.json(
          { error: 'Synthesis assignment not found. Please select a valid assignment.', details: `No synthesis assignment found for sourceTextId: ${sourceTextId}` },
          { status: 400 }
        );
      }
      activeTargetWordCount = { min: assignmentData.targetWordCount.min, max: assignmentData.targetWordCount.max, ideal: assignmentData.targetWordCount.ideal, label: `Synthesis: "${assignmentData.title}"` };
      prompt = buildSynthesisPrompt(text, assignmentData.sources.map(s => ({ title: s.title, content: s.content })), assignmentData.title, assignmentData.description, wordCount, activeTargetWordCount);
      criteria = SYNTHESIS_CRITERIA;
    } else if (isLanc2146) {
      const { LANC2146_PRACTICE_TESTS } = await import('@/lib/store');
      const practiceData = LANC2146_PRACTICE_TESTS.find(t => t.id === sourceTextId);
      if (!practiceData) {
        return NextResponse.json(
          { error: 'Report writing assignment not found. Please select a valid practice test.', details: `No LANC2146 practice test found for sourceTextId: ${sourceTextId}` },
          { status: 400 }
        );
      }
      activeTargetWordCount = { min: practiceData.targetWordCount.min, max: practiceData.targetWordCount.max, ideal: practiceData.targetWordCount.ideal, label: `Report: "${practiceData.title}"` };
      prompt = buildLanc2146Prompt(text, practiceData.reportSections.map(s => ({ title: s.title, content: s.content })), practiceData.resultsFigure?.caption || null, practiceData.resultsFigure?.graphDescription || null, practiceData.title, wordCount, activeTargetWordCount);
      criteria = LANC2146_CRITERIA;
    } else if (isLanc1070) {
      const { LANC1070_PRACTICE_TESTS } = await import('@/lib/store');
      const practiceData = LANC1070_PRACTICE_TESTS.find(t => t.id === sourceTextId);
      if (!practiceData) {
        return NextResponse.json(
          { error: 'LANC1070 practice test not found. Please select a valid practice test.', details: `No LANC1070 practice test found for sourceTextId: ${sourceTextId}` },
          { status: 400 }
        );
      }
      activeTargetWordCount = { min: practiceData.targetWordCount.min, max: practiceData.targetWordCount.max, ideal: practiceData.targetWordCount.ideal, label: `LANC1070: "${practiceData.title}"` };
      prompt = buildLanc1070Prompt(text, practiceData.sourceText.content, practiceData.sourceText.title, practiceData.title, practiceData.description, wordCount, activeTargetWordCount);
      criteria = SYNTHESIS_CRITERIA;
    } else {
      activeTargetWordCount = null;
      prompt = buildCreditPrompt(text, topic, wordCount);
      criteria = CREDIT_CRITERIA;
    }

    // ── Initialize Gemini ──────────────────────────────────────────────────
    const genAI = new GoogleGenerativeAI(apiKey);

    const systemInstruction = isSummaryWriting
      ? 'You are an expert writing assessment AI for LANC2160 (Summary Writing) at Sultan Qaboos University. CEFR A2-B1 level. Quote exact words from the student summary as evidence. Justify every score against the rubric. List specific errors with quoted text.'
      : isSynthesisWriting
      ? 'You are an expert writing assessment AI for LANC2160 (Synthesis Essay) at Sultan Qaboos University. CEFR A2-B1 level. Compare the essay against ALL THREE source texts. Quote exact words as evidence. Justify every score against the rubric. List specific errors with quoted text.'
      : isLanc1070
      ? 'You are an expert writing assessment AI for LANC1070 (Synthesis Essay) at Sultan Qaboos University. CEFR A2-B1 level. Compare the essay against the provided source text. Quote exact words as evidence. Justify every score against the rubric. List specific errors with quoted text.'
      : isLanc2146
      ? 'You are an expert writing assessment AI for LANC2146 (Report Writing) at Sultan Qaboos University. CEFR A2-B1 level. Evaluate Discussion (analysis/interpretation) and Conclusion (summary, recommendations). Quote exact words as evidence. Justify every score against the rubric. List specific errors with quoted text.'
      : isFoundation
      ? 'You are an expert, encouraging writing assessor for Foundation courses (FP0230, FP0340) at Sultan Qaboos University. CEFR A1-A2 level. Score relative to A1-A2 expectations — reward successful communication and only penalize impeding errors. Quote exact words as evidence for EVERY score.'
      : 'You are an expert writing assessment AI at Sultan Qaboos University. CEFR A2-B1 level. Quote exact words from the student essay as evidence. Justify every score against the rubric. List specific errors with quoted text.';

    // ── Generate with Structured Output + model fallback + rate-limit retry ──
    let assessment: any = null;
    let parsedOk = false;

    const MODEL_TIERS = resolveModelTiers(modelId);

    modelTierLoop: for (let modelTierIndex = 0; modelTierIndex < MODEL_TIERS.length; modelTierIndex++) {
      const modelName = MODEL_TIERS[modelTierIndex];
      const model = genAI.getGenerativeModel({
        model: modelName,
        systemInstruction,
        generationConfig: {
          responseMimeType: 'application/json',
          responseSchema: ASSESSMENT_SCHEMA,
          // Disable thinking for gemini-2.5* models to skip 3-8s reasoning overhead
          ...(modelName.startsWith('gemini-2.5') ? { thinkingConfig: { thinkingBudget: 0 } } : {}),
        },
      });

      for (let rateLimitAttempt = 0; rateLimitAttempt < RATE_LIMIT_RETRIES; rateLimitAttempt++) {
        try {
          const result = await model.generateContent({
            contents: [{ role: 'user', parts: [{ text: prompt }] }],
            generationConfig: {
              temperature: 0.1,
              maxOutputTokens: 8192,
              responseMimeType: 'application/json',
              responseSchema: ASSESSMENT_SCHEMA,
              ...(modelName.startsWith('gemini-2.5') ? { thinkingConfig: { thinkingBudget: 0 } } : {}),
            } as any,
            safetySettings,
          });

          // ── Check for blocking ──
          const promptFeedback = (result.response as any)?.promptFeedback;
          if (promptFeedback?.blockReason) {
            return NextResponse.json(
              { error: 'AI content filter blocked the submission. Please try rephrasing your essay.', details: `Prompt blocked: ${promptFeedback.blockReason}` },
              { status: 422 }
            );
          }

          const candidate = (result.response as any)?.candidates?.[0];
          const finishReason = candidate?.finishReason;

          if (finishReason === 'SAFETY' || finishReason === 'RECITATION' || finishReason === 'LANGUAGE') {
            return NextResponse.json(
              { error: 'AI content filter blocked the assessment response. Please try rephrasing.', details: `Response blocked: ${finishReason}` },
              { status: 422 }
            );
          }

          // ── Extract text (filter out thought parts) ──
          let rawText = '';
          if (candidate?.content?.parts) {
            for (const part of candidate.content.parts) {
              if (part.text && !part.thought) rawText += part.text;
            }
          }
          if (!rawText) rawText = result.response?.text?.() || '';

          if (!rawText || rawText.trim().length === 0) {
            throw new Error('AI returned an empty response.');
          }

          // Force clean markdown fences if Gemini stubbornly included them
          const cleanJsonText = rawText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();

          // ── Structured Output guarantees valid JSON — direct parse ──
          assessment = JSON.parse(cleanJsonText);

          // ── Validate structure ──
          if (assessment?.scores && Array.isArray(assessment.scores)) {
            parsedOk = true;
            break modelTierLoop; // Success! Break completely out of the outer loop
          }

          console.error('Response parsed but missing scores array. Moving to next model...');
          continue modelTierLoop; // Try the next model

        } catch (genError: any) {
          const errMsg = genError?.message || String(genError);
          const isRateLimit = errMsg.includes('429') || errMsg.includes('RESOURCE_EXHAUSTED') || errMsg.includes('quota') || (errMsg.includes('rate') && errMsg.includes('limit'));

          // If rate limited and we have retries left, wait and try again
          if (isRateLimit && rateLimitAttempt < RATE_LIMIT_RETRIES - 1) {
            const delay = RATE_LIMIT_DELAYS[rateLimitAttempt];
            console.warn(`Rate limit hit on ${modelName}, retrying in ${delay / 1000}s...`);
            await new Promise(resolve => setTimeout(resolve, delay));
            continue; // Continue inner loop
          }

          // If we are out of retries or it's a hard error, try the next model
          console.warn(`${modelName} failed (${errMsg}). Falling back to next model...`);
          continue modelTierLoop; // Continue outer loop
        }
      }
    }

    if (!parsedOk || !assessment?.scores) {
      return NextResponse.json(
        { error: 'Failed to get a valid assessment from the AI. Please try again.', details: 'All model tiers failed to return a valid response.' },
        { status: 500 }
      );
    }

    // ── Process and normalize scores (deterministic TypeScript math) ──────────

    // Ensure all criteria are assessed (pad missing ones with zeros)
    const assessedNames = assessment.scores.map((s: any) => s.criterionName);
    const missingCriteria = criteria.filter(c => !assessedNames.includes(c.name));
    if (missingCriteria.length > 0) {
      missingCriteria.forEach(c => {
        assessment.scores.push({
          criterionName: c.name,
          score: 0,
          maxScore: c.maxScore,
          justification: 'Unable to assess this criterion from the provided text.',
          strengths: 'No specific strengths identified.',
          mistakes: [],
          suggestions: 'Unable to provide suggestions.',
        });
      });
    }

    // Normalize each score
    assessment.scores.forEach((s: any) => {
      // Clamp score to [0, maxScore] rounded to nearest 0.5
      const rawScore = Number(s.score) || 0;
      const maxScore = Math.round(Number(s.maxScore) || 0);
      s.score = Math.max(0, Math.min(Math.round(rawScore * 2) / 2, maxScore));
      s.maxScore = maxScore;

      // Clean text fields (strip markdown, handle arrays/objects)
      s.justification = clean(s.justification);
      s.strengths = clean(s.strengths);
      s.suggestions = clean(s.suggestions);

      // Ensure strengths and suggestions are never empty
      if (!s.strengths) s.strengths = 'No specific strengths identified for this criterion.';
      if (!s.suggestions) s.suggestions = 'No specific suggestions for this criterion.';

      // Clean mistakes array
      if (!Array.isArray(s.mistakes) || s.mistakes.length === 0) {
        s.mistakes = [{ quote: '', explanation: 'No specific mistakes identified for this criterion.' }];
      } else {
        s.mistakes = s.mistakes.map((m: any) => {
          if (typeof m === 'string') {
            const cleaned = m.replace(/^[\-\*]\s+/, '').trim().replace(/\s*[—\-]\s*/, ': ').trim();
            return { quote: cleaned, explanation: '' };
          }
          return {
            quote: clean(typeof m.quote === 'string' ? m.quote : (m.text || '')),
            explanation: clean(typeof m.explanation === 'string' ? m.explanation : (m.reason || '')),
          };
        }).filter((m: any) => m.quote || m.explanation);
      }

      // Build feedback string locally from clean fields
      s.feedback = buildFeedback(s);
    });

    // ── Deterministic math: compute totals in TypeScript ────────────────────
    const totalScore = Math.round(
      assessment.scores.reduce((sum: number, s: any) => sum + s.score, 0) * 2
    ) / 2;
    const maxScore = assessment.scores.reduce((sum: number, s: any) => sum + s.maxScore, 0);
    const percentage = maxScore > 0 ? Math.round((totalScore / maxScore) * 100) : 0;

    // Clean overallFeedback
    let overallFeedback = clean(assessment.overallFeedback);
    if (!overallFeedback) overallFeedback = 'No overall feedback provided.';

    return NextResponse.json({
      success: true,
      assessment: {
        scores: assessment.scores,
        totalScore,
        maxScore,
        percentage,
        overallFeedback,
        wordCount,
        targetWordCount: (isFoundation || isSummaryWriting || isSynthesisWriting || isLanc1070 || isLanc2146) ? activeTargetWordCount : null,
        createdAt: new Date().toISOString(),
      }
    });
  } catch (error) {
    console.error('Assessment error:', error);
    const msg = error instanceof Error ? error.message : 'Unknown error';
    let userError = 'Failed to assess essay';
    if (msg.includes('API key not valid') || msg.includes('API_KEY_INVALID') || msg.includes('invalid API key')) {
      userError = 'Gemini API key is invalid. Please check the GEMINI_API_KEY environment variable on the server.';
    } else if (msg.includes('model not found') || msg.includes('does not exist') || msg.includes('MODEL_NOT_FOUND')) {
      userError = 'The AI model is currently unavailable. Please try again later.';
    } else if (msg.includes('quota') || msg.includes('RESOURCE_EXHAUSTED')) {
      userError = 'Gemini API quota exceeded. Please wait a few minutes and try again.';
    } else if (msg.includes('PERMISSION_DENIED') || msg.includes('forbidden')) {
      userError = 'Gemini API access denied. The API key may not have permission to use this model.';
    } else if (msg.includes('timeout') || msg.includes('TIMEOUT') || msg.includes('Function exceeded time limits') || msg.includes('504') || msg.includes('ECONNRESET') || msg.includes('socket hang up')) {
      userError = 'Assessment timed out. The AI took too long to respond. Please try again.';
    }
    return NextResponse.json({ error: userError, details: msg }, { status: 500 });
  }
}
