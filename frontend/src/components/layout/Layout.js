import React, { useEffect, useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import Sidebar from './Sidebar';
import Header from './Header';
import OfflineBanner from '../common/OfflineBanner';
import GlobalSearch from '../common/GlobalSearch';
import ErrorBoundary from '../common/ErrorBoundary';

const PAGE_TITLES = {
  '/': 'Dashboard',
  '/clients': 'Contacts',
  '/leads': 'Leads Pipeline',
  '/quotations': 'Quotations',
  '/calculator': 'Freight Rate Calculator',
  '/activities': 'Activities & Follow-ups',
  '/tasks': 'Tasks',
  '/requests': 'Open Requests',
  '/invoices': 'Invoices',
  '/reports': 'Reports & KPIs',
  '/users': 'User Management',
  '/shipping-rates': 'Shipping Rates',
  '/bank-accounts': 'Bank Accounts',
  '/profit': 'Profit & Margin',
  '/operations': 'Operations',
  '/shipments': 'Shipments',
  '/settings': 'Settings',
  '/audit': 'Trash',
};

// UX-6: Listen for the 'account-suspended' event dispatched by api.js when a
// 403 account_suspended response is received. Show a persistent red banner.
function SuspendedBanner() {
  const [suspended, setSuspended] = useState(
    () => localStorage.getItem('account_status') === 'suspended'
  );

  useEffect(() => {
    const handler = () => setSuspended(true);
    window.addEventListener('account-suspended', handler);
    return () => window.removeEventListener('account-suspended', handler);
  }, []);

  if (!suspended) return null;

  return (
    <div className="bg-red-600 text-white text-sm px-4 py-2 flex items-center justify-between z-50">
      <span>
        Your account is suspended. Contact{' '}
        <a href="mailto:support@freightos.app" className="underline font-medium">
          support@freightos.app
        </a>{' '}
        to reactivate. <strong>Read-only mode active.</strong>
      </span>
    </div>
  );
}

export default function Layout() {
  const location = useLocation();
  const title = PAGE_TITLES[location.pathname] || 'ABC Logistics CRM';

  return (
    <div className="flex h-screen bg-slate-50 dark:bg-navy-950 overflow-hidden">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <SuspendedBanner />
        <Header title={title} />
        <main className="flex-1 overflow-y-auto p-6">
          <ErrorBoundary inline key={location.pathname}>
            <Outlet />
          </ErrorBoundary>
        </main>
      </div>
      <OfflineBanner />
      <GlobalSearch />
    </div>
  );
}
