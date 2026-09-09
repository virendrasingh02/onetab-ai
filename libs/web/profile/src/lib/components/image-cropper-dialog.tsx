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
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

export interface ImageCropperDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  cropType: 'avatar' | 'cover';
  title?: string;
  description?: string;
  initialImageUrl?: string | null;
  onCropComplete: (croppedDataUrl: string) => void;
}

/** Cover banner target ratio (~16:6). */
const COVER_ASPECT = 2.67;
const MIN_ZOOM = 1;
const MAX_ZOOM = 4;

type Size = { w: number; h: number };
type Point = { x: number; y: number };

/** Keep `pan` within the range that still covers the crop window entirely. */
function clampPan(
  pan: Point,
  displayedW: number,
  displayedH: number,
  cropW: number,
  cropH: number,
): Point {
  const maxX = Math.max(0, (displayedW - cropW) / 2);
  const maxY = Math.max(0, (displayedH - cropH) / 2);
  return {
    x: Math.min(maxX, Math.max(-maxX, pan.x)),
    y: Math.min(maxY, Math.max(-maxY, pan.y)),
  };
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
  const isAvatar = cropType === 'avatar';

  const [imageSrc, setImageSrc] = useState<string | null>(initialImageUrl || null);
  const [srcId, setSrcId] = useState(0);
  const [natural, setNatural] = useState<Size | null>(null);
  const [containerSize, setContainerSize] = useState<Size | null>(null);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState<Point>({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState<Point>({ x: 0, y: 0 });
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const imageRef = useRef<HTMLImageElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const resizeObsRef = useRef<ResizeObserver | null>(null);

  // Measure from layout (client*), ignoring the dialog's open-in scale
  // animation. Only accept a real, non-zero box.
  const measure = useCallback((el: HTMLDivElement | null) => {
    if (!el) return;
    const w = el.clientWidth;
    const h = el.clientHeight;
    if (w > 0 && h > 0) {
      setContainerSize((prev) =>
        prev && prev.w === w && prev.h === h ? prev : { w, h },
      );
    }
  }, []);

  // Callback ref: fires exactly when the viewport node mounts/unmounts, so the
  // measurement never depends on the dialog's animation timing.
  const attachViewport = useCallback(
    (el: HTMLDivElement | null) => {
      containerRef.current = el;
      resizeObsRef.current?.disconnect();
      if (el) {
        measure(el);
        resizeObsRef.current = new ResizeObserver(() => measure(el));
        resizeObsRef.current.observe(el);
      } else {
        resizeObsRef.current = null;
      }
    },
    [measure],
  );

  useEffect(() => () => resizeObsRef.current?.disconnect(), []);

  useEffect(() => {
    if (open) measure(containerRef.current);
  }, [open, measure]);

  // Reset all transform state when the dialog opens or the seed image changes.
  useEffect(() => {
    if (!open) return;
    setImageSrc(initialImageUrl || null);
    setSrcId((n) => n + 1);
    setNatural(null);
    setZoom(1);
    setPan({ x: 0, y: 0 });
    setErrorMessage(null);
    setIsProcessing(false);
  }, [open, initialImageUrl]);

  // A usable viewport size at all times — measured when available, otherwise a
  // sane default that the ResizeObserver corrects within a frame.
  const viewport = useMemo<Size>(
    () => containerSize ?? { w: 512, h: isAvatar ? 288 : 224 },
    [containerSize, isAvatar],
  );

  // The visible crop window, centered in the viewport.
  const cropBox = useMemo<Size>(() => {
    const { w, h } = viewport;
    if (isAvatar) {
      const side = Math.max(96, Math.round(Math.min(w, h) - 32));
      return { w: side, h: side };
    }
    let cw = w;
    let ch = Math.round(w / COVER_ASPECT);
    if (ch > h) {
      ch = h;
      cw = Math.round(h * COVER_ASPECT);
    }
    return { w: cw, h: ch };
  }, [viewport, isAvatar]);

  // Size the image so it *covers* the crop window at zoom = 1 (no empty edges).
  const baseSize = useMemo<Size | null>(() => {
    if (!natural) return null;
    const scale = Math.max(cropBox.w / natural.w, cropBox.h / natural.h);
    return { w: natural.w * scale, h: natural.h * scale };
  }, [cropBox, natural]);

  // Re-clamp the pan whenever the zoom (and thus displayed size) changes.
  useEffect(() => {
    if (!baseSize) return;
    setPan((p) =>
      clampPan(p, baseSize.w * zoom, baseSize.h * zoom, cropBox.w, cropBox.h),
    );
  }, [zoom, baseSize, cropBox]);

  // Wheel-to-zoom. Registered natively so preventDefault is honoured (React's
  // onWheel is passive and would let the dialog scroll instead).
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      if (!imageSrc) return;
      e.preventDefault();
      setZoom((z) =>
        Math.min(
          MAX_ZOOM,
          Math.max(MIN_ZOOM, +(z - e.deltaY * 0.0016).toFixed(3)),
        ),
      );
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [imageSrc]);

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
        setNatural(null);
        setZoom(1);
        setPan({ x: 0, y: 0 });
        setImageSrc(e.target.result as string);
        setSrcId((n) => n + 1);
      }
    };
    reader.onerror = () => setErrorMessage('Failed to read selected image file.');
    reader.readAsDataURL(file);
  };

  const openFilePicker = () => fileInputRef.current?.click();

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!imageSrc) return;
    e.currentTarget.setPointerCapture?.(e.pointerId);
    setIsDragging(true);
    setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDragging || !baseSize) return;
    setPan(
      clampPan(
        { x: e.clientX - dragStart.x, y: e.clientY - dragStart.y },
        baseSize.w * zoom,
        baseSize.h * zoom,
        cropBox.w,
        cropBox.h,
      ),
    );
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    e.currentTarget.releasePointerCapture?.(e.pointerId);
    setIsDragging(false);
  };

  const handleReset = () => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
    setErrorMessage(null);
  };

  const handleCrop = useCallback(() => {
    const img = imageRef.current;
    if (!img || !imageSrc || !natural || !baseSize) return;

    try {
      setIsProcessing(true);

      // Uniform mapping: displayed pixels -> natural (bitmap) pixels.
      const totalScale = (baseSize.w / natural.w) * zoom;
      const displayedW = natural.w * totalScale;
      const displayedH = natural.h * totalScale;

      const safePan = clampPan(
        pan,
        displayedW,
        displayedH,
        cropBox.w,
        cropBox.h,
      );

      // Top-left of the (transformed) image and of the crop window, both in
      // viewport coordinates. The image is flex-centered, then translated.
      const imgLeft = viewport.w / 2 + safePan.x - displayedW / 2;
      const imgTop = viewport.h / 2 + safePan.y - displayedH / 2;
      const cropLeft = (viewport.w - cropBox.w) / 2;
      const cropTop = (viewport.h - cropBox.h) / 2;

      // Source rectangle in the image bitmap.
      let sx = (cropLeft - imgLeft) / totalScale;
      let sy = (cropTop - imgTop) / totalScale;
      let sw = cropBox.w / totalScale;
      let sh = cropBox.h / totalScale;

      // Guard against sub-pixel rounding pushing us past the bitmap edge.
      sx = Math.max(0, Math.min(sx, natural.w - 1));
      sy = Math.max(0, Math.min(sy, natural.h - 1));
      sw = Math.max(1, Math.min(sw, natural.w - sx));
      sh = Math.max(1, Math.min(sh, natural.h - sy));

      const outW = isAvatar ? 512 : 1280;
      const outH = isAvatar ? 512 : Math.round(outW * (cropBox.h / cropBox.w));

      const canvas = document.createElement('canvas');
      canvas.width = outW;
      canvas.height = outH;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        setErrorMessage('Failed to initialize canvas context.');
        setIsProcessing(false);
        return;
      }

      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      // Opaque backing so JPEG encoding of any transparent source stays white.
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, outW, outH);
      ctx.drawImage(img, sx, sy, sw, sh, 0, 0, outW, outH);

      const croppedDataUrl = canvas.toDataURL('image/jpeg', 0.9);
      if (!croppedDataUrl || croppedDataUrl === 'data:,') {
        throw new Error('empty output');
      }

      onCropComplete(croppedDataUrl);
      setIsProcessing(false);
      onOpenChange(false);
    } catch {
      setErrorMessage(
        'Could not process this image. If it is an existing photo, please choose a new file.',
      );
      setIsProcessing(false);
    }
  }, [
    imageSrc,
    isAvatar,
    zoom,
    pan,
    viewport,
    natural,
    cropBox,
    baseSize,
    onCropComplete,
    onOpenChange,
  ]);

  const ready = Boolean(imageSrc && natural);

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

          {/* Cropper viewport */}
          <div
            ref={attachViewport}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
            className={`relative w-full overflow-hidden bg-neutral-950 border border-border/80 rounded-xl select-none touch-none flex items-center justify-center ${
              isAvatar ? 'h-64 sm:h-72' : 'h-48 sm:h-56'
            } ${imageSrc ? 'cursor-grab active:cursor-grabbing' : 'cursor-pointer'}`}
            onClick={() => {
              if (!imageSrc) openFilePicker();
            }}
          >
            {imageSrc ? (
              <>
                <img
                  key={srcId}
                  ref={imageRef}
                  src={imageSrc}
                  alt="Crop preview"
                  draggable={false}
                  onLoad={(e) => {
                    const el = e.currentTarget;
                    if (el.naturalWidth && el.naturalHeight) {
                      setNatural({ w: el.naturalWidth, h: el.naturalHeight });
                    }
                  }}
                  onError={() =>
                    setErrorMessage(
                      'Could not load this image for editing. Please choose a new file.',
                    )
                  }
                  style={{
                    width: baseSize ? `${baseSize.w}px` : 'auto',
                    height: baseSize ? `${baseSize.h}px` : 'auto',
                    maxWidth: 'none',
                    maxHeight: 'none',
                    transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
                    transformOrigin: 'center center',
                    transition: isDragging ? 'none' : 'transform 0.06s linear',
                    willChange: 'transform',
                    opacity: baseSize ? 1 : 0,
                  }}
                  className="pointer-events-none select-none block"
                />

                {/* Mask overlay — matches the exact region that gets saved */}
                <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                  <div
                    style={{ width: cropBox.w, height: cropBox.h }}
                    className={`border-2 border-white/90 ring-1 ring-black/40 shadow-[0_0_0_9999px_rgba(0,0,0,0.62)] ${
                      isAvatar ? 'rounded-full' : 'rounded-md'
                    }`}
                  />
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
              if (file) handleFileSelect(file);
              e.target.value = '';
            }}
          />

          {/* Controls: zoom & re-upload */}
          {imageSrc && (
            <div className="space-y-3 pt-1">
              <div className="flex items-center gap-3">
                <ZoomOut className="size-4 text-muted-foreground shrink-0" />
                <Slider
                  value={[zoom]}
                  min={MIN_ZOOM}
                  max={MAX_ZOOM}
                  step={0.01}
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
                  onClick={openFilePicker}
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

              <p className="text-[11px] text-muted-foreground text-center">
                Drag to reposition · scroll or use the slider to zoom
              </p>
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
            disabled={!ready || isProcessing}
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
