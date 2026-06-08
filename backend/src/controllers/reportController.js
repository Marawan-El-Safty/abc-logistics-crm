const https = require('https');
const { query } = require('../config/db');
const { exportToExcel } = require('../services/excelService');

let rateCache = { egp: null, eur: null, fetchedAt: null };

exports.getExchangeRate = async (req, res, next) => {
  try {
    const now = Date.now();
    if (rateCache.egp && rateCache.fetchedAt && (now - rateCache.fetchedAt) < 10 * 60 * 1000) {
      return res.json({ data: { rate: rateCache.egp, eurRate: rateCache.eur, source: 'cache', fetchedAt: rateCache.fetchedAt } });
    }
    const data = await new Promise((resolve, reject) => {
      https.get('https://open.er-api.com/v6/latest/USD', (r) => {
        let body = '';
        r.on('data', d => body += d);
        r.on('end', () => { try { resolve(JSON.parse(body)); } catch { reject(new Error('parse error')); } });
      }).on('error', reject);
    });
    const egp = data?.rates?.EGP;
    const eur = data?.rates?.EUR;
    if (!egp) return res.status(503).json({ error: 'Exchange rate unavailable' });
    rateCache = { egp, eur, fetchedAt: now };
    res.json({ data: { rate: egp, eurRate: eur, source: 'live', fetchedAt: now } });
  } catch (err) {
    if (rateCache.egp) return res.json({ data: { rate: rateCache.egp, eurRate: rateCache.eur, source: 'stale', fetchedAt: rateCache.fetchedAt } });
    next(err);
  }
};

exports.getDashboard = async (req, res, next) => {
  try {
    const isRep = req.user.role_name === 'Sales Rep';
    const repFilter = isRep ? `AND assigned_to = '${req.user.id}'` : '';
    const repFilterLeads = isRep ? `AND created_by = '${req.user.id}'` : '';

    const [
      leadsByStage,
      wonLostStats,
      activitiesByType,
      openRequestsCount,
      todayFollowUps,
      kpiData,
      recentActivity,
      wonQuotations,
      leadsBySource,
      revenueOverTime,
    ] = await Promise.all([
      query(`SELECT stage, COUNT(*) AS count FROM leads WHERE deleted_at IS NULL ${repFilter} GROUP BY stage`),
      query(`
        SELECT
          COUNT(*) FILTER (WHERE stage = 'Won') AS won,
          COUNT(*) FILTER (WHERE stage = 'Lost') AS lost,
          COUNT(*) FILTER (WHERE stage NOT IN ('Won','Lost')) AS active,
          COUNT(*) AS total
        FROM leads WHERE deleted_at IS NULL ${repFilter}
      `),
      query(`
        SELECT activity_type, COUNT(*) AS count
        FROM activities
        WHERE activity_date >= NOW() - INTERVAL '30 days'
        ${isRep ? `AND performed_by = '${req.user.id}'` : ''}
        GROUP BY activity_type
      `),
      query(`SELECT COUNT(*) AS count FROM open_requests WHERE deleted_at IS NULL AND status != 'Closed' ${isRep ? `AND submitted_by = '${req.user.id}'` : ''}`),
      query(`
        SELECT COUNT(*) AS count FROM activities
        WHERE next_follow_up >= NOW()::date AND next_follow_up < (NOW()::date + INTERVAL '1 day')
        ${isRep ? `AND performed_by = '${req.user.id}'` : ''}
      `),
      !isRep ? query(`
        SELECT u.id, u.full_name,
          COUNT(DISTINCT l.id) FILTER (WHERE l.stage = 'Won') AS won_deals,
          COUNT(DISTINCT l.id) AS total_leads,
          COUNT(DISTINCT a.id) AS activity_count,
          ROUND(
            COUNT(DISTINCT l.id) FILTER (WHERE l.stage = 'Won')::numeric /
            NULLIF(COUNT(DISTINCT l.id), 0) * 100, 1
          ) AS conversion_rate
        FROM users u
        LEFT JOIN leads l ON l.assigned_to = u.id AND l.deleted_at IS NULL
        LEFT JOIN activities a ON a.performed_by = u.id AND a.activity_date >= NOW() - INTERVAL '30 days'
        WHERE u.deleted_at IS NULL AND u.is_active = TRUE
        GROUP BY u.id, u.full_name
      `) : Promise.resolve({ rows: [] }),
      query(`
        SELECT a.*, u.full_name AS performed_by_name,
               c.company_name AS client_name, l.company_name AS lead_company
        FROM activities a
        LEFT JOIN users u ON a.performed_by = u.id
        LEFT JOIN clients c ON a.client_id = c.id
        LEFT JOIN leads l ON a.lead_id = l.id
        WHERE a.activity_date <= NOW()
          ${isRep ? `AND a.performed_by = '${req.user.id}'` : ''}
        ORDER BY a.activity_date DESC LIMIT 10
      `),
      query(`
        SELECT COUNT(*) AS count
        FROM quotations
        WHERE deleted_at IS NULL
          AND status = 'Confirmed'
          ${isRep ? `AND created_by = '${req.user.id}'` : ''}
      `),
      // Lead source breakdown
      query(`
        SELECT source, COUNT(*) AS count
        FROM leads
        WHERE deleted_at IS NULL ${repFilter}
        GROUP BY source ORDER BY count DESC
      `),
      // Revenue over time — last 6 months from paid invoices
      query(`
        SELECT TO_CHAR(DATE_TRUNC('month', paid_at), 'Mon YY') AS month,
               DATE_TRUNC('month', paid_at) AS month_start,
               COALESCE(SUM(amount) FILTER (WHERE currency = 'USD'), 0) AS usd,
               COALESCE(SUM(amount) FILTER (WHERE currency = 'EGP'), 0) AS egp
        FROM invoices
        WHERE deleted_at IS NULL
          AND payment_status = 'Paid'
          AND paid_at >= NOW() - INTERVAL '6 months'
        GROUP BY DATE_TRUNC('month', paid_at)
        ORDER BY month_start ASC
      `)
    ]);

    res.json({
      data: {
        leadsByStage: leadsByStage.rows,
        wonLostStats: wonLostStats.rows[0],
        activitiesByType: activitiesByType.rows,
        openRequestsCount: parseInt(openRequestsCount.rows[0].count),
        todayFollowUpsCount: parseInt(todayFollowUps.rows[0].count),
        wonQuotationsCount: parseInt(wonQuotations.rows[0].count),
        repKpis: kpiData.rows,
        recentActivity: recentActivity.rows,
        leadsBySource: leadsBySource.rows,
        revenueOverTime: revenueOverTime.rows,
      }
    });
  } catch (err) { next(err); }
};

// Finance-specific dashboard: invoice money, not sales pipeline
exports.getFinanceDashboard = async (req, res, next) => {
  try {
    // Refresh overdue flags first (same logic as invoice list)
    await query(
      `UPDATE invoices SET payment_status = 'Overdue'
       WHERE payment_status = 'Pending' AND due_date < NOW()::date AND deleted_at IS NULL`
    );

    const [byStatus, recentInvoices, overdueInvoices, upcomingDue, monthlyPaid] = await Promise.all([
      // Counts + amounts grouped by payment status and currency (can't sum mixed currencies)
      query(`
        SELECT payment_status, currency,
               COUNT(*)::int AS count,
               COALESCE(SUM(amount), 0) AS total
        FROM invoices
        WHERE deleted_at IS NULL
        GROUP BY payment_status, currency
      `),
      // Latest issued invoices
      query(`
        SELECT i.id, i.invoice_no, i.amount, i.currency, i.payment_status,
               i.due_date, i.created_at, c.company_name AS client_name
        FROM invoices i
        LEFT JOIN clients c ON i.client_id = c.id
        WHERE i.deleted_at IS NULL
        ORDER BY i.created_at DESC
        LIMIT 8
      `),
      // Overdue invoices, soonest-overdue first
      query(`
        SELECT i.id, i.invoice_no, i.amount, i.currency, i.due_date,
               c.company_name AS client_name,
               (NOW()::date - i.due_date) AS days_overdue
        FROM invoices i
        LEFT JOIN clients c ON i.client_id = c.id
        WHERE i.deleted_at IS NULL AND i.payment_status = 'Overdue'
        ORDER BY i.due_date ASC
        LIMIT 10
      `),
      // Pending invoices due within the next 7 days
      query(`
        SELECT i.id, i.invoice_no, i.amount, i.currency, i.due_date,
               c.company_name AS client_name
        FROM invoices i
        LEFT JOIN clients c ON i.client_id = c.id
        WHERE i.deleted_at IS NULL AND i.payment_status = 'Pending'
          AND i.due_date BETWEEN NOW()::date AND (NOW()::date + INTERVAL '7 days')
        ORDER BY i.due_date ASC
        LIMIT 10
      `),
      // Paid amounts collected this calendar month, by currency
      query(`
        SELECT currency, COALESCE(SUM(amount), 0) AS total, COUNT(*)::int AS count
        FROM invoices
        WHERE deleted_at IS NULL AND payment_status = 'Paid'
          AND paid_at >= date_trunc('month', NOW())
        GROUP BY currency
      `),
    ]);

    res.json({
      data: {
        byStatus:        byStatus.rows,
        recentInvoices:  recentInvoices.rows,
        overdueInvoices: overdueInvoices.rows,
        upcomingDue:     upcomingDue.rows,
        monthlyPaid:     monthlyPaid.rows,
      }
    });
  } catch (err) { next(err); }
};

exports.getPerformance = async (req, res, next) => {
  try {
    const { from, to, repId } = req.query;
    const fromDate = from || new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10);
    const toDate = to || new Date().toISOString().slice(0, 10);

    const params = [fromDate, toDate];
    const repCondition = repId ? `AND u.id = $3` : '';
    if (repId) params.push(repId);

    const result = await query(`
      SELECT u.id, u.full_name,
        COUNT(DISTINCT l.id) FILTER (WHERE l.stage = 'Won' AND l.stage_won_at BETWEEN $1 AND $2) AS won_deals,
        COUNT(DISTINCT l.id) FILTER (WHERE l.stage = 'Lost' AND l.stage_lost_at BETWEEN $1 AND $2) AS lost_deals,
        COUNT(DISTINCT l.id) AS total_leads,
        COUNT(DISTINCT a.id) FILTER (WHERE a.activity_date BETWEEN $1 AND $2) AS total_activities,
        COUNT(DISTINCT a.id) FILTER (WHERE a.activity_type = 'Call' AND a.activity_date BETWEEN $1 AND $2) AS calls,
        COUNT(DISTINCT a.id) FILTER (WHERE a.activity_type = 'Meeting' AND a.activity_date BETWEEN $1 AND $2) AS meetings,
        COUNT(DISTINCT a.id) FILTER (WHERE a.activity_type = 'Email' AND a.activity_date BETWEEN $1 AND $2) AS emails,
        COUNT(DISTINCT q.id) FILTER (WHERE q.created_at BETWEEN $1 AND $2) AS quotations_sent,
        COALESCE(SUM(q.total_amount) FILTER (WHERE q.status = 'Accepted' AND q.created_at BETWEEN $1 AND $2), 0) AS revenue_usd
      FROM users u
      LEFT JOIN roles r ON u.role_id = r.id
      LEFT JOIN leads l ON l.assigned_to = u.id AND l.deleted_at IS NULL
      LEFT JOIN activities a ON a.performed_by = u.id
      LEFT JOIN quotations q ON q.created_by = u.id AND q.deleted_at IS NULL
      WHERE r.name = 'Sales Rep' AND u.deleted_at IS NULL ${repCondition}
      GROUP BY u.id, u.full_name
      ORDER BY won_deals DESC
    `, params);

    res.json({ data: result.rows, from: fromDate, to: toDate });
  } catch (err) { next(err); }
};

exports.getPipeline = async (req, res, next) => {
  try {
    const result = await query(`
      SELECT l.stage,
        COUNT(*) AS count,
        STRING_AGG(l.company_name || ' (' || l.contact_name || ')', ', ') AS sample_companies
      FROM leads l
      WHERE l.deleted_at IS NULL AND l.stage NOT IN ('Won','Lost')
      GROUP BY l.stage
      ORDER BY CASE l.stage
        WHEN 'New Lead' THEN 1 WHEN 'Contacted' THEN 2
        WHEN 'Proposal Sent' THEN 3 WHEN 'Negotiating' THEN 4 ELSE 5 END
    `);

    const shipmentTypes = await query(`
      SELECT shipment_type, COUNT(*) AS count
      FROM leads WHERE deleted_at IS NULL
      GROUP BY shipment_type
    `);

    res.json({ data: { stages: result.rows, shipmentTypes: shipmentTypes.rows } });
  } catch (err) { next(err); }
};

// ── Performance score weights ────────────────────────────────────────────────
// Each completed action earns points. The score is a transparent number
// managers can use to compare team productivity in a given period.
const W = {
  lead_won:           10,  // closed a deal
  quotation_confirmed: 8,  // client confirmed a quote
  quotation_sent:      3,  // sent a quote
  task_done:           4,  // completed a task
  activity:            1,  // logged any activity
  request_resolved:    5,  // closed a request they were assigned
  shipment_delivered:  6,  // shipment reached Delivered status
};

exports.getFullReport = async (req, res, next) => {
  try {
    const { from, to } = req.query;
    const fromDate = from || new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10);
    const toDate   = to   || new Date().toISOString().slice(0, 10);
    const p = [fromDate, toDate];

    const [
      salesPerUser,
      operationsStats,
      tasksStats,
      requestsStats,
      shipmentsByStatus,
      shipmentsByDirection,
      quotationsByStatus,
      tasksByUser,
      requestsByUser,
    ] = await Promise.all([

      // ── Per-user sales metrics ──────────────────────────────────────────────
      query(`
        SELECT
          u.id, u.full_name, r.name AS role,
          COUNT(DISTINCT l.id) FILTER (WHERE l.stage = 'Won' AND l.stage_won_at BETWEEN $1 AND $2)          AS leads_won,
          COUNT(DISTINCT l.id) FILTER (WHERE l.stage = 'Lost' AND l.stage_lost_at BETWEEN $1 AND $2)        AS leads_lost,
          COUNT(DISTINCT l.id) FILTER (WHERE l.created_at BETWEEN $1 AND $2)                                AS leads_created,
          COUNT(DISTINCT q.id) FILTER (WHERE q.created_at BETWEEN $1 AND $2)                                AS quotations_sent,
          COUNT(DISTINCT q.id) FILTER (WHERE q.status = 'Confirmed' AND q.updated_at BETWEEN $1 AND $2)     AS quotations_confirmed,
          COUNT(DISTINCT a.id) FILTER (WHERE a.activity_date BETWEEN $1 AND $2)                             AS activities,
          COUNT(DISTINCT a.id) FILTER (WHERE a.activity_type='Call'    AND a.activity_date BETWEEN $1 AND $2) AS calls,
          COUNT(DISTINCT a.id) FILTER (WHERE a.activity_type='Meeting' AND a.activity_date BETWEEN $1 AND $2) AS meetings,
          COUNT(DISTINCT a.id) FILTER (WHERE a.activity_type='Email'   AND a.activity_date BETWEEN $1 AND $2) AS emails,
          COUNT(DISTINCT t.id) FILTER (WHERE t.status='Done' AND t.updated_at BETWEEN $1 AND $2)            AS tasks_done,
          COUNT(DISTINCT t.id) FILTER (WHERE t.status!='Done' AND t.due_date < NOW() AND t.deleted_at IS NULL) AS tasks_overdue,
          COUNT(DISTINCT rq.id) FILTER (WHERE rq.status='Closed' AND rq.updated_at BETWEEN $1 AND $2)       AS requests_resolved,
          COUNT(DISTINCT s.id) FILTER (WHERE s.status='Delivered' AND s.updated_at BETWEEN $1 AND $2)       AS shipments_delivered
        FROM users u
        JOIN roles r ON u.role_id = r.id
        LEFT JOIN leads       l  ON l.assigned_to  = u.id AND l.deleted_at  IS NULL
        LEFT JOIN quotations  q  ON q.created_by   = u.id AND q.deleted_at  IS NULL
        LEFT JOIN activities  a  ON a.performed_by = u.id
        LEFT JOIN tasks       t  ON t.assigned_to  = u.id AND t.deleted_at  IS NULL
        LEFT JOIN open_requests rq ON rq.assigned_to = u.id AND rq.deleted_at IS NULL
        LEFT JOIN shipments   s  ON s.created_by   = u.id AND s.deleted_at  IS NULL
        WHERE u.deleted_at IS NULL AND u.is_active = TRUE
          AND r.name IN ('Admin','Sales Manager','Sales Rep','Operation','Finance')
        GROUP BY u.id, u.full_name, r.name
        ORDER BY leads_won DESC, quotations_confirmed DESC
      `, p),

      // ── Operations overview ─────────────────────────────────────────────────
      query(`
        SELECT
          COUNT(*) FILTER (WHERE created_at BETWEEN $1 AND $2)                   AS total_shipments,
          COUNT(*) FILTER (WHERE status='Booked'    AND created_at BETWEEN $1 AND $2) AS booked,
          COUNT(*) FILTER (WHERE status='In Progress' AND created_at BETWEEN $1 AND $2) AS in_progress,
          COUNT(*) FILTER (WHERE status='Loaded'    AND created_at BETWEEN $1 AND $2) AS loaded,
          COUNT(*) FILTER (WHERE status='Sailed'    AND created_at BETWEEN $1 AND $2) AS sailed,
          COUNT(*) FILTER (WHERE status='Arrived'   AND created_at BETWEEN $1 AND $2) AS arrived,
          COUNT(*) FILTER (WHERE status='Delivered' AND created_at BETWEEN $1 AND $2) AS delivered,
          COUNT(*) FILTER (WHERE direction='Export' AND created_at BETWEEN $1 AND $2) AS exports,
          COUNT(*) FILTER (WHERE direction='Import' AND created_at BETWEEN $1 AND $2) AS imports,
          COUNT(*) FILTER (WHERE direction='Domestic' AND created_at BETWEEN $1 AND $2) AS domestic
        FROM shipments WHERE deleted_at IS NULL
      `, p),

      // ── Tasks overview ──────────────────────────────────────────────────────
      query(`
        SELECT
          COUNT(*) FILTER (WHERE created_at BETWEEN $1 AND $2)                        AS total,
          COUNT(*) FILTER (WHERE status='Done' AND updated_at BETWEEN $1 AND $2)       AS done,
          COUNT(*) FILTER (WHERE status='In Progress')                                  AS in_progress,
          COUNT(*) FILTER (WHERE status='To Do')                                        AS pending,
          COUNT(*) FILTER (WHERE status!='Done' AND due_date < NOW())                   AS overdue
        FROM tasks WHERE deleted_at IS NULL
      `, p),

      // ── Requests overview ───────────────────────────────────────────────────
      query(`
        SELECT
          COUNT(*) FILTER (WHERE created_at BETWEEN $1 AND $2)               AS total,
          COUNT(*) FILTER (WHERE status='Open')                               AS open,
          COUNT(*) FILTER (WHERE status='In Progress')                        AS in_progress,
          COUNT(*) FILTER (WHERE status='Closed' AND updated_at BETWEEN $1 AND $2) AS closed,
          COUNT(*) FILTER (WHERE priority='Urgent' AND status != 'Closed')    AS urgent_open,
          ROUND(AVG(EXTRACT(EPOCH FROM (closed_at - created_at))/3600) FILTER (WHERE status='Closed'), 1) AS avg_resolution_hours
        FROM open_requests WHERE deleted_at IS NULL
      `, p),

      // ── Shipments by status ─────────────────────────────────────────────────
      query(`SELECT status, COUNT(*) AS count FROM shipments WHERE deleted_at IS NULL GROUP BY status ORDER BY count DESC`, []),

      // ── Shipments by direction ──────────────────────────────────────────────
      query(`SELECT direction, COUNT(*) AS count FROM shipments WHERE deleted_at IS NULL GROUP BY direction`, []),

      // ── Quotations by status ────────────────────────────────────────────────
      query(`
        SELECT status, COUNT(*) AS count,
               COALESCE(SUM(total_amount),0) AS total_value
        FROM quotations WHERE deleted_at IS NULL
          AND created_at BETWEEN $1 AND $2
        GROUP BY status ORDER BY count DESC
      `, p),

      // ── Tasks per user ──────────────────────────────────────────────────────
      query(`
        SELECT u.full_name, r.name AS role,
          COUNT(t.id) FILTER (WHERE t.status='Done')        AS done,
          COUNT(t.id) FILTER (WHERE t.status='In Progress') AS in_progress,
          COUNT(t.id) FILTER (WHERE t.status='To Do')       AS pending,
          COUNT(t.id) FILTER (WHERE t.status!='Done' AND t.due_date < NOW()) AS overdue
        FROM users u
        JOIN roles r ON u.role_id = r.id
        LEFT JOIN tasks t ON t.assigned_to = u.id AND t.deleted_at IS NULL
        WHERE u.deleted_at IS NULL AND u.is_active = TRUE
        GROUP BY u.full_name, r.name
        HAVING COUNT(t.id) > 0
        ORDER BY done DESC
      `, []),

      // ── Requests per user ───────────────────────────────────────────────────
      query(`
        SELECT u.full_name,
          COUNT(rq.id) FILTER (WHERE rq.status='Closed')      AS resolved,
          COUNT(rq.id) FILTER (WHERE rq.status!='Closed')     AS open,
          COUNT(rq.id)                                         AS total
        FROM users u
        LEFT JOIN open_requests rq ON rq.assigned_to = u.id AND rq.deleted_at IS NULL
        WHERE u.deleted_at IS NULL AND u.is_active = TRUE
        GROUP BY u.full_name
        HAVING COUNT(rq.id) > 0
        ORDER BY resolved DESC
      `, []),
    ]);

    // ── Compute performance scores ─────────────────────────────────────────
    const usersWithScore = salesPerUser.rows.map(u => {
      const score =
        (parseInt(u.leads_won)             || 0) * W.lead_won +
        (parseInt(u.quotations_confirmed)  || 0) * W.quotation_confirmed +
        (parseInt(u.quotations_sent)       || 0) * W.quotation_sent +
        (parseInt(u.tasks_done)            || 0) * W.task_done +
        (parseInt(u.activities)            || 0) * W.activity +
        (parseInt(u.requests_resolved)     || 0) * W.request_resolved +
        (parseInt(u.shipments_delivered)   || 0) * W.shipment_delivered;
      return { ...u, score };
    }).sort((a, b) => b.score - a.score);

    res.json({
      data: {
        from: fromDate, to: toDate,
        scoreWeights: W,
        users: usersWithScore,
        operations: operationsStats.rows[0],
        tasks: tasksStats.rows[0],
        requests: requestsStats.rows[0],
        shipmentsByStatus: shipmentsByStatus.rows,
        shipmentsByDirection: shipmentsByDirection.rows,
        quotationsByStatus: quotationsByStatus.rows,
        tasksByUser: tasksByUser.rows,
        requestsByUser: requestsByUser.rows,
      }
    });
  } catch (err) { next(err); }
};

exports.exportPerformance = async (req, res, next) => {
  try {
    const { from, to } = req.query;
    const fromDate = from || new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10);
    const toDate = to || new Date().toISOString().slice(0, 10);

    const result = await query(`
      SELECT u.full_name AS "Sales Rep",
        COUNT(DISTINCT l.id) FILTER (WHERE l.stage = 'Won') AS "Won Deals",
        COUNT(DISTINCT l.id) FILTER (WHERE l.stage = 'Lost') AS "Lost Deals",
        COUNT(DISTINCT a.id) FILTER (WHERE a.activity_date BETWEEN $1 AND $2) AS "Total Activities",
        COUNT(DISTINCT q.id) FILTER (WHERE q.created_at BETWEEN $1 AND $2) AS "Quotations Sent",
        ROUND(COUNT(DISTINCT l.id) FILTER (WHERE l.stage = 'Won')::numeric / NULLIF(COUNT(DISTINCT l.id), 0) * 100, 1) AS "Conversion Rate %"
      FROM users u
      LEFT JOIN roles r ON u.role_id = r.id
      LEFT JOIN leads l ON l.assigned_to = u.id AND l.deleted_at IS NULL
      LEFT JOIN activities a ON a.performed_by = u.id
      LEFT JOIN quotations q ON q.created_by = u.id AND q.deleted_at IS NULL
      WHERE r.name = 'Sales Rep' AND u.deleted_at IS NULL
      GROUP BY u.full_name ORDER BY "Won Deals" DESC
    `, [fromDate, toDate]);

    const buffer = await exportToExcel('Performance Report', result.rows);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="performance-${fromDate}-${toDate}.xlsx"`);
    res.send(buffer);
  } catch (err) { next(err); }
};

exports.exportShipments = async (req, res, next) => {
  try {
    const { from, to } = req.query;
    const fromDate = from || new Date(new Date().getFullYear(), 0, 1).toISOString().slice(0, 10);
    const toDate   = to   || new Date().toISOString().slice(0, 10);
    const result = await query(`
      SELECT
        s.reference        AS "Reference",
        s.direction        AS "Direction",
        s.care_of          AS "Care Of",
        s.shipping_line    AS "Shipping Line",
        s.client_name      AS "Client",
        s.pol              AS "POL",
        s.pod              AS "POD",
        s.booking_no       AS "Booking No",
        s.container_qty    AS "Containers",
        s.container_type   AS "Type",
        s.status           AS "Status",
        s.etd              AS "ETD",
        s.eta              AS "ETA",
        s.bl_number        AS "B/L No",
        s.note             AS "Notes",
        u.full_name        AS "Created By"
      FROM shipments s
      LEFT JOIN users u ON s.created_by = u.id
      WHERE s.deleted_at IS NULL
        AND s.created_at BETWEEN $1 AND $2
      ORDER BY s.created_at DESC
    `, [fromDate, toDate]);
    const buffer = await exportToExcel('Shipments', result.rows);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="shipments-${fromDate}-${toDate}.xlsx"`);
    res.send(buffer);
  } catch (err) { next(err); }
};

exports.exportInvoices = async (req, res, next) => {
  try {
    const { from, to } = req.query;
    const fromDate = from || new Date(new Date().getFullYear(), 0, 1).toISOString().slice(0, 10);
    const toDate   = to   || new Date().toISOString().slice(0, 10);
    const result = await query(`
      SELECT
        i.invoice_no         AS "Invoice No",
        c.company_name       AS "Client",
        i.description        AS "Description",
        i.amount             AS "Amount",
        i.currency           AS "Currency",
        i.payment_status     AS "Payment Status",
        i.due_date           AS "Due Date",
        i.paid_at            AS "Paid At",
        i.bl_number          AS "B/L No",
        i.vessel             AS "Vessel",
        u.full_name          AS "Created By"
      FROM invoices i
      LEFT JOIN clients c ON i.client_id = c.id
      LEFT JOIN users  u ON i.created_by = u.id
      WHERE i.deleted_at IS NULL
        AND i.created_at BETWEEN $1 AND $2
      ORDER BY i.created_at DESC
    `, [fromDate, toDate]);
    const buffer = await exportToExcel('Invoices', result.rows);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="invoices-${fromDate}-${toDate}.xlsx"`);
    res.send(buffer);
  } catch (err) { next(err); }
};

exports.exportQuotations = async (req, res, next) => {
  try {
    const { from, to } = req.query;
    const fromDate = from || new Date(new Date().getFullYear(), 0, 1).toISOString().slice(0, 10);
    const toDate   = to   || new Date().toISOString().slice(0, 10);
    const result = await query(`
      SELECT
        q.reference_no      AS "Reference",
        c.company_name      AS "Client",
        q.service_type      AS "Service",
        q.direction         AS "Direction",
        q.origin            AS "Origin",
        q.destination       AS "Destination",
        q.currency          AS "Currency",
        q.total_amount      AS "Selling Total",
        q.buying_total      AS "Buying Total",
        ROUND(q.total_amount - COALESCE(q.buying_total,0), 2) AS "Profit",
        q.status            AS "Status",
        TO_CHAR(q.created_at, 'YYYY-MM-DD') AS "Created",
        u.full_name         AS "Created By"
      FROM quotations q
      LEFT JOIN clients c ON q.client_id = c.id
      LEFT JOIN users   u ON q.created_by = u.id
      WHERE q.deleted_at IS NULL
        AND q.created_at BETWEEN $1 AND $2
      ORDER BY q.created_at DESC
    `, [fromDate, toDate]);
    const buffer = await exportToExcel('Quotations', result.rows);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="quotations-${fromDate}-${toDate}.xlsx"`);
    res.send(buffer);
  } catch (err) { next(err); }
};
