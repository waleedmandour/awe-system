'use client';

import { useState, useRef } from 'react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';
import {
  ChevronLeft,
  ChevronRight,
  Camera,
  X,
  Plus,
  Zap,
  Loader2,
  Info,
} from 'lucide-react';
import { PageTransition } from '@/lib/animations';
import { processImageFile } from '@/lib/image-utils';

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
      // Determine total pages for size optimization (reduces quality/dimensions for multi-page)
      const currentPageCount = (page1Image ? 1 : 0) + (page2Image ? 1 : 0);
      const totalPages = currentPageCount + 1; // +1 for the image being added now
      // Process image: resize, convert to JPEG, detect HEIC
      // Multi-page uploads use more aggressive compression to stay within Vercel body limits
      const processedDataUri = await processImageFile(file, totalPages);
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

  const handleConfirm = async () => {
    const images: string[] = [];
    if (page1Image) images.push(page1Image);
    if (page2Image) images.push(page2Image);
    if (images.length > 0) {
      // When 2 pages are uploaded, re-check total payload size and warn if too large
      if (images.length === 2) {
        const totalSize = images.reduce((sum, img) => sum + img.length, 0);
        const MAX_PAYLOAD = 4.2 * 1024 * 1024; // ~4.2MB (Vercel limit is ~4.5MB)
        if (totalSize > MAX_PAYLOAD) {
          toast({
            title: 'Compressing Images',
            description: 'Optimizing image sizes for two-page upload...',
          });
          // Re-process both images with aggressive compression for multi-page
          try {
            const compressed = await Promise.all(images.map(img => recompressDataUri(img)));
            onUpload(compressed);
            return;
          } catch (e) {
            // If re-compression fails, try sending anyway
            console.warn('Re-compression failed, sending original images:', e);
          }
        }
      }
      onUpload(images);
    }
  };

  // Re-compress a data URI to reduce size for multi-page uploads
  const recompressDataUri = (dataUri: string): Promise<string> => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        // Scale down to 1400px max dimension with 0.72 quality for multi-page
        const MAX_DIM = 1400;
        let { width, height } = img;
        if (width > MAX_DIM || height > MAX_DIM) {
          const scale = MAX_DIM / Math.max(width, height);
          width = Math.round(width * scale);
          height = Math.round(height * scale);
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) { reject(new Error('Canvas not supported')); return; }
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', 0.72));
      };
      img.onerror = () => reject(new Error('Failed to re-compress image'));
      img.src = dataUri;
    });
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

export default UploadScreen;
