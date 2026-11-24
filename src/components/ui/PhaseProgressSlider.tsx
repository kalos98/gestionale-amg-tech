import React, { useEffect, useState } from 'react';

interface PhaseProgressSliderProps {
  value: number;
  accentClassName?: string;
  getAccentClassName?: (draftValue: number) => string;
  renderHeader?: (draftValue: number) => React.ReactNode;
  onCommit: (nextValue: number) => void;
  ariaLabel?: string;
}

/**
 * Slider avanzamento fase con anteprima fluida locale durante il trascinamento
 * e invio di un unico UPDATE atomico al database al rilascio.
 */
export const PhaseProgressSlider: React.FC<PhaseProgressSliderProps> = ({
  value,
  accentClassName = 'accent-slate-800',
  getAccentClassName,
  renderHeader,
  onCommit,
  ariaLabel = 'Avanzamento fase',
}) => {
  const [draft, setDraft] = useState(value);
  const [isDragging, setIsDragging] = useState(false);

  useEffect(() => {
    if (!isDragging) {
      setDraft(value);
    }
  }, [value, isDragging]);

  const commitDraft = () => {
    setIsDragging(false);
    if (draft !== value) {
      onCommit(draft);
    }
  };

  const resolvedAccent = getAccentClassName
    ? getAccentClassName(draft)
    : accentClassName;

  return (
    <div>
      {renderHeader?.(draft)}
      <input
        type="range"
        min={0}
        max={100}
        step={5}
        value={draft}
        aria-label={ariaLabel}
        onPointerDown={() => setIsDragging(true)}
        onTouchStart={() => setIsDragging(true)}
        onChange={(e) => setDraft(Number(e.target.value))}
        onPointerUp={commitDraft}
        onMouseUp={commitDraft}
        onTouchEnd={commitDraft}
        onKeyUp={commitDraft}
        onBlur={commitDraft}
        className={`w-full ${resolvedAccent} cursor-pointer`}
      />
    </div>
  );
};
