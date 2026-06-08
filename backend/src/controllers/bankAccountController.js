const { query } = require('../config/db');

exports.getAll = async (req, res, next) => {
  try {
    const result = await query(
      `SELECT * FROM bank_accounts ORDER BY currency, account_name`
    );
    res.json({ data: result.rows });
  } catch (err) { next(err); }
};

exports.getById = async (req, res, next) => {
  try {
    const result = await query(`SELECT * FROM bank_accounts WHERE id = $1`, [req.params.id]);
    if (!result.rows.length) return res.status(404).json({ error: 'Bank account not found' });
    res.json({ data: result.rows[0] });
  } catch (err) { next(err); }
};

exports.create = async (req, res, next) => {
  try {
    const { accountName, accountNumber, currency, iban, bankName, bankAddress, swiftCode, notes } = req.body;
    const result = await query(
      `INSERT INTO bank_accounts
         (account_name, account_number, currency, iban, bank_name, bank_address, swift_code, notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
      [accountName, accountNumber || null, currency || 'USD',
       iban || null, bankName || null, bankAddress || null, swiftCode || null, notes || null]
    );
    res.status(201).json({ data: result.rows[0] });
  } catch (err) { next(err); }
};

exports.update = async (req, res, next) => {
  try {
    const { accountName, accountNumber, currency, iban, bankName, bankAddress, swiftCode, notes, isActive } = req.body;
    const result = await query(
      `UPDATE bank_accounts SET
         account_name   = COALESCE($1, account_name),
         account_number = COALESCE($2, account_number),
         currency       = COALESCE($3, currency),
         iban           = COALESCE($4, iban),
         bank_name      = COALESCE($5, bank_name),
         bank_address   = COALESCE($6, bank_address),
         swift_code     = COALESCE($7, swift_code),
         notes          = COALESCE($8, notes),
         is_active      = COALESCE($9, is_active)
       WHERE id = $10 RETURNING *`,
      [accountName || null, accountNumber ?? null, currency || null,
       iban ?? null, bankName ?? null, bankAddress ?? null, swiftCode ?? null,
       notes ?? null, isActive ?? null,
       req.params.id]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'Bank account not found' });
    res.json({ data: result.rows[0] });
  } catch (err) { next(err); }
};

exports.delete = async (req, res, next) => {
  try {
    // Check if any invoices reference this account
    const refs = await query(
      `SELECT COUNT(*) FROM invoices WHERE bank_account_id = $1 AND deleted_at IS NULL`,
      [req.params.id]
    );
    if (parseInt(refs.rows[0].count) > 0) {
      return res.status(400).json({ error: 'Cannot delete: bank account is used by one or more invoices' });
    }
    await query(`DELETE FROM bank_accounts WHERE id = $1`, [req.params.id]);
    res.json({ message: 'Bank account deleted' });
  } catch (err) { next(err); }
};
