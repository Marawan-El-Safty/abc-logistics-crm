const { query } = require('../config/db');
const audit = require('./auditController');

const isRepRole = (user) => user.role_name === 'Sales Rep';

const STAGE_COLUMNS = {
  'New Lead': 'stage_new_lead_at',
  'Contacted': 'stage_contacted_at',
  'Proposal Sent': 'stage_proposal_at',
  'Negotiating': 'stage_negotiating_at',
  'Won': 'stage_won_at',
  'Lost': 'stage_lost_at',
};

exports.getAll = async (req, res, next) => {
  try {
    const { stage, source, assignedTo, search, page = 1, limit = 50 } = req.query;
    const offset = (page - 1) * limit;
    const params = [];
    const conditions = ['l.deleted_at IS NULL'];

    if (stage) { params.push(stage); conditions.push(`l.stage = $${params.length}::lead_stage`); }
    if (source) { params.push(source); conditions.push(`l.source = $${params.length}::lead_source`); }
    if (assignedTo) { params.push(assignedTo); conditions.push(`l.assigned_to = $${params.length}`); }
    if (search) {
      params.push(`%${search}%`);
      conditions.push(`(l.contact_name ILIKE $${params.length} OR l.company_name ILIKE $${params.length} OR l.email ILIKE $${params.length})`);
    }

    const whereClause = `WHERE ${conditions.join(' AND ')}`;
    const countResult = await query(`SELECT COUNT(*) FROM leads l ${whereClause}`, params);
    const total = parseInt(countResult.rows[0].count);

    params.push(limit, offset);
    const result = await query(
      `SELECT l.*, u.full_name AS assigned_to_name
       FROM leads l LEFT JOIN users u ON l.assigned_to = u.id
       ${whereClause}
       ORDER BY l.updated_at DESC
       LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params
    );

    res.json({ data: result.rows, total, page: parseInt(page), limit: parseInt(limit) });
  } catch (err) { next(err); }
};

exports.getById = async (req, res, next) => {
  try {
    const result = await query(
      `SELECT l.*, u.full_name AS assigned_to_name, c.full_name AS created_by_name
       FROM leads l
       LEFT JOIN users u ON l.assigned_to = u.id
       LEFT JOIN users c ON l.created_by = c.id
       WHERE l.id = $1 AND l.deleted_at IS NULL`,
      [req.params.id]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'Lead not found' });

    const activities = await query(
      `SELECT a.*, u.full_name AS performed_by_name FROM activities a
       LEFT JOIN users u ON a.performed_by = u.id
       WHERE a.lead_id = $1 ORDER BY a.activity_date DESC`,
      [req.params.id]
    );

    res.json({ data: { ...result.rows[0], activities: activities.rows } });
  } catch (err) { next(err); }
};

exports.create = async (req, res, next) => {
  try {
    const {
      contactName, companyName, email, phone, shipmentType, origin, destination,
      cargoDetails, weight, volume, notes, assignedTo, source
    } = req.body;
    const toNum = (v) => (v === '' || v == null) ? null : v;
    const assignee = isRepRole(req.user) ? req.user.id : (assignedTo || req.user.id);
    const result = await query(
      `INSERT INTO leads (contact_name, company_name, email, phone, shipment_type, origin, destination,
         cargo_details, weight, volume, notes, assigned_to, created_by, source, stage_new_lead_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,NOW()) RETURNING *`,
      [contactName, companyName, email, phone, shipmentType || null, origin, destination,
       cargoDetails, toNum(weight), toNum(volume), notes, assignee, req.user.id, source || 'Manual Entry']
    );
    res.status(201).json({ data: result.rows[0] });
  } catch (err) { next(err); }
};

exports.createInbound = async (req, res, next) => {
  try {
    const {
      fullName, companyName, email, phone, shipmentType, origin, destination,
      cargoDetails, weight, volume, notes
    } = req.body;

    // Find manager to assign to
    const mgr = await query(`SELECT id FROM users u JOIN roles r ON u.role_id = r.id WHERE r.name = 'Sales Manager' AND u.is_active = TRUE LIMIT 1`);
    const assignedTo = mgr.rows[0]?.id || null;

    const result = await query(
      `INSERT INTO leads (contact_name, company_name, email, phone, shipment_type, origin, destination,
         cargo_details, weight, volume, notes, assigned_to, created_by, source, stage_new_lead_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$12,$13,NOW()) RETURNING *`,
      [fullName, companyName, email, phone, shipmentType, origin, destination,
       cargoDetails, weight, volume, notes, assignedTo, 'Website Form']
    );

    res.status(201).json({ data: result.rows[0], message: 'Lead created from website form' });
  } catch (err) { next(err); }
};

exports.update = async (req, res, next) => {
  try {
    const {
      contactName, companyName, email, phone, shipmentType, origin, destination,
      cargoDetails, weight, volume, notes, assignedTo
    } = req.body;
    const toNum = (v) => (v === '' || v == null) ? null : v;
    const result = await query(
      `UPDATE leads SET
         contact_name = COALESCE($1, contact_name),
         company_name = COALESCE($2, company_name),
         email = COALESCE($3, email),
         phone = COALESCE($4, phone),
         shipment_type = COALESCE($5::shipment_type, shipment_type),
         origin = COALESCE($6, origin),
         destination = COALESCE($7, destination),
         cargo_details = COALESCE($8, cargo_details),
         weight = COALESCE($9, weight),
         volume = COALESCE($10, volume),
         notes = COALESCE($11, notes),
         assigned_to = COALESCE($12, assigned_to),
         updated_at = NOW()
       WHERE id = $13 AND deleted_at IS NULL RETURNING *`,
      [contactName, companyName, email, phone, shipmentType || null, origin, destination,
       cargoDetails, toNum(weight), toNum(volume), notes, assignedTo, req.params.id]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'Lead not found' });
    res.json({ data: result.rows[0] });
  } catch (err) { next(err); }
};

exports.updateStage = async (req, res, next) => {
  try {
    const { stage, lostReason } = req.body;
    const col = STAGE_COLUMNS[stage];
    if (!col) return res.status(400).json({ error: 'Invalid stage' });

    let updateFields = `stage = $1::lead_stage, ${col} = NOW(), updated_at = NOW()`;
    const params = [stage];

    if (stage === 'Lost') {
      params.push(lostReason || null);
      updateFields += `, lost_reason = $${params.length}`;
    }

    params.push(req.params.id);
    const result = await query(
      `UPDATE leads SET ${updateFields} WHERE id = $${params.length} AND deleted_at IS NULL RETURNING *`,
      params
    );
    if (!result.rows.length) return res.status(404).json({ error: 'Lead not found' });

    // Auto-convert to client if Won
    if (stage === 'Won') {
      const lead = result.rows[0];
      const clientResult = await query(
        `INSERT INTO clients (company_name, country, assigned_to, created_by)
         VALUES ($1, $2, $3, $4) RETURNING id`,
        [lead.company_name || lead.contact_name, null, lead.assigned_to, lead.created_by]
      );
      const clientId = clientResult.rows[0].id;

      if (lead.email || lead.phone) {
        await query(
          `INSERT INTO client_contacts (client_id, full_name, phone, email, is_primary)
           VALUES ($1, $2, $3, $4, TRUE)`,
          [clientId, lead.contact_name, lead.phone, lead.email]
        );
      }

      await query(
        `UPDATE leads SET converted_to = $1, converted_at = NOW() WHERE id = $2`,
        [clientId, req.params.id]
      );

      return res.json({ data: result.rows[0], convertedClientId: clientId });
    }

    res.json({ data: result.rows[0] });
  } catch (err) { next(err); }
};

exports.delete = async (req, res, next) => {
  try {
    const r = await query('UPDATE leads SET deleted_at = NOW() WHERE id = $1 RETURNING company_name', [req.params.id]);
    await audit.log(req, { action: 'DELETE', entityType: 'lead', entityId: req.params.id, entityLabel: r.rows[0]?.company_name });
    res.json({ message: 'Lead deleted' });
  } catch (err) { next(err); }
};

exports.importCsv = async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
    const csv = req.file.buffer.toString('utf8');
    const lines = csv.split('\n').map(l => l.trim()).filter(Boolean);
    if (lines.length < 2) return res.status(400).json({ error: 'CSV must have a header row and at least one data row' });

    const headers = lines[0].split(',').map(h => h.trim().toLowerCase().replace(/\s+/g, '_').replace(/[^a-z_]/g, ''));
    const getCol = (row, ...names) => {
      for (const n of names) {
        const idx = headers.indexOf(n);
        if (idx >= 0 && row[idx]) return row[idx].trim();
      }
      return null;
    };

    let imported = 0, skipped = 0;
    for (let i = 1; i < lines.length; i++) {
      const row = lines[i].split(',');
      const contactName = getCol(row, 'contact_name', 'name', 'full_name', 'contact');
      if (!contactName) { skipped++; continue; }
      try {
        await query(
          `INSERT INTO leads (contact_name, company_name, email, phone, shipment_type, origin, destination, notes, assigned_to, created_by, source, stage_new_lead_at)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'CSV Import',NOW())`,
          [
            contactName,
            getCol(row, 'company_name', 'company'),
            getCol(row, 'email'),
            getCol(row, 'phone'),
            getCol(row, 'shipment_type', 'shipment', 'service_type'),
            getCol(row, 'origin'),
            getCol(row, 'destination'),
            getCol(row, 'notes'),
            req.user.id,
            req.user.id,
          ]
        );
        imported++;
      } catch { skipped++; }
    }
    res.json({ data: { imported, skipped } });
  } catch (err) { next(err); }
};
