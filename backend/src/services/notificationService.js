const { query } = require('../config/db');
// Import pushToUser lazily to avoid circular dep at module load time
const getPush = () => require('../controllers/notificationController').pushToUser;

exports.createNotification = async (userId, type, title, body, link = null, metadata = {}) => {
  try {
    const result = await query(
      `INSERT INTO notifications (user_id, type, title, body, link, metadata)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [userId, type, title, body, link, JSON.stringify(metadata)]
    );
    // Push live via SSE so the user sees it immediately without waiting for the poll
    try { getPush()(userId, 'notification', result.rows[0]); } catch (_) {}
  } catch (err) {
    console.error('Notification creation failed:', err.message);
  }
};

exports.checkDueFollowUps = async () => {
  try {
    const result = await query(`
      SELECT a.*, u.id AS user_id, u.email,
             c.company_name AS client_name, l.company_name AS lead_company
      FROM activities a
      JOIN users u ON a.performed_by = u.id
      LEFT JOIN clients c ON a.client_id = c.id
      LEFT JOIN leads l ON a.lead_id = l.id
      WHERE a.next_follow_up >= NOW()::date
        AND a.next_follow_up < (NOW()::date + INTERVAL '1 day')
        AND a.reminder_sent = FALSE
    `);

    for (const activity of result.rows) {
      const entity = activity.client_name || activity.lead_company || 'record';
      await exports.createNotification(
        activity.user_id,
        'follow_up_due',
        'Follow-up Due Today',
        `You have a follow-up scheduled for ${entity}`,
        activity.client_id ? `/clients/${activity.client_id}` : `/leads/${activity.lead_id}`
      );
      await query('UPDATE activities SET reminder_sent = TRUE WHERE id = $1', [activity.id]);
    }
  } catch (err) {
    console.error('Follow-up check failed:', err.message);
  }
};

exports.checkOverdueInvoices = async () => {
  try {
    const result = await query(`
      UPDATE invoices SET payment_status = 'Overdue'
      WHERE payment_status = 'Pending' AND due_date < NOW()::date AND deleted_at IS NULL
      RETURNING *, client_id
    `);

    for (const invoice of result.rows) {
      const managers = await query(`
        SELECT u.id FROM users u JOIN roles r ON u.role_id = r.id
        WHERE r.name IN ('Admin', 'Sales Manager') AND u.is_active = TRUE
      `);
      for (const mgr of managers.rows) {
        await exports.createNotification(
          mgr.id,
          'invoice_overdue',
          'Invoice Overdue',
          `Invoice ${invoice.invoice_no} is overdue`,
          `/invoices`
        );
      }
    }
  } catch (err) {
    console.error('Invoice overdue check failed:', err.message);
  }
};
