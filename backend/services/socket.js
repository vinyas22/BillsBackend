// socket.js
const socketIO = require('socket.io');
const jwt = require('jsonwebtoken');

let io;

function initializeSocket(server) {
  io = socketIO(server, {
    cors: {
      origin: process.env.FRONTEND_URL || "http://localhost:4200",
      methods: ["GET", "POST"],
      credentials: true
    }
  });

  // Authentication middleware with detailed logging
  io.use((socket, next) => {
    const token = socket.handshake.auth.token;
    console.log('📱 Socket auth attempt - Token received:', token ? 'Yes' : 'No');

    if (!token) {
      console.error('📱 Socket auth error: No token provided');
      return next(new Error('No token provided'));
    }

    try {
      console.log('📱 Verifying Socket JWT with secret:', process.env.JWT_SECRET ? 'Secret found' : 'No secret!');
      
      if (!process.env.JWT_SECRET) {
        throw new Error('JWT_SECRET not set in environment');
      }

      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      socket.userId = decoded.userId;
      socket.join(`user_${decoded.userId}`);
      console.log(`📱 Socket authenticated - User ID: ${decoded.userId}`);
      next();
    } catch (err) {
      console.error('📱 Socket auth failed:', err.message);
      if (err.name === 'TokenExpiredError') {
        console.error('📱 Token expired at:', err.expiredAt);
      }
      next(new Error('Authentication error'));
    }
  });

  io.on('connection', (socket) => {
    console.log(`📱 Socket connected: ${socket.id} - User: ${socket.userId}`);

    socket.on('disconnect', (reason) => {
      console.log(`📱 Socket disconnected: ${socket.id} - Reason: ${reason}`);
    });

    // Example event - you can add more
    socket.on('test-event', (data) => {
      console.log(`Test event received from user ${socket.userId}:`, data);
    });
  });

  return io;
}

module.exports = { initializeSocket };
