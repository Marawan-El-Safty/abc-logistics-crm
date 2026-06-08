const { query } = require('../config/db');

exports.getAll = async (req, res, next) => {
  try {
    const { clientId, leadId, type, page = 1, limit = 20 } = req.query;
    const offset = (page - 1) * limit;
    const params = [];
    const conditions = [];

    if (req.user.role_name === 'Sales Rep') {
      params.push(req.user.id);
      conditions.push(`a.performed_by = $${params.length}`);
    }
    if (clientId) { params.push(clientId); conditions.push(`a.client_id = $${params.length}`); }
    if (leadId) { params.push(leadId); conditions.push(`a.lead_id = $${params.length}`); }
    if (type) { params.push(type); conditions.push(`a.activity_type = $${params.length}::activity_type`); }

    const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const countResult = await query(`SELECT COUNT(*) FROM activities a ${whereClause}`, params);
    const total = parseInt(countResult.rows[0].count);

    params.push(limit, offset);

    const result = await query(
      `SELECT a.*, u.full_name AS performed_by_name,
              c.company_name AS client_name, l.company_name AS lead_company
       FROM activities a
       LEFT JOIN users u ON a.performed_by = u.id
       LEFT JOIN clients c ON a.client_id = c.id
       LEFT JOIN leads l ON a.lead_id = l.id
       ${whereClause}
       ORDER BY a.activity_date DESC
       LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params
    );
    res.json({ data: result.rows, total, page: parseInt(page), limit: parseInt(limit) });
  } catch (err) { next(err); }
};

exports.getTodayFollowUps = async (req, res, next) => {
  try {
    const params = [];
    const conditions = [
      `a.next_follow_up >= NOW()::date`,
      `a.next_follow_up < (NOW()::date + INTERVAL '1 day')`
    ];

    if (req.user.role_name === 'Sales Rep') {
      params.push(req.user.id);
      conditions.push(`a.performed_by = $${params.length}`);
    }

    const result = await query(
      `SELECT a.*, u.full_name AS performed_by_name,
              c.company_name AS client_name, l.company_name AS lead_company
       FROM activities a
       LEFT JOIN users u ON a.performed_by = u.id
       LEFT JOIN clients c ON a.client_id = c.id
       LEFT JOIN leads l ON a.lead_id = l.id
       WHERE ${conditions.join(' AND ')}
       ORDER BY a.next_follow_up`,
      params
    );
    res.json({ data: result.rows });
  } catch (err) { next(err); }
};

exports.create = async (req, res, next) => {
  try {
    const { activityType, clientId, leadId, activityDate, notes, outcome, nextFollowUp, followUpNotes } = req.body;
    const result = await query(
      `INSERT INTO activities (activity_type, client_id, lead_id, performed_by, activity_date, notes, outcome, next_follow_up, follow_up_notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
      [activityType, clientId || null, leadId || null, req.user.id,
       activityDate || new Date(), notes, outcome, nextFollowUp || null, followUpNotes]
    );
    res.status(201).json({ data: result.rows[0] });
  } catch (err) { next(err); }
};

exports.update = async (req, res, next) => {
  try {
    const { activityType, activityDate, notes, outcome, nextFollowUp, followUpNotes } = req.body;
    const result = await query(
      `UPDATE activities SET
         activity_type = COALESCE($1::activity_type, activity_type),
         activity_date = COALESCE($2, activity_date),
         notes = COALESCE($3, notes),
         outcome = COALESCE($4, outcome),
         next_follow_up = COALESCE($5, next_follow_up),
         follow_up_notes = COALESCE($6, follow_up_notes),
         updated_at = NOW()
       WHERE id = $7 RETURNING *`,
      [activityType, activityDate, notes, outcome, nextFollowUp, followUpNotes, req.params.id]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'Activity not found' });
    res.json({ data: result.rows[0] });
  } catch (err) { next(err); }
};

exports.delete = async (req, res, next) => {
  try {
    await query('DELETE FROM activities WHERE id = $1', [req.params.id]);
    res.json({ message: 'Activity deleted' });
  } catch (err) { next(err); }
};

exports.markDone = async (req, res, next) => {
  try {
    const result = await query(
      `UPDATE activities SET next_follow_up = NULL, follow_up_notes = NULL, updated_at = NOW()
       WHERE id = $1 RETURNING *`,
      [req.params.id]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'Activity not found' });
    res.json({ data: result.rows[0] });
  } catch (err) { next(err); }
};
