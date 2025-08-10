require('dotenv').config();
const { Client } = require('pg');

(async () => {
  try {
    const client = new Client({
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false }, // optional, for local skipping cert issues
    });
    await client.connect();
    console.log('✅ Connected successfully via IPv4!');
    await client.end();
  } catch (err) {
    console.error('❌ Connection error:', err);
  }
})();
