'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import {
  Camera,
  Cpu,
  BarChart3,
  Sparkles,
  ChevronRight,
} from 'lucide-react';
import { PageTransition } from '@/lib/animations';

// ─── Icon Reveal Animation Component ───────────────────────────────────────────

const IconRevealAnimation = ({ onComplete }: { onComplete: () => void }) => {
  // Phase timeline:
  // 0-1.5s: iAWE icon scales up from center with glow ring
  // 1.5-2.5s: Hold with pulse glow and floating particles
  // 2.5-3.5s: Glow expands outward, icon settles, fade to welcome screen

  const [phase, setPhase] = useState<'reveal' | 'hold' | 'settle'>('reveal');

  useEffect(() => {
    const holdTimer = setTimeout(() => setPhase('hold'), 1500);
    const settleTimer = setTimeout(() => setPhase('settle'), 2500);
    const completeTimer = setTimeout(() => onComplete(), 3500);

    return () => {
      clearTimeout(holdTimer);
      clearTimeout(settleTimer);
      clearTimeout(completeTimer);
    };
  }, [onComplete]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-gradient-to-b from-white via-[#f0fdf4] to-white overflow-hidden">
      {/* Background radial glow */}
      <motion.div
        className="absolute w-[600px] h-[600px] rounded-full"
        style={{
          background: 'radial-gradient(circle, rgba(26,95,42,0.08) 0%, transparent 70%)',
        }}
        animate={{
          scale: phase === 'reveal' ? [0.5, 1.2] : phase === 'hold' ? [1.2, 1.3, 1.2] : [1.2, 2],
          opacity: phase === 'settle' ? 0 : 1,
        }}
        transition={{ duration: 1, ease: 'easeInOut' }}
      />

      {/* Floating particles */}
      {[...Array(6)].map((_, i) => (
        <motion.div
          key={i}
          className="absolute w-2 h-2 rounded-full bg-[#c9a227]/30"
          style={{
            top: `${20 + Math.random() * 60}%`,
            left: `${20 + Math.random() * 60}%`,
          }}
          animate={{
            y: [0, -30, 0],
            x: [0, (i % 2 === 0 ? 1 : -1) * 15, 0],
            opacity: [0.2, 0.6, 0.2],
            scale: [0.8, 1.2, 0.8],
          }}
          transition={{
            duration: 2 + i * 0.3,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
        />
      ))}

      {/* Center glow ring */}
      <AnimatePresence>
        {(phase === 'reveal' || phase === 'hold') && (
          <motion.div
            className="absolute w-48 h-48 md:w-56 md:h-56 rounded-full border-2 border-[#1a5f2a]/20"
            initial={{ scale: 0, opacity: 0 }}
            animate={{
              scale: phase === 'reveal' ? [0, 1.3] : [1.3, 1.4, 1.3],
              opacity: phase === 'reveal' ? [0, 0.8] : [0.8, 1, 0.8],
            }}
            exit={{ scale: 2, opacity: 0 }}
            transition={{ duration: 1, ease: 'easeOut' }}
          />
        )}
      </AnimatePresence>

      {/* iAWE Icon — scales up from center */}
      <motion.div
        className="absolute"
        initial={{ scale: 0, opacity: 0 }}
        animate={{
          scale: phase === 'reveal' ? [0, 1] : phase === 'hold' ? [1, 1.05, 1] : 1,
          opacity: phase === 'reveal' ? [0, 1] : 1,
        }}
        transition={{
          duration: phase === 'reveal' ? 1.5 : phase === 'hold' ? 1 : 1,
          ease: [0.16, 1, 0.3, 1],
        }}
      >
        <div className="w-28 h-28 md:w-36 md:h-36 rounded-2xl shadow-2xl overflow-hidden bg-white p-1.5 relative">
          <img
            src="/iawe-icon.png"
            alt="iAWE System"
            className="w-full h-full object-contain"
          />
          {/* Pulsing glow behind icon during settle */}
          <motion.div
            className="absolute -inset-2 rounded-3xl -z-10"
            style={{
              background: 'linear-gradient(135deg, rgba(26,95,42,0.15), rgba(201,162,39,0.15))',
            }}
            animate={{
              scale: phase === 'settle' ? [1, 1.05, 1] : 1,
              opacity: phase === 'settle' ? [0.5, 1, 0.5] : 0,
            }}
            transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
          />
        </div>
      </motion.div>
    </div>
  );
};

// ─── Welcome Screen Component ──────────────────────────────────────────────────

const WelcomeScreen = ({ onGetStarted }: { onGetStarted: () => void }) => {
  const [showContent, setShowContent] = useState(false);
  const [animationComplete, setAnimationComplete] = useState(false);

  useEffect(() => {
    if (animationComplete) {
      const timer = setTimeout(() => setShowContent(true), 300);
      return () => clearTimeout(timer);
    }
  }, [animationComplete]);

  // Show the reveal animation first, then the actual welcome screen
  if (!animationComplete) {
    return <IconRevealAnimation onComplete={() => setAnimationComplete(true)} />;
  }

  return (
    <PageTransition>
      <div className="min-h-screen min-h-[100dvh] flex flex-col items-center justify-center p-6 safe-area-top safe-area-bottom">
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.5, ease: 'easeOut' }}
          className="flex flex-col items-center"
        >
          {/* New App Logo with enhanced entrance */}
          <motion.div
            initial={{ y: -20 }}
            animate={{ y: 0 }}
            transition={{ delay: 0.2, duration: 0.5 }}
            className="relative mb-8"
          >
            <div className="w-32 h-32 md:w-40 md:h-40 rounded-3xl shadow-xl overflow-hidden bg-white p-2">
              <img
                src="/iawe-icon.png"
                alt="iAWE System"
                className="w-full h-full object-contain"
              />
            </div>
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.5, type: 'spring', stiffness: 300 }}
              className="absolute -bottom-2 -right-2 w-12 h-12 bg-[#c9a227] rounded-full flex items-center justify-center shadow-lg"
            >
              <Sparkles className="w-6 h-6 text-white" />
            </motion.div>
            {/* Subtle rotating glow ring */}
            <motion.div
              className="absolute -inset-3 rounded-[2rem] -z-10"
              style={{
                background: 'conic-gradient(from 0deg, rgba(26,95,42,0.05), rgba(201,162,39,0.1), rgba(26,95,42,0.05))',
              }}
              animate={{ rotate: 360 }}
              transition={{ duration: 8, repeat: Infinity, ease: 'linear' }}
            />
          </motion.div>

          {/* App Title */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4, duration: 0.5 }}
            className="text-center mb-4"
          >
            <h1 className="text-3xl md:text-4xl font-bold text-[#1a5f2a] mb-2">
              iAWE System
            </h1>
            <p className="text-lg text-[#c9a227] font-medium">
              Intelligent Automated Writing Evaluation
            </p>
          </motion.div>

          {/* Description */}
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.6, duration: 0.5 }}
            className="text-center text-muted-foreground max-w-xs mb-12 text-sm md:text-base"
          >
            Center for Preparatory Studies&apos;s AI-powered essay assessment platform for Foundation and Credit courses
          </motion.p>
        </motion.div>

        {/* Features */}
        <AnimatePresence>
          {showContent && (
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3, duration: 0.5 }}
              className="w-full max-w-sm space-y-3 mb-12"
            >
              {[
                { icon: Camera, text: 'Scan handwritten essays' },
                { icon: Cpu, text: 'AI-powered assessment' },
                { icon: BarChart3, text: 'Detailed feedback & scores' },
              ].map((feature, index) => (
                <motion.div
                  key={feature.text}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.7 + index * 0.1 }}
                  className="flex items-center gap-3 p-3 bg-muted/50 rounded-xl"
                >
                  <div className="w-10 h-10 rounded-full bg-[#1a5f2a]/10 flex items-center justify-center">
                    <feature.icon className="w-5 h-5 text-[#1a5f2a]" />
                  </div>
                  <span className="text-sm font-medium">{feature.text}</span>
                </motion.div>
              ))}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Get Started Button */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1, duration: 0.5 }}
          className="w-full max-w-sm"
        >
          <Button
            onClick={onGetStarted}
            className="w-full h-14 text-lg font-semibold bg-[#1a5f2a] hover:bg-[#1a5f2a]/90 rounded-2xl shadow-lg shadow-[#1a5f2a]/25 ios-press"
          >
            Get Started
            <ChevronRight className="w-5 h-5 ml-2" />
          </Button>
        </motion.div>
      </div>
    </PageTransition>
  );
};

export default WelcomeScreen;
