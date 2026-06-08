const { query, withTransaction } = require('../config/db');
const audit = require('./auditController');
const { generateBlPdf } = require('../services/blPdfService');
const { loadSettings } = require('./settingsController');

exports.getByShipment = async (req, res, next) => {
  try {
    const result = await query(
      `SELECT b.*, u.full_name AS created_by_name
       FROM bl_documents b
       LEFT JOIN users u ON b.created_by = u.id
       WHERE b.shipment_id = $1 AND b.deleted_at IS NULL
       ORDER BY b.created_at DESC`,
      [req.params.shipmentId]
    );
    res.json({ data: result.rows });
  } catch (err) { next(err); }
};

exports.create = async (req, res, next) => {
  try {
    const {
      shipmentId, blNo, bookingNo, shipper, consignee, notifyParty, alsoNotify,
      preCarriage, placeOfReceipt, pol, pod, finalDestination, vessel, voyageNo,
      placeOfDelivery, containerNo, noOfPkgs, description, grossWeight, measurement,
      freightCharges, paymentTerms, placeIssued, dateIssued, noOfOriginals, deliveryAgent,
    } = req.body;

    const result = await query(
      `INSERT INTO bl_documents
         (shipment_id, bl_no, booking_no, shipper, consignee, notify_party, also_notify,
          pre_carriage, place_of_receipt, pol, pod, final_destination, vessel, voyage_no,
          place_of_delivery, container_no, no_of_pkgs, description, gross_weight, measurement,
          freight_charges, payment_terms, place_issued, date_issued, no_of_originals,
          delivery_agent, status, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,'Draft',$27)
       RETURNING *`,
      [
        shipmentId || null, blNo, bookingNo, shipper, consignee, notifyParty, alsoNotify,
        preCarriage, placeOfReceipt, pol, pod, finalDestination, vessel, voyageNo,
        placeOfDelivery, containerNo, noOfPkgs, description, grossWeight, measurement,
        freightCharges, paymentTerms, placeIssued || 'Alexandria', dateIssued, noOfOriginals || 3,
        deliveryAgent, req.user.id,
      ]
    );
    const bl = result.rows[0];
    await audit.log(req, { action: 'CREATE', entityType: 'bl', entityId: bl.id, entityLabel: bl.bl_no });
    res.status(201).json({ data: bl });
  } catch (err) { next(err); }
};

exports.update = async (req, res, next) => {
  try {
    const fields = [
      'bl_no', 'booking_no', 'shipper', 'consignee', 'notify_party', 'also_notify',
      'pre_carriage', 'place_of_receipt', 'pol', 'pod', 'final_destination', 'vessel',
      'voyage_no', 'place_of_delivery', 'container_no', 'no_of_pkgs', 'description',
      'gross_weight', 'measurement', 'freight_charges', 'payment_terms', 'place_issued',
      'date_issued', 'no_of_originals', 'delivery_agent', 'status',
    ];
    const camelToSnake = {
      blNo: 'bl_no', bookingNo: 'booking_no', notifyParty: 'notify_party',
      alsoNotify: 'also_notify', preCarriage: 'pre_carriage', placeOfReceipt: 'place_of_receipt',
      finalDestination: 'final_destination', voyageNo: 'voyage_no', placeOfDelivery: 'place_of_delivery',
      containerNo: 'container_no', noOfPkgs: 'no_of_pkgs', grossWeight: 'gross_weight',
      freightCharges: 'freight_charges', paymentTerms: 'payment_terms', placeIssued: 'place_issued',
      dateIssued: 'date_issued', noOfOriginals: 'no_of_originals', deliveryAgent: 'delivery_agent',
    };

    const sets = [];
    const vals = [];
    for (const [camel, snake] of Object.entries(camelToSnake)) {
      if (req.body[camel] !== undefined) {
        vals.push(req.body[camel]);
        sets.push(`${snake} = $${vals.length}`);
      }
    }
    for (const snake of ['pol','pod','vessel','description','measurement','status','shipper','consignee']) {
      if (req.body[snake] !== undefined) {
        vals.push(req.body[snake]);
        sets.push(`${snake} = $${vals.length}`);
      }
    }
    if (!sets.length) return res.status(400).json({ error: 'Nothing to update' });

    vals.push(req.params.id);
    sets.push('updated_at = NOW()');

    const result = await query(
      `UPDATE bl_documents SET ${sets.join(', ')} WHERE id = $${vals.length} AND deleted_at IS NULL RETURNING *`,
      vals
    );
    if (!result.rows.length) return res.status(404).json({ error: 'B/L not found' });
    await audit.log(req, { action: 'UPDATE', entityType: 'bl', entityId: req.params.id, entityLabel: result.rows[0].bl_no });
    res.json({ data: result.rows[0] });
  } catch (err) { next(err); }
};

exports.delete = async (req, res, next) => {
  try {
    const r = await query(
      'UPDATE bl_documents SET deleted_at = NOW() WHERE id = $1 AND deleted_at IS NULL RETURNING bl_no',
      [req.params.id]
    );
    if (!r.rows.length) return res.status(404).json({ error: 'B/L not found' });
    await audit.log(req, { action: 'DELETE', entityType: 'bl', entityId: req.params.id, entityLabel: r.rows[0].bl_no });
    res.json({ data: { deleted: true } });
  } catch (err) { next(err); }
};

exports.generatePdf = async (req, res, next) => {
  try {
    const result = await query(
      'SELECT * FROM bl_documents WHERE id = $1 AND deleted_at IS NULL',
      [req.params.id]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'B/L not found' });
    const bl = result.rows[0];
    const settings = await loadSettings();
    const pdfBuffer = await generateBlPdf(bl, settings);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="BL-${bl.bl_no || bl.id}.pdf"`);
    res.send(pdfBuffer);
  } catch (err) { next(err); }
};
