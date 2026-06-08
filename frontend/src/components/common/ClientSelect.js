import React, { useState, useRef, useEffect, useMemo } from 'react';
import { MagnifyingGlassIcon, ChevronDownIcon, XMarkIcon, CheckIcon } from '@heroicons/react/24/outline';

/**
 * Searchable client dropdown — drop-in replacement for a plain <select>.
 *
 * Props:
 *   clients   – array of { id, company_name }
 *   value     – selected client id (string or number)
 *   onChange  – (id: string) => void
 *   placeholder – string
 *   required  – bool  (renders a hidden <input required> so the form won't submit)
 */
export default function ClientSelect({
  clients = [],
  value,
  onChange,
  placeholder = 'Select client...',
  required = false,
}) {
  const [open, setOpen]     = useState(false);
  const [search, setSearch] = useState('');
  const containerRef        = useRef(null);
  const inputRef            = useRef(null);

  const selected = useMemo(
    () => clients.find(c => String(c.id) === String(value)),
    [clients, value]
  );

  // Fuzzy-style filter: every typed word must appear somewhere in the name
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return clients;
    const words = q.split(/\s+/);
    return clients.filter(c =>
      words.every(w => c.company_name.toLowerCase().includes(w))
    );
  }, [clients, search]);

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

  // Focus the search box when the dropdown opens
  useEffect(() => {
    if (open && inputRef.current) inputRef.current.focus();
  }, [open]);

  const handleSelect = (c) => {
    onChange(String(c.id));
    setOpen(false);
    setSearch('');
  };

  const handleClear = (e) => {
    e.stopPropagation();
    onChange('');
  };

  // Highlight matching substring
  const highlight = (name) => {
    if (!search.trim()) return name;
    const q = search.trim();
    const idx = name.toLowerCase().indexOf(q.toLowerCase());
    if (idx === -1) return name;
    return (
      <>
        {name.slice(0, idx)}
        <mark className="bg-gold-400/30 text-gold-700 dark:text-gold-300 rounded-sm px-px">
          {name.slice(idx, idx + q.length)}
        </mark>
        {name.slice(idx + q.length)}
      </>
    );
  };

  return (
    <div ref={containerRef} className="relative">
      {/* Hidden input keeps HTML5 required validation working */}
      {required && (
        <input
          tabIndex={-1}
          required
          value={value || ''}
          onChange={() => {}}
          style={{ position: 'absolute', opacity: 0, pointerEvents: 'none', height: 0, width: 0 }}
        />
      )}

      {/* Trigger button — styled like .select */}
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
          {selected ? selected.company_name : placeholder}
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
        <div className="absolute z-50 mt-1 w-full min-w-[240px] bg-white dark:bg-navy-900 border border-slate-200 dark:border-navy-700 rounded-xl shadow-2xl overflow-hidden">

          {/* Search bar */}
          <div className="p-2 border-b border-slate-100 dark:border-navy-800">
            <div className="flex items-center gap-2 bg-slate-50 dark:bg-navy-800 border border-slate-200 dark:border-navy-700 rounded-lg px-2.5 py-1.5">
              <MagnifyingGlassIcon className="w-4 h-4 text-slate-400 flex-shrink-0" />
              <input
                ref={inputRef}
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search clients..."
                className="flex-1 bg-transparent text-sm text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-gray-500 outline-none min-w-0"
              />
              {search && (
                <button type="button" onClick={() => setSearch('')} className="text-slate-400 hover:text-slate-600 dark:hover:text-gray-300 transition-colors">
                  <XMarkIcon className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* Results count */}
          {search && (
            <div className="px-3 py-1 text-xs text-slate-400 dark:text-gray-500 border-b border-slate-100 dark:border-navy-800">
              {filtered.length === 0 ? 'No matches' : `${filtered.length} result${filtered.length !== 1 ? 's' : ''}`}
            </div>
          )}

          {/* List */}
          <ul className="max-h-60 overflow-y-auto py-1">
            {/* Clear option */}
            <li>
              <button
                type="button"
                className="w-full text-left px-3 py-2 text-sm text-slate-400 dark:text-gray-500 hover:bg-slate-50 dark:hover:bg-navy-800 transition-colors"
                onClick={() => { onChange(''); setOpen(false); setSearch(''); }}
              >
                — No client —
              </button>
            </li>

            {filtered.length === 0 ? (
              <li className="px-3 py-4 text-sm text-center text-slate-400 dark:text-gray-500">
                No clients match "{search}"
              </li>
            ) : (
              filtered.map(c => {
                const isActive = String(c.id) === String(value);
                return (
                  <li key={c.id}>
                    <button
                      type="button"
                      onClick={() => handleSelect(c)}
                      className={`
                        w-full text-left px-3 py-2 text-sm flex items-center justify-between gap-2 transition-colors
                        ${isActive
                          ? 'bg-gold-500/10 text-gold-600 dark:text-gold-400 font-medium'
                          : 'text-slate-700 dark:text-gray-200 hover:bg-slate-50 dark:hover:bg-navy-800'}
                      `}
                    >
                      <span>{highlight(c.company_name)}</span>
                      {isActive && <CheckIcon className="w-3.5 h-3.5 flex-shrink-0" />}
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
