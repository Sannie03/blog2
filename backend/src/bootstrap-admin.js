const dotenv = require('dotenv');
const { Pool } = require('pg');

dotenv.config({ path: require('path').join(__dirname, '..', '.env'), quiet: true });
const { describeDatabaseError } = require('./utils/database-error');
const { hashPassword } = require('./auth');

const account = {
  name: String(process.env.SUPERADMIN_NAME || '').trim(),
  username: String(process.env.SUPERADMIN_USERNAME || '').trim(),
  email: String(process.env.SUPERADMIN_EMAIL || '').trim().toLowerCase(),
  password: String(process.env.SUPERADMIN_PASSWORD || ''),
};

if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL must be configured.');
if (!account.name || !account.username || !account.email || account.password.length < 12) {
  throw new Error('Configure SUPERADMIN_NAME, SUPERADMIN_USERNAME, SUPERADMIN_EMAIL and a password of at least 12 characters.');
}

const pool = new Pool({ connectionString: process.env.DATABASE_URL, connectionTimeoutMillis: 5000 });

async function run() {
  try {
    const matches = await pool.query(
      'SELECT id FROM users WHERE username = $1 OR email = $2',
      [account.username, account.email]
    );
    if (matches.rows.length > 1) {
      throw new Error('The configured username and email belong to different accounts.');
    }

    const passwordHash = hashPassword(account.password);
    if (matches.rows.length === 1) {
      await pool.query(
        `UPDATE users
         SET name = $1, username = $2, email = $3, password = $4, role = 'superadmin', adsense_access = TRUE
         WHERE id = $5`,
        [account.name, account.username, account.email, passwordHash, matches.rows[0].id]
      );
    } else {
      await pool.query(
        `INSERT INTO users (name, username, email, password, role, adsense_access)
         VALUES ($1, $2, $3, $4, 'superadmin', TRUE)`,
        [account.name, account.username, account.email, passwordHash]
      );
    }
    console.log(`Super Admin account is ready: ${account.username}`);
  } finally {
    await pool.end();
  }
}

run().catch((error) => {
  console.error('Unable to bootstrap Super Admin:', describeDatabaseError(error));
  process.exitCode = 1;
});
