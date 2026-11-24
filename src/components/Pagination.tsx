import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

export const DEFAULT_PAGE_SIZE = 10;
const PAGE_SIZE_OPTIONS = [10, 20, 30] as const;

export function paginate<T>(
  items: T[],
  currentPage: number,
  pageSize: number
): {
  items: T[];
  safePage: number;
  totalPages: number;
} {
  const totalPages = Math.max(1, Math.ceil(items.length / pageSize));
  const safePage = Math.min(Math.max(1, currentPage), totalPages);
  const start = (safePage - 1) * pageSize;
  return {
    items: items.slice(start, start + pageSize),
    safePage,
    totalPages,
  };
}

interface PaginationProps {
  currentPage: number;
  totalItems: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  onPageSizeChange?: (pageSize: number) => void;
  pageSizeOptions?: readonly number[];
  compact?: boolean;
}

export const Pagination: React.FC<PaginationProps> = ({
  currentPage,
  totalItems,
  pageSize,
  onPageChange,
  onPageSizeChange,
  pageSizeOptions = PAGE_SIZE_OPTIONS,
  compact = false,
}) => {
  if (totalItems === 0) return null;

  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const safePage = Math.min(Math.max(1, currentPage), totalPages);
  const startIdx = (safePage - 1) * pageSize + 1;
  const endIdx = Math.min(totalItems, safePage * pageSize);

  const getPageNumbers = (): (number | 'ellipsis')[] => {
    if (totalPages <= 5) {
      return Array.from({ length: totalPages }, (_, i) => i + 1);
    }

    const pages: (number | 'ellipsis')[] = [1];
    if (safePage > 3) {
      pages.push('ellipsis');
    }

    const start = Math.max(2, safePage - 1);
    const end = Math.min(totalPages - 1, safePage + 1);
    for (let i = start; i <= end; i++) {
      pages.push(i);
    }

    if (safePage < totalPages - 2) {
      pages.push('ellipsis');
    }
    pages.push(totalPages);
    return pages;
  };

  return (
    <div className="flex flex-wrap items-center justify-between gap-2 pt-3 mt-3 border-t border-slate-200/70 text-xs text-slate-500">
      <div className="flex flex-wrap items-center gap-2.5">
        <span>
          {compact
            ? `${startIdx}–${endIdx} di ${totalItems}`
            : `Mostrando ${startIdx}–${endIdx} di ${totalItems} elementi`}
        </span>

        {onPageSizeChange && (
          <label className="inline-flex items-center gap-1.5 text-slate-500">
            {!compact && <span>Elementi per pagina:</span>}
            <select
              aria-label="Elementi per pagina"
              value={pageSize}
              onChange={(e) => {
                onPageSizeChange(Number(e.target.value));
                onPageChange(1);
              }}
              className="h-7 px-2 rounded-lg border border-slate-200 bg-white text-slate-700 font-medium text-xs focus:outline-none focus:border-blue-500 cursor-pointer"
            >
              {pageSizeOptions.map((option) => (
                <option key={option} value={option}>
                  {compact ? `${option}/pag.` : option}
                </option>
              ))}
            </select>
          </label>
        )}
      </div>

      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={() => onPageChange(safePage - 1)}
          disabled={safePage <= 1}
          aria-label="Pagina precedente"
          className="p-1.5 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition"
        >
          <ChevronLeft className="w-3.5 h-3.5" />
        </button>

        {getPageNumbers().map((entry, idx) =>
          entry === 'ellipsis' ? (
            <span key={`el-${idx}`} className="px-1.5 text-slate-400 select-none">
              …
            </span>
          ) : (
            <button
              type="button"
              key={entry}
              onClick={() => onPageChange(entry)}
              className={`min-w-[28px] h-7 px-2 rounded-lg border text-xs transition ${
                entry === safePage
                  ? 'bg-blue-600 text-white border-blue-600 font-semibold shadow-sm'
                  : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50 font-medium'
              }`}
            >
              {entry}
            </button>
          )
        )}

        <button
          type="button"
          onClick={() => onPageChange(safePage + 1)}
          disabled={safePage >= totalPages}
          aria-label="Pagina successiva"
          className="p-1.5 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition"
        >
          <ChevronRight className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
};
