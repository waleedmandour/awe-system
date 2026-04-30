'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useAppStore } from '@/lib/store';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';
import {
  ChevronLeft,
  ChevronRight,
  CheckCircle,
  Edit3,
  AlertCircle,
  Timer,
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

// Cooldown duration in seconds (90 seconds = 1.5 minutes)
const COOLDOWN_SECONDS = 90;

// Review Screen Component
const ReviewScreen = ({ onSubmit, onBack }: { onSubmit: (text: string) => void; onBack: () => void }) => {
  const { extractedText, setExtractedText, selectedCourse, ocrCompletedAt } = useAppStore();
  const [editedText, setEditedText] = useState(extractedText);
  const [isEditing, setIsEditing] = useState(false);
  const [cooldownRemaining, setCooldownRemaining] = useState(0);

  const wordCount = editedText.trim().split(/\s+/).filter(Boolean).length;
  const charCount = editedText.length;

  // Cooldown timer: count down from OCR completion time
  useEffect(() => {
    if (!ocrCompletedAt) {
      setCooldownRemaining(0);
      return;
    }

    const calculateRemaining = () => {
      const elapsed = Math.floor((Date.now() - ocrCompletedAt) / 1000);
      const remaining = Math.max(0, COOLDOWN_SECONDS - elapsed);
      setCooldownRemaining(remaining);
      return remaining;
    };

    // Initial calculation
    const remaining = calculateRemaining();
    if (remaining <= 0) return;

    // Update every second
    const interval = setInterval(() => {
      const rem = calculateRemaining();
      if (rem <= 0) {
        clearInterval(interval);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [ocrCompletedAt]);

  const isCooldownActive = cooldownRemaining > 0;

  const handleSubmit = () => {
    if (editedText.trim().length < 50 || isCooldownActive) {
      return;
    }
    setExtractedText(editedText);
    onSubmit(editedText);
  };

  return (
    <PageTransition>
      <div className="min-h-screen min-h-[100dvh] flex flex-col safe-area-top safe-area-bottom">
        {/* Header */}
        <div className="p-4 border-b bg-white/80 backdrop-blur-sm sticky top-0 z-10">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Button
                variant="ghost"
                size="icon"
                onClick={onBack}
                className="h-10 w-10 rounded-full"
              >
                <ChevronLeft className="w-5 h-5" />
              </Button>
              <div>
                <h2 className="font-semibold text-lg">Review Text</h2>
                <p className="text-sm text-muted-foreground">
                  {selectedCourse?.code} • {wordCount} words
                </p>
              </div>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setIsEditing(!isEditing)}
              className="h-10 w-10 rounded-full"
            >
              {isEditing ? <CheckCircle className="w-5 h-5 text-[#1a5f2a]" /> : <Edit3 className="w-5 h-5" />}
            </Button>
          </div>
        </div>

        {/* Content */}
        <ScrollArea className="flex-1">
          <div className="p-4">
            {isEditing ? (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
              >
                <Textarea
                  value={editedText}
                  onChange={(e) => setEditedText(e.target.value)}
                  placeholder="Your extracted essay text..."
                  className="min-h-[400px] text-base leading-relaxed resize-none border-0 shadow-lg"
                />
              </motion.div>
            ) : (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="bg-card rounded-xl border shadow-sm p-4"
              >
                <p className="text-base leading-relaxed whitespace-pre-wrap">
                  {editedText || (
                    <span className="text-muted-foreground italic">No text extracted. Please edit to add content.</span>
                  )}
                </p>
              </motion.div>
            )}
          </div>
        </ScrollArea>

        {/* Stats Bar */}
        <div className="px-4 py-3 border-t bg-muted/50 flex items-center justify-around">
          <div className="text-center">
            <p className="text-lg font-semibold text-[#1a5f2a]">{wordCount}</p>
            <p className="text-xs text-muted-foreground">Words</p>
          </div>
          <div className="h-8 w-px bg-border" />
          <div className="text-center">
            <p className="text-lg font-semibold text-[#1a5f2a]">{charCount}</p>
            <p className="text-xs text-muted-foreground">Characters</p>
          </div>
          <div className="h-8 w-px bg-border" />
          <div className="text-center">
            <p className="text-lg font-semibold text-[#c9a227]">
              {editedText.split(/[.!?]+/).filter(s => s.trim()).length}
            </p>
            <p className="text-xs text-muted-foreground">Sentences</p>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t bg-white/80 backdrop-blur-sm space-y-3">
          {editedText.trim().length < 50 && (
            <Alert className="bg-amber-50 border-amber-200 dark:bg-amber-950 dark:border-amber-800">
              <AlertCircle className="w-4 h-4 text-amber-600 dark:text-amber-400" />
              <AlertDescription className="text-sm text-amber-700 dark:text-amber-300">
                Please add more text (minimum 50 characters required).
              </AlertDescription>
            </Alert>
          )}
          {isCooldownActive ? (
            <Alert className="bg-blue-50 border-blue-200 dark:bg-blue-950 dark:border-blue-800">
              <Timer className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0" />
              <AlertDescription className="text-sm text-blue-700 dark:text-blue-300">
                <strong>Please wait {cooldownRemaining}s</strong> before submitting for assessment. This cooldown helps avoid Gemini API rate limits. The button will be enabled automatically.
              </AlertDescription>
            </Alert>
          ) : (
            <Alert className="bg-green-50 border-green-200 dark:bg-green-950 dark:border-green-800">
              <CheckCircle className="w-4 h-4 text-green-600 dark:text-green-400 shrink-0" />
              <AlertDescription className="text-sm text-green-700 dark:text-green-300">
                Ready to submit for assessment.
              </AlertDescription>
            </Alert>
          )}
          <Button
            onClick={handleSubmit}
            disabled={editedText.trim().length < 50 || isCooldownActive}
            className="w-full h-12 bg-[#1a5f2a] hover:bg-[#1a5f2a]/90 rounded-xl ios-press"
          >
            {isCooldownActive ? (
              <>
                <Timer className="w-4 h-4 mr-2" />
                Wait {cooldownRemaining}s...
              </>
            ) : (
              <>
                Submit for Assessment
                <ChevronRight className="w-4 h-4 ml-2" />
              </>
            )}
          </Button>
        </div>
      </div>
    </PageTransition>
  );
};

export default ReviewScreen;
