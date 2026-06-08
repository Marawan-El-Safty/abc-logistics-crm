import React, { useState } from 'react';
import toast from 'react-hot-toast';
import api from '../../services/api';

const ACTIVITY_TYPES = ['Call', 'Meeting', 'Email', 'Site Visit', 'WhatsApp', 'Note'];

export default function ActivityForm({ clientId, leadId, activity, onSave, onClose }) {
  const isEdit = !!activity;

  const [form, setForm] = useState({
    activityType:  activity?.activity_type        || 'Call',
    activityDate:  activity?.activity_date        ? activity.activity_date.slice(0, 16)        : new Date().toISOString().slice(0, 16),
    notes:         activity?.notes                || '',
    outcome:       activity?.outcome              || '',
    nextFollowUp:  activity?.next_follow_up       ? activity.next_follow_up.slice(0, 16)       : '',
    followUpNotes: activity?.follow_up_notes      || '',
  });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (isEdit) {
        await api.put(`/activities/${activity.id}`, form);
      } else {
        await api.post('/activities', {
          ...form,
          clientId: clientId || null,
          leadId:   leadId   || null,
        });
      }
      onSave();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Error saving activity');
    } finally { setLoading(false); }
  };

  return (
    <form onSubmit={handleSubmit}>
      <div className="grid grid-cols-2 gap-4">
        <div className="form-group">
          <label className="label">Activity Type</label>
          <select className="select" value={form.activityType} onChange={e => setForm({...form, activityType: e.target.value})}>
            {ACTIVITY_TYPES.map(t => <option key={t}>{t}</option>)}
          </select>
        </div>
        <div className="form-group">
          <label className="label">Date & Time</label>
          <input className="input" type="datetime-local" value={form.activityDate} onChange={e => setForm({...form, activityDate: e.target.value})} />
        </div>
        <div className="col-span-2 form-group">
          <label className="label">Notes</label>
          <textarea className="input" rows={3} placeholder="What was discussed..." value={form.notes} onChange={e => setForm({...form, notes: e.target.value})} />
        </div>
        <div className="col-span-2 form-group">
          <label className="label">Outcome</label>
          <input className="input" placeholder="Result of the activity..." value={form.outcome} onChange={e => setForm({...form, outcome: e.target.value})} />
        </div>
        <div className="form-group">
          <label className="label">Next Follow-up Date</label>
          <input className="input" type="datetime-local" value={form.nextFollowUp} onChange={e => setForm({...form, nextFollowUp: e.target.value})} />
        </div>
        <div className="form-group">
          <label className="label">Follow-up Notes</label>
          <input className="input" placeholder="What to follow up on..." value={form.followUpNotes} onChange={e => setForm({...form, followUpNotes: e.target.value})} />
        </div>
      </div>
      <div className="flex justify-end gap-3 mt-4">
        <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
        <button type="submit" className="btn-primary" disabled={loading}>
          {loading ? 'Saving...' : (isEdit ? 'Update Activity' : 'Log Activity')}
        </button>
      </div>
    </form>
  );
}
