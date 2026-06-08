import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import api from '../services/api';
import { ArrowPathIcon, CalculatorIcon, DocumentPlusIcon, PlusIcon, TrashIcon, ArrowRightIcon } from '@heroicons/react/24/outline';

const MODES = ['Sea Freight FCL', 'Sea Freight LCL', 'Air Freight', 'Inland Trucking'];

const DEFAULT_RATES = {
  'Sea Freight FCL': { per20ft: 1200, per40ft: 1800 },
  'Sea Freight LCL': { perCbm: 85, minCbm: 1 },
  'Air Freight': { perKg: 6.5, volumeDivisor: 6000 },
  'Inland Trucking': { perKm: 2.5, baseFee: 150 },
};

const UNITS = { cm: 1000000, m: 1, mm: 1000000000, inch: 61023.7 };
const UNIT_LABELS = ['cm', 'm', 'mm', 'inch'];

function formatCurrency(amount, currency) {
  const sym = currency === 'USD' ? '$' : currency === 'EUR' ? '€' : 'EGP ';
  return `${sym}${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

const emptyCbmRow = () => ({ l: '', w: '', h: '', qty: '1', weight: '', weightUnit: 'kg' });

function CbmCalculator({ onUse }) {
  const [unit, setUnit] = useState('cm');
  const [rows, setRows] = useState([emptyCbmRow()]);

  const setRow = (i, field, val) => {
    const next = [...rows];
    next[i] = { ...next[i], [field]: val };
    setRows(next);
  };

  const divisor = UNITS[unit];

  const rowCbm = (row) => {
    const l = parseFloat(row.l) || 0;
    const w = parseFloat(row.w) || 0;
    const h = parseFloat(row.h) || 0;
    const qty = parseFloat(row.qty) || 1;
    return (l * w * h * qty) / divisor;
  };

  const rowWeightKg = (row) => {
    const w = parseFloat(row.weight) || 0;
    const qty = parseFloat(row.qty) || 1;
    return row.weightUnit === 'lbs' ? w * qty * 0.453592 : w * qty;
  };

  const totalCbm = rows.reduce((sum, r) => sum + rowCbm(r), 0);
  const totalWeightKg = rows.reduce((sum, r) => sum + rowWeightKg(r), 0);

  return (
    <div className="card">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-slate-900 dark:text-white">CBM Calculator</h3>
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-500 dark:text-gray-400">Unit:</span>
          <div className="flex bg-slate-100 dark:bg-navy-800 rounded-md p-0.5">
            {UNIT_LABELS.map(u => (
              <button
                key={u}
                onClick={() => setUnit(u)}
                className={`px-2 py-0.5 rounded text-xs font-medium transition-all ${
                  unit === u
                    ? 'bg-white dark:bg-navy-600 text-slate-900 dark:text-white shadow-sm'
                    : 'text-slate-500 dark:text-gray-400 hover:text-slate-700 dark:hover:text-gray-200'
                }`}
              >
                {u}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="space-y-3">
        {rows.map((row, i) => {
          const cbm = rowCbm(row);
          const wKg = rowWeightKg(row);
          return (
            <div key={i} className="bg-slate-50 dark:bg-navy-800/50 rounded-lg p-2 space-y-1.5">
              {/* Row 1: L W H + delete */}
              <div className="grid grid-cols-12 gap-1.5 items-center">
                <div className="col-span-1 text-xs text-slate-400 dark:text-gray-500">L</div>
                <div className="col-span-3">
                  <input className="input text-xs py-1.5" type="number" min="0" step="any"
                    placeholder={`0 ${unit}`} value={row.l} onChange={e => setRow(i, 'l', e.target.value)} />
                </div>
                <div className="col-span-1 text-xs text-slate-400 dark:text-gray-500 text-center">W</div>
                <div className="col-span-3">
                  <input className="input text-xs py-1.5" type="number" min="0" step="any"
                    placeholder={`0 ${unit}`} value={row.w} onChange={e => setRow(i, 'w', e.target.value)} />
                </div>
                <div className="col-span-1 text-xs text-slate-400 dark:text-gray-500 text-center">H</div>
                <div className="col-span-2">
                  <input className="input text-xs py-1.5" type="number" min="0" step="any"
                    placeholder={`0 ${unit}`} value={row.h} onChange={e => setRow(i, 'h', e.target.value)} />
                </div>
                <div className="col-span-1 flex justify-end">
                  {rows.length > 1 && (
                    <button onClick={() => setRows(rows.filter((_, idx) => idx !== i))}
                      className="text-slate-400 dark:text-gray-500 hover:text-red-500 p-0.5">
                      <TrashIcon className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>

              {/* Row 2: Weight + Unit + Qty */}
              <div className="grid grid-cols-12 gap-1.5 items-center">
                <div className="col-span-1 text-xs text-slate-400 dark:text-gray-500">Wt</div>
                <div className="col-span-3">
                  <input className="input text-xs py-1.5" type="number" min="0" step="any"
                    placeholder="0" value={row.weight} onChange={e => setRow(i, 'weight', e.target.value)} />
                </div>
                <div className="col-span-2">
                  <select className="select text-xs py-1.5" value={row.weightUnit}
                    onChange={e => setRow(i, 'weightUnit', e.target.value)}>
                    <option value="kg">kg</option>
                    <option value="lbs">lbs</option>
                  </select>
                </div>
                <div className="col-span-1 text-xs text-slate-400 dark:text-gray-500 text-center">Qty</div>
                <div className="col-span-3">
                  <input className="input text-xs py-1.5" type="number" min="1" step="1"
                    placeholder="1" value={row.qty} onChange={e => setRow(i, 'qty', e.target.value)} />
                </div>
                <div className="col-span-2" />
              </div>

              {/* Per-row subtotals */}
              {(cbm > 0 || wKg > 0) && (
                <div className="flex justify-end gap-3 text-xs text-slate-400 dark:text-gray-500 pr-1">
                  {cbm > 0 && <span>{cbm.toFixed(4)} CBM</span>}
                  {wKg > 0 && <span>{wKg.toFixed(2)} kg</span>}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <button
        onClick={() => setRows([...rows, emptyCbmRow()])}
        className="mt-2 text-xs text-slate-500 dark:text-gray-400 hover:text-gold-600 dark:hover:text-gold-400 flex items-center gap-1 transition-colors"
      >
        <PlusIcon className="w-3.5 h-3.5" /> Add item
      </button>

      <div className="mt-3 pt-3 border-t border-slate-200 dark:border-navy-700 flex items-center justify-between">
        <div className="flex gap-6">
          <div>
            <span className="text-xs text-slate-500 dark:text-gray-400">Total CBM</span>
            <div className="text-xl font-bold text-slate-900 dark:text-white">
              {totalCbm.toFixed(4)}
              <span className="text-sm font-normal text-slate-400 dark:text-gray-500 ml-1">m³</span>
            </div>
          </div>
          {totalWeightKg > 0 && (
            <div>
              <span className="text-xs text-slate-500 dark:text-gray-400">Total Weight</span>
              <div className="text-xl font-bold text-slate-900 dark:text-white">
                {totalWeightKg.toFixed(2)}
                <span className="text-sm font-normal text-slate-400 dark:text-gray-500 ml-1">kg</span>
              </div>
            </div>
          )}
        </div>
        <button
          onClick={() => {
            if (totalCbm <= 0) return toast.error('Enter at least one dimension');
            onUse(parseFloat(totalCbm.toFixed(4)), totalWeightKg > 0 ? parseFloat(totalWeightKg.toFixed(2)) : null);
            toast.success(`${totalCbm.toFixed(4)} CBM${totalWeightKg > 0 ? ` · ${totalWeightKg.toFixed(2)} kg` : ''} applied`);
          }}
          className="btn-primary flex items-center gap-1.5 text-xs py-2"
        >
          Use this CBM <ArrowRightIcon className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}

export default function FreightCalculatorPage() {
  const navigate = useNavigate();

  const [mode, setMode] = useState('Sea Freight FCL');
  const [origin, setOrigin] = useState('');
  const [destination, setDestination] = useState('');
  const [weight, setWeight] = useState('');
  const [volume, setVolume] = useState('');
  const [containers20, setContainers20] = useState(1);
  const [containers40, setContainers40] = useState(0);
  const [distance, setDistance] = useState('');
  const [currency, setCurrency] = useState('USD');
  const [liveRate, setLiveRate] = useState(null);
  const [rateLoading, setRateLoading] = useState(false);
  const [rates, setRates] = useState({ ...DEFAULT_RATES });
  const [result, setResult] = useState(null);

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

  const calculate = () => {
    const r = rates[mode];
    let subtotal = 0;
    let breakdown = [];

    if (mode === 'Sea Freight FCL') {
      const c20 = parseInt(containers20) || 0;
      const c40 = parseInt(containers40) || 0;
      if (!c20 && !c40) return toast.error('Enter at least one container');
      const cost20 = c20 * r.per20ft;
      const cost40 = c40 * r.per40ft;
      subtotal = cost20 + cost40;
      if (c20) breakdown.push(`${c20} x 20ft @ ${formatCurrency(r.per20ft, 'USD')} = ${formatCurrency(cost20, 'USD')}`);
      if (c40) breakdown.push(`${c40} x 40ft @ ${formatCurrency(r.per40ft, 'USD')} = ${formatCurrency(cost40, 'USD')}`);
    } else if (mode === 'Sea Freight LCL') {
      const cbm = Math.max(parseFloat(volume) || 0, r.minCbm);
      if (!cbm) return toast.error('Enter volume (CBM)');
      subtotal = cbm * r.perCbm;
      breakdown.push(`${cbm} CBM x ${formatCurrency(r.perCbm, 'USD')}/CBM = ${formatCurrency(subtotal, 'USD')}`);
    } else if (mode === 'Air Freight') {
      const kg = parseFloat(weight) || 0;
      const cbm = parseFloat(volume) || 0;
      if (!kg && !cbm) return toast.error('Enter weight or volume');
      const volWeight = cbm > 0 ? (cbm * 1000000) / r.volumeDivisor : 0;
      const chargeableKg = Math.max(kg, volWeight);
      subtotal = chargeableKg * r.perKg;
      breakdown.push(`Actual weight: ${kg} kg`);
      if (cbm) breakdown.push(`Volume weight: ${volWeight.toFixed(1)} kg`);
      breakdown.push(`Chargeable: ${chargeableKg.toFixed(1)} kg x ${formatCurrency(r.perKg, 'USD')}/kg = ${formatCurrency(subtotal, 'USD')}`);
    } else if (mode === 'Inland Trucking') {
      const km = parseFloat(distance) || 0;
      if (!km) return toast.error('Enter distance (km)');
      subtotal = r.baseFee + km * r.perKm;
      breakdown.push(`Base fee: ${formatCurrency(r.baseFee, 'USD')}`);
      breakdown.push(`${km} km x ${formatCurrency(r.perKm, 'USD')}/km = ${formatCurrency(km * r.perKm, 'USD')}`);
    }

    let displayAmount = subtotal;
    let displayCurrency = 'USD';
    if (currency === 'EGP' && liveRate) {
      displayAmount = subtotal * liveRate.rate;
      displayCurrency = 'EGP';
    } else if (currency === 'EUR' && liveRate?.eurRate) {
      displayAmount = subtotal * liveRate.eurRate;
      displayCurrency = 'EUR';
    }

    setResult({ subtotal, displayAmount, displayCurrency, breakdown, mode, origin, destination });
  };

  const createQuotation = () => {
    const params = new URLSearchParams();
    if (origin) params.set('origin', origin);
    if (destination) params.set('destination', destination);
    params.set('shipmentType', mode);
    if (weight) params.set('weight', weight);
    if (volume) params.set('volume', volume);
    navigate(`/quotations/new?${params.toString()}`);
  };

  const r = rates[mode];

  return (
    <div className="max-w-4xl">
      <div className="page-header">
        <div>
          <h2 className="page-title flex items-center gap-2">
            <CalculatorIcon className="w-6 h-6" /> Freight Rate Calculator
          </h2>
          <p className="text-slate-500 dark:text-gray-400 text-sm">Quick estimate before creating a quotation</p>
        </div>
        <div className="flex items-center gap-2">
          <select className="select w-24" value={currency} onChange={e => setCurrency(e.target.value)}>
            <option value="USD">USD</option>
            <option value="EGP">EGP</option>
            <option value="EUR">EUR</option>
          </select>
          {(currency === 'EGP' || currency === 'EUR') && (
            <button className="btn-secondary flex items-center gap-1" onClick={fetchRate} disabled={rateLoading}>
              <ArrowPathIcon className={`w-4 h-4 ${rateLoading ? 'animate-spin' : ''}`} />
              {liveRate
                ? currency === 'EGP'
                  ? `1 USD = ${liveRate.rate.toFixed(2)} EGP`
                  : `1 USD = ${liveRate.eurRate?.toFixed(4)} EUR`
                : 'Get Rate'}
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left column: shipment details + rates + calculate */}
        <div className="space-y-4">
          <div className="card">
            <h3 className="text-sm font-semibold text-slate-900 dark:text-white mb-4">Shipment Details</h3>
            <div className="form-group">
              <label className="label">Service Type</label>
              <div className="grid grid-cols-2 gap-2">
                {MODES.map(m => (
                  <button
                    key={m}
                    onClick={() => { setMode(m); setResult(null); }}
                    className={`px-3 py-2 rounded-lg text-xs font-medium transition-all border ${mode === m ? 'bg-gold-500 text-navy-950 border-gold-500' : 'bg-white dark:bg-navy-800 text-slate-600 dark:text-gray-300 border-slate-200 dark:border-navy-600 hover:border-gold-500'}`}
                  >
                    {m}
                  </button>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3 mt-3">
              <div className="form-group">
                <label className="label">Origin</label>
                <input className="input" placeholder="e.g. Alexandria" value={origin} onChange={e => setOrigin(e.target.value)} />
              </div>
              <div className="form-group">
                <label className="label">Destination</label>
                <input className="input" placeholder="e.g. Rotterdam" value={destination} onChange={e => setDestination(e.target.value)} />
              </div>
            </div>
            {mode === 'Sea Freight FCL' && (
              <div className="grid grid-cols-2 gap-3 mt-3">
                <div className="form-group">
                  <label className="label">20ft Containers</label>
                  <input className="input" type="number" min="0" value={containers20} onChange={e => setContainers20(e.target.value)} />
                </div>
                <div className="form-group">
                  <label className="label">40ft Containers</label>
                  <input className="input" type="number" min="0" value={containers40} onChange={e => setContainers40(e.target.value)} />
                </div>
              </div>
            )}
            {(mode === 'Sea Freight LCL' || mode === 'Air Freight') && (
              <div className="grid grid-cols-2 gap-3 mt-3">
                <div className="form-group">
                  <label className="label">Weight (kg)</label>
                  <input className="input" type="number" min="0" step="0.1" value={weight} onChange={e => setWeight(e.target.value)} />
                </div>
                <div className="form-group">
                  <label className="label">Volume (CBM)</label>
                  <input className="input" type="number" min="0" step="0.001" value={volume} onChange={e => setVolume(e.target.value)} placeholder="or use CBM calc →" />
                </div>
              </div>
            )}
            {mode === 'Inland Trucking' && (
              <div className="grid grid-cols-2 gap-3 mt-3">
                <div className="form-group">
                  <label className="label">Distance (km)</label>
                  <input className="input" type="number" min="0" value={distance} onChange={e => setDistance(e.target.value)} />
                </div>
                <div className="form-group">
                  <label className="label">Weight (kg)</label>
                  <input className="input" type="number" min="0" value={weight} onChange={e => setWeight(e.target.value)} />
                </div>
              </div>
            )}
          </div>

          <div className="card">
            <h3 className="text-sm font-semibold text-slate-900 dark:text-white mb-3">Rates (USD)</h3>
            <div className="grid grid-cols-2 gap-3">
              {mode === 'Sea Freight FCL' && (<>
                <div className="form-group">
                  <label className="label">Rate per 20ft ($)</label>
                  <input className="input" type="number" value={r.per20ft} onChange={e => setRates({ ...rates, [mode]: { ...r, per20ft: parseFloat(e.target.value) || 0 } })} />
                </div>
                <div className="form-group">
                  <label className="label">Rate per 40ft ($)</label>
                  <input className="input" type="number" value={r.per40ft} onChange={e => setRates({ ...rates, [mode]: { ...r, per40ft: parseFloat(e.target.value) || 0 } })} />
                </div>
              </>)}
              {mode === 'Sea Freight LCL' && (
                <div className="form-group">
                  <label className="label">Rate per CBM ($)</label>
                  <input className="input" type="number" value={r.perCbm} onChange={e => setRates({ ...rates, [mode]: { ...r, perCbm: parseFloat(e.target.value) || 0 } })} />
                </div>
              )}
              {mode === 'Air Freight' && (<>
                <div className="form-group">
                  <label className="label">Rate per kg ($)</label>
                  <input className="input" type="number" step="0.01" value={r.perKg} onChange={e => setRates({ ...rates, [mode]: { ...r, perKg: parseFloat(e.target.value) || 0 } })} />
                </div>
                <div className="form-group">
                  <label className="label">Volume divisor</label>
                  <input className="input" type="number" value={r.volumeDivisor} onChange={e => setRates({ ...rates, [mode]: { ...r, volumeDivisor: parseFloat(e.target.value) || 6000 } })} />
                </div>
              </>)}
              {mode === 'Inland Trucking' && (<>
                <div className="form-group">
                  <label className="label">Rate per km ($)</label>
                  <input className="input" type="number" step="0.01" value={r.perKm} onChange={e => setRates({ ...rates, [mode]: { ...r, perKm: parseFloat(e.target.value) || 0 } })} />
                </div>
                <div className="form-group">
                  <label className="label">Base fee ($)</label>
                  <input className="input" type="number" value={r.baseFee} onChange={e => setRates({ ...rates, [mode]: { ...r, baseFee: parseFloat(e.target.value) || 0 } })} />
                </div>
              </>)}
            </div>
          </div>

          <button className="btn-primary w-full py-3 text-base" onClick={calculate}>
            Calculate
          </button>
        </div>

        {/* Right column: CBM calculator + result */}
        <div className="space-y-4">
          <CbmCalculator onUse={(cbm) => setVolume(String(cbm))} />

          {result ? (
            <div className="card">
              <h3 className="text-sm font-semibold text-slate-900 dark:text-white mb-4">Estimate Result</h3>
              {(result.origin || result.destination) && (
                <div className="text-sm text-slate-500 dark:text-gray-400 mb-3">
                  {result.origin && result.destination ? `${result.origin} to ${result.destination}` : result.origin || result.destination}
                  <span className="ml-2 text-xs bg-slate-100 dark:bg-navy-800 px-2 py-0.5 rounded">{result.mode}</span>
                </div>
              )}
              <div className="space-y-2 mb-4">
                {result.breakdown.map((line, i) => (
                  <div key={i} className="text-sm text-slate-600 dark:text-gray-300 flex items-start gap-2">
                    <span className="text-slate-300 dark:text-gray-600 mt-0.5">-</span>
                    <span>{line}</span>
                  </div>
                ))}
              </div>
              <div className="border-t border-slate-200 dark:border-navy-700 pt-4">
                <div className="flex items-baseline justify-between">
                  <span className="text-slate-500 dark:text-gray-400 text-sm">Estimated Total</span>
                  <span className="text-2xl font-bold text-gold-500">
                    {formatCurrency(result.displayAmount, result.displayCurrency)}
                  </span>
                </div>
                {(result.displayCurrency === 'EGP' || result.displayCurrency === 'EUR') && (
                  <div className="text-xs text-slate-400 dark:text-gray-600 text-right mt-1">
                    = {formatCurrency(result.subtotal, 'USD')} at live rate
                  </div>
                )}
              </div>
              <div className="mt-4 p-3 bg-slate-50 dark:bg-navy-800 rounded-lg text-xs text-slate-500 dark:text-gray-500">
                Estimate only. Actual rates may vary based on carrier, fuel surcharges, and other fees.
              </div>
              <button className="btn-primary w-full mt-4 flex items-center justify-center gap-2" onClick={createQuotation}>
                <DocumentPlusIcon className="w-4 h-4" />
                Create Quotation from This Estimate
              </button>
            </div>
          ) : (
            <div className="card flex flex-col items-center justify-center py-10 text-center">
              <CalculatorIcon className="w-10 h-10 text-slate-300 dark:text-navy-600 mb-3" />
              <p className="text-slate-500 dark:text-gray-400 text-sm">Fill in the details and click Calculate</p>
              <p className="text-slate-400 dark:text-gray-600 text-xs mt-1">Your estimate will appear here</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
