'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { useAppStore } from '@/lib/store';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useToast } from '@/hooks/use-toast';
import {
  Settings,
  ClipboardCheck,
  Eye,
  EyeOff,
  Shield,
  Key,
  ChevronRight,
  Loader2,
  Info,
} from 'lucide-react';
import { PageTransition } from '@/lib/animations';

// Setup Screen Component
const SetupScreen = ({ onComplete }: { onComplete: () => void }) => {
  const { geminiApiKey, assessmentApiKey, setGeminiApiKey, setAssessmentApiKey } = useAppStore();
  const [localGeminiKey, setLocalGeminiKey] = useState(geminiApiKey);
  const [localAssessmentKey, setLocalAssessmentKey] = useState(assessmentApiKey);
  const [showGeminiKey, setShowGeminiKey] = useState(false);
  const [showAssessmentKey, setShowAssessmentKey] = useState(false);
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
    setAssessmentApiKey(localAssessmentKey);

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
                    <CardDescription className="text-xs">Required — used for OCR (text extraction)</CardDescription>
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

            {/* Assessment API Key (Optional — recommended for free tier users) */}
            <Card className="border-0 shadow-sm">
              <CardHeader className="pb-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-orange-500 to-red-600 flex items-center justify-center">
                    <ClipboardCheck className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <CardTitle className="text-base">Assessment API Key</CardTitle>
                    <CardDescription className="text-xs">Optional — separate key for assessment to avoid rate limits</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="relative">
                  <Input
                    type={showAssessmentKey ? 'text' : 'password'}
                    placeholder="Enter a second Gemini API key (optional)"
                    value={localAssessmentKey}
                    onChange={(e) => setLocalAssessmentKey(e.target.value)}
                    className="pr-10 h-12"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="absolute right-1 top-1 h-10 w-10"
                    onClick={() => setShowAssessmentKey(!showAssessmentKey)}
                  >
                    {showAssessmentKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  Use a second Gemini key for assessment to double your free-tier quota. Get it from{' '}
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

export default SetupScreen;
