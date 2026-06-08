const bcrypt = require('bcryptjs');
const { query } = require('../config/db');

exports.getAll = async (req, res, next) => {
  try {
    const result = await query(
      `SELECT u.id, u.full_name, u.email, u.phone, u.is_active, u.avatar_url,
              u.last_login_at, u.created_at, r.name AS role_name, r.id AS role_id
       FROM users u JOIN roles r ON u.role_id = r.id
       WHERE u.deleted_at IS NULL
       ORDER BY u.full_name`
    );
    res.json({ data: result.rows });
  } catch (err) { next(err); }
};

exports.getById = async (req, res, next) => {
  try {
    const result = await query(
      `SELECT u.id, u.full_name, u.email, u.phone, u.is_active, u.avatar_url,
              u.last_login_at, u.created_at, r.name AS role_name, r.id AS role_id
       FROM users u JOIN roles r ON u.role_id = r.id
       WHERE u.id = $1 AND u.deleted_at IS NULL`,
      [req.params.id]
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
      `INSERT INTO users (full_name, email, password_hash, role_id, phone)
       VALUES ($1, $2, $3, $4, $5) RETURNING id, full_name, email, role_id, phone, created_at`,
      [fullName, email.toLowerCase().trim(), hash, roleId, phone || null]
    );
    res.status(201).json({ data: result.rows[0] });
  } catch (err) { next(err); }
};

exports.update = async (req, res, next) => {
  try {
    const { fullName, email, roleId, phone, isActive } = req.body;
    const result = await query(
      `UPDATE users SET full_name = COALESCE($1, full_name),
                        email = COALESCE($2, email),
                        role_id = COALESCE($3, role_id),
                        phone = COALESCE($4, phone),
                        is_active = COALESCE($5, is_active),
                        updated_at = NOW()
       WHERE id = $6 AND deleted_at IS NULL
       RETURNING id, full_name, email, role_id, phone, is_active`,
      [fullName, email?.toLowerCase().trim(), roleId, phone, isActive, req.params.id]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'User not found' });
    res.json({ data: result.rows[0] });
  } catch (err) { next(err); }
};

exports.delete = async (req, res, next) => {
  try {
    if (req.params.id === req.user.id) return res.status(400).json({ error: 'Cannot delete yourself' });
    await query('UPDATE users SET deleted_at = NOW() WHERE id = $1', [req.params.id]);
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
    const result = await query('SELECT id, name, description FROM roles ORDER BY id');
    res.json({ data: result.rows });
  } catch (err) { next(err); }
};
