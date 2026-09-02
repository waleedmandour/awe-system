'use client';

import { useState } from 'react';
import { Check, Download, Trash2, Loader2, Cloud, Smartphone, FlaskConical } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { MODEL_CONFIG, type LocalModelOption } from '@/lib/config';
import type { DownloadProgress } from '@/lib/model-downloader';

export interface CloudModelOption {
  id: string;
  name: string;
  description: string;
  freeTier?: { requestsPerMinute: number; requestsPerDay: number };
}

interface ModelSelectionCardProps {
  model: CloudModelOption | LocalModelOption;
  kind: 'cloud' | 'local';
  isSelected: boolean;
  isDownloaded: boolean;
  onDownload?: (modelId: string, onProgress: (p: DownloadProgress) => void) => Promise<void>;
  onDelete?: (modelId: string) => Promise<void>;
  onSelect: (modelId: string) => void;
}

/**
 * Card for one selectable AI model — cloud (Gemini) or local (on-device).
 * Local cards additionally support download with progress, delete, and an
 * "Experimental" badge for unverified community conversions.
 */
export function ModelSelectionCard({
  model,
  kind,
  isSelected,
  isDownloaded,
  onDownload,
  onDelete,
  onSelect,
}: ModelSelectionCardProps) {
  const [downloading, setDownloading] = useState(false);
  const [progress, setProgress] = useState<DownloadProgress | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const isLocal = kind === 'local';
  const isExperimental = isLocal && (model as LocalModelOption).experimental;

  const handleDownload = async () => {
    if (!onDownload) return;
    setDownloading(true);
    setActionError(null);
    setProgress({ modelId: model.id, percent: 0, receivedBytes: 0, totalBytes: 0 });
    try {
      await onDownload(model.id, setProgress);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Download failed.');
    } finally {
      setDownloading(false);
      setProgress(null);
    }
  };

  const handleDelete = async () => {
    if (!onDelete) return;
    setDeleting(true);
    setActionError(null);
    try {
      await onDelete(model.id);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Delete failed.');
    } finally {
      setDeleting(false);
    }
  };

  const formatBytes = (bytes: number) => {
    if (bytes >= 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
    if (bytes >= 1024 * 1024) return `${Math.round(bytes / (1024 * 1024))} MB`;
    return `${Math.round(bytes / 1024)} KB`;
  };

  return (
    <div
      className={`border rounded-xl p-4 transition-colors ${
        isSelected ? 'border-[#1a5f2a] bg-[#1a5f2a]/5' : 'border-border bg-card'
      }`}
    >
      <div className="flex justify-between items-start gap-2 mb-2">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="font-semibold text-sm">{model.name}</h3>
            {isLocal ? (
              <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300">
                <Smartphone className="w-3 h-3" /> On-device
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300">
                <Cloud className="w-3 h-3" /> Cloud
              </span>
            )}
            {isExperimental && (
              <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300">
                <FlaskConical className="w-3 h-3" /> Experimental
              </span>
            )}
          </div>
          <p className="text-xs text-muted-foreground mt-1">{model.description}</p>
          {isLocal && (model as LocalModelOption).size && (
            <p className="text-[11px] text-muted-foreground mt-0.5">
              Download size: {(model as LocalModelOption).size}
            </p>
          )}
          {!isLocal && model.id === MODEL_CONFIG.current && (
            <p className="text-[11px] text-emerald-600 dark:text-emerald-400 mt-0.5">
              Free tier: {MODEL_CONFIG.freeTierLimits[model.id]?.requestsPerDay ?? '—'} requests/day
            </p>
          )}
        </div>
        {isSelected && <Check className="w-5 h-5 text-[#1a5f2a] shrink-0" />}
      </div>

      {isLocal && (
        <div className="mt-3">
          {downloading && progress ? (
            <div className="space-y-1">
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>Downloading…</span>
                <span>{progress.percent >= 0 ? `${progress.percent}%` : formatBytes(progress.receivedBytes)}</span>
              </div>
              <div className="h-2 rounded-full bg-muted overflow-hidden">
                <div
                  className="h-full bg-[#1a5f2a] transition-all"
                  style={{ width: `${progress.percent >= 0 ? progress.percent : 100}%` }}
                />
              </div>
            </div>
          ) : isDownloaded ? (
            <div className="flex items-center justify-between gap-2">
              <span className="inline-flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400">
                <Check className="w-3.5 h-3.5" /> Downloaded
              </span>
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleDelete}
                  disabled={deleting}
                  className="h-8 px-2 text-muted-foreground hover:text-destructive"
                  aria-label={`Delete ${model.name}`}
                >
                  {deleting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                </Button>
                <Button
                  size="sm"
                  onClick={() => onSelect(model.id)}
                  disabled={isSelected}
                  className={`h-8 px-4 rounded-lg text-xs ${
                    isSelected ? 'bg-[#1a5f2a] text-white' : 'bg-secondary text-secondary-foreground hover:bg-secondary/80'
                  }`}
                >
                  {isSelected ? 'Selected' : 'Select'}
                </Button>
              </div>
            </div>
          ) : (
            <Button
              onClick={handleDownload}
              disabled={downloading}
              className="w-full h-9 text-xs rounded-lg bg-[#1a5f2a] hover:bg-[#1a5f2a]/90 text-white disabled:bg-muted disabled:text-muted-foreground"
            >
              {downloading ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" /> Preparing…
                </>
              ) : (
                <>
                  <Download className="w-3.5 h-3.5 mr-1" /> Download Model
                </>
              )}
            </Button>
          )}
        </div>
      )}

      {!isLocal && (
        <div className="mt-3">
          <Button
            size="sm"
            onClick={() => onSelect(model.id)}
            disabled={isSelected}
            className={`w-full h-9 text-xs rounded-lg ${
              isSelected ? 'bg-[#1a5f2a] text-white' : 'bg-secondary text-secondary-foreground hover:bg-secondary/80'
            }`}
          >
            {isSelected ? 'Selected' : 'Select'}
          </Button>
        </div>
      )}

      {actionError && (
        <p className="text-xs text-destructive mt-2 break-words">{actionError}</p>
      )}
    </div>
  );
}
