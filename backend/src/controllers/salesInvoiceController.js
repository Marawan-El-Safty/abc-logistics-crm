const { query } = require('../config/db');
const audit = require('./auditController');
const { generateSalesInvoicePdf } = require('../services/salesInvoicePdfService');
const { loadSettings } = require('./settingsController');

const generateNo = () => {
  const now = new Date();
  const y = now.getFullYear().toString().slice(2);
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const r = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
  return `SI-${y}${m}-${r}`;
};

exports.getAll = async (req, res, next) => {
  try {
    const { clientId, status, page = 1, limit = 20 } = req.query;
    const offset = (page - 1) * limit;
    const params = [req.tenantId];
    const conditions = ['s.deleted_at IS NULL', 's.tenant_id = $1'];
    if (clientId) { params.push(clientId); conditions.push(`s.client_id = $${params.length}`); }
    if (status)   { params.push(status);   conditions.push(`s.status = $${params.length}`); }
    const countParams = [...params];
    params.push(limit, offset);
    const countResult = await query(
      `SELECT COUNT(*) FROM sales_invoices s WHERE ${conditions.join(' AND ')}`,
      countParams
    );
    const result = await query(
      `SELECT s.*, u.full_name AS created_by_name, c.company_name AS client_display
       FROM sales_invoices s
       LEFT JOIN users u ON s.created_by = u.id
       LEFT JOIN clients c ON s.client_id = c.id
       WHERE ${conditions.join(' AND ')}
       ORDER BY s.created_at DESC
       LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params
    );
    res.json({ data: result.rows, total: parseInt(countResult.rows[0].count), page: parseInt(page), limit: parseInt(limit) });
  } catch (err) { next(err); }
};

exports.create = async (req, res, next) => {
  try {
    const {
      clientId, clientName, clientAddress, vesselValidity, shipmentDetails,
      pol, pod, containerType, customInvoiceNo, currency, items, notes,
    } = req.body;

    const invNo = generateNo();
    const total = (items || []).reduce((s, i) => s + parseFloat(i.total || 0), 0);

    const result = await query(
      `INSERT INTO sales_invoices
         (invoice_no, custom_invoice_no, client_id, client_name, client_address, vessel_validity,
          shipment_details, pol, pod, container_type, currency, items, total_amount, notes, created_by, tenant_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16) RETURNING *`,
      [invNo, customInvoiceNo || null, clientId || null, clientName, clientAddress, vesselValidity || null,
       shipmentDetails, pol || null, pod || null, containerType || null,
       currency || 'USD', JSON.stringify(items || []), total, notes, req.user.id, req.tenantId]
    );
    const inv = result.rows[0];
    await audit.log(req, { action: 'CREATE', entityType: 'sales_invoice', entityId: inv.id, entityLabel: inv.invoice_no });
    res.status(201).json({ data: inv });
  } catch (err) { next(err); }
};

exports.update = async (req, res, next) => {
  try {
    const {
      clientId, clientName, clientAddress, vesselValidity, shipmentDetails,
      pol, pod, containerType, customInvoiceNo, currency, items, notes, status,
    } = req.body;
    const total = items ? items.reduce((s, i) => s + parseFloat(i.total || 0), 0) : undefined;
    const result = await query(
      `UPDATE sales_invoices SET
         client_id        = COALESCE($1, client_id),
         client_name      = COALESCE($2, client_name),
         client_address   = COALESCE($3, client_address),
         vessel_validity  = COALESCE($4, vessel_validity),
         shipment_details   = COALESCE($5, shipment_details),
         pol                = COALESCE($6, pol),
         pod                = COALESCE($7, pod),
         container_type     = COALESCE($8, container_type),
         custom_invoice_no  = $9,
         currency           = COALESCE($10, currency),
         items              = COALESCE($11, items),
         total_amount       = COALESCE($12, total_amount),
         notes              = COALESCE($13, notes),
         status             = COALESCE($14, status),
         updated_at         = NOW()
       WHERE id = $15 AND tenant_id = $16 AND deleted_at IS NULL RETURNING *`,
      [clientId || null, clientName, clientAddress, vesselValidity || null,
       shipmentDetails, pol || null, pod || null, containerType || null,
       customInvoiceNo || null, currency, items ? JSON.stringify(items) : undefined,
       total, notes, status, req.params.id, req.tenantId]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'Sales invoice not found' });
    await audit.log(req, { action: 'UPDATE', entityType: 'sales_invoice', entityId: req.params.id, entityLabel: result.rows[0].invoice_no });
    res.json({ data: result.rows[0] });
  } catch (err) { next(err); }
};

exports.delete = async (req, res, next) => {
  try {
    const r = await query(
      'UPDATE sales_invoices SET deleted_at = NOW() WHERE id = $1 AND tenant_id = $2 RETURNING invoice_no',
      [req.params.id, req.tenantId]
    );
    if (!r.rows.length) return res.status(404).json({ error: 'Not found' });
    await audit.log(req, { action: 'DELETE', entityType: 'sales_invoice', entityId: req.params.id, entityLabel: r.rows[0].invoice_no });
    res.json({ data: { deleted: true } });
  } catch (err) { next(err); }
};

exports.generatePdf = async (req, res, next) => {
  try {
    const result = await query(
      `SELECT s.*, c.address AS client_address_full, c.country AS client_country,
              u.full_name AS rep_name, u.email AS rep_email, u.phone AS rep_phone
       FROM sales_invoices s
       LEFT JOIN clients c ON s.client_id = c.id
       LEFT JOIN users u ON s.created_by = u.id
       WHERE s.id = $1 AND s.tenant_id = $2 AND s.deleted_at IS NULL`,
      [req.params.id, req.tenantId]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'Not found' });
    const inv = result.rows[0];
    const settings = await loadSettings(req.tenantId);
    const buf = await generateSalesInvoicePdf(inv, settings);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="sales-invoice-${inv.invoice_no}.pdf"`);
    res.send(buf);
  } catch (err) { next(err); }
};
