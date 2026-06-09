import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import api from '../services/api';
import {
  ArrowLeftIcon, PlusIcon, TrashIcon, DocumentArrowDownIcon,
  ArrowPathIcon, SparklesIcon, ExclamationTriangleIcon, TableCellsIcon,
} from '@heroicons/react/24/outline';
import Badge from '../components/common/Badge';
import Modal from '../components/common/Modal';
import ClientSelect from '../components/common/ClientSelect';
import { useAuth } from '../store/AuthContext';

const OPTION_COLORS = ['#2A4A8A', '#2D7D46', '#7B3F8A', '#B5451B'];

function ChargeList({ charges, currency, onChange, onAdd, onRemove }) {
  return (
    <div className="space-y-2">
      {charges.map((charge, idx) => (
        <div key={idx} className="bg-slate-50 dark:bg-navy-800/40 rounded-lg px-3 py-2 space-y-2">
          <div className="grid grid-cols-12 gap-2 items-center">
            <div className="col-span-4">
              <select className="select text-xs" value={charge.category} onChange={e => onChange(idx, 'category', e.target.value)}>
                {CHARGE_CATEGORIES.map(c => <option key={c}>{c}</option>)}
              </select>
            </div>
            <div className="col-span-7">
              <input className="input text-xs" placeholder="Description" value={charge.description}
                onChange={e => onChange(idx, 'description', e.target.value)} required />
            </div>
            <div className="col-span-1 flex justify-end">
              {charges.length > 1 && (
                <button type="button" className="text-red-500 hover:text-red-400 p-1" onClick={() => onRemove(idx)}>
                  <TrashIcon className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>
          <div className="grid grid-cols-12 gap-2 items-center">
            <div className="col-span-2">
              <input className="input text-xs" type="number" min="1" step="1" placeholder="Qty"
                value={charge.qty} onChange={e => onChange(idx, 'qty', e.target.value)} />
            </div>
            <div className="col-span-1 text-center text-slate-400 dark:text-gray-500 text-xs font-medium">×</div>
            <div className="col-span-3">
              <input className="input text-xs" type="number" min="0" step="any" placeholder="Sell rate"
                value={charge.unitRate} onChange={e => onChange(idx, 'unitRate', e.target.value)} />
            </div>
            <div className="col-span-1 text-center text-slate-400 dark:text-gray-500 text-xs font-medium">=</div>
            <div className="col-span-3">
              <input
                className={`input text-xs ${charge.unitRate ? 'opacity-70 cursor-default' : ''}`}
                type="number" placeholder="Amount"
                value={charge.amount}
                readOnly={!!charge.unitRate}
                onChange={e => { if (!charge.unitRate) onChange(idx, 'amount', e.target.value); }}
                required
              />
            </div>
            <div className="col-span-2">
              <select className="select text-xs" value={charge.currency || currency} onChange={e => onChange(idx, 'currency', e.target.value)}>
                {CURRENCIES.map(c => <option key={c}>{c}</option>)}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-12 gap-2 items-center">
            <div className="col-span-2 text-xs text-orange-400 font-medium">Cost</div>
            <div className="col-span-1 text-center text-slate-400 dark:text-gray-500 text-xs font-medium">×</div>
            <div className="col-span-3">
              <input className="input text-xs border-orange-500/30 focus:border-orange-500"
                type="number" min="0" step="any" placeholder="Buy rate"
                value={charge.buyingRate} onChange={e => onChange(idx, 'buyingRate', e.target.value)} />
            </div>
            <div className="col-span-1 text-center text-slate-400 dark:text-gray-500 text-xs font-medium">=</div>
            <div className="col-span-5 text-xs text-orange-400">
              {charge.buyingRate
                ? `${charge.currency || currency} ${((parseFloat(charge.qty) || 1) * parseFloat(charge.buyingRate)).toFixed(2)}`
                : <span className="text-slate-500 dark:text-gray-600">— enter to track cost</span>}
            </div>
          </div>
        </div>
      ))}
      <button type="button" className="btn-secondary text-xs w-full mt-1" onClick={onAdd}>
        <PlusIcon className="w-3.5 h-3.5 inline mr-1" />Add Charge
      </button>
    </div>
  );
}

const SERVICE_TYPES = ['Sea Freight FCL', 'Sea Freight LCL', 'Air Freight', 'Inland Trucking', 'Customs Clearance', 'Storage & Warehousing'];

const CARGO_TYPE_OPTIONS = {
  'Sea Freight FCL': ["1×20' DC","1×40' DC","1×40' HC","1×45' HC","2×20' DC","2×40' DC","2×40' HC","1×20' RF (Reefer)","1×40' RF (Reefer)","1×20' OT (Open Top)","1×40' OT (Open Top)","1×20' FR (Flat Rack)","1×40' FR (Flat Rack)"],
  'Sea Freight LCL': ['LCL'],
  'Air Freight':     ['General Cargo','Temperature Controlled','Dangerous Goods (DG)','Oversized / OOG','Express Cargo','Perishables'],
};
const DIRECTIONS = ['', 'Import', 'Export', 'Domestic'];
const CHARGE_CATEGORIES = ['Freight', 'B/L Charges', 'Local Charges', 'Destination Charges', 'Insurance', 'Custom Clearance', 'Inland Charges', 'Official Receipts', 'Other'];
const CURRENCIES = ['USD', 'EGP', 'EUR'];
const INCOTERMS = ['', 'Ex-Work (EXW)', 'FCA', 'FAS', 'FOB', 'CFR', 'CIF', 'CPT', 'CIP', 'DAP', 'DPU', 'DDP', 'Door to Door', 'Others'];
const INCOTERMS_WITH_PICKUP   = ['Ex-Work (EXW)', 'FCA', 'Door to Door'];
const INCOTERMS_WITH_DELIVERY = ['CPT', 'CIP', 'DAP', 'DPU', 'DDP', 'Door to Door'];

const emptyCharge = () => ({ category: 'Freight', description: '', qty: '1', unitRate: '', amount: '', currency: 'USD', buyingRate: '' });

export default function QuotationFormPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { canManage, user, settings } = useAuth();
  const isSalesRep = user?.role === 'Sales Rep';

  const [form, setForm] = useState({
    clientId:         searchParams.get('clientId')    || '',
    leadId:           searchParams.get('leadId')      || '',
    serviceType:      searchParams.get('shipmentType')|| 'Sea Freight FCL',
    direction:        '',
    origin:           searchParams.get('origin')      || '',
    destination:      searchParams.get('destination') || '',
    cargoType:        '',
    weight:           searchParams.get('weight')      || '',
    volume:           searchParams.get('volume')      || '',
    transitTime:      '',
    freeDays:         '',
    currency:         settings?.defaultCurrency || 'USD',
    validUntil:       '',
    notes:            '',
    charges:          [emptyCharge()],
    incoterms:        '',
    incotermOther:    '',
    pickupLocation:   '',
    deliveryLocation: '',
    carrier:          '',
    showCarrierInPdf: false,
  });

  const [comparisonMode, setComparisonMode] = useState(searchParams.get('mode') === 'comparison');
  const [activeOption,   setActiveOption]   = useState(0);
  const [options, setOptions] = useState([
    { label: 'Option A', carrier: '', charges: [emptyCharge()] },
    { label: 'Option B', carrier: '', charges: [emptyCharge()] },
  ]);

  const [clients,    setClients]    = useState([]);
  const [loading,    setLoading]    = useState(false);
  const [saved,      setSaved]      = useState(null);
  const [liveRate,   setLiveRate]   = useState(null);
  const [rateLoading, setRateLoading] = useState(false);

  // ── Rate Picker state ──────────────────────────────────────────────────────
  const [showRatePicker,    setShowRatePicker]    = useState(false);
  const [suggestedRates,    setSuggestedRates]    = useState([]);
  const [ratePickerLoading, setRatePickerLoading] = useState(false);
  // selectedRates: Set of strings like "rateId:containerType"
  const [selectedRates,     setSelectedRates]     = useState(new Set());

  const fetchRate = async () => {
    setRateLoading(true);
    try {
      const res = await api.get('/reports/exchange-rate');
      setLiveRate(res.data.data);
      const d = res.data.data;
      toast.success(`Rates: 1 USD = ${d.rate.toFixed(2)} EGP${d.eurRate ? ` | ${d.eurRate.toFixed(4)} EUR` : ''}`);
    } catch { toast.error('Could not fetch exchange rate'); }
    finally { setRateLoading(false); }
  };

  // ── Draft autosave (new quotations only) ──────────────────────────────────
  const DRAFT_KEY = 'quotation_draft';
  useEffect(() => {
    if (id) return;
    const saved = localStorage.getItem(DRAFT_KEY);
    if (saved) {
      try {
        const draft = JSON.parse(saved);
        setForm(f => ({ ...f, ...draft }));
        toast('Draft restored', { icon: '📋' });
      } catch {}
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (id) return;
    localStorage.setItem(DRAFT_KEY, JSON.stringify(form));
  }, [form, id]);

  // ── Load data ──────────────────────────────────────────────────────────────
  useEffect(() => {
    api.get('/clients', { params: { limit: 200 } }).then(r => setClients(r.data.data || [])).catch(() => {});
    if (id) {
      api.get(`/quotations/${id}`).then(res => {
        const q = res.data.data;
        const isComp = Array.isArray(q.options) && q.options.length > 1;
        setForm({
          clientId:         q.client_id     || '',
          leadId:           q.lead_id       || '',
          serviceType:      q.service_type,
          direction:        q.direction       || '',
          origin:           q.origin,
          destination:      q.destination,
          cargoType:        q.cargo_type    || '',
          weight:           q.weight        || '',
          volume:           q.volume        || '',
          transitTime:      q.transit_time  || '',
          freeDays:         q.free_days     || '',
          currency:         q.currency,
          validUntil:       q.valid_until?.slice(0, 10) || '',
          notes:            q.notes         || '',
          charges: q.charges?.length ? q.charges.map(c => ({
            qty:        String(c.qty       || '1'),
            unitRate:   c.unit_rate  != null ? String(c.unit_rate)   : '',
            buyingRate: c.buying_rate != null ? String(c.buying_rate) : '',
            ...c,
          })) : [emptyCharge()],
          incoterms:        q.incoterms      || '',
          incotermOther:    q.incoterm_other || '',
          pickupLocation:   q.pickup_location   || '',
          deliveryLocation: q.delivery_location || '',
          carrier:          q.carrier           || '',
          showCarrierInPdf: q.show_carrier_in_pdf === true,
        });
        if (isComp) {
          setComparisonMode(true);
          setOptions(q.options.map(o => ({
            ...o,
            charges: (o.charges || [emptyCharge()]).map(c => ({
              qty:        String(c.qty || '1'),
              unitRate:   c.unit_rate  != null ? String(c.unit_rate)   : (c.unitRate  || ''),
              buyingRate: c.buying_rate != null ? String(c.buying_rate) : (c.buyingRate || ''),
              ...c,
            })),
          })));
        }
        setSaved(q);
      }).catch(() => {});
    }
  }, [id]);

  // ── Charge helpers ─────────────────────────────────────────────────────────
  const setCharge = (idx, field, value) => {
    const charges = [...form.charges];
    const updated = { ...charges[idx], [field]: value };
    if (field === 'qty' || field === 'unitRate') {
      const qty  = parseFloat(field === 'qty'      ? value : updated.qty)      || 1;
      const rate = parseFloat(field === 'unitRate'  ? value : updated.unitRate) || 0;
      if (rate > 0) updated.amount = String((qty * rate).toFixed(2));
    }
    charges[idx] = updated;
    setForm({ ...form, charges });
  };
  const addCharge    = () => setForm({ ...form, charges: [...form.charges, emptyCharge()] });
  const removeCharge = (idx) => setForm({ ...form, charges: form.charges.filter((_, i) => i !== idx) });

  // ── Comparison option helpers ──────────────────────────────────────────────
  const setOptionCharge = (optIdx, chargeIdx, field, value) => {
    setOptions(opts => opts.map((opt, oi) => {
      if (oi !== optIdx) return opt;
      const charges = opt.charges.map((c, ci) => {
        if (ci !== chargeIdx) return c;
        const updated = { ...c, [field]: value };
        if (field === 'qty' || field === 'unitRate') {
          const qty  = parseFloat(field === 'qty'     ? value : updated.qty)     || 1;
          const rate = parseFloat(field === 'unitRate' ? value : updated.unitRate) || 0;
          if (rate > 0) updated.amount = String((qty * rate).toFixed(2));
        }
        return updated;
      });
      return { ...opt, charges };
    }));
  };
  const addOptionCharge    = (oi) => setOptions(opts => opts.map((o, i) => i === oi ? { ...o, charges: [...o.charges, emptyCharge()] } : o));
  const removeOptionCharge = (oi, ci) => setOptions(opts => opts.map((o, i) => i === oi ? { ...o, charges: o.charges.filter((_, j) => j !== ci) } : o));
  const addOption = () => {
    if (options.length >= 4) { toast.error('Maximum 4 options'); return; }
    const labels = ['A', 'B', 'C', 'D'];
    setOptions(o => [...o, { label: `Option ${labels[o.length]}`, carrier: '', charges: [emptyCharge()] }]);
    setActiveOption(options.length);
  };
  const removeOption = (oi) => {
    if (options.length <= 2) { toast.error('Minimum 2 options'); return; }
    setOptions(o => o.filter((_, i) => i !== oi));
    setActiveOption(prev => Math.max(0, prev >= oi ? prev - 1 : prev));
  };

  const total       = form.charges.reduce((sum, c) => sum + parseFloat(c.amount    || 0), 0);
  const totalBuying = form.charges.reduce((sum, c) => {
    const qty  = parseFloat(c.qty)        || 1;
    const rate = parseFloat(c.buyingRate) || 0;
    return sum + qty * rate;
  }, 0);
  const profit = total - totalBuying;
  const margin = total > 0 ? (profit / total) * 100 : 0;

  // ── Rate Finder ────────────────────────────────────────────────────────────
  const findRates = async () => {
    if (!form.origin && !form.destination) {
      toast.error('Enter Origin or Destination first');
      return;
    }
    setShowRatePicker(true);
    setRatePickerLoading(true);
    setSuggestedRates([]);
    try {
      const res = await api.get('/shipping-rates/suggest', {
        params: { pol: form.origin, pod: form.destination, serviceType: form.serviceType },
      });
      setSuggestedRates(res.data.data || []);
    } catch { toast.error('Could not fetch rates'); }
    finally { setRatePickerLoading(false); }
  };

  const toggleRate = (rateId, containerType) => {
    const key = `${rateId}:${containerType}`;
    setSelectedRates(prev => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  };

  const applySelectedRates = () => {
    if (!selectedRates.size) return;
    const rateMap = { '20DC': 'rate_20dc', '40DC': 'rate_40dc', '40HC': 'rate_40hc', 'LCL': 'rate_lcl' };
    const newCharges = [];
    let firstRate = null;

    for (const key of selectedRates) {
      const [rateId, containerType] = key.split(':');
      const rate = suggestedRates.find(r => r.id === rateId);
      if (!rate) continue;
      const amount = parseFloat(rate[rateMap[containerType]]);
      if (!amount) continue;
      if (!firstRate) firstRate = rate;
      newCharges.push({
        category:    'Freight',
        description: `Ocean Freight ${containerType} - ${rate.shipping_line}`,
        qty:         '1',
        unitRate:    String(amount),
        amount:      String(amount),
        currency:    rate.currency || 'USD',
        buyingRate:  '',
      });
    }

    if (!newCharges.length) return;

    setForm(f => {
      // Remove existing Freight charges, prepend new ones
      const existing = f.charges.filter(c => c.category !== 'Freight');
      return {
        ...f,
        carrier:     f.carrier     || firstRate?.shipping_line || '',
        transitTime: f.transitTime || firstRate?.transit_time  || '',
        freeDays:    f.freeDays    || (firstRate?.free_days != null ? String(firstRate.free_days) : ''),
        charges: [...newCharges, ...existing],
      };
    });

    setShowRatePicker(false);
    setSelectedRates(new Set());
    toast.success(`${newCharges.length} rate${newCharges.length !== 1 ? 's' : ''} applied`);
  };

  // ── Save & Submit ──────────────────────────────────────────────────────────
  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const payload = comparisonMode
        ? { ...form, options, charges: [] }
        : { ...form, options: null };
      if (id) {
        await api.put(`/quotations/${id}`, payload);
      } else {
        const res = await api.post('/quotations', payload);
        localStorage.removeItem(DRAFT_KEY);
        navigate(`/quotations/${res.data.data.id}/edit`);
        return;
      }
      localStorage.removeItem(DRAFT_KEY);
      navigate('/quotations');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Error saving quotation');
    } finally { setLoading(false); }
  };

  const submitForReview = async () => {
    if (!id) { toast.error('Save the quotation first, then submit for review.'); return; }
    setLoading(true);
    try {
      await api.patch(`/quotations/${id}/submit`);
      toast.success('Quotation submitted for manager review!');
      navigate('/quotations');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Error submitting');
    } finally { setLoading(false); }
  };

  const downloadPdf = async () => {
    try {
      const res = await api.get(`/quotations/${id}/pdf`, { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `quotation-${saved?.reference_no}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch { toast.error('Error generating PDF'); }
  };

  // Days remaining helper for rate picker
  const daysLeft = (dateStr) => {
    const diff = Math.ceil((new Date(dateStr) - new Date()) / 86400000);
    return diff;
  };

  return (
    <div>
      {/* Page header */}
      <div className="flex items-center gap-4 mb-6">
        <button onClick={() => navigate('/quotations')} className="btn-ghost">
          <ArrowLeftIcon className="w-4 h-4" />
        </button>
        <div className="flex-1">
          <h2 className="page-title">
            {id ? `Edit Quotation${saved ? ` — ${saved.reference_no}` : ''}` : 'New Quotation'}
          </h2>
        </div>
        <button type="button"
          onClick={() => setComparisonMode(m => !m)}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ${
            comparisonMode
              ? 'bg-indigo-600 border-indigo-600 text-white'
              : 'border-slate-300 dark:border-navy-600 text-slate-600 dark:text-gray-300 hover:border-indigo-500 hover:text-indigo-600'
          }`}>
          <TableCellsIcon className="w-4 h-4" />
          {comparisonMode ? 'Comparison ON' : 'Comparison'}
        </button>
        {id && saved && (
          <div className="flex gap-2 items-center">
            <Badge label={saved.status} type="status" />
            {comparisonMode && <Badge label="Comparison" type="info" />}
            {saved.status === 'Pending Review' && (
              <span className="text-xs text-orange-500 dark:text-orange-400 font-medium animate-pulse">⏳ Awaiting approval</span>
            )}
            <button className="btn-secondary" onClick={downloadPdf}>
              <DocumentArrowDownIcon className="w-4 h-4 inline mr-1.5" />Download PDF
            </button>
          </div>
        )}
      </div>

      {/* Review Notes — shown when manager returns quotation for revision */}
      {saved?.review_notes && (
        <div className="mb-5 flex gap-3 p-4 rounded-xl bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-700">
          <ExclamationTriangleIcon className="w-5 h-5 text-orange-500 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-orange-700 dark:text-orange-400 mb-1">
              Returned for Revision
            </p>
            <p className="text-sm text-orange-600 dark:text-orange-300">{saved.review_notes}</p>
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit}>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          {/* Left: Main details */}
          <div className="lg:col-span-2 space-y-5">
            <div className="card">
              <h3 className="section-title mb-4">Shipment Details</h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="form-group">
                  <label className="label">Client</label>
                  <ClientSelect
                    clients={clients}
                    value={form.clientId}
                    onChange={id => setForm({...form, clientId: id})}
                  />
                </div>
                <div className="form-group">
                  <label className="label">Service Type *</label>
                  <select className="select" required value={form.serviceType} onChange={e => setForm({...form, serviceType: e.target.value})}>
                    {SERVICE_TYPES.map(t => <option key={t}>{t}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label className="label">Direction</label>
                  <select className="select" value={form.direction} onChange={e => setForm({...form, direction: e.target.value})}>
                    {DIRECTIONS.map(d => <option key={d} value={d}>{d || '— Not set —'}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label className="label">Origin *</label>
                  <input className="input" required value={form.origin} onChange={e => setForm({...form, origin: e.target.value})} placeholder="e.g. Alexandria, Egypt" />
                </div>
                <div className="form-group">
                  <label className="label">Destination *</label>
                  <input className="input" required value={form.destination} onChange={e => setForm({...form, destination: e.target.value})} placeholder="e.g. Rotterdam, Netherlands" />
                </div>

                {/* Incoterms */}
                <div className="form-group">
                  <label className="label">Incoterms</label>
                  <select className="select" value={form.incoterms}
                    onChange={e => setForm({ ...form, incoterms: e.target.value, incotermOther: '', pickupLocation: '', deliveryLocation: '' })}>
                    {INCOTERMS.map(t => <option key={t} value={t}>{t || '— Select incoterms —'}</option>)}
                  </select>
                </div>

                {INCOTERMS_WITH_PICKUP.includes(form.incoterms) && (
                  <div className="form-group">
                    <label className="label">
                      Pickup Location
                      <span className="ml-1.5 text-xs font-normal text-slate-400 normal-case">
                        ({form.incoterms === 'Door to Door' ? 'origin address' : "seller's premises"})
                      </span>
                    </label>
                    <input className="input" placeholder="e.g. 12 Industrial Zone, Cairo"
                      value={form.pickupLocation} onChange={e => setForm({...form, pickupLocation: e.target.value})} />
                  </div>
                )}

                {INCOTERMS_WITH_DELIVERY.includes(form.incoterms) && (
                  <div className="form-group">
                    <label className="label">
                      Delivery Location
                      <span className="ml-1.5 text-xs font-normal text-slate-400 normal-case">
                        ({form.incoterms === 'Door to Door' ? "buyer's door address" : 'named destination place'})
                      </span>
                    </label>
                    <input className="input" placeholder="e.g. Buyer's warehouse, Rotterdam"
                      value={form.deliveryLocation} onChange={e => setForm({...form, deliveryLocation: e.target.value})} />
                  </div>
                )}

                {form.incoterms === 'Others' && (
                  <div className="form-group">
                    <label className="label">Specify Incoterms</label>
                    <input className="input" placeholder="e.g. CPT Hamburg"
                      value={form.incotermOther} onChange={e => setForm({...form, incotermOther: e.target.value})} />
                  </div>
                )}

                <div className="form-group">
                  <label className="label">Cargo Type</label>
                  {CARGO_TYPE_OPTIONS[form.serviceType] ? (
                    <select className="select" value={form.cargoType} onChange={e => setForm({...form, cargoType: e.target.value})}>
                      <option value="">— Select —</option>
                      {CARGO_TYPE_OPTIONS[form.serviceType].map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                  ) : (
                    <input className="input" value={form.cargoType} onChange={e => setForm({...form, cargoType: e.target.value})} placeholder="e.g. Full Truck Load" />
                  )}
                </div>
                <div className="form-group">
                  <label className="label">Currency</label>
                  <div className="flex gap-2">
                    <select className="select" value={form.currency} onChange={e => setForm({...form, currency: e.target.value})}>
                      {CURRENCIES.map(c => <option key={c}>{c}</option>)}
                    </select>
                    <button type="button" onClick={fetchRate} disabled={rateLoading}
                      className="btn-secondary px-2.5 flex-shrink-0" title="Fetch live USD/EGP rate">
                      <ArrowPathIcon className={`w-4 h-4 ${rateLoading ? 'animate-spin' : ''}`} />
                    </button>
                  </div>
                  {liveRate && (
                    <p className="text-xs text-gold-600 dark:text-gold-400 mt-1">
                      1 USD = {liveRate.rate.toFixed(2)} EGP{liveRate.eurRate ? ` | ${liveRate.eurRate.toFixed(4)} EUR` : ''}
                      {liveRate.source === 'stale' && ' (cached)'}
                    </p>
                  )}
                </div>

                <div className="form-group">
                  <label className="label">Weight (kg)</label>
                  <input className="input" type="number" value={form.weight} onChange={e => setForm({...form, weight: e.target.value})} />
                </div>
                <div className="form-group">
                  <label className="label">Volume (CBM)</label>
                  <input className="input" type="number" value={form.volume} onChange={e => setForm({...form, volume: e.target.value})} />
                </div>
                <div className="form-group">
                  <label className="label">Transit Time</label>
                  <input className="input" value={form.transitTime} onChange={e => setForm({...form, transitTime: e.target.value})} placeholder="e.g. 14-18 days" />
                </div>
                <div className="form-group">
                  <label className="label">Free Days</label>
                  <input className="input" type="number" value={form.freeDays} onChange={e => setForm({...form, freeDays: e.target.value})} />
                </div>

                <div className="form-group col-span-2">
                  <label className="label flex items-center gap-2">
                    Carrier *
                    {!form.carrier && (
                      <span className="text-orange-400 text-xs font-normal normal-case">⚠ Required — fill before sending</span>
                    )}
                  </label>
                  <div className="flex gap-3 items-start">
                    <input className="input flex-1" required value={form.carrier}
                      onChange={e => setForm({...form, carrier: e.target.value})}
                      placeholder="e.g. MSC, Maersk, Emirates SkyCargo, CMA CGM" />
                    <label className="flex items-center gap-2 mt-2.5 cursor-pointer select-none flex-shrink-0">
                      <input type="checkbox" className="w-4 h-4 accent-orange-500 cursor-pointer"
                        checked={form.showCarrierInPdf}
                        onChange={e => setForm({...form, showCarrierInPdf: e.target.checked})} />
                      <span className="text-xs text-slate-500 dark:text-gray-400 whitespace-nowrap">Show in PDF</span>
                    </label>
                  </div>
                </div>

                <div className="form-group">
                  <label className="label">Valid Until</label>
                  <input className="input" type="date" value={form.validUntil} onChange={e => setForm({...form, validUntil: e.target.value})} />
                </div>
                <div className="col-span-2 form-group">
                  <label className="label">Notes</label>
                  <textarea className="input" rows={2} value={form.notes} onChange={e => setForm({...form, notes: e.target.value})} />
                </div>
              </div>
            </div>

            {/* Charges — standard or comparison */}
            {!comparisonMode ? (
            <div className="card">
              <div className="flex justify-between items-center mb-4">
                <h3 className="section-title">Charges</h3>
                {(form.origin || form.destination) && (
                  <button type="button"
                    className="btn-secondary text-xs border-gold-500/40 text-gold-600 dark:text-gold-400 hover:bg-gold-500/10"
                    onClick={findRates}>
                    <SparklesIcon className="w-3.5 h-3.5 inline mr-1" />Find Rates
                  </button>
                )}
              </div>
              <ChargeList charges={form.charges} currency={form.currency}
                onChange={(idx, f, v) => setCharge(idx, f, v)}
                onAdd={addCharge} onRemove={removeCharge} />
            </div>
            ) : (
            <div className="card">
              {/* Option tabs */}
              <div className="flex items-center gap-1 mb-4 flex-wrap">
                {options.map((opt, i) => (
                  <button key={i} type="button"
                    onClick={() => setActiveOption(i)}
                    className={`px-3 py-1.5 rounded-lg text-sm font-semibold border-2 transition-colors ${
                      activeOption === i
                        ? 'text-white border-transparent'
                        : 'bg-transparent border-slate-200 dark:border-navy-600 text-slate-600 dark:text-gray-300 hover:border-slate-400'
                    }`}
                    style={activeOption === i ? { backgroundColor: OPTION_COLORS[i % OPTION_COLORS.length], borderColor: OPTION_COLORS[i % OPTION_COLORS.length] } : {}}>
                    {opt.label || `Option ${String.fromCharCode(65 + i)}`}
                  </button>
                ))}
                {options.length < 4 && (
                  <button type="button" onClick={addOption}
                    className="px-3 py-1.5 rounded-lg text-xs border-2 border-dashed border-slate-300 dark:border-navy-600 text-slate-500 dark:text-gray-400 hover:border-indigo-400 hover:text-indigo-500 transition-colors">
                    <PlusIcon className="w-3.5 h-3.5 inline" /> Add Option
                  </button>
                )}
                {options.length > 2 && (
                  <button type="button" onClick={() => removeOption(activeOption)}
                    className="ml-auto text-xs text-red-500 hover:text-red-400 px-2 py-1 rounded">
                    Remove {options[activeOption]?.label}
                  </button>
                )}
              </div>

              {/* Active option editor */}
              {options.map((opt, oi) => oi !== activeOption ? null : (
                <div key={oi}>
                  <div className="grid grid-cols-2 gap-3 mb-4">
                    <div>
                      <label className="label text-xs">Option Label</label>
                      <input className="input" value={opt.label}
                        onChange={e => setOptions(os => os.map((o, i) => i === oi ? { ...o, label: e.target.value } : o))} />
                    </div>
                    <div>
                      <label className="label text-xs">Shipping Line / Carrier</label>
                      <input className="input" placeholder="e.g. MSC, Maersk…" value={opt.carrier}
                        onChange={e => setOptions(os => os.map((o, i) => i === oi ? { ...o, carrier: e.target.value } : o))} />
                    </div>
                  </div>
                  <ChargeList charges={opt.charges} currency={form.currency}
                    onChange={(ci, f, v) => setOptionCharge(oi, ci, f, v)}
                    onAdd={() => addOptionCharge(oi)}
                    onRemove={(ci) => removeOptionCharge(oi, ci)} />
                  {/* Option total */}
                  <div className="mt-3 flex justify-end">
                    <div className="px-4 py-2 rounded-lg text-sm font-bold text-white"
                      style={{ backgroundColor: OPTION_COLORS[oi % OPTION_COLORS.length] }}>
                      {opt.label} Total: {form.currency} {opt.charges.reduce((s, c) => s + parseFloat(c.amount || 0), 0).toFixed(2)}
                    </div>
                  </div>
                </div>
              ))}

              {/* All-options mini summary */}
              {options.length > 1 && (
                <div className="mt-4 pt-3 border-t border-slate-100 dark:border-navy-700 grid gap-2"
                  style={{ gridTemplateColumns: `repeat(${options.length}, 1fr)` }}>
                  {options.map((opt, i) => (
                    <div key={i} className="text-center rounded-lg py-2"
                      style={{ backgroundColor: OPTION_COLORS[i % OPTION_COLORS.length] + '22', border: `1.5px solid ${OPTION_COLORS[i % OPTION_COLORS.length]}` }}>
                      <div className="text-xs font-semibold mb-0.5" style={{ color: OPTION_COLORS[i % OPTION_COLORS.length] }}>{opt.label}</div>
                      <div className="text-sm font-bold text-slate-800 dark:text-white">
                        {form.currency} {opt.charges.reduce((s, c) => s + parseFloat(c.amount || 0), 0).toFixed(2)}
                      </div>
                      {opt.carrier && <div className="text-xs text-slate-400 mt-0.5">{opt.carrier}</div>}
                    </div>
                  ))}
                </div>
              )}
            </div>
            )}
          </div>

          {/* Right: Summary + Actions */}
          <div className="space-y-5">
            <div className="card">
              <h3 className="section-title mb-4">Summary</h3>
              {comparisonMode ? (
                <div className="space-y-3">
                  {options.map((opt, i) => {
                    const optTotal = opt.charges.reduce((s, c) => s + parseFloat(c.amount || 0), 0);
                    return (
                      <div key={i} className="rounded-lg p-3" style={{ backgroundColor: OPTION_COLORS[i % OPTION_COLORS.length] + '18', border: `1.5px solid ${OPTION_COLORS[i % OPTION_COLORS.length]}` }}>
                        <div className="text-xs font-bold mb-1" style={{ color: OPTION_COLORS[i % OPTION_COLORS.length] }}>
                          {opt.label}{opt.carrier ? ` · ${opt.carrier}` : ''}
                        </div>
                        {opt.charges.filter(c => c.amount).map((c, j) => (
                          <div key={j} className="flex justify-between text-xs text-slate-600 dark:text-gray-400">
                            <span className="truncate">{c.description || c.category}</span>
                            <span className="ml-1 flex-shrink-0">{c.currency || form.currency} {parseFloat(c.amount).toFixed(2)}</span>
                          </div>
                        ))}
                        <div className="flex justify-between font-bold text-sm mt-1 pt-1 border-t border-current/20">
                          <span style={{ color: OPTION_COLORS[i % OPTION_COLORS.length] }}>Total</span>
                          <span style={{ color: OPTION_COLORS[i % OPTION_COLORS.length] }}>{form.currency} {optTotal.toFixed(2)}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
              <div className="space-y-2">
                {form.charges.filter(c => c.amount).map((c, i) => (
                  <div key={i} className="flex justify-between text-sm">
                    <span className="text-slate-500 dark:text-gray-400 truncate">{c.description || c.category}</span>
                    <span className="text-slate-900 dark:text-white font-medium ml-2 flex-shrink-0">
                      {c.currency} {parseFloat(c.amount).toFixed(2)}
                    </span>
                  </div>
                ))}
                {form.charges.filter(c => c.amount).length > 0 && <div className="divider" />}
                <div className="flex justify-between font-bold text-lg">
                  <span className="text-slate-800 dark:text-gray-200">Selling Total</span>
                  <span className="text-gold-400">{form.currency} {total.toFixed(2)}</span>
                </div>
                {totalBuying > 0 && (
                  <>
                    <div className="flex justify-between text-sm">
                      <span className="text-orange-400">Buying Total</span>
                      <span className="text-orange-400">{form.currency} {totalBuying.toFixed(2)}</span>
                    </div>
                    <div className="divider" />
                    <div className="flex justify-between font-bold">
                      <span className={profit >= 0 ? 'text-green-400' : 'text-red-400'}>Profit</span>
                      <span className={profit >= 0 ? 'text-green-400' : 'text-red-400'}>
                        {form.currency} {profit.toFixed(2)}
                      </span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-slate-500 dark:text-gray-500">Margin</span>
                      <span className={margin >= 0 ? 'text-green-400' : 'text-red-400'}>{margin.toFixed(1)}%</span>
                    </div>
                  </>
                )}
              </div>
              )}
            </div>

            <div className="flex flex-col gap-3">
              {/* Save button — always shown */}
              <button type="submit" className="btn-primary w-full py-3" disabled={loading}>
                {loading ? 'Saving…' : (id ? 'Save Changes' : 'Create Quotation')}
              </button>

              {/* Submit for Review — Sales Reps only, on saved Draft quotations */}
              {isSalesRep && id && saved?.status === 'Draft' && (
                <button type="button" disabled={loading}
                  className="w-full py-3 rounded-xl text-sm font-semibold border-2 border-gold-500 text-gold-600 dark:text-gold-400 hover:bg-gold-500/10 transition-colors"
                  onClick={submitForReview}>
                  🚀 Submit for Review
                </button>
              )}

              <button type="button" className="btn-secondary w-full" onClick={() => navigate('/quotations')}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      </form>

      {/* ── Rate Picker Modal ─────────────────────────────────────────────────── */}
      <Modal isOpen={showRatePicker} onClose={() => { setShowRatePicker(false); setSelectedRates(new Set()); }} title="Matching Shipping Rates" size="md">
        {ratePickerLoading ? (
          <div className="text-center py-10 text-slate-500 dark:text-gray-400">Searching rates…</div>
        ) : suggestedRates.length === 0 ? (
          <div className="text-center py-10">
            <SparklesIcon className="w-10 h-10 mx-auto text-slate-300 dark:text-navy-600 mb-3" />
            <p className="text-slate-600 dark:text-gray-400 font-medium">No active rates found</p>
            <p className="text-sm text-slate-400 dark:text-gray-500 mt-1">
              for {form.origin} → {form.destination}
            </p>
            <p className="text-xs text-slate-400 dark:text-gray-600 mt-3">
              Add rates in the <span className="text-gold-500">Shipping Rates</span> section
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-xs text-slate-500 dark:text-gray-400 mb-4">
              {suggestedRates.length} active rate{suggestedRates.length !== 1 ? 's' : ''} found —
              select one or more container types then click Apply
            </p>
            {suggestedRates.map(rate => {
              const days = daysLeft(rate.valid_to);
              return (
                <div key={rate.id}
                  className="border border-slate-200 dark:border-navy-700 rounded-xl p-4 hover:border-gold-500/50 transition-colors">
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <p className="font-semibold text-slate-900 dark:text-white">{rate.shipping_line}</p>
                      <p className="text-xs text-slate-500 dark:text-gray-400 mt-0.5">
                        {rate.pol} → {rate.pod}
                        {rate.transit_time ? ` · ${rate.transit_time}` : ''}
                        {rate.free_days    ? ` · ${rate.free_days}d free` : ''}
                      </p>
                    </div>
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                      days <= 7
                        ? 'bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400'
                        : 'bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400'
                    }`}>
                      {days}d left
                    </span>
                  </div>

                  <div className="flex flex-wrap gap-2 mt-3">
                    {[['20DC','rate_20dc'],['40DC','rate_40dc'],['40HC','rate_40hc'],['LCL','rate_lcl']].map(([ct, field]) => {
                      if (rate[field] == null) return null;
                      const key = `${rate.id}:${ct}`;
                      const active = selectedRates.has(key);
                      return (
                        <button key={ct} type="button" onClick={() => toggleRate(rate.id, ct)}
                          className={`flex-1 text-xs px-3 py-2 rounded-lg border-2 transition-colors font-medium ${
                            active
                              ? 'bg-gold-500 border-gold-500 text-navy-950'
                              : 'bg-slate-100 dark:bg-navy-700 border-transparent text-slate-700 dark:text-gray-300 hover:border-gold-400'
                          }`}>
                          {ct === 'LCL' ? 'LCL/CBM' : ct}<br />
                          <span className="font-bold">{rate.currency} {parseFloat(rate[field]).toLocaleString()}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}

            <div className="pt-3 border-t border-slate-200 dark:border-navy-700 flex items-center justify-between">
              <span className="text-xs text-slate-500 dark:text-gray-400">
                {selectedRates.size > 0 ? `${selectedRates.size} rate${selectedRates.size !== 1 ? 's' : ''} selected` : 'None selected'}
              </span>
              <button type="button" onClick={applySelectedRates} disabled={!selectedRates.size}
                className="px-4 py-2 bg-gold-500 hover:bg-gold-600 disabled:opacity-40 disabled:cursor-not-allowed text-navy-950 font-semibold text-sm rounded-xl transition-colors">
                Apply Selected
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
