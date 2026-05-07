'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Download } from 'lucide-react';
import { useAppStore } from '@/lib/store';
import { Button } from '@/components/ui/button';

// Install Prompt Banner Component
const InstallBanner = () => {
  const { showInstallPrompt, setShowInstallPrompt } = useAppStore();
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);

  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setShowInstallPrompt(true);
    };

    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, [setShowInstallPrompt]);

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setShowInstallPrompt(false);
    }
    setDeferredPrompt(null);
  };

  if (!showInstallPrompt) return null;

  return (
    <motion.div
      initial={{ y: -100, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      exit={{ y: -100, opacity: 0 }}
      className="install-banner fixed top-0 left-0 right-0 z-50 safe-area-top"
    >
      <div className="bg-gradient-to-r from-[#1a5f2a] to-[#2a7f3a] text-white px-4 py-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-white/20 rounded-lg flex items-center justify-center">
            <Download className="w-5 h-5" />
          </div>
          <div>
            <p className="font-medium text-sm">Install AWE System</p>
            <p className="text-xs text-white/80">Add to home screen for quick access</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="ghost"
            className="text-white hover:bg-white/20 h-9"
            onClick={() => setShowInstallPrompt(false)}
          >
            Later
          </Button>
          <Button
            size="sm"
            className="bg-white text-[#1a5f2a] hover:bg-white/90 h-9"
            onClick={handleInstall}
          >
            Install
          </Button>
        </div>
      </div>
    </motion.div>
  );
};

export default InstallBanner;
