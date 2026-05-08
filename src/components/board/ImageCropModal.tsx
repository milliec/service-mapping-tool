'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import ReactCrop, {
  centerCrop,
  makeAspectCrop,
  type Crop,
  type PixelCrop,
} from 'react-image-crop';
import 'react-image-crop/dist/ReactCrop.css';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Camera, Sparkles, Upload } from 'lucide-react';
import { cn } from '@/lib/utils';

const SLIDE_ASPECT = 3 / 2;
const OUTPUT_W = 480;
const OUTPUT_H = 320;
const PAGE_MAX_W = 1200;
const PAGE_MAX_H = 12000;

type CropFormat = 'slide' | 'page';

function createCenteredSlideCrop(imgWidth: number, imgHeight: number): Crop {
  return centerCrop(
    makeAspectCrop({ unit: '%', width: 90 }, SLIDE_ASPECT, imgWidth, imgHeight),
    imgWidth,
    imgHeight,
  );
}

function fullImageCrop(_imgWidth: number, _imgHeight: number): Crop {
  return { unit: '%' as const, x: 0, y: 0, width: 100, height: 100 };
}

function cropAndResizeSlide(
  image: HTMLImageElement,
  pixelCrop: PixelCrop,
): Promise<string> {
  const canvas = document.createElement('canvas');
  canvas.width = OUTPUT_W;
  canvas.height = OUTPUT_H;
  const ctx = canvas.getContext('2d');
  if (!ctx) return Promise.reject(new Error('Canvas not supported'));

  const scaleX = image.naturalWidth / image.width;
  const scaleY = image.naturalHeight / image.height;

  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(
    image,
    pixelCrop.x * scaleX,
    pixelCrop.y * scaleY,
    pixelCrop.width * scaleX,
    pixelCrop.height * scaleY,
    0,
    0,
    OUTPUT_W,
    OUTPUT_H,
  );

  return Promise.resolve(canvas.toDataURL('image/jpeg', 0.85));
}

function cropAndResizePage(image: HTMLImageElement, pixelCrop: PixelCrop): string {
  const scaleX = image.naturalWidth / image.width;
  const scaleY = image.naturalHeight / image.height;
  const sw = pixelCrop.width * scaleX;
  const sh = pixelCrop.height * scaleY;
  const sx = pixelCrop.x * scaleX;
  const sy = pixelCrop.y * scaleY;

  let outW = Math.round(sw);
  let outH = Math.round(sh);
  if (outW > PAGE_MAX_W) {
    const f = PAGE_MAX_W / outW;
    outW = PAGE_MAX_W;
    outH = Math.round(outH * f);
  }
  if (outH > PAGE_MAX_H) {
    const f = PAGE_MAX_H / outH;
    outH = PAGE_MAX_H;
    outW = Math.round(outW * f);
  }
  if (outW < 1) outW = 1;
  if (outH < 1) outH = 1;

  const canvas = document.createElement('canvas');
  canvas.width = outW;
  canvas.height = outH;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas not supported');
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(image, sx, sy, sw, sh, 0, 0, outW, outH);
  return canvas.toDataURL('image/jpeg', 0.88);
}

interface ImageCropModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (dataUrl: string) => void;
  existingImage?: string;
  /** Initial crop mode; user can switch after the image is loaded. */
  defaultFormat?: CropFormat;
  /** L3 micro: only page/screen (free aspect); hides 3:2 option. */
  lockFormat?: 'page';
  /** Shown in the empty (pre-upload) state; closes the dialog after starting generation. */
  onGenerateWithAI?: () => void;
  /** Disable the AI control (e.g. while another step is generating). */
  generateWithAIDisabled?: boolean;
}

export function ImageCropModal({
  open,
  onOpenChange,
  onConfirm,
  existingImage,
  defaultFormat = 'slide',
  lockFormat,
  onGenerateWithAI,
  generateWithAIDisabled = false,
}: ImageCropModalProps) {
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [crop, setCrop] = useState<Crop>();
  const [completedCrop, setCompletedCrop] = useState<PixelCrop>();
  const effectiveDefault: CropFormat = lockFormat === 'page' ? 'page' : defaultFormat;
  const [format, setFormat] = useState<CropFormat>(effectiveDefault);
  const imgRef = useRef<HTMLImageElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setFormat(lockFormat === 'page' ? 'page' : defaultFormat);
    }
  }, [open, defaultFormat, lockFormat]);

  useEffect(() => {
    if (!open) return;
    if (existingImage) {
      setImageSrc(existingImage);
      setCrop(undefined);
      setCompletedCrop(undefined);
    }
  }, [open, existingImage]);

  const applyFormatToImg = useCallback(
    (el: HTMLImageElement, f: CropFormat) => {
      const { width, height } = el;
      if (f === 'slide') {
        setCrop(createCenteredSlideCrop(width, height));
      } else {
        setCrop(fullImageCrop(width, height));
      }
    },
    [],
  );

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      setImageSrc(reader.result as string);
      setCrop(undefined);
      setCompletedCrop(undefined);
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  }, []);

  const handleImageLoad = useCallback(
    (e: React.SyntheticEvent<HTMLImageElement>) => {
      applyFormatToImg(e.currentTarget, format);
    },
    [format, applyFormatToImg],
  );

  const onFormatChange = useCallback(
    (next: CropFormat) => {
      setFormat(next);
      const el = imgRef.current;
      if (el) applyFormatToImg(el, next);
    },
    [applyFormatToImg],
  );

  const handleConfirm = useCallback(async () => {
    const img = imgRef.current;
    if (!img || !completedCrop) return;
    const dataUrl =
      format === 'slide'
        ? await cropAndResizeSlide(img, completedCrop)
        : cropAndResizePage(img, completedCrop);
    onConfirm(dataUrl);
    setImageSrc(null);
    setCrop(undefined);
    setCompletedCrop(undefined);
    onOpenChange(false);
  }, [completedCrop, format, onConfirm, onOpenChange]);

  const handleClose = useCallback(() => {
    setImageSrc(null);
    setCrop(undefined);
    setCompletedCrop(undefined);
    onOpenChange(false);
  }, [onOpenChange]);

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) handleClose();
      }}
    >
      <DialogContent className="max-h-[min(90vh,860px)] overflow-y-auto sm:max-w-lg" showCloseButton>
        <DialogHeader>
          <DialogTitle>
            {imageSrc ? 'Crop image' : 'Add storyboard image'}
          </DialogTitle>
        </DialogHeader>

        {!imageSrc ? (
          <div className="flex flex-col items-center gap-4 py-6">
            <p className="text-sm text-neutral-500">
              Upload a photo, screenshot, or take one with your camera
              {onGenerateWithAI ? ', or generate with AI.' : '.'}
            </p>
            <div className="flex gap-3">
              <Button
                variant="outline"
                size="default"
                onClick={() => fileInputRef.current?.click()}
              >
                <Upload className="mr-1.5 h-4 w-4" />
                Upload
              </Button>
              <Button
                variant="outline"
                size="default"
                onClick={() => cameraInputRef.current?.click()}
              >
                <Camera className="mr-1.5 h-4 w-4" />
                Camera
              </Button>
            </div>
            {onGenerateWithAI && (
              <>
                <div className="flex w-full max-w-sm items-center gap-3">
                  <div className="h-px min-w-0 flex-1 bg-neutral-200" />
                  <span className="shrink-0 text-[11px] font-medium uppercase tracking-wide text-neutral-400">
                    or
                  </span>
                  <div className="h-px min-w-0 flex-1 bg-neutral-200" />
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="default"
                  disabled={generateWithAIDisabled}
                  onClick={() => {
                    onGenerateWithAI();
                    handleClose();
                  }}
                >
                  <Sparkles className="mr-1.5 h-4 w-4" />
                  Generate with AI
                </Button>
              </>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleFileChange}
            />
            <input
              ref={cameraInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={handleFileChange}
            />
          </div>
        ) : (
          <div className="flex flex-col items-stretch gap-3">
            {lockFormat === 'page' ? (
              <p className="text-xs text-neutral-600">
                Page or screen capture — any aspect. Drag the crop. Export up to 1200px wide.
              </p>
            ) : (
              <>
                <div className="flex gap-2 rounded-lg border border-neutral-200 bg-neutral-50 p-1">
                  <button
                    type="button"
                    onClick={() => onFormatChange('slide')}
                    className={cn(
                      'flex-1 rounded-md px-2 py-1.5 text-xs font-medium transition-colors',
                      format === 'slide'
                        ? 'bg-white text-neutral-900 shadow-sm'
                        : 'text-neutral-500 hover:text-neutral-800',
                    )}
                  >
                    3:2 slide
                  </button>
                  <button
                    type="button"
                    onClick={() => onFormatChange('page')}
                    className={cn(
                      'flex-1 rounded-md px-2 py-1.5 text-xs font-medium transition-colors',
                      format === 'page'
                        ? 'bg-white text-neutral-900 shadow-sm'
                        : 'text-neutral-500 hover:text-neutral-800',
                    )}
                  >
                    Page / long screen
                  </button>
                </div>
                <p className="text-xs text-neutral-500">
                  {format === 'slide'
                    ? 'Fixed 3:2—good for storyboard frames. Drag corners to reframe.'
                    : 'Any aspect ratio—use for full-page or tall screen captures. Export keeps detail up to 1200px wide.'}
                </p>
              </>
            )}
            <div className="max-h-[min(60vh,520px)] w-full overflow-auto rounded-lg border border-neutral-200 bg-neutral-100">
              <ReactCrop
                crop={crop}
                onChange={(c) => setCrop(c)}
                onComplete={(c) => setCompletedCrop(c)}
                aspect={format === 'slide' ? SLIDE_ASPECT : undefined}
                keepSelection
                ruleOfThirds
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  ref={imgRef}
                  src={imageSrc}
                  alt="Source"
                  onLoad={handleImageLoad}
                  className="w-full object-contain"
                  style={{ maxHeight: 'min(55vh, 480px)' }}
                />
              </ReactCrop>
            </div>
          </div>
        )}

        <DialogFooter>
          {imageSrc && (
            <Button
              variant="outline"
              size="default"
              onClick={() => {
                setImageSrc(null);
                setCrop(undefined);
                setCompletedCrop(undefined);
              }}
            >
              Change image
            </Button>
          )}
          {imageSrc && (
            <Button
              size="default"
              onClick={() => void handleConfirm()}
              disabled={!completedCrop}
            >
              Save
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
