const express = require('express');
const router = express.Router();
const {
  register,
  login,
  verifyEmail,
  resendVerification,
  logout,
  refreshToken,
  requestPasswordOtp,
  verifyResetOtp,
  resetPassword
} = require('../controllers/authController');

// Registration, verification, login
router.post('/register', register);
router.post('/login', login);
router.get('/verify', verifyEmail);
router.post('/resend-verification', resendVerification);

// Token refresh and logout
router.post('/refresh-token', refreshToken);
router.post('/logout', logout); // stateless JWT, does nothing server-side

// Forgot password: request, verify, reset
router.post('/request-password-otp', requestPasswordOtp);
router.post('/verify-reset-otp', verifyResetOtp);
router.post('/reset-password', resetPassword);


module.exports = router;
