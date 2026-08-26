import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Slider,
} from '@org/ui';
import {
  Image as ImageIcon,
  RotateCcw,
  Upload,
  ZoomIn,
  ZoomOut,
  AlertCircle,
} from 'lucide-react';
import React, { useCallback, useEffect, useRef, useState } from 'react';

export interface ImageCropperDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  cropType: 'avatar' | 'cover';
  title?: string;
  description?: string;
  initialImageUrl?: string | null;
  onCropComplete: (croppedDataUrl: string) => void;
}

export function ImageCropperDialog({
  open,
  onOpenChange,
  cropType,
  title,
  description,
  initialImageUrl,
  onCropComplete,
}: ImageCropperDialogProps) {
  const [imageSrc, setImageSrc] = useState<string | null>(initialImageUrl || null);
  const [zoom, setZoom] = useState<number>(1);
  const [pan, setPan] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const imageRef = useRef<HTMLImageElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  // Aspect ratio parameters: Avatar 1:1, Cover 16:6 (~2.67:1)
  const isAvatar = cropType === 'avatar';
  const targetAspect = isAvatar ? 1 : 2.67;

  // Reset state when opening or initial image changes
  useEffect(() => {
    if (open) {
      setImageSrc(initialImageUrl || null);
      setZoom(1);
      setPan({ x: 0, y: 0 });
      setErrorMessage(null);
    }
  }, [open, initialImageUrl]);

  const handleFileSelect = (file: File) => {
    setErrorMessage(null);
    if (!file.type.startsWith('image/')) {
      setErrorMessage('Please select a valid image file (JPG, PNG, WebP).');
      return;
    }

    if (file.size > 15 * 1024 * 1024) {
      setErrorMessage('Image size must be 15MB or smaller.');
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      if (e.target?.result) {
        setImageSrc(e.target.result as string);
        setZoom(1);
        setPan({ x: 0, y: 0 });
      }
    };
    reader.onerror = () => {
      setErrorMessage('Failed to read selected image file.');
    };
    reader.readAsDataURL(file);
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (!imageSrc) return;
    setIsDragging(true);
    setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    setPan({
      x: e.clientX - dragStart.x,
      y: e.clientY - dragStart.y,
    });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleReset = () => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
    setErrorMessage(null);
  };

  const handleCrop = useCallback(() => {
    if (!imageSrc || !imageRef.current || !containerRef.current) return;

    try {
      setIsProcessing(true);
      const img = imageRef.current;
      const container = containerRef.current;

      const outputWidth = isAvatar ? 400 : 1200;
      const outputHeight = isAvatar ? 400 : Math.round(1200 / targetAspect);

      const canvas = document.createElement('canvas');
      canvas.width = outputWidth;
      canvas.height = outputHeight;
      const ctx = canvas.getContext('2d');

      if (!ctx) {
        setErrorMessage('Failed to initialize canvas context.');
        setIsProcessing(false);
        return;
      }

      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';

      // Container bounding measurements
      const containerRect = container.getBoundingClientRect();
      const containerAspect = containerRect.width / containerRect.height;
      const imageAspect = img.naturalWidth / img.naturalHeight;

      // Base displayed size without zoom
      let baseWidth: number;
      let baseHeight: number;

      if (imageAspect > containerAspect) {
        baseHeight = containerRect.height;
        baseWidth = baseHeight * imageAspect;
      } else {
        baseWidth = containerRect.width;
        baseHeight = baseWidth / imageAspect;
      }

      const displayedWidth = baseWidth * zoom;
      const displayedHeight = baseHeight * zoom;

      // Current center offset of image relative to container center
      const imageCenterX = containerRect.width / 2 + pan.x;
      const imageCenterY = containerRect.height / 2 + pan.y;

      const imageLeft = imageCenterX - displayedWidth / 2;
      const imageTop = imageCenterY - displayedHeight / 2;

      // Mapping from container space to canvas space
      const scaleX = outputWidth / containerRect.width;
      const scaleY = outputHeight / containerRect.height;

      const destX = imageLeft * scaleX;
      const destY = imageTop * scaleY;
      const destW = displayedWidth * scaleX;
      const destH = displayedHeight * scaleY;

      ctx.drawImage(img, destX, destY, destW, destH);

      const croppedDataUrl = canvas.toDataURL('image/jpeg', 0.92);
      onCropComplete(croppedDataUrl);
      setIsProcessing(false);
      onOpenChange(false);
    } catch {
      setErrorMessage('Error cropping image. Please try another image.');
      setIsProcessing(false);
    }
  }, [imageSrc, isAvatar, targetAspect, zoom, pan, onCropComplete, onOpenChange]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl p-0 overflow-hidden bg-card border-border shadow-2xl rounded-2xl">
        <DialogHeader className="p-5 pb-3 border-b border-border/60">
          <DialogTitle className="text-base font-bold text-foreground">
            {title || (isAvatar ? 'Customize Avatar' : 'Customize Header Cover')}
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            {description ||
              (isAvatar
                ? 'Upload, zoom, and reposition your profile picture.'
                : 'Upload, zoom, and reposition your background cover.')}
          </DialogDescription>
        </DialogHeader>

        <div className="p-5 space-y-4">
          {errorMessage && (
            <div className="flex items-center gap-2 p-3 text-xs rounded-xl bg-destructive/10 text-destructive border border-destructive/20">
              <AlertCircle className="size-4 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Cropper Viewport */}
          <div
            ref={containerRef}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
            className={`relative w-full overflow-hidden bg-neutral-950 border border-border/80 rounded-xl select-none flex items-center justify-center ${
              isAvatar ? 'h-64 sm:h-72' : 'h-48 sm:h-56'
            } ${imageSrc ? 'cursor-grab active:cursor-grabbing' : 'cursor-pointer'}`}
            onClick={() => {
              if (!imageSrc && fileInputRef.current) {
                fileInputRef.current.click();
              }
            }}
          >
            {imageSrc ? (
              <>
                <img
                  ref={imageRef}
                  src={imageSrc}
                  alt="Crop preview"
                  draggable={false}
                  style={{
                    transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
                    transformOrigin: 'center center',
                    transition: isDragging ? 'none' : 'transform 0.08s ease-out',
                  }}
                  className="max-w-none max-h-none pointer-events-none object-contain"
                />

                {/* Mask Overlay */}
                <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                  {isAvatar ? (
                    <div className="size-48 sm:size-52 rounded-full border-2 border-white/90 shadow-[0_0_0_9999px_rgba(0,0,0,0.65)] ring-1 ring-black/40" />
                  ) : (
                    <div className="w-full h-full border-2 border-white/90 shadow-[0_0_0_9999px_rgba(0,0,0,0.45)] ring-1 ring-black/40" />
                  )}
                </div>
              </>
            ) : (
              <div className="flex flex-col items-center justify-center p-6 text-center space-y-2 text-muted-foreground">
                <div className="p-3 rounded-full bg-surface-raised border border-border">
                  <Upload className="size-6 text-primary" />
                </div>
                <div>
                  <p className="text-xs font-semibold text-foreground">Click to upload an image</p>
                  <p className="text-[11px] text-muted-foreground">JPG, PNG or WebP up to 15MB</p>
                </div>
              </div>
            )}
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept="image/png, image/jpeg, image/webp, image/gif"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) {
                handleFileSelect(file);
              }
            }}
          />

          {/* Controls Bar: Zoom & Upload */}
          {imageSrc && (
            <div className="space-y-3 pt-1">
              <div className="flex items-center gap-3">
                <ZoomOut className="size-4 text-muted-foreground shrink-0" />
                <Slider
                  value={[zoom]}
                  min={0.8}
                  max={3.0}
                  step={0.05}
                  onValueChange={(val) => setZoom(val[0])}
                  className="flex-1"
                />
                <ZoomIn className="size-4 text-muted-foreground shrink-0" />
                <span className="text-[11px] font-mono text-muted-foreground w-10 text-right">
                  {Math.round(zoom * 100)}%
                </span>
              </div>

              <div className="flex items-center justify-between gap-2 pt-1">
                <Button
                  type="button"
                  variant="outline"
                  size="xs"
                  onClick={() => fileInputRef.current?.click()}
                  className="text-xs gap-1.5"
                >
                  <ImageIcon className="size-3.5" />
                  <span>Choose Another Image</span>
                </Button>

                <Button
                  type="button"
                  variant="ghost"
                  size="xs"
                  onClick={handleReset}
                  className="text-xs gap-1.5 text-muted-foreground hover:text-foreground"
                >
                  <RotateCcw className="size-3.5" />
                  <span>Reset</span>
                </Button>
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="p-4 bg-surface-muted/60 border-t border-border/60 flex items-center justify-between sm:justify-between gap-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => onOpenChange(false)}
            className="text-xs"
          >
            Cancel
          </Button>

          <Button
            type="button"
            variant="primary"
            size="sm"
            disabled={!imageSrc || isProcessing}
            loading={isProcessing}
            onClick={handleCrop}
            className="text-xs px-4"
          >
            Save &amp; Apply
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
