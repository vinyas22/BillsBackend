const express = require('express');
const router = express.Router();
const generateWeeklyReports = require('../../jobs/generateWeeklyReports');
const generateMonthlyReports = require('../../jobs/generateMonthlyReports');

// Dev/debug route to manually trigger the weekly report cron logic
router.get('/run-weekly-cron-now', async (req, res) => {
  console.log('🚀 Weekly cron test route triggered');
  try {
    await generateWeeklyReports(); // Real logic lives here
    res.send('✅ Weekly report cron ran successfully');
  } catch (err) {
    console.error('❌ Error during weekly cron:', err);
    res.status(500).send('❌ Weekly cron failed');
  }
});

// Dev/debug route to manually trigger the monthly report cron logic
router.get('/run-monthly-cron-now', async (req, res) => {
  console.log('🚀 Monthly cron test route triggered');
  try {
    await generateMonthlyReports(); // Real logic lives here
    res.send('✅ Monthly report cron ran successfully');
  } catch (err) {
    console.error('❌ Error during monthly cron:', err);
    res.status(500).send('❌ Monthly cron failed');
  }
});

module.exports = router;
