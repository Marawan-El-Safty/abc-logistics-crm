import React from 'react';

const STAGE_COLORS = {
  'New Lead': 'badge-blue',
  'Contacted': 'badge-yellow',
  'Proposal Sent': 'badge-purple',
  'Negotiating': 'badge-gold',
  'Won': 'badge-green',
  'Lost': 'badge-red',
};

const STATUS_COLORS = {
  Draft: 'badge-gray',
  'Pending Review': 'badge-orange',
  Approved: 'badge-purple',
  Confirmed: 'badge-green',
  Sent: 'badge-blue',
  Accepted: 'badge-green',
  Rejected: 'badge-red',
  Open: 'badge-yellow',
  'In Progress': 'badge-blue',
  Closed: 'badge-green',
  'To Do': 'badge-gray',
  Done: 'badge-green',
  Pending: 'badge-yellow',
  Paid: 'badge-green',
  Overdue: 'badge-red',
};

const PRIORITY_COLORS = {
  Low: 'badge-gray',
  Medium: 'badge-blue',
  High: 'badge-yellow',
  Urgent: 'badge-red',
};

export default function Badge({ label, type = 'auto' }) {
  let cls = 'badge-gray';
  if (type === 'stage') cls = STAGE_COLORS[label] || 'badge-gray';
  else if (type === 'status') cls = STATUS_COLORS[label] || 'badge-gray';
  else if (type === 'priority') cls = PRIORITY_COLORS[label] || 'badge-gray';
  else cls = STATUS_COLORS[label] || STAGE_COLORS[label] || PRIORITY_COLORS[label] || 'badge-gray';

  return <span className={cls}>{label}</span>;
}
