const { query } = require('../config/db');

const audit = (action, entityType, getEntityId = null) => async (req, res, next) => {
  const originalJson = res.json.bind(res);
  res.json = async function (data) {
    try {
      const entityId = getEntityId
        ? getEntityId(req, data)
        : (data?.data?.id || req.params?.id || null);
      await query(
        `INSERT INTO audit_log (user_id, action, entity_type, entity_id, new_values, ip_address, user_agent)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [
          req.user?.id || null,
          action,
          entityType,
          entityId,
          JSON.stringify(data),
          req.ip,
          req.headers['user-agent'] || null,
        ]
      );
    } catch (e) {
      // audit failure should not break the response
      console.error('Audit log error:', e.message);
    }
    return originalJson(data);
  };
  next();
};

module.exports = { audit };
