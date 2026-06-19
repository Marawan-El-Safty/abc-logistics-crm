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
  SunIcon, MoonIcon, EnvelopeIcon, TableCellsIcon, UserPlusIcon,
} from '@heroicons/react/24/outline';

const NAV_ITEMS = [
  { to: '/', label: 'Dashboard', icon: HomeIcon, roles: ['Admin', 'Sales Manager', 'Sales Rep', 'Finance', 'Operation', 'Viewer'] },
  { to: '/clients', label: 'Contacts', icon: UserGroupIcon, roles: ['Admin', 'Sales Manager', 'Sales Rep', 'Finance', 'Operation'] },
  { to: '/leads', label: 'Leads', icon: FunnelIcon, roles: ['Admin', 'Sales Manager', 'Sales Rep'] },
  { to: '/quotations', label: 'Quotations', icon: DocumentTextIcon, roles: ['Admin', 'Sales Manager', 'Sales Rep', 'Finance', 'Operation'] },
  { to: '/comparisons', label: 'Comparisons', icon: TableCellsIcon, roles: ['Admin', 'Sales Manager', 'Sales Rep', 'Finance'] },
  { to: '/operations', label: 'Operations', icon: RocketLaunchIcon, roles: ['Admin', 'Sales Manager', 'Operation'] },
  { to: '/shipments', label: 'Shipments', icon: ArrowsRightLeftIcon, roles: ['Admin', 'Sales Manager', 'Operation'] },
  { to: '/invoices', label: 'Invoices', icon: CurrencyDollarIcon, roles: ['Admin', 'Finance'] },
  { to: '/calculator', label: 'Rate Calculator', icon: CalculatorIcon, roles: ['Admin', 'Sales Manager', 'Sales Rep'] },
  { to: '/emails', label: 'Emails', icon: EnvelopeIcon, roles: ['Admin', 'Sales Manager', 'Sales Rep'] },
  { to: '/activities', label: 'Activities', icon: ClipboardDocumentListIcon, roles: ['Admin', 'Sales Manager', 'Sales Rep'] },
  { to: '/requests', label: 'Open Requests', icon: BriefcaseIcon, roles: ['Admin', 'Sales Manager', 'Sales Rep'] },
  { to: '/profit', label: 'Profit & Margin', icon: BanknotesIcon, roles: ['Admin', 'Sales Manager'] },
  { to: '/reports', label: 'Reports & KPIs', icon: ChartBarIcon, roles: ['Admin', 'Sales Manager', 'Viewer'] },
  { to: '/shipping-rates', label: 'Shipping Rates', icon: TruckIcon, roles: ['Admin', 'Sales Manager', 'Sales Rep', 'Finance', 'Operation'] },
  { to: '/bank-accounts', label: 'Bank Accounts', icon: BuildingLibraryIcon, roles: ['Admin', 'Finance'] },
  { to: '/team', label: 'Team', icon: UserPlusIcon, roles: ['Admin'] },
  { to: '/audit', label: 'Trash', icon: ShieldCheckIcon, roles: ['Admin'] },
  { to: '/settings', label: 'Settings', icon: Cog6ToothIcon, roles: ['Admin'] },
];

export default function Sidebar() {
  const { user, logout, isOwner } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [collapsed, setCollapsed] = useState(false);

  const visibleItems = NAV_ITEMS.filter(item => item.roles.includes(user?.role));

  return (
    <aside className={`bg-slate-900 flex flex-col transition-all duration-300 ${collapsed ? 'w-16' : 'w-64'} flex-shrink-0`}>
      {/* Logo */}
      <div className="h-16 flex items-center px-4 border-b border-slate-800 flex-shrink-0">
        {!collapsed ? (
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-amber-500 flex items-center justify-center flex-shrink-0">
              <TruckIcon className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="text-white font-bold text-sm leading-tight">FreightOS</div>
              <div className="text-amber-400 text-xs">Freight Management</div>
            </div>
          </div>
        ) : (
          <div className="w-8 h-8 rounded-lg bg-amber-500 flex items-center justify-center mx-auto">
            <TruckIcon className="w-5 h-5 text-white" />
          </div>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 py-3 overflow-y-auto">
        {visibleItems.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 mx-2 rounded-lg transition-all duration-150 text-sm font-medium group
               ${isActive
                ? 'bg-amber-500/10 text-amber-400 border-l-2 border-amber-400'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'}`
            }
            title={collapsed ? label : undefined}
          >
            <Icon className="w-5 h-5 flex-shrink-0" />
            {!collapsed && <span>{label}</span>}
          </NavLink>
        ))}
      </nav>

      {/* User info + controls */}
      <div className="border-t border-slate-800 p-3 flex-shrink-0">
        {!collapsed && (
          <div className="flex items-center gap-2 px-2 py-2 mb-2 rounded-lg bg-slate-800">
            <div className="w-8 h-8 rounded-full bg-amber-500 flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
              {user?.fullName?.[0]?.toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-white text-xs font-semibold truncate">{user?.fullName}</div>
              <div className="text-slate-400 text-xs truncate flex items-center gap-1">
                {user?.role}
                {isOwner && <span className="text-amber-400 text-[10px] font-bold">· OWNER</span>}
              </div>
            </div>
          </div>
        )}
        <div className="flex items-center gap-1">
          <button
            onClick={logout}
            className="flex items-center gap-2 text-slate-400 hover:text-red-400 transition-colors text-xs px-2 py-1.5 rounded-lg hover:bg-slate-800 flex-1"
            title="Logout"
          >
            <ArrowRightOnRectangleIcon className="w-4 h-4 flex-shrink-0" />
            {!collapsed && <span>Logout</span>}
          </button>
          <button
            onClick={toggleTheme}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors flex-shrink-0"
            title={theme === 'dark' ? 'Light mode' : 'Dark mode'}
          >
            {theme === 'dark' ? <SunIcon className="w-4 h-4" /> : <MoonIcon className="w-4 h-4" />}
          </button>
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="text-slate-400 hover:text-white p-1.5 rounded-lg hover:bg-slate-800 transition-colors flex-shrink-0"
          >
            {collapsed ? <ChevronRightIcon className="w-4 h-4" /> : <ChevronLeftIcon className="w-4 h-4" />}
          </button>
        </div>
      </div>
    </aside>
  );
}
