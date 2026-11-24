import React, { useState } from 'react';
import { Trash2 } from 'lucide-react';

interface InlineConfirmDeleteProps {
  onConfirm: () => void;
  title?: string;
  confirmLabel?: string;
  buttonLabel?: string;
  buttonClassName?: string;
  iconClassName?: string;
}

export const InlineConfirmDelete: React.FC<InlineConfirmDeleteProps> = ({
  onConfirm,
  title = 'Elimina elemento',
  confirmLabel = 'Confermi?',
  buttonLabel,
  buttonClassName,
  iconClassName = 'w-4 h-4',
}) => {
  const [isConfirming, setIsConfirming] = useState(false);

  if (isConfirming) {
    return (
      <div
        onClick={(e) => e.stopPropagation()}
        className="inline-flex items-center gap-1 bg-red-50 border border-red-200 px-2 py-0.5 rounded-lg"
      >
        <span className="text-[11px] font-semibold text-red-800 whitespace-nowrap">
          {confirmLabel}
        </span>
        <button
          type="button"
          onClick={() => {
            onConfirm();
            setIsConfirming(false);
          }}
          className="px-2 py-0.5 rounded bg-red-600 hover:bg-red-700 text-white text-[11px] font-semibold transition"
        >
          Sì
        </button>
        <button
          type="button"
          onClick={() => setIsConfirming(false)}
          className="px-1.5 py-0.5 rounded bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 text-[11px] font-medium transition"
        >
          No
        </button>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        setIsConfirming(true);
      }}
      title={title}
      aria-label={title}
      className={
        buttonClassName ||
        (buttonLabel
          ? 'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-red-600 hover:bg-red-50 border border-transparent hover:border-red-200 transition'
          : 'p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition')
      }
    >
      <Trash2 className={iconClassName} />
      {buttonLabel && <span>{buttonLabel}</span>}
    </button>
  );
};
