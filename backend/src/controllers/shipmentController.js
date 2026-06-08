const { query, withTransaction } = require('../config/db');
const audit = require('./auditController');

// Columns a client may set; maps camelCase body keys → db columns
const FIELDS = {
  reference:     'reference',
  externalRef:   'external_ref',
  direction:     'direction',
  careOf:        'care_of',
  shippingLine:  'shipping_line',
  clientId:      'client_id',
  clientName:    'client_name',
  pol:           'pol',
  pod:           'pod',
  bookingNo:     'booking_no',
  containerQty:  'container_qty',
  containerType: 'container_type',
  status:        'status',
  note:          'note',
  loadingNote:   'loading_note',
  loadingDate:   'loading_date',
  etd:           'etd',
  eta:           'eta',
  quotationId:   'quotation_id',
  acid:          'acid',
  masterAcid:    'master_acid',
  blNumber:      'bl_number',
};

const norm = (col, val) => {
  if (val === '' || val === undefined || val === null) return null;
  if (col === 'container_qty') return parseInt(val) || null;
  // Date columns: accept YYYY-MM-DD or DD/MM/YYYY, reject anything else silently
  if (col === 'etd' || col === 'eta' || col === 'loading_date') {
    if (/^\d{4}-\d{2}-\d{2}$/.test(val)) return val;
    const dmy = val.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (dmy) return `${dmy[3]}-${dmy[2].padStart(2,'0')}-${dmy[1].padStart(2,'0')}`;
    return null; // not a recognisable date — skip rather than crash
  }
  return val;
};

exports.getAll = async (req, res, next) => {
  try {
    const { direction, status, search, archived } = req.query;
    const params = [];
    const conditions = ['s.deleted_at IS NULL'];

    // Default: hide archived. Pass ?archived=true to show only archived.
    if (archived === 'true') {
      conditions.push('s.is_archived = TRUE');
    } else {
      conditions.push('s.is_archived = FALSE');
    }

    if (direction) { params.push(direction); conditions.push(`s.direction = $${params.length}`); }
    if (status)    { params.push(status);    conditions.push(`s.status = $${params.length}`); }
    if (search) {
      params.push(`%${search.toLowerCase()}%`);
      const n = params.length;
      conditions.push(`(LOWER(s.reference) LIKE $${n} OR LOWER(s.shipping_line) LIKE $${n}
        OR LOWER(s.booking_no) LIKE $${n} OR LOWER(s.pol) LIKE $${n} OR LOWER(s.pod) LIKE $${n}
        OR LOWER(COALESCE(c.company_name, s.client_name, '')) LIKE $${n})`);
    }

    const result = await query(
      `SELECT s.*, COALESCE(c.company_name, s.client_name) AS client_display,
              u.full_name AS created_by_name,
              q.reference_no AS quotation_ref
       FROM shipments s
       LEFT JOIN clients c ON s.client_id = c.id
       LEFT JOIN users u ON s.created_by = u.id
       LEFT JOIN quotations q ON s.quotation_id = q.id
       WHERE ${conditions.join(' AND ')}
       ORDER BY s.created_at DESC`,
      params
    );
    res.json({ data: result.rows });
  } catch (err) { next(err); }
};

exports.create = async (req, res, next) => {
  try {
    // Avoid duplicates when converting/confirming the same quotation twice
    if (req.body.quotationId) {
      const dup = await query(
        'SELECT * FROM shipments WHERE quotation_id = $1 AND deleted_at IS NULL LIMIT 1',
        [req.body.quotationId]
      );
      if (dup.rows.length) return res.status(200).json({ data: dup.rows[0], existing: true });
    }

    const cols = ['created_by'];
    const vals = [req.user.id];
    const placeholders = ['$1'];

    for (const [key, col] of Object.entries(FIELDS)) {
      if (req.body[key] !== undefined) {
        vals.push(norm(col, req.body[key]));
        cols.push(col);
        placeholders.push(`$${vals.length}`);
      }
    }

    const result = await query(
      `INSERT INTO shipments (${cols.join(', ')}) VALUES (${placeholders.join(', ')}) RETURNING *`,
      vals
    );
    const ship = result.rows[0];
    await audit.log(req, { action: 'CREATE', entityType: 'shipment', entityId: ship.id, entityLabel: ship.reference || ship.booking_no });
    res.status(201).json({ data: ship });
  } catch (err) { next(err); }
};

exports.update = async (req, res, next) => {
  try {
    const sets = [];
    const vals = [];
    for (const [key, col] of Object.entries(FIELDS)) {
      if (req.body[key] !== undefined) {
        vals.push(norm(col, req.body[key]));
        sets.push(`${col} = $${vals.length}`);
      }
    }
    if (!sets.length) return res.status(400).json({ error: 'No fields to update' });

    vals.push(req.params.id);
    const result = await query(
      `UPDATE shipments SET ${sets.join(', ')}, updated_at = NOW()
       WHERE id = $${vals.length} AND deleted_at IS NULL RETURNING *`,
      vals
    );
    if (!result.rows.length) return res.status(404).json({ error: 'Shipment not found' });
    res.json({ data: result.rows[0] });
  } catch (err) { next(err); }
};

exports.archive = async (req, res, next) => {
  try {
    const archive = req.body.archive !== false; // default true
    const r = await query(
      'UPDATE shipments SET is_archived = $1, updated_at = NOW() WHERE id = $2 AND deleted_at IS NULL RETURNING reference, booking_no',
      [archive, req.params.id]
    );
    if (!r.rows.length) return res.status(404).json({ error: 'Shipment not found' });
    await audit.log(req, { action: archive ? 'ARCHIVE' : 'UNARCHIVE', entityType: 'shipment', entityId: req.params.id, entityLabel: r.rows[0].reference || r.rows[0].booking_no });
    res.json({ message: archive ? 'Shipment archived' : 'Shipment restored' });
  } catch (err) { next(err); }
};

exports.delete = async (req, res, next) => {
  try {
    const r = await query('UPDATE shipments SET deleted_at = NOW() WHERE id = $1 RETURNING reference, booking_no', [req.params.id]);
    await audit.log(req, { action: 'DELETE', entityType: 'shipment', entityId: req.params.id, entityLabel: r.rows[0]?.reference || r.rows[0]?.booking_no });
    res.json({ message: 'Shipment deleted' });
  } catch (err) { next(err); }
};

// Bulk import from a CSV upload (array of camelCase shipment objects)
exports.importRows = async (req, res, next) => {
  try {
    const { shipments } = req.body;
    if (!Array.isArray(shipments) || !shipments.length) {
      return res.status(400).json({ error: 'No rows to import' });
    }
    // All-or-nothing: a bad row rolls back the whole import so the user
    // re-uploads a clean file rather than chasing a half-imported sheet.
    const imported = await withTransaction(async (client) => {
      let count = 0;
      for (const s of shipments) {
        const cols = ['created_by'];
        const vals = [req.user.id];
        const ph   = ['$1'];
        for (const [key, col] of Object.entries(FIELDS)) {
          if (s[key] !== undefined && s[key] !== '') {
            vals.push(norm(col, s[key]));
            cols.push(col);
            ph.push(`$${vals.length}`);
          }
        }
        // Skip completely empty rows
        if (cols.length <= 1) continue;
        await client.query(`INSERT INTO shipments (${cols.join(', ')}) VALUES (${ph.join(', ')})`, vals);
        count++;
      }
      return count;
    });
    await audit.log(req, { action: 'IMPORT', entityType: 'shipment', entityLabel: `${imported} rows` });
    res.json({ data: { imported } });
  } catch (err) { next(err); }
};
