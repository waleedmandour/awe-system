import type { Assessment, AssessmentRecord } from '@/lib/store';

/** Return type for parsed structured feedback. */
export interface ParsedFeedback {
  strengths: string;
  justification: string;
  mistakes: { quote: string; explanation: string }[];
  suggestions: string;
}

/**
 * Recalculate totalScore, maxScore, and percentage from individual criterion scores.
 * This ensures the displayed total always matches the sum of criterion scores,
 * regardless of what the AI or stored data originally returned.
 * Uses integer math to avoid floating-point precision issues with 0.5 increments.
 */
export function recalculateScores(assessment: Assessment): Assessment {
  if (!assessment?.scores || assessment.scores.length === 0) return assessment;
  const rawTotal = assessment.scores.reduce((sum, s) => sum + (s.score || 0), 0);
  const totalScore = Math.round(rawTotal * 2) / 2;
  const maxScore = assessment.scores.reduce((sum, s) => sum + (s.maxScore || 0), 0);
  const percentage = maxScore > 0 ? Math.round((totalScore / maxScore) * 100) : 0;
  return { ...assessment, totalScore, maxScore, percentage };
}

/** Apply recalculation to an assessment record (for historical data). */
export function recalculateRecord(record: AssessmentRecord): AssessmentRecord {
  return { ...record, assessment: recalculateScores(record.assessment) };
}

// Helper function to parse structured feedback
export const parseFeedback = (feedback: string): ParsedFeedback => {
  const sections: ParsedFeedback = {
    strengths: '',
    justification: '',
    mistakes: [],
    suggestions: ''
  };

  try {
    // Strip any remaining markdown residue
    const clean = (str: string) => str
      .replace(/\*\*/g, '')
      .replace(/\*(?!\*)/g, '')
      .replace(/^#+\s+/gm, '')
      .replace(/^---+$/gm, '')
      .trim();

    const cleaned = clean(feedback);

    // Split into paragraphs by double newline
    const paragraphs = cleaned.split(/\n\s*\n/).map(p => p.trim()).filter(Boolean);

    paragraphs.forEach((para) => {
      const lower = para.toLowerCase();

      // Try legacy markdown-style headers first (backwards compatibility with old records)
      if (/^strengths:/i.test(lower)) {
        sections.strengths = clean(para.replace(/^strengths:\s*/i, ''));
        return;
      }
      if (/^justification:/i.test(lower)) {
        sections.justification = clean(para.replace(/^justification:\s*/i, ''));
        return;
      }
      if (/^suggestions?:/i.test(lower)) {
        sections.suggestions = clean(para.replace(/^suggestions?:\s*/i, ''));
        return;
      }
      if (/^mistakes?\s*(found)?:/i.test(lower)) {
        const mistakeText = para.replace(/^mistakes?\s*(found)?:\s*/i, '');
        // Parse mistake lines: "quoted text": explanation  OR  - "quoted text": explanation
        const lines = mistakeText.split('\n');
        lines.forEach((line) => {
          line = line.trim();
          if (!line) return;
          // Strip leading list marker (-, *, •)
          const stripped = line.replace(/^[\-\*•]\s+/, '');
          // Match pattern: "quote" — explanation  OR  "quote": explanation
          const match = stripped.match(/^[\"'\u201C\u201D]([^\"\u201C\u201D]+)[\"'\u201C\u201D]\s*[—\-:]\s*(.+)/);
          if (match) {
            sections.mistakes.push({ quote: match[1].trim(), explanation: match[2].trim() });
          } else if (stripped.length > 5) {
            // If no quote pattern, treat the whole line as an explanation
            sections.mistakes.push({ quote: '', explanation: stripped });
          }
        });
        return;
      }

      // For new clean format: no headers, just ordered paragraphs
      // First paragraph = justification (or strengths), second = strengths (or mistakes), etc.
      // Heuristic: if paragraph is short (< 100 chars), likely a strength; if longer, likely justification
      if (!sections.justification && para.length > 80) {
        sections.justification = para;
      } else if (!sections.strengths) {
        sections.strengths = para;
      } else if (!sections.suggestions && para.length < 200) {
        sections.suggestions = para;
      }
    });

    // Also check for single-line mistake format with "- " prefix (legacy)
    if (sections.mistakes.length === 0) {
      const dashLines = cleaned.split('\n').filter(l => /^\s*[-•]\s*["\u201C\u201D]/.test(l));
      if (dashLines.length > 0) {
        dashLines.forEach((line) => {
          const match = line.replace(/^[-•]\s*/, '').match(/^[\"'\u201C\u201D]([^\"\u201C\u201D]+)[\"'\u201C\u201D]\s*[—\-:]\s*(.+)/);
          if (match) {
            sections.mistakes.push({ quote: match[1].trim(), explanation: match[2].trim() });
          }
        });
      }
    }
  } catch (e) {
    // If parsing fails, return the raw feedback as justification
    sections.justification = feedback;
  }

  return sections;
};
