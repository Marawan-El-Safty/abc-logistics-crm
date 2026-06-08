import React, { useState, useRef, useEffect, useMemo } from 'react';
import { MagnifyingGlassIcon, ChevronDownIcon, XMarkIcon, CheckIcon } from '@heroicons/react/24/outline';

/**
 * Generic searchable dropdown — works for any list of objects.
 *
 * Props:
 *   items        – array of objects (each must have an `id` field)
 *   value        – currently selected id (string or number)
 *   onChange     – (id: string) => void   — called with '' when cleared
 *   getLabel     – (item) => string       — text shown on trigger when selected
 *   getSearch    – (item) => string       — concatenated text used for search filtering
 *   renderOption – optional (item, isActive, search) => ReactNode  — custom row rendering
 *   placeholder  – string shown when nothing is selected
 *   noneLabel    – text for the "clear / none" option (default "— None —")
 *   required     – bool
 */
export default function SearchSelect({
  items = [],
  value,
  onChange,
  getLabel    = (item) => String(item.id),
  getSearch   = (item) => String(item.id),
  renderOption,
  placeholder = 'Select...',
  noneLabel   = '— None —',
  required    = false,
}) {
  const [open, setOpen]     = useState(false);
  const [search, setSearch] = useState('');
  const containerRef        = useRef(null);
  const inputRef            = useRef(null);

  const selected = useMemo(
    () => items.find(i => String(i.id) === String(value)),
    [items, value]
  );

  // Word-split fuzzy filter
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return items;
    const words = q.split(/\s+/);
    return items.filter(item =>
      words.every(w => getSearch(item).toLowerCase().includes(w))
    );
  }, [items, search, getSearch]);

  // Close on outside click
  useEffect(() => {
    const handler = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setOpen(false);
        setSearch('');
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Auto-focus search input when opened
  useEffect(() => {
    if (open && inputRef.current) inputRef.current.focus();
  }, [open]);

  const handleSelect = (item) => {
    onChange(String(item.id));
    setOpen(false);
    setSearch('');
  };

  const handleClear = (e) => {
    e.stopPropagation();
    onChange('');
  };

  return (
    <div ref={containerRef} className="relative">
      {/* Hidden input for HTML5 required validation */}
      {required && (
        <input
          tabIndex={-1}
          required
          value={value || ''}
          onChange={() => {}}
          style={{ position: 'absolute', opacity: 0, pointerEvents: 'none', height: 0, width: 0 }}
        />
      )}

      {/* Trigger button */}
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className={`
          flex items-center justify-between gap-2 w-full
          bg-white border text-sm rounded-lg px-3 py-2 transition-colors duration-200
          dark:bg-navy-800 dark:text-white
          ${open
            ? 'border-gold-500 ring-1 ring-gold-500'
            : 'border-slate-300 dark:border-navy-600'}
        `}
      >
        <span className={selected
          ? 'text-slate-900 dark:text-white truncate'
          : 'text-slate-400 dark:text-gray-500'}>
          {selected ? getLabel(selected) : placeholder}
        </span>
        <span className="flex items-center gap-1 flex-shrink-0">
          {selected && (
            <span
              role="button"
              onClick={handleClear}
              className="text-slate-400 hover:text-red-400 transition-colors p-0.5 rounded"
              title="Clear"
            >
              <XMarkIcon className="w-3.5 h-3.5" />
            </span>
          )}
          <ChevronDownIcon className={`w-4 h-4 text-slate-400 transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
        </span>
      </button>

      {/* Dropdown panel */}
      {open && (
        <div className="absolute z-50 mt-1 w-full min-w-[280px] bg-white dark:bg-navy-900 border border-slate-200 dark:border-navy-700 rounded-xl shadow-2xl overflow-hidden">

          {/* Search bar */}
          <div className="p-2 border-b border-slate-100 dark:border-navy-800">
            <div className="flex items-center gap-2 bg-slate-50 dark:bg-navy-800 border border-slate-200 dark:border-navy-700 rounded-lg px-2.5 py-1.5">
              <MagnifyingGlassIcon className="w-4 h-4 text-slate-400 flex-shrink-0" />
              <input
                ref={inputRef}
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search..."
                className="flex-1 bg-transparent text-sm text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-gray-500 outline-none min-w-0"
              />
              {search && (
                <button type="button" onClick={() => setSearch('')}
                  className="text-slate-400 hover:text-slate-600 dark:hover:text-gray-300 transition-colors">
                  <XMarkIcon className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* Result count */}
          {search && (
            <div className="px-3 py-1 text-xs text-slate-400 dark:text-gray-500 border-b border-slate-100 dark:border-navy-800">
              {filtered.length === 0
                ? 'No matches'
                : `${filtered.length} result${filtered.length !== 1 ? 's' : ''}`}
            </div>
          )}

          {/* List */}
          <ul className="max-h-72 overflow-y-auto py-1">
            {/* None / clear option */}
            <li>
              <button
                type="button"
                className="w-full text-left px-3 py-2 text-sm text-slate-400 dark:text-gray-500 hover:bg-slate-50 dark:hover:bg-navy-800 transition-colors"
                onClick={() => { onChange(''); setOpen(false); setSearch(''); }}
              >
                {noneLabel}
              </button>
            </li>

            {filtered.length === 0 ? (
              <li className="px-3 py-4 text-sm text-center text-slate-400 dark:text-gray-500">
                No results for "{search}"
              </li>
            ) : (
              filtered.map(item => {
                const isActive = String(item.id) === String(value);
                return (
                  <li key={item.id}>
                    <button
                      type="button"
                      onClick={() => handleSelect(item)}
                      className={`
                        w-full text-left px-3 py-2 text-sm flex items-center justify-between gap-2 transition-colors
                        ${isActive
                          ? 'bg-gold-500/10 text-gold-600 dark:text-gold-400 font-medium'
                          : 'text-slate-700 dark:text-gray-200 hover:bg-slate-50 dark:hover:bg-navy-800'}
                      `}
                    >
                      <span className="min-w-0 flex-1 truncate">
                        {renderOption
                          ? renderOption(item, isActive, search)
                          : getLabel(item)}
                      </span>
                      {isActive && <CheckIcon className="w-3.5 h-3.5 flex-shrink-0 text-gold-500" />}
                    </button>
                  </li>
                );
              })
            )}
          </ul>
        </div>
      )}
    </div>
  );
}
