const pool = require('../db');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const sendMail = require('../toolbox/mailBuddy');

const register = async (req, res) => {
  const { name, email, password } = req.body;

  try {
    const hashed = await bcrypt.hash(password, 10);

    const token = jwt.sign({ email }, process.env.JWT_SECRET, { expiresIn: '1d' });

    const result = await pool.query(
      `INSERT INTO users (name, email, password, verification_token)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [name, email, hashed, token]
    );

    // Send verification email
    const verifyUrl = `http://localhost:5001/api/auth/verify?token=${token}`;
    const html = `
      <h2>Hi ${name},</h2>
      <p>Thank you for signing up for the Work Billing System.</p>
      <p>Please click the link below to verify your email:</p>
      <a href="${verifyUrl}">Verify My Email</a>
    `;

    await sendMail(email, 'Verify your email ✔', html);

    res.status(201).json({ message: 'Verification email sent. Please check your inbox.' });
  } catch (err) {
    res.status(500).json({ error: 'Registration failed', details: err.message });
  }
};

const verifyEmail = async (req, res) => {
  const { token } = req.query;

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const email = decoded.email;

    const user = await pool.query("SELECT * FROM users WHERE email = $1", [email]);
    if (user.rows.length === 0) return res.status(400).send("Invalid token");

    await pool.query(
      "UPDATE users SET is_verified = true, verification_token = null WHERE email = $1",
      [email]
    );

    // Send welcome mail
    const html = `
      <h1>Welcome to Work Billing System 🎉</h1>
      <p>Your account has been verified. You can now start using the app!</p>
    `;
    await sendMail(email, 'Welcome 🎉', html);

    res.send("✅ Email verified. You may now log in.");
  } catch (err) {
    res.status(400).send("❌ Verification link expired or invalid.");
  }
};


const login = async (req, res) => {
  const { identifier, password } = req.body;
  try {
    const result = await pool.query(
      "SELECT * FROM users WHERE email = $1 OR name = $1",
      [identifier]
    );

    if (result.rows.length === 0) return res.status(400).json({ error: 'Invalid credentials' });

    const user = result.rows[0];
    const match = await bcrypt.compare(password, user.password);
    if (!match) return res.status(400).json({ error: 'Invalid credentials' });

    const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET, { expiresIn: '1d' });

    await pool.query(
      "INSERT INTO login_sessions (user_id, ip_address, user_agent) VALUES ($1, $2, $3)",
      [user.id, req.ip, req.headers['user-agent']]
    );

    res.json({ token, user: { id: user.id, name: user.name, email: user.email } });
  } catch (err) {
    res.status(500).json({ error: 'Login failed', details: err.message });
  }
};


module.exports = { register, login, verifyEmail };
