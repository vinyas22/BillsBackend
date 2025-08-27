const pool = require('../db');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const sendMail = require('../toolbox/mailBuddy');

/** ----------- Registration & Email Verification ----------- **/

const register = async (req, res) => {
  const { name, email, password } = req.body;
  try {
    const hashed = await bcrypt.hash(password, 10);
    // Generate email verification token (1-day expiry)
    const token = jwt.sign({ email }, process.env.JWT_SECRET, { expiresIn: '1d' });

    await pool.query(
      `INSERT INTO users (name, email, password, verification_token)
        VALUES ($1, $2, $3, $4)`,
      [name, email, hashed, token]
    );

    const verifyUrl = `https://billsbackend-7n2f.onrender.com/api/auth/verify?token=${token}`;
    const html = `
      <h2>Hi ${name},</h2>
      <p>Thank you for signing up for the Work Billing System.</p>
      <p>Please click the link below to verify your email:</p>
      <a href="${verifyUrl}">Verify My Email</a>
    `;
    await sendMail(email, 'Verify your email ✔', html);
    res.status(201).json({ message: 'Verification email sent. Please check your inbox.' });
  } catch (err) {
    console.error('Registration error:', err);
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
      "UPDATE users SET is_verified=true, verification_token=null WHERE email = $1",
      [email]
    );
    const html = `
      <h1>Welcome to Work Billing System 🎉</h1>
      <p>Your account has been verified. You can now start using the app!</p>
    `;
    await sendMail(email, 'Welcome 🎉', html);
    res.send("✅ Email verified. You may now log in.");
  } catch (err) {
    console.error('Verification error:', err);
    res.status(400).send("❌ Verification link expired or invalid.");
  }
};

const resendVerification = async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: 'Email required.' });

  const userRes = await pool.query("SELECT * FROM users WHERE email=$1", [email]);
  if (userRes.rows.length === 0) return res.status(400).json({ error: 'Not registered.' });

  const user = userRes.rows[0];
  if (user.is_verified) return res.status(400).json({ error: 'Already verified.' });

  let token = user.verification_token;
  if (!token) {
    token = jwt.sign({ email }, process.env.JWT_SECRET, { expiresIn: '1d' });
    await pool.query("UPDATE users SET verification_token=$1 WHERE email=$2", [token, email]);
  }
  const verifyUrl = `https://billsbackend-7n2f.onrender.com/api/auth/verify?token=${token}`;
  const html = `
    <h2>Hi ${user.name},</h2>
    <p>Please click to verify your Work Billing account:</p>
    <a href="${verifyUrl}">Verify Email</a>
  `;
  await sendMail(email, 'Resend: Verify your email ✔', html);
  res.json({ message: 'Verification email sent.' });
};

/** ----------- Login/JWT/Logout ----------- **/

const login = async (req, res) => {
  const { identifier, password } = req.body;
  try {
    // Login using email OR username
    const result = await pool.query(
      "SELECT * FROM users WHERE email = $1 OR name = $1",
      [identifier]
    );
    if (result.rows.length === 0) return res.status(400).json({ error: 'Invalid credentials' });

    const user = result.rows[0];
    if (!user.is_verified) return res.status(400).json({ error: 'Please verify your email before logging in.' });

    const match = await bcrypt.compare(password, user.password);
    if (!match) return res.status(400).json({ error: 'Invalid credentials' });

    // Generate JWT
    const token = jwt.sign({ userId: user.id, email: user.email }, process.env.JWT_SECRET, { expiresIn: '30d' });
    await pool.query(
      "INSERT INTO login_sessions (user_id, ip_address, user_agent) VALUES ($1, $2, $3)",
      [user.id, req.ip, req.headers['user-agent']]
    );

    res.json({ token, user: { id: user.id, name: user.name, email: user.email } });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Login failed', details: err.message });
  }
};

const logout = async (req, res) => {
  res.json({ message: 'Logged out' });
};

const refreshToken = async (req, res) => {
  const { oldToken } = req.body;
  try {
    if (!oldToken) return res.status(400).json({ error: 'No token provided' });
    const decoded = jwt.verify(oldToken, process.env.JWT_SECRET, { ignoreExpiration: true });
    const newToken = jwt.sign(
      { userId: decoded.userId, email: decoded.email },
      process.env.JWT_SECRET,
      { expiresIn: '30d' }
    );
    res.json({ token: newToken });
  } catch (err) {
    res.status(401).json({ error: 'Invalid token' });
  }
};

/** ----------- Forgot Password by OTP (email OR username) ----------- **/

// Step 1: Request OTP
const requestPasswordOtp = async (req, res) => {
  const { identifier } = req.body; // can be email or username ('name')
  if (!identifier) return res.status(400).json({ error: 'Email or username required.' });

  // Lookup user by email OR username ('name')
  const userRes = await pool.query(
    'SELECT * FROM users WHERE email = $1 OR name = $1',
    [identifier]
  );
  // Always respond generic to avoid info leakage
  if (userRes.rows.length === 0) return res.json({ message: 'If registered, you will get an OTP.' });

  const user = userRes.rows[0];
  const email = user.email;

  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  const expires = new Date(Date.now() + 10 * 60000);

  await pool.query(
    'UPDATE users SET reset_otp = $1, reset_otp_expires = $2 WHERE id = $3',
    [otp, expires, user.id]
  );
  const html = `
    <h2>Password Reset Request</h2>
    <p>Your OTP code is: <b style="font-size:1.5em">${otp}</b></p>
    <p>This OTP is valid for 10 minutes.</p>
    <p>If you did not request this, you can ignore this email.</p>
  `;
  await sendMail(email, 'Your Password Reset OTP', html);

  res.json({ message: 'If registered, you will get an OTP.' });
};

// Step 2: Verify OTP and issue short-lived reset token
const verifyResetOtp = async (req, res) => {
  const { identifier, otp } = req.body;
  if (!identifier || !otp) return res.status(400).json({ error: 'Identifier and OTP required.' });

  const userRes = await pool.query('SELECT * FROM users WHERE email = $1 OR name = $1', [identifier]);
  if (userRes.rows.length === 0) return res.status(400).json({ error: 'Invalid or expired OTP.' });

  const user = userRes.rows[0];
  if (
    !user.reset_otp ||
    user.reset_otp !== otp ||
    !user.reset_otp_expires ||
    new Date() > user.reset_otp_expires
  ) {
    return res.status(400).json({ error: 'Invalid or expired OTP.' });
  }

  // Invalidate OTP, generate reset token for 15min use
  const resetToken = crypto.randomBytes(32).toString('hex');
  const resetExpires = new Date(Date.now() + 15 * 60000);

  await pool.query(
    'UPDATE users SET reset_otp=NULL, reset_otp_expires=NULL, reset_token=$1, reset_token_expires=$2 WHERE id = $3',
    [resetToken, resetExpires, user.id]
  );

  res.json({ resetToken });
};

// Step 3: Reset password using issued reset token
const resetPassword = async (req, res) => {
  const { identifier, resetToken, newPassword } = req.body;
  if (!identifier || !resetToken || !newPassword)
    return res.status(400).json({ error: 'All fields required.' });

  const userRes = await pool.query('SELECT * FROM users WHERE email = $1 OR name = $1', [identifier]);
  if (userRes.rows.length === 0) return res.status(400).json({ error: 'Invalid or expired token.' });

  const user = userRes.rows[0];
  if (
    !user.reset_token ||
    user.reset_token !== resetToken ||
    !user.reset_token_expires ||
    new Date() > user.reset_token_expires
  ) {
    return res.status(400).json({ error: 'Invalid or expired reset token.' });
  }

  const hashed = await bcrypt.hash(newPassword, 10);
  await pool.query(
    'UPDATE users SET password = $1, reset_token = NULL, reset_token_expires = NULL WHERE id = $2',
    [hashed, user.id]
  );

  try {
    await sendMail(
      user.email,
      'Your password was changed',
      '<p>Your password has just been updated. If this was not you, contact support immediately.</p>'
    );
  } catch (_) {}

  res.json({ message: 'Password reset successful. You can now log in.' });
};

module.exports = {
  register,
  login,
  verifyEmail,
  resendVerification,
  logout,
  refreshToken,
  requestPasswordOtp,
  verifyResetOtp,
  resetPassword
};
