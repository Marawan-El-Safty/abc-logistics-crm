const { query } = require('../config/db');
const audit = require('./auditController');

const isRepRole = (user) => user.role_name === 'Sales Rep';

exports.getAll = async (req, res, next) => {
  try {
    const { search, industry, country, assignedTo, contactType, page = 1, limit = 20 } = req.query;
    const offset = (page - 1) * limit;
    const params = [];
    const conditions = ['c.deleted_at IS NULL'];

    if (search) {
      params.push(`%${search}%`);
      conditions.push(`c.company_name ILIKE $${params.length}`);
    }
    if (industry) {
      params.push(industry);
      conditions.push(`c.industry = $${params.length}`);
    }
    if (country) {
      params.push(`%${country}%`);
      conditions.push(`c.country ILIKE $${params.length}`);
    }
    if (contactType) {
      params.push(contactType);
      conditions.push(`c.contact_type = $${params.length}`);
    }
    if (assignedTo && !isRepRole(req.user)) {
      params.push(assignedTo);
      conditions.push(`c.assigned_to = $${params.length}`);
    }

    const whereClause = `WHERE ${conditions.join(' AND ')}`;
    const countResult = await query(`SELECT COUNT(*) FROM clients c ${whereClause}`, params);
    const total = parseInt(countResult.rows[0].count);

    params.push(limit, offset);
    const result = await query(
      `SELECT c.*, u.full_name AS assigned_to_name,
              (SELECT COUNT(*) FROM activities a WHERE a.client_id = c.id) AS activity_count,
              (SELECT MAX(a.activity_date) FROM activities a WHERE a.client_id = c.id) AS last_activity_at
       FROM clients c
       LEFT JOIN users u ON c.assigned_to = u.id
       ${whereClause}
       ORDER BY c.updated_at DESC
       LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params
    );

    res.json({ data: result.rows, total, page: parseInt(page), limit: parseInt(limit) });
  } catch (err) { next(err); }
};

exports.getById = async (req, res, next) => {
  try {
    const clientResult = await query(
      `SELECT c.*, u.full_name AS assigned_to_name, cb.full_name AS created_by_name
       FROM clients c
       LEFT JOIN users u ON c.assigned_to = u.id
       LEFT JOIN users cb ON c.created_by = cb.id
       WHERE c.id = $1 AND c.deleted_at IS NULL`,
      [req.params.id]
    );
    if (!clientResult.rows.length) return res.status(404).json({ error: 'Client not found' });

    const [contacts, branches, activities, quotations] = await Promise.all([
      query('SELECT * FROM client_contacts WHERE client_id = $1 ORDER BY is_primary DESC, full_name', [req.params.id]),
      query('SELECT * FROM client_branches WHERE client_id = $1 ORDER BY name', [req.params.id]),
      query(
        `SELECT a.*, u.full_name AS performed_by_name FROM activities a
         LEFT JOIN users u ON a.performed_by = u.id
         WHERE a.client_id = $1 ORDER BY a.activity_date DESC LIMIT 20`,
        [req.params.id]
      ),
      query(
        `SELECT q.*, u.full_name AS created_by_name FROM quotations q
         LEFT JOIN users u ON q.created_by = u.id
         WHERE q.client_id = $1 AND q.deleted_at IS NULL ORDER BY q.created_at DESC`,
        [req.params.id]
      ),
    ]);

    res.json({
      data: {
        ...clientResult.rows[0],
        contacts: contacts.rows,
        branches: branches.rows,
        recentActivities: activities.rows,
        quotations: quotations.rows,
      },
    });
  } catch (err) { next(err); }
};

exports.create = async (req, res, next) => {
  try {
    const { companyName, industry, country, address, website, notes, assignedTo, contactType, email, phone, productType } = req.body;
    const assignee = isRepRole(req.user) ? req.user.id : (assignedTo || req.user.id);
    const result = await query(
      `INSERT INTO clients (company_name, industry, country, address, website, notes, assigned_to, created_by, contact_type, email, phone, product_type)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
       RETURNING *`,
      [companyName?.toUpperCase() || null, industry || 'Other', country?.toUpperCase() || null, address, website, notes, assignee, req.user.id, contactType || 'Client', email, phone, productType || null]
    );
    res.status(201).json({ data: result.rows[0] });
  } catch (err) { next(err); }
};

exports.update = async (req, res, next) => {
  try {
    const { companyName, industry, country, address, website, notes, assignedTo, isActive, contactType, email, phone, productType } = req.body;
    const result = await query(
      `UPDATE clients SET
         company_name = COALESCE($1, company_name),
         industry = COALESCE($2::industry_type, industry),
         country = COALESCE($3, country),
         address = COALESCE($4, address),
         website = COALESCE($5, website),
         notes = COALESCE($6, notes),
         assigned_to = COALESCE($7, assigned_to),
         is_active = COALESCE($8, is_active),
         contact_type = COALESCE($9, contact_type),
         email = COALESCE($10, email),
         phone = COALESCE($11, phone),
         product_type = COALESCE($12, product_type),
         updated_at = NOW()
       WHERE id = $13 AND deleted_at IS NULL RETURNING *`,
      [companyName?.toUpperCase() || null, industry, country?.toUpperCase() || null, address, website, notes, assignedTo, isActive, contactType, email, phone, productType || null, req.params.id]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'Client not found' });
    res.json({ data: result.rows[0] });
  } catch (err) { next(err); }
};

exports.delete = async (req, res, next) => {
  try {
    const r = await query('UPDATE clients SET deleted_at = NOW() WHERE id = $1 RETURNING company_name', [req.params.id]);
    await audit.log(req, { action: 'DELETE', entityType: 'client', entityId: req.params.id, entityLabel: r.rows[0]?.company_name });
    res.json({ message: 'Client deleted' });
  } catch (err) { next(err); }
};

// Contacts
exports.addContact = async (req, res, next) => {
  try {
    const { fullName, title, phone, email, whatsapp, isPrimary } = req.body;
    if (isPrimary) {
      await query('UPDATE client_contacts SET is_primary = FALSE WHERE client_id = $1', [req.params.id]);
    }
    const result = await query(
      `INSERT INTO client_contacts (client_id, full_name, title, phone, email, whatsapp, is_primary)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [req.params.id, fullName, title, phone, email, whatsapp, isPrimary || false]
    );
    res.status(201).json({ data: result.rows[0] });
  } catch (err) { next(err); }
};

exports.updateContact = async (req, res, next) => {
  try {
    const { fullName, title, phone, email, whatsapp, isPrimary } = req.body;
    if (isPrimary) {
      await query('UPDATE client_contacts SET is_primary = FALSE WHERE client_id = $1', [req.params.id]);
    }
    const result = await query(
      `UPDATE client_contacts SET
         full_name = COALESCE($1, full_name),
         title = COALESCE($2, title),
         phone = COALESCE($3, phone),
         email = COALESCE($4, email),
         whatsapp = COALESCE($5, whatsapp),
         is_primary = COALESCE($6, is_primary)
       WHERE id = $7 AND client_id = $8 RETURNING *`,
      [fullName, title, phone, email, whatsapp, isPrimary, req.params.contactId, req.params.id]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'Contact not found' });
    res.json({ data: result.rows[0] });
  } catch (err) { next(err); }
};

exports.deleteContact = async (req, res, next) => {
  try {
    await query('DELETE FROM client_contacts WHERE id = $1 AND client_id = $2', [req.params.contactId, req.params.id]);
    res.json({ message: 'Contact deleted' });
  } catch (err) { next(err); }
};

// Branches
exports.addBranch = async (req, res, next) => {
  try {
    const { name, country, address, phone, notes } = req.body;
    const result = await query(
      `INSERT INTO client_branches (client_id, name, country, address, phone, notes)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [req.params.id, name, country, address, phone, notes]
    );
    res.status(201).json({ data: result.rows[0] });
  } catch (err) { next(err); }
};

exports.deleteBranch = async (req, res, next) => {
  try {
    await query('DELETE FROM client_branches WHERE id = $1 AND client_id = $2', [req.params.branchId, req.params.id]);
    res.json({ message: 'Branch deleted' });
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
      const companyName = getCol(row, 'company_name', 'company', 'name', 'client_name');
      if (!companyName) { skipped++; continue; }
      try {
        await query(
          `INSERT INTO clients (company_name, industry, country, address, website, notes, assigned_to, created_by)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$7)`,
          [
            companyName,
            getCol(row, 'industry') || 'Other',
            getCol(row, 'country'),
            getCol(row, 'address'),
            getCol(row, 'website'),
            getCol(row, 'notes'),
            req.user.id,
          ]
        );
        imported++;
      } catch { skipped++; }
    }
    res.json({ data: { imported, skipped } });
  } catch (err) { next(err); }
};
