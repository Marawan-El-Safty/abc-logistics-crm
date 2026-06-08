import React, { useState, useEffect, useCallback } from 'react';
import toast from 'react-hot-toast';
import api from '../services/api';
import {
  PlusIcon, CheckCircleIcon, CalendarIcon, TrashIcon,
  PencilIcon, UserIcon, ClockIcon, FlagIcon, XMarkIcon,
} from '@heroicons/react/24/outline';
import Badge from '../components/common/Badge';
import { TableSkeleton } from '../components/common/Skeleton';
import Modal from '../components/common/Modal';
import ConfirmDialog from '../components/common/ConfirmDialog';
import { useAuth } from '../store/AuthContext';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, isToday } from 'date-fns';
import { useAutoRefresh } from '../hooks/useAutoRefresh';

const STATUSES   = ['To Do', 'In Progress', 'Done'];
const PRIORITIES = ['Low', 'Medium', 'High', 'Urgent'];

const PRIORITY_COLOR = {
  'Urgent': 'text-red-500 dark:text-red-400',
  'High':   'text-orange-500 dark:text-orange-400',
  'Medium': 'text-yellow-600 dark:text-yellow-400',
  'Low':    'text-slate-500 dark:text-gray-400',
};

// ── Create Task Form ───────────────────────────────────────────────────────────
function TaskForm({ onSave, onClose, users }) {
  const { canManage } = useAuth();
  const [form, setForm] = useState({ title: '', description: '', dueDate: '', priority: 'Medium', assignedTo: '', clientId: '' });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await api.post('/tasks', form);
      onSave();
    } catch (err) { toast.error(err.response?.data?.error || 'Error creating task'); }
    finally { setLoading(false); }
  };

  return (
    <form onSubmit={handleSubmit}>
      <div className="form-group">
        <label className="label">Title *</label>
        <input className="input" required value={form.title} onChange={e => setForm({...form, title: e.target.value})} />
      </div>
      <div className="form-group">
        <label className="label">Description</label>
        <textarea className="input" rows={3} value={form.description} onChange={e => setForm({...form, description: e.target.value})} />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="form-group">
          <label className="label">Due Date</label>
          <input className="input" type="datetime-local" value={form.dueDate} onChange={e => setForm({...form, dueDate: e.target.value})} />
        </div>
        <div className="form-group">
          <label className="label">Priority</label>
          <select className="select" value={form.priority} onChange={e => setForm({...form, priority: e.target.value})}>
            {PRIORITIES.map(p => <option key={p}>{p}</option>)}
          </select>
        </div>
        {canManage && (
          <div className="form-group col-span-2">
            <label className="label">Assign To</label>
            <select className="select" value={form.assignedTo} onChange={e => setForm({...form, assignedTo: e.target.value})}>
              <option value="">Select rep...</option>
              {users.map(u => <option key={u.id} value={u.id}>{u.full_name}</option>)}
            </select>
          </div>
        )}
      </div>
      <div className="flex justify-end gap-3 mt-4">
        <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
        <button type="submit" className="btn-primary" disabled={loading}>{loading ? 'Creating...' : 'Create Task'}</button>
      </div>
    </form>
  );
}

// ── Task Detail Modal ──────────────────────────────────────────────────────────
function TaskDetailModal({ task, users, onClose, onUpdated, onDelete, canManage, isAdmin }) {
  const [editing, setEditing]   = useState(false);
  const [form, setForm]         = useState({
    title:       task.title       || '',
    description: task.description || '',
    dueDate:     task.due_date ? task.due_date.slice(0, 16) : '',
    priority:    task.priority    || 'Medium',
    status:      task.status      || 'To Do',
    assignedTo:  task.assigned_to || '',
  });
  const [saving, setSaving] = useState(false);

  const isOverdue = task.due_date && new Date(task.due_date) < new Date() && task.status !== 'Done';

  const handleSave = async () => {
    setSaving(true);
    try {
      await api.put(`/tasks/${task.id}`, form);
      toast.success('Task updated');
      onUpdated();
      setEditing(false);
    } catch (err) { toast.error(err.response?.data?.error || 'Error updating task'); }
    finally { setSaving(false); }
  };

  const handleStatusChange = async (status) => {
    try {
      await api.put(`/tasks/${task.id}`, { status });
      setForm(f => ({ ...f, status }));
      onUpdated();
    } catch (_) {}
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-start gap-3">
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0
          ${task.status === 'Done' ? 'bg-green-500/15' : 'bg-gold-500/15'}`}>
          <CheckCircleIcon className={`w-5 h-5 ${task.status === 'Done' ? 'text-green-400' : 'text-gold-400'}`} />
        </div>
        <div className="flex-1 min-w-0">
          {editing ? (
            <input className="input text-base font-semibold" value={form.title}
              onChange={e => setForm({...form, title: e.target.value})} />
          ) : (
            <h3 className={`text-base font-semibold text-slate-900 dark:text-white ${task.status === 'Done' ? 'line-through opacity-60' : ''}`}>
              {task.title}
            </h3>
          )}
          <div className="flex items-center gap-2 mt-1 flex-wrap">
            <Badge label={task.priority} type="priority" />
            <Badge label={task.status}   type="status"   />
            {isOverdue && <span className="text-xs text-red-500 font-medium">Overdue</span>}
          </div>
        </div>
        {canManage && !editing && (
          <button onClick={() => setEditing(true)}
            className="p-1.5 rounded-lg text-slate-400 hover:text-blue-400 hover:bg-blue-500/10 transition-colors flex-shrink-0">
            <PencilIcon className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Quick status change */}
      {!editing && (
        <div className="flex gap-2 flex-wrap">
          {STATUSES.map(s => (
            <button key={s}
              onClick={() => handleStatusChange(s)}
              className={`px-3 py-1 rounded-lg text-xs font-medium transition-all
                ${form.status === s
                  ? 'bg-gold-500 text-navy-950'
                  : 'bg-slate-100 dark:bg-navy-800 text-slate-500 dark:text-gray-400 hover:text-slate-900 dark:hover:text-white'}`}>
              {s}
            </button>
          ))}
        </div>
      )}

      {/* Description */}
      <div>
        <p className="label mb-1">Description</p>
        {editing ? (
          <textarea className="input" rows={4} value={form.description}
            onChange={e => setForm({...form, description: e.target.value})} />
        ) : (
          <p className="text-sm text-slate-700 dark:text-gray-300 whitespace-pre-wrap">
            {task.description || <span className="text-slate-400 dark:text-gray-500 italic">No description</span>}
          </p>
        )}
      </div>

      {/* Meta grid */}
      {editing ? (
        <div className="grid grid-cols-2 gap-4">
          <div className="form-group">
            <label className="label">Priority</label>
            <select className="select" value={form.priority} onChange={e => setForm({...form, priority: e.target.value})}>
              {PRIORITIES.map(p => <option key={p}>{p}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label className="label">Status</label>
            <select className="select" value={form.status} onChange={e => setForm({...form, status: e.target.value})}>
              {STATUSES.map(s => <option key={s}>{s}</option>)}
            </select>
          </div>
          <div className="form-group col-span-2">
            <label className="label">Due Date</label>
            <input className="input" type="datetime-local" value={form.dueDate}
              onChange={e => setForm({...form, dueDate: e.target.value})} />
          </div>
          {canManage && (
            <div className="form-group col-span-2">
              <label className="label">Assigned To</label>
              <select className="select" value={form.assignedTo} onChange={e => setForm({...form, assignedTo: e.target.value})}>
                <option value="">Unassigned</option>
                {users.map(u => <option key={u.id} value={u.id}>{u.full_name}</option>)}
              </select>
            </div>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div className="flex items-center gap-2">
            <UserIcon className="w-4 h-4 text-slate-400 flex-shrink-0" />
            <span className="text-slate-500 dark:text-gray-400">Assigned to</span>
            <span className="font-medium text-slate-800 dark:text-gray-200 ml-auto">{task.assigned_to_name || '—'}</span>
          </div>
          <div className="flex items-center gap-2">
            <UserIcon className="w-4 h-4 text-slate-400 flex-shrink-0" />
            <span className="text-slate-500 dark:text-gray-400">Assigned by</span>
            <span className="font-medium text-slate-800 dark:text-gray-200 ml-auto">{task.assigned_by_name || '—'}</span>
          </div>
          <div className="flex items-center gap-2">
            <ClockIcon className="w-4 h-4 text-slate-400 flex-shrink-0" />
            <span className="text-slate-500 dark:text-gray-400">Due date</span>
            <span className={`font-medium ml-auto ${isOverdue ? 'text-red-500 dark:text-red-400' : 'text-slate-800 dark:text-gray-200'}`}>
              {task.due_date ? new Date(task.due_date).toLocaleString() : '—'}
            </span>
          </div>
          {task.completed_at && (
            <div className="flex items-center gap-2">
              <CheckCircleIcon className="w-4 h-4 text-green-400 flex-shrink-0" />
              <span className="text-slate-500 dark:text-gray-400">Completed</span>
              <span className="font-medium text-green-500 dark:text-green-400 ml-auto">{new Date(task.completed_at).toLocaleDateString()}</span>
            </div>
          )}
          {task.client_name && (
            <div className="flex items-center gap-2 col-span-2">
              <FlagIcon className="w-4 h-4 text-slate-400 flex-shrink-0" />
              <span className="text-slate-500 dark:text-gray-400">Client</span>
              <span className="font-medium text-gold-600 dark:text-gold-400 ml-auto">{task.client_name}</span>
            </div>
          )}
          <div className="flex items-center gap-2 col-span-2">
            <ClockIcon className="w-4 h-4 text-slate-400 flex-shrink-0" />
            <span className="text-slate-500 dark:text-gray-400">Created</span>
            <span className="font-medium text-slate-800 dark:text-gray-200 ml-auto">{new Date(task.created_at).toLocaleDateString()}</span>
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center justify-between pt-2 border-t border-slate-200 dark:border-navy-700">
        <div className="flex gap-2">
          {isAdmin && (
            <button onClick={onDelete}
              className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg text-red-500 hover:bg-red-500/10 transition-colors">
              <TrashIcon className="w-3.5 h-3.5" /> Delete
            </button>
          )}
        </div>
        {editing ? (
          <div className="flex gap-2">
            <button className="btn-secondary text-xs" onClick={() => setEditing(false)}>Cancel</button>
            <button className="btn-primary text-xs" disabled={saving} onClick={handleSave}>
              {saving ? 'Saving…' : 'Save Changes'}
            </button>
          </div>
        ) : (
          <button className="btn-secondary text-xs" onClick={onClose}>Close</button>
        )}
      </div>
    </div>
  );
}

// ── Main Page ──────────────────────────────────────────────────────────────────
export default function TasksPage() {
  const [tasks, setTasks]           = useState([]);
  const [calendarEvents, setCalendarEvents] = useState([]);
  const [view, setView]             = useState('list');
  const [statusFilter, setStatusFilter]     = useState('');
  const [priorityFilter, setPriorityFilter] = useState('');
  const [loading, setLoading]       = useState(true);
  const [showForm, setShowForm]     = useState(false);
  const [detailTask, setDetailTask] = useState(null);
  const [deleteTarget, setDeleteTarget]     = useState(null);
  const [users, setUsers]           = useState([]);
  const [currentMonth, setCurrentMonth]     = useState(new Date());
  const { canManage, isAdmin } = useAuth();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/tasks', { params: { status: statusFilter || undefined, priority: priorityFilter || undefined } });
      setTasks(res.data.data || []);
    } catch (_) {}
    finally { setLoading(false); }
  }, [statusFilter, priorityFilter]);

  const loadCalendar = useCallback(async () => {
    try {
      const from = format(startOfMonth(currentMonth), 'yyyy-MM-dd');
      const to   = format(endOfMonth(currentMonth), 'yyyy-MM-dd');
      const res  = await api.get('/tasks/calendar', { params: { from, to } });
      setCalendarEvents(res.data.data || []);
    } catch (_) {}
  }, [currentMonth]);

  useEffect(() => { load(); }, [load]);
  useAutoRefresh(load);
  useEffect(() => { if (view === 'calendar') loadCalendar(); }, [view, loadCalendar]);
  useEffect(() => {
    if (canManage) api.get('/users').then(r => setUsers(r.data.data || [])).catch(() => {});
  }, [canManage]);

  const handleDelete = async () => {
    try {
      await api.delete(`/tasks/${deleteTarget.id}`);
      toast.success('Task deleted');
      setDeleteTarget(null);
      setDetailTask(null);
      load();
    } catch (err) { toast.error(err.response?.data?.error || 'Error deleting task'); }
  };

  const days          = eachDayOfInterval({ start: startOfMonth(currentMonth), end: endOfMonth(currentMonth) });
  const firstDayOfWeek = startOfMonth(currentMonth).getDay();

  return (
    <div>
      <div className="page-header">
        <div>
          <h2 className="page-title">Tasks</h2>
          <p className="text-slate-500 dark:text-gray-400 text-sm">{tasks.filter(t => t.status !== 'Done').length} pending tasks</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex bg-slate-100 dark:bg-navy-800 rounded-lg p-1">
            <button onClick={() => setView('list')}
              className={`px-3 py-1.5 rounded text-sm transition-all ${view === 'list' ? 'bg-white dark:bg-navy-700 text-slate-900 dark:text-white shadow-sm' : 'text-slate-500 dark:text-gray-400'}`}>
              List
            </button>
            <button onClick={() => setView('calendar')}
              className={`px-3 py-1.5 rounded text-sm transition-all ${view === 'calendar' ? 'bg-white dark:bg-navy-700 text-slate-900 dark:text-white shadow-sm' : 'text-slate-500 dark:text-gray-400'}`}>
              <CalendarIcon className="w-4 h-4 inline mr-1" />Calendar
            </button>
          </div>
          <button className="btn-primary" onClick={() => setShowForm(true)}>
            <PlusIcon className="w-4 h-4 inline mr-1.5" />Add Task
          </button>
        </div>
      </div>

      {view === 'list' && (
        <>
          <div className="flex gap-3 mb-4">
            <select className="select w-40" value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
              <option value="">All Statuses</option>
              {STATUSES.map(s => <option key={s}>{s}</option>)}
            </select>
            <select className="select w-40" value={priorityFilter} onChange={e => setPriorityFilter(e.target.value)}>
              <option value="">All Priorities</option>
              {PRIORITIES.map(p => <option key={p}>{p}</option>)}
            </select>
          </div>

          {loading ? (
            <TableSkeleton rows={6} cols={5} />
          ) : tasks.length === 0 ? (
            <div className="empty-state">
              <CheckCircleIcon className="w-12 h-12 text-slate-300 dark:text-navy-700 mb-3" />
              <p className="text-slate-900 dark:text-white font-medium">No tasks</p>
            </div>
          ) : (
            <div className="space-y-2">
              {tasks.map(task => {
                const isOverdue = task.due_date && new Date(task.due_date) < new Date() && task.status !== 'Done';
                return (
                  <div
                    key={task.id}
                    className={`card flex items-start gap-4 cursor-pointer hover:border-gold-500/40 transition-all ${task.status === 'Done' ? 'opacity-60' : ''}`}
                    onClick={() => setDetailTask(task)}
                  >
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5
                      ${task.status === 'Done' ? 'bg-green-500/15' : 'bg-gold-500/15'}`}>
                      <CheckCircleIcon className={`w-5 h-5 ${task.status === 'Done' ? 'text-green-400' : 'text-gold-400'}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <span className={`font-medium text-slate-900 dark:text-white text-sm ${task.status === 'Done' ? 'line-through' : ''}`}>
                          {task.title}
                        </span>
                        <Badge label={task.priority} type="priority" />
                        <Badge label={task.status}   type="status"   />
                      </div>
                      {task.description && (
                        <p className="text-slate-500 dark:text-gray-400 text-xs mb-1 line-clamp-1">{task.description}</p>
                      )}
                      <div className="flex items-center gap-3 text-xs text-slate-500 dark:text-gray-500 flex-wrap">
                        {task.assigned_to_name && <span>👤 {task.assigned_to_name}</span>}
                        {task.client_name      && <span>🏢 {task.client_name}</span>}
                        {task.due_date && (
                          <span className={isOverdue ? 'text-red-500 dark:text-red-400 font-medium' : ''}>
                            🕐 {new Date(task.due_date).toLocaleDateString()}
                            {isOverdue && ' — Overdue'}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0" onClick={e => e.stopPropagation()}>
                      <select
                        className="select w-32 text-xs"
                        value={task.status}
                        onChange={e => { api.put(`/tasks/${task.id}`, { status: e.target.value }).then(load); }}
                      >
                        {STATUSES.map(s => <option key={s}>{s}</option>)}
                      </select>
                      {isAdmin && (
                        <button
                          className="p-1.5 rounded-lg text-slate-400 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                          onClick={() => setDeleteTarget(task)}
                        >
                          <TrashIcon className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {view === 'calendar' && (
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-slate-900 dark:text-white font-semibold">{format(currentMonth, 'MMMM yyyy')}</h3>
            <div className="flex gap-2">
              <button className="btn-secondary text-xs" onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1))}>←</button>
              <button className="btn-secondary text-xs" onClick={() => setCurrentMonth(new Date())}>Today</button>
              <button className="btn-secondary text-xs" onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1))}>→</button>
            </div>
          </div>
          <div className="grid grid-cols-7 gap-1 mb-2">
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => (
              <div key={d} className="text-center text-xs text-slate-500 dark:text-gray-500 font-medium py-1">{d}</div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {Array.from({ length: firstDayOfWeek }).map((_, i) => <div key={`empty-${i}`} />)}
            {days.map(day => {
              const dayEvents = calendarEvents.filter(e => isSameDay(new Date(e.date), day));
              return (
                <div key={day.toISOString()}
                  className={`min-h-[70px] p-1 rounded-lg border ${isToday(day)
                    ? 'border-gold-500/50 bg-gold-500/5'
                    : 'border-slate-200 dark:border-navy-800'}`}>
                  <div className={`text-xs font-medium mb-1 ${isToday(day) ? 'text-gold-500 dark:text-gold-400' : 'text-slate-500 dark:text-gray-400'}`}>
                    {format(day, 'd')}
                  </div>
                  {dayEvents.slice(0, 3).map(event => (
                    <div key={event.id}
                      className={`text-xs px-1 py-0.5 rounded truncate mb-0.5
                        ${event.event_type === 'task' ? 'bg-blue-500/20 text-blue-600 dark:text-blue-300' : 'bg-gold-500/20 text-gold-600 dark:text-gold-300'}`}>
                      {event.title}
                    </div>
                  ))}
                  {dayEvents.length > 3 && <div className="text-xs text-slate-400 dark:text-gray-500">+{dayEvents.length - 3} more</div>}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Create Modal */}
      <Modal isOpen={showForm} onClose={() => setShowForm(false)} title="New Task" size="md">
        <TaskForm onSave={() => { setShowForm(false); load(); }} onClose={() => setShowForm(false)} users={users} />
      </Modal>

      {/* Detail Modal */}
      <Modal isOpen={!!detailTask} onClose={() => setDetailTask(null)} title="Task Details" size="md">
        {detailTask && (
          <TaskDetailModal
            task={detailTask}
            users={users}
            canManage={canManage}
            isAdmin={isAdmin}
            onClose={() => setDetailTask(null)}
            onUpdated={() => { load(); }}
            onDelete={() => { setDeleteTarget(detailTask); setDetailTask(null); }}
          />
        )}
      </Modal>

      <ConfirmDialog
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="Delete Task"
        message={`Delete task "${deleteTarget?.title}"? This cannot be undone.`}
        danger
      />
    </div>
  );
}
