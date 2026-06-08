const { query, withTransaction } = require('../config/db');
const pdfService = require('../services/pdfService');
const { loadSettings } = require('./settingsController');
const audit = require('./auditController');

const generateInvNo = () => {
  const now = new Date();
  const year = now.getFullYear().toString().slice(2);
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const rand = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
  return `INV-${year}${month}-${rand}`;
};

// Full invoice row with all joined data (used by getById + generatePdf)
const FULL_SELECT = `
  SELECT i.*,
    c.company_name AS client_name,
    c.address      AS client_address,
    c.country      AS client_country,
    u.full_name    AS created_by_name,
    q.origin, q.destination, q.service_type, q.cargo_type,
    q.carrier      AS q_carrier,
    q.incoterms,
    ba.account_name  AS ba_account_name,
    ba.account_number AS ba_account_number,
    ba.currency      AS ba_currency,
    ba.iban          AS ba_iban,
    ba.bank_name     AS ba_bank_name,
    ba.bank_address  AS ba_bank_address,
    ba.swift_code    AS ba_swift_code
  FROM invoices i
  LEFT JOIN clients c ON i.client_id = c.id
  LEFT JOIN users   u ON i.created_by = u.id
  LEFT JOIN quotations q ON i.quotation_id = q.id
  LEFT JOIN bank_accounts ba ON i.bank_account_id = ba.id
`;

// Helper: insert charge rows for an invoice. `db` is a transaction client
// (or the pool) so callers can run this inside a transaction.
async function insertCharges(db, invoiceId, charges) {
  for (const ch of charges) {
    await db.query(
      `INSERT INTO invoice_charges
         (invoice_id, description, category, qty, unit_rate, amount, currency)
       VALUES ($1,$2,$3,$4,$5,$6,$7)`,
      [
        invoiceId,
        ch.description,
        ch.category  || 'Freight',
        ch.qty       || 1,
        ch.unitRate  != null ? parseFloat(ch.unitRate) : null,
        parseFloat(ch.amount),
        ch.currency  || 'USD',
      ]
    );
  }
}

exports.getAll = async (req, res, next) => {
  try {
    const { clientId, paymentStatus, page = 1, limit = 20 } = req.query;
    const offset = (page - 1) * limit;
    const params = [];
    const conditions = ['i.deleted_at IS NULL'];

    if (clientId) { params.push(clientId); conditions.push(`i.client_id = $${params.length}`); }
    if (paymentStatus) { params.push(paymentStatus); conditions.push(`i.payment_status = $${params.length}::payment_status`); }

    const whereClause = `WHERE ${conditions.join(' AND ')}`;
    params.push(limit, offset);

    const result = await query(
      `SELECT i.*, c.company_name AS client_name, u.full_name AS created_by_name
       FROM invoices i
       LEFT JOIN clients c ON i.client_id = c.id
       LEFT JOIN users u ON i.created_by = u.id
       ${whereClause}
       ORDER BY i.due_date ASC
       LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params
    );

    // Mark overdue
    await query(
      `UPDATE invoices SET payment_status = 'Overdue'
       WHERE payment_status = 'Pending' AND due_date < NOW()::date AND deleted_at IS NULL`
    );

    res.json({ data: result.rows });
  } catch (err) { next(err); }
};

exports.getById = async (req, res, next) => {
  try {
    const result = await query(
      `${FULL_SELECT} WHERE i.id = $1 AND i.deleted_at IS NULL`,
      [req.params.id]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'Invoice not found' });

    const inv = result.rows[0];

    // Attach invoice-level charges (for standalone invoices)
    const chargesRes = await query(
      `SELECT * FROM invoice_charges WHERE invoice_id = $1 ORDER BY created_at`,
      [inv.id]
    );
    inv.invoice_charges = chargesRes.rows;

    res.json({ data: inv });
  } catch (err) { next(err); }
};

exports.create = async (req, res, next) => {
  try {
    const {
      clientId, quotationId, description, amount, currency,
      dueDate, notes, buyingTotal, blNumber, vessel, shippingLine, clientVat,
      pol, pod, containerType, containerQty, cargoType, shipmentType, customInvoiceNo, bankAccountId, charges,
    } = req.body;

    // Use quotation's reference number as invoice number when linked.
    // If that number is already taken (multiple invoices per quotation),
    // append a counter suffix: REF-2, REF-3, …
    let invNo = generateInvNo();
    let resolvedClientId = clientId;
    if (quotationId) {
      const qRes = await query('SELECT reference_no, client_id FROM quotations WHERE id = $1', [quotationId]);
      if (qRes.rows.length) {
        const baseRef = qRes.rows[0].reference_no;
        if (!resolvedClientId) resolvedClientId = qRes.rows[0].client_id;

        // Count existing invoices that already use this reference (exact or suffixed)
        const taken = await query(
          `SELECT invoice_no FROM invoices
           WHERE (invoice_no = $1 OR invoice_no LIKE $2) AND deleted_at IS NULL`,
          [baseRef, `${baseRef}-%`]
        );
        invNo = taken.rows.length === 0 ? baseRef : `${baseRef}-${taken.rows.length + 1}`;
      }
    }

    const inv = await withTransaction(async (client) => {
      const result = await client.query(
        `INSERT INTO invoices
           (client_id, quotation_id, invoice_no, custom_invoice_no, description, amount, currency,
            due_date, notes, created_by, buying_total,
            bl_number, vessel, shipping_line, client_vat,
            pol, pod, container_type, container_qty, cargo_type, shipment_type, bank_account_id)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22) RETURNING *`,
        [
          resolvedClientId, quotationId || null, invNo, customInvoiceNo || null, description, amount,
          currency || 'USD', dueDate, notes, req.user.id, buyingTotal || null,
          blNumber || null, vessel || null, shippingLine || null, clientVat || null,
          pol || null, pod || null, containerType || null, containerQty || null, cargoType || null, shipmentType || null,
          bankAccountId || null,
        ]
      );
      const row = result.rows[0];

      // Save line-item charges (for both standalone and quotation-linked invoices).
      // When linked, the charges are typically prefilled from the quotation but
      // the user may have edited them, so we always persist what was submitted.
      if (charges?.length) {
        await insertCharges(client, row.id, charges);
      }
      return row;
    });

    await audit.log(req, { action: 'CREATE', entityType: 'invoice', entityId: inv.id, entityLabel: inv.invoice_no });
    res.status(201).json({ data: inv });
  } catch (err) { next(err); }
};

exports.update = async (req, res, next) => {
  try {
    const {
      description, amount, currency, dueDate, paymentStatus, notes,
      buyingTotal, blNumber, vessel, shippingLine, clientVat,
      pol, pod, containerType, containerQty, cargoType, shipmentType, customInvoiceNo, bankAccountId, charges,
    } = req.body;

    const updated = await withTransaction(async (client) => {
      const result = await client.query(
        `UPDATE invoices SET
           description    = COALESCE($1, description),
           amount         = COALESCE($2, amount),
           currency       = COALESCE($3::currency_type, currency),
           due_date       = COALESCE($4, due_date),
           payment_status = COALESCE($5::payment_status, payment_status),
           notes          = COALESCE($6, notes),
           buying_total   = COALESCE($7, buying_total),
           bl_number      = COALESCE($8, bl_number),
           vessel         = COALESCE($9, vessel),
           shipping_line  = COALESCE($10, shipping_line),
           client_vat     = COALESCE($11, client_vat),
           pol               = COALESCE($12, pol),
           pod               = COALESCE($13, pod),
           container_type    = COALESCE($14, container_type),
           container_qty     = COALESCE($15, container_qty),
           cargo_type        = COALESCE($16, cargo_type),
           custom_invoice_no = $17,
           bank_account_id   = COALESCE($18, bank_account_id),
           shipment_type     = COALESCE($20, shipment_type),
           paid_at           = CASE WHEN $5 = 'Paid' THEN NOW() ELSE paid_at END,
           updated_at        = NOW()
         WHERE id = $19 AND deleted_at IS NULL RETURNING *`,
        [
          description, amount, currency, dueDate, paymentStatus, notes,
          buyingTotal ?? null, blNumber ?? null, vessel ?? null,
          shippingLine ?? null, clientVat ?? null,
          pol ?? null, pod ?? null, containerType ?? null, containerQty ?? null, cargoType ?? null,
          customInvoiceNo || null,
          bankAccountId ?? null,
          req.params.id,
          shipmentType ?? null,
        ]
      );
      if (!result.rows.length) return null;

      // Replace line-item charges if provided (standalone invoices only)
      if (charges !== undefined) {
        await client.query('DELETE FROM invoice_charges WHERE invoice_id = $1', [req.params.id]);
        if (charges.length) {
          await insertCharges(client, req.params.id, charges);
        }
      }
      return result.rows[0];
    });

    if (!updated) return res.status(404).json({ error: 'Invoice not found' });

    await audit.log(req, {
      action: paymentStatus === 'Paid' ? 'MARK_PAID' : 'UPDATE',
      entityType: 'invoice', entityId: req.params.id, entityLabel: updated.invoice_no,
    });
    res.json({ data: updated });
  } catch (err) { next(err); }
};

exports.delete = async (req, res, next) => {
  try {
    const r = await query('UPDATE invoices SET deleted_at = NOW() WHERE id = $1 RETURNING invoice_no', [req.params.id]);
    await audit.log(req, { action: 'DELETE', entityType: 'invoice', entityId: req.params.id, entityLabel: r.rows[0]?.invoice_no });
    res.json({ message: 'Invoice deleted' });
  } catch (err) { next(err); }
};

exports.generatePdf = async (req, res, next) => {
  try {
    const result = await query(
      `${FULL_SELECT} WHERE i.id = $1 AND i.deleted_at IS NULL`,
      [req.params.id]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'Invoice not found' });

    const inv = result.rows[0];
    // Merge carrier: prefer invoice's own shipping_line, fall back to quotation carrier
    inv.carrier = inv.shipping_line || inv.q_carrier || null;

    // Build bank_account object from joined columns (prefixed ba_)
    if (inv.ba_account_name) {
      inv.bank_account = {
        account_name:   inv.ba_account_name,
        account_number: inv.ba_account_number,
        currency:       inv.ba_currency,
        iban:           inv.ba_iban,
        bank_name:      inv.ba_bank_name,
        bank_address:   inv.ba_bank_address,
        swift_code:     inv.ba_swift_code,
      };
    } else {
      inv.bank_account = null;
    }

    // Fetch charges: prefer the invoice's own line items; if none exist and
    // the invoice is linked to a quotation, fall back to the quotation charges
    // (covers older invoices created before charges were stored per-invoice).
    let chargesRes = await query(
      `SELECT description, category, amount, currency, qty, unit_rate
       FROM invoice_charges
       WHERE invoice_id = $1
       ORDER BY created_at`,
      [inv.id]
    );
    if (chargesRes.rows.length === 0 && inv.quotation_id) {
      chargesRes = await query(
        `SELECT description, category, amount, currency, qty, unit_rate
         FROM quotation_charges
         WHERE quotation_id = $1
         ORDER BY created_at`,
        [inv.quotation_id]
      );
    }
    inv.charges = chargesRes.rows.length > 0 ? chargesRes.rows : null;

    const settings = await loadSettings();
    const pdfBuffer = await pdfService.generateInvoicePdf(inv, settings);
    const filename = `invoice-${inv.invoice_no}.pdf`.replace(/[^a-zA-Z0-9._-]/g, '_');
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Content-Length': pdfBuffer.length,
    });
    res.send(pdfBuffer);
  } catch (err) { next(err); }
};
