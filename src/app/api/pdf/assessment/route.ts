import { NextRequest, NextResponse } from 'next/server';
import { exec } from 'child_process';
import { promisify } from 'util';
import { writeFile, readFile, unlink } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';

const execAsync = promisify(exec);

// Prevent Vercel/serverless from timing out the PDF generation
export const maxDuration = 60;

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

    // Create temporary files for input and output
    const timestamp = Date.now();
    const inputJsonPath = join(tmpdir(), `assessment_input_${timestamp}.json`);
    const outputPdfPath = join(tmpdir(), `assessment_report_${timestamp}.pdf`);

    // Write input data to JSON file
    await writeFile(
      inputJsonPath,
      JSON.stringify({
        assessment,
        course: course || {},
        essayText: essayText || '',
      }),
      'utf-8'
    );

    // Path to the Python script
    const scriptPath = join(
      process.cwd(),
      'skills/pdf/scripts/generate_assessment_pdf.py'
    );

    // Execute Python script
    const { stdout, stderr } = await execAsync(
      `python3 "${scriptPath}" "${inputJsonPath}" "${outputPdfPath}"`,
      { timeout: 30000 }
    );

    if (stderr && !stderr.includes('PDF generated successfully')) {
      console.error('PDF generation stderr:', stderr);
    }

    // Read the generated PDF
    const pdfBuffer = await readFile(outputPdfPath);

    // Clean up temporary files
    try {
      await unlink(inputJsonPath);
      await unlink(outputPdfPath);
    } catch (cleanupError) {
      console.warn('Failed to clean up temp files:', cleanupError);
    }

    // Return PDF as response
    return new NextResponse(pdfBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="AWE_Assessment_${course?.code || 'Report'}_${new Date().toISOString().split('T')[0]}.pdf"`,
      },
    });
  } catch (error) {
    console.error('PDF generation error:', error);
    return NextResponse.json(
      { error: 'Failed to generate PDF', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
