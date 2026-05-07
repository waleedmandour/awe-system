'use client';

import { motion, type Variants } from 'framer-motion';
import { ReactNode } from 'react';

// Animation variants
const fadeInUp: Variants = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -20 },
};

const fadeIn: Variants = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  exit: { opacity: 0 },
};

const scaleIn: Variants = {
  initial: { opacity: 0, scale: 0.95 },
  animate: { opacity: 1, scale: 1 },
  exit: { opacity: 0, scale: 0.95 },
};

const slideInRight: Variants = {
  initial: { opacity: 0, x: 50 },
  animate: { opacity: 1, x: 0 },
  exit: { opacity: 0, x: -50 },
};

const slideInLeft: Variants = {
  initial: { opacity: 0, x: -50 },
  animate: { opacity: 1, x: 0 },
  exit: { opacity: 0, x: 50 },
};

// Page transition wrapper
const PageTransition = ({ children, direction = 'right' }: { children: ReactNode; direction?: 'left' | 'right' }) => (
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

export { fadeInUp, fadeIn, scaleIn, slideInRight, slideInLeft, PageTransition };
