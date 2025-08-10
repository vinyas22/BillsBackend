const express = require('express');
const router = express.Router();
const requireAuth = require('../middleware/requireAuth');

// Import controller functions
const {
  getWeeklyByMonthReport,
  getMonthlyReport,
  getQuarterlyReport,
  getYearlyReport,
  getAvailableQuarters,
  getAvailableYears,
  getAvailableMonths,
  getAvailableWeeks,
  getWeeklyData,
  getMonthlyData,
  getQuarterlyData,
  getYearlyData
} = require('../controllers/reportController');

// Apply authentication to all routes
router.use(requireAuth);

// ===== CLEAN ROUTES - NO BUSINESS LOGIC =====

// Weekly endpoints
router.get('/weekly/available-periods', getAvailableWeeks);
router.get('/weekly/data/:weekValue', getWeeklyData);

// Monthly endpoints  
router.get('/monthly/available-months', getAvailableMonths);
router.get('/monthly', getMonthlyReport);
router.get('/monthly/data/:monthValue', getMonthlyData);

// Quarterly endpoints
router.get('/quarterly', getQuarterlyReport);
router.get('/quarterly/data/:quarterValue', getQuarterlyData);
router.get('/quarters/available', getAvailableQuarters);

// Yearly endpoints
router.get('/yearly', getYearlyReport);
router.get('/yearly/data/:yearValue', getYearlyData);
router.get('/years/available', getAvailableYears);

// Legacy endpoint
router.get('/report/weekly-by-month/:billId/:date', getWeeklyByMonthReport);

// Health check endpoint
router.get('/health', (req, res) => {
  res.json({
    success: true,
    message: 'Report service is healthy',
    timestamp: new Date().toISOString(),
    endpoints: {
      weekly: {
        available: '/api/reports/weekly/available-periods',
        data: '/api/reports/weekly/data/:weekValue'
      },
      monthly: {
        available: '/api/reports/monthly/available-months',
        legacy: '/api/reports/monthly?date=YYYY-MM-DD',
        data: '/api/reports/monthly/data/:monthValue'
      },
      quarterly: {
        available: '/api/reports/quarters/available',
        legacy: '/api/reports/quarterly?date=YYYY-MM-DD',
        data: '/api/reports/quarterly/data/:quarterValue'
      },
      yearly: {
        available: '/api/reports/years/available',
        legacy: '/api/reports/yearly?date=YYYY-MM-DD',
        data: '/api/reports/yearly/data/:yearValue'
      }
    }
  });
});

module.exports = router;
