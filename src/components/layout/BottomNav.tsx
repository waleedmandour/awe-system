'use client';

import { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import {
  Home,
  BookOpen,
  Camera,
  BarChart3,
  History,
} from 'lucide-react';

// Bottom Navigation Component with autohide on scroll
const BottomNav = ({ currentStep, onNavigate }: { currentStep: string; onNavigate: (step: string) => void }) => {
  const [isVisible, setIsVisible] = useState(true);
  const lastScrollY = useRef(0);
  const touchStartY = useRef(0);

  useEffect(() => {
    let ticking = false;

    const handleScroll = () => {
      if (!ticking) {
        window.requestAnimationFrame(() => {
          const currentScrollY = window.scrollY;
          const scrollDelta = currentScrollY - lastScrollY.current;

          // Hide when scrolling down past 20px, show when scrolling up
          if (scrollDelta > 20) {
            setIsVisible(false);
          } else if (scrollDelta < -10) {
            setIsVisible(true);
          }

          // Always show when at the top
          if (currentScrollY < 10) {
            setIsVisible(true);
          }

          lastScrollY.current = currentScrollY;
          ticking = false;
        });
        ticking = true;
      }
    };

    const handleTouchStart = (e: TouchEvent) => {
    touchStartY.current = e.touches[0].clientY;
  };

    const handleTouchMove = (e: TouchEvent) => {
    const deltaY = touchStartY.current - e.touches[0].clientY;
    if (deltaY > 30) {
      setIsVisible(false); // scrolling down
    } else if (deltaY < -30) {
      setIsVisible(true); // scrolling up
    }
  };

    window.addEventListener('scroll', handleScroll, { passive: true });
    window.addEventListener('touchstart', handleTouchStart, { passive: true });
    window.addEventListener('touchmove', handleTouchMove, { passive: true });

    return () => {
      window.removeEventListener('scroll', handleScroll);
      window.removeEventListener('touchstart', handleTouchStart);
      window.removeEventListener('touchmove', handleTouchMove);
    };
  }, []);

  // Show nav immediately when step changes
  useEffect(() => {
    // Re-show nav on step change; this intentional setState-in-effect
    // is acceptable since it's a one-shot UI reset, not cascading state.
    setIsVisible(true); // eslint-disable-line react-hooks/set-state-in-effect
  }, [currentStep]);

  const navItems = [
    { id: 'home', step: 'welcome', icon: Home, label: 'Home' },
    { id: 'courses', step: 'course', icon: BookOpen, label: 'Courses' },
    { id: 'upload', step: 'upload', icon: Camera, label: 'Upload' },
    { id: 'results', step: 'results', icon: BarChart3, label: 'Results' },
    { id: 'records', step: 'records', icon: History, label: 'Records' },
  ];

  return (
    <motion.div
      animate={{ y: isVisible ? 0 : 100 }}
      transition={{ type: 'spring', stiffness: 300, damping: 30 }}
      className="fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-md border-t safe-area-bottom z-40"
    >
      <div className="flex items-center justify-around py-2">
        {navItems.map((item) => {
          const isActive = currentStep === item.step ||
            (item.step === 'results' && ['review', 'assessing', 'results', 'processing'].includes(currentStep));

          return (
            <button
              key={item.id}
              onClick={() => onNavigate(item.step)}
              className={`flex flex-col items-center justify-center py-2 px-4 min-w-[64px] ios-press ${
                isActive ? 'text-[#1a5f2a]' : 'text-muted-foreground'
              }`}
            >
              <item.icon className={`w-6 h-6 ${isActive ? 'text-[#1a5f2a]' : ''}`} />
              <span className="text-xs mt-1 font-medium">{item.label}</span>
              {isActive && (
                <motion.div
                  layoutId="nav-indicator"
                  className="absolute -top-0.5 w-8 h-1 bg-[#1a5f2a] rounded-full"
                />
              )}
            </button>
          );
        })}
      </div>
    </motion.div>
  );
};

export default BottomNav;
