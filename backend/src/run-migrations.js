const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');
const { Pool } = require('pg');

dotenv.config({ path: path.join(__dirname, '..', '.env'), quiet: true });
const { describeDatabaseError } = require('./utils/database-error');

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL must be configured before running migrations.');
}

const pool = new Pool({ connectionString: process.env.DATABASE_URL, connectionTimeoutMillis: 5000 });
const migrationPath = path.join(__dirname, 'migrate.sql');

async function run() {
  try {
    await pool.query(fs.readFileSync(path.join(__dirname, 'init.sql'), 'utf8'));
    await pool.query(fs.readFileSync(migrationPath, 'utf8'));
    console.log('Database migration completed.');
  } finally {
    await pool.end();
  }
}

run().catch((error) => {
  console.error('Database migration failed:', describeDatabaseError(error));
  process.exitCode = 1;
});
