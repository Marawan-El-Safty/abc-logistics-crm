import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import api from '../services/api';
import {
  RocketLaunchIcon, DocumentArrowDownIcon, MagnifyingGlassIcon,
  TruckIcon, MapPinIcon, CalendarDaysIcon, ClockIcon, CheckBadgeIcon,
  ArrowsRightLeftIcon, FunnelIcon, ChevronUpDownIcon,
} from '@heroicons/react/24/outline';
import { useAutoRefresh } from '../hooks/useAutoRefresh';
import Modal from '../components/common/Modal';
import { CardSkeleton } from '../components/common/Skeleton';

const fmtDate = (d) => d ? new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';
const fmtGroupLabel = (dateStr) => {
  const d = new Date(dateStr);
  const today = new Date(); today.setHours(0,0,0,0);
  const diff = Math.floor((today - new Date(d.toDateString())) / 86400000);
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Yesterday';
  if (diff < 7)  return `${diff} days ago`;
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
};

const DIRECTIONS = ['All', 'Import', 'Export', 'Domestic'];
const SORTS = [
  { value: 'date_desc', label: 'Newest first' },
  { value: 'date_asc',  label: 'Oldest first' },
  { value: 'amount',    label: 'Highest value' },
  { value: 'client',    label: 'Client A–Z' },
];
const PRESETS = [
  { label: 'Today',      days: 0  },
  { label: 'This Week',  days: 7  },
  { label: 'This Month', days: 30 },
  { label: 'All Time',   days: -1 },
];

const toISO = (d) => d.toISOString().slice(0, 10);
const getFrom = (days) => days === -1 ? '' : toISO(new Date(Date.now() - days * 86400000));

export default function OperationsPage() {
  const navigate = useNavigate();
  const [bookings, setBookings]         = useState([]);
  const [loading, setLoading]           = useState(true);
  const [search, setSearch]             = useState('');
  const [direction, setDirection]       = useState('All');
  const [sort, setSort]                 = useState('date_desc');
  const [preset, setPreset]             = useState(30);
  const [from, setFrom]                 = useState(getFrom(30));
  const [to, setTo]                     = useState(toISO(new Date()));
  const [customDate, setCustomDate]     = useState(false);
  const [convertTarget, setConvertTarget]     = useState(null);
  const [convertDirection, setConvertDirection] = useState('');
  const [converting, setConverting]     = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = { status: 'Confirmed', limit: 500 };
      if (from) params.from = from;
      if (to)   params.to   = to;
      const res = await api.get('/quotations', { params });
      setBookings(res.data.data || []);
    } catch (_) {}
    finally { setLoading(false); }
  }, [from, to]);

  useEffect(() => { load(); }, [load]);
  useAutoRefresh(load);

  const applyPreset = (days) => {
    setPreset(days); setCustomDate(false);
    setFrom(getFrom(days));
    setTo(toISO(new Date()));
  };

  const downloadPdf = async (e, id, ref) => {
    e.stopPropagation();
    try {
      const res = await api.get(`/quotations/${id}/pdf`, { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const a = document.createElement('a'); a.href = url;
      a.setAttribute('download', `quotation-${ref}.pdf`);
      document.body.appendChild(a); a.click(); a.remove();
      window.URL.revokeObjectURL(url);
    } catch (_) { toast.error('Error generating PDF'); }
  };

  const openConvert = (e, b) => {
    e.stopPropagation();
    setConvertTarget(b);
    setConvertDirection(DIRECTIONS.slice(1).includes(b.direction) ? b.direction : '');
  };

  const confirmConvert = async () => {
    if (!convertTarget || !convertDirection) { toast.error('Choose a direction'); return; }
    setConverting(true);
    try {
      const res = await api.post('/shipments', {
        reference: convertTarget.reference_no, direction: convertDirection,
        shippingLine: convertTarget.carrier || '', clientId: convertTarget.client_id || undefined,
        clientName: convertTarget.client_name || '', pol: convertTarget.origin || '',
        pod: convertTarget.destination || '', status: 'Booked', quotationId: convertTarget.id,
        careOf: convertTarget.created_by_name || '',
      });
      if (res.data.existing && res.data.data?.id && res.data.data.direction !== convertDirection)
        await api.put(`/shipments/${res.data.data.id}`, { direction: convertDirection });
      toast.success(res.data.existing ? 'Shipment updated — opening' : 'Added to Shipments');
      setConvertTarget(null);
      navigate('/shipments');
    } catch (err) { toast.error(err.response?.data?.error || 'Failed to convert'); }
    finally { setConverting(false); }
  };

  // Filter + sort client-side
  const filtered = useMemo(() => {
    let list = bookings.filter(b => {
      if (direction !== 'All' && b.direction !== direction) return false;
      if (!search.trim()) return true;
      return [b.reference_no, b.client_name, b.carrier, b.origin, b.destination, b.service_type]
        .filter(Boolean).join(' ').toLowerCase().includes(search.toLowerCase());
    });
    if (sort === 'date_desc') list = [...list].sort((a,b) => new Date(b.updated_at) - new Date(a.updated_at));
    if (sort === 'date_asc')  list = [...list].sort((a,b) => new Date(a.updated_at) - new Date(b.updated_at));
    if (sort === 'amount')    list = [...list].sort((a,b) => parseFloat(b.total_amount||0) - parseFloat(a.total_amount||0));
    if (sort === 'client')    list = [...list].sort((a,b) => (a.client_name||'').localeCompare(b.client_name||''));
    return list;
  }, [bookings, direction, search, sort]);

  // Group by confirmation date
  const grouped = useMemo(() => {
    const groups = {};
    filtered.forEach(b => {
      const dateKey = new Date(b.updated_at).toDateString();
      if (!groups[dateKey]) groups[dateKey] = { label: fmtGroupLabel(b.updated_at), items: [] };
      groups[dateKey].items.push(b);
    });
    return Object.values(groups);
  }, [filtered]);

  const dirCounts = useMemo(() => {
    const counts = { All: bookings.length };
    ['Import','Export','Domestic'].forEach(d => {
      counts[d] = bookings.filter(b => b.direction === d).length;
    });
    return counts;
  }, [bookings]);

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="page-header">
        <div>
          <h2 className="page-title flex items-center gap-2">
            <RocketLaunchIcon className="w-6 h-6 text-gold-500" />
            Operations
          </h2>
          <p className="text-slate-500 dark:text-gray-400 text-sm">
            Client-confirmed bookings ready for vessel reservation · <strong>{filtered.length}</strong> shown
          </p>
        </div>
      </div>

      {/* Filters bar */}
      <div className="flex flex-wrap items-center gap-3 mb-4">
        {/* Search */}
        <div className="relative flex-shrink-0">
          <MagnifyingGlassIcon className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input className="input pl-9 w-56 text-sm" placeholder="Search carrier, client, route…"
            value={search} onChange={e => setSearch(e.target.value)} />
        </div>

        {/* Date presets */}
        <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-navy-900 rounded-xl">
          {PRESETS.map(p => (
            <button key={p.days} onClick={() => applyPreset(p.days)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                preset === p.days && !customDate
                  ? 'bg-white dark:bg-navy-800 text-slate-900 dark:text-white shadow-sm'
                  : 'text-slate-500 dark:text-gray-400 hover:text-slate-900 dark:hover:text-white'
              }`}>{p.label}</button>
          ))}
          <button onClick={() => setCustomDate(v => !v)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center gap-1 ${
              customDate ? 'bg-white dark:bg-navy-800 text-slate-900 dark:text-white shadow-sm'
                         : 'text-slate-500 dark:text-gray-400 hover:text-slate-900 dark:hover:text-white'}`}>
            <FunnelIcon className="w-3 h-3" />Custom
          </button>
        </div>

        {/* Custom date pickers */}
        {customDate && (
          <div className="flex items-center gap-2">
            <input type="date" className="input text-sm py-1.5 w-36" value={from}
              onChange={e => { setFrom(e.target.value); setPreset(null); }} />
            <span className="text-slate-400 text-sm">→</span>
            <input type="date" className="input text-sm py-1.5 w-36" value={to}
              onChange={e => { setTo(e.target.value); setPreset(null); }} />
          </div>
        )}

        {/* Sort */}
        <div className="relative flex-shrink-0 ml-auto">
          <ChevronUpDownIcon className="w-4 h-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          <select value={sort} onChange={e => setSort(e.target.value)}
            className="select pl-8 text-sm pr-8 w-auto">
            {SORTS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
        </div>
      </div>

      {/* Direction tabs */}
      <div className="flex gap-1 mb-4 p-1 bg-slate-100 dark:bg-navy-900 rounded-xl w-fit">
        {DIRECTIONS.map(d => (
          <button key={d} onClick={() => setDirection(d)}
            className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all flex items-center gap-1.5 ${
              direction === d
                ? 'bg-white dark:bg-navy-800 text-slate-900 dark:text-white shadow-sm'
                : 'text-slate-500 dark:text-gray-400 hover:text-slate-900 dark:hover:text-white'}`}>
            {d}
            <span className={`text-xs px-1.5 py-0.5 rounded-full font-semibold ${
              direction === d ? 'bg-gold-500/20 text-gold-600 dark:text-gold-400' : 'bg-slate-200 dark:bg-navy-700 text-slate-500 dark:text-gray-500'
            }`}>{dirCounts[d] ?? 0}</span>
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto min-h-0">
        {loading ? (
          <CardSkeleton count={4} />
        ) : filtered.length === 0 ? (
          <div className="empty-state">
            <CheckBadgeIcon className="w-12 h-12 text-slate-300 dark:text-navy-700 mb-3" />
            <p className="text-slate-900 dark:text-white font-medium">No confirmed bookings</p>
            <p className="text-slate-500 dark:text-gray-400 text-sm mt-1">
              Try a different date range or direction filter.
            </p>
          </div>
        ) : (
          <div className="space-y-6 pb-6">
            {grouped.map((group, gi) => (
              <div key={gi}>
                {/* Date group header */}
                <div className="flex items-center gap-3 mb-3">
                  <div className="flex items-center gap-2">
                    <CalendarDaysIcon className="w-4 h-4 text-gold-500" />
                    <span className="text-sm font-semibold text-slate-700 dark:text-gray-200">{group.label}</span>
                    <span className="text-xs text-slate-400 dark:text-gray-500 bg-slate-100 dark:bg-navy-800 px-2 py-0.5 rounded-full">
                      {group.items.length} booking{group.items.length !== 1 ? 's' : ''}
                    </span>
                  </div>
                  <div className="flex-1 h-px bg-slate-200 dark:bg-navy-800" />
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
                  {group.items.map(b => (
                    <div key={b.id}
                      className="card hover:border-gold-500/40 transition-all cursor-pointer flex flex-col"
                      onClick={() => navigate(`/quotations/${b.id}/edit`)}
                    >
                      {/* Top: ref + direction badge + PDF */}
                      <div className="flex items-start justify-between gap-2 mb-3">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 mb-0.5">
                            <p className="font-mono text-gold-500 text-sm font-semibold">{b.reference_no}</p>
                            {b.direction && (
                              <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold border ${
                                b.direction === 'Export'   ? 'bg-blue-50  dark:bg-blue-900/20  text-blue-600  dark:text-blue-400  border-blue-200  dark:border-blue-700/40' :
                                b.direction === 'Import'   ? 'bg-purple-50 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400 border-purple-200 dark:border-purple-700/40' :
                                'bg-slate-50 dark:bg-navy-800 text-slate-500 dark:text-gray-400 border-slate-200 dark:border-navy-700'
                              }`}>{b.direction}</span>
                            )}
                          </div>
                          <p className="text-slate-900 dark:text-white font-semibold truncate">{b.client_name || '—'}</p>
                        </div>
                        <button
                          className="p-1.5 rounded-lg text-slate-400 hover:text-gold-400 hover:bg-gold-500/10 transition-colors flex-shrink-0"
                          title="Download quotation PDF"
                          onClick={e => downloadPdf(e, b.id, b.reference_no)}
                        >
                          <DocumentArrowDownIcon className="w-4 h-4" />
                        </button>
                      </div>

                      {/* Carrier */}
                      <div className="flex items-center gap-2.5 p-2.5 rounded-xl bg-gold-500/10 border border-gold-500/20 mb-3">
                        <div className="w-8 h-8 rounded-lg bg-gold-500/20 flex items-center justify-center flex-shrink-0">
                          <TruckIcon className="w-4 h-4 text-gold-500" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-[10px] uppercase tracking-wide text-slate-500 dark:text-gray-400 font-medium">Carrier</p>
                          <p className={`font-bold text-sm truncate ${b.carrier ? 'text-slate-900 dark:text-white' : 'text-red-500'}`}>
                            {b.carrier || 'Not set ⚠'}
                          </p>
                        </div>
                      </div>

                      {/* Route + details */}
                      <div className="space-y-1.5 text-xs flex-1">
                        <div className="flex items-center gap-1.5 text-slate-600 dark:text-gray-300">
                          <MapPinIcon className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                          <span className="truncate font-medium">{b.origin || '—'} → {b.destination || '—'}</span>
                        </div>
                        <div className="flex items-center gap-3 text-slate-500 dark:text-gray-400">
                          {b.service_type && <span className="truncate">{b.service_type}</span>}
                          {b.transit_time && (
                            <span className="flex items-center gap-1 flex-shrink-0">
                              <ClockIcon className="w-3 h-3" />{b.transit_time}
                            </span>
                          )}
                        </div>
                        {b.created_by_name && (
                          <div className="flex items-center gap-1.5 text-slate-400 dark:text-gray-500">
                            <span className="text-[10px] uppercase tracking-wide">By</span>
                            <span className="font-medium text-gold-600 dark:text-gold-400">{b.created_by_name}</span>
                          </div>
                        )}
                      </div>

                      {/* Footer */}
                      <div className="flex items-center justify-between mt-3 pt-3 border-t border-slate-100 dark:border-navy-800">
                        <span className="text-xs text-green-600 dark:text-green-400 flex items-center gap-1">
                          <CalendarDaysIcon className="w-3 h-3" />
                          {fmtDate(b.updated_at)}
                        </span>
                        <span className="text-sm font-bold text-slate-900 dark:text-white">
                          {b.currency} {parseFloat(b.total_amount || 0).toLocaleString()}
                        </span>
                      </div>

                      {/* Convert button */}
                      <button
                        onClick={e => openConvert(e, b)}
                        className="w-full mt-3 py-2 rounded-lg text-xs font-semibold border border-gold-500/40 text-gold-600 dark:text-gold-400 hover:bg-gold-500/10 transition-colors flex items-center justify-center gap-1.5"
                      >
                        <ArrowsRightLeftIcon className="w-3.5 h-3.5" />
                        Convert to Shipment
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Convert modal */}
      <Modal isOpen={!!convertTarget} onClose={() => !converting && setConvertTarget(null)}
        title="Convert to Shipment" size="sm">
        {convertTarget && (
          <div className="space-y-4">
            <div>
              <p className="font-mono text-gold-500 text-sm">{convertTarget.reference_no}</p>
              <p className="text-slate-900 dark:text-white font-semibold">{convertTarget.client_name || '—'}</p>
              <p className="text-slate-500 dark:text-gray-400 text-sm">{convertTarget.origin} → {convertTarget.destination}</p>
            </div>
            <div>
              <label className="label">Direction <span className="text-red-500">*</span></label>
              <div className="grid grid-cols-3 gap-2">
                {DIRECTIONS.slice(1).map(d => (
                  <button key={d} type="button" onClick={() => setConvertDirection(d)}
                    className={`py-2 rounded-lg text-sm font-medium border transition-colors ${
                      convertDirection === d
                        ? 'bg-gold-500 text-navy-950 border-gold-500'
                        : 'bg-slate-100 dark:bg-navy-800 text-slate-600 dark:text-gray-300 border-transparent hover:border-gold-500/40'
                    }`}>{d}</button>
                ))}
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button className="btn-ghost" onClick={() => setConvertTarget(null)} disabled={converting}>Cancel</button>
              <button className="btn-primary" onClick={confirmConvert} disabled={converting || !convertDirection}>
                {converting ? 'Converting…' : 'Convert'}
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
