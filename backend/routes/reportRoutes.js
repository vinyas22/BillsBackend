const express = require('express');
const router = express.Router();
const requireAuth = require('../middleware/requireAuth');
const {
   getWeeklyByMonthReport,
  getMonthlyReport,
  getQuarterlyReport,
  getYearlyReport, getAvailableQuarters, getAvailableYears
} = require('../controllers/reportController');

router.use(requireAuth);

router.get('/report/weekly-by-month/:billId/:date', requireAuth, getWeeklyByMonthReport);
router.get('/monthly', getMonthlyReport);
router.get('/quarterly', getQuarterlyReport);
router.get('/yearly', getYearlyReport);
router.get('/quarters/available', getAvailableQuarters);
router.get('/years/available', getAvailableYears);

module.exports = router;
