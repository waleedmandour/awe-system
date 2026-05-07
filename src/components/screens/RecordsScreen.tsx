'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAppStore, type AssessmentRecord } from '@/lib/store';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Progress } from '@/components/ui/progress';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { recalculateRecord, parseFeedback } from '@/lib/scoring-utils';
import { getPerformanceBadge, formatDate } from '@/lib/display-utils';
import {
  ChevronLeft,
  ChevronDown,
  Eye,
  Download,
  Trash2,
  Plus,
  History,
  MessageSquare,
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

const fadeInUp = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -20 },
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

  // Recalculate scores for all historical records to fix any old totals
  const safeRecords = records.map(recalculateRecord);
  const filteredRecords = filterCourse === 'all'
    ? safeRecords
    : safeRecords.filter((r) => r.course?.id === filterCourse);

  // Stats (based on recalculated scores)
  const totalAssessments = filteredRecords.length;
  const avgScore = totalAssessments > 0
    ? Math.round(filteredRecords.reduce((sum, r) => sum + r.assessment.percentage, 0) / totalAssessments)
    : 0;
  const bestScore = totalAssessments > 0
    ? Math.round(Math.max(...filteredRecords.map((r) => r.assessment.percentage)))
    : 0;

  // Sparkline data (last 10)
  const sparklineData = filteredRecords.slice(0, 10).reverse().map((r) => r.assessment.percentage);

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

export default RecordsScreen;
