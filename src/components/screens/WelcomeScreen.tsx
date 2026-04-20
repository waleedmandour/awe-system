'use client';

import { useState, useEffect, useRef } from 'react';
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
  // Optimised timeline — total ~2s splash (was 3.5s):
  // 0-0.6s:  Icon scales in with spring overshoot + glow ring expands
  // 0.6-1.4s: Hold with gentle pulse + refined particles
  // 1.4-2.0s: Glow expands outward, icon fades, cross-fade to welcome

  const [phase, setPhase] = useState<'reveal' | 'hold' | 'settle'>('reveal');

  // Stable particle positions (avoid re-randomise on every render)
  const particles = useRef(
    [...Array(8)].map((_, i) => ({
      id: i,
      x: 30 + ((i * 47 + 13) % 40), // deterministic spread 30-70 %
      y: 25 + ((i * 31 + 7) % 50),  // deterministic spread 25-75 %
      size: 3 + (i % 3),
      duration: 1.8 + i * 0.15,
      delay: i * 0.08,
      drift: (i % 2 === 0 ? 1 : -1) * (10 + (i % 4) * 5),
    }))
  ).current;

  useEffect(() => {
    const holdTimer = setTimeout(() => setPhase('hold'), 600);
    const settleTimer = setTimeout(() => setPhase('settle'), 1400);
    const completeTimer = setTimeout(() => onComplete(), 2000);

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
        className="absolute w-[500px] h-[500px] rounded-full"
        style={{
          background: 'radial-gradient(circle, rgba(26,95,42,0.06) 0%, transparent 70%)',
        }}
        initial={{ scale: 0, opacity: 0 }}
        animate={{
          scale: phase === 'reveal' ? [0, 1.1] : phase === 'hold' ? [1.1, 1.15, 1.1] : [1.1, 2.2],
          opacity: phase === 'settle' ? 0 : 0.8,
        }}
        transition={{
          duration: phase === 'reveal' ? 0.6 : 0.8,
          ease: phase === 'reveal' ? [0.22, 1, 0.36, 1] : 'easeInOut',
        }}
      />

      {/* Refined floating particles */}
      {particles.map((p) => (
        <motion.div
          key={p.id}
          className="absolute rounded-full"
          style={{
            width: p.size,
            height: p.size,
            top: `${p.y}%`,
            left: `${p.x}%`,
            background: p.id % 2 === 0
              ? 'radial-gradient(circle, rgba(201,162,39,0.4), transparent)'
              : 'radial-gradient(circle, rgba(26,95,42,0.25), transparent)',
          }}
          initial={{ opacity: 0, scale: 0 }}
          animate={{
            y: [0, -18, 0],
            x: [0, p.drift, 0],
            opacity: [0, 0.5, 0],
            scale: [0, 1.2, 0],
          }}
          transition={{
            duration: p.duration,
            delay: p.delay,
            repeat: Infinity,
            repeatDelay: 0.4,
            ease: 'easeInOut',
          }}
        />
      ))}

      {/* Glow ring — expands smoothly */}
      <motion.div
        className="absolute w-44 h-44 md:w-52 md:h-52 rounded-full"
        style={{
          background: 'conic-gradient(from 90deg, rgba(26,95,42,0.08), rgba(201,162,39,0.12), rgba(26,95,42,0.08))',
          border: '1.5px solid rgba(26,95,42,0.12)',
        }}
        initial={{ scale: 0, opacity: 0, rotate: -90 }}
        animate={{
          scale: phase === 'reveal' ? [0, 1.2] : phase === 'hold' ? [1.2, 1.25, 1.2] : [1.2, 2.5],
          opacity: phase === 'reveal' ? [0, 1] : phase === 'settle' ? [1, 0] : [1, 0.8, 1],
          rotate: phase === 'hold' ? -90 : -180,
        }}
        transition={{
          duration: phase === 'reveal' ? 0.5 : phase === 'hold' ? 0.8 : 0.6,
          ease: [0.22, 1, 0.36, 1],
        }}
      />

      {/* iAWE Icon — spring-based scale-in */}
      <motion.div
        className="absolute"
        initial={{ scale: 0, opacity: 0, y: 8 }}
        animate={{
          scale: phase === 'reveal' ? [0, 1.08, 1] : phase === 'hold' ? [1, 1.02, 1] : [1, 1.01],
          opacity: phase === 'reveal' ? [0, 1] : 1,
          y: 0,
        }}
        transition={{
          duration: phase === 'reveal' ? 0.7 : 0.8,
          ease: phase === 'reveal' ? [0.34, 1.56, 0.64, 1] : 'easeInOut', // spring overshoot
        }}
      >
        <div className="w-28 h-28 md:w-36 md:h-36 rounded-2xl shadow-2xl overflow-hidden bg-white p-1.5 relative">
          <img
            src="/cps_logo.png"
            alt="iAWE System"
            className="w-full h-full object-contain"
            draggable={false}
          />
          {/* Subtle ambient glow */}
          <motion.div
            className="absolute -inset-3 rounded-3xl -z-10"
            style={{
              background: 'linear-gradient(135deg, rgba(26,95,42,0.12), rgba(201,162,39,0.12))',
              filter: 'blur(8px)',
            }}
            animate={{
              opacity: phase === 'settle' ? [0.6, 0.3, 0.6] : [0, 0.6, 0],
              scale: phase === 'settle' ? [1, 1.05, 1] : 1,
            }}
            transition={{
              duration: 1.2,
              repeat: phase === 'settle' ? 1 : 0,
              ease: 'easeInOut',
            }}
          />
        </div>
      </motion.div>

      {/* Fast fade-out overlay for clean transition */}
      <AnimatePresence>
        {phase === 'settle' && (
          <motion.div
            className="absolute inset-0 bg-white"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.4, ease: 'easeOut' }}
          />
        )}
      </AnimatePresence>
    </div>
  );
};

// ─── Welcome Screen Component ──────────────────────────────────────────────────

const WelcomeScreen = ({ onGetStarted }: { onGetStarted: () => void }) => {
  const [showContent, setShowContent] = useState(false);
  const [animationComplete, setAnimationComplete] = useState(false);

  useEffect(() => {
    if (animationComplete) {
      const timer = setTimeout(() => setShowContent(true), 200);
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
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
          className="flex flex-col items-center"
        >
          {/* App Logo with enhanced entrance */}
          <motion.div
            initial={{ y: -12, scale: 0.95 }}
            animate={{ y: 0, scale: 1 }}
            transition={{ delay: 0.1, duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
            className="relative mb-8"
          >
            <div className="w-32 h-32 md:w-40 md:h-40 rounded-3xl shadow-xl overflow-hidden bg-white p-2">
              <img
                src="/iawe-icon.png"
                alt="iAWE System"
                className="w-full h-full object-contain"
                draggable={false}
              />
            </div>
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.35, type: 'spring', stiffness: 400, damping: 15 }}
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
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2, duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
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
            transition={{ delay: 0.3, duration: 0.35 }}
            className="text-center text-muted-foreground max-w-xs mb-12 text-sm md:text-base"
          >
            Center for Preparatory Studies&apos;s AI-powered essay assessment platform for Foundation and Credit courses
          </motion.p>
        </motion.div>

        {/* Features */}
        <AnimatePresence>
          {showContent && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15, duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
              className="w-full max-w-sm space-y-3 mb-12"
            >
              {[
                { icon: Camera, text: 'Scan handwritten essays' },
                { icon: Cpu, text: 'AI-powered assessment' },
                { icon: BarChart3, text: 'Detailed feedback & scores' },
              ].map((feature, index) => (
                <motion.div
                  key={feature.text}
                  initial={{ opacity: 0, x: -14 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.35 + index * 0.07, duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
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
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.55, duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
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
