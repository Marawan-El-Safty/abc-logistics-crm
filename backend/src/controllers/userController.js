const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const { query } = require('../config/db');
const { sendInviteEmail } = require('../services/emailService');

exports.getAll = async (req, res, next) => {
  try {
    const result = await query(
      `SELECT u.id, u.full_name, u.email, u.phone, u.is_active, u.avatar_url,
              u.last_login_at, u.created_at, r.name AS role_name, r.id AS role_id,
              u.tenant_role, u.user_status
       FROM users u JOIN roles r ON u.role_id = r.id
       WHERE u.deleted_at IS NULL AND u.tenant_id = $1
       ORDER BY u.full_name`,
      [req.tenantId]
    );
    res.json({ data: result.rows });
  } catch (err) { next(err); }
};

exports.getById = async (req, res, next) => {
  try {
    const result = await query(
      `SELECT u.id, u.full_name, u.email, u.phone, u.is_active, u.avatar_url,
              u.last_login_at, u.created_at, r.name AS role_name, r.id AS role_id,
              u.tenant_role, u.user_status
       FROM users u JOIN roles r ON u.role_id = r.id
       WHERE u.id = $1 AND u.tenant_id = $2 AND u.deleted_at IS NULL`,
      [req.params.id, req.tenantId]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'User not found' });
    res.json({ data: result.rows[0] });
  } catch (err) { next(err); }
};

exports.create = async (req, res, next) => {
  try {
    const { fullName, email, password, roleId, phone } = req.body;
    const hash = await bcrypt.hash(password, 12);
    const result = await query(
      `INSERT INTO users (full_name, email, password_hash, role_id, phone, tenant_id, user_status, is_active)
       VALUES ($1, $2, $3, $4, $5, $6, 'active', TRUE) RETURNING id, full_name, email, role_id, phone, created_at`,
      [fullName, email.toLowerCase().trim(), hash, roleId, phone || null, req.tenantId]
    );
    res.status(201).json({ data: result.rows[0] });
  } catch (err) { next(err); }
};

exports.update = async (req, res, next) => {
  try {
    const { fullName, email, roleId, phone, isActive } = req.body;

    if (roleId !== undefined) {
      const ownerCheck = await query(
        'SELECT tenant_role FROM users WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL',
        [req.params.id, req.tenantId]
      );
      if (ownerCheck.rows[0]?.tenant_role === 'owner') {
        return res.status(400).json({ error: 'Cannot change role of workspace owner' });
      }
    }

    const result = await query(
      `UPDATE users SET full_name = COALESCE($1, full_name),
                        email = COALESCE($2, email),
                        role_id = COALESCE($3, role_id),
                        phone = COALESCE($4, phone),
                        is_active = COALESCE($5, is_active),
                        updated_at = NOW()
       WHERE id = $6 AND tenant_id = $7 AND deleted_at IS NULL
       RETURNING id, full_name, email, role_id, phone, is_active`,
      [fullName, email?.toLowerCase().trim(), roleId, phone, isActive, req.params.id, req.tenantId]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'User not found' });
    res.json({ data: result.rows[0] });
  } catch (err) { next(err); }
};

exports.delete = async (req, res, next) => {
  try {
    if (req.params.id === req.user.id) return res.status(400).json({ error: 'Cannot delete yourself' });
    const result = await query(
      'UPDATE users SET deleted_at = NOW() WHERE id = $1 AND tenant_id = $2 RETURNING id',
      [req.params.id, req.tenantId]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'User not found' });
    res.json({ message: 'User deleted' });
  } catch (err) { next(err); }
};

exports.changePassword = async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) return res.status(400).json({ error: 'Both current and new password are required' });
    if (newPassword.length < 8) return res.status(400).json({ error: 'New password must be at least 8 characters' });
    const result = await query('SELECT password_hash FROM users WHERE id = $1', [req.user.id]);
    const valid = await bcrypt.compare(currentPassword, result.rows[0].password_hash);
    if (!valid) return res.status(400).json({ error: 'Current password is incorrect' });
    const hash = await bcrypt.hash(newPassword, 12);
    await query('UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2', [hash, req.user.id]);
    res.json({ message: 'Password changed successfully' });
  } catch (err) { next(err); }
};

exports.getNotifPrefs = async (req, res, next) => {
  try {
    const r = await query('SELECT notification_preferences FROM users WHERE id = $1', [req.user.id]);
    res.json({ data: r.rows[0]?.notification_preferences || {} });
  } catch (err) { next(err); }
};

exports.updateNotifPrefs = async (req, res, next) => {
  try {
    const prefs = req.body.preferences || {};
    const r = await query(
      'UPDATE users SET notification_preferences = $1 WHERE id = $2 RETURNING notification_preferences',
      [JSON.stringify(prefs), req.user.id]
    );
    res.json({ data: r.rows[0].notification_preferences });
  } catch (err) { next(err); }
};

exports.getRoles = async (req, res, next) => {
  try {
    const result = await query("SELECT id, name, description FROM roles WHERE name != 'Owner' ORDER BY id");
    res.json({ data: result.rows });
  } catch (err) { next(err); }
};

exports.updateRole = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { roleId } = req.body;
    if (!roleId) return res.status(400).json({ error: 'roleId required' });
    if (req.user.id === id) return res.status(400).json({ error: 'Cannot change your own role' });

    const roleCheck = await query('SELECT id, name FROM roles WHERE id = $1', [roleId]);
    if (!roleCheck.rows.length) return res.status(400).json({ error: 'Invalid role' });
    if (roleCheck.rows[0].name === 'Owner') return res.status(400).json({ error: 'Cannot assign Owner role' });

    const targetRes = await query(
      'SELECT id, tenant_role, role_id FROM users WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL',
      [id, req.tenantId]
    );
    if (!targetRes.rows.length) return res.status(404).json({ error: 'User not found' });
    const target = targetRes.rows[0];
    if (target.tenant_role === 'owner') return res.status(400).json({ error: 'Cannot change role of workspace owner' });

    const oldRoleId = target.role_id;
    await query('UPDATE users SET role_id = $1, updated_at = NOW() WHERE id = $2 AND tenant_id = $3', [roleId, id, req.tenantId]);

    await query(
      `INSERT INTO audit_log (tenant_id, actor_id, action, entity_type, entity_id, details)
       VALUES ($1, $2, 'role_change', 'user', $3, $4)`,
      [req.tenantId, req.user.id, id, JSON.stringify({ oldRoleId, newRoleId: roleId })]
    );

    res.json({ ok: true });
  } catch (err) { next(err); }
};

exports.toggleStatus = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { isActive } = req.body;
    if (typeof isActive !== 'boolean') return res.status(400).json({ error: 'isActive (boolean) required' });
    if (req.user.id === id) return res.status(400).json({ error: 'Cannot change your own status' });

    const targetRes = await query(
      `SELECT u.id, u.tenant_role, u.is_active, r.name AS role_name
       FROM users u JOIN roles r ON u.role_id = r.id
       WHERE u.id = $1 AND u.tenant_id = $2 AND u.deleted_at IS NULL`,
      [id, req.tenantId]
    );
    if (!targetRes.rows.length) return res.status(404).json({ error: 'User not found' });
    const target = targetRes.rows[0];
    if (target.tenant_role === 'owner') return res.status(400).json({ error: 'Cannot deactivate workspace owner' });

    if (!isActive && target.role_name === 'Admin') {
      const adminCountRes = await query(
        `SELECT COUNT(*) FROM users u
         JOIN roles r ON u.role_id = r.id
         WHERE u.tenant_id = $1 AND r.name = 'Admin' AND u.is_active = TRUE AND u.deleted_at IS NULL AND u.id != $2`,
        [req.tenantId, id]
      );
      if (parseInt(adminCountRes.rows[0].count) === 0) {
        return res.status(400).json({ error: 'Cannot deactivate the last active Admin' });
      }
    }

    await query('UPDATE users SET is_active = $1, updated_at = NOW() WHERE id = $2 AND tenant_id = $3', [isActive, id, req.tenantId]);
    res.json({ ok: true });
  } catch (err) { next(err); }
};

exports.inviteUser = async (req, res, next) => {
  try {
    const { email, fullName, roleId, tenantRole = 'member' } = req.body;
    if (!email || !roleId) return res.status(400).json({ error: 'email and roleId required' });

    const tenant = req.tenant;

    // Check seat limit
    const seatCount = await query(
      `SELECT COUNT(*) FROM users WHERE tenant_id=$1 AND deleted_at IS NULL AND user_status IN ('active','pending')`,
      [tenant.id]
    );
    if (parseInt(seatCount.rows[0].count) >= tenant.seat_limit) {
      return res.status(429).json({ error: 'seat_limit_reached', message: 'Seat limit reached. Upgrade your plan.' });
    }

    // Check email not already taken in this tenant
    const existing = await query(
      'SELECT id FROM users WHERE email = $1 AND tenant_id = $2 AND deleted_at IS NULL',
      [email.toLowerCase().trim(), tenant.id]
    );
    if (existing.rows.length) return res.status(409).json({ error: 'User already exists in this workspace' });

    // CRIT-4: 256-bit entropy invite token (crypto.randomBytes(32) = 64 hex chars)
    const inviteToken = crypto.randomBytes(32).toString('hex');
    const inviteExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    const result = await query(
      `INSERT INTO users (full_name, email, password_hash, role_id, tenant_id, tenant_role, user_status, is_active, invite_token, invite_expires_at)
       VALUES ($1, $2, '', $3, $4, $5, 'pending', FALSE, $6, $7)
       RETURNING id, full_name, email, tenant_role, user_status`,
      [fullName || email.split('@')[0], email.toLowerCase().trim(), roleId, tenant.id, tenantRole, inviteToken, inviteExpiresAt]
    );

    const inviteLink = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/invite/accept/${inviteToken}`;
    await sendInviteEmail(email, inviteLink, tenant.company_name);

    res.status(201).json({ data: result.rows[0], inviteLink });
  } catch (err) { next(err); }
};

// CRIT-4: acceptInvite — token must exist, not be expired, AND user must be
// in pending status. Single query prevents TOCTOU race on status.
// NOTE: apply express-rate-limit on the /invite/accept/:token route
// (e.g. max 10 requests per 15 min per IP) — see index.js HIGH-4.
exports.acceptInvite = async (req, res, next) => {
  try {
    const { token } = req.params;
    const { password, fullName } = req.body;
    if (!password || password.length < 8) return res.status(400).json({ error: 'Password must be at least 8 characters' });

    // Single query: token valid + not expired + status is pending
    const result = await query(
      `SELECT u.*, r.name AS role_name FROM users u
       JOIN roles r ON u.role_id = r.id
       WHERE u.invite_token = $1
         AND u.invite_expires_at > NOW()
         AND u.user_status = 'pending'
         AND u.deleted_at IS NULL`,
      [token]
    );
    if (!result.rows.length) return res.status(400).json({ error: 'Invalid or expired invite link' });

    const user = result.rows[0];
    const hash = await bcrypt.hash(password, 12);

    await query(
      `UPDATE users SET password_hash=$1, user_status='active', is_active=TRUE,
       invite_token=NULL, invite_expires_at=NULL, full_name=COALESCE($2, full_name), updated_at=NOW()
       WHERE id=$3`,
      [hash, fullName || null, user.id]
    );

    res.json({ message: 'Invite accepted. You can now log in.', email: user.email });
  } catch (err) { next(err); }
};

exports.getSeats = async (req, res, next) => {
  try {
    const tenant = req.tenant;
    const seatCount = await query(
      `SELECT COUNT(*) FROM users WHERE tenant_id=$1 AND deleted_at IS NULL AND user_status IN ('active','pending')`,
      [tenant.id]
    );
    const planRes = await query('SELECT limits FROM plans WHERE id = $1', [tenant.plan]);
    res.json({
      used: parseInt(seatCount.rows[0].count),
      limit: tenant.seat_limit,
      plan: tenant.plan,
      planLimitOverride: planRes.rows[0]?.limits?.seats ?? null,
    });
  } catch (err) { next(err); }
};

exports.freeUserSeat = async (req, res, next) => {
  try {
    if (req.params.id === req.user.id) return res.status(400).json({ error: 'Cannot remove yourself' });
    const result = await query(
      `UPDATE users SET deleted_at = NOW(), is_active = FALSE
       WHERE id = $1 AND tenant_id = $2 AND tenant_role != 'owner' AND deleted_at IS NULL
       RETURNING id`,
      [req.params.id, req.tenantId]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'User not found or is owner' });
    res.json({ message: 'Seat freed' });
  } catch (err) { next(err); }
};
