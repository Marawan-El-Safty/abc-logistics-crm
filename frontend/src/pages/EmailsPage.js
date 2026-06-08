import React, { useState, useEffect, useCallback } from 'react';
import toast from 'react-hot-toast';
import api from '../services/api';
import { useAuth } from '../store/AuthContext';
import {
  EnvelopeIcon, MagnifyingGlassIcon, PaperAirplaneIcon,
  ClockIcon, CheckCircleIcon, XCircleIcon, FunnelIcon,
  ChevronDownIcon, ChevronUpIcon, EyeIcon, XMarkIcon,
} from '@heroicons/react/24/outline';

const LOGOS_URL = '';

function SignatureBlock({ user, settings }) {
  const salutation = user?.salutation ? `${user.salutation} ` : '';
  const name = user?.fullName || 'Your Name';
  const phones = [user?.phone, user?.phone2, user?.phone3].filter(Boolean);
  const address = settings?.company?.address || '6 Abdel Fattah Yahya St. - Ramel Station, Alexandria – Egypt';

  return (
    <div className="font-sans text-xs">
      <div className="flex items-start gap-3 mb-3">
        <div className="w-16 h-16 flex-shrink-0 rounded bg-slate-100 dark:bg-navy-800 flex items-center justify-center overflow-hidden">
          <img src="https://www.abclogistics.com/placeholder-logo.png" alt="SG" className="w-14 h-14 object-contain" onError={e => { e.target.style.display='none'; }} />
        </div>
        <div className="border-l-2 border-gold-500 pl-3">
          <div className="text-sm font-bold text-slate-900 dark:text-white">{salutation}{name}</div>
          {user?.jobTitle && <div className="text-xs text-slate-500 dark:text-gray-400 mb-0.5">{user.jobTitle}</div>}
          <div className="text-xs text-slate-400 dark:text-gray-500 tracking-wide uppercase mb-1">ABC Logistics &nbsp;·&nbsp; Shipping &amp; Logistics</div>
          <div className="border-t border-slate-200 dark:border-navy-600 pt-1.5 space-y-0.5">
            {address && <div className="text-slate-500 dark:text-gray-400">{address}</div>}
            {phones.length > 0 && <div className="text-slate-500 dark:text-gray-400">{phones.join('  ·  ')}</div>}
            <div className="flex flex-wrap gap-x-2">
              <span className="text-gold-600 dark:text-gold-400">{user?.email || 'demo@abclogistics.com'}</span>
              <span>·</span>
              <span className="text-gold-600 dark:text-gold-400">www.abclogistics.com</span>
            </div>
          </div>
        </div>
      </div>
      <img src={LOGOS_URL} alt="Partner Logos" className="mt-1" style={{ maxWidth: 380 }} />
    </div>
  );
}

function personalize(text, companyName) {
  return text.replace(/\{Company Name\}|\[?Company Name\]?/g, companyName);
}

const CONTACT_TYPES = ['Client', 'Freight Forwarder', 'Carrier', 'Supplier', 'Trader'];
const INDUSTRIES = ['Freight Forwarder', 'Exporter', 'Importer', 'Manufacturer', 'Logistics Agent', 'Trading', 'Shipping Lines', 'Other'];

const STATUS_ICON = {
  sent: <CheckCircleIcon className="w-4 h-4 text-green-500" />,
  failed: <XCircleIcon className="w-4 h-4 text-red-500" />,
};

function Tab({ active, onClick, children }) {
  return (
    <button
      onClick={onClick}
      className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
        active
          ? 'bg-gold-500/15 text-gold-600 dark:text-gold-400 border border-gold-500/20'
          : 'text-slate-500 dark:text-gray-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-navy-800'
      }`}
    >
      {children}
    </button>
  );
}

export default function EmailsPage() {
  const { user, settings } = useAuth();
  const [tab, setTab] = useState('compose');

  // Contact picker state
  const [contacts, setContacts] = useState([]);
  const [loadingContacts, setLoadingContacts] = useState(false);
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState('');
  const [filterIndustry, setFilterIndustry] = useState('');
  const [filterCountry, setFilterCountry] = useState('');
  const [selected, setSelected] = useState(new Set());
  const [showFilters, setShowFilters] = useState(false);

  // Compose state
  const [templates, setTemplates] = useState([]);
  const [template, setTemplate] = useState('rate_request');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [sending, setSending] = useState(false);

  // History state
  const [logs, setLogs] = useState([]);
  const [loadingLogs, setLoadingLogs] = useState(false);

  // Preview modal
  const [preview, setPreview] = useState(null); // { company, subject, body }

  const fetchContacts = useCallback(async () => {
    setLoadingContacts(true);
    try {
      const params = { limit: 500 };
      if (filterType) params.contactType = filterType;
      const res = await api.get('/clients', { params });
      setContacts(res.data.data || res.data || []);
    } catch {
      toast.error('Failed to load contacts');
    } finally {
      setLoadingContacts(false);
    }
  }, [filterType]);

  useEffect(() => { fetchContacts(); }, [fetchContacts]);

  useEffect(() => {
    api.get('/emails/templates').then(r => setTemplates(r.data)).catch(() => {});
  }, []);

  const fetchLogs = useCallback(async () => {
    if (tab !== 'history') return;
    setLoadingLogs(true);
    try {
      const res = await api.get('/emails/logs');
      setLogs(res.data.logs || []);
    } catch {
      toast.error('Failed to load history');
    } finally {
      setLoadingLogs(false);
    }
  }, [tab]);

  useEffect(() => { fetchLogs(); }, [fetchLogs]);

  // Auto-fill subject/body when template changes and no manual edit
  useEffect(() => {
    if (template === 'custom') { setSubject(''); setBody(''); return; }
    api.get('/emails/preview-template', { params: { template, companyName: 'Company Name' } })
      .then(r => { setSubject(r.data.subject); setBody(r.data.body); })
      .catch(() => {});
  }, [template]);

  const filteredContacts = contacts.filter(c => {
    const q = search.toLowerCase();
    const matchSearch = !q ||
      c.company_name?.toLowerCase().includes(q) ||
      c.email?.toLowerCase().includes(q) ||
      c.country?.toLowerCase().includes(q);
    const matchType = !filterType || c.contact_type === filterType;
    const matchIndustry = !filterIndustry || c.industry === filterIndustry;
    const matchCountry = !filterCountry || c.country?.toLowerCase().includes(filterCountry.toLowerCase());
    return matchSearch && matchType && matchIndustry && matchCountry;
  });

  const allFilteredIds = filteredContacts.map(c => c.id);
  const allSelected = allFilteredIds.length > 0 && allFilteredIds.every(id => selected.has(id));

  const toggleAll = () => {
    if (allSelected) {
      setSelected(prev => { const n = new Set(prev); allFilteredIds.forEach(id => n.delete(id)); return n; });
    } else {
      setSelected(prev => new Set([...prev, ...allFilteredIds]));
    }
  };

  const toggleOne = (id) => {
    setSelected(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  };

  const handleSend = async () => {
    if (!selected.size) return toast.error('Select at least one contact');
    if (!subject.trim()) return toast.error('Subject is required');
    if (!body.trim()) return toast.error('Body is required');

    setSending(true);
    try {
      const res = await api.post('/emails/send', {
        contactIds: [...selected],
        template,
        subject,
        body,
        senderName: user?.fullName || '',
        senderSalutation: user?.salutation || '',
        senderTitle: user?.jobTitle || '',
        senderPhone: user?.phone || '',
        senderPhone2: user?.phone2 || '',
        senderPhone3: user?.phone3 || '',
        senderEmail: user?.email || 'demo@abclogistics.com',
        companyAddress: settings?.company?.address || '',
      }, { timeout: 60000 });
      const { sent, failed, results } = res.data;
      if (failed === 0) {
        toast.success(`${sent} email${sent !== 1 ? 's' : ''} sent successfully`);
      } else {
        toast(`${sent} sent, ${failed} failed`, { icon: '⚠️' });
      }
      setSelected(new Set());
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to send emails');
    } finally {
      setSending(false);
    }
  };

  const countries = [...new Set(contacts.map(c => c.country).filter(Boolean))].sort();

  const openPreview = () => {
    const firstId = [...selected][0];
    const contact = contacts.find(c => c.id === firstId);
    if (!contact) return toast.error('Select at least one contact to preview');
    if (!subject.trim() && !body.trim()) return toast.error('Add a subject and message first');
    const name = contact.company_name;
    setPreview({
      company: name,
      email: contact.email,
      subject: personalize(subject, name),
      body: personalize(body, name),
    });
  };

  return (
    <div className="flex flex-col h-full gap-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gold-500/15 flex items-center justify-center">
            <EnvelopeIcon className="w-5 h-5 text-gold-600 dark:text-gold-400" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900 dark:text-white">Emails</h1>
            <p className="text-xs text-slate-500 dark:text-gray-400">Send bulk inquiries to contacts</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Tab active={tab === 'compose'} onClick={() => setTab('compose')}>Compose</Tab>
          <Tab active={tab === 'history'} onClick={() => setTab('history')}>
            <span className="flex items-center gap-1.5"><ClockIcon className="w-4 h-4" /> History</span>
          </Tab>
        </div>
      </div>

      {tab === 'compose' && (
        <div className="flex gap-6 flex-1 min-h-0">
          {/* Left: Contact Picker */}
          <div className="w-96 flex-shrink-0 flex flex-col bg-white dark:bg-navy-900 border border-slate-200 dark:border-navy-700 rounded-2xl overflow-hidden">
            <div className="p-4 border-b border-slate-200 dark:border-navy-700">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm font-semibold text-slate-900 dark:text-white">
                  Contacts
                  {selected.size > 0 && (
                    <span className="ml-2 text-xs font-medium text-gold-600 dark:text-gold-400 bg-gold-500/10 px-2 py-0.5 rounded-full">
                      {selected.size} selected
                    </span>
                  )}
                </span>
                <button
                  onClick={() => setShowFilters(f => !f)}
                  className="flex items-center gap-1 text-xs text-slate-500 dark:text-gray-400 hover:text-slate-900 dark:hover:text-white transition-colors"
                >
                  <FunnelIcon className="w-3.5 h-3.5" />
                  Filters
                  {showFilters ? <ChevronUpIcon className="w-3 h-3" /> : <ChevronDownIcon className="w-3 h-3" />}
                </button>
              </div>

              {/* Search */}
              <div className="relative mb-3">
                <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 dark:text-gray-500" />
                <input
                  type="text"
                  placeholder="Search by name, email, country…"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 text-sm bg-slate-50 dark:bg-navy-800 border border-slate-200 dark:border-navy-600 rounded-lg text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-gold-500/40"
                />
              </div>

              {/* Filters */}
              {showFilters && (
                <div className="space-y-2">
                  <select
                    value={filterType}
                    onChange={e => setFilterType(e.target.value)}
                    className="w-full text-sm bg-slate-50 dark:bg-navy-800 border border-slate-200 dark:border-navy-600 rounded-lg px-3 py-2 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-gold-500/40"
                  >
                    <option value="">All Types</option>
                    {CONTACT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                  <select
                    value={filterIndustry}
                    onChange={e => setFilterIndustry(e.target.value)}
                    className="w-full text-sm bg-slate-50 dark:bg-navy-800 border border-slate-200 dark:border-navy-600 rounded-lg px-3 py-2 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-gold-500/40"
                  >
                    <option value="">All Industries</option>
                    {INDUSTRIES.map(i => <option key={i} value={i}>{i}</option>)}
                  </select>
                  <select
                    value={filterCountry}
                    onChange={e => setFilterCountry(e.target.value)}
                    className="w-full text-sm bg-slate-50 dark:bg-navy-800 border border-slate-200 dark:border-navy-600 rounded-lg px-3 py-2 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-gold-500/40"
                  >
                    <option value="">All Countries</option>
                    {countries.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                  {(filterType || filterIndustry || filterCountry) && (
                    <button
                      onClick={() => { setFilterType(''); setFilterIndustry(''); setFilterCountry(''); }}
                      className="text-xs text-red-500 hover:text-red-600 transition-colors"
                    >
                      Clear filters
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* Select all row */}
            {filteredContacts.length > 0 && (
              <div className="flex items-center gap-3 px-4 py-2 bg-slate-50 dark:bg-navy-800/50 border-b border-slate-200 dark:border-navy-700">
                <input
                  type="checkbox"
                  checked={allSelected}
                  onChange={toggleAll}
                  className="w-4 h-4 rounded text-gold-500 focus:ring-gold-500"
                />
                <span className="text-xs text-slate-500 dark:text-gray-400">
                  Select all {filteredContacts.length} contacts
                </span>
              </div>
            )}

            {/* Contact list */}
            <div className="flex-1 overflow-y-auto">
              {loadingContacts ? (
                <div className="p-6 text-center text-sm text-slate-400 dark:text-gray-500">Loading…</div>
              ) : filteredContacts.length === 0 ? (
                <div className="p-6 text-center text-sm text-slate-400 dark:text-gray-500">No contacts found</div>
              ) : (
                filteredContacts.map(c => (
                  <label
                    key={c.id}
                    className={`flex items-center gap-3 px-4 py-3 cursor-pointer border-b border-slate-100 dark:border-navy-800 hover:bg-slate-50 dark:hover:bg-navy-800/50 transition-colors ${selected.has(c.id) ? 'bg-gold-500/5' : ''}`}
                  >
                    <input
                      type="checkbox"
                      checked={selected.has(c.id)}
                      onChange={() => toggleOne(c.id)}
                      className="w-4 h-4 rounded text-gold-500 focus:ring-gold-500 flex-shrink-0"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-slate-900 dark:text-white truncate">{c.company_name}</div>
                      <div className="text-xs text-slate-500 dark:text-gray-400 truncate">
                        {c.email || <span className="text-amber-500 italic">no email</span>}
                      </div>
                      {c.contact_type && (
                        <div className="text-xs text-slate-400 dark:text-gray-500">{c.contact_type}{c.country ? ` · ${c.country}` : ''}</div>
                      )}
                    </div>
                  </label>
                ))
              )}
            </div>
          </div>

          {/* Right: Compose */}
          <div className="flex-1 flex flex-col gap-4 bg-white dark:bg-navy-900 border border-slate-200 dark:border-navy-700 rounded-2xl p-6 overflow-y-auto">
            <h2 className="text-sm font-semibold text-slate-900 dark:text-white">Compose Email</h2>

            {/* Template picker */}
            <div>
              <label className="block text-xs font-medium text-slate-500 dark:text-gray-400 mb-1.5">Template</label>
              <div className="flex flex-wrap gap-2">
                {templates.map(t => (
                  <button
                    key={t.key}
                    onClick={() => setTemplate(t.key)}
                    className={`px-3 py-1.5 text-sm rounded-lg border transition-colors ${
                      template === t.key
                        ? 'bg-gold-500/15 border-gold-500/30 text-gold-600 dark:text-gold-400 font-medium'
                        : 'border-slate-200 dark:border-navy-600 text-slate-600 dark:text-gray-400 hover:border-gold-400'
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </div>

            {/* From (read-only) */}
            <div>
              <label className="block text-xs font-medium text-slate-500 dark:text-gray-400 mb-1.5">From</label>
              <div className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-navy-800 border border-slate-200 dark:border-navy-700 rounded-lg text-slate-500 dark:text-gray-400">
                demo@abclogistics.com
              </div>
            </div>

            {/* To */}
            <div>
              <label className="block text-xs font-medium text-slate-500 dark:text-gray-400 mb-1.5">To</label>
              <div className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-navy-800 border border-slate-200 dark:border-navy-700 rounded-lg text-slate-700 dark:text-gray-300 min-h-[38px]">
                {selected.size === 0
                  ? <span className="text-slate-400 dark:text-gray-500 italic">Select contacts from the left panel</span>
                  : `${selected.size} contact${selected.size !== 1 ? 's' : ''} selected`
                }
              </div>
            </div>

            {/* Subject */}
            <div>
              <label className="block text-xs font-medium text-slate-500 dark:text-gray-400 mb-1.5">Subject</label>
              <input
                type="text"
                value={subject}
                onChange={e => setSubject(e.target.value)}
                placeholder="Email subject…"
                className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-navy-800 border border-slate-200 dark:border-navy-600 rounded-lg text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-gold-500/40"
              />
            </div>

            {/* Body */}
            <div className="flex-1 flex flex-col">
              <label className="block text-xs font-medium text-slate-500 dark:text-gray-400 mb-1.5">Message</label>
              <textarea
                value={body}
                onChange={e => setBody(e.target.value)}
                placeholder="Write your message…"
                className="flex-1 min-h-[220px] w-full px-3 py-2 text-sm bg-slate-50 dark:bg-navy-800 border border-slate-200 dark:border-navy-600 rounded-t-lg text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-gold-500/40 resize-none font-mono"
              />
              {/* Signature preview */}
              <div className="border border-t-0 border-slate-200 dark:border-navy-600 rounded-b-lg px-3 py-3 bg-white dark:bg-navy-900">
                <SignatureBlock user={user} settings={settings} />
                {(!user?.jobTitle || !user?.phone) && (
                  <p className="text-xs text-amber-500 dark:text-amber-400 mt-2 pl-1">
                    ⚙ Set your details in <a href="/settings" className="underline">Settings → My Email Signature</a> to complete your signature.
                  </p>
                )}
              </div>
            </div>

            {/* Send button */}
            <div className="flex items-center justify-between pt-2 border-t border-slate-200 dark:border-navy-700">
              <span className="text-xs text-slate-400 dark:text-gray-500">
                {selected.size > 0 ? `Sending to ${selected.size} recipient${selected.size !== 1 ? 's' : ''}` : 'No recipients selected'}
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={openPreview}
                  disabled={!selected.size}
                  className="flex items-center gap-2 px-4 py-2.5 border border-slate-200 dark:border-navy-600 text-slate-600 dark:text-gray-300 hover:border-gold-400 hover:text-gold-600 dark:hover:text-gold-400 disabled:opacity-40 disabled:cursor-not-allowed text-sm rounded-xl transition-colors"
                >
                  <EyeIcon className="w-4 h-4" />
                  Preview
                </button>
                <button
                  onClick={handleSend}
                  disabled={sending || !selected.size}
                  className="flex items-center gap-2 px-5 py-2.5 bg-gold-500 hover:bg-gold-600 disabled:opacity-50 disabled:cursor-not-allowed text-navy-950 font-semibold text-sm rounded-xl transition-colors"
                >
                  <PaperAirplaneIcon className="w-4 h-4" />
                  {sending ? 'Sending…' : 'Send Emails'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {tab === 'history' && (
        <div className="flex-1 bg-white dark:bg-navy-900 border border-slate-200 dark:border-navy-700 rounded-2xl overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-200 dark:border-navy-700">
            <h2 className="text-sm font-semibold text-slate-900 dark:text-white">Sent Email History</h2>
          </div>
          {loadingLogs ? (
            <div className="p-8 text-center text-sm text-slate-400 dark:text-gray-500">Loading…</div>
          ) : logs.length === 0 ? (
            <div className="p-8 text-center text-sm text-slate-400 dark:text-gray-500">No emails sent yet</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 dark:bg-navy-800/50 text-xs text-slate-500 dark:text-gray-400 uppercase tracking-wide">
                    <th className="px-4 py-3 text-left">Status</th>
                    <th className="px-4 py-3 text-left">Company</th>
                    <th className="px-4 py-3 text-left">Recipient</th>
                    <th className="px-4 py-3 text-left">Subject</th>
                    <th className="px-4 py-3 text-left">Template</th>
                    <th className="px-4 py-3 text-left">Sent By</th>
                    <th className="px-4 py-3 text-left">Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-navy-800">
                  {logs.map(log => (
                    <tr key={log.id} className="hover:bg-slate-50 dark:hover:bg-navy-800/40 transition-colors">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5">
                          {STATUS_ICON[log.status] || null}
                          <span className={`capitalize text-xs font-medium ${log.status === 'sent' ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                            {log.status}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-slate-900 dark:text-white font-medium">{log.company_name || '—'}</td>
                      <td className="px-4 py-3 text-slate-600 dark:text-gray-300">{log.recipient}</td>
                      <td className="px-4 py-3 text-slate-600 dark:text-gray-300 max-w-xs truncate">{log.subject}</td>
                      <td className="px-4 py-3">
                        <span className="text-xs bg-slate-100 dark:bg-navy-800 text-slate-600 dark:text-gray-400 px-2 py-0.5 rounded-full">
                          {log.template?.replace(/_/g, ' ')}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-slate-500 dark:text-gray-400">{log.sent_by_name || '—'}</td>
                      <td className="px-4 py-3 text-slate-500 dark:text-gray-400 whitespace-nowrap">
                        {new Date(log.sent_at).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
      {/* Preview Modal */}
      {preview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="w-full max-w-2xl bg-white dark:bg-navy-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-navy-700 flex flex-col max-h-[90vh]">
            {/* Modal header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-navy-700">
              <div className="flex items-center gap-2">
                <EyeIcon className="w-5 h-5 text-gold-500" />
                <span className="font-semibold text-slate-900 dark:text-white text-sm">
                  Email Preview — {preview.company}
                </span>
              </div>
              <button onClick={() => setPreview(null)} className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-navy-800 text-slate-400 hover:text-slate-600 dark:hover:text-white transition-colors">
                <XMarkIcon className="w-5 h-5" />
              </button>
            </div>

            {/* Email meta */}
            <div className="px-6 py-3 border-b border-slate-100 dark:border-navy-800 space-y-1.5 text-sm">
              <div className="flex gap-3">
                <span className="w-14 text-xs font-medium text-slate-400 dark:text-gray-500 pt-0.5">From</span>
                <span className="text-slate-700 dark:text-gray-300">demo@abclogistics.com</span>
              </div>
              <div className="flex gap-3">
                <span className="w-14 text-xs font-medium text-slate-400 dark:text-gray-500 pt-0.5">To</span>
                <span className="text-slate-700 dark:text-gray-300">{preview.email || <span className="text-amber-500 italic">no email on file</span>}</span>
              </div>
              <div className="flex gap-3">
                <span className="w-14 text-xs font-medium text-slate-400 dark:text-gray-500 pt-0.5">Subject</span>
                <span className="font-semibold text-slate-900 dark:text-white">{preview.subject}</span>
              </div>
            </div>

            {/* Email body */}
            <div className="flex-1 overflow-y-auto px-6 py-5">
              <pre className="whitespace-pre-wrap font-sans text-sm text-slate-800 dark:text-gray-200 leading-relaxed">{preview.body}</pre>

              {/* Signature */}
              <div className="mt-5 border-t border-slate-300 dark:border-navy-600 pt-4">
                <SignatureBlock user={user} settings={settings} />
              </div>
            </div>

            {/* Note */}
            <div className="px-6 py-3 border-t border-slate-100 dark:border-navy-800 text-xs text-slate-400 dark:text-gray-500">
              {selected.size > 1
                ? `Showing preview for the first selected contact. Each of the ${selected.size} emails will have its own company name substituted.`
                : 'This is exactly how the email will appear to the recipient.'}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
