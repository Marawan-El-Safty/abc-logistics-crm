import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import api from '../services/api';
import {
  PlusIcon, BriefcaseIcon, PaperAirplaneIcon,
  ChatBubbleLeftRightIcon, UserIcon, ClockIcon,
  PencilIcon, CheckIcon, XMarkIcon, PaperClipIcon, ArrowDownTrayIcon,
} from '@heroicons/react/24/outline';
import Badge from '../components/common/Badge';
import Modal from '../components/common/Modal';
import { useAuth } from '../store/AuthContext';
import { useAutoRefresh } from '../hooks/useAutoRefresh';
import { formatDistanceToNow } from 'date-fns';

const STATUSES   = ['Open', 'In Progress', 'Closed'];
const PRIORITIES = ['Low', 'Medium', 'High', 'Urgent'];

// ── New / Edit Request Form ───────────────────────────────────────────────────
function RequestForm({ onSave, onClose, initialData = null }) {
  const isEdit = !!initialData;
  const [form, setForm] = useState({
    title:       initialData?.title       || '',
    description: initialData?.description || '',
    priority:    initialData?.priority    || 'Medium',
    clientId:    initialData?.client_id   || '',
    assignedTo:  initialData?.assigned_to || '',
  });
  const [clients, setClients]   = useState([]);
  const [users, setUsers]       = useState([]);
  const [files, setFiles]       = useState([]);
  const [loading, setLoading]   = useState(false);
  const fileRef                 = useRef(null);

  useEffect(() => {
    api.get('/clients', { params: { limit: 200 } }).then(r => setClients(r.data.data || [])).catch(() => {});
    api.get('/users').then(r => setUsers(r.data.data || [])).catch(() => {});
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (isEdit) {
        await api.put(`/requests/${initialData.id}`, form);
        toast.success('Request updated');
      } else {
        const fd = new FormData();
        Object.entries(form).forEach(([k, v]) => { if (v) fd.append(k, v); });
        files.forEach(f => fd.append('attachments', f));
        await api.post('/requests', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
        toast.success('Request submitted');
      }
      onSave();
    } catch (err) { toast.error(err.response?.data?.error || 'Error saving request'); }
    finally { setLoading(false); }
  };

  const removeFile = (idx) => setFiles(prev => prev.filter((_, i) => i !== idx));

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="label">Title *</label>
        <input className="input" required value={form.title} onChange={e => setForm({...form, title: e.target.value})} />
      </div>
      <div>
        <label className="label">Description</label>
        <textarea className="input" rows={3} value={form.description} onChange={e => setForm({...form, description: e.target.value})} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label">Priority</label>
          <select className="select" value={form.priority} onChange={e => setForm({...form, priority: e.target.value})}>
            {PRIORITIES.map(p => <option key={p}>{p}</option>)}
          </select>
        </div>
        <div>
          <label className="label">Assign To</label>
          <select className="select" value={form.assignedTo} onChange={e => setForm({...form, assignedTo: e.target.value})}>
            <option value="">— Unassigned —</option>
            {users.map(u => <option key={u.id} value={u.id}>{u.full_name} ({u.role_name || u.role})</option>)}
          </select>
        </div>
      </div>
      <div>
        <label className="label">Linked Client</label>
        <select className="select" value={form.clientId} onChange={e => setForm({...form, clientId: e.target.value})}>
          <option value="">None</option>
          {clients.map(c => <option key={c.id} value={c.id}>{c.company_name}</option>)}
        </select>
      </div>

      {/* Attachments — new requests only */}
      {!isEdit && (
        <div>
          <label className="label">Attachments</label>
          <div
            onClick={() => fileRef.current?.click()}
            className="border-2 border-dashed border-slate-300 dark:border-navy-600 rounded-xl px-4 py-5 text-center cursor-pointer hover:border-gold-400 dark:hover:border-gold-500 transition-colors"
          >
            <PaperClipIcon className="w-6 h-6 mx-auto text-slate-400 dark:text-gray-500 mb-1" />
            <p className="text-sm text-slate-500 dark:text-gray-400">Click to attach files</p>
            <p className="text-xs text-slate-400 dark:text-gray-500 mt-0.5">PDF, DOCX, Excel, Images — max 20 MB each</p>
          </div>
          <input ref={fileRef} type="file" multiple className="hidden"
            accept=".pdf,.docx,.doc,.xlsx,.xls,.png,.jpg,.jpeg"
            onChange={e => setFiles(prev => [...prev, ...Array.from(e.target.files)])}
          />
          {files.length > 0 && (
            <ul className="mt-2 space-y-1">
              {files.map((f, i) => (
                <li key={i} className="flex items-center justify-between bg-slate-50 dark:bg-navy-800 rounded-lg px-3 py-1.5 text-sm">
                  <span className="truncate text-slate-700 dark:text-gray-300">{f.name}</span>
                  <button type="button" onClick={() => removeFile(i)} className="ml-2 text-slate-400 hover:text-red-500 transition-colors flex-shrink-0">
                    <XMarkIcon className="w-4 h-4" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      <div className="flex justify-end gap-3 pt-2 border-t border-slate-100 dark:border-navy-800">
        <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
        <button type="submit" className="btn-primary" disabled={loading}>
          {loading ? 'Saving…' : isEdit ? 'Save Changes' : 'Submit Request'}
        </button>
      </div>
    </form>
  );
}

// ── Emoji Picker ─────────────────────────────────────────────────────────────
const EMOJIS = [
  '👍','👎','✅','❌','🔥','⚡','💯','🎯',
  '📌','📎','📋','📝','📢','🔔','⚠️','🚨',
  '✔️','➕','➖','❓','❗','💬','💡','🔍',
  '😊','😅','😂','🤔','😬','🙏','👏','🤝',
  '🚀','⏳','✈️','📦','🛳️','🏷️','📊','💰',
];

function EmojiPicker({ onSelect }) {
  return (
    <div className="absolute bottom-full mb-2 left-0 z-50 bg-white dark:bg-navy-800 border border-slate-200 dark:border-navy-600 rounded-xl shadow-2xl p-2 w-60">
      <div className="grid grid-cols-8 gap-0.5">
        {EMOJIS.map(e => (
          <button
            key={e}
            type="button"
            onClick={() => onSelect(e)}
            className="w-7 h-7 flex items-center justify-center text-lg rounded hover:bg-slate-100 dark:hover:bg-navy-700 transition-colors"
          >
            {e}
          </button>
        ))}
      </div>
    </div>
  );
}

// ── Request Detail + Reply Thread ─────────────────────────────────────────────
function RequestDetailModal({ requestId, onClose, onUpdated, canManage, users, currentUser }) {
  const [req, setReq]           = useState(null);
  const [loading, setLoading]   = useState(true);
  const [reply, setReply]       = useState('');
  const [sending, setSending]   = useState(false);
  const [resolution, setResolution] = useState('');
  const [isEditing, setIsEditing]   = useState(false);
  const [editForm, setEditForm]     = useState({});
  const [clients, setClients]       = useState([]);
  const [showEmoji, setShowEmoji]   = useState(false);
  const emojiRef                    = useRef(null);
  const scrollRef = useRef(null);

  const loadDetail = useCallback(async () => {
    try {
      const res = await api.get(`/requests/${requestId}`);
      setReq(res.data.data);
      setResolution(res.data.data.resolution || '');
    } catch (_) {}
    finally { setLoading(false); }
  }, [requestId]);

  useEffect(() => { loadDetail(); }, [loadDetail]);
  useEffect(() => {
    api.get('/clients', { params: { limit: 100 } }).then(r => setClients(r.data.data || [])).catch(() => {});
  }, []);

  // Close emoji picker on outside click
  useEffect(() => {
    if (!showEmoji) return;
    const handler = (e) => {
      if (emojiRef.current && !emojiRef.current.contains(e.target)) setShowEmoji(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showEmoji]);

  // Auto-scroll replies to bottom
  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [req?.replies?.length]);

  const startEdit = () => {
    setEditForm({
      title:       req.title,
      description: req.description || '',
      priority:    req.priority,
      clientId:    req.client_id || '',
    });
    setIsEditing(true);
  };

  const cancelEdit = () => setIsEditing(false);

  const saveEdit = async () => {
    try {
      await api.put(`/requests/${requestId}`, editForm);
      toast.success('Request updated');
      setIsEditing(false);
      loadDetail();
      onUpdated();
    } catch (err) { toast.error(err.response?.data?.error || 'Error updating request'); }
  };

  const handleSendReply = async () => {
    if (!reply.trim()) return;
    setSending(true);
    try {
      await api.post(`/requests/${requestId}/replies`, { message: reply.trim() });
      setReply('');
      loadDetail();
    } catch (err) { toast.error(err.response?.data?.error || 'Error sending reply'); }
    finally { setSending(false); }
  };

  const handleStatusChange = async (status) => {
    try {
      await api.put(`/requests/${requestId}`, { status });
      loadDetail();
      onUpdated();
    } catch (_) {}
  };

  const handleAssign = async (assignedTo) => {
    try {
      await api.put(`/requests/${requestId}`, { assignedTo });
      loadDetail();
      onUpdated();
    } catch (_) {}
  };

  const handleSaveResolution = async () => {
    try {
      await api.put(`/requests/${requestId}`, { resolution });
      toast.success('Resolution saved');
      loadDetail();
      onUpdated();
    } catch (_) {}
  };

  const handleArchive = async () => {
    try {
      await api.post(`/requests/${requestId}/archive`);
      toast.success('Request archived');
      onUpdated();
      onClose();
    } catch (_) { toast.error('Failed to archive'); }
  };

  const handleUnarchive = async () => {
    try {
      await api.post(`/requests/${requestId}/unarchive`);
      toast.success('Request restored');
      onUpdated();
      onClose();
    } catch (_) { toast.error('Failed to restore'); }
  };

  const handleDelete = async () => {
    if (!window.confirm('Permanently delete this request? This cannot be undone.')) return;
    try {
      await api.delete(`/requests/${requestId}`);
      toast.success('Request deleted');
      onUpdated();
      onClose();
    } catch (_) { toast.error('Failed to delete'); }
  };

  if (loading) return <div className="py-12 text-center text-slate-500 dark:text-gray-500">Loading...</div>;
  if (!req)    return <div className="py-12 text-center text-slate-500 dark:text-gray-500">Request not found</div>;

  const isManagerRole = ['Admin', 'Sales Manager'].includes(currentUser?.role);
  const canEdit = canManage || String(req.submitted_by) === String(currentUser?.id);

  return (
    <div className="flex flex-col gap-0 flex-1 overflow-hidden">
      {/* ── Top: Request info ── */}
      <div className="p-5 border-b border-slate-200 dark:border-navy-700 space-y-4 overflow-y-auto" style={{ maxHeight: '60vh' }}>

        {isEditing ? (
          /* ── Edit mode ── */
          <div className="space-y-3">
            <div className="flex items-center justify-between mb-1">
              <span className="text-sm font-semibold text-slate-700 dark:text-gray-300">Editing Request</span>
              <button onClick={cancelEdit} className="btn-ghost p-1 text-slate-400 hover:text-slate-600 dark:hover:text-gray-300">
                <XMarkIcon className="w-4 h-4" />
              </button>
            </div>
            <div className="form-group mb-0">
              <label className="label">Title *</label>
              <input className="input" value={editForm.title} onChange={e => setEditForm({...editForm, title: e.target.value})} />
            </div>
            <div className="form-group mb-0">
              <label className="label">Description</label>
              <textarea className="input resize-none" rows={3} value={editForm.description} onChange={e => setEditForm({...editForm, description: e.target.value})} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="form-group mb-0">
                <label className="label">Priority</label>
                <select className="select" value={editForm.priority} onChange={e => setEditForm({...editForm, priority: e.target.value})}>
                  {PRIORITIES.map(p => <option key={p}>{p}</option>)}
                </select>
              </div>
              <div className="form-group mb-0">
                <label className="label">Client</label>
                <select className="select" value={editForm.clientId} onChange={e => setEditForm({...editForm, clientId: e.target.value})}>
                  <option value="">None</option>
                  {clients.map(c => <option key={c.id} value={c.id}>{c.company_name}</option>)}
                </select>
              </div>
            </div>
            <div className="flex gap-2 pt-1">
              <button onClick={saveEdit} className="btn-primary flex-1 flex items-center justify-center gap-1.5">
                <CheckIcon className="w-4 h-4" />Save Changes
              </button>
              <button onClick={cancelEdit} className="btn-secondary flex-1">Cancel</button>
            </div>
          </div>
        ) : (
          /* ── View mode ── */
          <>
            {/* Title + badges + edit button */}
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1 min-w-0">
                <h3 className="text-base font-semibold text-slate-900 dark:text-white leading-tight">{req.title}</h3>
                <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                  <Badge label={req.status}   type="status"   />
                  <Badge label={req.priority} type="priority" />
                  {req.client_name && (
                    <span className="text-xs text-gold-600 dark:text-gold-400">🏢 {req.client_name}</span>
                  )}
                </div>
              </div>
              {canEdit && (
                <button
                  onClick={startEdit}
                  title="Edit request"
                  className="btn-ghost p-1.5 text-slate-400 hover:text-gold-500 flex-shrink-0"
                >
                  <PencilIcon className="w-4 h-4" />
                </button>
              )}
            </div>

            {/* Meta row */}
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="flex items-center gap-1.5 text-slate-500 dark:text-gray-400">
                <UserIcon className="w-3.5 h-3.5" />
                <span>Submitted by <span className="font-medium text-slate-700 dark:text-gray-300">{req.submitted_by_name}</span></span>
              </div>
              <div className="flex items-center gap-1.5 text-slate-500 dark:text-gray-400">
                <ClockIcon className="w-3.5 h-3.5" />
                <span>{new Date(req.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
              </div>
              {req.assigned_to_name && (
                <div className="flex items-center gap-1.5 text-slate-500 dark:text-gray-400">
                  <UserIcon className="w-3.5 h-3.5" />
                  <span>Assigned to <span className="font-medium text-slate-700 dark:text-gray-300">{req.assigned_to_name}</span></span>
                </div>
              )}
              {req.closed_at && (
                <div className="flex items-center gap-1.5 text-green-600 dark:text-green-400">
                  <ClockIcon className="w-3.5 h-3.5" />
                  <span>Closed {new Date(req.closed_at).toLocaleDateString()}</span>
                </div>
              )}
            </div>

            {/* Description */}
            {req.description && (
              <p className="text-sm text-slate-600 dark:text-gray-300 bg-slate-50 dark:bg-navy-800 rounded-lg px-3 py-2 border border-slate-200 dark:border-navy-700">
                {req.description}
              </p>
            )}

            {/* Attachments */}
            {(() => {
              const atts = Array.isArray(req.attachments) ? req.attachments
                : (typeof req.attachments === 'string' ? JSON.parse(req.attachments || '[]') : []);
              if (!atts.length) return null;
              return (
                <div>
                  <p className="text-xs font-semibold text-slate-500 dark:text-gray-400 uppercase tracking-wide mb-1.5 flex items-center gap-1">
                    <PaperClipIcon className="w-3.5 h-3.5" /> Attachments ({atts.length})
                  </p>
                  <ul className="space-y-1">
                    {atts.map((att, i) => (
                      <li key={i} className="flex items-center justify-between bg-slate-50 dark:bg-navy-800 rounded-lg px-3 py-1.5 border border-slate-200 dark:border-navy-700">
                        <span className="text-sm text-slate-700 dark:text-gray-300 truncate">{att.filename}</span>
                        <a href={`${process.env.REACT_APP_API_URL || ''}${att.url}`} target="_blank" rel="noreferrer"
                          className="ml-2 p-1 text-slate-400 hover:text-blue-500 transition-colors flex-shrink-0"
                          aria-label={`Download ${att.filename}`}>
                          <ArrowDownTrayIcon className="w-4 h-4" />
                        </a>
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })()}
          </>
        )}

        {/* Manager controls (only in view mode) */}
        {!isEditing && canManage && (
          <div className="flex gap-2 flex-wrap">
            {STATUSES.filter(s => s !== req.status).map(s => (
              <button key={s}
                onClick={() => handleStatusChange(s)}
                className="px-3 py-1 rounded-lg text-xs font-medium bg-slate-100 dark:bg-navy-800 text-slate-600 dark:text-gray-300
                  hover:bg-gold-500/15 hover:text-gold-600 dark:hover:text-gold-400 transition-colors border border-slate-200 dark:border-navy-700">
                → {s}
              </button>
            ))}
            <select
              className="select text-xs w-44"
              value={req.assigned_to || ''}
              onChange={e => handleAssign(e.target.value)}
            >
              <option value="">Assign to...</option>
              {users.map(u => <option key={u.id} value={u.id}>{u.full_name}</option>)}
            </select>
          </div>
        )}

        {/* Archive / Delete — only for closed requests, managers only */}
        {!isEditing && canManage && req.status === 'Closed' && (
          <div className="flex gap-2 pt-1 border-t border-slate-100 dark:border-navy-800">
            {req.is_archived ? (
              <button onClick={handleUnarchive}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 hover:bg-blue-100 transition-colors">
                📤 Restore from Archive
              </button>
            ) : (
              <button onClick={handleArchive}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-100 dark:bg-navy-800 text-slate-600 dark:text-gray-300 hover:bg-slate-200 dark:hover:bg-navy-700 transition-colors">
                🗄️ Archive
              </button>
            )}
            <button onClick={handleDelete}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 hover:bg-red-100 transition-colors">
              🗑️ Delete Permanently
            </button>
          </div>
        )}

        {/* Resolution */}
        {!isEditing && canManage && (
          <div>
            <label className="label">Resolution / Notes</label>
            <div className="flex gap-2">
              <textarea
                className="input text-xs flex-1"
                rows={2}
                placeholder="Add resolution notes visible to the requester..."
                value={resolution}
                onChange={e => setResolution(e.target.value)}
              />
              <button className="btn-primary text-xs px-3 self-end" onClick={handleSaveResolution}>Save</button>
            </div>
          </div>
        )}
        {!canManage && req.resolution && (
          <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-700/30 rounded-lg px-3 py-2">
            <p className="text-xs font-semibold text-green-700 dark:text-green-400 mb-0.5">Manager's Resolution</p>
            <p className="text-sm text-green-800 dark:text-green-300">{req.resolution}</p>
          </div>
        )}
      </div>

      {/* ── Middle: Reply thread ── */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-5 py-4 space-y-3 bg-slate-50 dark:bg-navy-950/50" style={{ minHeight: '180px', maxHeight: '280px' }}>
        {req.replies?.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full py-6 text-slate-400 dark:text-gray-600">
            <ChatBubbleLeftRightIcon className="w-8 h-8 mb-2" />
            <p className="text-sm">No replies yet. Start the conversation.</p>
          </div>
        ) : (
          req.replies.map((r) => {
            const isMine = String(r.author_id) === String(currentUser?.id);
            const isManager = ['Admin', 'Sales Manager'].includes(r.role_name);
            return (
              <div key={r.id} className={`flex gap-2 ${isMine ? 'flex-row-reverse' : 'flex-row'}`}>
                <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5
                  ${isManager ? 'bg-gold-500 text-navy-950' : 'bg-blue-500 text-white'}`}>
                  {r.author_name?.[0]?.toUpperCase()}
                </div>
                <div className={`max-w-[75%] ${isMine ? 'items-end' : 'items-start'} flex flex-col gap-0.5`}>
                  <div className={`flex items-center gap-1.5 ${isMine ? 'flex-row-reverse' : ''}`}>
                    <span className="text-xs font-medium text-slate-600 dark:text-gray-400">{r.author_name}</span>
                    {isManager && (
                      <span className="text-xs px-1.5 py-0 rounded bg-gold-500/15 text-gold-600 dark:text-gold-400 font-medium">Manager</span>
                    )}
                  </div>
                  <div className={`px-3 py-2 rounded-2xl text-sm leading-snug
                    ${isMine
                      ? 'bg-gold-500 text-navy-950 rounded-tr-sm'
                      : 'bg-white dark:bg-navy-800 text-slate-800 dark:text-gray-200 border border-slate-200 dark:border-navy-700 rounded-tl-sm'}`}>
                    {r.message}
                  </div>
                  <span className="text-xs text-slate-400 dark:text-gray-600 px-1">
                    {formatDistanceToNow(new Date(r.created_at), { addSuffix: true })}
                  </span>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* ── Bottom: Reply input ── */}
      <div className="p-4 border-t border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-900">
        <textarea
          className="input text-sm w-full resize-none mb-2"
          rows={2}
          placeholder={isManagerRole ? 'Reply to this request…' : 'Reply to the manager…'}
          value={reply}
          onChange={e => setReply(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSendReply(); } }}
        />
        <div className="flex items-center gap-2">
          {/* Emoji picker trigger */}
          <div ref={emojiRef} className="relative">
            <button
              type="button"
              onClick={() => setShowEmoji(v => !v)}
              className={`w-8 h-8 flex items-center justify-center rounded-lg text-lg transition-colors
                ${showEmoji
                  ? 'bg-gold-100 dark:bg-gold-900/30 text-gold-600'
                  : 'text-slate-400 hover:text-slate-600 dark:hover:text-gray-300 hover:bg-slate-100 dark:hover:bg-navy-800'}`}
              title="Insert emoji"
            >
              😊
            </button>
            {showEmoji && (
              <EmojiPicker onSelect={e => { setReply(r => r + e); setShowEmoji(false); }} />
            )}
          </div>
          <p className="text-xs text-slate-400 dark:text-gray-600 flex-1">Enter to send · Shift+Enter new line</p>
          <button
            onClick={handleSendReply}
            disabled={sending || !reply.trim()}
            className="btn-primary px-3 flex items-center gap-1.5 disabled:opacity-50"
          >
            <PaperAirplaneIcon className="w-4 h-4" />
            {sending ? 'Sending…' : 'Send'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function RequestsPage() {
  const [requests, setRequests]     = useState([]);
  const [statusFilter, setStatusFilter] = useState('');
  const [assignedFilter, setAssignedFilter] = useState('all'); // 'all' | 'mine'
  const [loading, setLoading]       = useState(true);
  const [showForm, setShowForm]     = useState(false);
  const [searchParams, setSearchParams] = useSearchParams();
  // Initialise directly from URL so the modal opens on first paint (no flash)
  const [selectedId, setSelectedId] = useState(() => searchParams.get('open') || null);
  const { canManage, user } = useAuth();
  const [users, setUsers]           = useState([]);

  // Clean ?open= from the URL after we've read it
  useEffect(() => {
    if (searchParams.get('open')) {
      setSearchParams(prev => { prev.delete('open'); return prev; }, { replace: true });
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const [showArchived, setShowArchived] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/requests', { params: {
        status: statusFilter || undefined,
        archived: showArchived ? 'true' : 'false',
      }});
      setRequests(res.data.data || []);
    } catch (_) {}
    finally { setLoading(false); }
  }, [statusFilter, showArchived]);

  useEffect(() => { load(); }, [load]);
  useAutoRefresh(load);
  useEffect(() => {
    if (canManage) api.get('/users').then(r => setUsers(r.data.data || [])).catch(() => {});
  }, [canManage]);

  // Client-side filter: "Assigned to me" tab for non-managers
  const displayedRequests = !canManage && assignedFilter === 'mine'
    ? requests.filter(r => String(r.assigned_to) === String(user?.id))
    : requests;

  const openCounts = STATUSES.reduce((acc, s) => {
    acc[s] = requests.filter(r => r.status === s).length;
    return acc;
  }, {});

  return (
    <div>
      <div className="page-header">
        <div>
          <h2 className="page-title">
            {showArchived ? '🗄️ Archived Requests' : 'Open Requests'}
          </h2>
          {!showArchived && (
            <div className="flex gap-3 mt-1">
              {STATUSES.map(s => (
                <span key={s} className="text-xs text-slate-500 dark:text-gray-400">
                  {s}: <span className="text-slate-900 dark:text-white font-medium">{openCounts[s] || 0}</span>
                </span>
              ))}
            </div>
          )}
        </div>
        <div className="flex items-center gap-2">
          {canManage && (
            <button
              onClick={() => { setShowArchived(v => !v); setStatusFilter(''); }}
              className={`px-3 py-2 rounded-lg text-sm transition-all flex items-center gap-1.5 ${
                showArchived
                  ? 'bg-slate-700 text-white dark:bg-slate-600'
                  : 'bg-slate-100 dark:bg-navy-800 text-slate-500 dark:text-gray-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              🗄️ {showArchived ? 'Back to Active' : 'Archived'}
            </button>
          )}
          <button className="btn-primary" onClick={() => setShowForm(true)}>
            <PlusIcon className="w-4 h-4 inline mr-1.5" />New Request
          </button>
        </div>
      </div>

      {/* Status filter tabs — shown for managers on active view */}
      {canManage && !showArchived && (
        <div className="flex gap-2 mb-5">
          {['', ...STATUSES].map(s => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`px-3 py-1.5 rounded-lg text-sm transition-all ${statusFilter === s
                ? 'bg-gold-500 text-navy-950 font-medium'
                : 'bg-slate-100 dark:bg-navy-800 text-slate-500 dark:text-gray-400 hover:text-slate-900 dark:hover:text-white'}`}
            >
              {s || 'All'}
            </button>
          ))}
        </div>
      )}

      {/* Non-manager view tabs: My Submitted / Assigned to Me */}
      {!canManage && (
        <div className="flex gap-2 mb-5">
          {[['all', 'All My Requests'], ['mine', 'Assigned to Me']].map(([val, label]) => (
            <button
              key={val}
              onClick={() => setAssignedFilter(val)}
              className={`px-3 py-1.5 rounded-lg text-sm transition-all ${assignedFilter === val
                ? 'bg-gold-500 text-navy-950 font-medium'
                : 'bg-slate-100 dark:bg-navy-800 text-slate-500 dark:text-gray-400 hover:text-slate-900 dark:hover:text-white'}`}
            >
              {label}
            </button>
          ))}
        </div>
      )}

      {/* Manager: kanban columns */}
      {canManage ? (
        <div className="grid grid-cols-3 gap-4">
          {STATUSES.map(status => (
            <div key={status} className="bg-white dark:bg-navy-900 border border-slate-200 dark:border-navy-700 rounded-xl p-3">
              <div className="flex items-center justify-between mb-3">
                <Badge label={status} type="status" />
                <span className="text-slate-500 dark:text-gray-500 text-xs font-medium">{openCounts[status] || 0}</span>
              </div>
              <div className="space-y-2">
                {requests.filter(r => r.status === status).map(req => (
                  <div
                    key={req.id}
                    className="card p-3 text-sm cursor-pointer hover:border-gold-500/40 transition-all"
                    onClick={() => setSelectedId(req.id)}
                  >
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <span className="font-medium text-slate-900 dark:text-white text-xs line-clamp-2">{req.title}</span>
                      <Badge label={req.priority} type="priority" />
                    </div>
                    {req.client_name && <div className="text-gold-600 dark:text-gold-400 text-xs mb-1">{req.client_name}</div>}
                    <div className="flex items-center justify-between">
                      <span className="text-slate-500 dark:text-gray-500 text-xs">by {req.submitted_by_name}</span>
                      {req.assigned_to_name && (
                        <span className="text-xs text-blue-500 dark:text-blue-400 flex items-center gap-1">
                          <UserIcon className="w-3 h-3" />{req.assigned_to_name.split(' ')[0]}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
                {!requests.filter(r => r.status === status).length && (
                  <div className="text-center py-6 text-slate-400 dark:text-gray-600 text-xs">No requests</div>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : (
        /* Non-manager: list view */
        <div className="space-y-3">
          {loading ? (
            <div className="text-center py-16 text-slate-500 dark:text-gray-500">Loading...</div>
          ) : displayedRequests.length === 0 ? (
            <div className="empty-state">
              <BriefcaseIcon className="w-12 h-12 text-slate-300 dark:text-navy-700 mb-3" />
              <p className="text-slate-900 dark:text-white font-medium">
                {assignedFilter === 'mine' ? 'No requests assigned to you' : 'No requests yet'}
              </p>
            </div>
          ) : displayedRequests.map(req => (
            <div
              key={req.id}
              className="card flex items-start gap-4 cursor-pointer hover:border-gold-500/40 transition-all"
              onClick={() => setSelectedId(req.id)}
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap mb-1">
                  <span className="font-medium text-slate-900 dark:text-white">{req.title}</span>
                  <Badge label={req.priority} type="priority" />
                  <Badge label={req.status}   type="status"   />
                  {req.assigned_to_name && String(req.assigned_to) === String(user?.id) && (
                    <span className="text-xs px-1.5 py-0.5 rounded-full bg-blue-500/15 text-blue-600 dark:text-blue-400 font-medium">
                      Assigned to you
                    </span>
                  )}
                </div>
                {req.description && (
                  <p className="text-slate-500 dark:text-gray-400 text-sm line-clamp-2">{req.description}</p>
                )}
                {req.client_name && <p className="text-gold-600 dark:text-gold-400 text-xs mt-1">{req.client_name}</p>}
                <div className="flex items-center gap-3 mt-1">
                  <p className="text-slate-400 dark:text-gray-600 text-xs">{new Date(req.created_at).toLocaleDateString()}</p>
                  <span className="flex items-center gap-1 text-xs text-gold-600 dark:text-gold-400">
                    <ChatBubbleLeftRightIcon className="w-3.5 h-3.5" />
                    Click to view & reply
                  </span>
                </div>
              </div>
              {req.resolution && (
                <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-700/30 rounded-lg px-2 py-1 max-w-[200px] flex-shrink-0">
                  <p className="text-xs text-green-700 dark:text-green-400 font-medium">Resolution:</p>
                  <p className="text-xs text-green-800 dark:text-green-300 line-clamp-2">{req.resolution}</p>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* New Request Modal */}
      <Modal isOpen={showForm} onClose={() => setShowForm(false)} title="New Open Request" size="md">
        <RequestForm onSave={() => { setShowForm(false); load(); }} onClose={() => setShowForm(false)} />
      </Modal>

      {/* Detail + Reply Modal */}
      <Modal
        isOpen={!!selectedId}
        onClose={() => setSelectedId(null)}
        title="Request Details"
        size="lg"
        flush
      >
        {selectedId && (
          <RequestDetailModal
            requestId={selectedId}
            onClose={() => setSelectedId(null)}
            onUpdated={load}
            canManage={canManage}
            users={users}
            currentUser={user}
          />
        )}
      </Modal>
    </div>
  );
}
