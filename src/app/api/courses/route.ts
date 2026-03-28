import { NextResponse } from 'next/server';
import { db, isDatabaseAvailable } from '@/lib/db';

// Default courses data (used when database is not available)
const defaultCourses = [
  {
    id: 'course-0230',
    code: '0230',
    name: 'English Language Foundation I',
    program: 'foundation',
    description: 'Foundation year English course focusing on basic writing skills',
    criteria: [
      { id: 'cr-1', name: 'Task Response', maxScore: 6, description: 'How well the essay addresses the given task' },
      { id: 'cr-2', name: 'Coherence & Cohesion', maxScore: 6, description: 'Logical organization and linking of ideas' },
      { id: 'cr-3', name: 'Lexical Resource', maxScore: 6, description: 'Range and accuracy of vocabulary' },
      { id: 'cr-4', name: 'Grammatical Range & Accuracy', maxScore: 6, description: 'Range and accuracy of grammar' },
    ]
  },
  {
    id: 'course-0340',
    code: '0340',
    name: 'English Language Foundation II',
    program: 'foundation',
    description: 'Foundation year English course focusing on intermediate writing skills',
    criteria: [
      { id: 'cr-5', name: 'Task Response', maxScore: 6, description: 'How well the essay addresses the given task' },
      { id: 'cr-6', name: 'Coherence & Cohesion', maxScore: 6, description: 'Logical organization and linking of ideas' },
      { id: 'cr-7', name: 'Lexical Resource', maxScore: 6, description: 'Range and accuracy of vocabulary' },
      { id: 'cr-8', name: 'Grammatical Range & Accuracy', maxScore: 6, description: 'Range and accuracy of grammar' },
    ]
  },
  {
    id: 'course-lanc2160',
    code: 'LANC2160',
    name: 'Academic English: Summary Writing',
    program: 'credit',
    description: 'Credit course focusing on academic summary writing',
    criteria: [
      { id: 'cr-9', name: 'Task Achievement', maxScore: 5, description: 'How well the summary captures the main points' },
      { id: 'cr-10', name: 'Coherence & Cohesion', maxScore: 5, description: 'Logical organization and linking of ideas' },
      { id: 'cr-11', name: 'Lexical Resource', maxScore: 5, description: 'Range and accuracy of vocabulary' },
      { id: 'cr-12', name: 'Grammatical Range & Accuracy', maxScore: 5, description: 'Range and accuracy of grammar' },
    ]
  }
];

// GET /api/courses - Get all courses with their criteria
export async function GET() {
  try {
    // If the database is not available, return default courses
    if (!isDatabaseAvailable()) {
      return NextResponse.json({ courses: defaultCourses });
    }

    const courses = await db?.course.findMany({
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

    // If no courses in database, return defaults
    if (!courses || courses.length === 0) {
      return NextResponse.json({ courses: defaultCourses });
    }

    return NextResponse.json({ courses });
  } catch (error) {
    console.error('Error fetching courses:', error);
    // Return default courses on error
    return NextResponse.json({ courses: defaultCourses });
  }
}
