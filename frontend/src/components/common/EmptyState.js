import React from 'react';

export default function EmptyState({ icon: Icon, title, description, action }) {
  return (
    <div className="empty-state">
      {Icon && <Icon className="w-12 h-12 text-slate-300 dark:text-navy-600 mb-4" />}
      <h3 className="text-slate-900 dark:text-white font-medium mb-1">{title}</h3>
      {description && <p className="text-sm text-slate-500 dark:text-gray-500 mb-4 max-w-xs">{description}</p>}
      {action}
    </div>
  );
}
