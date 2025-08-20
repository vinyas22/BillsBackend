const express = require('express');
const cors = require('cors');
const http = require('http');
require('dotenv').config();

// Import Socket.IO setup
const { initializeSocket } = require('./services/socket');

// Import routes
const testRoutes = require('./routes/testRoutes');
const authRoutes = require('./routes/authRoutes');
const billRoutes = require('./routes/billRoutes');
const entryRoutes = require('./routes/entryRoutes');
const reportRoutes = require('./routes/reportRoutes');
const dashboardRoutes = require('./routes/dashboardRoutes');
const notificationRoutes = require('./routes/notificationRoutes');

const app = express();
const server = http.createServer(app);
const PORT = process.env.PORT || 5001;

// Initialize Socket.IO
const io = initializeSocket(server);
app.set('io', io);

// Middleware
app.use(cors({
  origin: [
    'http://localhost:4200', 
    'https://frntend-l8xe.onrender.com', // frontend origin without path
    process.env.FRONTEND_URL  // optional, if set
  ].filter(Boolean),
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
}));



app.use(express.json());

// Test routes (no auth)
app.use('/api/test', testRoutes);

// Individual test report endpoints
app.get('/api/test/weekly', async (req, res) => {
  try {
    const generateWeeklyReports = require('./jobs/generateWeeklyReports');
    await generateWeeklyReports();
    res.json({ 
      message: '📅 Weekly reports generated successfully',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error running weekly reports:', error);
    res.status(500).json({ error: 'Failed to generate weekly reports' });
  }
});

app.get('/api/test/monthly', async (req, res) => {
  try {
    const generateMonthlyReports = require('./jobs/generateMonthlyReports');
    await generateMonthlyReports();
    res.json({ 
      message: '📊 Monthly reports generated successfully',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error running monthly reports:', error);
    res.status(500).json({ error: 'Failed to generate monthly reports' });
  }
});

app.get('/api/test/quarterly', async (req, res) => {
  try {
    const generateQuarterlyReports = require('./jobs/generateQuarterlyReports');
    await generateQuarterlyReports();
    res.json({ 
      message: '📈 Quarterly reports generated successfully',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error running quarterly reports:', error);
    res.status(500).json({ error: 'Failed to generate quarterly reports' });
  }
});

app.get('/api/test/yearly', async (req, res) => {
  try { 
    const generateYearlyReports = require('./jobs/generateYearlyReports');
    await generateYearlyReports();
    res.json({ 
      message: '🗓️ Yearly reports generated successfully',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error running yearly reports:', error);
    res.status(500).json({ error: 'Failed to generate yearly reports' });
  }
});

// Protected routes
app.use('/api/auth', authRoutes);
app.use('/api/bills', billRoutes);
app.use('/api/entries', entryRoutes);
app.use('/api/reports', reportRoutes);

// 📊 Dashboard routes
app.use('/api/dashboard', dashboardRoutes);

// 🆕 ADD THIS LINE - Mount quarterly-reports separately to match frontend calls
app.use('/api/quarterly-reports', reportRoutes);

// Notification routes
app.use('/api/notifications', notificationRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'healthy',
    socketConnections: io.engine.clientsCount,
    timestamp: new Date().toISOString(),
    availableEndpoints: {
      reports: '/api/reports/*',
      quarterlyReports: '/api/quarterly-reports/*',
      dashboard: '/api/dashboard/*',
      notifications: '/api/notifications/*',
      auth: '/api/auth/*'
    }
  });
});

// Root endpoint
app.get('/', (req, res) => {
  res.json({ 
    message: '📱 Work Billing API Running',
    version: '2.0.0',
    timestamp: new Date().toISOString(),
    endpoints: {
      auth: '/api/auth',
      reports: '/api/reports',
      quarterlyReports: '/api/quarterly-reports',
      dashboard: '/api/dashboard',
      notifications: '/api/notifications',
      test: '/api/test'
    }
  });
});

// Error handling
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ 
    error: 'Something broke!',
    timestamp: new Date().toISOString()
  });
});

// Scheduled jobs
console.log('📅 Initializing scheduled cron jobs...');
require('./jobs/weeklyReportCron');
require('./jobs/dailyReminder');

try {
  require('./jobs/weeklyReportCron');
} catch (error) {
  console.warn('⚠️ Cron scheduler not available:', error.message);
}

// Start server
server.listen(PORT, () => {
  console.log(`📱 Server running on port ${PORT}`);
  console.log(`   🔗 API URL: http://localhost:${PORT}`);
  console.log(`   📊 Reports API: /api/reports/*`);
  console.log(`   📈 Quarterly Reports API: /api/quarterly-reports/*`);
  console.log(`   📊 Dashboard API: /api/dashboard/*`);
  console.log(`   📋 Notifications API: /api/notifications/*`);
  console.log(`   ⚡ Health Check: /api/health`);
  console.log(`   🌐 WebSocket URL: ws://localhost:${PORT}`);
});

module.exports = { app, server };
