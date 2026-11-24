import React from 'react';
import { X } from 'lucide-react';

interface PhotoPreviewGridProps {
  urls: string[];
  onRemoveAt: (index: number) => void;
  onClearAll: () => void;
  allowRemoveSingle?: boolean;
  showHeaderOnSingle?: boolean;
  countLabel?: (count: number) => string;
  maxGridHeightClass?: string;
}

/**
 * Shared single/multi photo upload preview grid with individual and batch removal.
 */
export const PhotoPreviewGrid: React.FC<PhotoPreviewGridProps> = ({
  urls,
  onRemoveAt,
  onClearAll,
  allowRemoveSingle = true,
  showHeaderOnSingle = false,
  countLabel = (count) =>
    count === 1 ? '1 foto selezionata' : `${count} foto selezionate`,
  maxGridHeightClass = '',
}) => {
  if (urls.length === 0) return null;

  const showHeader = urls.length > 1 || showHeaderOnSingle;

  return (
    <div className="space-y-2">
      {showHeader && (
        <div className="flex items-center justify-between text-xs">
          <span className="font-semibold text-slate-700">
            {countLabel(urls.length)}
          </span>
          <button
            type="button"
            onClick={onClearAll}
            className="text-red-600 hover:text-red-700 font-medium"
          >
            Rimuovi tutte
          </button>
        </div>
      )}

      {urls.length === 1 ? (
        <div className="relative rounded-xl overflow-hidden border border-slate-200 bg-slate-900">
          <img
            src={urls[0]}
            alt="Anteprima scatto"
            className="w-full h-44 object-cover"
          />
          {allowRemoveSingle && (
            <button
              type="button"
              onClick={() => onRemoveAt(0)}
              title="Rimuovi foto"
              aria-label="Rimuovi foto"
              className="absolute top-2 right-2 p-1 rounded-full bg-slate-900/80 hover:bg-slate-900 text-white transition"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      ) : (
        <div
          className={`grid grid-cols-3 gap-2 ${
            maxGridHeightClass ? `${maxGridHeightClass} overflow-y-auto pr-1` : ''
          }`}
        >
          {urls.map((url, idx) => (
            <div
              key={`${idx}-${url.slice(-24)}`}
              className="relative rounded-lg overflow-hidden border border-slate-200 bg-slate-900 h-24"
            >
              <img
                src={url}
                alt={`Anteprima scatto ${idx + 1}`}
                className="w-full h-full object-cover"
              />
              <button
                type="button"
                onClick={() => onRemoveAt(idx)}
                title="Rimuovi foto"
                aria-label={`Rimuovi foto ${idx + 1}`}
                className="absolute top-1 right-1 p-1 rounded-full bg-slate-900/80 hover:bg-slate-900 text-white transition"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
