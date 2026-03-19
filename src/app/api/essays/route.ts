import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// GET /api/essays - Get all essays
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const courseId = searchParams.get('courseId');
    const limit = parseInt(searchParams.get('limit') || '20');

    const where = courseId ? { courseId } : {};

    const essays = await db.essay.findMany({
      where,
      include: {
        course: true,
        assessment: {
          include: {
            scores: {
              include: {
                criterion: true
              }
            }
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      },
      take: limit
    });

    return NextResponse.json({ essays });
  } catch (error) {
    console.error('Error fetching essays:', error);
    return NextResponse.json(
      { error: 'Failed to fetch essays' },
      { status: 500 }
    );
  }
}

// POST /api/essays - Create a new essay
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      studentId,
      studentName,
      originalText,
      editedText,
      imageData,
      topic,
      wordCount,
      courseId,
    } = body;

    if (!originalText || !courseId) {
      return NextResponse.json(
        { error: 'Missing required fields: originalText, courseId' },
        { status: 400 }
      );
    }

    const essay = await db.essay.create({
      data: {
        studentId,
        studentName,
        originalText,
        editedText,
        imageData,
        topic,
        wordCount: wordCount || originalText.split(/\s+/).filter(Boolean).length,
        courseId,
        status: 'pending'
      },
      include: {
        course: true
      }
    });

    return NextResponse.json({ essay });
  } catch (error) {
    console.error('Error creating essay:', error);
    return NextResponse.json(
      { error: 'Failed to create essay' },
      { status: 500 }
    );
  }
}

// PUT /api/essays - Update an essay
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, ...updates } = body;

    if (!id) {
      return NextResponse.json(
        { error: 'Essay ID is required' },
        { status: 400 }
      );
    }

    const essay = await db.essay.update({
      where: { id },
      data: updates,
      include: {
        course: true,
        assessment: {
          include: {
            scores: {
              include: {
                criterion: true
              }
            }
          }
        }
      }
    });

    return NextResponse.json({ essay });
  } catch (error) {
    console.error('Error updating essay:', error);
    return NextResponse.json(
      { error: 'Failed to update essay' },
      { status: 500 }
    );
  }
}

// DELETE /api/essays - Delete an essay
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { error: 'Essay ID is required' },
        { status: 400 }
      );
    }

    await db.essay.delete({
      where: { id }
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting essay:', error);
    return NextResponse.json(
      { error: 'Failed to delete essay' },
      { status: 500 }
    );
  }
}
