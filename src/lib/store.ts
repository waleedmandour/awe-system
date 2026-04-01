import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

// Types
export interface Course {
  id: string;
  code: string;
  name: string;
  program: 'foundation' | 'post-foundation';
  description?: string;
}

export interface Criterion {
  id: string;
  name: string;
  maxScore: number;
  description?: string;
}

export interface Score {
  criterionId: string;
  criterionName: string;
  score: number;
  maxScore: number;
  feedback?: string;
}

export interface Assessment {
  id: string;
  totalScore: number;
  maxScore: number;
  percentage: number;
  overallFeedback?: string;
  scores: Score[];
  wordCount?: number;
  targetWordCount?: { min: number; max: number; ideal: number } | null;
  createdAt: string;
}

export interface Essay {
  id: string;
  studentId?: string;
  studentName?: string;
  originalText: string;
  editedText?: string;
  imageData?: string;
  topic?: string;
  wordCount: number;
  status: 'pending' | 'processing' | 'assessed' | 'error';
  courseId: string;
  assessment?: Assessment;
  createdAt: string;
}

export type ExamType = 'mid-semester' | 'final' | null;
export type WritingType = 'summary' | 'synthesis' | null;
export type AppStep = 'welcome' | 'setup' | 'course' | 'upload' | 'processing' | 'review' | 'assessing' | 'results' | 'records';

// Summary writing source texts for LANC2160
export interface SummarySourceText {
  id: string;
  title: string;
  originalText: string;
  wordCount: number;
  // Target summary length is ~1/3 of original
  targetMin: number;
  targetMax: number;
  targetIdeal: number;
}

export const SUMMARY_SOURCE_TEXTS: SummarySourceText[] = [
  {
    id: 'salmon-cannon',
    title: 'The "Salmon Cannon" is the Latest Method for Transporting Fish over Dams',
    originalText: `While hydroelectric dams are able to generate electricity without coal or oil, they act as obstacles for wildlife, and migrating salmon in particular. When salmon are ready to reproduce, they migrate from the sea back upstream into rivers, where they spawn on gravel beds. Swimming upstream requires the ability to fight against obstacles including rapids and up over drop-offs. Yet no matter how well salmon swim, these manmade barriers are often too massive for the fish to cross on their own.

Typically, dams have manmade fish ladders to help fish swim upstream. Water flows over a series of steps, and the determined fish leap up repeatedly, climbing up the steps until they exit into the river at the top of the dam. Unfortunately, at a certain point, some dams are too high and ladders aren't a practical solution. In addition, fish may turn around if the water in a fish ladder is too warm.

Wildlife departments and public utilities already do impractical things to divert salmon past manmade barriers. These include putting them on trucks, loading them onto barges, and in a few cases, lifting them by helicopter. However, the aptly-named company Whooshh Innovations was inspired to solve this problem by looking at their own existing technology invented to transport delicate produce, like ripe tomatoes or apples. The Whooshh system sucks up produce through pressurized tubes and transfers them onto trucks without damage.

If Whooshh tubes could send apples flying over long distances without damaging them, maybe, an employee thought, they could suck fish up and over the dams blocking a river. \"So we put a tilapia in the fruit tube,\" Whooshh's VP Todd Deligan said. \"It went flying, and we were like, 'Huh, check that out.'\" They were able to modify their system to safely give fish a boost, and thus, the salmon cannon was born.

Though the name \"cannon\" is catchy, the device doesn't actually operate like one. Instead, it acts a little like a vacuum cleaner. As a fish enters the system, it immediately whizzes up the tube because the pressure in front of it is lower than the pressure behind it. This differential pressure generates a seal around the fish's middle, holding it steady as the fish speeds along. As the seal lets go of the fish toward the tube's end, the fish slows down. Friction, gravity, and increased water help it decelerate too as it is released into the water.

It took a few years to tweak the design, but Whooshh has developed a system that enables salmon and trout to easily load themselves into the device. The company has also developed a scanner that can automatically sort fish to prevent unwanted species or other objects from travelling through the system. The fish can travel at a speed of 24-35 km/h (15-22 mph) along a track that is misted in order to keep them wet throughout the journey. The current system can transport up to 40 fish per minute.

The tube doesn't appear to increase short-term stress on the fish, according to a 2013 U.S. Geological Survey study, published in the North American Journal of Fisheries Management, that examined the fishes' cortisol levels. Deligan also points out that the cannon speeds up the fish's journey and saves them energy. \"That should translate to a higher return rate of the fish at the spawning grounds,\" he said. So far, Whooshh's cannons have been installed to help fish navigate dams on several rivers in Washington and Oregon. The company hopes that, with continued success, it can expand its business to assist spawning fish in rivers around the globe.`,
    wordCount: 613,
    targetMin: 160,
    targetMax: 220,
    targetIdeal: 200,
  },
];

export interface AssessmentRecord {
  id: string;
  assessment: Assessment;
  course: Course | null;
  essayText: string;
  createdAt: string;
}

interface AppState {
  // Navigation
  currentStep: AppStep;
  setStep: (step: AppStep) => void;
  
  // Settings
  geminiApiKey: string;
  visionApiKey: string;
  theme: 'light' | 'dark' | 'system';
  setGeminiApiKey: (key: string) => void;
  setVisionApiKey: (key: string) => void;
  setTheme: (theme: 'light' | 'dark' | 'system') => void;
  
  // Course selection
  selectedCourse: Course | null;
  courses: Course[];
  setSelectedCourse: (course: Course | null) => void;
  selectedExamType: ExamType;
  setSelectedExamType: (examType: ExamType) => void;
  selectedWritingType: WritingType;
  setSelectedWritingType: (writingType: WritingType) => void;
  selectedSourceTextId: string | null;
  setSelectedSourceTextId: (sourceTextId: string | null) => void;
  
  // Essay management
  currentEssay: Essay | null;
  essays: Essay[];
  setCurrentEssay: (essay: Essay | null) => void;
  addEssay: (essay: Essay) => void;
  updateEssay: (id: string, updates: Partial<Essay>) => void;
  
  // Processing state
  isProcessing: boolean;
  processingMessage: string;
  setProcessing: (isProcessing: boolean, message?: string) => void;
  
  // OCR result (extracted text before assessment)
  extractedText: string;
  setExtractedText: (text: string) => void;
  
  // Assessment result
  currentAssessment: Assessment | null;
  setCurrentAssessment: (assessment: Assessment | null) => void;
  
  // Records
  records: AssessmentRecord[];
  addRecord: (record: AssessmentRecord) => void;
  deleteRecord: (id: string) => void;
  clearAllRecords: () => void;

  // UI state
  showInstallPrompt: boolean;
  setShowInstallPrompt: (show: boolean) => void;
  
  // Reset
  resetAssessment: () => void;
}

// Default courses
const defaultCourses: Course[] = [
  {
    id: 'course-0230',
    code: '0230',
    name: 'English Language Foundation I (FP0230)',
    program: 'foundation',
    description: 'Foundation year English course focusing on basic writing skills.'
  },
  {
    id: 'course-0340',
    code: '0340',
    name: 'English Language Foundation II (FP0340)',
    program: 'foundation',
    description: 'Foundation year English course focusing on basic writing skills.'
  },
  {
    id: 'course-lanc2160',
    code: 'LANC2160',
    name: 'Academic English: Summary Writing & Synthesis Essay',
    program: 'post-foundation',
    description: 'Post-foundation course focusing on academic summary writing and 2-point synthesis essay writing.'
  }
];

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      // Navigation
      currentStep: 'welcome',
      setStep: (step) => set({ currentStep: step }),
      
      // Settings
      geminiApiKey: '',
      visionApiKey: '',
      theme: 'system',
      setGeminiApiKey: (key) => set({ geminiApiKey: key }),
      setVisionApiKey: (key) => set({ visionApiKey: key }),
      setTheme: (theme) => set({ theme }),
      
      // Course selection
      selectedCourse: null,
      courses: defaultCourses,
      setSelectedCourse: (course) => set({ selectedCourse: course, selectedExamType: null, selectedWritingType: null, selectedSourceTextId: null }),
      selectedExamType: null,
      setSelectedExamType: (examType) => set({ selectedExamType: examType }),
      selectedWritingType: null,
      setSelectedWritingType: (writingType) => set({ selectedWritingType: writingType }),
      selectedSourceTextId: null as string | null,
      setSelectedSourceTextId: (sourceTextId: string | null) => set({ selectedSourceTextId: sourceTextId }),
      
      // Essay management
      currentEssay: null,
      essays: [],
      setCurrentEssay: (essay) => set({ currentEssay: essay }),
      addEssay: (essay) => set((state) => ({ essays: [essay, ...state.essays] })),
      updateEssay: (id, updates) => set((state) => ({
        essays: state.essays.map((e) => e.id === id ? { ...e, ...updates } : e),
        currentEssay: state.currentEssay?.id === id 
          ? { ...state.currentEssay, ...updates } 
          : state.currentEssay
      })),
      
      // Processing state
      isProcessing: false,
      processingMessage: '',
      setProcessing: (isProcessing, message = '') => set({ 
        isProcessing, 
        processingMessage: message 
      }),
      
      // OCR result
      extractedText: '',
      setExtractedText: (text) => set({ extractedText: text }),
      
      // Assessment result
      currentAssessment: null,
      setCurrentAssessment: (assessment) => set({ currentAssessment: assessment }),
      
      // Records
      records: [],
      addRecord: (record) => set((state) => ({ records: [record, ...state.records] })),
      deleteRecord: (id) => set((state) => ({
        records: state.records.filter((r) => r.id !== id),
      })),
      clearAllRecords: () => set({ records: [] }),

      // UI state
      showInstallPrompt: false,
      setShowInstallPrompt: (show) => set({ showInstallPrompt: show }),
      
      // Reset
      resetAssessment: () => set({
        currentStep: 'welcome',
        currentEssay: null,
        extractedText: '',
        currentAssessment: null,
        isProcessing: false,
        processingMessage: ''
      })
    }),
    {
      name: 'awe-storage',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        geminiApiKey: state.geminiApiKey,
        visionApiKey: state.visionApiKey,
        theme: state.theme,
        selectedCourse: state.selectedCourse,
        selectedWritingType: state.selectedWritingType,
        selectedSourceTextId: state.selectedSourceTextId,
        essays: state.essays.slice(0, 10), // Keep last 10 essays
        records: state.records, // Keep all records
      })
    }
  )
);
