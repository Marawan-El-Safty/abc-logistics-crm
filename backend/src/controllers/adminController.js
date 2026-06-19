const jwt = require('jsonwebtoken');
const { query } = require('../config/db');
const audit = require('./auditController');

// UUID v4 regex — validates tenant/user id params before hitting the DB
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

exports.listTenants = async (req, res, next) => {
  try {
    const result = await query(
      `SELECT t.*,
              COUNT(u.id) FILTER (WHERE u.deleted_at IS NULL AND u.user_status IN ('active','pending')) AS seat_used
       FROM tenants t
       LEFT JOIN users u ON u.tenant_id = t.id
       GROUP BY t.id
       ORDER BY t.created_at DESC`
    );
    res.json({ data: result.rows });
  } catch (err) { next(err); }
};

exports.getTenant = async (req, res, next) => {
  try {
    const result = await query(
      `SELECT t.*,
              COUNT(u.id) FILTER (WHERE u.deleted_at IS NULL AND u.user_status IN ('active','pending')) AS seat_used
       FROM tenants t
       LEFT JOIN users u ON u.tenant_id = t.id
       WHERE t.id = $1
       GROUP BY t.id`,
      [req.params.id]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'Tenant not found' });
    res.json({ data: result.rows[0] });
  } catch (err) { next(err); }
};

exports.patchTenant = async (req, res, next) => {
  try {
    const { plan, seat_limit, valid_until, status, company_name } = req.body;
    const VALID_STATUSES = ['trial', 'active', 'suspended', 'canceled'];
    const VALID_PLANS = ['starter', 'professional', 'enterprise'];

    if (status && !VALID_STATUSES.includes(status)) {
      return res.status(400).json({ error: `status must be one of: ${VALID_STATUSES.join(', ')}` });
    }
    if (plan && !VALID_PLANS.includes(plan)) {
      return res.status(400).json({ error: `plan must be one of: ${VALID_PLANS.join(', ')}` });
    }
    if (seat_limit !== undefined && (isNaN(parseInt(seat_limit)) || parseInt(seat_limit) < 1)) {
      return res.status(400).json({ error: 'seat_limit must be a positive integer' });
    }

    const result = await query(
      `UPDATE tenants SET
         plan         = COALESCE($1, plan),
         seat_limit   = COALESCE($2, seat_limit),
         valid_until  = COALESCE($3::TIMESTAMPTZ, valid_until),
         status       = COALESCE($4, status),
         company_name = COALESCE($5, company_name)
       WHERE id = $6
       RETURNING *`,
      [
        plan || null,
        seat_limit ? parseInt(seat_limit) : null,
        valid_until || null,
        status || null,
        company_name || null,
        req.params.id,
      ]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'Tenant not found' });

    await audit.log(req, {
      action: 'ADMIN_PATCH_TENANT',
      entityType: 'tenant',
      entityId: req.params.id,
      entityLabel: result.rows[0].company_name,
      details: req.body,
    });

    res.json({ data: result.rows[0] });
  } catch (err) { next(err); }
};

exports.impersonate = async (req, res, next) => {
  try {
    const { id: tenantId } = req.params;

    // CRIT-3: Validate tenantId is a valid UUID before querying
    if (!UUID_RE.test(tenantId)) {
      return res.status(400).json({ error: 'Invalid tenant id' });
    }

    const tenantRes = await query('SELECT * FROM tenants WHERE id = $1', [tenantId]);
    if (!tenantRes.rows.length) return res.status(404).json({ error: 'Tenant not found' });
    const tenant = tenantRes.rows[0];

    // CRIT-3: User lookup MUST include AND tenant_id = $1 to prevent a user
    // from one tenant being impersonated under another tenant's context.
    const userRes = await query(
      `SELECT u.*, r.name AS role_name FROM users u
       JOIN roles r ON u.role_id = r.id
       WHERE u.tenant_id = $1 AND u.tenant_role = 'owner' AND u.deleted_at IS NULL
       LIMIT 1`,
      [tenantId]
    );
    if (!userRes.rows.length) return res.status(404).json({ error: 'No owner user found for tenant' });
    const user = userRes.rows[0];

    // 15m impersonation token, no refresh
    const accessToken = jwt.sign(
      { userId: user.id, roleId: user.role_id, tenantId, isSuperadmin: false, impersonatedBy: req.user.id },
      process.env.JWT_SECRET,
      { expiresIn: '15m' }
    );

    // HIGH-5: Audit log is awaited — if it fails, deny the impersonation
    // so there is never an impersonation without an audit trail.
    try {
      await audit.log(req, {
        action: 'IMPERSONATE',
        entityType: 'tenant',
        entityId: tenantId,
        entityLabel: tenant.company_name,
        details: { adminId: req.user.id, targetUserId: user.id },
      });
    } catch (auditErr) {
      console.error('Audit log failed for impersonation:', auditErr);
      return res.status(500).json({ error: 'Impersonation denied: audit log failure' });
    }

    res.json({
      accessToken,
      user: {
        id: user.id,
        fullName: user.full_name,
        email: user.email,
        role: user.role_name,
        tenantId,
        isSuperadmin: false,
      },
      tenant: {
        id: tenant.id,
        companyName: tenant.company_name,
        plan: tenant.plan,
        status: tenant.status,
      },
    });
  } catch (err) { next(err); }
};
