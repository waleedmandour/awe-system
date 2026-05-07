'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Progress } from '@/components/ui/progress';
import {
  Camera,
  FileText,
  CheckCircle,
  Edit3,
  Loader2,
  Target,
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

// Processing Screen (OCR)
// This is a visual-only animation screen. Navigation is controlled by the parent
// via handleImageUpload — the actual OCR API response triggers navigation,
// NOT a timer. This prevents the race condition where the timer completed
// before the OCR result arrived, sending the user to review with empty text.
const ProcessingScreen = () => {
  const [progress, setProgress] = useState(0);
  const [currentStep, setCurrentStep] = useState(0);

  const steps = [
    { text: 'Analyzing image...', icon: Camera },
    { text: 'Detecting text regions...', icon: Target },
    { text: 'Extracting content...', icon: FileText },
    { text: 'Processing handwriting...', icon: Edit3 },
  ];

  useEffect(() => {
    // Animate progress up to 90% — cap it so it stays animated while OCR runs
    const interval = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 90) {
          clearInterval(interval);
          return 90;
        }
        return prev + 1;
      });
    }, 80);

    const stepInterval = setInterval(() => {
      setCurrentStep((prev) => (prev < steps.length - 1 ? prev + 1 : prev));
    }, 1500);

    return () => {
      clearInterval(interval);
      clearInterval(stepInterval);
    };
  }, []);

  return (
    <PageTransition>
      <div className="min-h-screen min-h-[100dvh] flex flex-col items-center justify-center p-6 safe-area-top safe-area-bottom">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="w-full max-w-sm"
        >
          {/* Animated Icon */}
          <div className="flex justify-center mb-8">
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
              className="w-24 h-24 rounded-full border-4 border-muted border-t-[#1a5f2a] flex items-center justify-center"
            >
              <motion.div
                animate={{ scale: [1, 1.1, 1] }}
                transition={{ duration: 1, repeat: Infinity }}
              >
                <FileText className="w-10 h-10 text-[#1a5f2a]" />
              </motion.div>
            </motion.div>
          </div>

          {/* Progress */}
          <div className="text-center mb-8">
            <h2 className="text-xl font-semibold mb-2">Processing Essay</h2>
            <p className="text-muted-foreground text-sm">
              {steps[currentStep]?.text || 'Almost done...'}
            </p>
          </div>

          {/* Progress Bar */}
          <div className="mb-8">
            <Progress value={progress} className="h-2" />
            <p className="text-center text-sm text-muted-foreground mt-2">{progress}%</p>
          </div>

          {/* Steps */}
          <div className="space-y-3">
            {steps.map((step, index) => (
              <motion.div
                key={step.text}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.1 }}
                className={`flex items-center gap-3 p-3 rounded-xl transition-colors ${
                  index < currentStep
                    ? 'bg-[#1a5f2a]/10'
                    : index === currentStep
                    ? 'bg-[#c9a227]/10'
                    : 'bg-muted/50'
                }`}
              >
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center ${
                    index < currentStep
                      ? 'bg-[#1a5f2a] text-white'
                      : index === currentStep
                      ? 'bg-[#c9a227] text-white'
                      : 'bg-muted'
                  }`}
                >
                  {index < currentStep ? (
                    <CheckCircle className="w-4 h-4" />
                  ) : index === currentStep ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <step.icon className="w-4 h-4" />
                  )}
                </div>
                <span
                  className={`text-sm ${
                    index <= currentStep ? 'font-medium' : 'text-muted-foreground'
                  }`}
                >
                  {step.text}
                </span>
              </motion.div>
            ))}
          </div>
        </motion.div>
      </div>
    </PageTransition>
  );
};

export default ProcessingScreen;
