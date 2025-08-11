const jwt = require('jsonwebtoken');

const requireAuth = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  console.log('🔐 Auth header:', authHeader);  // Debug log

  const token = authHeader && authHeader.split(' ')[1];
  if (!token) {
    console.warn('🚫 No token provided in authorization header');
    return res.status(401).json({ error: 'No token provided' });
  }

  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) {
      console.warn('🚫 JWT verification failed:', err.message);
      return res.status(403).json({ error: 'Invalid token' });
    }
    req.user = user;
    console.log('✅ Token verified for user:', user);
    next();
  });
};

module.exports = requireAuth;
