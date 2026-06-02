'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAppStore, type Assessment } from '@/lib/store';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/hooks/use-toast';
import { recalculateScores, parseFeedback } from '@/lib/scoring-utils';
import { getScoreColor } from '@/lib/display-utils';
import {
  AlertCircle,
  ChevronLeft,
  Share2,
  Award,
  TrendingUp,
  Download,
  FileText,
  MessageSquare,
  Plus,
  Loader2,
  History,
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

// Arabic translations for criterion names — student-facing with bilingual labels
const CRITERION_LABELS: Record<string, string> = {
  'Task Response': 'الاستجابة للمطلوب (Task Response)',
  'Task Achievement': 'تحقيق المطلوب (Task Achievement)',
  'Coherence and Cohesion': 'الترابط والتماسك (Coherence & Cohesion)',
  'Coherence & Cohesion': 'الترابط والتماسك (Coherence & Cohesion)',
  'Lexical Resource': 'المفردات (Lexical Resource)',
  'Grammatical Range and Accuracy': 'القواعد والدقة (Grammar & Accuracy)',
  'Grammatical Range & Accuracy': 'القواعد والدقة (Grammar & Accuracy)',
  'Grammar & Accuracy': 'القواعد والدقة (Grammar & Accuracy)',
};

/** Return the bilingual label for a criterion, or the original name if not found. */
function getCriterionLabel(name: string): string {
  return CRITERION_LABELS[name] || name;
}

// Results Screen Component
const ResultsScreen = ({ assessment, onNewAssessment, onBack }: { assessment: Assessment | null; onNewAssessment: () => void; onBack: () => void }) => {
  // Always recalculate totals from individual criterion scores
  const safeAssessment = assessment ? recalculateScores(assessment) : null;
  const { selectedCourse, extractedText } = useAppStore();
  const [activeTab, setActiveTab] = useState('overview');
  const [isDownloading, setIsDownloading] = useState(false);
  const { toast } = useToast();

  // Null check - redirect if no assessment
  if (!safeAssessment) {
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
            <h2 className="text-xl font-semibold mb-2">لا يوجد تقييم (No Assessment Found)</h2>
            <p className="text-muted-foreground text-sm mb-6">يرجى تقديم مقالك للتقييم أولاً (Please submit your essay first.)</p>
            <Button
              onClick={onNewAssessment}
              className="bg-[#1a5f2a] hover:bg-[#1a5f2a]/90"
            >
              ابدأ تقييم جديد (New Assessment)
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
          text: `I scored ${safeAssessment.percentage}% (${safeAssessment.totalScore}/${safeAssessment.maxScore}) on my ${selectedCourse?.name || 'essay'} assessment!`,
        });
      } else {
        await navigator.clipboard.writeText(
          `AWE Assessment Results\nScore: ${safeAssessment.totalScore}/${safeAssessment.maxScore} (${Math.round(safeAssessment.percentage)}%)`
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
                  animate={{ strokeDashoffset: 352 - (352 * safeAssessment.percentage) / 100 }}
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
                  {safeAssessment.percentage}%
                </motion.span>
                <span className="text-sm opacity-80">الدرجة (Score)</span>
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
                <span className="text-2xl font-bold">{safeAssessment.totalScore}/{safeAssessment.maxScore}</span>
              </div>
              <p className="text-sm opacity-80">المجموع (Total)</p>
              <Badge className="mt-2 bg-[#c9a227] text-white border-0">
                {safeAssessment.percentage! >= 80 ? 'Excellent' : safeAssessment.percentage! >= 60 ? 'Good' : 'Needs Work'}
              </Badge>
            </motion.div>
          </div>
        </div>

        {/* Tabs */}
        <div className="px-4 pt-4">
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="w-full h-11 p-1 bg-muted rounded-xl">
              <TabsTrigger value="overview" className="flex-1 h-9 rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm">
                نظرة عامة
              </TabsTrigger>
              <TabsTrigger value="criteria" className="flex-1 h-9 rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm">
                ملاحظات مفصلة
              </TabsTrigger>
              <TabsTrigger value="feedback" className="flex-1 h-9 rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm">
                ملاحظات عامة
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
                      <p className="text-2xl font-bold">{safeAssessment.totalScore}/{safeAssessment.maxScore}</p>
                      <p className="text-xs text-muted-foreground">المجموع (Total)</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="p-4 text-center">
                      <TrendingUp className="w-8 h-8 mx-auto mb-2 text-[#1a5f2a]" />
                      <p className="text-2xl font-bold">{Math.round(safeAssessment.percentage)}%</p>
                      <p className="text-xs text-muted-foreground">النسبة (Percentage)</p>
                    </CardContent>
                  </Card>
                </div>

                {/* Criteria Preview */}
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base">تفصيل الدرجات (Score Breakdown)</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {safeAssessment.scores.map((score, index) => (
                      <motion.div
                        key={score.criterionId}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: index * 0.1 }}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-sm font-medium">{getCriterionLabel(score.criterionName)}</span>
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
                {safeAssessment.scores.map((score, index) => {
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
                                <h4 className="font-semibold">{getCriterionLabel(score.criterionName)}</h4>
                                <p className="text-xs text-muted-foreground">من {score.maxScore}</p>
                              </div>
                            </div>
                            <Badge variant="secondary">
                              {Math.round((score.score / score.maxScore) * 100)}%
                            </Badge>
                          </div>
                          
                          {/* Structured Feedback */}
                          {parsedFeedback.justification && (
                            <div className="mb-3 bg-muted/40 p-3 rounded-lg">
                              <p className="text-xs font-medium text-[#1a5f2a] mb-1">سبب درجتك (Why you got this score):</p>
                              <p className="text-sm text-muted-foreground leading-relaxed">{parsedFeedback.justification}</p>
                            </div>
                          )}

                          {parsedFeedback.strengths && (
                            <div className="mb-3">
                              <p className="text-xs font-medium text-[#1a5f2a] mb-1">نقاط قوتك (Your strengths):</p>
                              <p className="text-sm text-muted-foreground">{parsedFeedback.strengths}</p>
                            </div>
                          )}
                          
                          {parsedFeedback.mistakes.length > 0 && (
                            <div className="mb-3">
                              <p className="text-xs font-medium text-red-600 mb-1">أخطاؤك (Your mistakes):</p>
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
                              <p className="text-xs font-medium text-[#c9a227] mb-1">نصائح للتحسين (Tips to improve):</p>
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

            {activeTab === 'feedback' && assessment && (
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
                      <CardTitle className="text-base">ملاحظات عامة (Overall Feedback)</CardTitle>
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
                        <CardTitle className="text-base">عدد الكلمات (Word Count)</CardTitle>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="flex items-center justify-between">
                        <span className="text-2xl font-bold">{assessment.wordCount}</span>
                        <span className="text-sm text-muted-foreground">
                          {assessment.targetWordCount 
                            ? selectedCourse?.code === 'LANC2146'
                              ? `Target: ${assessment.targetWordCount.min}-${assessment.targetWordCount.max} words (+/-20)`
                              : `Target: ${assessment.targetWordCount.min}-${assessment.targetWordCount.max} words` 
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
              {isDownloading ? 'جاري التحميل...' : 'تحميل PDF'}
            </Button>
            <Button
              onClick={onNewAssessment}
              className="flex-1 h-12 bg-[#1a5f2a] hover:bg-[#1a5f2a]/90 rounded-xl ios-press"
            >
              <Plus className="w-4 h-4 mr-2" />
              مقال جديد
            </Button>
          </div>
          <Button
            variant="ghost"
            onClick={() => useAppStore.getState().setStep('records')}
            className="w-full h-10 text-muted-foreground rounded-xl ios-press"
          >
            <History className="w-4 h-4 mr-2" />
            سجلات التقييم (Records)
          </Button>
        </div>
      </div>
    </PageTransition>
  );
};

export default ResultsScreen;
