import React from 'react';
import { Star } from 'lucide-react';

interface InteractiveStarRatingProps {
  value: number;
  onChange?: (val: number) => void;
  readOnly?: boolean;
  size?: 'sm' | 'md' | 'lg';
  showNumber?: boolean;
  count?: number;
}

export default function InteractiveStarRating({
  value,
  onChange,
  readOnly = false,
  size = 'md',
  showNumber = false,
  count,
}: InteractiveStarRatingProps) {
  const [hoverVal, setHoverVal] = React.useState<number | null>(null);

  const starSizes = {
    sm: 'w-3.5 h-3.5',
    md: 'w-4 h-4',
    lg: 'w-5 h-5',
  };

  const activeVal = hoverVal !== null ? hoverVal : value;

  return (
    <div className="inline-flex items-center gap-1.5 select-none">
      <div className="flex items-center gap-0.5">
        {[1, 2, 3, 4, 5].map((star) => {
          const isFilled = star <= activeVal;
          return (
            <button
              key={star}
              type="button"
              disabled={readOnly}
              onClick={() => onChange && onChange(star)}
              onMouseEnter={() => !readOnly && setHoverVal(star)}
              onMouseLeave={() => !readOnly && setHoverVal(null)}
              className={`${readOnly ? 'cursor-default' : 'cursor-pointer hover:scale-115 transition-transform'} p-0.5 focus:outline-none`}
              title={readOnly ? `${value} stars` : `Rate ${star} star${star > 1 ? 's' : ''}`}
            >
              <Star
                className={`${starSizes[size]} transition-colors ${
                  isFilled
                    ? 'text-[#FF7A2E] fill-[#FF5A00] drop-shadow-[0_0_4px_rgba(251,191,36,0.5)]'
                    : 'text-neutral-300 fill-transparent'
                }`}
              />
            </button>
          );
        })}
      </div>

      {showNumber && (
        <span className="text-xs font-bold text-slate-200 ml-1">
          {value > 0 ? value.toFixed(1) : 'No ratings'}
        </span>
      )}

      {count !== undefined && (
        <span className="text-[11px] text-neutral-400">
          ({count} {count === 1 ? 'review' : 'reviews'})
        </span>
      )}
    </div>
  );
}
