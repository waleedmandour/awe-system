import { NextRequest, NextResponse } from 'next/server';
import PDFDocument from 'pdfkit';

// Prevent Vercel/serverless from timing out the PDF generation
export const maxDuration = 60;

// Color constants
const PRIMARY_GREEN = '#1a5f2a';
const SECONDARY_GREEN = '#2a7f3a';
const GOLD = '#c9a227';
const LIGHT_GRAY = '#f5f5f5';
const DARK_GRAY = '#333333';

// Layout constants — fixed margins so doc.x drift never causes issues
const LEFT = 50;
const RIGHT = 50;
const PAGE_WIDTH_A4 = 595.28;
const CONTENT_WIDTH = PAGE_WIDTH_A4 - LEFT - RIGHT;

function getScoreLabel(percentage: number): string {
  if (percentage >= 80) return 'Excellent';
  if (percentage >= 60) return 'Good';
  if (percentage >= 40) return 'Satisfactory';
  return 'Needs Improvement';
}

function getScoreColor(percentage: number): string {
  if (percentage >= 80) return PRIMARY_GREEN;
  if (percentage >= 60) return GOLD;
  if (percentage >= 40) return '#f97316';
  return '#ef4444';
}

/** Render text safely — pdfkit handles newlines internally */
function safeText(doc: PDFDocument, text: string, x: number, y: number, options: any = {}) {
  doc.text(text, x, y, { width: options.width || CONTENT_WIDTH, lineGap: options.lineGap || 3, ...options });
}

/** Move the cursor to an absolute position, ignoring any drift from previous text() calls */
function moveCursor(doc: PDFDocument, x: number, y: number) {
  doc.x = x;
  doc.y = y;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { assessment, course, essayText } = body;

    if (!assessment) {
      return NextResponse.json(
        { error: 'No assessment data provided' },
        { status: 400 }
      );
    }

    const scores: any[] = assessment.scores || [];

    // Recalculate total from individual criterion scores to ensure consistency
    const totalScore = scores.reduce((sum: number, s: any) => sum + (s.score || 0), 0);
    const maxScore = scores.reduce((sum: number, s: any) => sum + (s.maxScore || 0), 0);
    const percentage = maxScore > 0 ? Math.round((totalScore / maxScore) * 100) : 0;
    const overallFeedback = assessment.overallFeedback || '';
    const wordCount = assessment.wordCount || 0;
    const courseName = course?.name || 'Unknown Course';
    const courseCode = course?.code || 'N/A';

    // ── Collect PDF bytes directly from doc events (no PassThrough needed) ──
    const buffers: Buffer[] = [];

    const doc = new PDFDocument({
      size: 'A4',
      margins: { top: 60, bottom: 60, left: LEFT, right: RIGHT },
      info: {
        Title: `AWE Assessment Report - ${courseCode}`,
        Author: 'AWE System - Sultan Qaboos University',
        Subject: 'Essay Assessment Report',
      },
    });

    // We register event listeners BEFORE calling doc.end()
    const pdfBytes = await new Promise<Buffer>((resolve, reject) => {
      doc.on('data', (chunk: Buffer) => buffers.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(buffers)));
      doc.on('error', reject);

      // ──────────────────── HEADER ────────────────────
      moveCursor(doc, LEFT, 60);

      doc.fontSize(22).fillColor(PRIMARY_GREEN)
        .text('Automated Writing Evaluation', LEFT, doc.y, { width: CONTENT_WIDTH, align: 'center' });

      doc.fontSize(13).fillColor(DARK_GRAY)
        .text('Assessment Report', LEFT, doc.y, { width: CONTENT_WIDTH, align: 'center' });

      doc.moveDown(0.5);

      // Course info
      doc.fontSize(10).fillColor(DARK_GRAY);
      doc.text(`Course: ${courseName} (${courseCode})`, LEFT, doc.y, { width: CONTENT_WIDTH });
      doc.text(`Date: ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}`, LEFT, doc.y, { width: CONTENT_WIDTH });
      if (wordCount) doc.text(`Word Count: ${wordCount} words`, LEFT, doc.y, { width: CONTENT_WIDTH });

      doc.moveDown(0.8);

      // Divider line
      doc.moveTo(LEFT, doc.y).lineTo(LEFT + CONTENT_WIDTH, doc.y)
        .strokeColor(PRIMARY_GREEN).lineWidth(2).stroke();

      doc.moveDown(0.8);

      // ──────────────────── SCORE SUMMARY ────────────────────
      doc.fontSize(15).fillColor(PRIMARY_GREEN)
        .text('Score Summary', LEFT, doc.y, { width: CONTENT_WIDTH });
      doc.moveDown(0.4);

      // Score summary box — all positions are absolute from LEFT
      const boxY = doc.y;
      const boxHeight = 55;
      doc.roundedRect(LEFT, boxY, CONTENT_WIDTH, boxHeight, 5)
        .fillAndStroke(LIGHT_GRAY, '#dddddd');

      // Total Score (column 1)
      doc.fillColor(PRIMARY_GREEN).fontSize(18)
        .text(`${totalScore}/${maxScore}`, LEFT + 30, boxY + 16, { width: 120, align: 'center' });
      doc.fontSize(9).fillColor('#666666')
        .text('Total Score', LEFT + 30, boxY + 38, { width: 120, align: 'center' });

      // Vertical separator 1
      doc.moveTo(LEFT + 160, boxY + 10).lineTo(LEFT + 160, boxY + boxHeight - 10)
        .strokeColor('#cccccc').lineWidth(1).stroke();

      // Percentage (column 2)
      doc.fillColor(PRIMARY_GREEN).fontSize(18)
        .text(`${percentage}%`, LEFT + 170, boxY + 16, { width: 120, align: 'center' });
      doc.fontSize(9).fillColor('#666666')
        .text('Percentage', LEFT + 170, boxY + 38, { width: 120, align: 'center' });

      // Vertical separator 2
      doc.moveTo(LEFT + 300, boxY + 10).lineTo(LEFT + 300, boxY + boxHeight - 10)
        .strokeColor('#cccccc').lineWidth(1).stroke();

      // Performance label (column 3)
      const label = getScoreLabel(percentage);
      const labelColor = getScoreColor(percentage);
      doc.fillColor(labelColor).fontSize(14)
        .text(label, LEFT + 310, boxY + 20, { width: 130, align: 'center' });
      doc.fontSize(9).fillColor('#666666')
        .text('Performance', LEFT + 310, boxY + 38, { width: 130, align: 'center' });

      // Reset cursor below the box
      moveCursor(doc, LEFT, boxY + boxHeight + 15);

      // ──────────────────── CRITERIA BREAKDOWN ────────────────────
      doc.fontSize(15).fillColor(PRIMARY_GREEN)
        .text('Detailed Criteria Assessment', LEFT, doc.y, { width: CONTENT_WIDTH });
      doc.moveDown(0.4);

      for (let i = 0; i < scores.length; i++) {
        const score = scores[i];
        const cName = score.criterionName || `Criterion ${i + 1}`;
        const cScore = score.score || 0;
        const cMax = score.maxScore || 6;
        const cPct = cMax > 0 ? Math.round((cScore / cMax) * 100) : 0;
        const cColor = getScoreColor(cPct);

        // Check if we need a new page (leave room for header + some content)
        if (doc.y > 600) {
          doc.addPage();
          moveCursor(doc, LEFT, 60);
        }

        // Criterion header
        doc.fontSize(12).fillColor(cColor);
        safeText(doc, `${cName}  (${cScore}/${cMax} — ${cPct}%)`, LEFT, doc.y, { width: CONTENT_WIDTH });
        doc.moveDown(0.2);

        // Progress bar
        const barWidth = CONTENT_WIDTH;
        const filledWidth = barWidth * (cPct / 100);
        doc.roundedRect(LEFT, doc.y, barWidth, 6, 3).fillAndStroke('#eeeeee', '#eeeeee');
        if (filledWidth > 0) {
          doc.roundedRect(LEFT, doc.y, Math.max(filledWidth, 6), 6, 3).fill(cColor);
        }
        doc.y += 12;
        doc.moveDown(0.3);

        // Feedback — render the structured feedback string
        const feedback = score.feedback || 'No feedback provided.';
        doc.fontSize(9).fillColor(DARK_GRAY);
        safeText(doc, feedback, LEFT, doc.y, { width: CONTENT_WIDTH, lineGap: 2 });
        doc.moveDown(0.5);
      }

      // ──────────────────── OVERALL FEEDBACK ────────────────────
      if (doc.y > 550) {
        doc.addPage();
        moveCursor(doc, LEFT, 60);
      }

      doc.moveDown(0.3);
      doc.moveTo(LEFT, doc.y).lineTo(LEFT + CONTENT_WIDTH, doc.y)
        .strokeColor(GOLD).lineWidth(1).stroke();
      doc.moveDown(0.5);

      doc.fontSize(15).fillColor(PRIMARY_GREEN)
        .text('Overall Feedback', LEFT, doc.y, { width: CONTENT_WIDTH });
      doc.moveDown(0.3);

      doc.fontSize(10).fillColor(DARK_GRAY);
      safeText(doc, overallFeedback, LEFT, doc.y, { width: CONTENT_WIDTH, lineGap: 3 });

      // ──────────────────── ESSAY TEXT ────────────────────
      if (essayText && essayText.trim()) {
        if (doc.y > 500) {
          doc.addPage();
          moveCursor(doc, LEFT, 60);
        }

        doc.moveDown(0.5);
        doc.moveTo(LEFT, doc.y).lineTo(LEFT + CONTENT_WIDTH, doc.y)
          .strokeColor(GOLD).lineWidth(1).stroke();
        doc.moveDown(0.5);

        doc.fontSize(15).fillColor(PRIMARY_GREEN)
          .text('Submitted Essay', LEFT, doc.y, { width: CONTENT_WIDTH });
        doc.moveDown(0.3);

        doc.fontSize(9).fillColor('#666666');
        const essayWordCount = essayText.trim().split(/\s+/).filter(w => w.length > 0).length;
        doc.text(`Word Count: ${essayWordCount} words`, LEFT, doc.y, { width: CONTENT_WIDTH });
        doc.moveDown(0.3);

        const displayText = essayText.length > 3000 ? essayText.substring(0, 3000) + '...' : essayText;
        doc.fontSize(9).fillColor(DARK_GRAY);
        safeText(doc, displayText, LEFT, doc.y, { width: CONTENT_WIDTH, lineGap: 2 });
      }

      // ──────────────────── CREDENTIALS FOOTER ────────────────────
      if (doc.y > 680) {
        doc.addPage();
        moveCursor(doc, LEFT, 60);
      }

      doc.moveDown(1.5);
      doc.moveTo(LEFT, doc.y).lineTo(LEFT + CONTENT_WIDTH, doc.y)
        .strokeColor('#cccccc').lineWidth(0.5).stroke();
      doc.moveDown(0.5);

      doc.fontSize(7).fillColor('#999999');
      doc.text('AWE System — Automated Writing Evaluation Platform', LEFT, doc.y, { width: CONTENT_WIDTH, align: 'center' });
      doc.text('Sultan Qaboos University — Center for Preparatory Studies', LEFT, doc.y, { width: CONTENT_WIDTH, align: 'center' });
      doc.text('AI Co-Marker Assistance Project, 2026', LEFT, doc.y, { width: CONTENT_WIDTH, align: 'center' });
      doc.moveDown(0.2);
      doc.fontSize(6).fillColor('#bbbbbb');
      doc.text('Developed by: Dr. Waleed Mandour | Powered by Google Gemini AI | This report is auto-generated for educational assessment purposes only.', LEFT, doc.y, { width: CONTENT_WIDTH, align: 'center' });

      // Finalize — this triggers 'data' and 'end' events
      doc.end();
    });

    // ── Return PDF as downloadable response ──
    const dateStr = new Date().toISOString().split('T')[0];
    // Buffer is not a valid BodyInit in Next.js 16 — convert to Uint8Array
    return new NextResponse(new Uint8Array(pdfBytes), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="AWE_Assessment_${courseCode}_${dateStr}.pdf"`,
        'Content-Length': String(pdfBytes.length),
      },
    });
  } catch (error) {
    console.error('PDF generation error:', error);
    return NextResponse.json(
      {
        error: 'Failed to generate PDF',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
