const router  = require('express').Router({ mergeParams: true });
const multer  = require('multer');
const path    = require('path');
const fs      = require('fs');
const { v4: uuidv4 } = require('uuid');
const { authenticate, authorize } = require('../middleware/auth');
const { query } = require('../config/db');

const canAccess = authorize('Admin', 'Sales Manager', 'Operation');

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, process.env.UPLOAD_DIR || 'uploads'),
  filename:    (req, file, cb) => cb(null, `${uuidv4()}${path.extname(file.originalname)}`),
});
const upload = multer({
  storage,
  limits: { fileSize: parseInt(process.env.MAX_FILE_SIZE) || 20 * 1024 * 1024 },
});

router.use(authenticate, canAccess);

// List attachments for a shipment
router.get('/', async (req, res, next) => {
  try {
    const result = await query(
      `SELECT sa.*, u.full_name AS uploaded_by_name
       FROM shipment_attachments sa
       LEFT JOIN users u ON sa.uploaded_by = u.id
       WHERE sa.shipment_id = $1
       ORDER BY sa.created_at DESC`,
      [req.params.shipmentId]
    );
    res.json({ data: result.rows });
  } catch (err) { next(err); }
});

// Upload one or more files
router.post('/', upload.array('files', 20), async (req, res, next) => {
  try {
    const { shipmentId } = req.params;
    const inserted = [];
    for (const f of req.files || []) {
      const url = `/uploads/${f.filename}`;
      const r = await query(
        `INSERT INTO shipment_attachments (shipment_id, filename, stored_as, url, size, mime, uploaded_by)
         VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
        [shipmentId, f.originalname, f.filename, url, f.size, f.mimetype, req.user.id]
      );
      inserted.push(r.rows[0]);
    }
    res.status(201).json({ data: inserted });
  } catch (err) { next(err); }
});

// Delete a single attachment
router.delete('/:attachmentId', async (req, res, next) => {
  try {
    const r = await query(
      'DELETE FROM shipment_attachments WHERE id = $1 AND shipment_id = $2 RETURNING stored_as',
      [req.params.attachmentId, req.params.shipmentId]
    );
    if (!r.rows.length) return res.status(404).json({ error: 'Not found' });
    // Remove file from disk
    const filePath = path.join(process.cwd(), process.env.UPLOAD_DIR || 'uploads', r.rows[0].stored_as);
    fs.unlink(filePath, () => {});
    res.json({ data: { deleted: true } });
  } catch (err) { next(err); }
});

module.exports = router;
