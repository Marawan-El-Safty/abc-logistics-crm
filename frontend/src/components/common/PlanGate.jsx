import React from 'react';
import { usePlan } from '../../hooks/usePlan';
import UpgradePrompt from './UpgradePrompt';

/**
 * Renders children only if the current tenant's plan includes `feature`.
 * Shows an upgrade prompt otherwise.
 *
 * Usage:
 *   <PlanGate feature="audit_log">
 *     <AuditPage />
 *   </PlanGate>
 */
export default function PlanGate({ feature, children }) {
  const { hasFeature, loading } = usePlan();

  // UX-1: Show a skeleton placeholder while plan data loads instead of null
  // (null causes content flash / layout shift on slow connections)
  if (loading) return (
    <div className="animate-pulse bg-gray-100 rounded-lg h-32 w-full" aria-label="Loading..." />
  );

  if (!hasFeature(feature)) return <UpgradePrompt feature={feature} />;
  return <>{children}</>;
}
