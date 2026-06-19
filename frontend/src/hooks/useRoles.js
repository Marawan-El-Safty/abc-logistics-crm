import { useState, useEffect } from 'react';
import api from '../services/api';

let cache = null;
let pending = null;

export function useRoles() {
  const [roles, setRoles] = useState(cache || []);
  const [loading, setLoading] = useState(!cache);

  useEffect(() => {
    if (cache) { setRoles(cache); setLoading(false); return; }
    if (!pending) {
      pending = api.get('/users/roles')
        .then(r => { cache = r.data.data || []; return cache; })
        .catch(() => { pending = null; return []; });
    }
    pending.then(data => { setRoles(data); setLoading(false); });
  }, []);

  // Exclude Owner from assignment options (owner is set via tenant_role only)
  const assignableRoles = roles.filter(r => r.name !== 'Owner');

  return { roles: assignableRoles, loading };
}
