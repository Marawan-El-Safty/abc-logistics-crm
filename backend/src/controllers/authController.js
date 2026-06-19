const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { query, withTransaction } = require('../config/db');

const RESERVED_SLUGS = ['admin', 'api', 'www', 'app', 'mail', 'ftp', 'smtp', 'billing', 'support', 'help', 'status'];

const generateTokens = (userId, roleId, tenantId, isSuperadmin = false) => {
  const accessToken = jwt.sign(
    { userId, roleId, tenantId, isSuperadmin },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '15m' }
  );
  const refreshToken = jwt.sign(
    { userId, roleId, tenantId, isSuperadmin },
    process.env.JWT_REFRESH_SECRET,
    { expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d' }
  );
  return { accessToken, refreshToken };
};

exports.login = async (req, res, next) => {
  try {
    const { email, password } = req.body;
    const result = await query(
      `SELECT u.*, r.name AS role_name, r.permissions
       FROM users u JOIN roles r ON u.role_id = r.id
       WHERE u.email = $1 AND u.is_active = TRUE AND u.deleted_at IS NULL`,
      [email.toLowerCase().trim()]
    );
    const user = result.rows[0];
    if (!user) return res.status(401).json({ error: 'Invalid credentials' });

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) return res.status(401).json({ error: 'Invalid credentials' });

    // Check tenant status before issuing tokens
    let tenant = null;
    if (!user.is_superadmin && user.tenant_id) {
      const tenantRes = await query('SELECT * FROM tenants WHERE id = $1', [user.tenant_id]);
      tenant = tenantRes.rows[0];
      if (tenant && ['suspended', 'canceled'].includes(tenant.status)) {
        return res.status(403).json({
          error: 'account_suspended',
          message: 'Account suspended. Contact support to reactivate.',
        });
      }
    }

    const { accessToken, refreshToken } = generateTokens(
      user.id,
      user.role_id,
      user.tenant_id || null,
      user.is_superadmin || false
    );

    const tokenHash = crypto.createHash('sha256').update(refreshToken).digest('hex');
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    await query(
      'INSERT INTO refresh_tokens (user_id, token_hash, expires_at) VALUES ($1, $2, $3)',
      [user.id, tokenHash, expiresAt]
    );

    await query('UPDATE users SET last_login_at = NOW() WHERE id = $1', [user.id]);
    await query('INSERT INTO user_sessions (user_id) VALUES ($1)', [user.id]);

    res.json({
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        fullName: user.full_name,
        email: user.email,
        role: user.role_name,
        permissions: user.permissions,
        avatarUrl: user.avatar_url,
        phone: user.phone || null,
        phone2: user.phone2 || null,
        phone3: user.phone3 || null,
        jobTitle: user.job_title || null,
        salutation: user.salutation || null,
        tenantId: user.tenant_id || null,
        isSuperadmin: user.is_superadmin || false,
        tenantRole: user.tenant_role || null,
      },
      tenant: tenant ? {
        id: tenant.id,
        companyName: tenant.company_name,
        plan: tenant.plan,
        status: tenant.status,
        trialEndsAt: tenant.trial_ends_at,
        validUntil: tenant.valid_until,
        seatLimit: tenant.seat_limit,
      } : null,
    });
  } catch (err) {
    next(err);
  }
};

exports.refresh = async (req, res, next) => {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) return res.status(401).json({ error: 'Refresh token required' });

    let decoded;
    try {
      decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);
    } catch {
      return res.status(401).json({ error: 'Invalid or expired refresh token' });
    }

    const tokenHash = crypto.createHash('sha256').update(refreshToken).digest('hex');
    const stored = await query(
      'SELECT * FROM refresh_tokens WHERE token_hash = $1 AND expires_at > NOW()',
      [tokenHash]
    );
    if (!stored.rows.length) return res.status(401).json({ error: 'Refresh token not found or expired' });

    await query('DELETE FROM refresh_tokens WHERE token_hash = $1', [tokenHash]);

    const { accessToken, refreshToken: newRefresh } = generateTokens(
      decoded.userId,
      decoded.roleId,
      decoded.tenantId || null,
      decoded.isSuperadmin || false
    );
    const newHash = crypto.createHash('sha256').update(newRefresh).digest('hex');
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    await query(
      'INSERT INTO refresh_tokens (user_id, token_hash, expires_at) VALUES ($1, $2, $3)',
      [decoded.userId, newHash, expiresAt]
    );

    res.json({ accessToken, refreshToken: newRefresh });
  } catch (err) {
    next(err);
  }
};

exports.logout = async (req, res, next) => {
  try {
    const { refreshToken, reason } = req.body;
    if (refreshToken) {
      const tokenHash = crypto.createHash('sha256').update(refreshToken).digest('hex');
      const stored = await query('SELECT user_id FROM refresh_tokens WHERE token_hash = $1', [tokenHash]);
      if (stored.rows.length) {
        await query(
          `UPDATE user_sessions
           SET logout_at = NOW(),
               duration_minutes = ROUND(EXTRACT(EPOCH FROM (NOW() - login_at)) / 60, 2),
               logout_reason = $1
           WHERE id = (
             SELECT id FROM user_sessions
             WHERE user_id = $2 AND logout_at IS NULL
             ORDER BY login_at DESC LIMIT 1
           )`,
          [reason || 'manual', stored.rows[0].user_id]
        );
      }
      await query('DELETE FROM refresh_tokens WHERE token_hash = $1', [tokenHash]);
    }
    res.json({ message: 'Logged out successfully' });
  } catch (err) {
    next(err);
  }
};

exports.me = async (req, res) => {
  res.json({
    id: req.user.id,
    fullName: req.user.full_name,
    email: req.user.email,
    role: req.user.role_name,
    permissions: req.user.permissions,
    avatarUrl: req.user.avatar_url,
    phone: req.user.phone,
    phone2: req.user.phone2 || null,
    phone3: req.user.phone3 || null,
    jobTitle: req.user.job_title || null,
    salutation: req.user.salutation || null,
    lastLoginAt: req.user.last_login_at,
    tenantId: req.user.tenant_id || null,
    isSuperadmin: req.user.is_superadmin || false,
    tenantRole: req.user.tenant_role || null,
  });
};

exports.updateProfile = async (req, res, next) => {
  try {
    const { jobTitle, salutation, phone, phone2, phone3 } = req.body;
    const result = await query(
      `UPDATE users SET job_title = $1, phone = $2, phone2 = $3, phone3 = $4, salutation = $5, updated_at = NOW()
       WHERE id = $6
       RETURNING id, full_name, email, phone, phone2, phone3, job_title, salutation, avatar_url`,
      [jobTitle || null, phone || null, phone2 || null, phone3 || null, salutation || null, req.user.id]
    );
    const u = result.rows[0];
    res.json({ jobTitle: u.job_title, salutation: u.salutation, phone: u.phone, phone2: u.phone2, phone3: u.phone3 });
  } catch (err) { next(err); }
};

exports.changePassword = async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const result = await query('SELECT password_hash FROM users WHERE id = $1', [req.user.id]);
    const valid = await bcrypt.compare(currentPassword, result.rows[0].password_hash);
    if (!valid) return res.status(400).json({ error: 'Current password is incorrect' });

    const hash = await bcrypt.hash(newPassword, 12);
    await query('UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2', [hash, req.user.id]);
    await query('DELETE FROM refresh_tokens WHERE user_id = $1', [req.user.id]);
    res.json({ message: 'Password changed successfully' });
  } catch (err) {
    next(err);
  }
};

exports.registerCompany = async (req, res, next) => {
  try {
    const { company_name, slug, email, password, full_name } = req.body;

    if (!company_name || !slug || !email || !password || !full_name) {
      return res.status(400).json({ error: 'All fields required: company_name, slug, email, password, full_name' });
    }
    if (!/^[a-z0-9-]{3,63}$/.test(slug)) {
      return res.status(400).json({ error: 'Slug must be 3-63 chars: lowercase letters, numbers, hyphens only' });
    }
    if (RESERVED_SLUGS.includes(slug)) {
      return res.status(400).json({ error: 'That slug is reserved. Choose another.' });
    }
    if (password.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters' });
    }

    // Check slug uniqueness
    const slugCheck = await query('SELECT id FROM tenants WHERE slug = $1', [slug]);
    if (slugCheck.rows.length) {
      return res.status(409).json({ error: 'Slug already taken' });
    }
    const emailCheck = await query('SELECT id FROM users WHERE email = $1', [email.toLowerCase().trim()]);
    if (emailCheck.rows.length) {
      return res.status(409).json({ error: 'Email already registered' });
    }

    // Get default role (Sales Manager or first available)
    const roleRes = await query(`SELECT id FROM roles WHERE name = 'Admin' LIMIT 1`);
    if (!roleRes.rows.length) return res.status(500).json({ error: 'Default role not configured' });
    const roleId = roleRes.rows[0].id;

    const hash = await bcrypt.hash(password, 12);
    const trialEndsAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);

    const result = await withTransaction(async (client) => {
      const tenantRes = await client.query(
        `INSERT INTO tenants (company_name, slug, plan, status, seat_limit, trial_ends_at)
         VALUES ($1, $2, 'starter', 'trial', 5, $3)
         RETURNING *`,
        [company_name, slug, trialEndsAt]
      );
      const tenant = tenantRes.rows[0];

      const userRes = await client.query(
        `INSERT INTO users (full_name, email, password_hash, role_id, tenant_id, tenant_role, user_status, is_active)
         VALUES ($1, $2, $3, $4, $5, 'owner', 'active', TRUE)
         RETURNING id, full_name, email, role_id, tenant_id, tenant_role`,
        [full_name, email.toLowerCase().trim(), hash, roleId, tenant.id]
      );
      const user = userRes.rows[0];

      await client.query(
        `INSERT INTO app_settings (tenant_id, data) VALUES ($1, '{}') ON CONFLICT (tenant_id) DO NOTHING`,
        [tenant.id]
      );

      return { tenant, user };
    });

    const { tenant, user } = result;
    const { accessToken, refreshToken } = generateTokens(user.id, user.role_id, tenant.id, false);

    const tokenHash = crypto.createHash('sha256').update(refreshToken).digest('hex');
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    await query('INSERT INTO refresh_tokens (user_id, token_hash, expires_at) VALUES ($1, $2, $3)', [user.id, tokenHash, expiresAt]);

    res.status(201).json({
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        fullName: user.full_name,
        email: user.email,
        tenantId: tenant.id,
        tenantRole: 'owner',
        isSuperadmin: false,
      },
      tenant: {
        id: tenant.id,
        companyName: tenant.company_name,
        slug: tenant.slug,
        plan: tenant.plan,
        status: tenant.status,
        trialEndsAt: tenant.trial_ends_at,
        seatLimit: tenant.seat_limit,
      },
    });
  } catch (err) {
    next(err);
  }
};
