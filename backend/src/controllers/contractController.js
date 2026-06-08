const path = require('path');
const fs = require('fs');
const { query } = require('../config/db');

exports.getByClient = async (req, res, next) => {
  try {
    const result = await query(
      `SELECT c.*, u.full_name AS uploaded_by_name FROM contracts c
       LEFT JOIN users u ON c.uploaded_by = u.id
       WHERE c.client_id = $1 AND c.deleted_at IS NULL
       ORDER BY c.created_at DESC`,
      [req.params.clientId]
    );
    res.json({ data: result.rows });
  } catch (err) { next(err); }
};

exports.upload = async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
    const { title, startDate, endDate, notes } = req.body;
    const fileUrl = `/uploads/${req.file.filename}`;
    const result = await query(
      `INSERT INTO contracts (client_id, title, file_url, file_name, file_size, start_date, end_date, notes, uploaded_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
      [req.params.clientId, title, fileUrl, req.file.originalname, req.file.size,
       startDate || null, endDate || null, notes, req.user.id]
    );
    res.status(201).json({ data: result.rows[0] });
  } catch (err) { next(err); }
};

exports.delete = async (req, res, next) => {
  try {
    const result = await query(
      'UPDATE contracts SET deleted_at = NOW() WHERE id = $1 AND client_id = $2 RETURNING file_url',
      [req.params.contractId, req.params.clientId]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'Contract not found' });
    res.json({ message: 'Contract deleted' });
  } catch (err) { next(err); }
};
