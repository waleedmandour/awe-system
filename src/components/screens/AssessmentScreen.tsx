'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { motion } from 'framer-motion';
import { useAppStore, type Assessment } from '@/lib/store';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/hooks/use-toast';
import { recalculateScores } from '@/lib/scoring-utils';
import { getSharedLocalLLM, resolveLocalAssessmentContext } from '@/lib/local-llm-service';
import { ModelDownloader } from '@/lib/model-downloader';
import {
  FileText,
  CheckCircle,
  BookOpen,
  Target,
  MessageSquare,
  AlertCircle,
  Cpu,
  Loader2,
  RefreshCw,
} from 'lucide-react';

// Auto-retry configuration
const RETRY_DELAY_SECONDS = 30;

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
  const { selectedCourse, extractedText, geminiApiKey, assessmentApiKey, selectedExamType, selectedWritingType, selectedSourceTextId, writingPrompt, useLocalAssessment, preferredLocalModelId, preferredCloudModelId } = useAppStore();
  const [progress, setProgress] = useState(0);
  const [currentPhase, setCurrentPhase] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const [retryCountdown, setRetryCountdown] = useState(0);
  const { toast } = useToast();

  // Refs for race-condition safety
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;
  const completedRef = useRef(false);
  const abortRef = useRef<AbortController | null>(null);
  const retryCountRef = useRef(0);

  const phases = [
    { text: 'Analyzing structure', icon: FileText },
    { text: 'Evaluating grammar', icon: CheckCircle },
    { text: 'Assessing vocabulary', icon: BookOpen },
    { text: 'Checking coherence', icon: Target },
    { text: 'Generating feedback', icon: MessageSquare },
  ];

  // Core assessment function — callable multiple times for auto-retry
  const performAssessment = useCallback(async () => {
    // Cancel any in-flight request
    if (abortRef.current) {
      abortRef.current.abort();
    }
    const controller = new AbortController();
    abortRef.current = controller;

    // Clear error/retry state for fresh attempt
    setError(null);
    setRetryCountdown(0);
    setProgress(0);
    setCurrentPhase(0);

    try {
      // ── Local-first assessment (on-device, works offline, fully private) ──
      // When enabled in Settings, the essay is scored on-device with the
      // downloaded local model. Any failure automatically falls through to
      // the cloud path below, so the existing cloud behavior is preserved.
      if (useLocalAssessment && preferredLocalModelId) {
        try {
          const downloader = new ModelDownloader();
          if (!(await downloader.hasModel(preferredLocalModelId))) {
            throw new Error('Local model is not downloaded. Falling back to cloud.');
          }

          const { criteria, options } = await resolveLocalAssessmentContext({
            courseCode: selectedCourse?.code,
            writingType: selectedWritingType || undefined,
            sourceTextId: selectedSourceTextId || undefined,
            topic: writingPrompt || null,
          });

          const localLLM = await getSharedLocalLLM(preferredLocalModelId);
          const localAssessment = await localLLM.assessEssay(extractedText, criteria, options);

          // Guard against aborts/duplicates before committing the result.
          if (controller.signal.aborted) return;
          if (completedRef.current) return;
          completedRef.current = true;

          setProgress(100);
          setTimeout(() => onCompleteRef.current(recalculateScores(localAssessment)), 500);
          return;
        } catch (localErr) {
          if (localErr instanceof DOMException && localErr.name === 'AbortError') return;
          if (controller.signal.aborted) return;
          console.warn('Local assessment failed — falling back to cloud.', localErr);
          toast({
            title: 'On-device model failed',
            description: 'Falling back to cloud assessment…',
          });
        }
      }

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
          modelId: preferredCloudModelId || undefined,
          examType: selectedExamType || undefined,
          writingType: selectedWritingType || undefined,
          sourceTextId: selectedSourceTextId || undefined,
        }),
        signal: controller.signal,
      });

      const result = await response.json();

      // Check if this call was aborted during fetch
      if (controller.signal.aborted) return;

      if (!response.ok) {
        const errMsg = result.error || 'Failed to assess essay';
        const detail = result.details ? ` (${result.details})` : '';
        throw new Error(errMsg + detail);
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

      // Guard: only complete once (prevent race condition where duplicate call succeeds)
      if (completedRef.current) return;
      completedRef.current = true;

      // Wait for progress to complete before showing results
      setProgress(100);
      setTimeout(() => onCompleteRef.current(assessment), 500);
    } catch (err) {
      // Ignore aborted requests — they are expected during cleanup or retry
      if (err instanceof DOMException && err.name === 'AbortError') return;
      // Ignore if already completed by another call
      if (completedRef.current) return;

      const errorMsg = err instanceof Error ? err.message : 'Failed to assess essay';
      console.error('Assessment error:', err);
      setError(errorMsg);

      // Start auto-retry countdown
      retryCountRef.current += 1;
      setRetryCount(retryCountRef.current);
      setRetryCountdown(RETRY_DELAY_SECONDS);

      toast({
        title: 'Assessment Failed',
        description: `Auto-retrying in ${RETRY_DELAY_SECONDS} seconds... (Attempt ${retryCountRef.current})`,
        variant: 'destructive',
      });
    }
  }, [extractedText, selectedCourse, geminiApiKey, assessmentApiKey, selectedExamType, writingPrompt, selectedSourceTextId, useLocalAssessment, preferredLocalModelId, preferredCloudModelId, toast]);

  // Initial mount — start first assessment
  useEffect(() => {
    completedRef.current = false;
    retryCountRef.current = 0;
    performAssessment();

    return () => {
      if (abortRef.current) {
        abortRef.current.abort();
      }
    };
  }, []);

  // Countdown timer — ticks every second when retryCountdown > 0
  useEffect(() => {
    if (retryCountdown <= 0) return;

    const timer = setTimeout(() => {
      setRetryCountdown(prev => prev - 1);
    }, 1000);

    return () => clearTimeout(timer);
  }, [retryCountdown]);

  // Auto-retry trigger — when countdown reaches 0 and there's still an error
  useEffect(() => {
    if (retryCountdown === 0 && error !== null && !completedRef.current && retryCountRef.current > 0) {
      performAssessment();
    }
  }, [retryCountdown, error, performAssessment]);

  // Progress animation — runs when actively assessing (no error shown)
  useEffect(() => {
    if (error !== null) return;

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
  }, [error]);

  // Manual retry — skip countdown and retry immediately
  const handleRetryNow = () => {
    performAssessment();
  };

  // Error + auto-retry countdown UI
  if (error) {
    return (
      <PageTransition>
        <div className="min-h-screen min-h-[100dvh] flex flex-col items-center justify-center p-6 safe-area-top safe-area-bottom">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="w-full max-w-sm text-center"
          >
            <div className="w-20 h-20 rounded-full bg-amber-100 flex items-center justify-center mx-auto mb-6">
              <RefreshCw className="w-10 h-10 text-amber-600" />
            </div>
            <h2 className="text-xl font-semibold mb-2">Assessment Failed</h2>
            <p className="text-muted-foreground text-sm mb-2">{error}</p>
            {retryCountdown > 0 ? (
              <p className="text-sm font-medium text-amber-600 mb-6">
                Auto-retrying in {retryCountdown}s... (Attempt {retryCount})
              </p>
            ) : (
              <p className="text-sm text-muted-foreground mb-6">
                Starting retry...
              </p>
            )}
            <Button
              onClick={handleRetryNow}
              className="bg-[#1a5f2a] hover:bg-[#1a5f2a]/90"
            >
              <RefreshCw className="w-4 h-4 mr-2" />
              Retry Now
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
