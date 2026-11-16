import { useEffect, useState, type ComponentType } from 'react';
import { Boxes, Cpu, FlaskConical, HardHat, Package, Scissors, Sprout, Truck, Zap } from 'lucide-react';

/** An icon for a category, picked from the category's own slug or name. */
export function categoryIcon(slug: string): ComponentType<{ className?: string }> {
  const s = slug.toLowerCase();
  if (/textile|apparel|garment|fabric|cloth/.test(s)) return Scissors;
  if (/agri|food|grain|spice|farm/.test(s)) return Sprout;
  if (/chemical|plastic|polymer|pharma/.test(s)) return FlaskConical;
  if (/construct|building|cement|steel|metal/.test(s)) return HardHat;
  if (/electr|light|solar|power/.test(s)) return Zap;
  if (/machin|industrial|equipment|tool/.test(s)) return Cpu;
  if (/pack/.test(s)) return Package;
  if (/vehicle|auto|truck|transport/.test(s)) return Truck;
  return Boxes;
}

/**
 * The buyer's own photo of what they want. Without one, or when it fails to load, a plain tile with the
 * category icon: never a stock or generated picture standing in for the buyer's product.
 */
export default function RequirementThumb({ src, alt, slug }: { src: string | null; alt: string; slug: string }) {
  const [broken, setBroken] = useState(false);
  useEffect(() => setBroken(false), [src]);
  if (src && !broken) {
    return (
      <img
        src={src}
        alt={alt}
        loading="lazy"
        decoding="async"
        onError={() => setBroken(true)}
        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
      />
    );
  }
  const Icon = categoryIcon(slug);
  return (
    <div className="w-full h-full flex flex-col items-center justify-center gap-1 text-muted-foreground/70">
      <Icon className="w-7 h-7" />
      <span className="text-[10px] font-medium">No photo</span>
    </div>
  );
}
