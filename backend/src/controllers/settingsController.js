const { query } = require('../config/db');

const DEFAULTS = {
  company: {
    name: 'FreightOS',
    tagline: 'Freight Management Made Simple',
    address: '',
    email: '',
    phone: '',
  },
  defaultCurrency: 'USD',
  pdf: {
    primaryColor:   '#2563eb',
    secondaryColor: '#2563eb',
    footerDisclaimer:
      'THIS STATEMENT IS CONSIDERED APPROVED UNLESS YOUR OBJECTIONS REACH US WITHIN ONE WEEK.',
    bank: {
      accountName: '',
      accountNumber: '',
      currency: 'USD',
      iban: '',
      bankName: '',
      bankAddress: '',
      swiftCode: '',
    },
  },
  session: {
    warningMinutes: 25,
    timeoutMinutes: 30,
  },
};

function mergeDeep(base, override) {
  const out = Array.isArray(base) ? [...base] : { ...base };
  for (const key of Object.keys(override || {})) {
    const ov = override[key];
    if (ov && typeof ov === 'object' && !Array.isArray(ov) && typeof base?.[key] === 'object') {
      out[key] = mergeDeep(base[key], ov);
    } else if (ov !== undefined && ov !== null) {
      out[key] = ov;
    }
  }
  return out;
}

// Reusable: load effective settings for a given tenant (or global for tenantId=null)
exports.loadSettings = async (tenantId = null) => {
  try {
    let res;
    if (tenantId) {
      res = await query('SELECT data FROM app_settings WHERE tenant_id = $1', [tenantId]);
    } else {
      // Fallback: legacy single-row lookup
      res = await query('SELECT data FROM app_settings WHERE id = 1');
    }
    const stored = res.rows[0]?.data || {};
    return mergeDeep(DEFAULTS, stored);
  } catch (_) {
    return DEFAULTS;
  }
};

exports.get = async (req, res, next) => {
  try {
    const settings = await exports.loadSettings(req.tenantId);
    res.json({ data: settings });
  } catch (err) { next(err); }
};

exports.update = async (req, res, next) => {
  try {
    const incoming = req.body || {};
    const current = await query(
      'SELECT data FROM app_settings WHERE tenant_id = $1',
      [req.tenantId]
    );
    const merged = mergeDeep(current.rows[0]?.data || {}, incoming);
    await query(
      `INSERT INTO app_settings (tenant_id, data, updated_at) VALUES ($1, $2, NOW())
       ON CONFLICT (tenant_id) DO UPDATE SET data = $2, updated_at = NOW()`,
      [req.tenantId, merged]
    );
    const settings = await exports.loadSettings(req.tenantId);
    res.json({ data: settings });
  } catch (err) { next(err); }
};
