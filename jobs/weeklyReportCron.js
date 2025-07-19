const cron = require('node-cron');
const generateWeeklyReports = require('./generateWeeklyReports');
const generateMonthlyReports = require('./generateMonthlyReports');

// Weekly reports every Monday at 9 AM
cron.schedule('0 9 * * 1', async () => {
  console.log('🔄 Running Weekly Report Cron Job...');
  try {
    await generateWeeklyReports();
  } catch (error) {
    console.error('❌ Weekly report cron failed:', error);
  }
});

// Monthly reports on 2nd day of each month at 10 AM
cron.schedule('0 10 2 * *', async () => {
  console.log('🔄 Running Monthly Report Cron Job...');
  try {
    await generateMonthlyReports();
  } catch (error) {
    console.error('❌ Monthly report cron failed:', error);
  }
});

console.log('📅 Cron jobs scheduled successfully');
