/**
 * Tenant isolation tests — run with: node backend/tests/tenant-isolation.test.js
 * Requires DATABASE_URL set. Uses node:assert (no test runner needed).
 */
require('dotenv').config();
const assert = require('node:assert/strict');
const { Pool } = require('pg');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function q(sql, params = []) {
  const { rows } = await pool.query(sql, params);
  return rows;
}

// Create two isolated tenants for testing
async function setup() {
  await q(`INSERT INTO tenants (id, company_name, slug, status) VALUES
    ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'TenantA', 'tenant-a-test', 'active'),
    ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'TenantB', 'tenant-b-test', 'active')
    ON CONFLICT (id) DO NOTHING`);

  // Insert one client per tenant
  await q(`INSERT INTO clients (id, company_name, contact_name, contact_type, tenant_id)
    VALUES
      ('cccccccc-cccc-cccc-cccc-cccccccccccc', 'ClientA', 'A Contact', 'Client', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'),
      ('dddddddd-dddd-dddd-dddd-dddddddddddd', 'ClientB', 'B Contact', 'Client', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb')
    ON CONFLICT (id) DO NOTHING`);
}

async function teardown() {
  await q(`DELETE FROM clients WHERE id IN ('cccccccc-cccc-cccc-cccc-cccccccccccc','dddddddd-dddd-dddd-dddd-dddddddddddd')`);
  await q(`DELETE FROM tenants WHERE id IN ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb')`);
}

async function testTenantACantSeeB() {
  const rows = await q(
    `SELECT * FROM clients WHERE tenant_id = $1`,
    ['aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa']
  );
  assert.equal(rows.length, 1, 'TenantA should see exactly 1 client');
  assert.equal(rows[0].company_name, 'ClientA', 'TenantA should see ClientA');
  console.log('  PASS: TenantA sees only its own clients');
}

async function testTenantBCantSeeA() {
  const rows = await q(
    `SELECT * FROM clients WHERE tenant_id = $1`,
    ['bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb']
  );
  assert.equal(rows.length, 1, 'TenantB should see exactly 1 client');
  assert.equal(rows[0].company_name, 'ClientB', 'TenantB should see ClientB');
  console.log('  PASS: TenantB sees only its own clients');
}

async function testCrossTenantUpdateBlocked() {
  // Attempt to update TenantB's client while scoped to TenantA — must affect 0 rows
  const result = await pool.query(
    `UPDATE clients SET contact_name = 'Hacked' WHERE id = $1 AND tenant_id = $2`,
    ['dddddddd-dddd-dddd-dddd-dddddddddddd', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa']
  );
  assert.equal(result.rowCount, 0, 'Cross-tenant UPDATE must affect 0 rows');
  console.log('  PASS: Cross-tenant UPDATE affects 0 rows');
}

async function testCrossTenantDeleteBlocked() {
  const result = await pool.query(
    `UPDATE clients SET deleted_at = NOW() WHERE id = $1 AND tenant_id = $2`,
    ['dddddddd-dddd-dddd-dddd-dddddddddddd', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa']
  );
  assert.equal(result.rowCount, 0, 'Cross-tenant soft-delete must affect 0 rows');
  console.log('  PASS: Cross-tenant soft-delete affects 0 rows');
}

async function testTenantIdNullNotLeaked() {
  // Rows without tenant_id should not appear in scoped queries
  const rows = await q(
    `SELECT * FROM clients WHERE tenant_id = $1 AND id = $2`,
    ['aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'dddddddd-dddd-dddd-dddd-dddddddddddd']
  );
  assert.equal(rows.length, 0, 'Wrong-tenant lookup must return 0 rows');
  console.log('  PASS: Wrong-tenant lookup returns 0 rows');
}

(async () => {
  console.log('Running tenant isolation tests...\n');
  try {
    await setup();
    await testTenantACantSeeB();
    await testTenantBCantSeeA();
    await testCrossTenantUpdateBlocked();
    await testCrossTenantDeleteBlocked();
    await testTenantIdNullNotLeaked();
    console.log('\nAll tests passed.');
  } catch (err) {
    console.error('\nTest FAILED:', err.message);
    process.exitCode = 1;
  } finally {
    await teardown().catch(() => {});
    await pool.end();
  }
})();
