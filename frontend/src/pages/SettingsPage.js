import React, { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import api from '../services/api';
import { useAuth } from '../store/AuthContext';
import {
  BuildingOffice2Icon, DocumentTextIcon, BanknotesIcon, ClockIcon, CheckIcon,
  EnvelopeIcon,
} from '@heroicons/react/24/outline';

const CURRENCIES = ['USD', 'EUR', 'EGP'];

function Section({ icon: Icon, title, desc, children }) {
  return (
    <div className="card">
      <div className="flex items-start gap-3 mb-4">
        <div className="w-10 h-10 rounded-xl bg-gold-500/15 flex items-center justify-center flex-shrink-0">
          <Icon className="w-5 h-5 text-gold-500" />
        </div>
        <div>
          <h3 className="section-title">{title}</h3>
          {desc && <p className="text-xs text-slate-500 dark:text-gray-400 mt-0.5">{desc}</p>}
        </div>
      </div>
      {children}
    </div>
  );
}

function Field({ label, value, onChange, type = 'text', placeholder, ...rest }) {
  return (
    <div className="form-group">
      <label className="label">{label}</label>
      <input className="input" type={type} value={value ?? ''} placeholder={placeholder}
        onChange={e => onChange(e.target.value)} {...rest} />
    </div>
  );
}

export default function SettingsPage() {
  const { settings: ctxSettings, refreshSettings, user, login } = useAuth();
  const [s, setS] = useState(ctxSettings);
  const [loading, setLoading] = useState(!ctxSettings);
  const [saving, setSaving] = useState(false);

  // Per-user signature fields
  const [sigSalutation, setSigSalutation] = useState(user?.salutation || '');
  const [sigJobTitle, setSigJobTitle] = useState(user?.jobTitle || '');
  const [sigPhone, setSigPhone] = useState(user?.phone || '');
  const [sigPhone2, setSigPhone2] = useState(user?.phone2 || '');
  const [sigPhone3, setSigPhone3] = useState(user?.phone3 || '');
  const [savingSig, setSavingSig] = useState(false);

  const saveSignature = async () => {
    setSavingSig(true);
    try {
      await api.patch('/auth/profile', {
        salutation: sigSalutation,
        jobTitle: sigJobTitle,
        phone: sigPhone,
        phone2: sigPhone2,
        phone3: sigPhone3,
      });
      if (user) {
        user.salutation = sigSalutation;
        user.jobTitle = sigJobTitle;
        user.phone = sigPhone;
        user.phone2 = sigPhone2;
        user.phone3 = sigPhone3;
      }
      toast.success('Signature saved');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to save signature');
    } finally { setSavingSig(false); }
  };

  useEffect(() => {
    if (ctxSettings) { setS(ctxSettings); setLoading(false); return; }
    api.get('/settings').then(r => setS(r.data.data)).catch(() => {}).finally(() => setLoading(false));
  }, [ctxSettings]);

  if (loading || !s) return <div className="text-center py-16 text-slate-500 dark:text-gray-500">Loading…</div>;

  // Immutable nested setters
  const setCompany = (k, v) => setS(p => ({ ...p, company: { ...p.company, [k]: v } }));
  const setBank    = (k, v) => setS(p => ({ ...p, pdf: { ...p.pdf, bank: { ...p.pdf?.bank, [k]: v } } }));
  const setPdf     = (k, v) => setS(p => ({ ...p, pdf: { ...p.pdf, [k]: v } }));
  const setSession = (k, v) => setS(p => ({ ...p, session: { ...p.session, [k]: v } }));

  const save = async () => {
    setSaving(true);
    try {
      await api.put('/settings', s);
      await refreshSettings();
      toast.success('Settings saved');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to save settings');
    } finally { setSaving(false); }
  };

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="page-header">
        <div>
          <h2 className="page-title">Settings</h2>
          <p className="text-slate-500 dark:text-gray-400 text-sm">Company info, PDF defaults, currency and session policy</p>
        </div>
        <button className="btn-primary flex items-center gap-2" onClick={save} disabled={saving}>
          <CheckIcon className="w-4 h-4" />{saving ? 'Saving…' : 'Save Changes'}
        </button>
      </div>

      {/* Company info */}
      <Section icon={BuildingOffice2Icon} title="Company Information" desc="Shown in the header of quotation & invoice PDFs">
        <div className="grid grid-cols-2 gap-4">
          <Field label="Company Name" value={s.company?.name} onChange={v => setCompany('name', v)} />
          <Field label="Tagline" value={s.company?.tagline} onChange={v => setCompany('tagline', v)} />
          <div className="col-span-2">
            <Field label="Address" value={s.company?.address} onChange={v => setCompany('address', v)} />
          </div>
          <Field label="Email(s)" value={s.company?.email} onChange={v => setCompany('email', v)} />
          <Field label="Phone(s)" value={s.company?.phone} onChange={v => setCompany('phone', v)} />
        </div>
      </Section>

      {/* Defaults */}
      <Section icon={DocumentTextIcon} title="Document Defaults">
        <div className="grid grid-cols-2 gap-4">
          <div className="form-group">
            <label className="label">Default Currency</label>
            <select className="select" value={s.defaultCurrency || 'USD'}
              onChange={e => setS(p => ({ ...p, defaultCurrency: e.target.value }))}>
              {CURRENCIES.map(c => <option key={c}>{c}</option>)}
            </select>
            <p className="text-xs text-slate-400 dark:text-gray-600 mt-1">Pre-selected when creating quotations & invoices.</p>
          </div>
          <div className="col-span-2 form-group">
            <label className="label">Invoice Footer Disclaimer</label>
            <textarea className="input resize-none" rows={2} value={s.pdf?.footerDisclaimer || ''}
              onChange={e => setPdf('footerDisclaimer', e.target.value)} />
          </div>
        </div>
      </Section>

      {/* My Signature */}
      <Section icon={EnvelopeIcon} title="My Email Signature" desc="Shown at the bottom of every email you send from the Emails page">
        <div className="grid grid-cols-2 gap-4">
          <div className="form-group">
            <label className="label">Salutation</label>
            <select className="select" value={sigSalutation} onChange={e => setSigSalutation(e.target.value)}>
              <option value="">None</option>
              <option>Mr.</option>
              <option>Mrs.</option>
              <option>Ms.</option>
              <option>Dr.</option>
              <option>Eng.</option>
            </select>
          </div>
          <Field label="Job Title" value={sigJobTitle} onChange={setSigJobTitle} placeholder="e.g. Deputy General Manager" />
          <Field label="Phone 1" value={sigPhone} onChange={setSigPhone} placeholder="+20 (0)111 743 5782" />
          <Field label="Phone 2" value={sigPhone2} onChange={setSigPhone2} placeholder="+20 (0)348 00 148" />
          <Field label="Phone 3 (optional)" value={sigPhone3} onChange={setSigPhone3} placeholder="+20 (0)348 73 820" />
        </div>
        {/* Live preview */}
        <div className="mt-4 border border-slate-200 dark:border-navy-600 rounded-xl p-4 bg-slate-50 dark:bg-navy-900">
          <p className="text-xs font-medium text-slate-400 dark:text-gray-500 mb-3 uppercase tracking-wide">Preview</p>
          <div className="flex items-start gap-3">
            <div className="w-16 h-16 flex-shrink-0 rounded bg-white dark:bg-navy-800 border border-slate-200 dark:border-navy-700 flex items-center justify-center overflow-hidden">
              <img src="/logo.svg" alt="SG" className="w-14 h-14 object-contain" onError={e => { e.target.style.display='none'; }} />
            </div>
            <div className="border-l-2 border-gold-500 pl-3 text-xs">
              <div className="text-sm font-bold text-slate-900 dark:text-white">{sigSalutation ? `${sigSalutation} ` : ''}{user?.fullName || 'Your Name'}</div>
              {sigJobTitle && <div className="text-slate-500 dark:text-gray-400 mb-0.5">{sigJobTitle}</div>}
              <div className="text-slate-400 dark:text-gray-500 tracking-wide uppercase mb-1">ABC Logistics &nbsp;·&nbsp; Shipping &amp; Logistics</div>
              <div className="border-t border-slate-200 dark:border-navy-600 pt-1.5 space-y-0.5">
                {s?.company?.address && <div className="text-slate-500 dark:text-gray-400">{s.company.address}</div>}
                {[sigPhone, sigPhone2, sigPhone3].filter(Boolean).length > 0 && (
                  <div className="text-slate-500 dark:text-gray-400">{[sigPhone, sigPhone2, sigPhone3].filter(Boolean).join('  ·  ')}</div>
                )}
                <div className="flex flex-wrap gap-x-2">
                  <span className="text-gold-600 dark:text-gold-400">{user?.email}</span>
                  <span>·</span>
                  <span className="text-gold-600 dark:text-gold-400">www.abclogistics.com</span>
                </div>
              </div>
            </div>
          </div>
          <div className="mt-3">
            <img src="" alt="Partner Logos" style={{ maxWidth: 380 }} />
          </div>
        </div>
        <div className="flex justify-end mt-4">
          <button className="btn-primary flex items-center gap-2" onClick={saveSignature} disabled={savingSig}>
            <CheckIcon className="w-4 h-4" />{savingSig ? 'Saving…' : 'Save Signature'}
          </button>
        </div>
      </Section>

      {/* Session */}
      <Section icon={ClockIcon} title="Session Policy" desc="Auto-logout for inactive users">
        <div className="grid grid-cols-2 gap-4">
          <Field label="Warning after (minutes)" type="number" min="1" max="600"
            value={s.session?.warningMinutes} onChange={v => setSession('warningMinutes', parseInt(v) || 0)} />
          <Field label="Logout after (minutes)" type="number" min="2" max="600"
            value={s.session?.timeoutMinutes} onChange={v => setSession('timeoutMinutes', parseInt(v) || 0)} />
        </div>
        <p className="text-xs text-slate-400 dark:text-gray-600 mt-1">
          The warning must be less than the logout time. Applies on each user's next page load.
        </p>
      </Section>

      <div className="flex justify-end">
        <button className="btn-primary flex items-center gap-2" onClick={save} disabled={saving}>
          <CheckIcon className="w-4 h-4" />{saving ? 'Saving…' : 'Save Changes'}
        </button>
      </div>
    </div>
  );
}
