const { query } = require('../config/db');

// Whitelist of soft-deletable entities → table + label column for Trash/Restore
const ENTITIES = {
  quotation:     { table: 'quotations',     label: 'reference_no' },
  invoice:       { table: 'invoices',       label: 'invoice_no' },
  client:        { table: 'clients',        label: 'company_name' },
  lead:          { table: 'leads',          label: 'company_name' },
  shipping_rate: { table: 'shipping_rates', label: "shipping_line" },
  request:       { table: 'open_requests',  label: 'title' },
  shipment:      { table: 'shipments',      label: 'reference' },
};

// Reusable: record an audit entry. Never throws (logging must not break flows).
exports.log = async (req, { action, entityType, entityId = null, entityLabel = null, details = null }) => {
  try {
    await query(
      `INSERT INTO audit_log (user_id, user_name, action, entity_type, entity_id, entity_label, details)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        req.user?.id || null,
        req.user?.full_name || null,
        action,
        entityType,
        entityId,
        entityLabel,
        details ? JSON.stringify(details) : null,
      ]
    );
  } catch (err) {
    console.error('[audit] Failed to log:', err.message); // visible in server logs, never crashes the request
  }
};

// GET /audit — recent activity log (Admin)
exports.getAll = async (req, res, next) => {
  try {
    const { entityType, action, limit = 100 } = req.query;
    const params = [];
    const conditions = [];
    if (entityType) { params.push(entityType); conditions.push(`entity_type = $${params.length}`); }
    if (action)     { params.push(action);     conditions.push(`action = $${params.length}`); }
    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    params.push(Math.min(parseInt(limit) || 100, 500));

    const result = await query(
      `SELECT * FROM audit_log ${where} ORDER BY created_at DESC LIMIT $${params.length}`,
      params
    );
    res.json({ data: result.rows });
  } catch (err) { next(err); }
};

// GET /audit/trash — soft-deleted records across entities (Admin)
exports.getTrash = async (req, res, next) => {
  try {
    const out = [];
    for (const [type, cfg] of Object.entries(ENTITIES)) {
      const r = await query(
        `SELECT id, ${cfg.label} AS label, deleted_at
         FROM ${cfg.table}
         WHERE deleted_at IS NOT NULL
         ORDER BY deleted_at DESC
         LIMIT 50`
      );
      r.rows.forEach(row => out.push({
        entity_type: type,
        id: row.id,
        label: row.label,
        deleted_at: row.deleted_at,
      }));
    }
    out.sort((a, b) => new Date(b.deleted_at) - new Date(a.deleted_at));
    res.json({ data: out });
  } catch (err) { next(err); }
};

// POST /audit/trash/:entity/:id/restore (Admin)
exports.restore = async (req, res, next) => {
  try {
    const { entity, id } = req.params;
    const cfg = ENTITIES[entity];
    if (!cfg) return res.status(400).json({ error: 'Unknown entity type' });

    const result = await query(
      `UPDATE ${cfg.table} SET deleted_at = NULL
       WHERE id = $1 AND deleted_at IS NOT NULL
       RETURNING id, ${cfg.label} AS label`,
      [id]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'Record not found in trash' });

    await exports.log(req, {
      action: 'RESTORE',
      entityType: entity,
      entityId: id,
      entityLabel: result.rows[0].label,
    });
    res.json({ data: result.rows[0] });
  } catch (err) { next(err); }
};
