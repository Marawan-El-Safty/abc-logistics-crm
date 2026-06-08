const { Pool } = require('pg');

// Railway Hobby allows ~25 total DB connections.
// Reserve 8 for the app pool, leaving headroom for admin queries and SSE connections.
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

// Run fn inside a single transaction. fn receives a dedicated client whose
// .query() must be used for every statement so they share the transaction.
// Commits on success, rolls back on any thrown error, always releases.
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

module.exports = { query, getClient, withTransaction, pool };
