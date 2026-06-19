const { query } = require('../config/db');

const requireFeature = (featureKey) => async (req, res, next) => {
  try {
    const tenant = req.tenant;
    if (!tenant) return next(); // superadmin bypass
    const planRes = await query('SELECT features FROM plans WHERE id = $1', [tenant.plan]);
    const features = planRes.rows[0]?.features || {};
    if (features[featureKey] !== true) {
      return res.status(403).json({
        error: 'feature_not_available',
        feature: featureKey,
        message: 'Upgrade your plan to access this feature.',
      });
    }
    next();
  } catch (err) {
    next(err);
  }
};

const enforceLimit = (limitKey) => async (req, res, next) => {
  try {
    const tenant = req.tenant;
    if (!tenant) return next(); // superadmin bypass
    const planRes = await query('SELECT limits FROM plans WHERE id = $1', [tenant.plan]);
    const limit = planRes.rows[0]?.limits?.[limitKey];
    if (limit === null || limit === undefined) return next(); // unlimited

    let count = 0;
    if (limitKey === 'shipments_per_month') {
      const r = await query(
        `SELECT COUNT(*) FROM shipments WHERE tenant_id=$1 AND created_at >= date_trunc('month', NOW() AT TIME ZONE 'UTC') AND deleted_at IS NULL`,
        [tenant.id]
      );
      count = parseInt(r.rows[0].count);
    } else if (limitKey === 'clients') {
      const r = await query(
        `SELECT COUNT(*) FROM clients WHERE tenant_id=$1 AND deleted_at IS NULL`,
        [tenant.id]
      );
      count = parseInt(r.rows[0].count);
    } else if (limitKey === 'seats') {
      const r = await query(
        `SELECT COUNT(*) FROM users WHERE tenant_id=$1 AND deleted_at IS NULL AND user_status IN ('active','pending')`,
        [tenant.id]
      );
      count = parseInt(r.rows[0].count);
    }

    if (count >= limit) {
      return res.status(429).json({
        error: 'limit_reached',
        limitKey,
        current: count,
        limit,
        message: 'Plan limit reached. Upgrade to continue.',
      });
    }
    next();
  } catch (err) {
    next(err);
  }
};

module.exports = { requireFeature, enforceLimit };
