import React, { useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { useAuth } from '../../store/AuthContext';
import { useTheme } from '../../store/ThemeContext';
import {
  HomeIcon, UserGroupIcon, FunnelIcon, DocumentTextIcon,
  ClipboardDocumentListIcon, CheckCircleIcon, BriefcaseIcon,
  DocumentDuplicateIcon, ChartBarIcon, UsersIcon, BellIcon,
  ChevronLeftIcon, ChevronRightIcon,
  ArrowRightOnRectangleIcon, CalculatorIcon, BanknotesIcon,
  CurrencyDollarIcon, BuildingLibraryIcon, TruckIcon, RocketLaunchIcon,
  Cog6ToothIcon, ShieldCheckIcon, ArrowsRightLeftIcon,
  SunIcon, MoonIcon, EnvelopeIcon,
} from '@heroicons/react/24/outline';

const NAV_ITEMS = [
  { to: '/', label: 'Dashboard', icon: HomeIcon, roles: ['Admin', 'Sales Manager', 'Sales Rep', 'Finance', 'Operation'] },
  { to: '/clients', label: 'Contacts', icon: UserGroupIcon, roles: ['Admin', 'Sales Manager', 'Sales Rep', 'Finance', 'Operation'] },
  { to: '/leads', label: 'Leads', icon: FunnelIcon, roles: ['Admin', 'Sales Manager', 'Sales Rep'] },
  { to: '/quotations', label: 'Quotations', icon: DocumentTextIcon, roles: ['Admin', 'Sales Manager', 'Sales Rep', 'Finance', 'Operation'] },
  { to: '/operations', label: 'Operations', icon: RocketLaunchIcon, roles: ['Admin', 'Sales Manager', 'Operation'] },
  { to: '/shipments', label: 'Shipments', icon: ArrowsRightLeftIcon, roles: ['Admin', 'Sales Manager', 'Operation'] },
  { to: '/invoices', label: 'Invoices', icon: CurrencyDollarIcon, roles: ['Admin', 'Finance'] },
  { to: '/sales-invoices', label: 'Sales Invoices', icon: DocumentTextIcon, roles: ['Admin', 'Sales Manager', 'Sales Rep'] },
  { to: '/calculator', label: 'Rate Calculator', icon: CalculatorIcon, roles: ['Admin', 'Sales Manager', 'Sales Rep'] },
  { to: '/emails', label: 'Emails', icon: EnvelopeIcon, roles: ['Admin', 'Sales Manager', 'Sales Rep'] },
  { to: '/activities', label: 'Activities', icon: ClipboardDocumentListIcon, roles: ['Admin', 'Sales Manager', 'Sales Rep'] },
  { to: '/tasks', label: 'Tasks', icon: CheckCircleIcon, roles: ['Admin', 'Sales Manager', 'Sales Rep'] },
  { to: '/requests', label: 'Open Requests', icon: BriefcaseIcon, roles: ['Admin', 'Sales Manager', 'Sales Rep'] },
  { to: '/profit', label: 'Profit & Margin', icon: BanknotesIcon, roles: ['Admin', 'Sales Manager'] },
  { to: '/reports', label: 'Reports & KPIs', icon: ChartBarIcon, roles: ['Admin', 'Sales Manager'] },
  { to: '/users', label: 'Users', icon: UsersIcon, roles: ['Admin'] },
  { to: '/shipping-rates', label: 'Shipping Rates', icon: TruckIcon, roles: ['Admin', 'Sales Manager', 'Sales Rep', 'Finance', 'Operation'] },
  { to: '/bank-accounts', label: 'Bank Accounts', icon: BuildingLibraryIcon, roles: ['Admin', 'Finance'] },
  { to: '/audit', label: 'Trash', icon: ShieldCheckIcon, roles: ['Admin'] },
  { to: '/settings', label: 'Settings', icon: Cog6ToothIcon, roles: ['Admin'] },
];

export default function Sidebar() {
  const { user, logout, canManage } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [collapsed, setCollapsed] = useState(false);
  const location = useLocation();

  const visibleItems = NAV_ITEMS.filter(item => item.roles.includes(user?.role));

  return (
    <aside className={`bg-white dark:bg-navy-950 border-r border-slate-200 dark:border-navy-800 flex flex-col transition-all duration-300 ${collapsed ? 'w-16' : 'w-64'} flex-shrink-0`}>
      {/* Logo */}
      <div className="h-16 flex items-center px-4 border-b border-slate-200 dark:border-navy-800 flex-shrink-0">
        {!collapsed ? (
          <div className="flex items-center gap-3">
            <img
              src="/logo.svg"
              alt="ABC Logistics"
              className="h-9 object-contain"
              onError={(e) => { e.target.style.display = 'none'; }}
            />
            <div>
              <div className="text-slate-900 dark:text-white font-bold text-sm leading-tight">ABC Logistics</div>
              <div className="text-gold-600 dark:text-gold-500 text-xs">CRM</div>
            </div>
          </div>
        ) : (
          <img
            src="/logo.svg"
            alt="SG"
            className="h-8 object-contain mx-auto"
            onError={(e) => { e.target.style.display = 'none'; }}
          />
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 py-4 overflow-y-auto">
        {visibleItems.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            className={({ isActive }) =>
              `flex items-center gap-3 px-4 py-2.5 mx-2 rounded-lg transition-all duration-200 text-sm font-medium group
               ${isActive
                ? 'bg-gold-500/15 text-gold-600 dark:text-gold-400 border border-gold-500/20'
                : 'text-slate-500 dark:text-gray-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-navy-800'}`
            }
            title={collapsed ? label : undefined}
          >
            <Icon className="w-5 h-5 flex-shrink-0" />
            {!collapsed && <span>{label}</span>}
          </NavLink>
        ))}
      </nav>

      {/* User info + collapse */}
      <div className="border-t border-slate-200 dark:border-navy-800 p-3 flex-shrink-0">
        {!collapsed && (
          <div className="flex items-center gap-2 px-2 py-2 mb-2 rounded-lg bg-slate-50 dark:bg-navy-900">
            <div className="w-8 h-8 rounded-full bg-gold-500 flex items-center justify-center text-navy-950 font-bold text-sm flex-shrink-0">
              {user?.fullName?.[0]?.toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-slate-900 dark:text-white text-xs font-semibold truncate">{user?.fullName}</div>
              <div className="text-slate-500 dark:text-gray-500 text-xs truncate">{user?.role}</div>
            </div>
          </div>
        )}
        <div className="flex items-center gap-1">
          <button
            onClick={logout}
            className="flex items-center gap-2 text-slate-500 dark:text-gray-500 hover:text-red-500 dark:hover:text-red-400 transition-colors text-xs px-2 py-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-navy-800 flex-1"
            title="Logout"
            aria-label="Logout"
          >
            <ArrowRightOnRectangleIcon className="w-4 h-4 flex-shrink-0" />
            {!collapsed && <span>Logout</span>}
          </button>
          <button
            onClick={toggleTheme}
            className="p-1.5 rounded-lg text-slate-500 dark:text-gray-500 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-navy-800 transition-colors flex-shrink-0"
            title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
            aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
          >
            {theme === 'dark' ? <SunIcon className="w-4 h-4" /> : <MoonIcon className="w-4 h-4" />}
          </button>
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="text-slate-500 dark:text-gray-500 hover:text-slate-900 dark:hover:text-white p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-navy-800 transition-colors flex-shrink-0"
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {collapsed ? <ChevronRightIcon className="w-4 h-4" /> : <ChevronLeftIcon className="w-4 h-4" />}
          </button>
        </div>
      </div>
    </aside>
  );
}
