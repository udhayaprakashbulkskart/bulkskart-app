import React, { useState, useEffect } from 'react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Search, Loader2, Image as ImageIcon, Check, ExternalLink, Sparkles } from 'lucide-react';
import {
  searchPixabay, PixabayImageHit, PixabayCategory, mapToPixabayCategory
} from '@/lib/pixabay';
import { toast } from 'sonner';

interface PixabayImagePickerModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelectImage: (imageUrl: string, tags?: string) => void;
  defaultQuery?: string;
  defaultCategory?: string;
}

const CATEGORY_CHIPS: { label: string; cat: PixabayCategory }[] = [
  { label: 'Industry & Heavy Machinery', cat: 'industry' },
  { label: 'Electronics & Computer', cat: 'computer' },
  { label: 'Textiles & Apparel', cat: 'fashion' },
  { label: 'Packaging & Buildings', cat: 'buildings' },
  { label: 'Logistics & Cargo', cat: 'transportation' },
  { label: 'Agriculture & Food', cat: 'food' },
  { label: 'Chemicals & Science', cat: 'science' },
  { label: 'Medical & Pharma', cat: 'health' },
  { label: 'B2B Trade & Corporate', cat: 'business' }
];

export default function PixabayImagePickerModal({
  open,
  onOpenChange,
  onSelectImage,
  defaultQuery = '',
  defaultCategory = 'industry'
}: PixabayImagePickerModalProps) {
  const [query, setQuery] = useState(defaultQuery || 'industrial machinery');
  const [selectedCategory, setSelectedCategory] = useState<PixabayCategory>(
    mapToPixabayCategory(defaultCategory)
  );
  const [loading, setLoading] = useState(false);
  const [images, setImages] = useState<PixabayImageHit[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);

  const fetchImages = async (searchTerm: string, category: PixabayCategory) => {
    setLoading(true);
    try {
      const res = await searchPixabay({
        q: searchTerm,
        category,
        image_type: 'photo',
        orientation: 'horizontal',
        per_page: 24,
        safesearch: true
      });
      setImages(res.hits || []);
      if (res.hits && res.hits.length > 0) {
        setSelectedId(res.hits[0].id);
      }
    } catch (err) {
      toast.error('Failed to search Pixabay images');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open) {
      const initialQuery = defaultQuery || 'industrial manufacturing';
      setQuery(initialQuery);
      const mappedCat = mapToPixabayCategory(defaultCategory);
      setSelectedCategory(mappedCat);
      fetchImages(initialQuery, mappedCat);
    }
  }, [open, defaultQuery, defaultCategory]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;
    fetchImages(query.trim(), selectedCategory);
  };

  const handleCategorySelect = (cat: PixabayCategory) => {
    setSelectedCategory(cat);
    fetchImages(query.trim(), cat);
  };

  const handleConfirmSelection = () => {
    const selected = images.find(img => img.id === selectedId);
    if (!selected) {
      toast.error('Please select an image first');
      return;
    }
    const chosenUrl = selected.webformatURL || selected.largeImageURL || '';
    if (chosenUrl) {
      onSelectImage(chosenUrl, selected.tags || '');
      toast.success('Representative image added from Pixabay API');
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[calc(100%-2rem)] md:max-w-3xl max-h-[90dvh] flex flex-col p-5 bg-[#0a0f1d] border-[#2A2A2A] text-foreground">
        <DialogHeader className="shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="p-1.5 rounded-lg bg-[#FF5A1F]/20 text-[#FF5A1F]">
                <Sparkles className="w-4 h-4" />
              </span>
              <DialogTitle className="text-base sm:text-lg font-bold text-white">
                Search Representative Images (Pixabay API)
              </DialogTitle>
            </div>
            <Badge variant="outline" className="border-[#FF5A00]/40 text-[#FF7A2E] text-[10px]">
              API Key Active
            </Badge>
          </div>
          <DialogDescription className="text-xs text-muted-foreground mt-1">
            Fetch royalty-free, high-resolution product photos via Pixabay API. Selected images will be labeled as &quot;Representative image&quot;.
          </DialogDescription>
        </DialogHeader>

        {/* Search Bar */}
        <form onSubmit={handleSearchSubmit} className="flex gap-2 mt-3 shrink-0">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="e.g. Copper wire, CNC milling, solar panel, polyester yarn..."
              className="pl-9 bg-[#C94400] border-[#2A2A2A] text-white text-xs h-9"
            />
          </div>
          <Button
            type="submit"
            disabled={loading}
            className="bg-[#C94400] hover:bg-[#e04e17] text-white text-xs h-9 px-4 shrink-0 font-semibold"
          >
            {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Search'}
          </Button>
        </form>

        {/* Category Chips */}
        <div className="flex items-center gap-1.5 overflow-x-auto py-2 shrink-0 no-scrollbar">
          {CATEGORY_CHIPS.map(c => (
            <button
              key={c.cat}
              type="button"
              onClick={() => handleCategorySelect(c.cat)}
              className={`px-2.5 py-1 rounded-full text-[11px] font-medium whitespace-nowrap transition-all border ${
                selectedCategory === c.cat
                  ? 'bg-[#C94400] text-white border-[#FF5A1F]'
                  : 'bg-[#0A0A0A]/80 text-muted-foreground border-[#2A2A2A] hover:text-white'
              }`}
            >
              {c.label}
            </button>
          ))}
        </div>

        {/* Image Grid */}
        <div className="flex-1 overflow-y-auto min-h-0 py-2 pr-1">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-16 text-muted-foreground gap-2">
              <Loader2 className="w-8 h-8 animate-spin text-[#FF5A1F]" />
              <p className="text-xs">Querying Pixabay API...</p>
            </div>
          ) : images.length === 0 ? (
            <div className="text-center py-16 border border-dashed border-[#2A2A2A] rounded-xl p-6">
              <ImageIcon className="w-10 h-10 text-muted-foreground mx-auto mb-2 opacity-50" />
              <p className="text-xs font-semibold text-white">No images found on Pixabay</p>
              <p className="text-[11px] text-muted-foreground mt-1">Try broadening your search term or selecting another category.</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
              {images.map(img => {
                const isSelected = img.id === selectedId;
                return (
                  <div
                    key={img.id}
                    onClick={() => setSelectedId(img.id)}
                    className={`group relative rounded-xl overflow-hidden border cursor-pointer aspect-[4/3] bg-[#0A0A0A] transition-all ${
                      isSelected
                        ? 'border-[#FF5A1F] ring-2 ring-[#FF5A1F]/50 scale-[1.02]'
                        : 'border-[#2A2A2A] hover:border-[#2A2A2A]'
                    }`}
                  >
                    <img
                      src={img.webformatURL}
                      alt={img.tags}
                      loading="lazy"
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                    {isSelected && (
                      <div className="absolute top-2 right-2 w-6 h-6 rounded-full bg-[#C94400] text-white flex items-center justify-center shadow-lg">
                        <Check className="w-3.5 h-3.5 stroke-[3]" />
                      </div>
                    )}
                    <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent p-2 text-[10px] text-white/90">
                      <p className="truncate font-medium">{(img.tags || 'Product photo').split(',')[0]}</p>
                      <p className="text-[9px] text-muted-foreground truncate">By {img.user} via Pixabay</p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <DialogFooter className="shrink-0 pt-3 border-t border-[#2A2A2A] flex items-center justify-between sm:justify-between w-full">
          <div className="text-[11px] text-muted-foreground flex items-center gap-1.5">
            <span>Powered by Pixabay API</span>
            <span>•</span>
            <span className="text-[#FF7A2E]">Free for commercial use</span>
          </div>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => onOpenChange(false)}
              className="border border-white/20 text-white hover:bg-white/10 text-xs"
            >
              Cancel
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={handleConfirmSelection}
              disabled={!selectedId}
              className="bg-[#C94400] hover:bg-[#e04e17] text-white text-xs font-semibold px-4"
            >
              Select Representative Photo
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
