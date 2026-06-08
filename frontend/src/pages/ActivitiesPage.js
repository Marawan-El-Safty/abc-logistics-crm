import React, { useState, useEffect, useCallback } from 'react';
import api from '../services/api';
import toast from 'react-hot-toast';
import {
  PlusIcon, ClipboardDocumentListIcon, PencilIcon, TrashIcon,
  CheckCircleIcon, UserIcon, CalendarIcon,
} from '@heroicons/react/24/outline';
import Badge from '../components/common/Badge';
import Modal from '../components/common/Modal';
import ConfirmDialog from '../components/common/ConfirmDialog';
import ActivityForm from '../components/activities/ActivityForm';
import { formatDistanceToNow } from 'date-fns';
import { useAutoRefresh } from '../hooks/useAutoRefresh';

const TYPES = ['Call', 'Meeting', 'Email', 'Site Visit', 'WhatsApp', 'Note'];
const LIMIT = 20;

// ── Activity Detail Modal ─────────────────────────────────────────────────────
function ActivityDetailModal({ act, onClose }) {
  const isOverdue = act.next_follow_up && new Date(act.next_follow_up) <= new Date();
  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-gold-500/15 flex items-center justify-center flex-shrink-0">
          <ClipboardDocumentListIcon className="w-5 h-5 text-gold-400" />
        </div>
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <Badge label={act.activity_type} />
            <span className="text-slate-500 dark:text-gray-400 text-sm">by <span className="font-medium text-slate-800 dark:text-gray-200">{act.performed_by_name}</span></span>
          </div>
          <div className="flex items-center gap-2 mt-0.5 text-xs text-slate-500 dark:text-gray-500">
            <CalendarIcon className="w-3.5 h-3.5" />
            <span>{new Date(act.activity_date).toLocaleString()}</span>
            <span>·</span>
            <span>{formatDistanceToNow(new Date(act.activity_date), { addSuffix: true })}</span>
          </div>
        </div>
      </div>

      {/* Linked to */}
      {(act.client_name || act.lead_company) && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-50 dark:bg-navy-800 border border-slate-200 dark:border-navy-700">
          <UserIcon className="w-4 h-4 text-slate-400 flex-shrink-0" />
          <span className="text-xs text-slate-500 dark:text-gray-400">Linked to</span>
          <span className="text-sm font-medium text-gold-600 dark:text-gold-400">{act.client_name || act.lead_company}</span>
        </div>
      )}

      {/* Notes */}
      <div>
        <p className="label mb-1">Notes</p>
        <p className="text-sm text-slate-700 dark:text-gray-300 whitespace-pre-wrap bg-slate-50 dark:bg-navy-800 rounded-lg p-3 border border-slate-200 dark:border-navy-700 min-h-[60px]">
          {act.notes || <span className="text-slate-400 dark:text-gray-500 italic">No notes recorded</span>}
        </p>
      </div>

      {/* Outcome */}
      {act.outcome && (
        <div>
          <p className="label mb-1">Outcome</p>
          <p className="text-sm text-slate-700 dark:text-gray-300 whitespace-pre-wrap">{act.outcome}</p>
        </div>
      )}

      {/* Follow-up */}
      {act.next_follow_up && (
        <div className={`p-3 rounded-lg border ${isOverdue
          ? 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-700/40'
          : 'bg-gold-50 dark:bg-gold-900/10 border-gold-200 dark:border-gold-700/30'}`}>
          <div className="flex items-center gap-2 mb-1">
            <CheckCircleIcon className={`w-4 h-4 ${isOverdue ? 'text-red-500' : 'text-gold-500'}`} />
            <span className={`text-xs font-semibold uppercase tracking-wider ${isOverdue ? 'text-red-600 dark:text-red-400' : 'text-gold-600 dark:text-gold-400'}`}>
              {isOverdue ? 'Follow-up Overdue' : 'Follow-up Scheduled'}
            </span>
          </div>
          <p className={`text-sm font-medium ${isOverdue ? 'text-red-700 dark:text-red-300' : 'text-gold-700 dark:text-gold-300'}`}>
            {new Date(act.next_follow_up).toLocaleDateString('en-GB', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
          </p>
          {act.follow_up_notes && (
            <p className="text-xs text-slate-600 dark:text-gray-400 mt-1">{act.follow_up_notes}</p>
          )}
        </div>
      )}

      <div className="flex justify-end pt-2 border-t border-slate-200 dark:border-navy-700">
        <button className="btn-secondary text-xs" onClick={onClose}>Close</button>
      </div>
    </div>
  );
}

export default function ActivitiesPage() {
  const [activities, setActivities]   = useState([]);
  const [total, setTotal]             = useState(0);
  const [page, setPage]               = useState(1);
  const [followUps, setFollowUps]     = useState([]);
  const [typeFilter, setTypeFilter]   = useState('');
  const [loading, setLoading]         = useState(true);
  const [showForm, setShowForm]       = useState(false);
  const [editTarget, setEditTarget]   = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [detailActivity, setDetailActivity] = useState(null);
  const [activeTab, setActiveTab]     = useState('all');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [activitiesRes, followUpsRes] = await Promise.all([
        api.get('/activities', { params: { type: typeFilter || undefined, limit: LIMIT, page } }),
        api.get('/activities/follow-ups/today'),
      ]);
      setActivities(activitiesRes.data.data || []);
      setTotal(activitiesRes.data.total || 0);
      setFollowUps(followUpsRes.data.data || []);
    } catch (_) {}
    finally { setLoading(false); }
  }, [typeFilter, page]);

  useEffect(() => { load(); }, [load]);
  useAutoRefresh(load);

  const handleDelete = async () => {
    try {
      await api.delete(`/activities/${deleteTarget.id}`);
      toast.success('Activity deleted');
      load();
    } catch (err) { toast.error(err.response?.data?.error || 'Error deleting activity'); }
  };

  const handleMarkDone = async (act) => {
    try {
      await api.patch(`/activities/${act.id}/done`);
      toast.success('Follow-up marked as done');
      load();
    } catch (err) { toast.error(err.response?.data?.error || 'Error updating activity'); }
  };

  const displayed = activeTab === 'followups' ? followUps : activities;

  return (
    <div>
      <div className="page-header">
        <div>
          <h2 className="page-title">Activities & Follow-ups</h2>
          {followUps.length > 0 && (
            <p className="text-gold-400 text-sm mt-0.5">{followUps.length} follow-up{followUps.length > 1 ? 's' : ''} due today</p>
          )}
        </div>
        <button className="btn-primary" onClick={() => setShowForm(true)}>
          <PlusIcon className="w-4 h-4 inline mr-1.5" />Log Activity
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-4">
        <button onClick={() => setActiveTab('all')} className={`px-4 py-2 rounded-lg text-sm transition-all ${activeTab === 'all' ? 'bg-gold-500 text-navy-950 font-medium' : 'bg-slate-100 dark:bg-navy-800 text-slate-500 dark:text-gray-400 hover:text-slate-900 dark:hover:text-white'}`}>
          All Activities
        </button>
        <button onClick={() => setActiveTab('followups')} className={`px-4 py-2 rounded-lg text-sm transition-all relative ${activeTab === 'followups' ? 'bg-gold-500 text-navy-950 font-medium' : 'bg-slate-100 dark:bg-navy-800 text-slate-500 dark:text-gray-400 hover:text-slate-900 dark:hover:text-white'}`}>
          Today's Follow-ups
          {followUps.length > 0 && (
            <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white text-xs rounded-full flex items-center justify-center">
              {followUps.length}
            </span>
          )}
        </button>
      </div>

      {activeTab === 'all' && (
        <div className="flex gap-2 mb-4 flex-wrap">
          {['', ...TYPES].map(t => (
            <button
              key={t}
              onClick={() => setTypeFilter(t)}
              className={`px-3 py-1 rounded text-xs transition-all ${typeFilter === t ? 'bg-gold-500 text-navy-950 font-medium' : 'bg-slate-100 dark:bg-navy-800 text-slate-500 dark:text-gray-400 hover:text-slate-900 dark:hover:text-white'}`}
            >
              {t || 'All'}
            </button>
          ))}
        </div>
      )}

      {loading ? (
        <div className="text-center py-16 text-gray-500">Loading...</div>
      ) : displayed.length === 0 ? (
        <div className="empty-state">
          <ClipboardDocumentListIcon className="w-12 h-12 text-slate-300 dark:text-navy-700 mb-3" />
          <p className="text-slate-900 dark:text-white font-medium">{activeTab === 'followups' ? 'No follow-ups due today' : 'No activities yet'}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {displayed.map(act => (
            <div key={act.id} className="card flex gap-4 cursor-pointer hover:border-gold-500/40 transition-all"
              onClick={() => setDetailActivity(act)}>
              <div className="w-10 h-10 rounded-xl bg-gold-500/15 flex items-center justify-center text-gold-400 flex-shrink-0 mt-0.5">
                <ClipboardDocumentListIcon className="w-5 h-5" />
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge label={act.activity_type} />
                  <span className="text-slate-500 dark:text-gray-400 text-sm">by {act.performed_by_name}</span>
                  <span className="text-gray-600 text-xs">•</span>
                  {act.client_name && <span className="text-gold-400 text-sm">{act.client_name}</span>}
                  {act.lead_company && <span className="text-blue-400 text-sm">{act.lead_company}</span>}
                </div>
                {act.notes   && <p className="text-slate-700 dark:text-gray-300 text-sm mt-1">{act.notes}</p>}
                {act.outcome && <p className="text-slate-500 dark:text-gray-400 text-xs mt-1">Outcome: {act.outcome}</p>}
                {act.next_follow_up && (
                  <p className={`text-xs mt-1 ${new Date(act.next_follow_up) <= new Date() ? 'text-red-400' : 'text-gold-400'}`}>
                    Follow-up: {new Date(act.next_follow_up).toLocaleDateString()}
                    {act.follow_up_notes && ` — ${act.follow_up_notes}`}
                  </p>
                )}
              </div>

              {/* Right: timestamp + actions */}
              <div className="flex flex-col items-end gap-2 flex-shrink-0" onClick={e => e.stopPropagation()}>
                <span className="text-slate-500 dark:text-gray-500 text-xs">
                  {formatDistanceToNow(new Date(act.activity_date), { addSuffix: true })}
                </span>
                <div className="flex items-center gap-1">
                  {/* Mark Done — only when there's an open follow-up */}
                  {act.next_follow_up && (
                    <button
                      title="Mark follow-up done"
                      onClick={() => handleMarkDone(act)}
                      className="p-1.5 rounded-lg text-green-400 hover:text-green-300 hover:bg-green-500/10 transition-colors"
                    >
                      <CheckCircleIcon className="w-4 h-4" />
                    </button>
                  )}
                  {/* Edit */}
                  <button
                    title="Edit activity"
                    onClick={() => setEditTarget(act)}
                    className="p-1.5 rounded-lg text-slate-400 dark:text-gray-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/10 transition-colors"
                  >
                    <PencilIcon className="w-4 h-4" />
                  </button>
                  {/* Delete */}
                  <button
                    title="Delete activity"
                    onClick={() => setDeleteTarget(act)}
                    className="p-1.5 rounded-lg text-slate-400 dark:text-gray-400 hover:text-red-500 dark:hover:text-red-400 hover:bg-red-500/10 transition-colors"
                  >
                    <TrashIcon className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {activeTab === 'all' && total > LIMIT && (
        <div className="flex items-center justify-between mt-4 text-sm text-slate-500 dark:text-gray-400">
          <span>Showing {(page - 1) * LIMIT + 1}–{Math.min(page * LIMIT, total)} of {total}</span>
          <div className="flex gap-2">
            <button className="btn-secondary" disabled={page === 1} onClick={() => setPage(p => p - 1)}>Previous</button>
            <button className="btn-secondary" disabled={page * LIMIT >= total} onClick={() => setPage(p => p + 1)}>Next</button>
          </div>
        </div>
      )}

      {/* Detail Modal */}
      <Modal isOpen={!!detailActivity} onClose={() => setDetailActivity(null)} title="Activity Details" size="md">
        {detailActivity && (
          <ActivityDetailModal act={detailActivity} onClose={() => setDetailActivity(null)} />
        )}
      </Modal>

      {/* Log new activity */}
      <Modal isOpen={showForm} onClose={() => setShowForm(false)} title="Log Activity" size="md">
        <ActivityForm onSave={() => { setShowForm(false); load(); }} onClose={() => setShowForm(false)} />
      </Modal>

      {/* Edit activity */}
      <Modal isOpen={!!editTarget} onClose={() => setEditTarget(null)} title="Edit Activity" size="md">
        <ActivityForm
          activity={editTarget}
          onSave={() => { setEditTarget(null); load(); toast.success('Activity updated'); }}
          onClose={() => setEditTarget(null)}
        />
      </Modal>

      {/* Delete confirm */}
      <ConfirmDialog
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="Delete Activity"
        message={`Delete this ${deleteTarget?.activity_type} activity? This cannot be undone.`}
        danger
      />
    </div>
  );
}
