'use client';

import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { useAppStore } from '@/lib/store';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useToast } from '@/hooks/use-toast';
import { ModelSelectionCard } from '@/components/ModelSelectionCard';
import { LOCAL_MODELS, MODEL_CONFIG, ALLOWED_CLOUD_MODELS } from '@/lib/config';
import { ModelDownloader, type DownloadProgress } from '@/lib/model-downloader';
import { checkDeviceReadiness } from '@/lib/device-check';
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
  Cpu,
  Cloud,
  AlertTriangle,
} from 'lucide-react';
import { PageTransition } from '@/lib/animations';

// Setup Screen Component
const SetupScreen = ({ onComplete }: { onComplete: () => void }) => {
  const {
    geminiApiKey,
    assessmentApiKey,
    setGeminiApiKey,
    setAssessmentApiKey,
    preferredCloudModelId,
    setPreferredCloudModelId,
    useLocalAssessment,
    setUseLocalAssessment,
    preferredLocalModelId,
    setPreferredLocalModelId,
  } = useAppStore();
  const [localGeminiKey, setLocalGeminiKey] = useState(geminiApiKey);
  const [localAssessmentKey, setLocalAssessmentKey] = useState(assessmentApiKey);
  const [showGeminiKey, setShowGeminiKey] = useState(false);
  const [showAssessmentKey, setShowAssessmentKey] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [downloadedModels, setDownloadedModels] = useState<Record<string, boolean>>({});
  const [deviceWarnings, setDeviceWarnings] = useState<string[]>([]);
  const downloader = useMemo(() => new ModelDownloader(), []);
  const { toast } = useToast();

  // Load which local models are already stored on this device.
  useEffect(() => {
    let cancelled = false;
    downloader.listStoredModels().then((models) => {
      if (cancelled) return;
      const map: Record<string, boolean> = {};
      for (const m of models) map[m.id] = true;
      setDownloadedModels(map);
    }).catch(() => {
      // IndexedDB unavailable (private mode) — local models simply stay hidden.
    });
    return () => {
      cancelled = true;
    };
  }, [downloader]);

  // Battery / slow-device readiness check for the selected local model.
  // Runs when a local model becomes selected (or the screen opens with one
  // already selected). Warning-only — never blocks the user's choice.
  useEffect(() => {
    let cancelled = false;
    const activeModel = LOCAL_MODELS.find((m) => m.id === preferredLocalModelId);
    if (!activeModel || !useLocalAssessment) {
      setDeviceWarnings([]);
      return;
    }
    checkDeviceReadiness(activeModel.sizeBytes ?? null).then((readiness) => {
      if (!cancelled) setDeviceWarnings(readiness.warnings);
    }).catch(() => {
      // Readiness info unavailable — silently skip the warning.
    });
    return () => {
      cancelled = true;
    };
  }, [preferredLocalModelId, useLocalAssessment]);

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

  // ── Model selection handlers ──────────────────────────────────────────

  const refreshDownloadedModels = async () => {
    try {
      const models = await downloader.listStoredModels();
      const map: Record<string, boolean> = {};
      for (const m of models) map[m.id] = true;
      setDownloadedModels(map);
    } catch {
      // ignore — refresh is best-effort
    }
  };

  const handleCloudModelSelect = (modelId: string) => {
    setPreferredCloudModelId(modelId);
    const model = MODEL_CONFIG.freeTierLimits[modelId];
    toast({
      title: 'Cloud model updated',
      description: model
        ? `Free tier: ${model.requestsPerMinute} requests/min, ${model.requestsPerDay}/day.`
        : 'The assessment will try this model first.',
    });
  };

  const handleLocalModelDownload = async (modelId: string, onProgress: (p: DownloadProgress) => void) => {
    const storage = await downloader.hasEnoughStorage(modelId);
    if (!storage.ok) {
      const freeGb = storage.freeBytes != null ? (storage.freeBytes / (1024 * 1024 * 1024)).toFixed(1) : '?';
      toast({
        title: 'Not enough storage',
        description: `This model needs more space than the ${freeGb} GB currently free on your device.`,
        variant: 'destructive',
      });
      return;
    }
    await downloader.downloadModel(modelId, onProgress);
    await refreshDownloadedModels();
    toast({ title: 'Model downloaded', description: 'On-device assessment is now available — even offline.' });
  };

  const handleLocalModelDelete = async (modelId: string) => {
    await downloader.deleteModel(modelId);
    if (preferredLocalModelId === modelId) {
      setPreferredLocalModelId(null);
      setUseLocalAssessment(false);
    }
    await refreshDownloadedModels();
    toast({ title: 'Model deleted', description: 'Storage space has been freed.' });
  };

  const handleLocalModelSelect = (modelId: string) => {
    setPreferredLocalModelId(modelId);
    setUseLocalAssessment(true);
    // Surface battery / performance guidance immediately for this model.
    const model = LOCAL_MODELS.find((m) => m.id === modelId);
    checkDeviceReadiness(model?.sizeBytes ?? null)
      .then((readiness) => {
        setDeviceWarnings(readiness.warnings);
        if (readiness.warnings.length > 0) {
          toast({
            title: 'Device check',
            description: readiness.warnings[0],
            variant: 'destructive',
          });
        }
      })
      .catch(() => {});
    toast({
      title: 'On-device model selected',
      description: 'Assessment will run privately on your phone. OCR still uses cloud Gemini, and cloud remains a fallback for grading.',
    });
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
              <h2 className="font-semibold text-lg">API &amp; Model Configuration</h2>
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

            {/* AI Model Selection */}
            <Card className="border-0 shadow-sm">
              <CardHeader className="pb-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center">
                    <Cpu className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <CardTitle className="text-base">Assessment Model</CardTitle>
                    <CardDescription className="text-xs">Choose cloud or on-device AI for essay assessment</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Cloud models */}
                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1.5">
                    <Cloud className="w-3.5 h-3.5" /> CLOUD (REQUIRES INTERNET)
                  </p>
                  <div className="space-y-2">
                    {ALLOWED_CLOUD_MODELS.map((modelId) => (
                      <ModelSelectionCard
                        key={modelId}
                        kind="cloud"
                        model={{
                          id: modelId,
                          name: modelId,
                          description:
                            modelId === MODEL_CONFIG.current
                              ? 'Recommended — highest free-tier quota, lowest latency'
                              : modelId === MODEL_CONFIG.fallback
                              ? 'Automatic fallback when the primary model is rate-limited'
                              : 'Legacy fallback model (extra resilience)',
                          freeTier: MODEL_CONFIG.freeTierLimits[modelId],
                        }}
                        isSelected={(preferredCloudModelId ?? MODEL_CONFIG.current) === modelId}
                        isDownloaded={false}
                        onSelect={handleCloudModelSelect}
                      />
                    ))}
                  </div>
                </div>

                {/* Local models */}
                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1.5">
                    <Cpu className="w-3.5 h-3.5" /> ON-DEVICE (WORKS OFFLINE, 100% PRIVATE)
                  </p>
                  <p className="text-[11px] text-muted-foreground mb-2">
                    Applies to essay <span className="font-medium">assessment only</span> — OCR (photo → text extraction) always uses cloud Gemini for high-quality character recognition.
                  </p>
                  {deviceWarnings.length > 0 && (
                    <Alert className="mb-2 bg-amber-50 border-amber-200 dark:bg-amber-950 dark:border-amber-800">
                      <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
                      <AlertDescription className="text-xs text-amber-700 dark:text-amber-300">
                        <span className="font-medium block mb-0.5">Heads-up about this device</span>
                        <ul className="list-disc list-inside space-y-0.5">
                          {deviceWarnings.map((w) => (
                            <li key={w}>{w}</li>
                          ))}
                        </ul>
                      </AlertDescription>
                    </Alert>
                  )}
                  <div className="space-y-2">
                    {LOCAL_MODELS.map((model) => (
                      <ModelSelectionCard
                        key={model.id}
                        kind="local"
                        model={model}
                        isSelected={preferredLocalModelId === model.id}
                        isDownloaded={!!downloadedModels[model.id]}
                        onDownload={handleLocalModelDownload}
                        onDelete={handleLocalModelDelete}
                        onSelect={handleLocalModelSelect}
                      />
                    ))}
                  </div>
                </div>

                {/* Local-first toggle */}
                <button
                  type="button"
                  onClick={() => {
                    if (!useLocalAssessment && !preferredLocalModelId) {
                      toast({
                        title: 'Download a model first',
                        description: 'Choose an on-device model above and download it to enable offline assessment.',
                      });
                      return;
                    }
                    setUseLocalAssessment(!useLocalAssessment);
                  }}
                  className={`w-full flex items-center justify-between gap-3 p-3 rounded-xl border text-left transition-colors ${
                    useLocalAssessment ? 'border-[#1a5f2a] bg-[#1a5f2a]/5' : 'border-border'
                  }`}
                >
                  <span>
                    <span className="block text-sm font-medium">Assess on-device first</span>
                    <span className="block text-xs text-muted-foreground mt-0.5">
                      Runs privately on your phone, even offline — grading only; OCR always uses the cloud. Falls back to cloud automatically if it fails.
                    </span>
                  </span>
                  <span
                    className={`w-11 h-6 rounded-full p-0.5 shrink-0 transition-colors ${
                      useLocalAssessment ? 'bg-[#1a5f2a]' : 'bg-muted-foreground/30'
                    }`}
                  >
                    <span
                      className={`block w-5 h-5 rounded-full bg-white shadow transition-transform ${
                        useLocalAssessment ? 'translate-x-5' : 'translate-x-0'
                      }`}
                    />
                  </span>
                </button>
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
