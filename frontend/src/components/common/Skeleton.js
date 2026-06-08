import React from 'react';

// Base shimmer block. Compose these for any loading placeholder.
export function Skeleton({ className = '' }) {
  return (
    <div
      className={`animate-pulse rounded-md bg-slate-200/70 dark:bg-navy-800 ${className}`}
      aria-hidden="true"
    />
  );
}

// Placeholder for a data table while rows load.
export function TableSkeleton({ rows = 6, cols = 5 }) {
  return (
    <div className="card overflow-hidden" role="status" aria-label="Loading">
      <div className="flex gap-4 pb-3 mb-3 border-b border-slate-100 dark:border-navy-800">
        {Array.from({ length: cols }).map((_, i) => (
          <Skeleton key={i} className="h-4 flex-1" />
        ))}
      </div>
      <div className="space-y-3">
        {Array.from({ length: rows }).map((_, r) => (
          <div key={r} className="flex gap-4 items-center">
            {Array.from({ length: cols }).map((_, c) => (
              <Skeleton key={c} className={`h-4 flex-1 ${c === 0 ? 'max-w-[30%]' : ''}`} />
            ))}
          </div>
        ))}
      </div>
      <span className="sr-only">Loading…</span>
    </div>
  );
}

// Placeholder grid for card-based pages.
export function CardSkeleton({ count = 6 }) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4" role="status" aria-label="Loading">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="card space-y-3">
          <div className="flex justify-between">
            <Skeleton className="h-4 w-1/3" />
            <Skeleton className="h-4 w-10" />
          </div>
          <Skeleton className="h-12 w-full" />
          <div className="flex gap-3">
            <Skeleton className="h-4 flex-1" />
            <Skeleton className="h-4 flex-1" />
          </div>
        </div>
      ))}
      <span className="sr-only">Loading…</span>
    </div>
  );
}

export default Skeleton;
