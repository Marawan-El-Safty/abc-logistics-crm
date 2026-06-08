import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { MagnifyingGlassIcon, BuildingOfficeIcon, FunnelIcon, DocumentTextIcon, XMarkIcon } from '@heroicons/react/24/outline';
import api from '../../services/api';

function useDebounce(value, delay) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

export default function GlobalSearch() {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const [results, setResults] = useState({ clients: [], leads: [], quotations: [] });
  const [loading, setLoading] = useState(false);
  const inputRef = useRef(null);
  const navigate = useNavigate();
  const debouncedQ = useDebounce(q, 250);

  useEffect(() => {
    const handler = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setOpen(o => !o);
      }
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, []);

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 50);
    else { setQ(''); setResults({ clients: [], leads: [], quotations: [] }); }
  }, [open]);

  useEffect(() => {
    if (debouncedQ.length < 2) { setResults({ clients: [], leads: [], quotations: [] }); return; }
    setLoading(true);
    api.get('/search', { params: { q: debouncedQ } })
      .then(r => setResults(r.data.data || { clients: [], leads: [], quotations: [] }))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [debouncedQ]);

  const go = (path) => { navigate(path); setOpen(false); };

  const total = results.clients.length + results.leads.length + results.quotations.length;

  // Listen for open-search event triggered from the Header button
  useEffect(() => {
    const handler = () => setOpen(true);
    window.addEventListener('open-search', handler);
    return () => window.removeEventListener('open-search', handler);
  }, []);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-start justify-center pt-20 px-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setOpen(false)} />
      <div className="relative w-full max-w-xl bg-white dark:bg-navy-900 border border-slate-200 dark:border-navy-700 rounded-2xl shadow-2xl overflow-hidden">
        {/* Input */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-slate-100 dark:border-navy-800">
          <MagnifyingGlassIcon className="w-5 h-5 text-slate-400 dark:text-gray-500 flex-shrink-0" />
          <input
            ref={inputRef}
            value={q}
            onChange={e => setQ(e.target.value)}
            placeholder="Search clients, leads, quotations..."
            aria-label="Search clients, leads and quotations"
            className="flex-1 bg-transparent text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-gray-500 text-sm outline-none"
          />
          {loading && <div className="w-4 h-4 border-2 border-gold-500 border-t-transparent rounded-full animate-spin flex-shrink-0" />}
          <button onClick={() => setOpen(false)} aria-label="Close search" className="text-slate-400 hover:text-slate-600 dark:text-gray-500 dark:hover:text-gray-300">
            <XMarkIcon className="w-4 h-4" />
          </button>
        </div>

        {/* Results */}
        <div className="max-h-[60vh] overflow-y-auto">
          {q.length < 2 ? (
            <div className="py-8 text-center text-slate-400 dark:text-gray-500 text-sm">Type at least 2 characters to search</div>
          ) : total === 0 && !loading ? (
            <div className="py-8 text-center text-slate-400 dark:text-gray-500 text-sm">No results for "{q}"</div>
          ) : (
            <>
              {results.clients.length > 0 && (
                <div>
                  <div className="px-4 py-2 text-xs font-semibold text-slate-400 dark:text-gray-500 uppercase tracking-wider bg-slate-50 dark:bg-navy-950">
                    Clients
                  </div>
                  {results.clients.map(c => (
                    <button key={c.id} onClick={() => go(`/clients/${c.id}`)}
                      className="w-full flex items-center gap-3 px-4 py-3 hover:bg-slate-50 dark:hover:bg-navy-800 transition-colors text-left">
                      <BuildingOfficeIcon className="w-4 h-4 text-blue-500 flex-shrink-0" />
                      <div>
                        <div className="text-sm font-medium text-slate-900 dark:text-white">{c.name}</div>
                        <div className="text-xs text-slate-500 dark:text-gray-400">{c.industry}{c.country ? ` · ${c.country}` : ''}</div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
              {results.leads.length > 0 && (
                <div>
                  <div className="px-4 py-2 text-xs font-semibold text-slate-400 dark:text-gray-500 uppercase tracking-wider bg-slate-50 dark:bg-navy-950">
                    Leads
                  </div>
                  {results.leads.map(l => (
                    <button key={l.id} onClick={() => go(`/leads/${l.id}`)}
                      className="w-full flex items-center gap-3 px-4 py-3 hover:bg-slate-50 dark:hover:bg-navy-800 transition-colors text-left">
                      <FunnelIcon className="w-4 h-4 text-gold-500 flex-shrink-0" />
                      <div>
                        <div className="text-sm font-medium text-slate-900 dark:text-white">{l.name}</div>
                        <div className="text-xs text-slate-500 dark:text-gray-400">{l.stage}{l.shipment_type ? ` · ${l.shipment_type}` : ''}</div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
              {results.quotations.length > 0 && (
                <div>
                  <div className="px-4 py-2 text-xs font-semibold text-slate-400 dark:text-gray-500 uppercase tracking-wider bg-slate-50 dark:bg-navy-950">
                    Quotations
                  </div>
                  {results.quotations.map(q => (
                    <button key={q.id} onClick={() => go(`/quotations/${q.id}/edit`)}
                      className="w-full flex items-center gap-3 px-4 py-3 hover:bg-slate-50 dark:hover:bg-navy-800 transition-colors text-left">
                      <DocumentTextIcon className="w-4 h-4 text-purple-500 flex-shrink-0" />
                      <div>
                        <div className="text-sm font-medium text-slate-900 dark:text-white">{q.name}</div>
                        <div className="text-xs text-slate-500 dark:text-gray-400">{q.client_name}{q.service_type ? ` · ${q.service_type}` : ''}</div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </>
          )}
        </div>

        <div className="px-4 py-2 border-t border-slate-100 dark:border-navy-800 flex gap-4 text-xs text-slate-400 dark:text-gray-600">
          <span><kbd className="px-1 bg-slate-100 dark:bg-navy-800 rounded">↵</kbd> to select</span>
          <span><kbd className="px-1 bg-slate-100 dark:bg-navy-800 rounded">Esc</kbd> to close</span>
        </div>
      </div>
    </div>
  );
}
