import React, { useState, useEffect, useRef, useCallback } from 'react';
import toast from 'react-hot-toast';
import api from '../services/api';
import { useAutoRefresh } from '../hooks/useAutoRefresh';
import { useAuth } from '../store/AuthContext';
import { useTheme } from '../store/ThemeContext';
import { TableSkeleton } from '../components/common/Skeleton';
import Modal from '../components/common/Modal';
import ShipmentAttachmentsDrawer from '../components/common/ShipmentAttachmentsDrawer';
import {
  PlusIcon, TrashIcon, MagnifyingGlassIcon, ArrowsRightLeftIcon, ArrowDownTrayIcon,
  ArrowUpTrayIcon, DocumentTextIcon, PaperClipIcon, ArchiveBoxIcon, ArchiveBoxArrowDownIcon, XMarkIcon,
} from '@heroicons/react/24/outline';

// Map common sheet header names → CRM camelCase field (normalize: lowercase, strip non-alphanumerics)
const HEADER_ALIASES = {
  note: 'note', notes: 'note',
  careof: 'careOf', care: 'careOf',
  reference: 'externalRef', refernce: 'externalRef', ref: 'externalRef', oldref: 'externalRef', externalref: 'externalRef',
  crmref: 'reference', internalref: 'reference',
  sl: 'shippingLine', shippingline: 'shippingLine', line: 'shippingLine', carrier: 'shippingLine',
  client: 'clientName', customer: 'clientName', clientname: 'clientName',
  pol: 'pol', portofloading: 'pol',
  pod: 'pod', portofdischarge: 'pod',
  bookingno: 'bookingNo', booking: 'bookingNo', bkg: 'bookingNo', bookingnumber: 'bookingNo',
  contr: 'containerQty', qty: 'containerQty', quantity: 'containerQty', containers: 'containerQty',
  type: 'containerType', containertype: 'containerType', cntr: 'containerType', cot: 'containerType',
  status: 'status',
  loading: 'loadingNote', loadingnote: 'loadingNote',
  loadingdate: 'loadingDate', loading_date: 'loadingDate',
  etd: 'etd', eta: 'eta',
  ucr: 'externalRef', ucrno: 'externalRef',
  masteracid: 'masterAcid', mastacid: 'masterAcid',
};

// Parse CSV text into array of row objects keyed by header (handles quoted cells)
function parseCsv(text) {
  const rows = [];
  let cur = [], field = '', inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (c === '"') inQuotes = false;
      else field += c;
    } else {
      if (c === '"') inQuotes = true;
      else if (c === ',') { cur.push(field); field = ''; }
      else if (c === '\n') { cur.push(field); rows.push(cur); cur = []; field = ''; }
      else if (c === '\r') { /* skip */ }
      else field += c;
    }
  }
  if (field !== '' || cur.length) { cur.push(field); rows.push(cur); }
  return rows.filter(r => r.some(c => c.trim() !== ''));
}

const DIRECTIONS = ['Export', 'Import', 'Domestic'];
const STATUSES = ['Booked', 'In Progress', 'Loaded', 'Sailed', 'Arrived', 'Delivered', 'On Hold', 'Cancelled'];
const CONTAINER_TYPES = [
  "20' DC", "40' DC", "40' HC", "45' HC",
  "20' RF (Reefer)", "40' RF (Reefer)",
  "20' OT (Open Top)", "40' OT (Open Top)",
  "20' FR (Flat Rack)", "40' FR (Flat Rack)",
  'LCL',
  'Air – General Cargo', 'Air – Temperature Controlled', 'Air – Dangerous Goods (DG)', 'Air – Express',
];

const STATUS_COLOR = {
  Booked:       'bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30',
  'In Progress':'bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 border-indigo-500/30',
  Loaded:       'bg-green-500/15 text-green-600 dark:text-green-400 border-green-500/30',
  Sailed:       'bg-blue-500/15 text-blue-600 dark:text-blue-400 border-blue-500/30',
  Arrived:      'bg-purple-500/15 text-purple-600 dark:text-purple-400 border-purple-500/30',
  Delivered:    'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30',
  'On Hold':    'bg-red-500/15 text-red-600 dark:text-red-400 border-red-500/30',
  Cancelled:    'bg-gray-500/15 text-gray-500 dark:text-gray-400 border-gray-500/30',
};

// table column key (snake) → API field (camel)
const API_FIELD = {
  reference: 'reference', external_ref: 'externalRef', care_of: 'careOf', shipping_line: 'shippingLine',
  client_name: 'clientName', pol: 'pol', pod: 'pod', booking_no: 'bookingNo',
  container_qty: 'containerQty', container_type: 'containerType', status: 'status',
  loading_note: 'loadingNote', note: 'note', etd: 'etd', eta: 'eta',
  acid: 'acid', master_acid: 'masterAcid', bl_number: 'blNumber',
};

// Columns before the direction-specific ones
const COLS_BEFORE = [
  ['_row',          '#',               36],
  ['reference',     'Reference',      140],
  ['external_ref',  'Old Ref',        140],
  ['care_of',       'Assign To',        110],
  ['shipping_line', 'S/L',            110],
  ['client',        'Client',         140],
  ['pol',           'POL',            110],
  ['pod',           'POD',            110],
  ['booking_no',    'Booking No',     140],
  ['container_qty', 'Qty',             60],
  ['container_type','Type',            90],
];

// Columns after the direction-specific ones
const COLS_AFTER = [
  ['status',        'Status',         120],
  ['loading_date',  'Loading Date',   130],
  ['loading_note',  'Notes',          160],
  ['etd',           'ETD',            120],
  ['eta',           'ETA',            120],
];

// Direction-specific columns inserted before Status
const EXTRA_COLUMNS = {
  Export:   [['acid', 'ACID', 130], ['bl_number', 'B/L', 130]],
  Import:   [['acid', 'ACID', 130], ['master_acid', 'Master ACID', 140], ['bl_number', 'B/L', 130]],
  Domestic: [],
};

const getColumns = (dir) => [
  ...COLS_BEFORE,
  ...(EXTRA_COLUMNS[dir] || []),
  ...COLS_AFTER,
  ['_del', '', 130],
];

// Keep a single COLUMNS const for components that still reference it directly
const COLUMNS = getColumns('Export');

// Resizable column hook — returns [widths, ResizeHandle component]
function useResizableColumns(cols) {
  const [widths, setWidths] = useState(() =>
    Object.fromEntries(cols.map(([k, , w]) => [k, w]))
  );
  // When direction changes, cols may include new keys not yet in widths — seed them.
  const colDefaults = Object.fromEntries(cols.map(([k, , w]) => [k, w]));
  const merged = { ...colDefaults, ...widths };
  const dragging = useRef(null);

  const onMouseDown = (e, key) => {
    e.preventDefault();
    const startX = e.clientX;
    const startW = merged[key];
    dragging.current = { key, startX, startW };

    const onMove = (me) => {
      if (!dragging.current) return;
      const { key, startX, startW } = dragging.current;
      const newW = Math.max(40, startW + me.clientX - startX);
      setWidths(prev => ({ ...prev, [key]: newW }));
    };
    const onUp = () => {
      dragging.current = null;
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  };

  const Handle = ({ colKey }) => (
    <span
      onMouseDown={e => onMouseDown(e, colKey)}
      style={{
        position: 'absolute', right: 0, top: 0, bottom: 0,
        width: '5px', cursor: 'col-resize', zIndex: 10,
        userSelect: 'none',
      }}
      title="Drag to resize column"
    />
  );

  return [merged, Handle];
}

const BL_EMPTY = {
  blNo: '', bookingNo: '', shipper: '', consignee: '', notifyParty: '', alsoNotify: '',
  preCarriage: '', placeOfReceipt: '', pol: '', pod: '', finalDestination: '',
  vessel: '', voyageNo: '', placeOfDelivery: '', containerNo: '', noOfPkgs: '', kind: '',
  description: '', grossWeight: '', measurement: '', freightCharges: 'AS ARRANGED',
  paymentTerms: 'COLLECT', placeIssued: 'Alexandria', dateIssued: '', noOfOriginals: 3,
  deliveryAgent: '', status: 'Draft',
};

export default function ShipmentsPage() {
  const { isAdmin, isOperation } = useAuth();
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const rowBg   = (idx) => isDark ? (idx % 2 === 0 ? '#0d2144' : '#0a1c38') : (idx % 2 === 0 ? '#ffffff' : '#f8fafc');
  const rowHover = isDark ? '#1e3a5f' : '#fffbeb';
  const canBl = isAdmin || isOperation;
  const [rows, setRows] = useState([]);
  const [direction, setDirection] = useState('Export');
  const [status, setStatus] = useState('');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [importing, setImporting] = useState(false);
  const [showArchived, setShowArchived] = useState(false);
  const [attachShipment, setAttachShipment] = useState(null); // row whose drawer is open
  const [blShipment, setBlShipment] = useState(null);   // shipment row being BL'd
  const [blForm, setBlForm] = useState(BL_EMPTY);
  const [blSaving, setBlSaving] = useState(false);
  const [blList, setBlList] = useState([]);              // saved B/Ls for open shipment
  const [blListLoading, setBlListLoading] = useState(false);
  const [blEditId, setBlEditId] = useState(null);        // null = new, uuid = editing
  const [savedCells, setSavedCells] = useState(new Set());
  const [blPreview, setBlPreview] = useState(null); // { url, name }
  const fileRef = useRef(null);
  const rowsRef = useRef(rows);
  rowsRef.current = rows;
  const activeCols = getColumns(direction);
  const [colWidths, ResizeHandle] = useResizableColumns(activeCols);

  const handleImportFile = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = ''; // allow re-uploading same file
    if (!file) return;
    setImporting(true);
    try {
      const text = await file.text();
      const matrix = parseCsv(text);
      if (matrix.length < 2) { toast.error('CSV has no data rows'); return; }

      // Map headers → field keys
      const headers = matrix[0].map(h => h.trim().toLowerCase().replace(/[^a-z0-9]/g, ''));
      const fieldForCol = headers.map(h => HEADER_ALIASES[h] || null);

      const shipments = matrix.slice(1).map(cols => {
        const obj = { direction };           // imported into the current tab's direction
        cols.forEach((val, i) => {
          const field = fieldForCol[i];
          if (field && val.trim() !== '') obj[field] = val.trim();
        });
        // Default status if missing/unknown
        if (!obj.status || !STATUSES.includes(obj.status)) obj.status = obj.status || 'Booked';
        return obj;
      }).filter(o => Object.keys(o).length > 1); // must have at least one real field

      if (!shipments.length) { toast.error('No recognizable rows found'); return; }

      const res = await api.post('/shipments/import', { shipments });
      toast.success(`Imported ${res.data.data.imported} ${direction.toLowerCase()} shipments`);
      load();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Import failed — check the CSV format');
    } finally { setImporting(false); }
  };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/shipments', { params: {
        direction: direction || undefined,
        status: status || undefined,
        search: search || undefined,
        archived: showArchived || undefined,
      } });
      setRows(res.data.data || []);
    } catch (_) {}
    finally { setLoading(false); }
  }, [direction, status, search, showArchived]);

  useEffect(() => { load(); }, [load]);
  useAutoRefresh(load);

  // Update one field locally (immediate UI), then persist on blur/change
  const setLocal = (id, key, value) =>
    setRows(prev => prev.map(r => r.id === id ? { ...r, [key]: value } : r));

  const save = async (id, key) => {
    const row = rowsRef.current.find(r => r.id === id);
    if (!row) return;
    try {
      await api.put(`/shipments/${id}`, { [API_FIELD[key]]: row[key] ?? '' });
      const cellKey = `${id}:${key}`;
      setSavedCells(prev => new Set(prev).add(cellKey));
      setTimeout(() => setSavedCells(prev => { const n = new Set(prev); n.delete(cellKey); return n; }), 1200);
    } catch (err) {
      toast.error('Failed to save change');
    }
  };

  const saveNow = (id, key, value) => {
    setLocal(id, key, value);
    // persist using the value we just set (avoid stale read)
    api.put(`/shipments/${id}`, { [API_FIELD[key]]: value })
      .catch(() => toast.error('Failed to save change'));
  };

  const handleAdded = (shipment) => {
    setShowAdd(false);
    // Show it if it belongs to the current direction tab, else just refresh
    if ((shipment.direction || 'Export') === direction) setRows(prev => [shipment, ...prev]);
    toast.success('Shipment added');
  };

  const loadBlList = async (shipmentId) => {
    setBlListLoading(true);
    try {
      const res = await api.get(`/bl/shipment/${shipmentId}`);
      setBlList(res.data.data || []);
    } catch (_) { setBlList([]); }
    finally { setBlListLoading(false); }
  };

  const openBl = (row) => {
    setBlForm({
      ...BL_EMPTY,
      bookingNo: row.booking_no || '',
      blNo: row.bl_number || '',
      pol: row.pol || '',
      pod: row.pod || '',
      vessel: row.shipping_line || '',
      placeOfReceipt: row.pol || '',
      dateIssued: new Date().toISOString().slice(0, 10),
    });
    setBlEditId(null);
    setBlList([]);
    setBlShipment(row);
    loadBlList(row.id);
  };

  const editBl = (bl) => {
    setBlForm({
      blNo: bl.bl_no || '', bookingNo: bl.booking_no || '',
      shipper: bl.shipper || '', consignee: bl.consignee || '',
      notifyParty: bl.notify_party || '', alsoNotify: bl.also_notify || '',
      preCarriage: bl.pre_carriage || '', placeOfReceipt: bl.place_of_receipt || '',
      pol: bl.pol || '', pod: bl.pod || '', finalDestination: bl.final_destination || '',
      vessel: bl.vessel || '', voyageNo: bl.voyage_no || '',
      placeOfDelivery: bl.place_of_delivery || '', containerNo: bl.container_no || '',
      noOfPkgs: bl.no_of_pkgs || '', kind: '', description: bl.description || '',
      grossWeight: bl.gross_weight || '', measurement: bl.measurement || '',
      freightCharges: bl.freight_charges || 'AS ARRANGED',
      paymentTerms: bl.payment_terms || 'COLLECT',
      placeIssued: bl.place_issued || 'Alexandria',
      dateIssued: bl.date_issued ? bl.date_issued.slice(0, 10) : '',
      noOfOriginals: bl.no_of_originals || 3,
      deliveryAgent: bl.delivery_agent || '', status: bl.status || 'Draft',
    });
    setBlEditId(bl.id);
  };

  const saveBl = async (andDownload = false) => {
    if (!blForm.blNo) { toast.error('B/L No. is required'); return; }
    setBlSaving(true);
    const combined = [blForm.noOfPkgs, blForm.kind].filter(Boolean).join(' × ');
    const payload = { ...blForm, noOfPkgs: combined };
    try {
      let savedId = blEditId;
      if (blEditId) {
        await api.put(`/bl/${blEditId}`, payload);
        toast.success(andDownload ? 'B/L updated — downloading…' : 'B/L updated');
      } else {
        const res = await api.post('/bl', { ...payload, shipmentId: blShipment?.id });
        savedId = res.data.data.id;
        toast.success(andDownload ? 'B/L saved — downloading…' : 'B/L saved');
      }
      setBlEditId(null);
      setBlForm({ ...BL_EMPTY, dateIssued: new Date().toISOString().slice(0, 10) });
      await loadBlList(blShipment.id);
      if (andDownload && savedId) await downloadBlPdf(savedId, blForm.blNo);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to save B/L');
    } finally { setBlSaving(false); }
  };

  const deleteBl = async (blId) => {
    try {
      await api.delete(`/bl/${blId}`);
      toast.success('B/L deleted');
      if (blEditId === blId) { setBlEditId(null); setBlForm(BL_EMPTY); }
      await loadBlList(blShipment.id);
    } catch (_) { toast.error('Failed to delete B/L'); }
  };

  const downloadBlPdf = async (blId, blNo) => {
    try {
      const res = await api.get(`/bl/${blId}/pdf`, { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const a = document.createElement('a');
      a.href = url; a.setAttribute('download', `BL-${blNo}.pdf`);
      document.body.appendChild(a); a.click(); a.remove();
      window.URL.revokeObjectURL(url);
    } catch (_) { toast.error('Error generating B/L PDF'); }
  };

  const previewBlPdf = async (blId, blNo) => {
    try {
      const res = await api.get(`/bl/${blId}/pdf`, { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }));
      setBlPreview({ url, name: `BL-${blNo}.pdf` });
    } catch (_) { toast.error('Error generating B/L PDF'); }
  };

  const downloadQuotationPdf = async (quotationId, ref) => {
    try {
      const res = await api.get(`/quotations/${quotationId}/pdf`, { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const a = document.createElement('a');
      a.href = url; a.setAttribute('download', `quotation-${ref}.pdf`);
      document.body.appendChild(a); a.click(); a.remove();
      window.URL.revokeObjectURL(url);
    } catch (_) { toast.error('Error downloading quotation PDF'); }
  };


  const exportCsv = () => {
    const cols = [
      ['reference', 'Reference'], ['external_ref', 'Old Ref'], ['direction', 'Direction'], ['care_of', 'Assign To'],
      ['shipping_line', 'S/L'], ['client_display', 'Client'], ['pol', 'POL'], ['pod', 'POD'],
      ['booking_no', 'Booking No'], ['container_qty', 'Qty'], ['container_type', 'Type'],
      ['status', 'Status'], ['loading_note', 'Loading'], ['note', 'Note'],
      ['etd', 'ETD'], ['eta', 'ETA'],
    ];
    const esc = (v) => {
      const s = v == null ? '' : String(v);
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const header = cols.map(c => c[1]).join(',');
    const lines = rows.map(r => cols.map(c => {
      let v = r[c[0]];
      if ((c[0] === 'etd' || c[0] === 'eta') && v) v = String(v).slice(0, 10);
      return esc(v);
    }).join(','));
    const csv = [header, ...lines].join('\n');
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `shipments-${direction.toLowerCase()}-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const toggleArchive = async (row) => {
    const archiving = !row.is_archived;
    const label = archiving ? 'Archive' : 'Restore';
    if (!window.confirm(`${label} this shipment?`)) return;
    try {
      await api.put(`/shipments/${row.id}/archive`, { archive: archiving });
      setRows(prev => prev.filter(r => r.id !== row.id));
      toast.success(`Shipment ${archiving ? 'archived' : 'restored'}`);
    } catch { toast.error(`${label} failed`); }
  };

  const removeShipment = async (id) => {
    if (!window.confirm('Delete this shipment? You can restore it from Audit & Trash.')) return;
    try {
      await api.delete(`/shipments/${id}`);
      setRows(prev => prev.filter(r => r.id !== id));
      toast.success('Shipment deleted');
    } catch (err) { toast.error('Delete failed'); }
  };

  // Editable text cell — a plain function (NOT a component) so inputs keep focus
  const cell = (row, k, type = 'text', cls = '') => {
    const flash = savedCells.has(`${row.id}:${k}`);
    return (
      <input
        type={type}
        value={(type === 'date' ? (row[k] ? String(row[k]).slice(0, 10) : '') : (row[k] ?? ''))}
        onChange={e => setLocal(row.id, k, e.target.value)}
        onBlur={() => save(row.id, k)}
        className={`bg-transparent border rounded-md px-2 py-1 text-sm outline-none transition-all duration-300 ${
          flash
            ? 'border-emerald-400 bg-emerald-50 dark:bg-emerald-900/20'
            : 'border-transparent hover:border-gold-400 focus:border-gold-500 focus:bg-white dark:focus:bg-navy-800'
        } ${cls}`}
      />
    );
  };

  return (
    <div className="flex flex-col h-full">
      <div className="page-header">
        <div>
          <h2 className="page-title flex items-center gap-2">
            <ArrowsRightLeftIcon className="w-6 h-6 text-gold-500" />
            Shipments
          </h2>
          <p className="text-slate-500 dark:text-gray-400 text-sm">{rows.length} bookings · click any cell to edit</p>
        </div>
        <div className="flex gap-2">
          <input ref={fileRef} type="file" accept=".csv,text/csv" className="hidden" onChange={handleImportFile} />
          <button className="btn-secondary" onClick={() => fileRef.current?.click()} disabled={importing}
            title={`Import a CSV into the ${direction} tab`}>
            <ArrowUpTrayIcon className="w-4 h-4 inline mr-1.5" />{importing ? 'Importing…' : 'Import CSV'}
          </button>
          <button className="btn-secondary" onClick={exportCsv} disabled={!rows.length}>
            <ArrowDownTrayIcon className="w-4 h-4 inline mr-1.5" />Export CSV
          </button>
          <button
            className={`btn-secondary ${showArchived ? 'ring-2 ring-amber-400' : ''}`}
            onClick={() => setShowArchived(v => !v)}
            title={showArchived ? 'Hide archived shipments' : 'Show archived shipments'}
          >
            <ArchiveBoxIcon className="w-4 h-4 inline mr-1.5" />
            {showArchived ? 'Hide Archived' : 'Archived'}
          </button>
          <button className="btn-primary" onClick={() => setShowAdd(true)}>
            <PlusIcon className="w-4 h-4 inline mr-1.5" />Add Shipment
          </button>
        </div>
      </div>

      {/* Direction tabs */}
      <div className="flex gap-1 mb-3 p-1 bg-slate-100 dark:bg-navy-900 rounded-xl w-fit">
        {DIRECTIONS.map(d => (
          <button key={d} onClick={() => setDirection(d)}
            className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${direction === d
              ? 'bg-white dark:bg-navy-800 text-slate-900 dark:text-white shadow-sm'
              : 'text-slate-500 dark:text-gray-400 hover:text-slate-900 dark:hover:text-white'}`}>
            {d}
          </button>
        ))}
      </div>

      {/* Filters */}
      <div className="flex gap-3 mb-4 flex-wrap items-center">
        <div className="relative">
          <MagnifyingGlassIcon className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input className="input pl-9 w-64 text-sm" placeholder="Search ref, S/L, booking, client, route..."
            value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <select className="select text-sm w-auto" value={status} onChange={e => setStatus(e.target.value)}>
          <option value="">All Statuses</option>
          {STATUSES.map(s => <option key={s}>{s}</option>)}
        </select>
      </div>

      {showArchived && (
        <div className="mb-3 px-3 py-2 rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700/40 text-amber-700 dark:text-amber-400 text-xs font-medium flex items-center gap-2">
          <ArchiveBoxIcon className="w-4 h-4 flex-shrink-0" />
          Showing archived {direction.toLowerCase()} shipments — click <strong>Restore</strong> on any row to bring it back to active.
        </div>
      )}

      {loading ? (
        <TableSkeleton rows={8} cols={6} />
      ) : (
        <div style={{ overflowX: 'auto', overflowY: 'auto', borderRadius: '12px', border: '1px solid #e2e8f0', flex: 1, minHeight: 0 }} className="dark:border-navy-700 bg-white dark:bg-navy-900">
          <table style={{ tableLayout: 'fixed', width: Object.values(colWidths).reduce((a,b)=>a+b,0)+'px', borderCollapse: 'collapse', fontSize: '13px' }}>
            <colgroup>
              {activeCols.map(([key]) => (
                <col key={key} style={{ width: colWidths[key]+'px' }} />
              ))}
            </colgroup>
            <thead>
              <tr style={{ background: isDark ? '#0d2144' : '#f1f5f9', borderBottom: `2px solid ${isDark ? '#1e3a5f' : '#cbd5e1'}`, position: 'sticky', top: 0, zIndex: 2 }}>
                {activeCols.map(([key, label]) => (
                  <th key={key} style={{
                    position: 'relative', padding: '10px 14px',
                    textAlign: key === 'container_qty' ? 'center' : 'left',
                    fontSize: '11px', fontWeight: 700, color: '#475569',
                    textTransform: 'uppercase', letterSpacing: '0.05em',
                    whiteSpace: 'nowrap', overflow: 'hidden',
                    borderRight: '1px solid #e2e8f0',
                  }} className="dark:text-gray-300 dark:border-navy-700">
                    {label}
                    {key !== '_del' && key !== '_row' && <ResizeHandle colKey={key} />}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, idx) => (
                <tr key={row.id}
                  style={{ background: rowBg(idx), borderBottom: `1px solid ${isDark ? '#1e3a5f' : '#e2e8f0'}` }}
                  className="group transition-colors"
                  onMouseEnter={e => e.currentTarget.style.background = rowHover}
                  onMouseLeave={e => e.currentTarget.style.background = rowBg(idx)}
                >
                  {/* Row number */}
                  <td style={{ padding: '6px 4px', textAlign: 'center', overflow: 'hidden', color: '#94a3b8', fontSize: '11px', fontWeight: 600 }}>
                    {idx + 1}
                  </td>
                  <td style={{ padding: '6px 8px', overflow: 'hidden' }}>{cell(row, 'reference', 'text', 'w-full font-mono font-semibold text-gold-600 dark:text-gold-400')}</td>
                  <td style={{ padding: '6px 8px', overflow: 'hidden' }}>{cell(row, 'external_ref', 'text', 'w-full font-mono text-slate-500 dark:text-gray-400')}</td>
                  <td style={{ padding: '6px 8px', overflow: 'hidden' }}>{cell(row, 'care_of', 'text', 'w-full')}</td>
                  <td style={{ padding: '6px 8px', overflow: 'hidden' }}>{cell(row, 'shipping_line', 'text', 'w-full font-semibold')}</td>
                  <td style={{ padding: '6px 8px', overflow: 'hidden' }}>
                    <input value={row.client_name ?? ''} placeholder={row.client_display || '—'}
                      onChange={e => setLocal(row.id, 'client_name', e.target.value)}
                      onBlur={() => save(row.id, 'client_name')}
                      className={`w-full bg-transparent border rounded px-2 py-1 text-sm outline-none text-slate-700 dark:text-gray-300 transition-all duration-300 ${
                        savedCells.has(`${row.id}:client_name`)
                          ? 'border-emerald-400 bg-emerald-50 dark:bg-emerald-900/20'
                          : 'border-transparent hover:border-gold-400 focus:border-gold-500 focus:bg-white dark:focus:bg-navy-800'
                      }`} />
                  </td>
                  {/* POL → POD with route arrow */}
                  <td style={{ padding: '6px 8px', overflow: 'hidden' }}>{cell(row, 'pol', 'text', 'w-full')}</td>
                  <td style={{ padding: '6px 4px', overflow: 'hidden' }}>
                    <div className="flex items-center gap-0.5">
                      <span className="text-slate-300 dark:text-navy-600 text-xs font-bold select-none">→</span>
                      {cell(row, 'pod', 'text', 'flex-1 min-w-0')}
                    </div>
                  </td>
                  <td style={{ padding: '6px 8px', overflow: 'hidden' }}>{cell(row, 'booking_no', 'text', 'w-full font-mono')}</td>
                  <td style={{ padding: '6px 8px', overflow: 'hidden', textAlign: 'center' }}>
                    <input type="number" value={row.container_qty ?? ''}
                      onChange={e => setLocal(row.id, 'container_qty', e.target.value)}
                      onBlur={() => save(row.id, 'container_qty')}
                      className="w-full bg-transparent border border-transparent hover:border-gold-400 focus:border-gold-500 focus:bg-white dark:focus:bg-navy-800 rounded px-1 py-1 text-sm text-center outline-none text-slate-700 dark:text-gray-300" />
                  </td>
                  <td style={{ padding: '6px 8px', overflow: 'hidden' }}>
                    <select value={row.container_type ?? ''} onChange={e => saveNow(row.id, 'container_type', e.target.value)}
                      className="w-full bg-transparent border border-transparent hover:border-gold-400 focus:border-gold-500 rounded px-1 py-1 text-sm outline-none text-slate-700 dark:text-gray-200 cursor-pointer">
                      <option value="">—</option>
                      {CONTAINER_TYPES.map(t => <option key={t}>{t}</option>)}
                    </select>
                  </td>
                  {/* Direction-specific columns — before Status */}
                  {(direction === 'Export' || direction === 'Import') && (
                    <td style={{ padding: '6px 8px', overflow: 'hidden' }}>{cell(row, 'acid', 'text', 'w-full font-mono')}</td>
                  )}
                  {direction === 'Import' && (
                    <td style={{ padding: '6px 8px', overflow: 'hidden' }}>{cell(row, 'master_acid', 'text', 'w-full font-mono')}</td>
                  )}
                  {(direction === 'Export' || direction === 'Import') && (
                    <td style={{ padding: '6px 8px', overflow: 'hidden' }}>{cell(row, 'bl_number', 'text', 'w-full font-mono')}</td>
                  )}
                  <td style={{ padding: '6px 8px', overflow: 'hidden' }}>
                    <select value={row.status} onChange={e => saveNow(row.id, 'status', e.target.value)}
                      className={`w-full rounded-full border-2 px-2 py-1 text-xs font-bold outline-none cursor-pointer ${STATUS_COLOR[row.status] || 'bg-slate-100 text-slate-600 border-slate-300'}`}>
                      {STATUSES.map(s => <option key={s} className="bg-white dark:bg-navy-900 text-slate-800 font-normal">{s}</option>)}
                    </select>
                  </td>
                  <td style={{ padding: '6px 8px', overflow: 'hidden' }}>{cell(row, 'loading_date', 'date', 'w-full')}</td>
                  <td style={{ padding: '6px 8px', overflow: 'hidden' }}>{cell(row, 'loading_note', 'text', 'w-full text-slate-500 dark:text-gray-400')}</td>
                  <td style={{ padding: '6px 8px', overflow: 'hidden' }}>{cell(row, 'etd', 'date', 'w-full')}</td>
                  <td style={{ padding: '6px 8px', overflow: 'hidden' }}>{cell(row, 'eta', 'date', 'w-full')}</td>
                  {/* Compact icon-only actions */}
                  <td style={{ padding: '4px 6px' }}>
                    <div className="flex items-center justify-center gap-1">
                      <button onClick={() => setAttachShipment(row)} title="Files & Attachments"
                        className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-navy-700 transition-colors">
                        <PaperClipIcon className="w-4 h-4" />
                      </button>
                      {row.quotation_id && (
                        <button onClick={() => downloadQuotationPdf(row.quotation_id, row.quotation_ref || row.reference)} title="Download Quotation PDF"
                          className="p-1.5 rounded-lg text-amber-400 hover:text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-900/20 transition-colors">
                          <ArrowDownTrayIcon className="w-4 h-4" />
                        </button>
                      )}
                      {canBl && (
                        <button onClick={() => openBl(row)} title="Bill of Lading"
                          className="p-1.5 rounded-lg text-blue-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors">
                          <DocumentTextIcon className="w-4 h-4" />
                        </button>
                      )}
                      <button onClick={() => toggleArchive(row)} title={row.is_archived ? 'Restore shipment' : 'Archive shipment'}
                        className="p-1.5 rounded-lg text-amber-400 hover:text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-900/20 transition-colors">
                        {row.is_archived ? <ArchiveBoxArrowDownIcon className="w-4 h-4" /> : <ArchiveBoxIcon className="w-4 h-4" />}
                      </button>
                      <button onClick={() => removeShipment(row.id)} title="Delete shipment"
                        className="p-1.5 rounded-lg text-slate-300 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors">
                        <TrashIcon className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {!rows.length && (
                <tr><td colSpan={activeCols.length} className="text-center py-16">
                  <div className="flex flex-col items-center gap-2 text-slate-400 dark:text-gray-600">
                    <ArrowsRightLeftIcon className="w-10 h-10 opacity-30" />
                    <p className="font-medium text-sm">
                      {showArchived ? `No archived ${direction.toLowerCase()} shipments` : `No ${direction.toLowerCase()} shipments yet`}
                    </p>
                    {!showArchived && <p className="text-xs">Click "Add Shipment" or import a CSV to get started</p>}
                  </div>
                </td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Attachments drawer */}
      {attachShipment && (
        <ShipmentAttachmentsDrawer
          shipment={attachShipment}
          onClose={() => setAttachShipment(null)}
        />
      )}

      <Modal isOpen={showAdd} onClose={() => setShowAdd(false)} title="Add Shipment" size="lg">
        <AddShipmentForm defaultDirection={direction} onSaved={handleAdded} onClose={() => setShowAdd(false)} />
      </Modal>

      {/* B/L Form Modal */}
      <Modal isOpen={!!blShipment} onClose={() => { setBlShipment(null); setBlEditId(null); }} title="House Bill of Lading" size="xl">
        {blShipment && (
          <div className="space-y-4">
            <p className="text-xs text-slate-500 dark:text-gray-400">
              Shipment: <span className="font-mono text-gold-500">{blShipment.reference}</span>
              {blShipment.pol && ` · ${blShipment.pol} → ${blShipment.pod}`}
            </p>

            {/* Saved B/Ls list */}
            {blListLoading ? (
              <p className="text-xs text-slate-400 dark:text-gray-500">Loading saved B/Ls…</p>
            ) : blList.length > 0 && (
              <div className="rounded-xl border border-slate-200 dark:border-navy-700 overflow-hidden">
                <div className="px-3 py-2 bg-slate-50 dark:bg-navy-800 text-xs font-semibold text-slate-600 dark:text-gray-300 uppercase tracking-wide">
                  Saved B/Ls ({blList.length})
                </div>
                {blList.map(bl => (
                  <div key={bl.id} className={`flex items-center justify-between px-3 py-2 border-t border-slate-100 dark:border-navy-800 ${blEditId === bl.id ? 'bg-gold-50 dark:bg-gold-900/10' : ''}`}>
                    <div className="min-w-0">
                      <span className="font-mono text-sm text-slate-900 dark:text-white font-medium">{bl.bl_no}</span>
                      <span className={`ml-2 text-xs px-1.5 py-0.5 rounded-full font-medium ${bl.status === 'Original' ? 'bg-amber-100 text-amber-700' : bl.status === 'Draft' ? 'bg-slate-100 text-slate-500 dark:bg-navy-700 dark:text-gray-400' : 'bg-blue-50 text-blue-600'}`}>{bl.status}</span>
                      <span className="ml-2 text-xs text-slate-400 dark:text-gray-500">{bl.date_issued ? new Date(bl.date_issued).toLocaleDateString('en-GB') : ''}</span>
                    </div>
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      <button onClick={() => editBl(bl)} className="text-xs px-2 py-1 rounded-lg bg-slate-100 dark:bg-navy-700 text-slate-600 dark:text-gray-300 hover:bg-gold-100 dark:hover:bg-gold-900/20 hover:text-gold-600 transition-colors">Edit</button>
                      <button onClick={() => previewBlPdf(bl.id, bl.bl_no)} className="text-xs px-2 py-1 rounded-lg bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400 hover:bg-green-100 transition-colors">Preview</button>
                      <button onClick={() => downloadBlPdf(bl.id, bl.bl_no)} className="text-xs px-2 py-1 rounded-lg bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 hover:bg-blue-100 transition-colors">PDF</button>
                      <button onClick={() => deleteBl(bl.id)} className="text-xs px-2 py-1 rounded-lg bg-red-50 dark:bg-red-900/20 text-red-500 hover:bg-red-100 transition-colors">Delete</button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Form heading */}
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
                {blEditId ? 'Edit B/L' : 'New B/L'}
              </h3>
              {blEditId && (
                <button className="text-xs text-slate-500 hover:text-slate-800 dark:text-gray-400 dark:hover:text-gray-200"
                  onClick={() => { setBlEditId(null); setBlForm({ ...BL_EMPTY, dateIssued: new Date().toISOString().slice(0, 10) }); }}>
                  ✕ Cancel edit / New B/L
                </button>
              )}
            </div>

            {/* Row 1 */}
            <div className="grid grid-cols-3 gap-3">
              <div><label className="label">B/L No. *</label><input className="input" value={blForm.blNo} onChange={e => setBlForm(f => ({...f, blNo: e.target.value}))} placeholder="260513/CHIT/NUR/EDD" /></div>
              <div><label className="label">Booking No.</label><input className="input" value={blForm.bookingNo} onChange={e => setBlForm(f => ({...f, bookingNo: e.target.value}))} /></div>
              <div><label className="label">Status</label>
                <select className="select" value={blForm.status} onChange={e => setBlForm(f => ({...f, status: e.target.value}))}>
                  {['Draft','Original','Copy','Surrendered'].map(s => <option key={s}>{s}</option>)}
                </select>
              </div>
            </div>

            {/* Row 2 */}
            <div className="grid grid-cols-2 gap-3">
              <div><label className="label">Shipper</label><textarea className="input min-h-[80px]" value={blForm.shipper} onChange={e => setBlForm(f => ({...f, shipper: e.target.value}))} /></div>
              <div><label className="label">Consignee</label><textarea className="input min-h-[80px]" value={blForm.consignee} onChange={e => setBlForm(f => ({...f, consignee: e.target.value}))} /></div>
            </div>

            {/* Row 3 */}
            <div className="grid grid-cols-2 gap-3">
              <div><label className="label">Notify Party</label><textarea className="input min-h-[60px]" value={blForm.notifyParty} onChange={e => setBlForm(f => ({...f, notifyParty: e.target.value}))} /></div>
              <div><label className="label">Also Notify</label><textarea className="input min-h-[60px]" value={blForm.alsoNotify} onChange={e => setBlForm(f => ({...f, alsoNotify: e.target.value}))} /></div>
            </div>

            {/* Row 4 */}
            <div className="grid grid-cols-4 gap-3">
              <div><label className="label">Pre-Carriage By</label><input className="input" value={blForm.preCarriage} onChange={e => setBlForm(f => ({...f, preCarriage: e.target.value}))} /></div>
              <div><label className="label">Place of Receipt</label><input className="input" value={blForm.placeOfReceipt} onChange={e => setBlForm(f => ({...f, placeOfReceipt: e.target.value}))} /></div>
              <div><label className="label">Port of Loading</label><input className="input" value={blForm.pol} onChange={e => setBlForm(f => ({...f, pol: e.target.value}))} /></div>
              <div><label className="label">Port of Discharge</label><input className="input" value={blForm.pod} onChange={e => setBlForm(f => ({...f, pod: e.target.value}))} /></div>
            </div>

            {/* Row 5 */}
            <div className="grid grid-cols-4 gap-3">
              <div className="col-span-2"><label className="label">Ocean Vessel</label><input className="input" value={blForm.vessel} onChange={e => setBlForm(f => ({...f, vessel: e.target.value}))} /></div>
              <div><label className="label">Voyage No.</label><input className="input" value={blForm.voyageNo} onChange={e => setBlForm(f => ({...f, voyageNo: e.target.value}))} /></div>
              <div><label className="label">Final Destination</label><input className="input" value={blForm.finalDestination} onChange={e => setBlForm(f => ({...f, finalDestination: e.target.value}))} /></div>
            </div>

            {/* Row 6 — Cargo */}
            <div className="grid grid-cols-3 gap-3">
              <div><label className="label">Container No. & Seal No.</label><input className="input" value={blForm.containerNo} onChange={e => setBlForm(f => ({...f, containerNo: e.target.value}))} /></div>
              <div>
                <label className="label">No. of Pkgs / Kind</label>
                <div className="flex gap-2">
                  <input className="input w-20" placeholder="Qty" value={blForm.noOfPkgs} onChange={e => setBlForm(f => ({...f, noOfPkgs: e.target.value}))} />
                  <select className="select flex-1" value={blForm.kind} onChange={e => setBlForm(f => ({...f, kind: e.target.value}))}>
                    <option value="">— Kind —</option>
                    <optgroup label="Sea Freight">
                      {["20' DC","40' DC","40' HC","45' HC","20' RF (Reefer)","40' RF (Reefer)","20' OT (Open Top)","40' OT (Open Top)","20' FR (Flat Rack)","40' FR (Flat Rack)","LCL"].map(t => <option key={t}>{t}</option>)}
                    </optgroup>
                    <optgroup label="Air Freight">
                      {['Air – General Cargo','Air – Temperature Controlled','Air – Dangerous Goods (DG)','Air – Express'].map(t => <option key={t}>{t}</option>)}
                    </optgroup>
                  </select>
                </div>
              </div>
              <div><label className="label">Gross Weight</label><input className="input" value={blForm.grossWeight} onChange={e => setBlForm(f => ({...f, grossWeight: e.target.value}))} /></div>
            </div>

            <div><label className="label">Description of Goods</label><textarea className="input min-h-[80px]" value={blForm.description} onChange={e => setBlForm(f => ({...f, description: e.target.value}))} /></div>

            {/* Row 7 — Bottom */}
            <div className="grid grid-cols-4 gap-3">
              <div><label className="label">Freight & Charges</label><input className="input" value={blForm.freightCharges} onChange={e => setBlForm(f => ({...f, freightCharges: e.target.value}))} /></div>
              <div><label className="label">Payment Terms</label>
                <select className="select" value={blForm.paymentTerms} onChange={e => setBlForm(f => ({...f, paymentTerms: e.target.value}))}>
                  {['COLLECT','PREPAID','AS ARRANGED'].map(s => <option key={s}>{s}</option>)}
                </select>
              </div>
              <div><label className="label">Place Issued</label><input className="input" value={blForm.placeIssued} onChange={e => setBlForm(f => ({...f, placeIssued: e.target.value}))} /></div>
              <div><label className="label">Date Issued</label><input type="date" className="input" value={blForm.dateIssued} onChange={e => setBlForm(f => ({...f, dateIssued: e.target.value}))} /></div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div><label className="label">No. of Originals</label><input type="number" className="input" value={blForm.noOfOriginals} min={1} max={9} onChange={e => setBlForm(f => ({...f, noOfOriginals: parseInt(e.target.value)||3}))} /></div>
              <div><label className="label">For Delivery of Goods Apply To (Agent)</label><textarea className="input min-h-[60px]" value={blForm.deliveryAgent} onChange={e => setBlForm(f => ({...f, deliveryAgent: e.target.value}))} /></div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100 dark:border-navy-800">
              <button className="btn-ghost" onClick={() => { setBlShipment(null); setBlEditId(null); }} disabled={blSaving}>Cancel</button>
              <button className="btn-secondary" onClick={() => saveBl(false)} disabled={blSaving}>
                {blSaving ? 'Saving…' : blEditId ? 'Update B/L' : 'Save B/L'}
              </button>
              <button className="btn-primary flex items-center gap-1.5" onClick={() => saveBl(true)} disabled={blSaving}>
                <ArrowDownTrayIcon className="w-4 h-4" />
                {blSaving ? 'Saving…' : blEditId ? 'Update & Download PDF' : 'Save & Download PDF'}
              </button>
            </div>
          </div>
        )}
      </Modal>

      {blPreview && (
        <div className="fixed inset-0 z-50 flex flex-col bg-black/80 backdrop-blur-sm">
          <div className="flex items-center justify-between px-4 py-3 bg-white dark:bg-navy-900 border-b border-slate-200 dark:border-navy-700 flex-shrink-0">
            <span className="text-sm font-medium text-slate-800 dark:text-white">B/L Preview — {blPreview.name}</span>
            <div className="flex items-center gap-2">
              <a href={blPreview.url} download={blPreview.name} className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-gold-500 hover:bg-gold-600 text-white font-medium transition-colors">
                <ArrowDownTrayIcon className="w-4 h-4" />Download
              </a>
              <button onClick={() => { window.URL.revokeObjectURL(blPreview.url); setBlPreview(null); }} className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-navy-700 text-slate-500 dark:text-gray-400 transition-colors">
                <XMarkIcon className="w-5 h-5" />
              </button>
            </div>
          </div>
          <iframe src={blPreview.url} className="flex-1 w-full" title="B/L PDF Preview" />
        </div>
      )}
    </div>
  );
}

function AddShipmentForm({ defaultDirection, onSaved, onClose }) {
  const [form, setForm] = useState({
    direction: defaultDirection, reference: '', careOf: '', shippingLine: '', clientName: '',
    pol: '', pod: '', bookingNo: '', containerQty: '', containerType: '', status: 'Booked',
    etd: '', eta: '', loadingDate: '', loadingNote: '', note: '',
  });
  const [saving, setSaving] = useState(false);
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await api.post('/shipments', form);
      onSaved(res.data.data);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to add shipment');
    } finally { setSaving(false); }
  };

  return (
    <form onSubmit={submit}>
      <div className="grid grid-cols-3 gap-4">
        <div className="form-group">
          <label className="label">Direction</label>
          <select className="select" value={form.direction} onChange={e => set('direction', e.target.value)}>
            {DIRECTIONS.map(d => <option key={d}>{d}</option>)}
          </select>
        </div>
        <div className="form-group col-span-2">
          <label className="label">Reference</label>
          <input className="input" value={form.reference} onChange={e => set('reference', e.target.value)} placeholder="e.g. 260401/CAST/RAR/NRBI" />
        </div>

        <div className="form-group"><label className="label">Care Of</label><input className="input" value={form.careOf} onChange={e => set('careOf', e.target.value)} /></div>
        <div className="form-group"><label className="label">Shipping Line (S/L)</label><input className="input" value={form.shippingLine} onChange={e => set('shippingLine', e.target.value)} placeholder="e.g. MSC, MAERSK" /></div>
        <div className="form-group"><label className="label">Client</label><input className="input" value={form.clientName} onChange={e => set('clientName', e.target.value)} /></div>

        <div className="form-group"><label className="label">POL</label><input className="input" value={form.pol} onChange={e => set('pol', e.target.value)} placeholder="Port of loading" /></div>
        <div className="form-group"><label className="label">POD</label><input className="input" value={form.pod} onChange={e => set('pod', e.target.value)} placeholder="Port of discharge" /></div>
        <div className="form-group"><label className="label">Booking No</label><input className="input" value={form.bookingNo} onChange={e => set('bookingNo', e.target.value)} /></div>

        <div className="form-group">
          <label className="label">Qty</label>
          <input className="input" type="number" min="0" value={form.containerQty} onChange={e => set('containerQty', e.target.value)} />
        </div>
        <div className="form-group">
          <label className="label">Container Type</label>
          <select className="select" value={form.containerType} onChange={e => set('containerType', e.target.value)}>
            <option value=""></option>
            {CONTAINER_TYPES.map(t => <option key={t}>{t}</option>)}
          </select>
        </div>
        <div className="form-group">
          <label className="label">Status</label>
          <select className="select" value={form.status} onChange={e => set('status', e.target.value)}>
            {STATUSES.map(s => <option key={s}>{s}</option>)}
          </select>
        </div>

        <div className="form-group"><label className="label">ETD</label><input className="input" type="date" value={form.etd} onChange={e => set('etd', e.target.value)} /></div>
        <div className="form-group"><label className="label">ETA</label><input className="input" type="date" value={form.eta} onChange={e => set('eta', e.target.value)} /></div>
        <div className="form-group"><label className="label">Loading Date</label><input className="input" type="date" value={form.loadingDate} onChange={e => set('loadingDate', e.target.value)} /></div>
        <div className="form-group"><label className="label">Notes</label><input className="input" value={form.loadingNote} onChange={e => set('loadingNote', e.target.value)} /></div>
      </div>

      <div className="flex justify-end gap-3 mt-5">
        <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
        <button type="submit" className="btn-primary" disabled={saving}>{saving ? 'Saving...' : 'Add Shipment'}</button>
      </div>
    </form>
  );
}
