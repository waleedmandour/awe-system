'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAppStore, type Course, SUMMARY_SOURCE_TEXTS, SYNTHESIS_ASSIGNMENTS, LANC1070_PRACTICE_TESTS, LANC2146_PRACTICE_TESTS } from '@/lib/store';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  ChevronLeft,
  ChevronRight,
  GraduationCap,
  BookOpen,
  CheckCircle,
  FileText,
  Award,
  ClipboardList,
  PenTool,
  FlaskConical,
} from 'lucide-react';
import { PageTransition } from '@/lib/animations';

// Course Selection Screen
const CourseSelectionScreen = ({ onSelect, onBack }: { onSelect: () => void; onBack: () => void }) => {
  const { courses, selectedCourse, setSelectedCourse, selectedExamType, setSelectedExamType, selectedWritingType, setSelectedWritingType, selectedPracticeType, setSelectedPracticeType, selectedSourceTextId, setSelectedSourceTextId, writingPrompt, setWritingPrompt } = useAppStore();
  const [activeTab, setActiveTab] = useState<'foundation' | 'credit'>('foundation');

  // Whether the currently selected course requires an exam-type choice
  const needsExamType = selectedCourse?.code === '0230' || selectedCourse?.code === '0340';

  // Whether the currently selected course requires a writing-type choice
  const needsWritingType = selectedCourse?.code === 'LANC2160';
  const needsSourceText = needsWritingType && selectedWritingType === 'summary';
  const needsSynthesisAssignment = needsWritingType && selectedWritingType === 'synthesis';

  // Whether the currently selected course requires a practice-type choice (LANC1070 or LANC2146)
  const needsPracticeType = selectedCourse?.code === 'LANC1070' || selectedCourse?.code === 'LANC2146';
  const needsPracticeTest = needsPracticeType && !!selectedPracticeType;

  // Filter practice tests by selected practice type
  const filteredPracticeTests = needsPracticeType && selectedPracticeType
    ? selectedCourse?.code === 'LANC2146'
      ? LANC2146_PRACTICE_TESTS.filter(t => t.practiceType === selectedPracticeType)
      : LANC1070_PRACTICE_TESTS.filter(t => t.practiceType === selectedPracticeType)
    : [];

  // Whether Foundation Final Exam needs a writing prompt input
  const needsWritingPrompt = (selectedCourse?.code === '0230' || selectedCourse?.code === '0340') && selectedExamType === 'final';

  // Whether the Continue button should be enabled
  const canContinue = selectedCourse
    && (!needsExamType || selectedExamType)
    && (!needsWritingType || selectedWritingType)
    && (!needsSourceText || selectedSourceTextId)
    && (!needsSynthesisAssignment || selectedSourceTextId)
    && (!needsPracticeType || selectedPracticeType)
    && (!needsPracticeTest || selectedSourceTextId);

  const filteredCourses = courses.filter((course) => {
    if (activeTab === 'credit') return course.program === 'post-foundation';
    return course.program === activeTab;
  });

  // Build the second line text for the green button
  const getButtonSubtitle = () => {
    if (needsExamType && selectedExamType) {
      return selectedExamType === 'mid-semester' ? 'Mid-semester' : 'Final';
    }
    if (needsWritingType && selectedWritingType) {
      if (selectedWritingType === 'summary' && needsSourceText && selectedSourceTextId) {
        const src = SUMMARY_SOURCE_TEXTS.find(s => s.id === selectedSourceTextId);
        return `Summary: ${src?.title.split('—')[0].trim() || ''}`;
      }
      if (selectedWritingType === 'synthesis' && needsSynthesisAssignment && selectedSourceTextId) {
        const asn = SYNTHESIS_ASSIGNMENTS.find(a => a.id === selectedSourceTextId);
        return `Synthesis: ${asn?.title || ''}`;
      }
      return selectedWritingType === 'summary' ? 'Summary Writing' : 'Synthesis Essay';
    }
    if (needsPracticeType && selectedPracticeType) {
      const label = selectedPracticeType === 'mid-semester' ? 'Mid-Semester' : 'Final';
      if (needsPracticeTest && selectedSourceTextId) {
        const test = selectedCourse?.code === 'LANC2146'
          ? LANC2146_PRACTICE_TESTS.find(t => t.id === selectedSourceTextId)
          : LANC1070_PRACTICE_TESTS.find(t => t.id === selectedSourceTextId);
        return `${label}: ${test?.title || ''}`;
      }
      return `${label} Practice Test`;
    }
    return null;
  };

  const buttonSubtitle = getButtonSubtitle();

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

        {/* Course Cards with nested children */}
        <ScrollArea className="flex-1">
          <div className="p-4 pb-2 space-y-3">
            {filteredCourses.map((course, index) => {
              const isSelected = selectedCourse?.id === course.id;
              const showChildren = isSelected;
              const accentColor = activeTab === 'foundation' ? '#1a5f2a' : '#c9a227';

              // Check which children to show for this specific course
              const showExamType = showChildren && (course.code === '0230' || course.code === '0340');
              const showWritingType = showChildren && course.code === 'LANC2160';
              const showPracticeType = showChildren && (course.code === 'LANC1070' || course.code === 'LANC2146');
              const showSourceText = showWritingType && selectedWritingType === 'summary';
              const showSynthesisAssignment = showWritingType && selectedWritingType === 'synthesis';
              const showWritingPrompt = showChildren && (course.code === '0230' || course.code === '0340') && selectedExamType === 'final';
              const showPracticeTest = showPracticeType && !!selectedPracticeType;
              const coursePracticeTests = showPracticeType && selectedPracticeType
                ? course.code === 'LANC2146'
                  ? LANC2146_PRACTICE_TESTS.filter(t => t.practiceType === selectedPracticeType)
                  : LANC1070_PRACTICE_TESTS.filter(t => t.practiceType === selectedPracticeType)
                : [];

              return (
                <motion.div
                  key={course.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.1 }}
                  className="space-y-0"
                >
                  {/* Course Card */}
                  <Card
                    className={`cursor-pointer transition-all duration-200 border-2 ${
                      isSelected
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
                        {isSelected && (
                          <CheckCircle className="w-6 h-6 text-[#1a5f2a]" />
                        )}
                      </div>
                    </CardContent>
                  </Card>

                  {/* Nested children container — visually indented under the course card */}
                  <AnimatePresence>
                    {showChildren && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        transition={{ duration: 0.3 }}
                        className="overflow-hidden"
                      >
                        <div
                          className="ml-4 pl-4 border-l-2 py-2 space-y-2"
                          style={{ borderColor: accentColor }}
                        >
                          {/* Exam-Type Selection for FP0340 */}
                          {showExamType && (
                            <div className="space-y-2">
                              <p className="text-sm font-medium text-muted-foreground px-1">
                                Select exam type:
                              </p>
                              <div className="flex gap-2">
                                <button
                                  onClick={(e) => { e.stopPropagation(); setSelectedExamType('mid-semester'); }}
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
                                  onClick={(e) => { e.stopPropagation(); setSelectedExamType('final'); }}
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
                          )}

                          {/* Writing Prompt Input for FP0340 Final Exam */}
                          {showWritingPrompt && (
                            <div className="space-y-2">
                              <p className="text-sm font-medium text-muted-foreground px-1">
                                Writing Prompt <span className="font-normal">(Optional)</span>
                              </p>
                              <textarea
                                value={writingPrompt}
                                onChange={(e) => setWritingPrompt(e.target.value)}
                                placeholder="Enter the essay topic or writing prompt, if provided by your instructor..."
                                rows={3}
                                className="w-full rounded-xl border-2 border-muted-foreground/20 bg-white px-4 py-3 text-sm resize-none focus:outline-none focus:border-[#1a5f2a]/50 focus:ring-1 focus:ring-[#1a5f2a]/20 placeholder:text-muted-foreground/60 transition-colors"
                              />
                            </div>
                          )}

                          {/* Writing-Type Selection for LANC2160 */}
                          {showWritingType && (
                            <div className="space-y-2">
                              <p className="text-sm font-medium text-muted-foreground px-1">
                                Select writing task:
                              </p>
                              <div className="flex gap-2">
                                <button
                                  onClick={(e) => { e.stopPropagation(); setSelectedWritingType('summary'); }}
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
                                  onClick={(e) => { e.stopPropagation(); setSelectedWritingType('synthesis'); }}
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
                          )}

                          {/* Practice-Type Selection for LANC1070 */}
                          {showPracticeType && (
                            <div className="space-y-2">
                              <p className="text-sm font-medium text-muted-foreground px-1">
                                Select practice test type:
                              </p>
                              <div className="flex gap-2">
                                <button
                                  onClick={(e) => { e.stopPropagation(); setSelectedPracticeType('mid-semester'); }}
                                  className={`flex-1 flex flex-col items-center justify-center gap-1.5 rounded-xl border-2 px-4 py-4 text-sm font-medium transition-all duration-200 ios-press ${
                                    selectedPracticeType === 'mid-semester'
                                      ? 'border-[#c9a227] bg-[#c9a227]/10 text-[#c9a227]'
                                      : 'border-muted-foreground/20 bg-white hover:border-muted-foreground/40 text-muted-foreground'
                                  }`}
                                >
                                  <FileText className="w-5 h-5" />
                                  <span>Mid-Semester Practice</span>
                                </button>
                                <button
                                  onClick={(e) => { e.stopPropagation(); setSelectedPracticeType('final'); }}
                                  className={`flex-1 flex flex-col items-center justify-center gap-1.5 rounded-xl border-2 px-4 py-4 text-sm font-medium transition-all duration-200 ios-press ${
                                    selectedPracticeType === 'final'
                                      ? 'border-[#c9a227] bg-[#c9a227]/10 text-[#c9a227]'
                                      : 'border-muted-foreground/20 bg-white hover:border-muted-foreground/40 text-muted-foreground'
                                  }`}
                                >
                                  <Award className="w-5 h-5" />
                                  <span>Final Practice</span>
                                </button>
                              </div>
                            </div>
                          )}

                          {/* Source Text Selection for Summary Writing */}
                          {showSourceText && (
                            <div className="space-y-2">
                              <p className="text-sm font-medium text-muted-foreground px-1">
                                Select source text to summarize:
                              </p>
                              <div className="space-y-2">
                                {SUMMARY_SOURCE_TEXTS.map((source) => {
                                  const isSelected = selectedSourceTextId === source.id;
                                  return (
                                    <motion.div key={source.id} whileTap={{ scale: 0.98 }}>
                                      <button
                                        onClick={(e) => { e.stopPropagation(); setSelectedSourceTextId(source.id); }}
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
                          )}

                          {/* Synthesis Assignment Selection */}
                          {showSynthesisAssignment && (
                            <div className="space-y-2">
                              <p className="text-sm font-medium text-muted-foreground px-1">
                                Select synthesis assignment:
                              </p>
                              <div className="space-y-2">
                                {SYNTHESIS_ASSIGNMENTS.map((assignment) => {
                                  const isSelected = selectedSourceTextId === assignment.id;
                                  return (
                                    <motion.div key={assignment.id} whileTap={{ scale: 0.98 }}>
                                      <button
                                        onClick={(e) => { e.stopPropagation(); setSelectedSourceTextId(assignment.id); }}
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
                                            <ClipboardList className="w-5 h-5" />
                                          </div>
                                          <div className="flex-1 min-w-0">
                                            <p className={`text-sm font-semibold leading-tight ${
                                              isSelected ? 'text-[#c9a227]' : 'text-foreground'
                                            }`}>
                                              {assignment.title}
                                            </p>
                                            <p className="text-xs text-muted-foreground mt-0.5">
                                              {assignment.sources.length} sources &middot; {assignment.targetWordCount.min}&ndash;{assignment.targetWordCount.max} words
                                            </p>
                                            <p className="text-xs text-muted-foreground mt-0.5">
                                              {assignment.expectedParagraphs} paragraphs expected
                                            </p>
                                          </div>
                                        </div>
                                      </button>
                                    </motion.div>
                                  );
                                })}
                              </div>
                            </div>
                          )}

                          {/* Practice Test Selection for LANC1070 */}
                          {showPracticeTest && (
                            <div className="space-y-2">
                              <p className="text-sm font-medium text-muted-foreground px-1">
                                Select practice test:
                              </p>
                              {coursePracticeTests.length > 0 ? (
                                <div className="space-y-2">
                                  {coursePracticeTests.map((test) => {
                                    const isSelected = selectedSourceTextId === test.id;
                                    const isLanc2146 = 'reportSections' in test;
                                    const IconComponent = isLanc2146 ? FlaskConical : PenTool;
                                    return (
                                      <motion.div key={test.id} whileTap={{ scale: 0.98 }}>
                                        <button
                                          onClick={(e) => { e.stopPropagation(); setSelectedSourceTextId(test.id); }}
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
                                              <IconComponent className="w-5 h-5" />
                                            </div>
                                            <div className="flex-1 min-w-0">
                                              <p className={`text-sm font-semibold leading-tight ${
                                                isSelected ? 'text-[#c9a227]' : 'text-foreground'
                                              }`}>
                                                {test.title}
                                              </p>
                                              <p className="text-xs text-muted-foreground mt-0.5">
                                                {test.targetWordCount.min}&ndash;{test.targetWordCount.max} words{isLanc2146 ? '' : ` &middot; ${test.expectedParagraphs} paragraphs expected`}
                                              </p>
                                              {isLanc2146 && (test as any).description && (
                                                <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                                                  {(test as any).description}
                                                </p>
                                              )}
                                            </div>
                                          </div>
                                        </button>
                                      </motion.div>
                                    );
                                  })}
                                </div>
                              ) : (
                                <div className="text-center py-6 text-muted-foreground text-sm">
                                  No practice tests available yet.
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              );
            })}
          </div>
        </ScrollArea>

        {/* Footer */}
        <div className="p-4 border-t bg-white/80 backdrop-blur-sm">
          <Button
            onClick={onSelect}
            disabled={!canContinue}
            className="w-full h-12 bg-[#1a5f2a] hover:bg-[#1a5f2a]/90 rounded-xl ios-press"
          >
            <span className="flex flex-col items-center justify-center flex-1 min-w-0 gap-0.5">
              <span>Continue with {selectedCourse?.code || 'Course'}</span>
              {buttonSubtitle && (
                <span className="text-xs font-normal opacity-80 truncate max-w-full">
                  {buttonSubtitle}
                </span>
              )}
            </span>
            <ChevronRight className="w-4 h-4 ml-2 flex-shrink-0" />
          </Button>
        </div>
      </div>
    </PageTransition>
  );
};

export default CourseSelectionScreen;
