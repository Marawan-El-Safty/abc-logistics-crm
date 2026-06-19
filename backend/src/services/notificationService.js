const { query } = require('../config/db');
const { sendTrialWarningEmail, sendSuspensionEmail } = require('./emailService');
const getPush = () => require('../controllers/notificationController').pushToUser;

exports.createNotification = async (userId, type, title, body, link = null, metadata = {}, tenantId = null) => {
  try {
    const result = await query(
      `INSERT INTO notifications (user_id, type, title, body, link, metadata, tenant_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [userId, type, title, body, link, JSON.stringify(metadata), tenantId]
    );
    try { getPush()(userId, 'notification', result.rows[0]); } catch (_) {}
  } catch (err) {
    console.error('Notification creation failed:', err.message);
  }
};

exports.checkDueFollowUps = async () => {
  try {
    // Get all active tenants
    const tenants = await query(`SELECT id FROM tenants WHERE status IN ('trial','active')`);
    for (const tenant of tenants.rows) {
      const result = await query(`
        SELECT a.*, u.id AS user_id, u.email,
               c.company_name AS client_name, l.company_name AS lead_company
        FROM activities a
        JOIN users u ON a.performed_by = u.id
        LEFT JOIN clients c ON a.client_id = c.id AND c.tenant_id = $1
        LEFT JOIN leads l ON a.lead_id = l.id AND l.tenant_id = $1
        WHERE a.tenant_id = $1
          AND a.next_follow_up >= NOW()::date
          AND a.next_follow_up < (NOW()::date + INTERVAL '1 day')
          AND a.reminder_sent = FALSE
      `, [tenant.id]);

      for (const activity of result.rows) {
        const entity = activity.client_name || activity.lead_company || 'record';
        await exports.createNotification(
          activity.user_id,
          'follow_up_due',
          'Follow-up Due Today',
          `You have a follow-up scheduled for ${entity}`,
          activity.client_id ? `/clients/${activity.client_id}` : `/leads/${activity.lead_id}`,
          {},
          tenant.id
        );
        await query('UPDATE activities SET reminder_sent = TRUE WHERE id = $1', [activity.id]);
      }
    }
  } catch (err) {
    console.error('Follow-up check failed:', err.message);
  }
};

exports.checkOverdueInvoices = async () => {
  try {
    const tenants = await query(`SELECT id FROM tenants WHERE status IN ('trial','active')`);
    for (const tenant of tenants.rows) {
      const result = await query(`
        UPDATE invoices SET payment_status = 'Overdue'
        WHERE payment_status = 'Pending' AND due_date < NOW()::date AND deleted_at IS NULL AND tenant_id = $1
        RETURNING *, client_id
      `, [tenant.id]);

      for (const invoice of result.rows) {
        const managers = await query(`
          SELECT u.id FROM users u JOIN roles r ON u.role_id = r.id
          WHERE r.name IN ('Admin', 'Sales Manager') AND u.is_active = TRUE
            AND u.tenant_id = $1 AND u.deleted_at IS NULL
        `, [tenant.id]);
        for (const mgr of managers.rows) {
          await exports.createNotification(
            mgr.id,
            'invoice_overdue',
            'Invoice Overdue',
            `Invoice ${invoice.invoice_no} is overdue`,
            `/invoices`,
            {},
            tenant.id
          );
        }
      }
    }
  } catch (err) {
    console.error('Invoice overdue check failed:', err.message);
  }
};

exports.warnExpiringTrials = async () => {
  try {
    const soon = await query(`
      SELECT t.*, u.email, u.full_name
      FROM tenants t
      JOIN users u ON u.tenant_id = t.id AND u.tenant_role = 'owner' AND u.deleted_at IS NULL
      WHERE t.status = 'trial'
        AND t.trial_ends_at BETWEEN NOW() AND NOW() + INTERVAL '3 days'
    `);
    for (const row of soon.rows) {
      const daysLeft = Math.ceil((new Date(row.trial_ends_at) - new Date()) / (1000 * 60 * 60 * 24));
      await sendTrialWarningEmail(row.email, daysLeft, row.company_name).catch(() => {});
    }
  } catch (err) {
    console.error('Trial warning check failed:', err.message);
  }
};
