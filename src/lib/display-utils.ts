export function getScoreColor(score: number, max: number): string {
  const percentage = (score / max) * 100;
  if (percentage >= 80) return 'text-green-600';
  if (percentage >= 60) return 'text-[#c9a227]';
  if (percentage >= 40) return 'text-orange-500';
  return 'text-red-500';
}

export function getPerformanceBadge(percentage: number): { label: string; color: string; borderColor: string } {
  if (percentage >= 80) return { label: 'Excellent', color: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400', borderColor: 'border-green-300 dark:border-green-700' };
  if (percentage >= 60) return { label: 'Good', color: 'bg-[#c9a227]/10 text-[#c9a227]', borderColor: 'border-[#c9a227]/30' };
  if (percentage >= 40) return { label: 'Satisfactory', color: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400', borderColor: 'border-orange-300 dark:border-orange-700' };
  return { label: 'Needs Improvement', color: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400', borderColor: 'border-red-300 dark:border-red-700' };
}

export function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) + ' \u2022 ' + date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}
