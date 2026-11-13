import React, { useState, useRef } from 'react';
import {
  Upload, X, ArrowLeft, ArrowRight, Eye, Star,
  RefreshCw, Plus, Image as ImageIcon, CheckCircle2, Sparkles
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { uploadImage, formatBytes } from '@/lib/storage';
import PixabayImagePickerModal from '@/components/common/PixabayImagePickerModal';
import { toast } from 'sonner';

interface MultiImageUploaderProps {
  images: string[];
  onChange: (images: string[]) => void;
  maxImages?: number;
  maxSizeBytes?: number;
  label?: string;
  description?: string;
  folder?: string;
  disabled?: boolean;
  defaultSearchTerm?: string;
  defaultCategory?: string;
}

interface UploadTask {
  id: string;
  name: string;
  progress: number;
  status: 'uploading' | 'completed' | 'error';
  error?: string;
}

export default function MultiImageUploader({
  images = [],
  onChange,
  maxImages = 10,
  maxSizeBytes = 5 * 1024 * 1024,
  label = 'Product Images',
  description = 'Add up to 10 photos. The first image is the main catalog display thumbnail.',
  folder = 'products',
  disabled = false,
  defaultSearchTerm = '',
  defaultCategory = 'industry',
}: MultiImageUploaderProps) {
  const [tasks, setTasks] = useState<UploadTask[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [pixabayModalOpen, setPixabayModalOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const canAddMore = images.length < maxImages;

  const handleFiles = async (files: FileList | File[]) => {
    if (disabled) return;
    const fileArray = Array.from(files);

    if (images.length + fileArray.length > maxImages) {
      toast.error(`You can only upload a maximum of ${maxImages} images (${images.length} already uploaded)`);
      return;
    }

    const validFiles: File[] = [];
    for (const file of fileArray) {
      if (!file.type.startsWith('image/')) {
        toast.error(`Skipped "${file.name}": Not a valid image file.`);
        continue;
      }
      if (file.size > maxSizeBytes) {
        toast.error(`Skipped "${file.name}": Size exceeds ${formatBytes(maxSizeBytes)}.`);
        continue;
      }
      validFiles.push(file);
    }

    if (validFiles.length === 0) return;

    // Create initial tasks
    const newTasks: UploadTask[] = validFiles.map((f, i) => ({
      id: `${Date.now()}_${i}`,
      name: f.name,
      progress: 20,
      status: 'uploading',
    }));

    setTasks((prev) => [...prev, ...newTasks]);

    // Upload in parallel
    const uploadedUrls: string[] = [];
    let compressedCount = 0;

    for (let i = 0; i < validFiles.length; i++) {
      const file = validFiles[i];
      const task = newTasks[i];

      try {
        const result = await uploadImage(file, {
          bucket: 'product-images',
          folder,
          maxSizeBytes,
        });

        uploadedUrls.push(result.url);
        if (result.compressed) compressedCount++;

        setTasks((prev) =>
          prev.map((t) => (t.id === task.id ? { ...t, progress: 100, status: 'completed' } : t))
        );
      } catch (err: any) {
        console.error('Error uploading file:', file.name, err);
        setTasks((prev) =>
          prev.map((t) => (t.id === task.id ? { ...t, status: 'error', error: err.message } : t))
        );
        toast.error(`Failed to upload ${file.name}: ${err.message}`);
      }
    }

    if (uploadedUrls.length > 0) {
      onChange([...images, ...uploadedUrls]);
      if (compressedCount > 0) {
        toast.success(`Uploaded ${uploadedUrls.length} image(s) (${compressedCount} auto-optimized for high-speed loading)`);
      } else {
        toast.success(`Uploaded ${uploadedUrls.length} image(s) successfully`);
      }
    }

    // Clear completed tasks after short delay
    setTimeout(() => {
      setTasks((prev) => prev.filter((t) => t.status !== 'completed'));
    }, 1200);

    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const removeImage = (index: number) => {
    if (disabled) return;
    const newImgs = images.filter((_, i) => i !== index);
    onChange(newImgs);
  };

  const moveImage = (index: number, direction: 'left' | 'right') => {
    if (disabled) return;
    const targetIdx = direction === 'left' ? index - 1 : index + 1;
    if (targetIdx < 0 || targetIdx >= images.length) return;

    const updated = [...images];
    const [moved] = updated.splice(index, 1);
    updated.splice(targetIdx, 0, moved);
    onChange(updated);
  };

  const setAsPrimary = (index: number) => {
    if (disabled || index === 0) return;
    const updated = [...images];
    const [moved] = updated.splice(index, 1);
    updated.unshift(moved);
    onChange(updated);
    toast.success('Set as primary catalog photo');
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <label className="text-sm font-semibold text-foreground flex items-center gap-1.5">
            <ImageIcon className="w-4 h-4 text-primary" /> {label}
            <span className="text-xs font-normal text-muted-foreground">
              ({images.length}/{maxImages})
            </span>
          </label>
          {description && <p className="text-xs text-muted-foreground mt-0.5">{description}</p>}
        </div>
        <div className="flex items-center gap-2">
          {canAddMore && !disabled && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setPixabayModalOpen(true)}
              className="h-8 text-xs border-[#FF5A1F]/40 text-[#FF5A1F] hover:bg-[#B33D00]/10 font-medium"
            >
              <Sparkles className="w-3.5 h-3.5 mr-1 text-[#FF5A1F]" /> Search Pixabay Photos
            </Button>
          )}
          {canAddMore && !disabled && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => fileInputRef.current?.click()}
              className="h-8 text-xs border-primary/30 text-primary hover:bg-primary/10"
            >
              <Plus className="w-3.5 h-3.5 mr-1" /> Add Photos
            </Button>
          )}
        </div>
      </div>

      {/* Drag & Drop Upload Zone */}
      {canAddMore && !disabled && (
        <div
          onClick={() => fileInputRef.current?.click()}
          onDragOver={(e) => {
            e.preventDefault();
            setIsDragging(true);
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setIsDragging(false);
            if (e.dataTransfer.files) handleFiles(e.dataTransfer.files);
          }}
          className={`border-2 border-dashed rounded-xl p-5 text-center cursor-pointer transition-all flex flex-col items-center justify-center gap-2 ${
            isDragging
              ? 'border-primary bg-primary/10 ring-2 ring-primary/20'
              : 'border-border bg-card/40 hover:bg-card hover:border-primary/50'
          }`}
        >
          <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary">
            <Upload className="w-5 h-5" />
          </div>
          <div>
            <p className="text-xs sm:text-sm font-medium text-foreground">
              Click to browse or drag & drop product photos
            </p>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              JPG, PNG, WEBP, GIF up to {formatBytes(maxSizeBytes)} each • Multi-select enabled
            </p>
          </div>
        </div>
      )}

      {/* Upload Tasks In Progress */}
      {tasks.length > 0 && (
        <div className="space-y-2 bg-card border border-border rounded-lg p-3">
          <p className="text-xs font-medium text-foreground">Uploading files...</p>
          {tasks.map((task) => (
            <div key={task.id} className="space-y-1">
              <div className="flex justify-between text-[11px]">
                <span className="truncate max-w-[70%] text-muted-foreground">{task.name}</span>
                <span className="text-primary font-medium">
                  {task.status === 'completed' ? 'Done' : task.status === 'error' ? 'Failed' : `${task.progress}%`}
                </span>
              </div>
              <Progress value={task.progress} className="h-1.5" />
            </div>
          ))}
        </div>
      )}

      {/* Image Grid with Thumbnails, Reordering & Primary Badges */}
      {images.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 pt-1">
          {images.map((url, idx) => (
            <div
              key={`${url}_${idx}`}
              className="relative group rounded-xl overflow-hidden border border-border bg-card aspect-square shadow-sm flex flex-col"
            >
              <img src={url} alt={`Product photo ${idx + 1}`} className="w-full h-full object-cover" />

              {/* Primary badge */}
              {idx === 0 ? (
                <div className="absolute top-1.5 left-1.5 bg-[#C94400] text-primary-foreground text-[10px] font-bold px-2 py-0.5 rounded shadow z-10 flex items-center gap-1">
                  <Star className="w-3 h-3 fill-current" /> Cover Photo
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setAsPrimary(idx)}
                  className="absolute top-1.5 left-1.5 bg-[#0A0A0A]/60 hover:bg-[#0A0A0A]/90 text-white text-[10px] font-medium px-1.5 py-0.5 rounded backdrop-blur-xs opacity-0 group-hover:opacity-100 transition-opacity z-10"
                >
                  Make Cover
                </button>
              )}

              {/* Action Overlays */}
              <div className="absolute inset-0 bg-[#0A0A0A]/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-between p-2">
                <div className="flex justify-end gap-1">
                  <button
                    type="button"
                    onClick={() => setPreviewUrl(url)}
                    className="p-1 rounded bg-white/20 hover:bg-white/40 text-white transition-colors"
                    title="Preview photo"
                  >
                    <Eye className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => removeImage(idx)}
                    className="p-1 rounded bg-destructive/80 hover:bg-destructive text-white transition-colors"
                    title="Delete photo"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* Reordering Controls */}
                <div className="flex justify-between items-center bg-[#0A0A0A]/40 rounded px-1.5 py-0.5 backdrop-blur-xs">
                  <button
                    type="button"
                    disabled={idx === 0}
                    onClick={() => moveImage(idx, 'left')}
                    className="p-0.5 text-white disabled:opacity-30 hover:text-primary transition-colors"
                    title="Move left"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" />
                  </button>
                  <span className="text-[10px] font-semibold text-white/90">{idx + 1}</span>
                  <button
                    type="button"
                    disabled={idx === images.length - 1}
                    onClick={() => moveImage(idx, 'right')}
                    className="p-0.5 text-white disabled:opacity-30 hover:text-primary transition-colors"
                    title="Move right"
                  >
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif,image/avif"
        multiple
        className="hidden"
        onChange={(e) => {
          if (e.target.files) handleFiles(e.target.files);
        }}
      />

      {/* Photo Preview Modal */}
      <Dialog open={!!previewUrl} onOpenChange={(o) => !o && setPreviewUrl(null)}>
        <DialogContent className="max-w-[calc(100%-2rem)] md:max-w-2xl p-2 bg-card border-border">
          <DialogHeader className="p-3 pb-0">
            <DialogTitle className="text-sm font-semibold">Image Preview</DialogTitle>
          </DialogHeader>
          <div className="aspect-[4/3] rounded-lg overflow-hidden bg-muted flex items-center justify-center m-2">
            {previewUrl && <img src={previewUrl} alt="Preview" className="w-full h-full object-contain" />}
          </div>
        </DialogContent>
      </Dialog>

      {/* Pixabay Representative Image Picker Modal */}
      <PixabayImagePickerModal
        open={pixabayModalOpen}
        onOpenChange={setPixabayModalOpen}
        onSelectImage={(url) => {
          if (canAddMore) {
            onChange([...images, url]);
          }
        }}
        defaultQuery={defaultSearchTerm}
        defaultCategory={defaultCategory}
      />
    </div>
  );
}
