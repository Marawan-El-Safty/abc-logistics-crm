import React, { Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider, useAuth } from './store/AuthContext';
import { ThemeProvider } from './store/ThemeContext';
import Layout from './components/layout/Layout';
import LoadingScreen from './components/common/LoadingScreen';
import ErrorBoundary from './components/common/ErrorBoundary';

const LoginPage = lazy(() => import('./pages/LoginPage'));
const DashboardPage = lazy(() => import('./pages/DashboardPage'));
const ClientsPage = lazy(() => import('./pages/ClientsPage'));
const ClientDetailPage = lazy(() => import('./pages/ClientDetailPage'));
const LeadsPage = lazy(() => import('./pages/LeadsPage'));
const LeadDetailPage = lazy(() => import('./pages/LeadDetailPage'));
const QuotationsPage = lazy(() => import('./pages/QuotationsPage'));
const QuotationFormPage = lazy(() => import('./pages/QuotationFormPage'));
const ActivitiesPage = lazy(() => import('./pages/ActivitiesPage'));
const TasksPage = lazy(() => import('./pages/TasksPage'));
const RequestsPage = lazy(() => import('./pages/RequestsPage'));
const ReportsPage = lazy(() => import('./pages/ReportsPage'));
const UsersPage = lazy(() => import('./pages/UsersPage'));
const FreightCalculatorPage = lazy(() => import('./pages/FreightCalculatorPage'));
const InvoicesPage = lazy(() => import('./pages/InvoicesPage'));
const ProfitPage = lazy(() => import('./pages/ProfitPage'));
const BankAccountsPage = lazy(() => import('./pages/BankAccountsPage'));
const ShippingRatesPage = lazy(() => import('./pages/ShippingRatesPage'));
const OperationsPage = lazy(() => import('./pages/OperationsPage'));
const ShipmentsPage = lazy(() => import('./pages/ShipmentsPage'));
const SalesInvoicesPage = lazy(() => import('./pages/SalesInvoicesPage'));
const SettingsPage = lazy(() => import('./pages/SettingsPage'));
const AuditPage = lazy(() => import('./pages/AuditPage'));
const EmailsPage = lazy(() => import('./pages/EmailsPage'));
const ComparisonsPage = lazy(() => import('./pages/ComparisonsPage'));
const NotFoundPage = lazy(() => import('./pages/NotFoundPage'));
const LandingPage = lazy(() => import('./pages/LandingPage'));
const RegisterPage = lazy(() => import('./pages/RegisterPage'));
const OnboardingPage = lazy(() => import('./pages/OnboardingPage'));
const TeamPage = lazy(() => import('./pages/TeamPage'));
const PricingPage = lazy(() => import('./pages/PricingPage'));
const TermsPage = lazy(() => import('./pages/TermsPage'));
const PrivacyPage = lazy(() => import('./pages/PrivacyPage'));
const AdminPage = lazy(() => import('./pages/AdminPage'));

const ProtectedRoute = ({ children, roles }) => {
  const { user, loading } = useAuth();
  if (loading) return <LoadingScreen />;
  if (!user) return <Navigate to="/login" replace />;
  if (roles && !roles.includes(user.role)) return <Navigate to="/" replace />;
  return children;
};

const AppRoutes = () => {
  const { user, loading } = useAuth();
  if (loading) return <LoadingScreen />;

  return (
    <Suspense fallback={<LoadingScreen />}>
      <Routes>
        {/* Public routes */}
        <Route path="/landing" element={<LandingPage />} />
        <Route path="/register" element={!user ? <RegisterPage /> : <Navigate to="/" replace />} />
        <Route path="/pricing" element={<PricingPage />} />
        <Route path="/terms" element={<TermsPage />} />
        <Route path="/privacy" element={<PrivacyPage />} />
        <Route path="/login" element={!user ? <LoginPage /> : <Navigate to="/" replace />} />
        <Route path="/" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
          <Route index element={<DashboardPage />} />
          <Route path="clients" element={<ClientsPage />} />
          <Route path="clients/:id" element={<ClientDetailPage />} />
          <Route path="leads" element={<LeadsPage />} />
          <Route path="leads/:id" element={<LeadDetailPage />} />
          <Route path="quotations" element={<QuotationsPage />} />
          <Route path="quotations/new" element={<QuotationFormPage />} />
          <Route path="quotations/:id/edit" element={<QuotationFormPage />} />
          <Route path="comparisons" element={<ComparisonsPage />} />
          <Route path="activities" element={<ActivitiesPage />} />
          <Route path="tasks" element={<TasksPage />} />
          <Route path="requests" element={
            <ProtectedRoute roles={['Admin', 'Sales Manager', 'Sales Rep']}>
              <RequestsPage />
            </ProtectedRoute>
          } />
          <Route path="invoices" element={
            <ProtectedRoute roles={['Admin', 'Finance']}>
              <InvoicesPage />
            </ProtectedRoute>
          } />
          <Route path="sales-invoices" element={
            <ProtectedRoute roles={['Admin', 'Sales Manager', 'Sales Rep']}>
              <SalesInvoicesPage />
            </ProtectedRoute>
          } />
          <Route path="calculator" element={<FreightCalculatorPage />} />
          <Route path="profit" element={
            <ProtectedRoute roles={['Admin', 'Sales Manager']}>
              <ProfitPage />
            </ProtectedRoute>
          } />
          <Route path="reports" element={
            <ProtectedRoute roles={['Admin', 'Sales Manager']}>
              <ReportsPage />
            </ProtectedRoute>
          } />
          <Route path="users" element={
            <ProtectedRoute roles={['Admin']}>
              <UsersPage />
            </ProtectedRoute>
          } />
          <Route path="bank-accounts" element={
            <ProtectedRoute roles={['Admin', 'Finance']}>
              <BankAccountsPage />
            </ProtectedRoute>
          } />
          <Route path="shipping-rates" element={<ShippingRatesPage />} />
          <Route path="operations" element={
            <ProtectedRoute roles={['Admin', 'Sales Manager', 'Operation']}>
              <OperationsPage />
            </ProtectedRoute>
          } />
          <Route path="shipments" element={
            <ProtectedRoute roles={['Admin', 'Sales Manager', 'Operation']}>
              <ShipmentsPage />
            </ProtectedRoute>
          } />
          <Route path="settings" element={
            <ProtectedRoute roles={['Admin']}>
              <SettingsPage />
            </ProtectedRoute>
          } />
          <Route path="audit" element={
            <ProtectedRoute roles={['Admin']}>
              <AuditPage />
            </ProtectedRoute>
          } />
          <Route path="emails" element={
            <ProtectedRoute roles={['Admin', 'Sales Manager', 'Sales Rep']}>
              <EmailsPage />
            </ProtectedRoute>
          } />
          <Route path="team" element={
            <ProtectedRoute roles={['Admin']}>
              <TeamPage />
            </ProtectedRoute>
          } />
          <Route path="onboarding" element={<OnboardingPage />} />
          <Route path="super-admin" element={<AdminPage />} />
        </Route>
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </Suspense>
  );
};

export default function App() {
  return (
    <BrowserRouter>
      <ThemeProvider>
        <AuthProvider>
          <ErrorBoundary>
            <AppRoutes />
          </ErrorBoundary>
          <Toaster
            position="top-right"
            toastOptions={{
              duration: 5000,
              // Base styles only (layout); colors come from theme-aware classes
              // below so toasts adapt to dark mode instead of always being light.
              style: {
                borderRadius: '14px',
                padding: '14px 18px',
                fontSize: '14px',
                fontWeight: '500',
                maxWidth: '420px',
                boxShadow: '0 8px 30px rgba(0,0,0,0.15)',
              },
              className:
                '!bg-white !text-slate-800 border border-slate-200 ' +
                'dark:!bg-navy-900 dark:!text-gray-100 dark:!border-navy-700',
              success: {
                iconTheme: { primary: '#10b981', secondary: '#fff' },
                className:
                  '!bg-green-50 !text-green-800 border border-green-200 ' +
                  'dark:!bg-green-500/10 dark:!text-green-300 dark:!border-green-500/30',
              },
              error: {
                iconTheme: { primary: '#ef4444', secondary: '#fff' },
                duration: 6000,
                className:
                  '!bg-red-50 !text-red-800 border border-red-200 ' +
                  'dark:!bg-red-500/10 dark:!text-red-300 dark:!border-red-500/30',
              },
            }}
          />
        </AuthProvider>
      </ThemeProvider>
    </BrowserRouter>
  );
}
