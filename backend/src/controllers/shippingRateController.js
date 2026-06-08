const { query } = require('../config/db');

exports.getAll = async (req, res, next) => {
  try {
    const { search, pol, pod, shippingLine, status } = req.query;
    const filterParams = [];
    const conditions   = ['sr.deleted_at IS NULL'];

    if (search) {
      filterParams.push(`%${search.toLowerCase()}%`);
      const n = filterParams.length;
      conditions.push(
        `(LOWER(sr.shipping_line) LIKE $${n} OR LOWER(sr.pol) LIKE $${n} OR LOWER(sr.pod) LIKE $${n})`
      );
    }
    if (pol) {
      filterParams.push(`%${pol.toLowerCase()}%`);
      conditions.push(`LOWER(sr.pol) LIKE $${filterParams.length}`);
    }
    if (pod) {
      filterParams.push(`%${pod.toLowerCase()}%`);
      conditions.push(`LOWER(sr.pod) LIKE $${filterParams.length}`);
    }
    if (shippingLine) {
      filterParams.push(`%${shippingLine.toLowerCase()}%`);
      conditions.push(`LOWER(sr.shipping_line) LIKE $${filterParams.length}`);
    }
    if (status === 'active')  conditions.push(`sr.valid_to >= CURRENT_DATE`);
    if (status === 'expired') conditions.push(`sr.valid_to <  CURRENT_DATE`);

    const where = `WHERE ${conditions.join(' AND ')}`;

    const result = await query(
      `SELECT sr.*, u.full_name AS created_by_name
       FROM shipping_rates sr
       LEFT JOIN users u ON sr.created_by = u.id
       ${where}
       ORDER BY
         CASE WHEN sr.valid_to >= CURRENT_DATE THEN 0 ELSE 1 END,
         sr.valid_to DESC,
         sr.created_at DESC`,
      filterParams
    );

    res.json({ data: result.rows });
  } catch (err) { next(err); }
};

exports.create = async (req, res, next) => {
  try {
    const {
      shippingLine, pol, pod, serviceType,
      rate20dc, rate40dc, rate40hc, rateLcl,
      currency, transitTime, freeDays,
      validFrom, validTo, notes,
    } = req.body;

    if (!shippingLine || !pol || !pod || !validTo) {
      return res.status(400).json({ error: 'Shipping line, POL, POD and valid-to date are required' });
    }

    const result = await query(
      `INSERT INTO shipping_rates
         (shipping_line, pol, pod, service_type,
          rate_20dc, rate_40dc, rate_40hc, rate_lcl,
          currency, transit_time, free_days,
          valid_from, valid_to, notes, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
       RETURNING *`,
      [
        shippingLine.trim(),
        pol.trim().toUpperCase(),
        pod.trim().toUpperCase(),
        serviceType || 'FCL',
        rate20dc  ? parseFloat(rate20dc)  : null,
        rate40dc  ? parseFloat(rate40dc)  : null,
        rate40hc  ? parseFloat(rate40hc)  : null,
        rateLcl   ? parseFloat(rateLcl)   : null,
        currency  || 'USD',
        transitTime || null,
        freeDays  ? parseInt(freeDays)    : null,
        validFrom || new Date().toISOString().slice(0, 10),
        validTo,
        notes     || null,
        req.user.id,
      ]
    );
    res.status(201).json({ data: result.rows[0] });
  } catch (err) { next(err); }
};

exports.update = async (req, res, next) => {
  try {
    const {
      shippingLine, pol, pod, serviceType,
      rate20dc, rate40dc, rate40hc, rateLcl,
      currency, transitTime, freeDays,
      validFrom, validTo, notes,
    } = req.body;

    const result = await query(
      `UPDATE shipping_rates SET
         shipping_line = COALESCE($1,  shipping_line),
         pol           = COALESCE($2,  pol),
         pod           = COALESCE($3,  pod),
         service_type  = COALESCE($4,  service_type),
         rate_20dc     = $5,
         rate_40dc     = $6,
         rate_40hc     = $7,
         rate_lcl      = $8,
         currency      = COALESCE($9,  currency),
         transit_time  = $10,
         free_days     = $11,
         valid_from    = COALESCE($12, valid_from),
         valid_to      = COALESCE($13, valid_to),
         notes         = $14,
         updated_at    = NOW()
       WHERE id = $15 AND deleted_at IS NULL
       RETURNING *`,
      [
        shippingLine?.trim()         || null,
        pol?.trim().toUpperCase()    || null,
        pod?.trim().toUpperCase()    || null,
        serviceType                  || null,
        rate20dc  ? parseFloat(rate20dc)  : null,
        rate40dc  ? parseFloat(rate40dc)  : null,
        rate40hc  ? parseFloat(rate40hc)  : null,
        rateLcl   ? parseFloat(rateLcl)   : null,
        currency                     || null,
        transitTime                  || null,
        freeDays  ? parseInt(freeDays)    : null,
        validFrom                    || null,
        validTo                      || null,
        notes                        || null,
        req.params.id,
      ]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'Rate not found' });
    res.json({ data: result.rows[0] });
  } catch (err) { next(err); }
};

exports.delete = async (req, res, next) => {
  try {
    await query(
      'UPDATE shipping_rates SET deleted_at = NOW() WHERE id = $1',
      [req.params.id]
    );
    res.json({ message: 'Rate deleted' });
  } catch (err) { next(err); }
};

// Suggest active rates matching a quotation's POL/POD/service type
exports.suggest = async (req, res, next) => {
  try {
    const { pol, pod, serviceType } = req.query;
    const params = [];
    const conditions = ['sr.deleted_at IS NULL', 'sr.valid_to >= CURRENT_DATE'];

    // Extract city name from "Alexandria, Egypt" → search for "alexandria"
    if (pol) {
      const city = pol.split(',')[0].trim().toLowerCase();
      params.push(`%${city}%`);
      conditions.push(`LOWER(sr.pol) LIKE $${params.length}`);
    }
    if (pod) {
      const city = pod.split(',')[0].trim().toLowerCase();
      params.push(`%${city}%`);
      conditions.push(`LOWER(sr.pod) LIKE $${params.length}`);
    }
    if (serviceType) {
      if (serviceType.toLowerCase().includes('lcl')) {
        params.push('LCL');
        conditions.push(`sr.service_type = $${params.length}`);
      } else if (serviceType.toLowerCase().includes('fcl')) {
        params.push('FCL');
        conditions.push(`sr.service_type = $${params.length}`);
      }
    }

    const result = await query(
      `SELECT sr.*, u.full_name AS created_by_name
       FROM shipping_rates sr
       LEFT JOIN users u ON sr.created_by = u.id
       WHERE ${conditions.join(' AND ')}
       ORDER BY sr.valid_to DESC, sr.created_at DESC
       LIMIT 15`,
      params
    );
    res.json({ data: result.rows });
  } catch (err) { next(err); }
};
