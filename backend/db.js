const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

// Run connection test immediately
(async () => {
  try {
    const client = await pool.connect();
    console.log('✅ DB connected successfully!');
    client.release();
  } catch (err) {
    console.error('❌ DB connection error:', err.message);
  }
})();

module.exports = {
  query: (text, params) => pool.query(text, params),
  pool
};
