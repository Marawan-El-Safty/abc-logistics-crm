const { query } = require('../config/db');

// Default settings — used to fill any keys an admin hasn't customized yet.
const DEFAULTS = {
  company: {
    name: 'ABC Logistics',
    tagline: 'Delivering Your Success',
    address: '6 Abdelfattah Yahia St - Raml Station, Alexandria, Egypt',
    email: 'sales@abclogistics.com  |  pricing@abclogistics.com',
    phone: '+20 111 8 111 463  |  +20 111 74 35 782',
  },
  defaultCurrency: 'USD',
  pdf: {
    primaryColor:   '#1A56A0',   // ABC Logistics blue — used for header accent, totals, highlights
    secondaryColor: '#1A56A0',   // same for footer bar
    footerDisclaimer:
      'THIS STATEMENT IS CONSIDERED APPROVED UNLESS YOUR OBJECTIONS REACH US ' +
      'WITH ONE WEEK AND NOT EXPOSED TO THE  TAX DEDUCT',
    bank: {
      accountName: 'EL ABC Logistics.',
      accountNumber: '1033338610010301',
      currency: 'EUR',
      iban: 'EG550057000201033338610010301',
      bankName: 'ARAB AFRICAN INTERNATIONAL BANK',
      bankAddress: 'HORREYA ROAD BRANCH - ALEXANDRIA - EGYPT',
      swiftCode: 'ARAIEGCX',
    },
  },
  session: {
    warningMinutes: 25,
    timeoutMinutes: 30,
  },
};

// Deep-merge stored data over defaults so missing keys fall back gracefully
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

// Reusable: load effective settings (defaults + stored overrides)
exports.loadSettings = async () => {
  try {
    const res = await query('SELECT data FROM app_settings WHERE id = 1');
    const stored = res.rows[0]?.data || {};
    return mergeDeep(DEFAULTS, stored);
  } catch (_) {
    return DEFAULTS;
  }
};

exports.get = async (req, res, next) => {
  try {
    const settings = await exports.loadSettings();
    res.json({ data: settings });
  } catch (err) { next(err); }
};

exports.update = async (req, res, next) => {
  try {
    const incoming = req.body || {};
    // Merge over current stored data so partial updates are safe
    const current = await query('SELECT data FROM app_settings WHERE id = 1');
    const merged = mergeDeep(current.rows[0]?.data || {}, incoming);
    await query(
      `INSERT INTO app_settings (id, data, updated_at) VALUES (1, $1, NOW())
       ON CONFLICT (id) DO UPDATE SET data = $1, updated_at = NOW()`,
      [merged]
    );
    const settings = await exports.loadSettings();
    res.json({ data: settings });
  } catch (err) { next(err); }
};
