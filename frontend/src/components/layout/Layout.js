import React, { useEffect, useState } from 'react';
import { Outlet, useLocation, Link } from 'react-router-dom';
import Sidebar from './Sidebar';
import Header from './Header';
import OfflineBanner from '../common/OfflineBanner';
import GlobalSearch from '../common/GlobalSearch';
import ErrorBoundary from '../common/ErrorBoundary';
import api from '../../services/api';

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
  '/team': 'Team Management',
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

function TrialBanner() {
  const [info, setInfo] = useState(null);
  useEffect(() => {
    api.get('/tenant/plan').then(r => setInfo(r.data)).catch(() => {});
  }, []);
  if (!info || info.tenant?.status !== 'trial') return null;
  const ends = info.tenant?.trialEndsAt ? new Date(info.tenant.trialEndsAt) : null;
  const daysLeft = ends ? Math.max(0, Math.ceil((ends - Date.now()) / 86400000)) : null;
  const urgent = daysLeft !== null && daysLeft <= 3;
  return (
    <div className={`${urgent ? 'bg-orange-600' : 'bg-amber-600'} text-white text-xs px-4 py-1.5 flex items-center justify-between`}>
      <span>
        🎉 Free trial — <strong>{daysLeft !== null ? `${daysLeft} day${daysLeft !== 1 ? 's' : ''} left` : 'active'}</strong>
        {' '}· <strong>{info.tenant?.plan?.charAt(0).toUpperCase() + info.tenant?.plan?.slice(1)}</strong> plan
        · {info.usage?.seats || 1} / {info.tenant?.seatLimit} seats used
      </span>
      <Link to="/pricing" className="ml-4 underline font-medium hover:no-underline">Upgrade plan →</Link>
    </div>
  );
}

export default function Layout() {
  const location = useLocation();
  const title = PAGE_TITLES[location.pathname] || 'FreightOS';

  return (
    <div className="flex h-screen bg-slate-50 dark:bg-navy-950 overflow-hidden">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <TrialBanner />
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
