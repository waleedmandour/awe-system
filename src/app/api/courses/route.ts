import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

// GET /api/courses - Get all courses with their criteria
export async function GET() {
  try {
    const courses = await db.course.findMany({
      include: {
        criteria: {
          orderBy: {
            name: 'asc'
          }
        }
      },
      orderBy: {
        code: 'asc'
      }
    });

    // If no courses exist, seed the database
    if (courses.length === 0) {
      const seededCourses = await seedCourses();
      return NextResponse.json({ courses: seededCourses });
    }

    return NextResponse.json({ courses });
  } catch (error) {
    console.error('Error fetching courses:', error);
    return NextResponse.json(
      { error: 'Failed to fetch courses' },
      { status: 500 }
    );
  }
}

// Seed initial courses and criteria
async function seedCourses() {
  const foundationCourses = [
    {
      code: '0230',
      name: 'English Language Foundation I',
      program: 'foundation',
      description: 'Foundation year English course focusing on basic writing skills',
      criteria: [
        { name: 'Task Response', maxScore: 6, description: 'How well the essay addresses the given task' },
        { name: 'Coherence & Cohesion', maxScore: 6, description: 'Logical organization and linking of ideas' },
        { name: 'Lexical Resource', maxScore: 6, description: 'Range and accuracy of vocabulary' },
        { name: 'Grammatical Range & Accuracy', maxScore: 6, description: 'Range and accuracy of grammar' },
      ]
    },
    {
      code: '0340',
      name: 'English Language Foundation II',
      program: 'foundation',
      description: 'Foundation year English course focusing on intermediate writing skills',
      criteria: [
        { name: 'Task Response', maxScore: 6, description: 'How well the essay addresses the given task' },
        { name: 'Coherence & Cohesion', maxScore: 6, description: 'Logical organization and linking of ideas' },
        { name: 'Lexical Resource', maxScore: 6, description: 'Range and accuracy of vocabulary' },
        { name: 'Grammatical Range & Accuracy', maxScore: 6, description: 'Range and accuracy of grammar' },
      ]
    }
  ];

  const postFoundationCourses = [
    {
      code: 'LANC2160',
      name: 'Academic English: Summary Writing',
      program: 'post-foundation',
      description: 'Post-foundation course focusing on academic summary writing',
      criteria: [
        { name: 'Task Achievement', maxScore: 5, description: 'How well the summary captures the main points' },
        { name: 'Coherence & Cohesion', maxScore: 5, description: 'Logical organization and linking of ideas' },
        { name: 'Lexical Resource', maxScore: 5, description: 'Range and accuracy of vocabulary' },
        { name: 'Grammatical Range & Accuracy', maxScore: 5, description: 'Range and accuracy of grammar' },
      ]
    }
  ];

  const allCourses = [...foundationCourses, ...postFoundationCourses];
  const createdCourses = [];

  for (const courseData of allCourses) {
    const course = await db.course.create({
      data: {
        code: courseData.code,
        name: courseData.name,
        program: courseData.program,
        description: courseData.description,
        criteria: {
          create: courseData.criteria
        }
      },
      include: {
        criteria: true
      }
    });
    createdCourses.push(course);
  }

  return createdCourses;
}
