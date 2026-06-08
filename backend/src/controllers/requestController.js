const { query } = require('../config/db');
const { createAndPush } = require('./notificationController');

exports.getAll = async (req, res, next) => {
  try {
    const { status, priority, assignedTo, page = 1, limit = 20 } = req.query;
    const offset = (page - 1) * limit;
    const params = [];
    const archived = req.query.archived === 'true';
    const conditions = ['r.deleted_at IS NULL', `r.is_archived = ${archived}`];

    const isManager = ['Admin', 'Sales Manager'].includes(req.user.role_name);
    if (!isManager) {
      // Non-managers see requests they submitted OR that are assigned to them
      params.push(req.user.id);
      const n = params.length;
      conditions.push(`(r.submitted_by = $${n} OR r.assigned_to = $${n})`);
    } else if (assignedTo) {
      params.push(assignedTo);
      conditions.push(`r.assigned_to = $${params.length}`);
    }
    if (status) { params.push(status); conditions.push(`r.status = $${params.length}::request_status`); }
    if (priority) { params.push(priority); conditions.push(`r.priority = $${params.length}::request_priority`); }

    const whereClause = `WHERE ${conditions.join(' AND ')}`;
    params.push(limit, offset);

    const result = await query(
      `SELECT r.*, u.full_name AS submitted_by_name, a.full_name AS assigned_to_name,
              c.company_name AS client_name
       FROM open_requests r
       LEFT JOIN users u ON r.submitted_by = u.id
       LEFT JOIN users a ON r.assigned_to = a.id
       LEFT JOIN clients c ON r.client_id = c.id
       ${whereClause}
       ORDER BY CASE r.priority WHEN 'Urgent' THEN 1 WHEN 'High' THEN 2 WHEN 'Medium' THEN 3 ELSE 4 END,
                r.created_at DESC
       LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params
    );
    res.json({ data: result.rows });
  } catch (err) { next(err); }
};

exports.create = async (req, res, next) => {
  try {
    const { title, description, priority, clientId, assignedTo } = req.body;
    // Build attachment metadata from uploaded files
    const attachments = (req.files || []).map(f => ({
      filename: f.originalname,
      storedAs: f.filename,
      url:      `/uploads/${f.filename}`,
      size:     f.size,
      mime:     f.mimetype,
    }));
    const result = await query(
      `INSERT INTO open_requests (title, description, priority, client_id, submitted_by, assigned_to, attachments)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [title, description, priority || 'Medium', clientId || null, req.user.id, assignedTo || null, JSON.stringify(attachments)]
    );
    // Notify all managers and admins
    const managers = await query(
      `SELECT u.id FROM users u JOIN roles r ON u.role_id = r.id
       WHERE r.name IN ('Admin', 'Sales Manager') AND u.is_active = TRUE`
    );
    for (const mgr of managers.rows) {
      await createAndPush(mgr.id, 'request_updated', 'New Request Submitted',
        `"${title}" submitted by ${req.user.full_name || 'a rep'}`, `/requests?open=${result.rows[0].id}`);
    }
    res.status(201).json({ data: result.rows[0] });
  } catch (err) { next(err); }
};

exports.update = async (req, res, next) => {
  try {
    const { title, description, priority, status, assignedTo, resolution } = req.body;
    const result = await query(
      `UPDATE open_requests SET
         title = COALESCE($1, title),
         description = COALESCE($2, description),
         priority = COALESCE($3::request_priority, priority),
         status = COALESCE($4::request_status, status),
         assigned_to = COALESCE($5, assigned_to),
         resolution = COALESCE($6, resolution),
         closed_at = CASE WHEN $4 = 'Closed' THEN NOW() ELSE closed_at END,
         updated_at = NOW()
       WHERE id = $7 AND deleted_at IS NULL RETURNING *`,
      [title, description, priority, status, assignedTo, resolution, req.params.id]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'Request not found' });
    const req_ = result.rows[0];
    // Notify submitter when status changes (if someone else is making the change)
    if (status && req_.submitted_by && req_.submitted_by !== req.user.id) {
      await createAndPush(req_.submitted_by, 'request_updated', 'Request Status Updated',
        `Your request "${req_.title}" is now ${status}`, `/requests?open=${req_.id}`);
    }
    res.json({ data: req_ });
  } catch (err) { next(err); }
};

exports.getById = async (req, res, next) => {
  try {
    const [reqResult, repliesResult] = await Promise.all([
      query(
        `SELECT r.*, u.full_name AS submitted_by_name, a.full_name AS assigned_to_name,
                c.company_name AS client_name
         FROM open_requests r
         LEFT JOIN users u ON r.submitted_by = u.id
         LEFT JOIN users a ON r.assigned_to = a.id
         LEFT JOIN clients c ON r.client_id = c.id
         WHERE r.id = $1 AND r.deleted_at IS NULL`,
        [req.params.id]
      ),
      query(
        `SELECT rr.*, u.full_name AS author_name, ro.name AS role_name
         FROM request_replies rr
         JOIN users u  ON rr.author_id = u.id
         JOIN roles ro ON u.role_id    = ro.id
         WHERE rr.request_id = $1
         ORDER BY rr.created_at ASC`,
        [req.params.id]
      ),
    ]);
    if (!reqResult.rows.length) return res.status(404).json({ error: 'Request not found' });
    res.json({ data: { ...reqResult.rows[0], replies: repliesResult.rows } });
  } catch (err) { next(err); }
};

exports.addReply = async (req, res, next) => {
  try {
    const { message } = req.body;
    if (!message?.trim()) return res.status(400).json({ error: 'Message is required' });

    const reqResult = await query(
      'SELECT * FROM open_requests WHERE id = $1 AND deleted_at IS NULL',
      [req.params.id]
    );
    if (!reqResult.rows.length) return res.status(404).json({ error: 'Request not found' });
    const request = reqResult.rows[0];

    await query(
      'INSERT INTO request_replies (request_id, author_id, message) VALUES ($1, $2, $3)',
      [req.params.id, req.user.id, message.trim()]
    );

    // Cross-notify: rep reply → managers; manager reply → submitter
    if (['Sales Rep'].includes(req.user.role_name)) {
      const managers = await query(
        `SELECT u.id FROM users u JOIN roles r ON u.role_id = r.id
         WHERE r.name IN ('Admin', 'Sales Manager') AND u.is_active = TRUE`
      );
      for (const mgr of managers.rows) {
        await createAndPush(mgr.id, 'request_updated', 'New Reply on Request',
          `${req.user.full_name} replied: "${message.trim().slice(0, 60)}"`, `/requests?open=${req.params.id}`);
      }
    } else if (request.submitted_by && String(request.submitted_by) !== String(req.user.id)) {
      await createAndPush(request.submitted_by, 'request_updated', 'Manager Replied',
        `${req.user.full_name} replied to your request "${request.title}"`, `/requests?open=${req.params.id}`);
    }

    // Return the new reply with author info
    const newReply = await query(
      `SELECT rr.*, u.full_name AS author_name, ro.name AS role_name
       FROM request_replies rr
       JOIN users u  ON rr.author_id = u.id
       JOIN roles ro ON u.role_id    = ro.id
       WHERE rr.request_id = $1
       ORDER BY rr.created_at DESC LIMIT 1`,
      [req.params.id]
    );
    res.status(201).json({ data: newReply.rows[0] });
  } catch (err) { next(err); }
};

exports.delete = async (req, res, next) => {
  try {
    await query('UPDATE open_requests SET deleted_at = NOW() WHERE id = $1', [req.params.id]);
    res.json({ message: 'Request deleted' });
  } catch (err) { next(err); }
};

exports.archive = async (req, res, next) => {
  try {
    const r = await query(
      'UPDATE open_requests SET is_archived = TRUE WHERE id = $1 AND deleted_at IS NULL RETURNING title',
      [req.params.id]
    );
    if (!r.rows.length) return res.status(404).json({ error: 'Request not found' });
    res.json({ data: { archived: true } });
  } catch (err) { next(err); }
};

exports.unarchive = async (req, res, next) => {
  try {
    await query(
      'UPDATE open_requests SET is_archived = FALSE WHERE id = $1 AND deleted_at IS NULL',
      [req.params.id]
    );
    res.json({ data: { unarchived: true } });
  } catch (err) { next(err); }
};
