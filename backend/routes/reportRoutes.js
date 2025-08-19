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

// ===== WEEKLY ROUTES =====
router.get('/weekly/available-periods', getAvailableWeeks);
router.get('/weekly/data/:weekValue', getWeeklyData);

// ===== MONTHLY ROUTES =====
router.get('/monthly/available-months', getAvailableMonths);
router.get('/monthly', getMonthlyReport); // Query param: ?date=YYYY-MM-DD
router.get('/monthly/data/:monthValue', getMonthlyData);

// ===== QUARTERLY ROUTES =====
router.get('/quarters/available', getAvailableQuarters);
router.get('/quarterly', getQuarterlyReport); // Query param: ?date=YYYY-Q# or YYYY-MM-DD
router.get('/quarterly/data/:quarterValue', getQuarterlyData);

// ===== YEARLY ROUTES =====
router.get('/years/available', getAvailableYears);
router.get('/yearly', getYearlyReport); // Query param: ?date=YYYY or YYYY-MM-DD
router.get('/yearly/data/:yearValue', getYearlyData);

// ===== LEGACY ROUTES =====
router.get('/report/weekly-by-month/:billId/:date', getWeeklyByMonthReport);

// ===== HEALTH CHECK =====
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
        legacy: '/api/reports/quarterly?date=YYYY-Q# or YYYY-MM-DD',
        data: '/api/reports/quarterly/data/:quarterValue'
      },
      yearly: {
        available: '/api/reports/years/available',
        legacy: '/api/reports/yearly?date=YYYY or YYYY-MM-DD',
        data: '/api/reports/yearly/data/:yearValue'
      }
    }
  });
});

module.exports = router;
