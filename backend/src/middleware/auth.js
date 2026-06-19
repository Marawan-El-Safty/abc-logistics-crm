const jwt = require('jsonwebtoken');
const { query, tenantQuery } = require('../config/db');

// CRIT-2: Explicit read-only method set — HEAD/OPTIONS pass through,
// all write methods (POST/PUT/PATCH/DELETE) are blocked for suspended tenants.
const READ_ONLY_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

const authenticate = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'No token provided' });
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const { userId, tenantId, isSuperadmin } = decoded;

    const result = await query(
      `SELECT u.*, r.name AS role_name, r.permissions
       FROM users u JOIN roles r ON u.role_id = r.id
       WHERE u.id = $1 AND u.is_active = TRUE AND u.deleted_at IS NULL`,
      [userId]
    );
    if (!result.rows.length) {
      return res.status(401).json({ error: 'User not found or inactive' });
    }
    const user = result.rows[0];

    // Superadmins have null tenant_id — allow through with no tenant
    if (!isSuperadmin) {
      // Enforce JWT tenantId matches DB tenantId (prevent token replay across tenants)
      if (!tenantId || user.tenant_id !== tenantId) {
        return res.status(401).json({ error: 'Token tenant mismatch' });
      }

      // Load tenant row — re-fetched on every request, no snapshot caching
      const tenantResult = await query(
        'SELECT * FROM tenants WHERE id = $1',
        [tenantId]
      );
      if (!tenantResult.rows.length) {
        return res.status(401).json({ error: 'Tenant not found' });
      }
      const tenant = tenantResult.rows[0];

      // HIGH-2: Determine effective status locally — do NOT mutate DB here.
      // The cron job (warnExpiringTrials / checkOverdueInvoices) owns all
      // status transitions. Doing a fire-and-forget UPDATE here was unsafe:
      // failures were silently swallowed and race conditions could occur.
      const effectiveStatus =
        tenant.status === 'trial' &&
        tenant.trial_ends_at &&
        new Date(tenant.trial_ends_at) < new Date()
          ? 'suspended'
          : tenant.status;

      // CRIT-2: Block all non-read-only methods for suspended/canceled tenants
      if (['suspended', 'canceled'].includes(effectiveStatus) && !READ_ONLY_METHODS.has(req.method)) {
        return res.status(403).json({
          error: 'account_suspended',
          message: 'Account suspended. Contact support.',
        });
      }

      req.tenantId = tenantId;
      req.tenant = { ...tenant, status: effectiveStatus };

      // CRIT-1: Attach a bound tquery helper so controllers can call
      // req.tquery(sql, params) and get tenant isolation for free.
      req.tquery = (sql, params) => tenantQuery(tenantId, sql, params);
    } else {
      req.tenantId = null;
      req.tenant = null;
      req.tquery = null;
    }

    req.user = user;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
};

const authorize = (...roles) => (req, res, next) => {
  if (!roles.includes(req.user.role_name)) {
    return res.status(403).json({ error: 'Insufficient permissions' });
  }
  next();
};

const authorizePermission = (resource, action) => (req, res, next) => {
  const perms = req.user.permissions || {};
  if (!perms[resource] || !perms[resource].includes(action)) {
    return res.status(403).json({ error: 'Insufficient permissions' });
  }
  next();
};

module.exports = { authenticate, authorize, authorizePermission };
