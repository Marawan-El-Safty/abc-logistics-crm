import React from 'react';
import { Link } from 'react-router-dom';

const FEATURE_LABELS = {
  sales_invoices: 'Sales Invoices',
  bl_documents: 'Bill of Lading Documents',
  reports_export: 'Reports & Export',
  audit_log: 'Audit Log',
};

export default function UpgradePrompt({ feature }) {
  const label = FEATURE_LABELS[feature] || feature;
  return (
    <div className="flex flex-col items-center justify-center py-24 text-center">
      <div className="text-5xl mb-4">🔒</div>
      <h2 className="text-xl font-semibold text-gray-800 mb-2">{label} is not included in your plan</h2>
      <p className="text-gray-500 mb-6 max-w-sm">
        Upgrade your plan to unlock this feature and more for your team.
      </p>
      <Link
        to="/pricing"
        className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium transition"
      >
        View Pricing
      </Link>
    </div>
  );
}
