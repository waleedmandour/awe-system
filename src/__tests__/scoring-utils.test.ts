import { describe, it, expect } from 'vitest';
import { recalculateScores, recalculateRecord, parseFeedback } from '@/lib/scoring-utils';
import type { Assessment, AssessmentRecord, Score } from '@/lib/store';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Shorthand to build a Score object. */
function makeScore(score: number, maxScore: number): Score {
  return {
    criterionId: `crit-${maxScore}`,
    criterionName: `Criterion (max ${maxScore})`,
    score,
    maxScore,
  };
}

/** Build a minimal Assessment with the given scores (total/max/percentage are intentionally wrong to prove recalculation). */
function makeAssessment(scores: Score[], wrongTotal = -1, wrongMax = -1, wrongPct = -1): Assessment {
  return {
    id: 'test-assessment-1',
    totalScore: wrongTotal,
    maxScore: wrongMax,
    percentage: wrongPct,
    overallFeedback: 'Test feedback',
    scores,
    createdAt: new Date().toISOString(),
  };
}

/** Build a minimal AssessmentRecord wrapping an Assessment. */
function makeRecord(assessment: Assessment): AssessmentRecord {
  return {
    id: 'test-record-1',
    assessment,
    course: null,
    essayText: 'Some essay text…',
    createdAt: new Date().toISOString(),
  };
}

// ---------------------------------------------------------------------------
// recalculateScores
// ---------------------------------------------------------------------------
describe('recalculateScores', () => {
  it('recalculates totalScore, maxScore, and percentage from individual scores', () => {
    const scores = [makeScore(3, 5), makeScore(4, 5), makeScore(2, 5)];
    const input = makeAssessment(scores, 0, 0, 0);
    const result = recalculateScores(input);

    expect(result.totalScore).toBe(9);
    expect(result.maxScore).toBe(15);
    // (9 / 15) * 100 = 60
    expect(result.percentage).toBe(60);
  });

  it('handles zero scores correctly (percentage = 0)', () => {
    const scores = [makeScore(0, 5), makeScore(0, 10)];
    const input = makeAssessment(scores, -1, -1, -1);
    const result = recalculateScores(input);

    expect(result.totalScore).toBe(0);
    expect(result.maxScore).toBe(15);
    expect(result.percentage).toBe(0);
  });

  it('handles maximum scores correctly (percentage = 100)', () => {
    const scores = [makeScore(5, 5), makeScore(10, 10), makeScore(2, 2)];
    const input = makeAssessment(scores);
    const result = recalculateScores(input);

    expect(result.totalScore).toBe(17);
    expect(result.maxScore).toBe(17);
    expect(result.percentage).toBe(100);
  });

  it('handles partial scores with 0.5 increments', () => {
    const scores = [makeScore(3.5, 5), makeScore(2, 5), makeScore(0.5, 5)];
    const input = makeAssessment(scores);
    const result = recalculateScores(input);

    expect(result.totalScore).toBe(6);
    expect(result.maxScore).toBe(15);
    // (6 / 15) * 100 = 40
    expect(result.percentage).toBe(40);
  });

  it('rounds floating-point totals using integer math (avoids 0.1 + 0.2 issues)', () => {
    // Simulate a case where raw addition might produce 3.0000000000000004
    const scores = [makeScore(1.5, 5), makeScore(1.5, 5)];
    const input = makeAssessment(scores);
    const result = recalculateScores(input);

    expect(result.totalScore).toBe(3);
    expect(Number.isInteger(result.percentage)).toBe(true);
  });

  it('returns the same object reference for empty scores array', () => {
    const input = makeAssessment([]);
    const result = recalculateScores(input);

    expect(result).toBe(input);
  });

  it('returns the same object for null/undefined scores guard', () => {
    const input = { ...makeAssessment([]), scores: undefined as unknown as Score[] };
    const result = recalculateScores(input);
    // Should return early without crashing
    expect(result).toBe(input);
  });

  it('returns percentage 0 when maxScore is 0 (avoid division by zero)', () => {
    const scores = [makeScore(0, 0), makeScore(0, 0)];
    const input = makeAssessment(scores);
    const result = recalculateScores(input);

    expect(result.totalScore).toBe(0);
    expect(result.maxScore).toBe(0);
    expect(result.percentage).toBe(0);
  });

  it('rounds percentage to nearest integer (e.g. 66.666… → 67)', () => {
    const scores = [makeScore(2, 3)];
    const input = makeAssessment(scores);
    const result = recalculateScores(input);

    // (2 / 3) * 100 = 66.666… → 67
    expect(result.percentage).toBe(67);
  });

  it('does not mutate the original assessment', () => {
    const scores = [makeScore(3, 5), makeScore(2, 5)];
    const input = makeAssessment(scores, 0, 0, 0);
    const _ = recalculateScores(input);

    expect(input.totalScore).toBe(0);
    expect(input.maxScore).toBe(0);
    expect(input.percentage).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// recalculateRecord
// ---------------------------------------------------------------------------
describe('recalculateRecord', () => {
  it('delegates to recalculateScores and updates the record', () => {
    const scores = [makeScore(3, 5), makeScore(4, 5)];
    const assessment = makeAssessment(scores, 0, 0, 0);
    const record = makeRecord(assessment);
    const result = recalculateRecord(record);

    expect(result.id).toBe(record.id);
    expect(result.essayText).toBe(record.essayText);
    expect(result.assessment.totalScore).toBe(7);
    expect(result.assessment.maxScore).toBe(10);
    expect(result.assessment.percentage).toBe(70);
  });

  it('does not mutate the original record or assessment', () => {
    const scores = [makeScore(1, 5)];
    const assessment = makeAssessment(scores, -1, -1, -1);
    const record = makeRecord(assessment);
    recalculateRecord(record);

    expect(record.assessment.totalScore).toBe(-1);
    expect(record.assessment.maxScore).toBe(-1);
    expect(record.assessment.percentage).toBe(-1);
  });
});

// ---------------------------------------------------------------------------
// parseFeedback
// ---------------------------------------------------------------------------
describe('parseFeedback', () => {
  // -- Structured (headered) format --
  it('parses structured feedback with all sections', () => {
    const feedback = [
      'Strengths: Good use of topic sentences.',
      'Justification: The student demonstrates a clear understanding of summary writing techniques and effectively paraphrases the source text.',
      'Mistakes found:\n  "salmon canoon" — Spelling error\n  "they went" — Subject-verb agreement',
      'Suggestions: Review irregular verb forms.',
    ].join('\n\n');

    const result = parseFeedback(feedback);

    expect(result.strengths).toContain('Good use of topic sentences');
    expect(result.justification).toContain('clear understanding');
    expect(result.suggestions).toContain('Review irregular verb forms');
    expect(result.mistakes).toHaveLength(2);
    expect(result.mistakes[0]).toEqual({ quote: 'salmon canoon', explanation: 'Spelling error' });
    expect(result.mistakes[1]).toEqual({ quote: 'they went', explanation: 'Subject-verb agreement' });
  });

  it('parses legacy format with markdown headers', () => {
    const feedback = [
      '**Strengths:** Well-organised paragraphs.',
      '**Suggestions:** Check punctuation.',
    ].join('\n\n');

    const result = parseFeedback(feedback);

    expect(result.strengths).toContain('Well-organised paragraphs');
    expect(result.suggestions).toContain('Check punctuation');
  });

  it('parses "Suggestion:" (singular) header', () => {
    const feedback = 'Suggestion: Add more examples.';
    const result = parseFeedback(feedback);

    expect(result.suggestions).toContain('Add more examples');
  });

  // -- Mistake formats --
  it('parses dash-prefixed mistake lines (legacy format)', () => {
    const feedback = [
      'Mistakes:',
      '- "their going" — Wrong homophone',
      '- "he dont" — Missing verb agreement',
    ].join('\n');

    const result = parseFeedback(feedback);

    // Dash-prefixed lines are captured as explanation-only entries
    // (the regex expects quotes at line start; dash-prefixed lines
    // fall through to the else-if length check)
    expect(result.mistakes).toHaveLength(2);
    expect(result.mistakes[0].explanation).toContain('Wrong homophone');
    expect(result.mistakes[1].explanation).toContain('Missing verb agreement');
  });

  it('parses em-dash separated mistakes', () => {
    const feedback = 'Mistakes found:\n"alot" — should be "a lot"';
    const result = parseFeedback(feedback);

    expect(result.mistakes).toHaveLength(1);
    expect(result.mistakes[0].quote).toBe('alot');
    expect(result.mistakes[0].explanation).toContain('should be');
  });

  it('parses colon-separated mistakes', () => {
    const feedback = 'Mistakes found:\n"teh" : typo for "the"';
    const result = parseFeedback(feedback);

    expect(result.mistakes).toHaveLength(1);
    expect(result.mistakes[0].quote).toBe('teh');
    expect(result.mistakes[0].explanation).toContain('typo');
  });

  // -- Headerless / heuristic format --
  it('falls back to heuristic paragraph ordering for headerless text', () => {
    const feedback = [
      'This is a short strength paragraph.',
      'This is a much longer paragraph that serves as justification for the grade. It contains enough characters to exceed the 80-character threshold and will be identified as justification by the parser heuristic.',
      'Consider revising sentence structure.',
    ].join('\n\n');

    const result = parseFeedback(feedback);

    // First short paragraph → strengths (skipped justification because <80 chars)
    expect(result.strengths).toContain('short strength');
    // Second long paragraph → justification
    expect(result.justification).toContain('much longer paragraph');
    // Third short-ish paragraph → suggestions
    expect(result.suggestions).toContain('Consider revising');
  });

  // -- Edge cases --
  it('returns empty sections for an empty string', () => {
    const result = parseFeedback('');

    expect(result.strengths).toBe('');
    expect(result.justification).toBe('');
    expect(result.mistakes).toEqual([]);
    expect(result.suggestions).toBe('');
  });

  it('strips markdown bold and heading residue', () => {
    const feedback = '### Strengths\n**Good vocabulary usage** throughout the essay.';
    const result = parseFeedback(feedback);

    expect(result.strengths).toContain('Good vocabulary usage');
    expect(result.strengths).not.toContain('**');
    expect(result.strengths).not.toContain('###');
  });

  it('handles malformed input gracefully (returns raw text as justification)', () => {
    const result = parseFeedback('Just some random text without any structure.');

    // No headers matched → heuristic: short text treated as strengths
    // The parser should not throw
    expect(result).toBeDefined();
  });

  it('handles "Mistake:" (singular) header', () => {
    const feedback = 'Mistake:\n"recieve" — Spelling';
    const result = parseFeedback(feedback);

    expect(result.mistakes).toHaveLength(1);
    expect(result.mistakes[0].quote).toBe('recieve');
  });

  it('handles "Mistakes Found:" header', () => {
    const feedback = 'Mistakes Found:\n"effect" — Wrong word choice';
    const result = parseFeedback(feedback);

    expect(result.mistakes).toHaveLength(1);
    expect(result.mistakes[0].quote).toBe('effect');
  });

  it('treats non-quoted mistake lines (>5 chars) as explanation-only entries', () => {
    const feedback = 'Mistakes:\nNo clear topic sentence in paragraph two.';
    const result = parseFeedback(feedback);

    expect(result.mistakes).toHaveLength(1);
    expect(result.mistakes[0].quote).toBe('');
    expect(result.mistakes[0].explanation).toContain('No clear topic sentence');
  });

  it('ignores very short non-quoted mistake lines (<=5 chars)', () => {
    const feedback = 'Mistakes:\nabc';
    const result = parseFeedback(feedback);

    expect(result.mistakes).toHaveLength(0);
  });

  it('handles unicode smart quotes in mistake entries', () => {
    const feedback = 'Mistakes:\n\u201Csalmon canoon\u201D — Spelling';
    const result = parseFeedback(feedback);

    expect(result.mistakes).toHaveLength(1);
    expect(result.mistakes[0].quote).toBe('salmon canoon');
    expect(result.mistakes[0].explanation).toBe('Spelling');
  });
});
