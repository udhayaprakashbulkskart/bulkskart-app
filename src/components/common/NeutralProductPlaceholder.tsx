import React from 'react';
import {
  Package,
  Sparkles,
  Gem,
  Shirt,
  Sun,
  Cog,
  Cpu,
  Box,
  Wheat,
  HardHat,
  FlaskConical,
} from 'lucide-react';
import { getProductTypeCategory } from '@/lib/pixabay';

interface NeutralProductPlaceholderProps {
  title?: string;
  category?: string | null;
  className?: string;
  subtext?: string;
}

export default function NeutralProductPlaceholder({
  title,
  category,
  className = '',
  subtext = 'Photo coming soon',
}: NeutralProductPlaceholderProps) {
  const { type, iconName, label } = getProductTypeCategory(title, category || undefined);

  const renderIcon = () => {
    const iconClass = 'w-7 h-7 sm:w-8 sm:h-8 text-neutral-400/80 stroke-[1.5]';
    switch (iconName) {
      case 'Sparkles':
        return <Sparkles className={iconClass} />;
      case 'Gem':
        return <Gem className={iconClass} />;
      case 'Shirt':
        return <Shirt className={iconClass} />;
      case 'Sun':
        return <Sun className={iconClass} />;
      case 'Cog':
        return <Cog className={iconClass} />;
      case 'Cpu':
        return <Cpu className={iconClass} />;
      case 'Box':
        return <Box className={iconClass} />;
      case 'Wheat':
        return <Wheat className={iconClass} />;
      case 'HardHat':
        return <HardHat className={iconClass} />;
      case 'FlaskConical':
        return <FlaskConical className={iconClass} />;
      case 'Package':
      default:
        return <Package className={iconClass} />;
    }
  };

  return (
    <div
      className={`w-full h-full flex flex-col items-center justify-center p-3 select-none bg-gradient-to-b from-[#0f1422] to-[#090d16] border border-[#2A2A2A]/80 text-slate-300 relative overflow-hidden ${className}`}
      role="img"
      aria-label={`${title || label} - ${subtext}`}
    >
      {/* Subtle industrial grid lines background */}
      <div
        className="absolute inset-0 opacity-[0.04] pointer-events-none"
        style={{
          backgroundImage:
            'radial-gradient(circle at 1px 1px, rgba(255,255,255,0.7) 1px, transparent 0)',
          backgroundSize: '16px 16px',
        }}
      />

      {/* Product-type specific icon inside subtle rounded enclosure */}
      <div className="w-12 h-12 rounded-xl bg-[#0A0A0A]/60 border border-[#2A2A2A]/60 flex items-center justify-center mb-2 shadow-inner group-hover:border-[#FF5A00]/40 transition-colors">
        {renderIcon()}
      </div>

      {/* Label and "Photo coming soon" indicator */}
      <span className="text-[11px] font-semibold text-slate-200 text-center tracking-wide line-clamp-1 max-w-[90%]">
        {subtext}
      </span>
      <span className="text-[9.5px] text-neutral-400/90 font-medium text-center line-clamp-1 max-w-[90%] mt-0.5">
        {label}
      </span>
    </div>
  );
}
