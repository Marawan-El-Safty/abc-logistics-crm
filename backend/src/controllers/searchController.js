const { query } = require('../config/db');

exports.search = async (req, res, next) => {
  try {
    const q = (req.query.q || '').trim();
    if (q.length < 2) return res.json({ data: { clients: [], leads: [], quotations: [] } });

    const like = `%${q}%`;
    const isRep = req.user.role_name === 'Sales Rep';

    const [clients, leads, quotations] = await Promise.all([
      query(
        `SELECT id, company_name AS name, industry, country, 'client' AS type
         FROM clients
         WHERE deleted_at IS NULL
           AND (company_name ILIKE $1 OR country ILIKE $1)
           ${isRep ? `AND (assigned_to = '${req.user.id}' OR created_by = '${req.user.id}')` : ''}
         LIMIT 6`,
        [like]
      ),
      query(
        `SELECT id, COALESCE(company_name, contact_name) AS name, stage, shipment_type, 'lead' AS type
         FROM leads
         WHERE deleted_at IS NULL
           AND (contact_name ILIKE $1 OR company_name ILIKE $1 OR email ILIKE $1 OR phone ILIKE $1)
           ${isRep ? `AND (assigned_to = '${req.user.id}' OR created_by = '${req.user.id}')` : ''}
         LIMIT 6`,
        [like]
      ),
      query(
        `SELECT q.id, q.reference_no AS name, q.service_type, q.status, 'quotation' AS type,
                c.company_name AS client_name
         FROM quotations q
         LEFT JOIN clients c ON q.client_id = c.id
         WHERE q.deleted_at IS NULL
           AND (q.reference_no ILIKE $1 OR q.origin ILIKE $1 OR q.destination ILIKE $1
                OR c.company_name ILIKE $1)
         LIMIT 6`,
        [like]
      ),
    ]);

    res.json({
      data: {
        clients: clients.rows,
        leads: leads.rows,
        quotations: quotations.rows,
      }
    });
  } catch (err) { next(err); }
};
