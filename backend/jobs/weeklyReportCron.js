const cron = require('node-cron');
const generateWeeklyReports = require('./generateWeeklyReports');
const generateMonthlyReports = require('./generateMonthlyReports');
const generateQuarterlyReports = require('./generateQuarterlyReports');
const generateYearlyReports = require('./generateYearlyReports');
const sendDailyReminders = require('./dailyReminder');

// Daily reminder → 1st of every month at 9:00 AM IST → 3:30 AM UTC
cron.schedule('30 3 1 * *', async () => {
  console.log('⏰ Running Monthly Daily Reminder (1st @ 9:00 AM IST)...');
  try {
    await sendDailyReminders();
  } catch (error) {
    console.error('❌ Daily reminder failed:', error);
  }
});

// Weekly reports → Every Monday 9:00 AM IST → 3:30 AM UTC
cron.schedule('30 3 * * 1', async () => {
  console.log('🔄 Running Weekly Report (9:00 AM IST)...');
  try {
    await generateWeeklyReports();
  } catch (error) {
    console.error('❌ Weekly report cron failed:', error);
  }
});

// Monthly reports → 1st of month 10:00 AM IST → 4:30 AM UTC
cron.schedule('30 4 1 * *', async () => {
  console.log('🔄 Running Monthly Report (1st @ 10:00 AM IST)...');
  try {
    await generateMonthlyReports();
  } catch (error) {
    console.error('❌ Monthly report cron failed:', error);
  }
});

// Quarterly reports → 1st Jan/Apr/Jul/Oct at 11:00 AM IST → 5:30 AM UTC
cron.schedule('30 5 1 1,4,7,10 *', async () => {
  console.log('🔄 Running Quarterly Report (1st @ 11:00 AM IST)...');
  try {
    await generateQuarterlyReports();
  } catch (error) {
    console.error('❌ Quarterly report cron failed:', error);
  }
});

// Yearly reports → 1st Jan at 12:00 PM IST → 6:30 AM UTC
cron.schedule('30 6 1 1 *', async () => {
  console.log('🔄 Running Yearly Report (1st Jan @ 12:00 PM IST)...');
  try {
    await generateYearlyReports();
  } catch (error) {
    console.error('❌ Yearly report cron failed:', error);
  }
});

console.log('📅 All cron jobs scheduled successfully (IST adjusted)');
