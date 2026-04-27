'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useAppStore, type Assessment } from '@/lib/store';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/hooks/use-toast';
import { recalculateScores } from '@/lib/scoring-utils';
import {
  FileText,
  CheckCircle,
  BookOpen,
  Target,
  MessageSquare,
  AlertCircle,
  Cpu,
  Loader2,
} from 'lucide-react';

// Animation variants
const slideInRight = {
  initial: { opacity: 0, x: 50 },
  animate: { opacity: 1, x: 0 },
  exit: { opacity: 0, x: -50 },
};

const slideInLeft = {
  initial: { opacity: 0, x: -50 },
  animate: { opacity: 1, x: 0 },
  exit: { opacity: 0, x: 50 },
};

// Page transition wrapper
const PageTransition = ({ children, direction = 'right' }: { children: React.ReactNode; direction?: 'left' | 'right' }) => (
  <motion.div
    variants={direction === 'right' ? slideInRight : slideInLeft}
    initial="initial"
    animate="animate"
    exit="exit"
    transition={{ duration: 0.3, ease: 'easeOut' }}
    className="w-full h-full"
  >
    {children}
  </motion.div>
);

// Assessment Screen (Processing)
const AssessmentScreen = ({ onComplete }: { onComplete: (assessment: Assessment) => void }) => {
  const { selectedCourse, extractedText, geminiApiKey, assessmentApiKey, selectedExamType, selectedWritingType, selectedSourceTextId, writingPrompt } = useAppStore();
  const [progress, setProgress] = useState(0);
  const [currentPhase, setCurrentPhase] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  const phases = [
    { text: 'Analyzing structure', icon: FileText },
    { text: 'Evaluating grammar', icon: CheckCircle },
    { text: 'Assessing vocabulary', icon: BookOpen },
    { text: 'Checking coherence', icon: Target },
    { text: 'Generating feedback', icon: MessageSquare },
  ];

  useEffect(() => {
    // Start the actual assessment API call
    const performAssessment = async () => {
      try {
        const response = await fetch('/api/assess', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            text: extractedText,
            courseCode: selectedCourse?.code,
            topic: writingPrompt || null,
            apiKey: assessmentApiKey || geminiApiKey,
            examType: selectedExamType || undefined,
            writingType: selectedWritingType || undefined,
            sourceTextId: selectedSourceTextId || undefined,
          }),
        });

        const result = await response.json();

        if (!response.ok) {
          throw new Error(result.error || 'Failed to assess essay');
        }

        // Transform the API response to match Assessment type
        const rawAssessment: Assessment = {
          id: `assess-${Date.now()}`,
          totalScore: result.assessment.totalScore,
          maxScore: result.assessment.maxScore,
          percentage: result.assessment.percentage,
          overallFeedback: result.assessment.overallFeedback,
          wordCount: result.assessment.wordCount,
          targetWordCount: result.assessment.targetWordCount,
          scores: result.assessment.scores.map((s: any, index: number) => ({
            criterionId: s.criterionId || `criterion-${index}`,
            criterionName: s.criterionName,
            score: s.score,
            maxScore: s.maxScore,
            feedback: s.feedback,
          })),
          createdAt: result.assessment.createdAt,
        };

        // Always recalculate total score from individual criterion scores (ignore AI total)
        const assessment = recalculateScores(rawAssessment);

        // Wait for progress to complete before showing results
        setProgress(100);
        setTimeout(() => onComplete(assessment), 500);
      } catch (err) {
        console.error('Assessment error:', err);
        setError(err instanceof Error ? err.message : 'Failed to assess essay');
        toast({
          title: 'Assessment Failed',
          description: err instanceof Error ? err.message : 'Failed to assess essay',
          variant: 'destructive',
        });
      }
    };

    performAssessment();

    // Progress animation
    const progressInterval = setInterval(() => {
      setProgress((prev) => (prev >= 90 ? 90 : prev + 2)); // Cap at 90% until API returns
    }, 100);

    const phaseInterval = setInterval(() => {
      setCurrentPhase((prev) => (prev < phases.length - 1 ? prev + 1 : prev));
    }, 1500);

    return () => {
      clearInterval(progressInterval);
      clearInterval(phaseInterval);
    };
  }, [extractedText, selectedCourse, geminiApiKey, selectedExamType, writingPrompt, onComplete, toast]);

  if (error) {
    return (
      <PageTransition>
        <div className="min-h-screen min-h-[100dvh] flex flex-col items-center justify-center p-6 safe-area-top safe-area-bottom">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="w-full max-w-sm text-center"
          >
            <div className="w-20 h-20 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-6">
              <AlertCircle className="w-10 h-10 text-red-500" />
            </div>
            <h2 className="text-xl font-semibold mb-2">Assessment Failed</h2>
            <p className="text-muted-foreground text-sm mb-6">{error}</p>
            <Button
              onClick={() => window.location.reload()}
              className="bg-[#1a5f2a] hover:bg-[#1a5f2a]/90"
            >
              Try Again
            </Button>
          </motion.div>
        </div>
      </PageTransition>
    );
  }

  return (
    <PageTransition>
      <div className="min-h-screen min-h-[100dvh] flex flex-col items-center justify-center p-6 safe-area-top safe-area-bottom">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="w-full max-w-sm"
        >
          {/* Animated Brain Icon */}
          <div className="flex justify-center mb-8">
            <motion.div
              animate={{
                scale: [1, 1.1, 1],
                rotate: [0, 5, -5, 0],
              }}
              transition={{ duration: 2, repeat: Infinity }}
              className="w-24 h-24 rounded-full bg-gradient-to-br from-[#1a5f2a] to-[#c9a227] flex items-center justify-center shadow-xl"
            >
              <Cpu className="w-12 h-12 text-white" />
            </motion.div>
          </div>

          {/* Title */}
          <div className="text-center mb-8">
            <h2 className="text-xl font-semibold mb-2">AI Assessment</h2>
            <p className="text-muted-foreground text-sm">
              {selectedCourse?.name || 'Analyzing your essay...'}
            </p>
          </div>

          {/* Progress Bar */}
          <div className="mb-8">
            <Progress value={progress} className="h-3" />
            <p className="text-center text-sm text-muted-foreground mt-2">{Math.round(progress)}%</p>
          </div>

          {/* Phases */}
          <div className="space-y-2">
            {phases.map((phase, index) => (
              <motion.div
                key={phase.text}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.1 }}
                className={`flex items-center gap-3 p-3 rounded-xl transition-all duration-300 ${
                  index < currentPhase
                    ? 'bg-[#1a5f2a]/10 text-[#1a5f2a]'
                    : index === currentPhase
                    ? 'bg-[#c9a227]/10 text-[#c9a227]'
                    : 'bg-muted/50 text-muted-foreground'
                }`}
              >
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center ${
                    index < currentPhase
                      ? 'bg-[#1a5f2a] text-white'
                      : index === currentPhase
                      ? 'bg-[#c9a227] text-white animate-pulse'
                      : 'bg-muted'
                  }`}
                >
                  {index < currentPhase ? (
                    <CheckCircle className="w-4 h-4" />
                  ) : index === currentPhase ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <phase.icon className="w-4 h-4" />
                  )}
                </div>
                <span className="text-sm font-medium">{phase.text}</span>
              </motion.div>
            ))}
          </div>
        </motion.div>
      </div>
    </PageTransition>
  );
};

export default AssessmentScreen;
