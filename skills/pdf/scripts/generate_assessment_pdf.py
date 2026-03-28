#!/usr/bin/env python3
"""
AWE Assessment PDF Generator
Generates professional PDF reports for essay assessments
"""

import sys
import json
import os
from datetime import datetime

from reportlab.lib.pagesizes import A4
from reportlab.lib.units import inch, cm
from reportlab.lib import colors
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_JUSTIFY
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle,
    PageBreak, Image, HRFlowable
)
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfbase.pdfmetrics import registerFontFamily

# Register fonts
pdfmetrics.registerFont(TTFont('Times New Roman', '/usr/share/fonts/truetype/english/Times-New-Roman.ttf'))
pdfmetrics.registerFont(TTFont('SimHei', '/usr/share/fonts/truetype/chinese/SimHei.ttf'))
registerFontFamily('Times New Roman', normal='Times New Roman', bold='Times New Roman')

# Color scheme
PRIMARY_GREEN = colors.HexColor('#1a5f2a')
SECONDARY_GREEN = colors.HexColor('#2a7f3a')
GOLD = colors.HexColor('#c9a227')
LIGHT_GRAY = colors.HexColor('#f5f5f5')
DARK_GRAY = colors.HexColor('#333333')

def create_styles():
    """Create paragraph styles for the PDF"""
    styles = getSampleStyleSheet()
    
    # Title style
    styles.add(ParagraphStyle(
        name='MainTitle',
        fontName='Times New Roman',
        fontSize=24,
        textColor=PRIMARY_GREEN,
        alignment=TA_CENTER,
        spaceAfter=6,
    ))
    
    # Subtitle style
    styles.add(ParagraphStyle(
        name='Subtitle',
        fontName='Times New Roman',
        fontSize=14,
        textColor=DARK_GRAY,
        alignment=TA_CENTER,
        spaceAfter=20,
    ))
    
    # Section header
    styles.add(ParagraphStyle(
        name='SectionHeader',
        fontName='Times New Roman',
        fontSize=16,
        textColor=PRIMARY_GREEN,
        spaceBefore=20,
        spaceAfter=10,
    ))
    
    # Body text
    styles.add(ParagraphStyle(
        name='BodyText',
        fontName='Times New Roman',
        fontSize=11,
        textColor=DARK_GRAY,
        alignment=TA_JUSTIFY,
        spaceBefore=6,
        spaceAfter=6,
        leading=16,
    ))
    
    # Criterion header
    styles.add(ParagraphStyle(
        name='CriterionHeader',
        fontName='Times New Roman',
        fontSize=13,
        textColor=PRIMARY_GREEN,
        spaceBefore=12,
        spaceAfter=6,
    ))
    
    # Feedback text
    styles.add(ParagraphStyle(
        name='FeedbackText',
        fontName='Times New Roman',
        fontSize=10,
        textColor=DARK_GRAY,
        alignment=TA_JUSTIFY,
        spaceBefore=4,
        spaceAfter=8,
        leading=14,
    ))
    
    # Score style
    styles.add(ParagraphStyle(
        name='ScoreText',
        fontName='Times New Roman',
        fontSize=36,
        textColor=PRIMARY_GREEN,
        alignment=TA_CENTER,
    ))
    
    # Footer
    styles.add(ParagraphStyle(
        name='Footer',
        fontName='Times New Roman',
        fontSize=9,
        textColor=colors.gray,
        alignment=TA_CENTER,
    ))
    
    return styles

def get_score_label(percentage):
    """Get performance label based on percentage"""
    if percentage >= 80:
        return "Excellent"
    elif percentage >= 60:
        return "Good"
    elif percentage >= 40:
        return "Satisfactory"
    else:
        return "Needs Improvement"

def get_score_color(score, max_score):
    """Get color based on score percentage"""
    percentage = (score / max_score) * 100
    if percentage >= 80:
        return colors.HexColor('#1a5f2a')  # Green
    elif percentage >= 60:
        return colors.HexColor('#c9a227')  # Gold
    elif percentage >= 40:
        return colors.HexColor('#f97316')  # Orange
    else:
        return colors.HexColor('#ef4444')  # Red

def build_pdf(assessment, course, essay_text, output_path):
    """Build the assessment PDF report"""
    doc = SimpleDocTemplate(
        output_path,
        pagesize=A4,
        rightMargin=1.5*cm,
        leftMargin=1.5*cm,
        topMargin=2*cm,
        bottomMargin=2*cm,
        title=f"AWE Assessment Report - {course.get('code', 'Unknown')}",
        author='Z.ai',
        creator='Z.ai',
        subject='Essay Assessment Report'
    )
    
    styles = create_styles()
    story = []
    
    # === HEADER ===
    story.append(Paragraph("Automated Writing Evaluation", styles['MainTitle']))
    story.append(Paragraph("Assessment Report", styles['Subtitle']))
    story.append(Spacer(1, 10))
    
    # Course info
    course_info = f"<b>Course:</b> {course.get('name', 'Unknown')} ({course.get('code', 'N/A')})"
    story.append(Paragraph(course_info, styles['BodyText']))
    
    date_str = datetime.now().strftime("%B %d, %Y")
    story.append(Paragraph(f"<b>Date:</b> {date_str}", styles['BodyText']))
    
    # Word count
    word_count = assessment.get('wordCount', 0)
    if word_count:
        story.append(Paragraph(f"<b>Word Count:</b> {word_count} words", styles['BodyText']))
    
    story.append(Spacer(1, 20))
    
    # Horizontal line
    story.append(HRFlowable(width="100%", thickness=2, color=PRIMARY_GREEN))
    story.append(Spacer(1, 20))
    
    # === SCORE SUMMARY ===
    story.append(Paragraph("Score Summary", styles['SectionHeader']))
    story.append(Spacer(1, 10))
    
    # Score summary table
    total_score = assessment.get('totalScore', 0)
    max_score = assessment.get('maxScore', 24)
    percentage = assessment.get('percentage', 0)
    score_label = get_score_label(percentage)
    
    # Create score display (without band score)
    score_data = [
        [Paragraph('<b>Total Score</b>', styles['BodyText']), 
         Paragraph('<b>Percentage</b>', styles['BodyText']),
         Paragraph('<b>Performance</b>', styles['BodyText'])],
        [Paragraph(f'<font size="18" color="#1a5f2a"><b>{total_score}/{max_score}</b></font>', styles['BodyText']),
         Paragraph(f'<font size="18" color="#1a5f2a"><b>{percentage:.1f}%</b></font>', styles['BodyText']),
         Paragraph(f'<font size="14" color="#1a5f2a"><b>{score_label}</b></font>', styles['BodyText'])]
    ]
    
    score_table = Table(score_data, colWidths=[5*cm, 4*cm, 5*cm])
    score_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), PRIMARY_GREEN),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
        ('BACKGROUND', (0, 1), (-1, 1), LIGHT_GRAY),
        ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('GRID', (0, 0), (-1, -1), 0.5, colors.gray),
        ('TOPPADDING', (0, 0), (-1, -1), 10),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 10),
    ]))
    story.append(score_table)
    story.append(Spacer(1, 30))
    
    # === CRITERIA BREAKDOWN ===
    story.append(Paragraph("Detailed Criteria Assessment", styles['SectionHeader']))
    story.append(Spacer(1, 10))
    
    scores = assessment.get('scores', [])
    for i, score in enumerate(scores):
        criterion_name = score.get('criterionName', f'Criterion {i+1}')
        criterion_score = score.get('score', 0)
        criterion_max = score.get('maxScore', 6)
        feedback = score.get('feedback', 'No feedback provided.')
        score_percentage = (criterion_score / criterion_max) * 100 if criterion_max > 0 else 0
        
        # Criterion header with score
        criterion_color = get_score_color(criterion_score, criterion_max)
        color_hex = f'#{criterion_color.hexval()[2:]}'
        
        story.append(Paragraph(
            f'<font color="{color_hex}"><b>{criterion_name}</b></font> '
            f'<font size="12">({criterion_score}/{criterion_max} - {score_percentage:.0f}%)</font>',
            styles['CriterionHeader']
        ))
        
        # Progress bar representation
        bar_width = 14 * cm
        filled_width = bar_width * (score_percentage / 100)
        
        bar_data = [['']]
        bar_table = Table(bar_data, colWidths=[bar_width], rowHeights=[8])
        bar_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, -1), criterion_color),
            ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
            ('LEFTPADDING', (0, 0), (-1, -1), 0),
        ]))
        story.append(bar_table)
        story.append(Spacer(1, 6))
        
        # Feedback
        story.append(Paragraph(f"<i>Feedback:</i> {feedback}", styles['FeedbackText']))
        story.append(Spacer(1, 10))
    
    # === OVERALL FEEDBACK ===
    story.append(Spacer(1, 10))
    story.append(HRFlowable(width="100%", thickness=1, color=GOLD))
    story.append(Spacer(1, 15))
    
    overall_feedback = assessment.get('overallFeedback', 'No overall feedback provided.')
    story.append(Paragraph("Overall Feedback", styles['SectionHeader']))
    story.append(Paragraph(overall_feedback, styles['BodyText']))
    
    # === ESSAY TEXT (if provided) ===
    if essay_text:
        story.append(Spacer(1, 20))
        story.append(HRFlowable(width="100%", thickness=1, color=GOLD))
        story.append(Spacer(1, 15))
        story.append(Paragraph("Submitted Essay", styles['SectionHeader']))
        
        # Truncate essay if too long
        display_text = essay_text[:2000] + "..." if len(essay_text) > 2000 else essay_text
        
        # Add word count
        word_count = len(essay_text.split())
        story.append(Paragraph(f"<i>Word Count: {word_count}</i>", styles['FeedbackText']))
        story.append(Spacer(1, 10))
        story.append(Paragraph(display_text.replace('\n', '<br/>'), styles['FeedbackText']))
    
    # === FOOTER ===
    story.append(Spacer(1, 40))
    story.append(HRFlowable(width="100%", thickness=1, color=colors.gray))
    story.append(Spacer(1, 10))
    story.append(Paragraph("Part of AI Co-Marker Project, 2026.", styles['Footer']))
    story.append(Paragraph("Sultan Qaboos University - Center for Preparatory Studies", styles['Footer']))
    
    # Build PDF
    doc.build(story)
    
    return output_path

def main():
    if len(sys.argv) < 3:
        print("Usage: python generate_assessment_pdf.py <input_json> <output_pdf>", file=sys.stderr)
        sys.exit(1)
    
    input_file = sys.argv[1]
    output_file = sys.argv[2]
    
    try:
        with open(input_file, 'r', encoding='utf-8') as f:
            data = json.load(f)
        
        assessment = data.get('assessment', {})
        course = data.get('course', {})
        essay_text = data.get('essayText', '')
        
        build_pdf(assessment, course, essay_text, output_file)
        print(f"PDF generated successfully: {output_file}")
        
    except Exception as e:
        print(f"Error generating PDF: {str(e)}", file=sys.stderr)
        sys.exit(1)

if __name__ == '__main__':
    main()
