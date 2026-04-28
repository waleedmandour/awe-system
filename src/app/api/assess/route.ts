import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from '@google/generative-ai';

// IMPORTANT: Prevents Vercel from timing out the assessment process on the FREE tier
export const maxDuration = 60;

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
// Condensed from per-0.5 bands to range bands to reduce token consumption
const SUMMARY_RUBRICS = {
  criteria: [
    {
      name: 'Task Achievement',
      maxScore: 5,
      rubric: {
        '0-1': 'Poor: No summary written, completely irrelevant, or only isolated words/phrases. No main ideas captured. May be largely copied without comprehension.',
        '1.5-2': 'Unsatisfactory: Captures at most one main idea; misses most key points. May include irrelevant details or personal opinions. Paraphrasing is minimal with heavy reliance on copying.',
        '2.5': 'Below expectations: Captures most main ideas but misses one or two points. Some paraphrasing attempted but noticeable copying remains. Does not clearly distinguish main from minor ideas.',
        '3': 'Satisfactory: Captures main ideas adequately with reasonable understanding. Some paraphrasing used though some phrases may be copied. Distinction between main and minor ideas is generally clear.',
        '3.5': 'Good: Captures all or nearly all main ideas effectively. Solid understanding with consistent paraphrasing, only minor copied phrases. Supporting details appropriately selected.',
        '4-4.5': 'Very good to Excellent: Captures all main ideas clearly and accurately. Strong/excellent comprehension. Effective paraphrasing throughout with focused, cohesive summary. Minor or no irrelevant details.',
        '5': 'Outstanding: Highly accurate, comprehensive reflection of source text. Sophisticated comprehension with consistently natural paraphrasing. Reads as a well-constructed independent text.',
      }
    },
    {
      name: 'Coherence & Cohesion',
      maxScore: 5,
      rubric: {
        '0-1': 'Poor: No coherence. Random words/fragments with no logical connection or structure. No linking words used. Ideas cannot be followed.',
        '1.5-2': 'Unsatisfactory: Minimal organization — ideas listed but not connected. Very few or no linking words. Disjointed presentation requiring reader effort to follow logic.',
        '2.5': 'Below expectations: Basic organization present but inconsistent. Some simple linking words used but transitions are abrupt. Paragraph structure may be weak or absent. Generally understandable but not smooth.',
        '3': 'Satisfactory: Logical structure generally easy to follow. Simple linking words and basic transitional devices used appropriately. Ideas connected so reader can follow without significant difficulty.',
        '3.5': 'Good: Well-organized with clear logical progression. Range of linking words/transitional devices used correctly (e.g., "moreover", "as a result"). Smooth flow between ideas. Appropriate paragraph structure.',
        '4-4.5': 'Very good to Excellent: Clearly and logically organized with strong progression. Good/wide range of cohesive devices used effectively and naturally. Highly readable with smooth flow.',
        '5': 'Outstanding: Exceptionally well-organized with flawless logical flow. Cohesive devices used with mastery. Structure serves the content and enhances comprehension.',
      }
    },
    {
      name: 'Lexical Resource',
      maxScore: 5,
      rubric: {
        '0-1': 'Poor: No meaningful or extremely limited vocabulary. Insufficient to convey meaning. Word choice frequently inaccurate. Spelling errors pervasive and impede understanding.',
        '1.5-2': 'Unsatisfactory: Limited vocabulary with frequent repetition. Some paraphrasing attempted but word choice often awkward/inaccurate. Spelling errors frequent and sometimes affect communication.',
        '2.5': 'Below expectations: Vocabulary limited but generally adequate. Paraphrasing attempted with some success though word choice may be awkward. Core vocabulary correct but little range. Some spelling errors.',
        '3': 'Satisfactory: Adequate range of vocabulary for the task. Basic paraphrasing attempted and usually effective. Core vocabulary generally accurate. Spelling errors present but do not significantly affect communication.',
        '3.5': 'Good: Good range of vocabulary. Paraphrasing generally effective, expressing source ideas in own words. Some less common vocabulary attempted. Spelling generally accurate.',
        '4-4.5': 'Very good to Excellent: Varied and appropriate vocabulary. Effective, natural-sounding paraphrasing. Strong control of word choice and collocation. Spelling mostly to consistently accurate.',
        '5': 'Outstanding: Sophisticated, precise vocabulary with excellent control. Consistently natural and effective paraphrasing. Word choice enhances clarity and quality. Spelling consistently accurate.',
      }
    },
    {
      name: 'Grammar & Accuracy',
      maxScore: 5,
      rubric: {
        '0-1': 'Poor: No grammatical control. Only random words/fragments. Errors in every sentence prevent meaningful communication. Punctuation largely absent or inaccurate.',
        '1.5-2': 'Unsatisfactory: Simple sentence structures attempted but often contain errors. Limited variety in sentence structure. Common errors (articles, prepositions, tenses) occur frequently. Punctuation often incorrect.',
        '2.5': 'Below expectations: Can form simple sentences with reasonable accuracy, but complex sentences contain errors. Some variety attempted. Common errors still occur but do not always impede understanding. Basic punctuation generally correct.',
        '3': 'Satisfactory: Simple sentences accurate with some complex structures attempted. Reasonable range of grammatical structures. Errors in articles, prepositions, tenses occur but do not significantly affect meaning. Punctuation generally effective.',
        '3.5': 'Good: Good range of simple and some complex structures with reasonable accuracy. Errors typically minor and do not impede communication. Sentence variety evident. Punctuation generally accurate.',
        '4-4.5': 'Very good to Excellent: Good/strong control of grammatical structures including complex sentences. Errors infrequent/rare and minor. Sentence variety enhances quality. Punctuation accurate and effective.',
        '5': 'Outstanding: Near-native control. Wide variety of sentence structures used naturally and accurately. Errors virtually non-existent. Punctuation flawless.',
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

// Detailed rubric band descriptors for Synthesis Essay (A2-B1 level, TWO-POINT ESSAY WRITING MARKING CRITERIA)
// Condensed by merging duplicate adjacent bands to reduce token consumption
const SYNTHESIS_RUBRICS = {
  criteria: [
    {
      name: 'Task Achievement',
      maxScore: 5,
      rubric: {
        '0-1.5': 'Poor: Fails to fulfil any task requirements. 10% or more outside word count.',
        '2-2.5': 'Unsatisfactory: Does not adequately fulfil task requirements. Most details are unimportant. 10% or more outside word count.',
        '3-3.5': 'Satisfactory: Adequately fulfils task requirements. Most main ideas present. Meaning generally accurate; some unimportant details may be included. Up to 10% outside word count.',
        '4-4.5': 'Good: Fulfils all task requirements but a little more could be expected. Main ideas present. Meaning mostly accurate, most details relevant. Stays within word count.',
        '5': 'Excellent: Fulfils all task requirements and exceeds expectations. All main ideas present. Meaning accurate, all details relevant. Stays within word count.',
      }
    },
    {
      name: 'Coherence and Cohesion',
      maxScore: 5,
      rubric: {
        '0-1.5': 'Poor: Lacks organization and coherence. Text largely confused and incoherent, challenging for reader to process.',
        '2-2.5': 'Unsatisfactory: Organization and coherence limited. Some re-reading necessary. Most cohesive devices are simple, used inaccurately and mechanically.',
        '3-3.5': 'Satisfactory: Organization and coherence often adequate, but supporting ideas may be limited. Text may be stilted. Cohesive devices sometimes inaccurate, repetitive, or over/under used.',
        '4-4.5': 'Good: Organization makes text clear and easy to understand. Cohesive devices almost always used accurately and appropriately within and between sentences.',
        '5': 'Excellent: Effective organization with logical flow throughout. Good range of cohesive devices used accurately and appropriately.',
      }
    },
    {
      name: 'Lexical Resource',
      maxScore: 5,
      rubric: {
        '0-1.5': 'Poor: Paraphrasing largely absent. Poor word choice, word form, and spelling prevent communication.',
        '2-2.5': 'Unsatisfactory: Very little paraphrasing; more than 15% directly copied. Inadequate vocabulary range. Errors in word choice, word form, and spelling predominate and affect communication.',
        '3-3.5': 'Satisfactory: Generally paraphrased; some copying but less than 15%. Limited but adequate vocabulary. Errors in word choice and spelling sometimes affect communication.',
        '4-4.5': 'Good: Well paraphrased with very little copying. Good vocabulary range. Spelling mostly correct.',
        '5': 'Excellent: Completely and accurately paraphrased. Wider vocabulary range than expected for the level. Spelling accurate.',
      }
    },
    {
      name: 'Grammatical Range and Accuracy',
      maxScore: 5,
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

// ─── LANC2146 Report Writing — Discussion & Conclusion Assessment ─────────────

// Lab Report Discussion and Conclusion criteria (B1-B2 level, 0-5 per criterion)
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

// Detailed rubric band descriptors for LANC2146 Discussion & Conclusion (B1-B2 level)
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

STUDENT LEVEL: CEFR B1-B2 (Intermediate to Upper Intermediate). Feedback must use clear, academic language appropriate for B1-B2 learners. Be encouraging while maintaining appropriate academic standards for a university-level report.

ASSIGNMENT: ${assignmentTitle}

WRITING TASK: Write an appropriate Discussion and Conclusion for the report based on the provided sections.

TARGET WORD COUNT: ${targetWordCount.min}-${targetWordCount.max} words (ideal: ${targetWordCount.ideal}). A tolerance of +/-20 words is acceptable (effective range: ${toleranceBelow}-${toleranceAbove}).

${wordCountStatus}

PROVIDED REPORT SECTIONS:
${sectionsText}
${resultsCaption ? `\nRESULTS FIGURE CAPTION: ${resultsCaption}\nNote: The student was expected to read the bar graph showing the results of the experiment. The graph shows the effects of four different concentrations of PEG (5%, 10%, 15%, 20%) on the radical length of wheat seedlings, compared to a control group.` : ''}

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
  - "[exact quoted text]" — explanation of the error and how to fix it

STEP 4 — For each criterion, provide 1-2 concrete, achievable suggestions for improvement appropriate for a B1-B2 level writer.

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
        "[exact quoted text]" — Explanation of the error and how to fix it
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

// Synthesis assignments data (defined here to avoid import issues with @/lib/store in server-side route)
interface SynthesisAssignmentData {
  id: string;
  title: string;
  description: string;
  cefrLevel: string;
  expectedParagraphs: number;
  sources: {
    id: string;
    title: string;
    content: string;
  }[];
  targetWordCount: {
    min: number;
    max: number;
    ideal: number;
  };
}

const SYNTHESIS_ASSIGNMENTS: SynthesisAssignmentData[] = [
  {
    id: 'nitrates-poisoning',
    title: 'Two Common Sources of Poisoning Nitrates',
    description: 'Write a synthesis essay (4 paragraphs) based on three source texts about nitrates and their effects on human health. Synthesize information from all three sources to explain two common sources of nitrate poisoning: contaminated well water and contaminated vegetables.',
    cefrLevel: 'A2-B1',
    expectedParagraphs: 4,
    targetWordCount: {
      min: 200,
      max: 300,
      ideal: 250,
    },
    sources: [
      {
        id: 'source-1-nitrates',
        title: 'What are Nitrates?',
        content: `Nitrates (NO3) are chemical compounds made from nitrogen (N) and oxygen (O). The primary toxic effects of the inorganic nitrate ion (NO3) result from its reduction to nitrite (NO2) by microorganisms in the upper digestive tract. The gastrointestinal tract of adults can process this chemical and it naturally passes out of the body through urine, but it can cause a dangerous blood condition in children. High levels of nitrate in food or drinking water are known to be dangerous to babies in the first three months of life, and may result in the so-called "blue baby syndrome". The chemical causes the blood to carry less oxygen, and the infant may suffocate. Other symptoms of nitrite toxicity in children and adults can include difficulty in breathing, dizziness, headaches, nausea, and vomiting. In older children and adults, there is also a risk of cancer because nitrites are unstable and can combine readily with other compound to form nitrosamines, which can cause cancer.`,
      },
      {
        id: 'source-2-well-water',
        title: 'Well Water May Be a Common Source of Nitrate Poisoning',
        content: `A recent study in the U.S. has said that families using water from wells in agricultural areas should have their water tested regularly to check nitrate levels. The U.S. Safe Drinking Water Act of 1974 established that the maximum safe concentration of nitrates in drinking water is 10 mg/l. Yet some wells tested during the study showed levels that were considerably above that limit. Nitrites can build up in groundwater as a result of the excessive use on farms of nitrogen-based fertilizers such as potassium nitrate and ammonium nitrate. These chemicals often seep into well water and accumulate there. If wells are found to have nitrate levels that are above the safe limit, it is not advisable to use that water for drinking.`,
      },
      {
        id: 'source-3-vegetables',
        title: 'Increased Nitrate Levels Found in Vegetables',
        content: `Nitrates are the main form in which the essential plant nutrient, nitrogen, is absorbed naturally by plants from the soil. When fertilizers are added to the soil, the plants can use the nitrates directly and this increases plant growth. Most of the excess nitrates in the environment originate from the chemical fertilizers that are manufactured for agriculture. Unfortunately, in their search for greater profits, farmers often overuse nitrate-based chemical fertilizers to improve crop yields. Vegetables become contaminated with nitrates when crops take up more than they can use for growth. As a consequence, nitrate levels in carrots, lettuce, and spinach, for example, have roughly doubled since the 1970s in the US.`,
      },
    ],
  },
  {
    id: 'co2-automobile-ac',
    title: 'Two Advantages of CO2 for Automobile Air Conditioning Systems',
    description: 'Write a synthesis essay (4 paragraphs) based on three source texts about CO2 as a refrigerant for automobile air conditioning systems. Synthesize information from all three sources to explain two advantages of CO2 for automobile air conditioning systems.',
    cefrLevel: 'A2-B1',
    expectedParagraphs: 4,
    targetWordCount: {
      min: 200,
      max: 300,
      ideal: 250,
    },
    sources: [
      {
        id: 'source-1-co2-cool-wars',
        title: 'The Cool Wars',
        content: `Mechanical refrigeration systems were developed in the late 19th and early 20th centuries. These systems were based on the compression and evaporation of gases. The primary refrigerants (gases used in cooling systems) were ammonia (NH3), sulfur dioxide (SO2) and chloromethane (Ch3Cl). These worked relatively well, but were not suitable for home use because they are toxic.
In the late 1920s, Thomas Midgley developed chlorofluorocarbons (CFCs), which the DuPont Chemical Company marketed as Freon, for use as refrigerants. These compounds of carbon, chlorine and fluorine have many useful properties. They are non-toxic, non-flammable, non-reactive, inexpensive, and efficient as refrigerants. From the 1930s, CFCs were produced in huge quantities for use in refrigeration. Soon, CFCs were used in other applications, such as air conditioning (AC) systems, fire extinguishers and spray cans.
However, in the early 1970s, scientists noticed that CFCs can reach the upper atmosphere. There, the molecules are broken apart by ultraviolet light from the sun, which results in a chemical reaction that breaks down the ozone molecule. Ozone in the upper atmosphere is important because it absorbs some of the ultraviolet radiation coming from the sun. When the ozone decreases, more ultraviolet radiation reaches the earth. Too much ultraviolet radiation can cause increased skin cancer and eye damage in humans.
Governments from around the world met in the 1980s and adopted the Montreal Protocol. This was an agreement to stop the production and use of CFCs and other compounds that damage the ozone layer.
It has not been easy to find a good replacement refrigerant that does not damage the ozone layer and does not contribute to global warming. The necessary properties for a suitable replacement gas include the following: low Ozone Depletion Potential (ODP), low Global Warming Potential (GWP), non-toxic, non-flammable, efficient refrigerant, inexpensive and easy to produce.
Just as in the 19th century electrical Current Wars, we now have the Cool Wars. The race is on to produce refrigeration and air conditioning systems that do not endanger the ozone layer and do not contribute to global warming. Currently, the two strongest choices for a new refrigerant gas are CO2 and HFO-1234yf (C3H2F4). The winners of the Cool Wars will make billions of dollars.

Refrigerant | History | ODP | GWP
CFC-12 | Most commonly used refrigerant before Montreal Protocol | 1 | 10,890
HFC-134a | First generation replacement for CFC-12 | 0 | 1300
CO2 | Possible non-hydrocarbon replacement for HFC-134a | 0 | 1
HFO-1234yf | Possible hydrocarbon-based replacement for HFC-134a | 0 | 4

NOTE: This chart compares the effect of each refrigerant on the ozone and on global warming. For example, one molecule of CFC-12 has 10,890 times more effect on Global Warming than one molecule of CO2.`,
      },
      {
        id: 'source-2-co2-safety',
        title: 'The Safety of Refrigerants Used in Automobile Air Conditioning Systems',
        content: `One of the main concerns for automobile engineers and government regulators is passenger safety. The main safety concerns about car AC refrigerants are flammability and toxicity.
While carbon dioxide is non-flammable, many other gases which could be used as refrigerants ignite under certain conditions. For example, butane and propane, which are commonly used as fuel in domestic gas cookers, have properties that would make them efficient gases for use in refrigeration systems. They are, however, both explosive and toxic, so governments have banned their use in automobile air conditioners.
The new DuPont compound HFO-1234yf is flammable. However, DuPont says it is only slightly flammable and does not ignite at most temperatures that could be encountered. Independent tests have shown that in case of a front-end accident, air conditioning systems using HFO-1234yf would significantly increase the risk of fire. Additional safety measures would thus be necessary to reduce this risk. This would have a negative impact on the system's efficiency, while increasing its costs at the same time.
Carbon dioxide also can have harmful effects on the human body if inhaled in sufficient quantities. If the concentration of CO2 reaches 3%, a person's respiration rate will increase by 100%. People with heart conditions could be at risk. This has been a concern to engineers and governments. However, the total amount of CO2 in a car AC system is very small (less than 500 grams). This is not enough to harm a person, even if the total amount was released at one time, and tests have shown that a leak of gas from a CO2 car AC system would probably not be very large.
Information about the toxicity of HFO-1234yf is not known. Two years after the introduction of this compound, the DuPont company has not released the results of their toxicity tests.`,
      },
      {
        id: 'source-3-co2-cost',
        title: 'How Much Will it Cost?',
        content: `The Cool Wars may, in the end, be won or lost over the issue of cost. Different participants in the competition have different cost concerns. The chemical industry, led by DuPont, wants to produce and sell a new synthetic refrigerant for many years to come. The automotive industry does not want the increased costs of developing and manufacturing new AC systems. On the other hand, many companies want to develop a new technology that they will be able to produce and sell in the future. Consumers do not want to spend extra money when buying a new car, and they also want to have lower costs over the life of their vehicle. Finally, governments do not want to pay for the costs that could result from the effects of global warming. Below is a chart that summarizes some of the costs involved:

Refrigerant | Production cost (OMR/ton) | Extra cost for new system design | AC system service cost | Lifetime energy use of AC equipped car (varies depending on climate)
HFC-134a | 2.5 | None; currently exists | High recharge cost; expensive special equipment needed to collect and recycle refrigerant at the end of system service life | —
CO2 | 0.25 | About 10 rials per car; high pressure system components must be designed and produced | Low recharge cost; expensive special equipment needed to deal with the very high pressures needed for CO2 to function as an effective refrigerant | More fuel efficient than HFC-134a systems; thus lower fuel consumption for the vehicle
HFO-1234yf | 25 | None; uses existing HFC-134a systems | Very high recharge cost; expensive special equipment needed to collect and recycle refrigerant at the end of system service life | AC system 10-15% lower than HFC-134a systems; thus increased overall fuel use for the vehicle`,
      },
    ],
  },
];

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
    const wordCountOfSource = s.content.trim().split(/\s+/).filter(Boolean).length;
    return `SOURCE TEXT ${i + 1}:
Title: "${s.title}" (${wordCountOfSource} words)
"""
${s.content}
"""`;
  }).join('\n\n');

  return `You are an expert writing assessor evaluating a Credit level student's synthesis essay for Sultan Qaboos University's Center for Preparatory Studies, course LANC2160 (Academic English: Summary Writing & Synthesis Essay).

STUDENT LEVEL: CEFR A2-B1 (Elementary to Pre-Intermediate). Feedback must use simple, clear language that A2-B1 learners can understand. Be encouraging while maintaining appropriate academic standards. Avoid overly technical linguistic terminology.

TASK: The student was asked to read ALL THREE source texts below and write a 4-paragraph synthesis essay (${targetWordCount.min}-${targetWordCount.max} words) based on the assignment below.

ASSIGNMENT: ${assignmentTitle}
INSTRUCTIONS: ${assignmentDescription}

${sourceTextsBlock}

STUDENT'S SYNTHESIS ESSAY:
"""
${studentText}
"""

${wordCountStatus}
Target essay length: ${targetWordCount.min}-${targetWordCount.max} words (ideal: ${targetWordCount.ideal} words).

SYNTHESIS ESSAY ASSESSMENT RUBRICS (LANC2160 — Two-Point Essay Writing Marking Criteria):

${criteriaDetails}

SYNTHESIS-SPECIFIC ASSESSMENT RULES:
1. A synthesis essay must combine information from ALL THREE source texts — not just one or two. The student should demonstrate the ability to integrate ideas from multiple sources into a coherent whole.
2. The essay must address the specific assignment prompt: "${assignmentTitle}". The essay should cover the key points required by the prompt, drawing evidence from all three sources.
3. The essay should be exactly 4 paragraphs in structure (typically: introduction, body paragraph 1, body paragraph 2, and conclusion). If the student has written significantly more or fewer paragraphs, note this in the Coherence and Cohesion assessment.
4. The student MUST use their OWN WORDS (paraphrasing). Direct copying of phrases or sentences from the source texts without paraphrasing is NOT acceptable and must lower the Task Achievement and Lexical Resource scores. Estimate the percentage of directly copied text.
5. A synthesis essay should NOT include the student's personal opinions, arguments, or new information not present in the source texts.
6. If the essay is off-topic (not addressing the assignment prompt), give Task Achievement = 0.
7. If the student has simply copied large portions of any source text, this is NOT an acceptable synthesis — it should score low on Task Achievement and Lexical Resource regardless of how "accurate" the text is.
8. Check word count: if the word count is 10% or more above or below the target range, this MUST lower the Task Achievement score according to the rubric bands.

============================================================
SCORING AND FEEDBACK INSTRUCTIONS (CRITICAL — FOLLOW EXACTLY):
============================================================

STEP 1 — SCORE each criterion using WHOLE or HALF numbers (0, 0.5, 1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, or 5). Use 0.5 increments only — never use 0.25 or 0.75. If the essay's quality falls between two adjacent score bands, award a half-point (e.g., 3.5).

STEP 2 — For EACH criterion, write a "Justification" paragraph that:
  (a) Explicitly names the score band you chose (e.g. "Score 3.5 — between Satisfactory and Good")
  (b) Quotes at least ONE specific phrase or sentence from the student's essay as evidence
  (c) Explains why the essay fits that band descriptor — connect the evidence to the rubric
  (d) If you awarded a half-point, explain which aspects place it in the lower band and which aspects place it in the higher band
  (e) For Task Achievement: specifically address whether the student synthesized ALL THREE sources, addressed the assignment prompt requirements, stayed within word count, and used own words
  (f) If the score is below 3, clearly state what is missing compared to a higher score
  (g) If the score is 4 or 5, explain what the student did beyond basic expectations

STEP 3 — For each criterion, list SPECIFIC errors found in the text. Format each as:
  - "[exact quoted text]" — explanation of the error and how to fix it

STEP 4 — For each criterion, provide 1-2 concrete, achievable suggestions for improvement appropriate for an A2-B1 learner. For example: "Try using linking words like 'Furthermore' or 'In addition' to connect your ideas."

STEP 5 — overallFeedback must be a comprehensive summary (4-6 sentences) that:
  - Identifies which sources the student used and whether all three were synthesized
  - Highlights the student's strongest criterion and what they did well
  - Identifies the weakest area needing the most attention
  - Comments on the paraphrasing quality (own words vs. copied text) and estimated copying percentage
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
      "justification": "Score 3.5 — between Satisfactory and Good. The essay synthesizes information from all three sources, addressing the assignment prompt. For example, the student writes: \\"[exact quote]\\" which shows [specific rubric alignment]. The student paraphrased in most places. Word count is within the acceptable range.",
      "strengths": "The student successfully integrates information from all three source texts and addresses the assignment prompt requirements.",
      "mistakes": [
        "[exact quoted text]" — Explanation of the error and how to fix it
      ],
      "suggestions": "Try to ensure ALL main ideas from each source are represented. Remember to use your own words throughout."
    },
    {
      "criterionName": "Coherence and Cohesion",
      "score": 3,
      "maxScore": 5,
      "justification": "Score 3 — Satisfactory. [explanation with quoted evidence]",
      "strengths": "[specific strengths]",
      "mistakes": ["[exact quoted text]" — explanation],
      "suggestions": "[1-2 improvement suggestions]"
    },
    {
      "criterionName": "Lexical Resource",
      "score": 3,
      "maxScore": 5,
      "justification": "Score 3 — Satisfactory. [explanation with quoted evidence]",
      "strengths": "[specific strengths]",
      "mistakes": ["[exact quoted text]" — explanation],
      "suggestions": "[1-2 improvement suggestions]"
    },
    {
      "criterionName": "Grammatical Range and Accuracy",
      "score": 3.5,
      "maxScore": 5,
      "justification": "Score 3.5 — between Satisfactory and Good. [explanation with quoted evidence]",
      "strengths": "[specific strengths]",
      "mistakes": ["[exact quoted text]" — explanation],
      "suggestions": "[1-2 improvement suggestions]"
    }
  ],
  "totalScore": 13,
  "maxScore": ${totalMaxScore},
  "percentage": 65,
  "overallFeedback": "Your synthesis essay draws on [X of 3] source texts to address [key points from the assignment prompt]. Your strongest area is [criterion] where you [specific strength]. The area that needs the most improvement is [criterion] because [reason]. [Comment on paraphrasing/copied text percentage]. Focus on [one prioritized action] to improve your next essay."
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
    const isSynthesisWriting = courseCode === 'LANC2160' && writingType === 'synthesis';
    const isLanc2146 = courseCode === 'LANC2146';

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
    } else if (isSynthesisWriting) {
      // Synthesis Essay for LANC2160 — look up assignment by sourceTextId
      const assignmentData = SYNTHESIS_ASSIGNMENTS.find(a => a.id === sourceTextId);
      
      if (!assignmentData) {
        return NextResponse.json(
          { error: 'Synthesis assignment not found. Please select a valid assignment for synthesis essay writing.' },
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
          { error: 'Report writing assignment not found. Please select a valid practice test.' },
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
        practiceData.title,
        wordCount,
        activeTargetWordCount
      );
      criteria = LANC2146_CRITERIA;
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
      : isLanc2146
      ? 'You are an expert writing assessment AI for the Credit level course LANC2146 (Report Writing) at Sultan Qaboos University. For lab report Discussion and Conclusion tasks, students are at CEFR B1-B2 level. Your feedback must use clear, academic language appropriate for this proficiency level. CRITICAL: You MUST (1) evaluate the Discussion section for analysis and interpretation of data with details/examples/statistics, (2) evaluate the Conclusion for summary of results, reference to previous research, restatement of aim, and recommendations, (3) quote exact words from the student text as evidence, (4) explicitly justify why the score matches the rubric band, (5) list specific errors with quoted text, (6) check word count against the 350-450 word target range with a +/-20 word tolerance (effective acceptable range: 330-470), and (7) give actionable suggestions. You respond only with valid JSON. No markdown formatting or code blocks.'
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

    // Retry configuration for rate-limit errors (429 / RESOURCE_EXHAUSTED)
    const RATE_LIMIT_RETRIES = 3;
    const RATE_LIMIT_DELAYS = [5000, 15000, 30000]; // 5s, 15s, 30s

    // Try generation with increasing token limits on truncation
    let responseText = '';
    let parsedOk = false;
    const tokenLimits = [8192, 16384, 32768];

    for (const maxTokens of tokenLimits) {
      // Inner retry loop for rate-limit (429) errors
      for (let rateLimitAttempt = 0; rateLimitAttempt < RATE_LIMIT_RETRIES; rateLimitAttempt++) {
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
    assessment.targetWordCount = (isFoundation || isSummaryWriting || isSynthesisWriting || isLanc2146) ? activeTargetWordCount : null;

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
