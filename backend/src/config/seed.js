require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });
const fs = require('fs');
const path = require('path');
const { pool } = require('./db');

async function seed() {
  const seedPath = path.join(__dirname, '../../../database/seed.sql');
  const sql = fs.readFileSync(seedPath, 'utf8');
  try {
    await pool.query(sql);
    console.log('Seed completed successfully');
  } catch (err) {
    console.error('Seed failed:', err.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

seed();
