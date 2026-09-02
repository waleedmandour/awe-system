import { describe, it, expect } from 'vitest';
import {
  buildLocalAssessmentPrompt,
  parseLocalAssessmentResponse,
  clampScore,
  getLocalCriteria,
  formatCriteriaForPrompt,
} from '@/lib/local-llm-service';
import {
  MODEL_CONFIG,
  CONFIG,
  CLOUD_ASSESSMENT_TIERS,
  CLOUD_OCR_TIERS,
  ALLOWED_CLOUD_MODELS,
  LOCAL_MODELS,
  getLocalModel,
} from '@/lib/config';

const FOUNDATION_CRITERIA = getLocalCriteria('0340');
const CREDIT_CRITERIA = getLocalCriteria('LANC2165');

describe('MODEL_CONFIG (cloud)', () => {
  it('uses gemini-2.5-flash-lite as the primary model', () => {
    expect(MODEL_CONFIG.current).toBe('gemini-2.5-flash-lite');
    expect(MODEL_CONFIG.fallback).toBe('gemini-2.5-flash');
  });

  it('orders tiers primary → fallback → legacy', () => {
    expect(CLOUD_ASSESSMENT_TIERS).toEqual([
      'gemini-2.5-flash-lite',
      'gemini-2.5-flash',
      'gemini-2.0-flash',
    ]);
  });

  it('provides vision-capable OCR tiers with the primary first', () => {
    expect(CLOUD_OCR_TIERS[0]).toBe(MODEL_CONFIG.current);
    expect(CLOUD_OCR_TIERS).toContain(MODEL_CONFIG.fallback);
  });

  it('documents free-tier limits for every tier model', () => {
    for (const model of CLOUD_ASSESSMENT_TIERS) {
      expect(MODEL_CONFIG.freeTierLimits[model]).toBeDefined();
      expect(MODEL_CONFIG.freeTierLimits[model].requestsPerDay).toBeGreaterThan(0);
    }
    // flash-lite should have a higher daily quota than flash
    expect(MODEL_CONFIG.freeTierLimits['gemini-2.5-flash-lite'].requestsPerDay).toBeGreaterThan(
      MODEL_CONFIG.freeTierLimits['gemini-2.5-flash'].requestsPerDay
    );
  });

  it('allows every tier model to be requested via client modelId', () => {
    for (const model of CLOUD_ASSESSMENT_TIERS) {
      expect(ALLOWED_CLOUD_MODELS).toContain(model);
    }
  });
});

describe('LOCAL_MODELS (on-device)', () => {
  it('has unique model ids', () => {
    const ids = LOCAL_MODELS.map((m) => m.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('resolves catalog entries by id', () => {
    expect(getLocalModel('gemma-3-1b')?.name).toContain('Gemma 3 1B');
    expect(getLocalModel('qwen-2.5-0.5b')?.name).toContain('Qwen 2.5 0.5B');
    expect(getLocalModel('does-not-exist')).toBeUndefined();
  });

  it('provides download URLs and sizes for every model', () => {
    for (const model of LOCAL_MODELS) {
      expect(model.downloadUrl).toMatch(/^https:\/\//);
      expect(model.size).toBeTruthy();
      expect(model.sizeBytes).toBeGreaterThan(0);
    }
  });

  it('never points at gated Hugging Face repos (they return 401 without login)', () => {
    // Google's official litert-community Gemma repos are license-gated
    // (gated: auto) and cannot be downloaded anonymously, so the catalog
    // must use ungated mirrors instead.
    const gatedRepos = ['litert-community/Gemma3-1B-IT', 'litert-community/Gemma2-2B-IT'];
    for (const model of LOCAL_MODELS) {
      const urls = [model.downloadUrl, ...(model.fallbackUrls ?? [])];
      for (const url of urls) {
        for (const repo of gatedRepos) {
          expect(url).not.toContain(`huggingface.co/${repo}/`);
        }
      }
    }
  });

  it('gives every model at least one download source and Gemma multiple mirrors', () => {
    for (const model of LOCAL_MODELS) {
      expect(model.downloadUrl.length).toBeGreaterThan(0);
    }
    expect(getLocalModel('gemma-3-1b')?.fallbackUrls?.length).toBeGreaterThanOrEqual(2);
  });

  it('keeps the default local model inside the catalog', () => {
    expect(getLocalModel(CONFIG.local.defaultModel)).toBeDefined();
  });
});

describe('getLocalCriteria', () => {
  it('uses the foundation rubric (6-point criteria) for FP courses', () => {
    expect(FOUNDATION_CRITERIA.map((c) => c.maxScore)).toEqual([6, 6, 6, 6]);
    expect(FOUNDATION_CRITERIA.map((c) => c.name)).toEqual([
      'Task Response',
      'Coherence and Cohesion',
      'Lexical Resource',
      'Grammatical Range and Accuracy',
    ]);
  });

  it('uses the summary rubric for LANC2160 summary writing', () => {
    const criteria = getLocalCriteria('LANC2160', 'summary');
    expect(criteria.map((c) => c.name)).toEqual([
      'Task Achievement',
      'Coherence & Cohesion',
      'Lexical Resource',
      'Grammar & Accuracy',
    ]);
  });

  it('uses the synthesis rubric for LANC2160 synthesis and LANC1070', () => {
    expect(getLocalCriteria('LANC2160', 'synthesis')).toEqual(getLocalCriteria('LANC1070'));
  });

  it('puts grammar before lexical resource for LANC2146', () => {
    const names = getLocalCriteria('LANC2146').map((c) => c.name);
    expect(names.indexOf('Grammatical Range and Accuracy')).toBeLessThan(names.indexOf('Lexical Resource'));
  });

  it('falls back to the credit rubric for other courses', () => {
    expect(CREDIT_CRITERIA.every((c) => c.maxScore === 5)).toBe(true);
  });
});

describe('buildLocalAssessmentPrompt', () => {
  it('includes all criteria with their max scores', () => {
    const prompt = buildLocalAssessmentPrompt('Test essay.', FOUNDATION_CRITERIA);
    for (const criterion of FOUNDATION_CRITERIA) {
      expect(prompt).toContain(criterion.name);
      expect(prompt).toContain(`max ${criterion.maxScore}`);
    }
  });

  it('includes the essay text verbatim', () => {
    const essay = 'Cats are better than dogs because they are independent.';
    const prompt = buildLocalAssessmentPrompt(essay, CREDIT_CRITERIA);
    expect(prompt).toContain(essay);
  });

  it('includes source texts and the writing prompt when provided', () => {
    const prompt = buildLocalAssessmentPrompt('My summary.', CREDIT_CRITERIA, {
      topic: 'Summarise in your own words',
      sourceTexts: [{ title: 'Salmon Cannon', content: 'Dams block migrating salmon…' }],
      targetWordCount: { min: 160, max: 220, ideal: 200 },
    });
    expect(prompt).toContain('Salmon Cannon');
    expect(prompt).toContain('Dams block migrating salmon…');
    expect(prompt).toContain('Summarise in your own words');
    expect(prompt).toContain('160-220 words');
  });

  it('forbids markdown and demands a strict JSON contract', () => {
    const prompt = buildLocalAssessmentPrompt('Essay.', CREDIT_CRITERIA);
    expect(prompt).toContain('ONLY valid JSON');
    expect(prompt).toContain('no markdown');
  });

  it('formats criteria without trailing separators', () => {
    const formatted = formatCriteriaForPrompt(CREDIT_CRITERIA);
    expect(formatted.split('\n')).toHaveLength(CREDIT_CRITERIA.length);
  });
});

describe('clampScore', () => {
  it('rounds to the nearest 0.5', () => {
    expect(clampScore(4.3, 6)).toBe(4.5);
    expect(clampScore(4.2, 6)).toBe(4);
    expect(clampScore(3.74, 6)).toBe(3.5);
    expect(clampScore(3.75, 6)).toBe(4); // JS rounds half up
  });

  it('clamps into [0, maxScore]', () => {
    expect(clampScore(10, 5)).toBe(5);
    expect(clampScore(-2, 5)).toBe(0);
  });

  it('returns 0 for non-finite values', () => {
    expect(clampScore(NaN, 5)).toBe(0);
    expect(clampScore(Infinity, 5)).toBe(0);
  });
});

describe('parseLocalAssessmentResponse', () => {
  const validResponse = JSON.stringify({
    scores: [
      {
        criterionName: 'Task Response',
        score: 4,
        justification: 'The essay "directly answers the question".',
        strengths: 'Clear position throughout.',
        mistakes: [{ quote: 'in the other hand', explanation: 'Incorrect linking phrase.' }],
        suggestions: 'Add one more example.',
      },
      { criterionName: 'Coherence and Cohesion', score: 5.5, justification: 'Well organised.' },
    ],
    overallFeedback: 'Solid work overall. Focus on linkers.',
  });

  it('maps model output onto the canonical Assessment shape', () => {
    const assessment = parseLocalAssessmentResponse(validResponse, FOUNDATION_CRITERIA, { wordCount: 120 });

    expect(assessment.scores).toHaveLength(FOUNDATION_CRITERIA.length);
    expect(assessment.scores[0]).toMatchObject({
      criterionName: 'Task Response',
      score: 4,
      maxScore: 6,
    });
    expect(assessment.scores[0].feedback).toContain('Justification:');
    expect(assessment.scores[0].feedback).toContain('Strengths:');
    expect(assessment.scores[0].feedback).toContain('Mistakes found:');
    expect(assessment.scores[0].feedback).toContain('Suggestions:');
    // Scores that the model did provide but that were not repeated verbatim
    // keep the same order as the rubric, padded with zeros.
    expect(assessment.scores[1]).toMatchObject({ criterionName: 'Coherence and Cohesion', score: 5.5 });
    expect(assessment.scores[2]).toMatchObject({ criterionName: 'Lexical Resource', score: 0 });
    expect(assessment.scores[3]).toMatchObject({ criterionName: 'Grammatical Range and Accuracy', score: 0 });
  });

  it('computes totals deterministically from criterion scores', () => {
    const assessment = parseLocalAssessmentResponse(validResponse, FOUNDATION_CRITERIA, { wordCount: 120 });
    expect(assessment.totalScore).toBe(9.5);
    expect(assessment.maxScore).toBe(24);
    expect(assessment.percentage).toBe(Math.round((9.5 / 24) * 100));
  });

  it('strips markdown fences and surrounding prose', () => {
    const fenced = '```json\n' + validResponse + '\n```';
    const assessment = parseLocalAssessmentResponse(fenced, FOUNDATION_CRITERIA, { wordCount: 10 });
    expect(assessment.scores).toHaveLength(4);
  });

  it('matches criteria case-insensitively and clamps invalid scores', () => {
    const messy = JSON.stringify({
      scores: [
        { criterionName: '  task response ', score: 99 },
        { criterionName: 'COHERENCE AND COHESION', score: -3 },
      ],
      overallFeedback: 'x',
    });
    const assessment = parseLocalAssessmentResponse(messy, FOUNDATION_CRITERIA, {});
    expect(assessment.scores[0].score).toBe(6); // clamped to max
    expect(assessment.scores[1].score).toBe(0); // clamped to min
  });

  it('keeps criteria with feedback text when feedback is missing', () => {
    const minimal = JSON.stringify({
      scores: [{ criterionName: 'Task Response', score: 3 }],
      overallFeedback: '',
    });
    const assessment = parseLocalAssessmentResponse(minimal, FOUNDATION_CRITERIA, {});
    expect(assessment.scores[0].feedback).toBe('No feedback provided.');
    expect(assessment.overallFeedback).toBe('No overall feedback provided.');
  });

  it('throws on non-JSON responses', () => {
    expect(() => parseLocalAssessmentResponse('I cannot assess this.', FOUNDATION_CRITERIA, {})).toThrow();
  });

  it('throws when the scores array is missing or empty', () => {
    const noScores = JSON.stringify({ overallFeedback: 'Nice.' });
    expect(() => parseLocalAssessmentResponse(noScores, FOUNDATION_CRITERIA, {})).toThrow(/scores array/);
    const emptyScores = JSON.stringify({ scores: [], overallFeedback: 'x' });
    expect(() => parseLocalAssessmentResponse(emptyScores, FOUNDATION_CRITERIA, {})).toThrow(/scores array/);
  });
});
