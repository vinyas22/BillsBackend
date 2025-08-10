const errorHandler = (err, req, res, next) => {
  console.error(`❌ ${req.method} ${req.path}:`, err);

  // Database errors
  if (err.code === '23505') {
    return res.status(409).json({
      success: false,
      error: 'Duplicate entry',
      message: 'This record already exists'
    });
  }

  if (err.code === '23503') {
    return res.status(400).json({
      success: false,
      error: 'Invalid reference',
      message: 'Referenced record does not exist'
    });
  }

  if (err.code === '23502') {
    return res.status(400).json({
      success: false,
      error: 'Missing required field',
      message: 'A required field is missing'
    });
  }

  if (err.code === '42703') {
    return res.status(400).json({
      success: false,
      error: 'Invalid column',
      message: 'Referenced column does not exist'
    });
  }

  // Validation errors
  if (err.name === 'ValidationError') {
    return res.status(400).json({
      success: false,
      error: 'Validation failed',
      message: err.message,
      details: err.details
    });
  }

  // Authentication errors
  if (err.name === 'UnauthorizedError' || err.name === 'JsonWebTokenError') {
    return res.status(401).json({
      success: false,
      error: 'Unauthorized',
      message: 'Invalid or expired token'
    });
  }

  if (err.name === 'TokenExpiredError') {
    return res.status(401).json({
      success: false,
      error: 'Token expired',
      message: 'Your session has expired. Please login again.'
    });
  }

  // Cast errors
  if (err.name === 'CastError') {
    return res.status(400).json({
      success: false,
      error: 'Invalid data type',
      message: 'Invalid data format provided'
    });
  }

  // Rate limiting errors
  if (err.status === 429) {
    return res.status(429).json({
      success: false,
      error: 'Too many requests',
      message: 'Rate limit exceeded. Please try again later.'
    });
  }

  // Default server error
  res.status(err.status || 500).json({
    success: false,
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong',
    ...(process.env.NODE_ENV === 'development' && { 
      stack: err.stack,
      details: err 
    })
  });
};

const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

const createError = (status, message, details = null) => {
  const error = new Error(message);
  error.status = status;
  if (details) error.details = details;
  return error;
};

// Input validation helper
const validateRequiredFields = (data, requiredFields) => {
  const missing = requiredFields.filter(field => 
    data[field] === undefined || data[field] === null || data[field] === ''
  );
  
  if (missing.length > 0) {
    throw createError(400, `Missing required fields: ${missing.join(', ')}`, { missing });
  }
};

// Sanitization helper
const sanitizeInput = (input) => {
  if (typeof input === 'string') {
    return input.trim().replace(/[<>]/g, '');
  }
  return input;
};

module.exports = { 
  errorHandler, 
  asyncHandler, 
  createError, 
  validateRequiredFields, 
  sanitizeInput 
};
