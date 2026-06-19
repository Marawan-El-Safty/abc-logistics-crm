const { query } = require('../config/db');

exports.getAll = async (req, res, next) => {
  try {
    const { status, priority, assignedTo, page = 1, limit = 20 } = req.query;
    const offset = (page - 1) * limit;
    const params = [req.tenantId];
    const conditions = ['t.deleted_at IS NULL', 't.tenant_id = $1'];

    if (req.user.role_name === 'Sales Rep') {
      params.push(req.user.id);
      conditions.push(`t.assigned_to = $${params.length}`);
    } else if (assignedTo) {
      params.push(assignedTo);
      conditions.push(`t.assigned_to = $${params.length}`);
    }
    if (status) { params.push(status); conditions.push(`t.status = $${params.length}::task_status`); }
    if (priority) { params.push(priority); conditions.push(`t.priority = $${params.length}::task_priority`); }

    const whereClause = `WHERE ${conditions.join(' AND ')}`;
    params.push(limit, offset);

    const result = await query(
      `SELECT t.*, u.full_name AS assigned_to_name, ab.full_name AS assigned_by_name,
              c.company_name AS client_name
       FROM tasks t
       LEFT JOIN users u ON t.assigned_to = u.id
       LEFT JOIN users ab ON t.assigned_by = ab.id
       LEFT JOIN clients c ON t.client_id = c.id
       ${whereClause}
       ORDER BY CASE t.priority WHEN 'Urgent' THEN 1 WHEN 'High' THEN 2 WHEN 'Medium' THEN 3 ELSE 4 END,
                t.due_date ASC NULLS LAST
       LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params
    );
    res.json({ data: result.rows });
  } catch (err) { next(err); }
};

exports.getCalendar = async (req, res, next) => {
  try {
    const { from, to } = req.query;
    const params = [from || new Date().toISOString().slice(0, 10), req.tenantId];
    const conditions = ['t.due_date >= $1', 't.deleted_at IS NULL', 't.tenant_id = $2'];

    if (to) { params.push(to); conditions.push(`t.due_date <= $${params.length}`); }
    if (req.user.role_name === 'Sales Rep') {
      params.push(req.user.id);
      conditions.push(`t.assigned_to = $${params.length}`);
    }

    const fupParams = [from || new Date().toISOString().slice(0, 10), req.tenantId];
    const fupConditions = ['a.next_follow_up >= $1', 'a.next_follow_up IS NOT NULL', 'a.tenant_id = $2'];
    if (to) { fupParams.push(to); fupConditions.push(`a.next_follow_up <= $${fupParams.length}`); }
    if (req.user.role_name === 'Sales Rep') {
      fupParams.push(req.user.id);
      fupConditions.push(`a.performed_by = $${fupParams.length}`);
    }

    const [tasks, followUps] = await Promise.all([
      query(
        `SELECT t.id, t.title, t.due_date AS date, 'task' AS event_type, t.priority, t.status,
                u.full_name AS assigned_to_name
         FROM tasks t LEFT JOIN users u ON t.assigned_to = u.id
         WHERE ${conditions.join(' AND ')}`,
        params
      ),
      query(
        `SELECT a.id, COALESCE(c.company_name, l.company_name, 'Follow-up') AS title,
                a.next_follow_up AS date, 'follow_up' AS event_type, a.follow_up_notes AS notes
         FROM activities a
         LEFT JOIN clients c ON a.client_id = c.id
         LEFT JOIN leads l ON a.lead_id = l.id
         WHERE ${fupConditions.join(' AND ')}`,
        fupParams
      ),
    ]);

    res.json({ data: [...tasks.rows, ...followUps.rows] });
  } catch (err) { next(err); }
};

exports.create = async (req, res, next) => {
  try {
    const { title, description, dueDate, priority, assignedTo, clientId, leadId } = req.body;
    const assignee = req.user.role_name === 'Sales Rep' ? req.user.id : (assignedTo || req.user.id);
    const result = await query(
      `INSERT INTO tasks (title, description, due_date, priority, assigned_to, assigned_by, client_id, lead_id, created_by, tenant_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
      [title, description, dueDate || null, priority || 'Medium', assignee, req.user.id,
       clientId || null, leadId || null, req.user.id, req.tenantId]
    );
    res.status(201).json({ data: result.rows[0] });
  } catch (err) { next(err); }
};

exports.update = async (req, res, next) => {
  try {
    const { title, description, dueDate, priority, status, assignedTo } = req.body;
    const result = await query(
      `UPDATE tasks SET
         title = COALESCE($1, title),
         description = COALESCE($2, description),
         due_date = COALESCE($3, due_date),
         priority = COALESCE($4::task_priority, priority),
         status = COALESCE($5::task_status, status),
         assigned_to = COALESCE($6, assigned_to),
         completed_at = CASE WHEN $5 = 'Done' THEN NOW() ELSE completed_at END,
         updated_at = NOW()
       WHERE id = $7 AND tenant_id = $8 AND deleted_at IS NULL RETURNING *`,
      [title, description, dueDate, priority, status, assignedTo, req.params.id, req.tenantId]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'Task not found' });
    res.json({ data: result.rows[0] });
  } catch (err) { next(err); }
};

exports.delete = async (req, res, next) => {
  try {
    await query('UPDATE tasks SET deleted_at = NOW() WHERE id = $1 AND tenant_id = $2', [req.params.id, req.tenantId]);
    res.json({ message: 'Task deleted' });
  } catch (err) { next(err); }
};
