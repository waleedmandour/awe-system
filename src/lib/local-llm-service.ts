'use client';

/**
 * ─── AWE System — Local (On-Device) LLM Assessment Service ──────────────────
 *
 * Runs essay assessment fully on-device using MediaPipe LLM Inference for Web
 * (WASM/WebGL). Essays never leave the browser, and assessment keeps working
 * offline once a model has been downloaded via `ModelDownloader`.
 *
 * Architecture note: MediaPipe tasks-genai is a WASM/WebGL runtime that only
 * executes in the browser, so local inference happens client-side instead of
 * in a serverless route. This is what makes true offline assessment possible —
 * a server API route could never work without a network connection.
 */

import type { Assessment, Score } from '@/lib/store';
import {
  MEDIAPIPE_WASM_BASE,
  getLocalModel,
} from '@/lib/config';
import { ModelDownloader } from '@/lib/model-downloader';

// ─── Rubric context (client-side mirror of the server rubrics) ───────────────

export interface LocalRubricCriterion {
  name: string;
  maxScore: number;
  description: string;
}

export interface LocalAssessmentOptions {
  courseCode?: string;
  writingType?: string;
  topic?: string | null;
  sourceTexts?: { title: string; content: string }[];
  targetWordCount?: { min: number; max: number; ideal: number; label?: string } | null;
  wordCount?: number;
  maxTokens?: number;
  temperature?: number;
}

/**
 * Criterion names and max scores mirror `src/app/api/assess/route.ts` exactly
 * so local scores remain comparable with cloud scores. If you change the
 * server rubrics, update this catalog too.
 */
const LOCAL_RUBRIC_CRITERIA: Record<string, LocalRubricCriterion[]> = {
  foundation: [
    { name: 'Task Response', maxScore: 6, description: 'How well the essay addresses the task requirements, audience, purpose, and genre.' },
    { name: 'Coherence and Cohesion', maxScore: 6, description: 'Logical organization, paragraphing, and use of linking devices.' },
    { name: 'Lexical Resource', maxScore: 6, description: 'Range and accuracy of vocabulary, including word choice and spelling.' },
    { name: 'Grammatical Range and Accuracy', maxScore: 6, description: 'Range and accuracy of grammatical structures and punctuation.' },
  ],
  summary: [
    { name: 'Task Achievement', maxScore: 5, description: "How effectively the summary captures the main points of the source text using the student's own words." },
    { name: 'Coherence & Cohesion', maxScore: 5, description: 'How logically the summary is organized and how well ideas are linked together.' },
    { name: 'Lexical Resource', maxScore: 5, description: 'The range and accuracy of vocabulary used, including paraphrasing ability.' },
    { name: 'Grammar & Accuracy', maxScore: 5, description: 'The range and accuracy of grammatical structures, sentence variety, and punctuation.' },
  ],
  synthesis: [
    { name: 'Task Achievement', maxScore: 5, description: 'How effectively the synthesis essay fulfils the task requirements, synthesizes information from all source texts, and addresses the assignment prompt.' },
    { name: 'Coherence and Cohesion', maxScore: 5, description: 'How logically the synthesis essay is organized, how well ideas are linked, and how effectively information flows.' },
    { name: 'Lexical Resource', maxScore: 5, description: 'The range and accuracy of vocabulary, including paraphrasing ability and appropriate word choice.' },
    { name: 'Grammatical Range and Accuracy', maxScore: 5, description: 'The range and accuracy of grammatical structures, sentence variety, and punctuation.' },
  ],
  lanc2146: [
    { name: 'Task Response', maxScore: 5, description: 'Analysis and interpretation of data with details/examples/statistics; quality of the discussion section; adequacy of the conclusion.' },
    { name: 'Coherence and Cohesion', maxScore: 5, description: 'Logical organization of information and ideas; use of cohesive devices; paragraphing.' },
    { name: 'Grammatical Range and Accuracy', maxScore: 5, description: 'Use of grammatical functions (cause/effect, compare/contrast, prediction, recommendation); grammar structures accuracy; punctuation.' },
    { name: 'Lexical Resource', maxScore: 5, description: 'Vocabulary range and genre-specific register; spelling, word formation, and capitalization.' },
  ],
  credit: [
    { name: 'Task Achievement', maxScore: 5, description: 'How well the essay achieves the task requirements' },
    { name: 'Coherence & Cohesion', maxScore: 5, description: 'Logical organization and linking of ideas' },
    { name: 'Lexical Resource', maxScore: 5, description: 'Range and accuracy of vocabulary' },
    { name: 'Grammatical Range & Accuracy', maxScore: 5, description: 'Range and accuracy of grammar' },
  ],
};

/** Resolve the criteria set for a course — mirrors the server-side branching. */
export function getLocalCriteria(courseCode?: string | null, writingType?: string | null): LocalRubricCriterion[] {
  const isFoundation = courseCode === '0230' || courseCode === '0340';
  if (isFoundation) return LOCAL_RUBRIC_CRITERIA.foundation;
  if (courseCode === 'LANC2160' && writingType === 'summary') return LOCAL_RUBRIC_CRITERIA.summary;
  if (courseCode === 'LANC2160' && writingType === 'synthesis') return LOCAL_RUBRIC_CRITERIA.synthesis;
  if (courseCode === 'LANC1070') return LOCAL_RUBRIC_CRITERIA.synthesis;
  if (courseCode === 'LANC2146') return LOCAL_RUBRIC_CRITERIA.lanc2146;
  return LOCAL_RUBRIC_CRITERIA.credit;
}

// ─── Prompt construction (pure & testable) ───────────────────────────────────

export function formatCriteriaForPrompt(criteria: LocalRubricCriterion[]): string {
  return criteria
    .map((c, i) => `${i + 1}. "${c.name}" (max ${c.maxScore}): ${c.description}`)
    .join('\n');
}

/**
 * Build the assessment prompt for a small on-device model. Small models need
 * an extremely explicit output contract, so the exact JSON shape is spelled
 * out and markdown/extra prose is forbidden.
 */
export function buildLocalAssessmentPrompt(essayText: string, criteria: LocalRubricCriterion[], options: LocalAssessmentOptions = {}): string {
  const criteriaBlock = formatCriteriaForPrompt(criteria);
  const wordCount = options.wordCount ?? essayText.trim().split(/\s+/).filter(Boolean).length;
  const target = options.targetWordCount;

  const sourceBlock = options.sourceTexts?.length
    ? `\nSOURCE TEXT(S) (the essay must be based on these):\n${options.sourceTexts
        .map((s) => `--- "${s.title}" ---\n${s.content}`)
        .join('\n\n')}\n`
    : '';

  const topicBlock = options.topic ? `\nWRITING PROMPT GIVEN TO THE STUDENT: ${options.topic}\n` : '';

  const wordCountBlock = target
    ? `\nWORD COUNT: The essay has ${wordCount} words. Target range: ${target.min}-${target.max} words. If it is 10%+ below the minimum, lower the Task criterion score. Do NOT deduct marks if it exceeds the target.\n`
    : '';

  return `You are an expert English writing assessor for Sultan Qaboos University. Evaluate the student's essay against EVERY criterion below. Quote exact phrases from the essay as evidence.

CRITERIA:
${criteriaBlock}
${topicBlock}${sourceBlock}${wordCountBlock}
STUDENT ESSAY:
"""
${essayText}
"""

SCORING RULES:
- Score each criterion from 0 to its maximum, in 0.5 steps. Use the full range; do not default to middle scores.
- For each criterion quote at least ONE exact phrase from the essay.
- List up to 3 specific errors as { "quote", "explanation" }. Do NOT provide corrections.
- overallFeedback must be 3-4 sentences.

Respond with ONLY valid JSON in EXACTLY this format — no markdown, no code fences, no extra text:
{"scores":[{"criterionName":"<exact criterion name>","score":<number>,"justification":"<2-3 sentences with quoted evidence>","strengths":"<1-2 specific strengths>","mistakes":[{"quote":"<exact text>","explanation":"<why it is wrong>"}],"suggestions":"<1-2 actionable suggestions>"}],"overallFeedback":"<3-4 sentences>"}`;
}

// ─── Response parsing (pure & testable) ──────────────────────────────────────

/** Round to the nearest 0.5 and clamp into [0, maxScore]. */
export function clampScore(value: number, maxScore: number): number {
  if (!Number.isFinite(value)) return 0;
  const rounded = Math.round(value * 2) / 2;
  return Math.min(maxScore, Math.max(0, rounded));
}

/**
 * Parse a local LLM response into the app's Assessment shape.
 *
 * The feedback string is assembled with the same section headers the cloud
 * route uses ("Justification:", "Strengths:", "Mistakes found:", "Suggestions:")
 * so `parseFeedback()` in scoring-utils.ts renders local results identically.
 * Totals are recomputed deterministically from the per-criterion scores.
 */
export function parseLocalAssessmentResponse(
  rawText: string,
  criteria: LocalRubricCriterion[],
  options: LocalAssessmentOptions = {}
): Assessment {
  // Strip markdown fences if the model added them despite instructions.
  let cleaned = rawText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();

  // Keep only the outermost JSON object.
  const firstBrace = cleaned.indexOf('{');
  const lastBrace = cleaned.lastIndexOf('}');
  if (firstBrace === -1 || lastBrace === -1 || lastBrace <= firstBrace) {
    throw new Error('Local model did not return valid JSON.');
  }
  cleaned = cleaned.slice(firstBrace, lastBrace + 1);

  let parsed: any;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    throw new Error('Local model response could not be parsed as JSON.');
  }

  if (!parsed || !Array.isArray(parsed.scores) || parsed.scores.length === 0) {
    throw new Error('Local model response is missing the scores array.');
  }

  const wordCount = options.wordCount ?? 0;

  // Map model scores onto the canonical criteria, padding missing ones with 0.
  const scores: Score[] = criteria.map((criterion, index) => {
    const match = parsed.scores.find(
      (s: any) => typeof s?.criterionName === 'string' && s.criterionName.trim().toLowerCase() === criterion.name.toLowerCase()
    );
    const rawScore = Number(match?.score);
    const clamped = Number.isFinite(rawScore) ? clampScore(rawScore, criterion.maxScore) : 0;

    const parts: string[] = [];
    if (match?.justification) parts.push(`Justification: ${String(match.justification)}`);
    if (match?.strengths) parts.push(`Strengths: ${String(match.strengths)}`);
    if (Array.isArray(match?.mistakes) && match.mistakes.length > 0) {
      const lines = match.mistakes
        .map((m: any) => (m?.quote ? `- "${m.quote}": ${m.explanation}` : `- ${m?.explanation ?? ''}`))
        .join('\n');
      parts.push(`Mistakes found:\n${lines}`);
    }
    if (match?.suggestions) parts.push(`Suggestions: ${String(match.suggestions)}`);

    return {
      criterionId: `local-criterion-${index}`,
      criterionName: criterion.name,
      score: clamped,
      maxScore: criterion.maxScore,
      feedback: parts.length > 0 ? parts.join('\n\n') : 'No feedback provided.',
    };
  });

  const rawTotal = scores.reduce((sum, s) => sum + s.score, 0);
  const totalScore = Math.round(rawTotal * 2) / 2;
  const maxScore = scores.reduce((sum, s) => sum + s.maxScore, 0);
  const percentage = maxScore > 0 ? Math.round((totalScore / maxScore) * 100) : 0;

  return {
    id: `local-assess-${Date.now()}`,
    totalScore,
    maxScore,
    percentage,
    overallFeedback: typeof parsed.overallFeedback === 'string' && parsed.overallFeedback.trim()
      ? parsed.overallFeedback.trim()
      : 'No overall feedback provided.',
    scores,
    wordCount,
    targetWordCount: options.targetWordCount ?? null,
    createdAt: new Date().toISOString(),
  };
}

// ─── Local LLM runtime (MediaPipe LLM Inference for Web) ─────────────────────

export class LocalLLMService {
  private inference: any = null;
  private modelBlobUrl: string | null = null;
  private modelId: string | null = null;
  private initPromise: Promise<void> | null = null;

  get isReady(): boolean {
    return this.inference !== null;
  }

  get activeModelId(): string | null {
    return this.modelId;
  }

  /**
   * Initialize a model that has already been downloaded to IndexedDB.
   * Throws with a helpful message when the model is missing.
   */
  async initializeModel(modelId: string): Promise<boolean> {
    if (this.isReady && this.modelId === modelId) return true;

    const downloader = new ModelDownloader();
    const data = await downloader.getModel(modelId);
    if (!data) {
      const known = getLocalModel(modelId);
      throw new Error(
        `Model "${known?.name ?? modelId}" is not downloaded. Open Settings → AI Model and download it first.`
      );
    }
    await this.initializeFromBuffer(modelId, data);
    return true;
  }

  /**
   * Initialize the MediaPipe runtime from raw model weights. The weights are
   * wrapped in a Blob URL because `LlmInference` fetches its `modelAssetPath`.
   */
  async initializeFromBuffer(modelId: string, data: ArrayBuffer): Promise<void> {
    // Serialize concurrent initializations — the last call wins.
    const run = async () => {
      this.disposeRuntime();

      const blob = new Blob([data], { type: 'application/octet-stream' });
      this.modelBlobUrl = URL.createObjectURL(blob);

      const genai = await import('@mediapipe/tasks-genai');
      const filesetResolver = await genai.FilesetResolver.forGenAiTasks(MEDIAPIPE_WASM_BASE);
      this.inference = await genai.LlmInference.createFromOptions(filesetResolver, {
        baseOptions: { modelAssetPath: this.modelBlobUrl },
        maxTokens: 2048,
        topK: 40,
        temperature: 0.3,
      });
      this.modelId = modelId;
    };
    this.initPromise = (this.initPromise ?? Promise.resolve()).then(run, run);
    return this.initPromise;
  }

  /** Raw text generation against the loaded local model. */
  async generateResponse(prompt: string): Promise<string> {
    if (!this.inference) {
      throw new Error('Local LLM not initialized. Call initializeModel() first.');
    }
    const response = await this.inference.generateResponse(prompt);
    return typeof response === 'string' ? response : String(response ?? '');
  }

  /**
   * Full local assessment pipeline: prompt → generation → parse.
   * Returns an Assessment indistinguishable in shape from the cloud route's.
   */
  async assessEssay(
    essayText: string,
    criteria: LocalRubricCriterion[],
    options: LocalAssessmentOptions = {}
  ): Promise<Assessment> {
    if (!this.inference) {
      throw new Error('Local LLM not initialized. Call initializeModel() first.');
    }
    const wordCount = options.wordCount ?? essayText.trim().split(/\s+/).filter(Boolean).length;
    const prompt = buildLocalAssessmentPrompt(essayText, criteria, { ...options, wordCount });
    const rawResponse = await this.generateResponse(prompt);
    return parseLocalAssessmentResponse(rawResponse, criteria, { ...options, wordCount });
  }

  /** Release WASM memory and Blob URL between assessments. */
  dispose(): void {
    this.disposeRuntime();
    this.initPromise = null;
  }

  private disposeRuntime(): void {
    try {
      this.inference?.close?.();
    } catch {
      // ignore — the runtime may already be gone (e.g. page unload)
    }
    this.inference = null;
    if (this.modelBlobUrl) {
      URL.revokeObjectURL(this.modelBlobUrl);
      this.modelBlobUrl = null;
    }
    this.modelId = null;
  }
}

// ─── One-shot convenience wrapper used by AssessmentScreen ───────────────────

/**
 * Resolve the full assessment context for the selected course: rubric
 * criteria, source texts, and word-count target. Everything is resolved from
 * the client-side catalogs in `@/lib/store`, so the local path keeps working
 * fully offline once a model has been downloaded.
 */
export function buildLocalAssessmentOptions(params: {
  courseCode?: string | null;
  writingType?: string | null;
  sourceTextId?: string | null;
  topic?: string | null;
}): { criteria: LocalRubricCriterion[]; options: LocalAssessmentOptions } {
  const { courseCode, writingType, topic } = params;

  const criteria = getLocalCriteria(courseCode, writingType);

  return {
    criteria,
    options: {
      courseCode: courseCode ?? undefined,
      writingType: writingType ?? undefined,
      topic,
    },
  };
}

/**
 * Async variant that lazily imports the (large) source-text catalogs and
 * resolves the exact source text + word target for the selected assignment.
 * Mirrors the branching in `src/app/api/assess/route.ts`.
 */
export async function resolveLocalAssessmentContext(params: {
  courseCode?: string | null;
  writingType?: string | null;
  sourceTextId?: string | null;
  topic?: string | null;
}): Promise<{ criteria: LocalRubricCriterion[]; options: LocalAssessmentOptions }> {
  const { courseCode, writingType, sourceTextId, topic } = params;
  const base = buildLocalAssessmentOptions({ courseCode, writingType, sourceTextId, topic });

  try {
    if (courseCode === 'LANC2160' && writingType === 'summary') {
      const { SUMMARY_SOURCE_TEXTS } = await import('@/lib/store');
      const src = SUMMARY_SOURCE_TEXTS.find((s) => s.id === sourceTextId);
      if (src) {
        base.options.sourceTexts = [{ title: src.title, content: src.originalText }];
        base.options.targetWordCount = { min: src.targetMin, max: src.targetMax, ideal: src.targetIdeal, label: `Summary of "${src.title}"` };
      }
    } else if (courseCode === 'LANC2160' && writingType === 'synthesis') {
      const { SYNTHESIS_ASSIGNMENTS } = await import('@/lib/store');
      const a = SYNTHESIS_ASSIGNMENTS.find((x) => x.id === sourceTextId);
      if (a) {
        base.options.sourceTexts = a.sources.map((s) => ({ title: s.title, content: s.content }));
        base.options.targetWordCount = { ...a.targetWordCount, label: `Synthesis: "${a.title}"` };
      }
    } else if (courseCode === 'LANC1070') {
      const { LANC1070_PRACTICE_TESTS } = await import('@/lib/store');
      const t = LANC1070_PRACTICE_TESTS.find((x) => x.id === sourceTextId);
      if (t) {
        base.options.sourceTexts = [{ title: t.sourceText.title, content: t.sourceText.content }];
        base.options.targetWordCount = { ...t.targetWordCount, label: `LANC1070: "${t.title}"` };
      }
    } else if (courseCode === 'LANC2146') {
      const { LANC2146_PRACTICE_TESTS } = await import('@/lib/store');
      const t = LANC2146_PRACTICE_TESTS.find((x) => x.id === sourceTextId);
      if (t) {
        base.options.sourceTexts = t.reportSections.map((s) => ({ title: s.title, content: s.content }));
        base.options.targetWordCount = { ...t.targetWordCount, label: `Report: "${t.title}"` };
      }
    }
  } catch {
    // Catalog import failed (should not happen — they are static modules).
    // Assessment continues without source texts rather than crashing.
  }

  return base;
}

// ─── Shared singleton (avoids re-initializing the WASM runtime on retries) ──

let sharedService: LocalLLMService | null = null;
let sharedServiceModelId: string | null = null;

/**
 * Return a warmed-up LocalLLMService for the given model. The first call
 * loads the weights into memory; subsequent calls with the same model reuse
 * the runtime instead of re-parsing hundreds of megabytes per retry.
 */
export async function getSharedLocalLLM(modelId: string, data: ArrayBuffer): Promise<LocalLLMService> {
  if (!sharedService || sharedServiceModelId !== modelId || !sharedService.isReady) {
    sharedService = new LocalLLMService();
    await sharedService.initializeFromBuffer(modelId, data);
    sharedServiceModelId = modelId;
  }
  return sharedService;
}
