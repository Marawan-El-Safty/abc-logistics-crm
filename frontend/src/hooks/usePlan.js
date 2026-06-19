import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../store/AuthContext';
import api from '../services/api';

let _cache = null;
let _cacheTs = 0;
const CACHE_TTL = 5 * 60 * 1000;

// UX-5: Exported so logout handlers can clear the plan cache immediately,
// preventing a stale plan from being served to the next user on the same device.
export function clearPlanCache() {
  _cache = null;
  _cacheTs = 0;
}

export function usePlan() {
  const { user } = useAuth();
  const [plan, setPlan] = useState(_cache);
  const [loading, setLoading] = useState(!_cache);

  const refresh = useCallback(async () => {
    if (!user || user.is_superadmin) return;
    if (_cache && Date.now() - _cacheTs < CACHE_TTL) { setPlan(_cache); setLoading(false); return; }
    try {
      const { data } = await api.get('/tenant/plan');
      _cache = data;
      _cacheTs = Date.now();
      setPlan(data);
    } catch (_) {
      // degraded — no plan info
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => { refresh(); }, [refresh]);

  const hasFeature = (key) => {
    if (user?.is_superadmin) return true;
    return plan?.features?.[key] === true;
  };

  const atLimit = (key) => {
    if (user?.is_superadmin) return false;
    const usage = plan?.usage?.[key] ?? 0;
    const limit = plan?.limits?.[key] ?? Infinity;
    return usage >= limit;
  };

  return { plan, loading, hasFeature, atLimit, refresh };
}
