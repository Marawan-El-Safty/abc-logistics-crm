const { Pool } = require('pg');

const POOL_MAX = parseInt(process.env.DB_POOL_MAX) || 8;

const pool = new Pool(
  process.env.DATABASE_URL
    ? {
        connectionString: process.env.DATABASE_URL,
        max: POOL_MAX,
        idleTimeoutMillis: 20000,
        connectionTimeoutMillis: 3000,
      }
    : {
        host: process.env.DB_HOST || 'localhost',
        port: parseInt(process.env.DB_PORT) || 5432,
        database: process.env.DB_NAME || 'saftygroup_crm',
        user: process.env.DB_USER || 'postgres',
        password: process.env.DB_PASSWORD,
        max: POOL_MAX,
        idleTimeoutMillis: 20000,
        connectionTimeoutMillis: 3000,
      }
);

pool.on('error', (err) => {
  console.error('Unexpected PostgreSQL pool error', err);
});

const query = (text, params) => pool.query(text, params);

const getClient = () => pool.connect();

const withTransaction = async (fn) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
};

// CRIT-1: Improved tenantQuery — strips SQL comments before checking for
// tenant_id so the check cannot be fooled by a tenant_id in a comment or
// string literal. Also requires tenantId to be non-null.
const tenantQuery = (tenantId, sql, params) => {
  if (!tenantId) throw new Error('tenantQuery: tenantId required');
  // Strip single-line (--) and block (/* */) comments before checking
  const normalized = sql
    .replace(/--[^\n]*/g, '')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .toLowerCase();
  if (!normalized.includes('tenant_id')) {
    throw new Error('tenantQuery: sql missing tenant_id filter');
  }
  return pool.query(sql, params);
};

module.exports = { query, getClient, withTransaction, pool, tenantQuery };
