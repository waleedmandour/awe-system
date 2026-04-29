'use client';

import { useState, useEffect, useCallback } from 'react';
import { AnimatePresence } from 'framer-motion';
import { useAppStore, type Assessment } from '@/lib/store';
import { useToast } from '@/hooks/use-toast';

// Layout components
import InstallBanner from '@/components/layout/InstallBanner';
import OfflineIndicator from '@/components/layout/OfflineIndicator';
import BottomNav from '@/components/layout/BottomNav';

// Screen components
import WelcomeScreen from '@/components/screens/WelcomeScreen';
import SetupScreen from '@/components/screens/SetupScreen';
import CourseSelectionScreen from '@/components/screens/CourseSelectionScreen';
import UploadScreen from '@/components/screens/UploadScreen';
import ProcessingScreen from '@/components/screens/ProcessingScreen';
import ReviewScreen from '@/components/screens/ReviewScreen';
import AssessmentScreen from '@/components/screens/AssessmentScreen';
import ResultsScreen from '@/components/screens/ResultsScreen';
import RecordsScreen from '@/components/screens/RecordsScreen';

// ─── Main App Component (Orchestrator) ─────────────────────────────────────────

export default function AWEApp() {
  const {
    currentStep,
    setStep,
    geminiApiKey,
    selectedCourse,
    extractedText,
    setExtractedText,
    currentAssessment,
    setCurrentAssessment,
    resetAssessment,
    setProcessing,
  } = useAppStore();

  const { toast } = useToast();

  const [direction, setDirection] = useState<'left' | 'right'>('right');

  // Determine initial step based on state
  useEffect(() => {
    if (!geminiApiKey && currentStep === 'welcome') {
      // Show setup after welcome if no API key — handled in navigateTo
    }
  }, [geminiApiKey, currentStep]);

  const navigateTo = (step: string) => {
    setDirection('right');
    setStep(step as any);
  };

  const goBack = () => {
    setDirection('left');
    const stepOrder = ['welcome', 'setup', 'course', 'upload', 'processing', 'review', 'assessing', 'results', 'records'];
    const currentIndex = stepOrder.indexOf(currentStep);
    if (currentIndex > 0) {
      setStep(stepOrder[currentIndex - 1] as any);
    }
  };

  // Handle image upload and OCR processing — supports single or multi-page (up to 2)
  const handleImageUpload = async (images: string[]) => {
    const { geminiApiKey } = useAppStore.getState();

    // Check if API key is available
    if (!geminiApiKey) {
      toast({
        title: 'API Key Required',
        description: 'Please configure your Gemini API key in settings.',
        variant: 'destructive',
      });
      return;
    }

    setStep('processing');
    const pageCount = images.length;
    setProcessing(true, `Extracting text from ${pageCount} page${pageCount > 1 ? 's' : ''}...`);

    try {
      // Call the OCR API endpoint with array of images (processed in order)
      const response = await fetch('/api/ocr', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          images, // Array of base64/data-uri image strings, in page order
          geminiApiKey: geminiApiKey || undefined,
          useGemini: true,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to process image');
      }

      // Use the actual extracted text from the API (already combined in page order)
      const extractedText = result.text || '';

      if (!extractedText.trim()) {
        toast({
          title: 'No Text Found',
          description: 'Could not extract any text from the image. Please try a clearer image.',
          variant: 'destructive',
        });
        setProcessing(false);
        setStep('upload');
        return;
      }

      setExtractedText(extractedText);
      setProcessing(false);
      // Record OCR completion time for cooldown timer
      useAppStore.getState().setOcrCompletedAt(Date.now());
      setStep('review');
    } catch (error) {
      console.error('OCR processing error:', error);
      setProcessing(false);
      toast({
        title: 'OCR Failed',
        description: error instanceof Error ? error.message : 'Failed to extract text from image.',
        variant: 'destructive',
      });
      setStep('upload');
    }
  };

  // Handle assessment submission
  const handleSubmitEssay = async (text: string) => {
    setStep('assessing');
    // Assessment will be handled by AssessmentScreen
  };

  // Handle assessment completion — wrapped in useCallback for stable reference
  const handleAssessmentComplete = useCallback((assessment: Assessment) => {
    setCurrentAssessment(assessment);
    // Auto-save record
    const { selectedCourse, extractedText, addRecord } = useAppStore.getState();
    addRecord({
      id: `rec-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      assessment,
      course: selectedCourse,
      essayText: extractedText,
      createdAt: new Date().toISOString(),
    });
    setStep('results');
  }, []);

  // Handle new assessment
  const handleNewAssessment = () => {
    resetAssessment();
    setStep('welcome');
  };

  // ─── Step-based routing ────────────────────────────────────────────────────

  const renderScreen = () => {
    switch (currentStep) {
      case 'welcome':
        return (
          <WelcomeScreen
            onGetStarted={() => navigateTo(geminiApiKey ? 'course' : 'setup')}
          />
        );
      case 'setup':
        return (
          <SetupScreen
            onComplete={() => navigateTo('course')}
          />
        );
      case 'course':
        return (
          <CourseSelectionScreen
            onSelect={() => navigateTo('upload')}
            onBack={goBack}
          />
        );
      case 'upload':
        return (
          <UploadScreen
            onUpload={handleImageUpload}
            onBack={goBack}
          />
        );
      case 'processing':
        return (
          <ProcessingScreen />
        );
      case 'review':
        return (
          <ReviewScreen
            onSubmit={handleSubmitEssay}
            onBack={goBack}
          />
        );
      case 'assessing':
        return (
          <AssessmentScreen
            onComplete={handleAssessmentComplete}
          />
        );
      case 'results':
        return (
          <ResultsScreen
            assessment={currentAssessment!}
            onNewAssessment={handleNewAssessment}
            onBack={goBack}
          />
        );
      case 'records':
        return (
          <RecordsScreen
            onBack={goBack}
            onNewAssessment={handleNewAssessment}
          />
        );
      default:
        return <WelcomeScreen onGetStarted={() => navigateTo('setup')} />;
    }
  };

  // ─── BottomNav visibility ───────────────────────────────────────────────────

  const shouldShowBottomNav = !['processing', 'assessing'].includes(currentStep);

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="mobile-container bg-background">
      <OfflineIndicator />
      <InstallBanner />

      <AnimatePresence mode="wait" custom={direction}>
        {renderScreen()}
      </AnimatePresence>

      {shouldShowBottomNav && currentStep !== 'welcome' && currentStep !== 'setup' && (
        <BottomNav currentStep={currentStep} onNavigate={navigateTo} />
      )}

      {/* Footer Credits */}
      <footer className="text-center py-3 text-xs text-muted-foreground border-t bg-white/80 backdrop-blur-sm">
        <p>Developed by: <span className="font-medium text-[#1a5f2a]">Dr. Waleed Mandour</span></p>
        <p>AI Co-Marker Assistance Project, 2026</p>
      </footer>
    </div>
  );
}
