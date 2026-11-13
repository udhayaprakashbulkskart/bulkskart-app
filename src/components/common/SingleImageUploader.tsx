import React, { useState, useRef } from 'react';
import { Upload, X, Camera, RefreshCw, CheckCircle2, Image as ImageIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { uploadImage, formatBytes, StorageBucket } from '@/lib/storage';
import { toast } from 'sonner';

interface SingleImageUploaderProps {
  value?: string | null;
  onChange: (url: string | null) => void;
  bucket?: StorageBucket;
  folder?: string;
  shape?: 'circle' | 'square' | 'banner' | 'rectangle';
  label?: string;
  description?: string;
  maxSizeBytes?: number;
  className?: string;
  placeholderIcon?: React.ReactNode;
  disabled?: boolean;
}

export default function SingleImageUploader({
  value,
  onChange,
  bucket = 'company-assets',
  folder = '',
  shape = 'square',
  label,
  description,
  maxSizeBytes = 5 * 1024 * 1024,
  className = '',
  placeholderIcon,
  disabled = false,
}: SingleImageUploaderProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFile = async (file: File) => {
    if (disabled || isUploading) return;

    if (!file.type.startsWith('image/')) {
      toast.error('Please upload a valid image file (JPG, PNG, WEBP, GIF)');
      return;
    }

    if (file.size > maxSizeBytes) {
      toast.error(`Image size exceeds limit of ${formatBytes(maxSizeBytes)}`);
      return;
    }

    setIsUploading(true);
    setProgress(20);

    // Simulate steady progress feedback
    const interval = setInterval(() => {
      setProgress((prev) => (prev < 85 ? prev + 15 : prev));
    }, 150);

    try {
      const result = await uploadImage(file, {
        bucket,
        folder,
        maxSizeBytes,
      });

      clearInterval(interval);
      setProgress(100);

      onChange(result.url);

      if (result.compressed) {
        toast.success(`Image uploaded! Auto-optimized (${formatBytes(result.originalSize)} → ${formatBytes(result.newSize)})`);
      } else {
        toast.success(`Image uploaded successfully (${formatBytes(result.newSize)})`);
      }
    } catch (err: any) {
      clearInterval(interval);
      console.error('Upload error:', err);
      toast.error(err.message || 'Failed to upload image. Please try again.');
    } finally {
      setIsUploading(false);
      setProgress(0);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    if (!disabled && !isUploading) setIsDragging(true);
  };

  const onDragLeave = () => {
    setIsDragging(false);
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      handleFile(files[0]);
    }
  };

  const handleRemove = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange(null);
    toast.info('Image removed');
  };

  // Shape-specific styling
  const shapeStyles = {
    circle: 'w-24 h-24 sm:w-28 sm:h-28 rounded-full aspect-square',
    square: 'w-24 h-24 sm:w-28 sm:h-28 rounded-xl aspect-square',
    rectangle: 'w-full aspect-[16/10] max-w-sm rounded-xl',
    banner: 'w-full aspect-[21/9] sm:aspect-[3/1] rounded-xl',
  }[shape];

  return (
    <div className={`space-y-2 ${className}`}>
      {label && <label className="text-xs sm:text-sm font-medium text-foreground block">{label}</label>}

      {/* Banners are full width, so they always stack; square/circle previews sit beside their text on larger screens. */}
      <div className={`flex flex-col ${shape === 'banner' || shape === 'rectangle' ? '' : 'sm:flex-row sm:items-center'} items-start gap-4 w-full min-w-0`}>
        {/* Visual Box */}
        <div
          onClick={() => !disabled && !isUploading && fileInputRef.current?.click()}
          onDragOver={onDragOver}
          onDragLeave={onDragLeave}
          onDrop={onDrop}
          className={`relative group overflow-hidden border-2 cursor-pointer transition-all flex items-center justify-center bg-muted/40 ${shapeStyles} ${
            isDragging
              ? 'border-primary bg-primary/10 ring-2 ring-primary/20'
              : value
              ? 'border-border hover:border-primary/60'
              : 'border-dashed border-border hover:border-primary/50'
          } ${disabled ? 'opacity-60 cursor-not-allowed' : ''}`}
        >
          {value ? (
            <>
              <img
                src={value}
                alt="Preview"
                className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
              />
              {!disabled && (
                <div className="absolute inset-0 bg-[#0A0A0A]/50 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-1 text-white text-xs font-medium p-2 text-center">
                  <Camera className="w-5 h-5 mb-0.5" />
                  <span>Change Image</span>
                </div>
              )}
            </>
          ) : (
            <div className="flex flex-col items-center justify-center p-3 text-center text-muted-foreground gap-1.5">
              {placeholderIcon || <Upload className="w-6 h-6 text-muted-foreground/60 group-hover:text-primary transition-colors" />}
              <span className="text-[11px] font-medium group-hover:text-foreground transition-colors">
                {isDragging ? 'Drop image here' : 'Click / Drag'}
              </span>
            </div>
          )}

          {/* Loading overlay */}
          {isUploading && (
            <div className="absolute inset-0 bg-background/80 backdrop-blur-xs flex flex-col items-center justify-center gap-2 p-3 z-20">
              <RefreshCw className="w-5 h-5 text-primary animate-spin" />
              <div className="w-full max-w-[80%]">
                <Progress value={progress} className="h-1.5 bg-muted" />
              </div>
              <span className="text-[10px] text-muted-foreground font-medium">{progress}%</span>
            </div>
          )}
        </div>

        {/* Action Controls & Description */}
        <div className="flex-1 space-y-2 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={disabled || isUploading}
              onClick={() => fileInputRef.current?.click()}
              className="h-8 text-xs border-border"
            >
              {isUploading ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 mr-1.5 animate-spin" /> Uploading...
                </>
              ) : (
                <>
                  <Upload className="w-3.5 h-3.5 mr-1.5" /> {value ? 'Replace' : 'Upload'}
                </>
              )}
            </Button>

            {value && !disabled && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleRemove}
                className="h-8 text-xs text-destructive hover:bg-destructive/10"
              >
                <X className="w-3.5 h-3.5 mr-1" /> Remove
              </Button>
            )}
          </div>

          {description && <p className="text-[11px] text-muted-foreground leading-relaxed">{description}</p>}
          <p className="text-[10px] text-muted-foreground/70">
            JPG, PNG, WEBP • Max {formatBytes(maxSizeBytes)} • Auto-compressed
          </p>
        </div>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif,image/avif"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleFile(file);
        }}
      />
    </div>
  );
}
