const { query } = require('../config/db');

exports.getPlan = async (req, res, next) => {
  try {
    const tenant = req.tenant;
    if (!tenant) return res.status(400).json({ error: 'No tenant context' });

    const planRes = await query('SELECT * FROM plans WHERE id = $1', [tenant.plan]);
    const plan = planRes.rows[0] || {};

    // Live usage counts
    const [shipmentCount, clientCount, seatCount] = await Promise.all([
      query(
        `SELECT COUNT(*) FROM shipments WHERE tenant_id=$1 AND created_at >= date_trunc('month', NOW() AT TIME ZONE 'UTC') AND deleted_at IS NULL`,
        [tenant.id]
      ),
      query(`SELECT COUNT(*) FROM clients WHERE tenant_id=$1 AND deleted_at IS NULL`, [tenant.id]),
      query(
        `SELECT COUNT(*) FROM users WHERE tenant_id=$1 AND deleted_at IS NULL AND user_status IN ('active','pending')`,
        [tenant.id]
      ),
    ]);

    res.json({
      tenant: {
        id: tenant.id,
        companyName: tenant.company_name,
        slug: tenant.slug,
        plan: tenant.plan,
        status: tenant.status,
        seatLimit: tenant.seat_limit,
        trialEndsAt: tenant.trial_ends_at,
        validUntil: tenant.valid_until,
        createdAt: tenant.created_at,
      },
      planName: plan.name,
      seatPrice: plan.seat_price,
      features: plan.features || {},
      limits: plan.limits || {},
      usage: {
        shipments_per_month: parseInt(shipmentCount.rows[0].count),
        clients: parseInt(clientCount.rows[0].count),
        seats: parseInt(seatCount.rows[0].count),
      },
    });
  } catch (err) {
    next(err);
  }
};
