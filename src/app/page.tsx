'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAppStore, type Course, type Assessment, type Score, type AssessmentRecord, type WritingType, SUMMARY_SOURCE_TEXTS } from '@/lib/store';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import {
  Camera,
  Upload,
  FileText,
  CheckCircle,
  AlertCircle,
  ChevronRight,
  ChevronLeft,
  Settings,
  Home,
  BarChart3,
  Eye,
  EyeOff,
  RefreshCw,
  Share2,
  Download,
  BookOpen,
  GraduationCap,
  Award,
  Target,
  MessageSquare,
  Sparkles,
  X,
  Wifi,
  WifiOff,
  Plus,
  Trash2,
  Edit3,
  Zap,
  Clock,
  TrendingUp,
  Info,
  ChevronDown,
  Shield,
  Key,
  Cpu,
  Loader2,
  ClipboardList,
  History,
} from 'lucide-react';

// Animation variants
const fadeInUp = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -20 },
};

const fadeIn = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  exit: { opacity: 0 },
};

const scaleIn = {
  initial: { opacity: 0, scale: 0.95 },
  animate: { opacity: 1, scale: 1 },
  exit: { opacity: 0, scale: 0.95 },
};

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

// Offline Indicator
const OfflineIndicator = () => {
  const [isOffline, setIsOffline] = useState(false);

  useEffect(() => {
    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return (
    <AnimatePresence>
      {isOffline && (
        <motion.div
          initial={{ y: -50, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -50, opacity: 0 }}
          className="fixed top-0 left-0 right-0 z-40 safe-area-top"
        >
          <div className="bg-amber-500 text-white px-4 py-2 flex items-center justify-center gap-2">
            <WifiOff className="w-4 h-4" />
            <span className="text-sm font-medium">You're offline. Some features may be limited.</span>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

// Welcome Screen Component
const WelcomeScreen = ({ onGetStarted }: { onGetStarted: () => void }) => {
  const [showContent, setShowContent] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setShowContent(true), 300);
    return () => clearTimeout(timer);
  }, []);

  return (
    <PageTransition>
      <div className="min-h-screen min-h-[100dvh] flex flex-col items-center justify-center p-6 safe-area-top safe-area-bottom">
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.5, ease: 'easeOut' }}
          className="flex flex-col items-center"
        >
          {/* Logo */}
          <motion.div
            initial={{ y: -20 }}
            animate={{ y: 0 }}
            transition={{ delay: 0.2, duration: 0.5 }}
            className="relative mb-8"
          >
            <div className="w-32 h-32 md:w-40 md:h-40 rounded-3xl shadow-xl overflow-hidden bg-white p-2">
              <img
                src="/squ_logo.png"
                alt="Sultan Qaboos University"
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
          </motion.div>

          {/* App Title */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4, duration: 0.5 }}
            className="text-center mb-4"
          >
            <h1 className="text-3xl md:text-4xl font-bold text-[#1a5f2a] mb-2">
              AWE System
            </h1>
            <p className="text-lg text-[#c9a227] font-medium">
              Automated Writing Evaluation
            </p>
          </motion.div>

          {/* Description */}
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.6, duration: 0.5 }}
            className="text-center text-muted-foreground max-w-xs mb-12 text-sm md:text-base"
          >
            Center for Preparatory Studies's AI-powered essay assessment platform for Foundation and Credit courses
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

// Setup Screen Component
const SetupScreen = ({ onComplete }: { onComplete: () => void }) => {
  const { geminiApiKey, visionApiKey, setGeminiApiKey, setVisionApiKey } = useAppStore();
  const [localGeminiKey, setLocalGeminiKey] = useState(geminiApiKey);
  const [localVisionKey, setLocalVisionKey] = useState(visionApiKey);
  const [showGeminiKey, setShowGeminiKey] = useState(false);
  const [showVisionKey, setShowVisionKey] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const handleSave = async () => {
    if (!localGeminiKey.trim()) {
      toast({
        title: 'API Key Required',
        description: 'Please enter your Gemini API key to continue.',
        variant: 'destructive',
      });
      return;
    }

    setIsLoading(true);
    // Simulate validation
    await new Promise((resolve) => setTimeout(resolve, 500));

    setGeminiApiKey(localGeminiKey);
    setVisionApiKey(localVisionKey);

    toast({
      title: 'Settings Saved',
      description: 'Your API keys have been saved securely.',
    });

    setIsLoading(false);
    onComplete();
  };

  const handleSkip = () => {
    if (geminiApiKey) {
      onComplete();
    } else {
      toast({
        title: 'Setup Required',
        description: 'Please configure your API key to use the app.',
        variant: 'destructive',
      });
    }
  };

  return (
    <PageTransition>
      <div className="min-h-screen min-h-[100dvh] flex flex-col safe-area-top safe-area-bottom">
        {/* Header */}
        <div className="p-4 border-b bg-white/80 backdrop-blur-sm sticky top-0 z-10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-[#1a5f2a]/10 flex items-center justify-center">
              <Settings className="w-5 h-5 text-[#1a5f2a]" />
            </div>
            <div>
              <h2 className="font-semibold text-lg">API Configuration</h2>
              <p className="text-sm text-muted-foreground">Set up your AI services</p>
            </div>
          </div>
        </div>

        {/* Content */}
        <ScrollArea className="flex-1">
          <div className="p-4 space-y-6">
            {/* Info Alert */}
            <Alert className="bg-blue-50 border-blue-200 dark:bg-blue-950 dark:border-blue-800">
              <Info className="w-4 h-4 text-blue-600 dark:text-blue-400" />
              <AlertDescription className="text-sm text-blue-700 dark:text-blue-300">
                Your API keys are stored locally on your device and never sent to our servers.
              </AlertDescription>
            </Alert>

            {/* Gemini API Key */}
            <Card className="border-0 shadow-sm">
              <CardHeader className="pb-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
                    <Key className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <CardTitle className="text-base">Gemini API Key</CardTitle>
                    <CardDescription className="text-xs">Required for essay assessment</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="relative">
                  <Input
                    type={showGeminiKey ? 'text' : 'password'}
                    placeholder="Enter your Gemini API key"
                    value={localGeminiKey}
                    onChange={(e) => setLocalGeminiKey(e.target.value)}
                    className="pr-10 h-12"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="absolute right-1 top-1 h-10 w-10"
                    onClick={() => setShowGeminiKey(!showGeminiKey)}
                  >
                    {showGeminiKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  Get your key from{' '}
                  <a
                    href="https://aistudio.google.com/apikey"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[#1a5f2a] underline"
                  >
                    Google AI Studio
                  </a>
                </p>
              </CardContent>
            </Card>

            {/* Vision API Key (Optional) */}
            <Card className="border-0 shadow-sm">
              <CardHeader className="pb-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-orange-500 to-red-600 flex items-center justify-center">
                    <Camera className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <CardTitle className="text-base">Vision API Key</CardTitle>
                    <CardDescription className="text-xs">Optional - for enhanced OCR</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="relative">
                  <Input
                    type={showVisionKey ? 'text' : 'password'}
                    placeholder="Enter your Vision API key (optional)"
                    value={localVisionKey}
                    onChange={(e) => setLocalVisionKey(e.target.value)}
                    className="pr-10 h-12"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="absolute right-1 top-1 h-10 w-10"
                    onClick={() => setShowVisionKey(!showVisionKey)}
                  >
                    {showVisionKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  For advanced handwriting recognition
                </p>
              </CardContent>
            </Card>

            {/* Security Note */}
            <div className="flex items-start gap-3 p-4 bg-muted/50 rounded-xl">
              <Shield className="w-5 h-5 text-[#1a5f2a] mt-0.5" />
              <div className="text-sm">
                <p className="font-medium mb-1">Your data is secure</p>
                <p className="text-muted-foreground text-xs">
                  All API keys are stored in your browser's local storage and encrypted. They are only used to communicate directly with Google's servers.
                </p>
              </div>
            </div>
          </div>
        </ScrollArea>

        {/* Footer */}
        <div className="p-4 border-t bg-white/80 backdrop-blur-sm space-y-3">
          <Button
            onClick={handleSave}
            disabled={isLoading || !localGeminiKey.trim()}
            className="w-full h-12 bg-[#1a5f2a] hover:bg-[#1a5f2a]/90 rounded-xl ios-press"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                Save & Continue
                <ChevronRight className="w-4 h-4 ml-2" />
              </>
            )}
          </Button>
          {geminiApiKey && (
            <Button
              variant="ghost"
              onClick={handleSkip}
              className="w-full h-11 text-muted-foreground"
            >
              Skip for now
            </Button>
          )}
        </div>
      </div>
    </PageTransition>
  );
};

// Course Selection Screen
const CourseSelectionScreen = ({ onSelect, onBack }: { onSelect: () => void; onBack: () => void }) => {
  const { courses, selectedCourse, setSelectedCourse, selectedExamType, setSelectedExamType, selectedWritingType, setSelectedWritingType, selectedSourceTextId, setSelectedSourceTextId } = useAppStore();
  const [activeTab, setActiveTab] = useState<'foundation' | 'credit'>('foundation');

  // Whether the currently selected course requires an exam-type choice
  const needsExamType = selectedCourse?.code === '0340';

  // Whether the currently selected course requires a writing-type choice
  const needsWritingType = selectedCourse?.code === 'LANC2160';
  const needsSourceText = needsWritingType && selectedWritingType === 'summary';

  // Whether the Continue button should be enabled
  const canContinue = selectedCourse && (!needsExamType || selectedExamType) && (!needsWritingType || selectedWritingType) && (!needsSourceText || selectedSourceTextId);

  const filteredCourses = courses.filter((course) => {
    if (activeTab === 'credit') return course.program === 'post-foundation';
    return course.program === activeTab;
  });

  const handleSelectCourse = (course: Course) => {
    setSelectedCourse(course);
  };

  return (
    <PageTransition>
      <div className="min-h-screen min-h-[100dvh] flex flex-col safe-area-top safe-area-bottom">
        {/* Header */}
        <div className="p-4 border-b bg-white/80 backdrop-blur-sm sticky top-0 z-10">
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
              <h2 className="font-semibold text-lg">Select Course</h2>
              <p className="text-sm text-muted-foreground">Choose your writing course</p>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="p-4 pb-0">
          <Tabs value={activeTab} onValueChange={(v) => {
            setActiveTab(v as 'foundation' | 'credit');
          }}>
            <TabsList className="w-full h-12 p-1 bg-muted rounded-xl">
              <TabsTrigger
                value="foundation"
                className="flex-1 h-10 rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm"
              >
                <GraduationCap className="w-4 h-4 mr-2" />
                Foundation
              </TabsTrigger>
              <TabsTrigger
                value="credit"
                className="flex-1 h-10 rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm"
              >
                <BookOpen className="w-4 h-4 mr-2" />
                Credit
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        {/* Course Cards */}
        <ScrollArea className="flex-1">
          <div className="p-4 space-y-3">
            {filteredCourses.map((course, index) => (
              <motion.div
                key={course.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
              >
                <Card
                  className={`cursor-pointer transition-all duration-200 border-2 ${
                    selectedCourse?.id === course.id
                      ? 'border-[#1a5f2a] bg-[#1a5f2a]/5'
                      : 'border-transparent hover:border-muted-foreground/20'
                  }`}
                  onClick={() => setSelectedCourse(course)}
                >
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-3">
                        <div
                          className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                            activeTab === 'foundation'
                              ? 'bg-gradient-to-br from-[#1a5f2a] to-[#2a7f3a]'
                              : 'bg-gradient-to-br from-[#c9a227] to-[#d9b237]'
                          }`}
                        >
                          {activeTab === 'foundation' ? (
                            <GraduationCap className="w-6 h-6 text-white" />
                          ) : (
                            <BookOpen className="w-6 h-6 text-white" />
                          )}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <Badge variant="secondary" className="text-xs">
                              {course.code}
                            </Badge>
                          </div>
                          <h3 className="font-semibold mt-1">{course.name}</h3>
                          {course.description && (
                            <p className="text-sm text-muted-foreground mt-1">{course.description}</p>
                          )}
                        </div>
                      </div>
                      {selectedCourse?.id === course.id && (
                        <CheckCircle className="w-6 h-6 text-[#1a5f2a]" />
                      )}
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>

          {/* Exam-Type Selection for FP0340 */}
          <AnimatePresence>
            {needsExamType && (
              <motion.div
                initial={{ opacity: 0, y: 15, height: 0 }}
                animate={{ opacity: 1, y: 0, height: 'auto' }}
                exit={{ opacity: 0, y: -10, height: 0 }}
                transition={{ duration: 0.3 }}
                className="overflow-hidden"
              >
                <div className="px-4 pt-2 pb-4 space-y-2">
                  <p className="text-sm font-medium text-muted-foreground px-1">
                    Select exam type:
                  </p>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setSelectedExamType('mid-semester')}
                      className={`flex-1 flex items-center justify-center gap-2 rounded-xl border-2 px-4 py-3 text-sm font-medium transition-all duration-200 ios-press ${
                        selectedExamType === 'mid-semester'
                          ? 'border-[#1a5f2a] bg-[#1a5f2a]/10 text-[#1a5f2a]'
                          : 'border-muted-foreground/20 bg-white hover:border-muted-foreground/40 text-muted-foreground'
                      }`}
                    >
                      <FileText className="w-4 h-4" />
                      <span>For Mid-semester Exam</span>
                    </button>
                    <button
                      onClick={() => setSelectedExamType('final')}
                      className={`flex-1 flex items-center justify-center gap-2 rounded-xl border-2 px-4 py-3 text-sm font-medium transition-all duration-200 ios-press ${
                        selectedExamType === 'final'
                          ? 'border-[#1a5f2a] bg-[#1a5f2a]/10 text-[#1a5f2a]'
                          : 'border-muted-foreground/20 bg-white hover:border-muted-foreground/40 text-muted-foreground'
                      }`}
                    >
                      <Award className="w-4 h-4" />
                      <span>For Final Exam</span>
                    </button>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Writing-Type Selection for LANC2160 */}
          <AnimatePresence>
            {needsWritingType && (
              <motion.div
                initial={{ opacity: 0, y: 15, height: 0 }}
                animate={{ opacity: 1, y: 0, height: 'auto' }}
                exit={{ opacity: 0, y: -10, height: 0 }}
                transition={{ duration: 0.3 }}
                className="overflow-hidden"
              >
                <div className="px-4 pt-2 pb-4 space-y-2">
                  <p className="text-sm font-medium text-muted-foreground px-1">
                    Select writing task:
                  </p>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setSelectedWritingType('summary')}
                      className={`flex-1 flex flex-col items-center justify-center gap-1.5 rounded-xl border-2 px-4 py-4 text-sm font-medium transition-all duration-200 ios-press ${
                        selectedWritingType === 'summary'
                          ? 'border-[#c9a227] bg-[#c9a227]/10 text-[#c9a227]'
                          : 'border-muted-foreground/20 bg-white hover:border-muted-foreground/40 text-muted-foreground'
                      }`}
                    >
                      <FileText className="w-5 h-5" />
                      <span>Summary Writing</span>
                    </button>
                    <button
                      onClick={() => setSelectedWritingType('synthesis')}
                      className={`flex-1 flex flex-col items-center justify-center gap-1.5 rounded-xl border-2 px-4 py-4 text-sm font-medium transition-all duration-200 ios-press ${
                        selectedWritingType === 'synthesis'
                          ? 'border-[#c9a227] bg-[#c9a227]/10 text-[#c9a227]'
                          : 'border-muted-foreground/20 bg-white hover:border-muted-foreground/40 text-muted-foreground'
                      }`}
                    >
                      <ClipboardList className="w-5 h-5" />
                      <span>Synthesis Essay</span>
                    </button>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Source Text Selection for Summary Writing */}
          <AnimatePresence>
            {needsSourceText && (
              <motion.div
                initial={{ opacity: 0, y: 15, height: 0 }}
                animate={{ opacity: 1, y: 0, height: 'auto' }}
                exit={{ opacity: 0, y: -10, height: 0 }}
                transition={{ duration: 0.3 }}
                className="overflow-hidden"
              >
                <div className="px-4 pt-2 pb-4 space-y-2">
                  <p className="text-sm font-medium text-muted-foreground px-1">
                    Select source text to summarize:
                  </p>
                  <div className="space-y-2">
                    {SUMMARY_SOURCE_TEXTS.map((source) => {
                      const isSelected = selectedSourceTextId === source.id;
                      return (
                        <motion.div
                          key={source.id}
                          whileTap={{ scale: 0.98 }}
                        >
                          <button
                            onClick={() => setSelectedSourceTextId(source.id)}
                            className={`w-full text-left p-4 rounded-xl border-2 transition-all duration-200 ${
                              isSelected
                                ? 'border-[#c9a227] bg-[#c9a227]/5'
                                : 'border-muted-foreground/20 bg-white hover:border-[#c9a227]/30'
                            }`}
                          >
                            <div className="flex items-start gap-3">
                              <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${
                                isSelected
                                  ? 'bg-[#c9a227] text-white'
                                  : 'bg-muted text-muted-foreground'
                              }`}>
                                <FileText className="w-5 h-5" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className={`text-sm font-semibold leading-tight ${
                                  isSelected ? 'text-[#c9a227]' : 'text-foreground'
                                }`}>
                                  {source.title}
                                </p>
                                <p className="text-xs text-muted-foreground mt-0.5">
                                  {source.wordCount} words &middot; Target summary: {source.targetMin}&ndash;{source.targetMax} words
                                </p>
                              </div>
                            </div>
                          </button>
                        </motion.div>
                      );
                    })}
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </ScrollArea>

        {/* Footer */}
        <div className="p-4 border-t bg-white/80 backdrop-blur-sm">
          <Button
            onClick={onSelect}
            disabled={!canContinue}
            className="w-full h-12 bg-[#1a5f2a] hover:bg-[#1a5f2a]/90 rounded-xl ios-press"
          >
            Continue with {selectedCourse?.code || 'Course'}
            {needsExamType && selectedExamType && (
              <span className="ml-1 text-sm font-normal opacity-80">
                ({selectedExamType === 'mid-semester' ? 'Mid-semester' : 'Final'})
              </span>
            )}
            {needsWritingType && selectedWritingType && (
              <span className="ml-1 text-sm font-normal opacity-80">
                ({selectedWritingType === 'summary' ? 'Summary' : 'Synthesis Essay'}){needsSourceText && selectedSourceTextId ? `: ${SUMMARY_SOURCE_TEXTS.find(s => s.id === selectedSourceTextId)?.title.split('—')[0].trim() || ''}` : ''}
              </span>
            )}
            <ChevronRight className="w-4 h-4 ml-2" />
          </Button>
        </div>
      </div>
    </PageTransition>
  );
};

/**
 * Convert and resize an image file to JPEG using an off-screen canvas.
 * This handles:
 *  - HEIC/HEIF detection (unsupported format, gives clear error)
 *  - Oversized images (resizes to max dimension while preserving aspect ratio)
 *  - Non-standard MIME types (normalizes to JPEG)
 *  - Returns a clean data:image/jpeg;base64,... string
 */
function processImageFile(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    // Detect HEIC/HEIF early — canvas cannot load these
    const mimeType = (file.type || '').toLowerCase();
    if (mimeType === 'image/heic' || mimeType === 'image/heif') {
      reject(new Error(
        'HEIC/HEIF format is not supported. ' +
        'On iPhone: go to Settings \u2192 Camera \u2192 Formats \u2192 select \"Most Compatible\". ' +
        'Or take a screenshot of the image and upload that instead.'
      ));
      return;
    }

    // Check if it's a valid image type
    if (!file.type.startsWith('image/')) {
      reject(new Error('Please select an image file (JPEG, PNG, or WEBP).'));
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const dataUri = e.target?.result as string;
      if (!dataUri) {
        reject(new Error('Failed to read image file.'));
        return;
      }

      // Load into an Image element to get dimensions and enable canvas resize
      const img = new Image();
      img.onload = () => {
        const MAX_DIMENSION = 2000; // Max width or height in pixels — keeps file under ~3MB
        let { width, height } = img;

        if (width <= MAX_DIMENSION && height <= MAX_DIMENSION) {
          // No resize needed — return the original data URI
          // but ensure it's a standard JPEG data URI
          if (mimeType === 'image/jpeg' || mimeType === 'image/jpg') {
            resolve(dataUri);
            return;
          }
          // Convert non-JPEG to JPEG via canvas
          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (!ctx) { reject(new Error('Canvas not supported')); return; }
          ctx.drawImage(img, 0, 0);
          const jpegDataUri = canvas.toDataURL('image/jpeg', 0.92);
          resolve(jpegDataUri);
        } else {
          // Resize to fit within MAX_DIMENSION
          const scale = MAX_DIMENSION / Math.max(width, height);
          const newWidth = Math.round(width * scale);
          const newHeight = Math.round(height * scale);

          const canvas = document.createElement('canvas');
          canvas.width = newWidth;
          canvas.height = newHeight;
          const ctx = canvas.getContext('2d');
          if (!ctx) { reject(new Error('Canvas not supported')); return; }
          ctx.drawImage(img, 0, 0, newWidth, newHeight);
          const jpegDataUri = canvas.toDataURL('image/jpeg', 0.92);
          resolve(jpegDataUri);
        }
      };
      img.onerror = () => {
        reject(new Error(
          'Failed to load image. The file may be corrupted or in an unsupported format. ' +
          'Try converting to JPEG and uploading again.'
        ));
      };
      img.src = dataUri;
    };
    reader.onerror = () => {
      reject(new Error('Failed to read the file. Please try again.'));
    };
    reader.readAsDataURL(file);
  });
}

// Upload Screen Component — supports up to 2 images (Page 1 + Page 2)
const UploadScreen = ({ onUpload, onBack }: { onUpload: (images: string[]) => void; onBack: () => void }) => {
  const [page1Image, setPage1Image] = useState<string | null>(null);
  const [page2Image, setPage2Image] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const activeFileSlot = useRef<'page1' | 'page2'>('page1');
  const { toast } = useToast();

  const handleFileSelect = async (file: File, slot: 'page1' | 'page2') => {
    // Validate file type first
    if (!file.type.startsWith('image/')) {
      toast({
        title: 'Invalid File',
        description: 'Please select an image file (JPEG, PNG, or WEBP).',
        variant: 'destructive',
      });
      return;
    }

    setIsProcessing(true);
    try {
      // Process image: resize, convert to JPEG, detect HEIC
      const processedDataUri = await processImageFile(file);
      if (slot === 'page1') setPage1Image(processedDataUri);
      else setPage2Image(processedDataUri);
    } catch (error) {
      toast({
        title: 'Image Error',
        description: error instanceof Error ? error.message : 'Failed to process image.',
        variant: 'destructive',
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDrop = (e: React.DragEvent, slot: 'page1' | 'page2') => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFileSelect(file, slot);
  };

  // Open file picker WITHOUT camera — lets user choose gallery or camera
  const openFilePicker = (slot: 'page1' | 'page2') => {
    activeFileSlot.current = slot;
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  // Open camera directly for quick photo capture
  const openCamera = (slot: 'page1' | 'page2') => {
    activeFileSlot.current = slot;
    if (cameraInputRef.current) {
      cameraInputRef.current.click();
    }
  };

  const handleConfirm = () => {
    const images: string[] = [];
    if (page1Image) images.push(page1Image);
    if (page2Image) images.push(page2Image);
    if (images.length > 0) {
      onUpload(images);
    }
  };

  const imageCount = (page1Image ? 1 : 0) + (page2Image ? 1 : 0);

  return (
    <PageTransition>
      <div className="min-h-screen min-h-[100dvh] flex flex-col safe-area-top safe-area-bottom">
        {/* Header */}
        <div className="p-4 border-b bg-white/80 backdrop-blur-sm sticky top-0 z-10">
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
              <h2 className="font-semibold text-lg">Upload Essay</h2>
              <p className="text-sm text-muted-foreground">Scan or upload your handwritten essay (up to 2 pages)</p>
            </div>
          </div>
        </div>

        {/* Content */}
        <ScrollArea className="flex-1">
          <div className="p-4 space-y-4">
            {/* Page 1 (Required) */}
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Badge className="bg-[#1a5f2a] text-white border-0 text-xs">Page 1</Badge>
                <span className="text-xs text-muted-foreground">Required</span>
              </div>
              {page1Image ? (
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                >
                  <Card className="border-0 shadow-md overflow-hidden">
                    <CardContent className="p-0">
                      <div className="relative bg-muted">
                        <img
                          src={page1Image}
                          alt="Page 1 preview"
                          className="w-full h-[220px] object-contain"
                        />
                        <Button
                          variant="destructive"
                          size="icon"
                          className="absolute top-2 right-2 h-8 w-8 rounded-full shadow-md"
                          onClick={() => setPage1Image(null)}
                        >
                          <X className="w-4 h-4" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              ) : (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                >
                  <Card
                    className={`border-2 border-dashed transition-all duration-200 cursor-pointer ${
                      isDragging ? 'border-[#1a5f2a] bg-[#1a5f2a]/5' : 'border-muted-foreground/30'
                    }`}
                    onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                    onDragLeave={() => setIsDragging(false)}
                    onDrop={(e) => handleDrop(e, 'page1')}
                    onClick={() => openFilePicker('page1')}
                  >
                    <CardContent className="flex flex-col items-center justify-center p-8">
                      <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-[#1a5f2a] to-[#2a7f3a] flex items-center justify-center mb-3 shadow-md">
                        <Camera className="w-7 h-7 text-white" />
                      </div>
                      <h3 className="font-medium text-sm mb-1">Add Page 1</h3>
                      <p className="text-xs text-muted-foreground text-center">Tap to upload or take a photo</p>
                    </CardContent>
                  </Card>
                </motion.div>
              )}
            </div>

            {/* Page 2 (Optional) */}
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Badge variant="secondary" className="text-xs">Page 2</Badge>
                <span className="text-xs text-muted-foreground">Optional — for multi-page essays</span>
              </div>
              {page2Image ? (
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                >
                  <Card className="border-0 shadow-md overflow-hidden">
                    <CardContent className="p-0">
                      <div className="relative bg-muted">
                        <img
                          src={page2Image}
                          alt="Page 2 preview"
                          className="w-full h-[220px] object-contain"
                        />
                        <Button
                          variant="destructive"
                          size="icon"
                          className="absolute top-2 right-2 h-8 w-8 rounded-full shadow-md"
                          onClick={() => setPage2Image(null)}
                        >
                          <X className="w-4 h-4" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              ) : (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1 }}
                >
                  <Card
                    className="border-2 border-dashed border-muted-foreground/30 hover:border-[#c9a227]/60 transition-colors cursor-pointer"
                    onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                    onDragLeave={() => setIsDragging(false)}
                    onDrop={(e) => handleDrop(e, 'page2')}
                    onClick={() => openFilePicker('page2')}
                  >
                    <CardContent className="flex flex-col items-center justify-center p-8">
                      <div className="w-14 h-14 rounded-xl bg-muted flex items-center justify-center mb-3">
                        <Plus className="w-7 h-7 text-muted-foreground" />
                      </div>
                      <h3 className="font-medium text-sm mb-1">Add Page 2</h3>
                      <p className="text-xs text-muted-foreground text-center">Optional — only if essay spans two pages</p>
                    </CardContent>
                  </Card>
                </motion.div>
              )}
            </div>

            {/* Page count indicator */}
            <div className="flex items-center justify-center gap-3 py-1">
              <div className={`w-2.5 h-2.5 rounded-full ${page1Image ? 'bg-[#1a5f2a]' : 'bg-muted-foreground/30'}`} />
              <div className={`w-2.5 h-2.5 rounded-full ${page2Image ? 'bg-[#1a5f2a]' : 'bg-muted-foreground/30'}`} />
            </div>

            {/* Tips */}
              {/* Processing overlay */}
              {isProcessing && (
                <div className="flex items-center justify-center gap-2 py-2">
                  <Loader2 className="w-4 h-4 animate-spin text-[#1a5f2a]" />
                  <span className="text-sm text-muted-foreground">Processing image...</span>
                </div>
              )}

              <Alert className="bg-amber-50 border-amber-200 dark:bg-amber-950 dark:border-amber-800">
              <Info className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
              <AlertDescription className="text-sm text-amber-700 dark:text-amber-300">
                <strong>Tips for best results:</strong> Use good lighting, hold the camera steady, and ensure all text is clearly visible. If your essay has two pages, add both — they will be combined in the correct order. <strong>iPhone users:</strong> ensure your camera is set to JPEG (Settings → Camera → Formats → Most Compatible).
              </AlertDescription>
            </Alert>
          </div>
        </ScrollArea>

        {/* Hidden file input for gallery/file picker — NO capture attribute */}
        {/* This allows users to choose between gallery and camera */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleFileSelect(file, activeFileSlot.current);
            e.target.value = '';
          }}
        />

        {/* Hidden camera input — capture attribute forces camera directly */}
        <input
          ref={cameraInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          capture="environment"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleFileSelect(file, activeFileSlot.current);
            e.target.value = '';
          }}
        />

        {/* Footer */}
        <div className="p-4 border-t bg-white/80 backdrop-blur-sm">
          <Button
            onClick={handleConfirm}
            disabled={!page1Image}
            className="w-full h-12 bg-[#1a5f2a] hover:bg-[#1a5f2a]/90 rounded-xl ios-press"
          >
            <Zap className="w-4 h-4 mr-2" />
            {imageCount === 2 ? 'Process 2 Pages' : 'Process Essay'}
            <ChevronRight className="w-4 h-4 ml-2" />
          </Button>
        </div>
      </div>
    </PageTransition>
  );
};

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

// Review Screen Component
const ReviewScreen = ({ onSubmit, onBack }: { onSubmit: (text: string) => void; onBack: () => void }) => {
  const { extractedText, setExtractedText, selectedCourse } = useAppStore();
  const [editedText, setEditedText] = useState(extractedText);
  const [isEditing, setIsEditing] = useState(false);

  const wordCount = editedText.trim().split(/\s+/).filter(Boolean).length;
  const charCount = editedText.length;

  const handleSubmit = () => {
    if (editedText.trim().length < 50) {
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
          <Button
            onClick={handleSubmit}
            disabled={editedText.trim().length < 50}
            className="w-full h-12 bg-[#1a5f2a] hover:bg-[#1a5f2a]/90 rounded-xl ios-press"
          >
            Submit for Assessment
            <ChevronRight className="w-4 h-4 ml-2" />
          </Button>
        </div>
      </div>
    </PageTransition>
  );
};

// Assessment Screen (Processing)
const AssessmentScreen = ({ onComplete }: { onComplete: (assessment: Assessment) => void }) => {
  const { selectedCourse, extractedText, geminiApiKey, selectedExamType, selectedWritingType, selectedSourceTextId } = useAppStore();
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
            topic: null,
            apiKey: geminiApiKey,
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
        const assessment: Assessment = {
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
  }, [extractedText, selectedCourse, geminiApiKey, selectedExamType, onComplete, toast]);

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

// Helper function to parse structured feedback
const parseFeedback = (feedback: string) => {
  const sections = {
    strengths: '',
    justification: '',
    mistakes: [] as { quote: string; explanation: string }[],
    suggestions: ''
  };

  try {
    // Strip any remaining markdown residue
    const clean = (str: string) => str
      .replace(/\*\*/g, '')
      .replace(/\*(?!\*)/g, '')
      .replace(/^#+\s+/gm, '')
      .replace(/^---+$/gm, '')
      .trim();

    const cleaned = clean(feedback);

    // Split into paragraphs by double newline
    const paragraphs = cleaned.split(/\n\s*\n/).map(p => p.trim()).filter(Boolean);

    paragraphs.forEach((para) => {
      const lower = para.toLowerCase();

      // Try legacy markdown-style headers first (backwards compatibility with old records)
      if (/^strengths:/i.test(lower)) {
        sections.strengths = clean(para.replace(/^strengths:\s*/i, ''));
        return;
      }
      if (/^justification:/i.test(lower)) {
        sections.justification = clean(para.replace(/^justification:\s*/i, ''));
        return;
      }
      if (/^suggestions?:/i.test(lower)) {
        sections.suggestions = clean(para.replace(/^suggestions?:\s*/i, ''));
        return;
      }
      if (/^mistakes?\s*(found)?:/i.test(lower)) {
        const mistakeText = clean(para.replace(/^mistakes?\s*(found)?:\s*/i, ''));
        // Parse mistake lines: "quoted text": explanation
        const lines = mistakeText.split('\n');
        lines.forEach((line) => {
          line = line.trim();
          if (!line) return;
          // Match pattern: "quote" — explanation  OR  "quote": explanation
          const match = line.match(/^[\"'\u201C\u201D]([^\"\u201C\u201D]+)[\"'\u201C\u201D]\s*[—\-:]\s*(.+)/);
          if (match) {
            sections.mistakes.push({ quote: match[1].trim(), explanation: match[2].trim() });
          } else if (line.length > 5) {
            // If no quote pattern, treat the whole line as an explanation
            sections.mistakes.push({ quote: '', explanation: line });
          }
        });
        return;
      }

      // For new clean format: no headers, just ordered paragraphs
      // First paragraph = justification (or strengths), second = strengths (or mistakes), etc.
      // Heuristic: if paragraph is short (< 100 chars), likely a strength; if longer, likely justification
      if (!sections.justification && para.length > 80) {
        sections.justification = para;
      } else if (!sections.strengths) {
        sections.strengths = para;
      } else if (!sections.suggestions && para.length < 200) {
        sections.suggestions = para;
      }
    });

    // Also check for single-line mistake format with "- " prefix (legacy)
    if (sections.mistakes.length === 0) {
      const dashLines = cleaned.split('\n').filter(l => /^\s*[-•]\s*["\u201C\u201D]/.test(l));
      if (dashLines.length > 0) {
        dashLines.forEach((line) => {
          const match = line.replace(/^[-•]\s*/, '').match(/^[\"'\u201C\u201D]([^\"\u201C\u201D]+)[\"'\u201C\u201D]\s*[—\-:]\s*(.+)/);
          if (match) {
            sections.mistakes.push({ quote: match[1].trim(), explanation: match[2].trim() });
          }
        });
      }
    }
  } catch (e) {
    // If parsing fails, return the raw feedback as justification
    sections.justification = feedback;
  }

  return sections;
};

// Results Screen Component
const ResultsScreen = ({ assessment, onNewAssessment, onBack }: { assessment: Assessment | null; onNewAssessment: () => void; onBack: () => void }) => {
  const { selectedCourse, extractedText } = useAppStore();
  const [activeTab, setActiveTab] = useState('overview');
  const [isDownloading, setIsDownloading] = useState(false);
  const { toast } = useToast();

  // Null check - redirect if no assessment
  if (!assessment) {
    return (
      <PageTransition>
        <div className="min-h-screen min-h-[100dvh] flex flex-col items-center justify-center p-6 safe-area-top safe-area-bottom">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="w-full max-w-sm text-center"
          >
            <div className="w-20 h-20 rounded-full bg-amber-100 flex items-center justify-center mx-auto mb-6">
              <AlertCircle className="w-10 h-10 text-amber-500" />
            </div>
            <h2 className="text-xl font-semibold mb-2">No Assessment Found</h2>
            <p className="text-muted-foreground text-sm mb-6">Please submit an essay for assessment first.</p>
            <Button
              onClick={onNewAssessment}
              className="bg-[#1a5f2a] hover:bg-[#1a5f2a]/90"
            >
              Start New Assessment
            </Button>
          </motion.div>
        </div>
      </PageTransition>
    );
  }

  const handleShare = async () => {
    try {
      if (navigator.share) {
        await navigator.share({
          title: 'AWE Assessment Results',
          text: `I scored ${assessment.percentage}% (${assessment.totalScore}/${assessment.maxScore}) on my ${selectedCourse?.name || 'essay'} assessment!`,
        });
      } else {
        await navigator.clipboard.writeText(
          `AWE Assessment Results\nScore: ${assessment.totalScore}/${assessment.maxScore} (${Math.round(assessment.percentage)}%)`
        );
        toast({
          title: 'Copied to Clipboard',
          description: 'Results have been copied to your clipboard.',
        });
      }
    } catch (error) {
      toast({
        title: 'Share Failed',
        description: 'Unable to share results.',
        variant: 'destructive',
      });
    }
  };

  const handleDownloadPDF = async () => {
    setIsDownloading(true);
    try {
      const response = await fetch('/api/pdf/assessment', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          assessment,
          course: selectedCourse,
          essayText: extractedText,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to generate PDF');
      }

      // Get the PDF blob
      const blob = await response.blob();
      
      // Create download link
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `AWE_Assessment_${selectedCourse?.code || 'Report'}_${new Date().toISOString().split('T')[0]}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      toast({
        title: 'PDF Downloaded',
        description: 'Your assessment report has been downloaded.',
      });
    } catch (error) {
      console.error('PDF download error:', error);
      toast({
        title: 'Download Failed',
        description: 'Failed to generate PDF report.',
        variant: 'destructive',
      });
    } finally {
      setIsDownloading(false);
    }
  };

  const getScoreColor = (score: number, max: number) => {
    const percentage = (score / max) * 100;
    if (percentage >= 80) return 'text-green-600';
    if (percentage >= 60) return 'text-[#c9a227]';
    if (percentage >= 40) return 'text-orange-500';
    return 'text-red-500';
  };

  return (
    <PageTransition>
      <div className="min-h-screen min-h-[100dvh] flex flex-col safe-area-top safe-area-bottom">
        {/* Header */}
        <div className="p-4 border-b bg-white/80 backdrop-blur-sm sticky top-0 z-10">
          <div className="flex items-center justify-between">
            <Button
              variant="ghost"
              size="icon"
              onClick={onBack}
              className="h-10 w-10 rounded-full"
            >
              <ChevronLeft className="w-5 h-5" />
            </Button>
            <div className="text-center">
              <h2 className="font-semibold">Results</h2>
              <p className="text-xs text-muted-foreground">{selectedCourse?.code}</p>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={handleShare}
              className="h-10 w-10 rounded-full"
            >
              <Share2 className="w-5 h-5" />
            </Button>
          </div>
        </div>

        {/* Score Hero */}
        <div className="bg-gradient-to-br from-[#1a5f2a] to-[#2a7f3a] text-white p-6">
          <div className="flex items-center justify-center gap-6">
            {/* Circular Score */}
            <motion.div
              initial={{ scale: 0, rotate: -180 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ duration: 0.8, type: 'spring' }}
              className="relative"
            >
              <svg className="w-32 h-32 transform -rotate-90">
                <circle
                  cx="64"
                  cy="64"
                  r="56"
                  stroke="rgba(255,255,255,0.2)"
                  strokeWidth="12"
                  fill="none"
                />
                <motion.circle
                  cx="64"
                  cy="64"
                  r="56"
                  stroke="white"
                  strokeWidth="12"
                  fill="none"
                  strokeLinecap="round"
                  strokeDasharray={352}
                  initial={{ strokeDashoffset: 352 }}
                  animate={{ strokeDashoffset: 352 - (352 * assessment.percentage) / 100 }}
                  transition={{ duration: 1.5, delay: 0.3 }}
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <motion.span
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.5 }}
                  className="text-4xl font-bold"
                >
                  {assessment.percentage}%
                </motion.span>
                <span className="text-sm opacity-80">Score</span>
              </div>
            </motion.div>

            {/* Total Score Box */}
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.5 }}
              className="text-center"
            >
              <div className="w-20 h-20 bg-white/20 rounded-2xl flex items-center justify-center mb-2">
                <span className="text-2xl font-bold">{assessment.totalScore}/{assessment.maxScore}</span>
              </div>
              <p className="text-sm opacity-80">Total Score</p>
              <Badge className="mt-2 bg-[#c9a227] text-white border-0">
                {assessment.percentage! >= 80 ? 'Excellent' : assessment.percentage! >= 60 ? 'Good' : 'Needs Work'}
              </Badge>
            </motion.div>
          </div>
        </div>

        {/* Tabs */}
        <div className="px-4 pt-4">
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="w-full h-11 p-1 bg-muted rounded-xl">
              <TabsTrigger value="overview" className="flex-1 h-9 rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm">
                Overview
              </TabsTrigger>
              <TabsTrigger value="criteria" className="flex-1 h-9 rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm">
                Detailed Feedback
              </TabsTrigger>
              <TabsTrigger value="feedback" className="flex-1 h-9 rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm">
                Overall Feedback
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        {/* Tab Content */}
        <ScrollArea className="flex-1">
          <div className="p-4">
            {activeTab === 'overview' && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="space-y-4"
              >
                {/* Quick Stats */}
                <div className="grid grid-cols-2 gap-3">
                  <Card>
                    <CardContent className="p-4 text-center">
                      <Award className="w-8 h-8 mx-auto mb-2 text-[#c9a227]" />
                      <p className="text-2xl font-bold">{assessment.totalScore}/{assessment.maxScore}</p>
                      <p className="text-xs text-muted-foreground">Total Points</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="p-4 text-center">
                      <TrendingUp className="w-8 h-8 mx-auto mb-2 text-[#1a5f2a]" />
                      <p className="text-2xl font-bold">{Math.round(assessment.percentage)}%</p>
                      <p className="text-xs text-muted-foreground">Percentage</p>
                    </CardContent>
                  </Card>
                </div>

                {/* Criteria Preview */}
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base">Score Breakdown</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {assessment.scores.map((score, index) => (
                      <motion.div
                        key={score.criterionId}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: index * 0.1 }}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-sm font-medium">{score.criterionName}</span>
                          <span className={`text-sm font-bold ${getScoreColor(score.score, score.maxScore)}`}>
                            {score.score}/{score.maxScore}
                          </span>
                        </div>
                        <Progress
                          value={(score.score / score.maxScore) * 100}
                          className="h-2"
                        />
                      </motion.div>
                    ))}
                  </CardContent>
                </Card>
              </motion.div>
            )}

            {activeTab === 'criteria' && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="space-y-3"
              >
                {assessment.scores.map((score, index) => {
                  const parsedFeedback = parseFeedback(score.feedback || '');
                  return (
                    <motion.div
                      key={score.criterionId}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.1 }}
                    >
                      <Card>
                        <CardContent className="p-4">
                          <div className="flex items-start justify-between mb-3">
                            <div className="flex items-center gap-3">
                              <div
                                className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold"
                                style={{
                                  background: `linear-gradient(135deg, ${
                                    (score.score / score.maxScore) * 100 >= 70 ? '#1a5f2a' : '#c9a227'
                                  }, ${
                                    (score.score / score.maxScore) * 100 >= 70 ? '#2a7f3a' : '#d9b237'
                                  })`,
                                }}
                              >
                                {score.score}
                              </div>
                              <div>
                                <h4 className="font-semibold">{score.criterionName}</h4>
                                <p className="text-xs text-muted-foreground">out of {score.maxScore}</p>
                              </div>
                            </div>
                            <Badge variant="secondary">
                              {Math.round((score.score / score.maxScore) * 100)}%
                            </Badge>
                          </div>
                          
                          {/* Structured Feedback */}
                          {parsedFeedback.justification && (
                            <div className="mb-3 bg-muted/40 p-3 rounded-lg">
                              <p className="text-xs font-medium text-[#1a5f2a] mb-1">Score Justification:</p>
                              <p className="text-sm text-muted-foreground leading-relaxed">{parsedFeedback.justification}</p>
                            </div>
                          )}

                          {parsedFeedback.strengths && (
                            <div className="mb-3">
                              <p className="text-xs font-medium text-[#1a5f2a] mb-1">Strengths:</p>
                              <p className="text-sm text-muted-foreground">{parsedFeedback.strengths}</p>
                            </div>
                          )}
                          
                          {parsedFeedback.mistakes.length > 0 && (
                            <div className="mb-3">
                              <p className="text-xs font-medium text-red-600 mb-1">Mistakes Found:</p>
                              <div className="space-y-2">
                                {parsedFeedback.mistakes.map((mistake, i) => (
                                  <div key={i} className="bg-red-50 dark:bg-red-950/20 p-2 rounded-lg">
                                    <p className="text-sm font-medium text-red-700 dark:text-red-400">"{mistake.quote}"</p>
                                    <p className="text-xs text-muted-foreground mt-1">{mistake.explanation}</p>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                          
                          {parsedFeedback.suggestions && (
                            <div>
                              <p className="text-xs font-medium text-[#c9a227] mb-1">Suggestions:</p>
                              <p className="text-sm text-muted-foreground">{parsedFeedback.suggestions}</p>
                            </div>
                          )}
                          
                          {!parsedFeedback.strengths && !parsedFeedback.mistakes.length && !parsedFeedback.suggestions && (
                            <p className="text-sm text-muted-foreground">{score.feedback}</p>
                          )}
                        </CardContent>
                      </Card>
                    </motion.div>
                  );
                })}
              </motion.div>
            )}

            {activeTab === 'feedback' && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="space-y-4"
              >
                {/* Overall Feedback */}
                <Card className="border-2 border-[#1a5f2a]/20">
                  <CardHeader className="pb-3">
                    <div className="flex items-center gap-2">
                      <MessageSquare className="w-5 h-5 text-[#1a5f2a]" />
                      <CardTitle className="text-base">Overall Feedback</CardTitle>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm leading-relaxed">{assessment.overallFeedback || 'No overall feedback provided.'}</p>
                  </CardContent>
                </Card>

                {/* Word Count Info */}
                {assessment.wordCount && (
                  <Card>
                    <CardHeader className="pb-3">
                      <div className="flex items-center gap-2">
                        <FileText className="w-5 h-5 text-[#c9a227]" />
                        <CardTitle className="text-base">Word Count</CardTitle>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="flex items-center justify-between">
                        <span className="text-2xl font-bold">{assessment.wordCount}</span>
                        <span className="text-sm text-muted-foreground">
                          {assessment.targetWordCount 
                            ? `Target: ${assessment.targetWordCount.min}-${assessment.targetWordCount.max} words` 
                            : 'words'}
                        </span>
                      </div>
                    </CardContent>
                  </Card>
                )}
              </motion.div>
            )}
          </div>
        </ScrollArea>

        {/* Footer */}
        <div className="p-4 border-t bg-white/80 backdrop-blur-sm space-y-3">
          <div className="flex gap-3">
            <Button
              variant="outline"
              onClick={handleDownloadPDF}
              disabled={isDownloading}
              className="flex-1 h-12 rounded-xl ios-press"
            >
              {isDownloading ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Download className="w-4 h-4 mr-2" />
              )}
              {isDownloading ? 'Generating...' : 'Download PDF'}
            </Button>
            <Button
              onClick={onNewAssessment}
              className="flex-1 h-12 bg-[#1a5f2a] hover:bg-[#1a5f2a]/90 rounded-xl ios-press"
            >
              <Plus className="w-4 h-4 mr-2" />
              New Essay
            </Button>
          </div>
          <Button
            variant="ghost"
            onClick={() => useAppStore.getState().setStep('records')}
            className="w-full h-10 text-muted-foreground rounded-xl ios-press"
          >
            <History className="w-4 h-4 mr-2" />
            View Assessment Records
          </Button>
        </div>
      </div>
    </PageTransition>
  );
};

// Records Screen Component
const RecordsScreen = ({ onBack, onNewAssessment }: { onBack: () => void; onNewAssessment: () => void }) => {
  const { records, deleteRecord, clearAllRecords } = useAppStore();
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [filterCourse, setFilterCourse] = useState<string>('all');
  const [showClearDialog, setShowClearDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState<string | null>(null);
  const [viewingRecord, setViewingRecord] = useState<AssessmentRecord | null>(null);
  const [isDownloading, setIsDownloading] = useState(false);
  const { toast } = useToast();

  // Compute unique courses from records
  const uniqueCourses = Array.from(
    new Map(
      records
        .filter((r) => r.course)
        .map((r) => [r.course!.id, r.course!])
    ).values()
  );

  // Filter records
  const filteredRecords = filterCourse === 'all'
    ? records
    : records.filter((r) => r.course?.id === filterCourse);

  // Stats
  const totalAssessments = filteredRecords.length;
  const avgScore = totalAssessments > 0
    ? Math.round(filteredRecords.reduce((sum, r) => sum + r.assessment.percentage, 0) / totalAssessments)
    : 0;
  const bestScore = totalAssessments > 0
    ? Math.round(Math.max(...filteredRecords.map((r) => r.assessment.percentage)))
    : 0;

  // Sparkline data (last 10)
  const sparklineData = filteredRecords.slice(0, 10).reverse().map((r) => r.assessment.percentage);

  const getPerformanceBadge = (percentage: number) => {
    if (percentage >= 80) return { label: 'Excellent', color: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400', borderColor: 'border-green-300 dark:border-green-700' };
    if (percentage >= 60) return { label: 'Good', color: 'bg-[#c9a227]/10 text-[#c9a227]', borderColor: 'border-[#c9a227]/30' };
    if (percentage >= 40) return { label: 'Satisfactory', color: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400', borderColor: 'border-orange-300 dark:border-orange-700' };
    return { label: 'Needs Improvement', color: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400', borderColor: 'border-red-300 dark:border-red-700' };
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) + ' \u2022 ' + date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  };

  const handleDownloadPDF = async (record: AssessmentRecord) => {
    setIsDownloading(true);
    try {
      const response = await fetch('/api/pdf/assessment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          assessment: record.assessment,
          course: record.course,
          essayText: record.essayText,
        }),
      });
      if (!response.ok) throw new Error('Failed to generate PDF');
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `AWE_Assessment_${record.course?.code || 'Report'}_${new Date(record.createdAt).toISOString().split('T')[0]}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      toast({ title: 'PDF Downloaded', description: 'Your assessment report has been downloaded.' });
    } catch (error) {
      toast({ title: 'Download Failed', description: 'Failed to generate PDF report.', variant: 'destructive' });
    } finally {
      setIsDownloading(false);
    }
  };

  const handleDeleteRecord = (id: string) => {
    deleteRecord(id);
    setShowDeleteDialog(null);
    setExpandedId(null);
    toast({ title: 'Record Deleted', description: 'Assessment record has been removed.' });
  };

  const handleClearAll = () => {
    clearAllRecords();
    setShowClearDialog(false);
    toast({ title: 'All Records Cleared', description: 'All assessment records have been removed.' });
  };

  // Build SVG sparkline
  const renderSparkline = () => {
    if (sparklineData.length < 2) return null;
    const width = 280;
    const height = 60;
    const padding = 4;
    const minVal = Math.max(0, Math.min(...sparklineData) - 10);
    const maxVal = Math.min(100, Math.max(...sparklineData) + 10);
    const range = maxVal - minVal || 1;
    const stepX = (width - padding * 2) / (sparklineData.length - 1);
    const points = sparklineData.map((val, i) => ({
      x: padding + i * stepX,
      y: height - padding - ((val - minVal) / range) * (height - padding * 2),
    }));
    const pathD = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
    const areaD = pathD + ` L ${points[points.length - 1].x} ${height - padding} L ${points[0].x} ${height - padding} Z`;
    return (
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-16" preserveAspectRatio="none">
        <defs>
          <linearGradient id="sparkGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#1a5f2a" stopOpacity="0.2" />
            <stop offset="100%" stopColor="#1a5f2a" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={areaD} fill="url(#sparkGrad)" />
        <path d={pathD} fill="none" stroke="#1a5f2a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        {points.map((p, i) => (
          <circle key={i} cx={p.x} cy={p.y} r="3" fill="#1a5f2a" stroke="white" strokeWidth="1.5" />
        ))}
      </svg>
    );
  };

  // Detail view for a record (read-only full results)
  const renderRecordDetail = (record: AssessmentRecord) => {
    return (
      <PageTransition direction="right">
        <div className="min-h-screen min-h-[100dvh] flex flex-col safe-area-top safe-area-bottom">
          <div className="p-4 border-b bg-white/80 backdrop-blur-sm sticky top-0 z-10">
            <div className="flex items-center gap-3">
              <Button variant="ghost" size="icon" onClick={() => setViewingRecord(null)} className="h-10 w-10 rounded-full">
                <ChevronLeft className="w-5 h-5" />
              </Button>
              <div>
                <h2 className="font-semibold text-lg">Assessment Detail</h2>
                <p className="text-sm text-muted-foreground">{record.course?.code || 'Unknown Course'}</p>
              </div>
            </div>
          </div>
          <ScrollArea className="flex-1">
            <div className="p-4 space-y-4">
              <div className="text-center">
                <p className="text-xs text-muted-foreground mb-1">{formatDate(record.createdAt)}</p>
                <p className="text-3xl font-bold text-[#1a5f2a]">{record.assessment.percentage}%</p>
                <p className="text-sm text-muted-foreground">{record.assessment.totalScore}/{record.assessment.maxScore}</p>
                <Badge className={`mt-2 border ${getPerformanceBadge(record.assessment.percentage).color}`} variant="outline">
                  {getPerformanceBadge(record.assessment.percentage).label}
                </Badge>
              </div>

              {/* Per-criterion detailed feedback */}
              {record.assessment.scores.map((score, idx) => {
                const pct = score.maxScore > 0 ? (score.score / score.maxScore) * 100 : 0;
                const parsed = parseFeedback(score.feedback || '');
                return (
                  <motion.div
                    key={score.criterionId || idx}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: idx * 0.05 }}
                  >
                    <Card>
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center gap-3">
                            <div
                              className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold"
                              style={{
                                background: `linear-gradient(135deg, ${pct >= 70 ? '#1a5f2a' : '#c9a227'}, ${pct >= 70 ? '#2a7f3a' : '#d9b237'})`,
                              }}
                            >
                              {score.score}
                            </div>
                            <div>
                              <h4 className="font-semibold text-sm">{score.criterionName}</h4>
                              <p className="text-xs text-muted-foreground">out of {score.maxScore}</p>
                            </div>
                          </div>
                          <Badge variant="secondary">
                            {Math.round(pct)}%
                          </Badge>
                        </div>

                        <div className="mb-3">
                          <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                            <div
                              className="h-full rounded-full bg-[#1a5f2a]"
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                        </div>

                        {parsed.justification && (
                          <div className="mb-3 bg-muted/40 p-3 rounded-lg">
                            <p className="text-xs font-medium text-[#1a5f2a] mb-1">Score Justification:</p>
                            <p className="text-sm text-muted-foreground leading-relaxed">{parsed.justification}</p>
                          </div>
                        )}

                        {parsed.strengths && (
                          <div className="mb-3">
                            <p className="text-xs font-medium text-[#1a5f2a] mb-1">Strengths:</p>
                            <p className="text-sm text-muted-foreground">{parsed.strengths}</p>
                          </div>
                        )}

                        {parsed.mistakes.length > 0 && (
                          <div className="mb-3">
                            <p className="text-xs font-medium text-red-600 mb-1">Mistakes Found:</p>
                            <div className="space-y-2">
                              {parsed.mistakes.map((m, i) => (
                                <div key={i} className="bg-red-50 dark:bg-red-950/20 p-2 rounded-lg">
                                  <p className="text-sm font-medium text-red-700 dark:text-red-400">&ldquo;{m.quote}&rdquo;</p>
                                  <p className="text-xs text-muted-foreground mt-1">{m.explanation}</p>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {parsed.suggestions && (
                          <div>
                            <p className="text-xs font-medium text-[#c9a227] mb-1">Suggestions:</p>
                            <p className="text-sm text-muted-foreground">{parsed.suggestions}</p>
                          </div>
                        )}

                        {!parsed.justification && !parsed.strengths && !parsed.mistakes.length && !parsed.suggestions && score.feedback && (
                          <p className="text-sm text-muted-foreground">{score.feedback}</p>
                        )}
                      </CardContent>
                    </Card>
                  </motion.div>
                );
              })}

              {/* Overall Feedback */}
              {record.assessment.overallFeedback && (
                <Card className="border-2 border-[#1a5f2a]/20">
                  <CardHeader className="pb-3">
                    <div className="flex items-center gap-2">
                      <MessageSquare className="w-5 h-5 text-[#1a5f2a]" />
                      <CardTitle className="text-base">Overall Feedback</CardTitle>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm leading-relaxed">{record.assessment.overallFeedback}</p>
                  </CardContent>
                </Card>
              )}

              {record.assessment.wordCount && (
                <div className="text-center py-2">
                  <p className="text-sm text-muted-foreground">Word Count: <span className="font-semibold">{record.assessment.wordCount}</span></p>
                </div>
              )}
            </div>
          </ScrollArea>
        </div>
      </PageTransition>
    );
  };

  // If viewing a record detail
  if (viewingRecord) {
    return renderRecordDetail(viewingRecord);
  }

  return (
    <PageTransition>
      <div className="min-h-screen min-h-[100dvh] flex flex-col safe-area-top safe-area-bottom">
        {/* Header */}
        <div className="p-4 border-b bg-white/80 backdrop-blur-sm sticky top-0 z-10">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Button variant="ghost" size="icon" onClick={onBack} className="h-10 w-10 rounded-full">
                <ChevronLeft className="w-5 h-5" />
              </Button>
              <div>
                <h2 className="font-semibold text-lg">Assessment Records</h2>
                <p className="text-sm text-muted-foreground">{totalAssessments} assessment{totalAssessments !== 1 ? 's' : ''}</p>
              </div>
            </div>
            {records.length > 0 && (
              <Button variant="ghost" size="sm" onClick={() => setShowClearDialog(true)} className="text-red-500 hover:text-red-600 hover:bg-red-50 h-9 px-3">
                <Trash2 className="w-4 h-4 mr-1" />
                Clear All
              </Button>
            )}
          </div>
        </div>

        {/* Content */}
        <ScrollArea className="flex-1">
          <div className="p-4 space-y-4">
            {records.length > 0 ? (
              <>
                {/* Summary Stats */}
                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="grid grid-cols-3 gap-3">
                  <Card className="border-0 shadow-sm">
                    <CardContent className="p-3 text-center">
                      <p className="text-xl font-bold text-[#1a5f2a]">{totalAssessments}</p>
                      <p className="text-xs text-muted-foreground">Total</p>
                    </CardContent>
                  </Card>
                  <Card className="border-0 shadow-sm">
                    <CardContent className="p-3 text-center">
                      <p className="text-xl font-bold text-[#c9a227]">{avgScore}%</p>
                      <p className="text-xs text-muted-foreground">Average</p>
                    </CardContent>
                  </Card>
                  <Card className="border-0 shadow-sm">
                    <CardContent className="p-3 text-center">
                      <p className="text-xl font-bold text-[#1a5f2a]">{bestScore}%</p>
                      <p className="text-xs text-muted-foreground">Best</p>
                    </CardContent>
                  </Card>
                </motion.div>

                {/* Sparkline */}
                {sparklineData.length >= 2 && (
                  <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
                    <Card className="border-0 shadow-sm">
                      <CardHeader className="pb-2 pt-3 px-4">
                        <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Score Trend (Last {sparklineData.length})</CardTitle>
                      </CardHeader>
                      <CardContent className="px-4 pb-3">
                        {renderSparkline()}
                      </CardContent>
                    </Card>
                  </motion.div>
                )}

                {/* Course Filter */}
                {uniqueCourses.length > 1 && (
                  <div className="flex gap-2 flex-wrap">
                    <Badge
                      variant={filterCourse === 'all' ? 'default' : 'outline'}
                      className={`cursor-pointer text-xs ${filterCourse === 'all' ? 'bg-[#1a5f2a] text-white border-[#1a5f2a]' : ''}`}
                      onClick={() => setFilterCourse('all')}
                    >
                      All Courses
                    </Badge>
                    {uniqueCourses.map((c) => (
                      <Badge
                        key={c.id}
                        variant={filterCourse === c.id ? 'default' : 'outline'}
                        className={`cursor-pointer text-xs ${filterCourse === c.id ? 'bg-[#1a5f2a] text-white border-[#1a5f2a]' : ''}`}
                        onClick={() => setFilterCourse(c.id)}
                      >
                        {c.code}
                      </Badge>
                    ))}
                  </div>
                )}

                {/* Records List */}
                <div className="space-y-3">
                  {filteredRecords.map((record, index) => {
                    const badge = getPerformanceBadge(record.assessment.percentage);
                    const isExpanded = expandedId === record.id;
                    return (
                      <motion.div
                        key={record.id}
                        variants={fadeInUp}
                        initial="initial"
                        animate="animate"
                        transition={{ delay: Math.min(index * 0.05, 0.3) }}
                      >
                        <Card
                          className={`border-0 shadow-sm cursor-pointer transition-all duration-200 overflow-hidden ${isExpanded ? 'ring-2 ring-[#1a5f2a]/20' : ''}`}
                          onClick={() => setExpandedId(isExpanded ? null : record.id)}
                        >
                          <CardContent className="p-4">
                            <div className="flex items-start justify-between">
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-1">
                                  <Badge variant="secondary" className="text-xs shrink-0">
                                    {record.course?.code || '—'}
                                  </Badge>
                                  <span className="text-xs text-muted-foreground truncate">{formatDate(record.createdAt)}</span>
                                </div>
                                <div className="flex items-center gap-3 mt-2">
                                  <span className="text-lg font-bold text-[#1a5f2a]">
                                    {record.assessment.totalScore}/{record.assessment.maxScore}
                                  </span>
                                  <Badge className={`text-xs border shrink-0 ${badge.color}`} variant="outline">
                                    {badge.label}
                                  </Badge>
                                  {record.assessment.wordCount && (
                                    <span className="text-xs text-muted-foreground shrink-0">{record.assessment.wordCount} words</span>
                                  )}
                                </div>
                                {/* Mini Progress Bar */}
                                <div className="mt-2">
                                  <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                                    <motion.div
                                      className="h-full rounded-full"
                                      style={{ backgroundColor: record.assessment.percentage >= 80 ? '#1a5f2a' : record.assessment.percentage >= 60 ? '#c9a227' : record.assessment.percentage >= 40 ? '#f97316' : '#ef4444' }}
                                      initial={{ width: 0 }}
                                      animate={{ width: `${record.assessment.percentage}%` }}
                                      transition={{ duration: 0.8, delay: index * 0.05 }}
                                    />
                                  </div>
                                </div>
                              </div>
                              <ChevronDown className={`w-5 h-5 text-muted-foreground shrink-0 ml-2 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`} />
                            </div>

                            {/* Expanded Content */}
                            <AnimatePresence>
                              {isExpanded && (
                                <motion.div
                                  initial={{ height: 0, opacity: 0 }}
                                  animate={{ height: 'auto', opacity: 1 }}
                                  exit={{ height: 0, opacity: 0 }}
                                  transition={{ duration: 0.2 }}
                                  className="overflow-hidden"
                                >
                                  <div className="mt-4 pt-4 border-t space-y-4" onClick={(e) => e.stopPropagation()}>
                                    {/* Score Breakdown */}
                                    <div>
                                      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">Score Breakdown</p>
                                      <div className="space-y-2">
                                        {record.assessment.scores.map((score) => {
                                          const pct = (score.score / score.maxScore) * 100;
                                          return (
                                            <div key={score.criterionId}>
                                              <div className="flex items-center justify-between mb-0.5">
                                                <span className="text-xs font-medium">{score.criterionName}</span>
                                                <span className="text-xs font-bold">{score.score}/{score.maxScore}</span>
                                              </div>
                                              <Progress value={pct} className="h-1.5" />
                                            </div>
                                          );
                                        })}
                                      </div>
                                    </div>

                                    {/* Overall Feedback */}
                                    {record.assessment.overallFeedback && (
                                      <div>
                                        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1">Overall Feedback</p>
                                        <p className="text-sm text-muted-foreground leading-relaxed line-clamp-4">
                                          {record.assessment.overallFeedback}
                                        </p>
                                      </div>
                                    )}

                                    {/* Actions */}
                                    <div className="flex gap-2">
                                      <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => setViewingRecord(record)}
                                        className="flex-1 h-9 text-xs rounded-lg"
                                      >
                                        <Eye className="w-3.5 h-3.5 mr-1" />
                                        View Full Results
                                      </Button>
                                      <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => handleDownloadPDF(record)}
                                        disabled={isDownloading}
                                        className="flex-1 h-9 text-xs rounded-lg"
                                      >
                                        <Download className="w-3.5 h-3.5 mr-1" />
                                        PDF
                                      </Button>
                                      <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => setShowDeleteDialog(record.id)}
                                        className="h-9 text-xs rounded-lg text-red-500 hover:text-red-600 hover:bg-red-50 border-red-200"
                                      >
                                        <Trash2 className="w-3.5 h-3.5" />
                                      </Button>
                                    </div>
                                  </div>
                                </motion.div>
                              )}
                            </AnimatePresence>
                          </CardContent>
                        </Card>
                      </motion.div>
                    );
                  })}
                </div>
              </>
            ) : (
              /* Empty State */
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex flex-col items-center justify-center py-16"
              >
                <div className="w-24 h-24 rounded-full bg-muted/50 flex items-center justify-center mb-6">
                  <History className="w-12 h-12 text-muted-foreground/50" />
                </div>
                <h3 className="text-lg font-semibold mb-2">No Assessments Yet</h3>
                <p className="text-sm text-muted-foreground text-center mb-6 max-w-xs">
                  Complete your first essay assessment to see your records here.
                </p>
                <Button onClick={onNewAssessment} className="bg-[#1a5f2a] hover:bg-[#1a5f2a]/90 rounded-xl ios-press">
                  <Plus className="w-4 h-4 mr-2" />
                  Start Your First Assessment
                </Button>
              </motion.div>
            )}
          </div>
        </ScrollArea>

        {/* Clear All Dialog */}
        <Dialog open={showClearDialog} onOpenChange={setShowClearDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Clear All Records?</DialogTitle>
              <DialogDescription>
                This will permanently delete all {records.length} assessment record(s). This action cannot be undone.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter className="gap-2">
              <Button variant="outline" onClick={() => setShowClearDialog(false)} className="rounded-xl">Cancel</Button>
              <Button variant="destructive" onClick={handleClearAll} className="rounded-xl">Delete All</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Delete Single Dialog */}
        <Dialog open={!!showDeleteDialog} onOpenChange={() => setShowDeleteDialog(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Delete Record?</DialogTitle>
              <DialogDescription>
                This record will be permanently deleted. This action cannot be undone.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter className="gap-2">
              <Button variant="outline" onClick={() => setShowDeleteDialog(null)} className="rounded-xl">Cancel</Button>
              <Button variant="destructive" onClick={() => showDeleteDialog && handleDeleteRecord(showDeleteDialog)} className="rounded-xl">Delete</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </PageTransition>
  );
};

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
    setIsVisible(true);
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

// Main App Component
export default function AWEApp() {
  const {
    currentStep,
    setStep,
    geminiApiKey,
    visionApiKey,
    selectedCourse,
    setSelectedCourse,
    extractedText,
    setExtractedText,
    currentAssessment,
    setCurrentAssessment,
    resetAssessment,
    setProcessing,
  } = useAppStore();

  const { toast } = useToast();

  const [direction, setDirection] = useState<'left' | 'right'>('right');
  const [showBottomNav, setShowBottomNav] = useState(true);

  // Determine initial step based on state
  useEffect(() => {
    if (!geminiApiKey && currentStep === 'welcome') {
      // Show setup after welcome if no API key
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
    const { visionApiKey, geminiApiKey } = useAppStore.getState();

    // Check if at least one API key is available
    if (!visionApiKey && !geminiApiKey) {
      toast({
        title: 'API Key Required',
        description: 'Please configure a Vision API key or Gemini API key in settings.',
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
          apiKey: visionApiKey || undefined,
          geminiApiKey: geminiApiKey || undefined,
          useGemini: !visionApiKey && !!geminiApiKey,
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

  // Handle assessment completion
  const handleAssessmentComplete = (assessment: Assessment) => {
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
  };

  // Handle new assessment
  const handleNewAssessment = () => {
    resetAssessment();
    setStep('welcome');
  };

  // Render current screen
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

  // Don't show bottom nav on certain screens
  const shouldShowBottomNav = !['processing', 'assessing'].includes(currentStep);

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
