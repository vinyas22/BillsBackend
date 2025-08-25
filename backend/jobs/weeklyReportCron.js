const cron = require('node-cron');
const generateWeeklyReports = require('./generateWeeklyReports');
const generateMonthlyReports = require('./generateMonthlyReports');
const generateQuarterlyReports = require('./generateQuarterlyReports');

// Weekly reports every Monday at 9 AM
cron.schedule('0 9 * * 1', async () => {
  console.log('🔄 Running Weekly Report Cron Job...');
    console.log('🔄 Running Weekly Report Cron Job at:', new Date().toString());

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

// Quarterly reports on 5th day of quarter-starting months (Jan, Apr, Jul, Oct) at 11 AM
cron.schedule('0 11 2 1,4,7,10 *', async () => {
  console.log('🔄 Running Quarterly Report Cron Job...');
  try {
    await generateQuarterlyReports();
  } catch (error) {
    console.error('❌ Quarterly report cron failed:', error);
  }
});

console.log('📅 All cron jobs scheduled successfully:');
console.log('   📊 Weekly: Every Monday at 9:00 AM');
console.log('   📈 Monthly: 2nd day of each month at 10:00 AM');
console.log('   📊 Quarterly: 2nd day of Jan/Apr/Jul/Oct at 11:00 AM');
cron.schedule('0 12 10 1 *', async () => {
  console.log('🔄 Running Intelligent Yearly Report Cron Job...');
  try {
    await generateYearlyReports();
  } catch (error) {
    console.error('❌ Yearly report cron failed:', error);
  }
});

console.log('📅 All cron jobs scheduled successfully:');
console.log('   📊 Weekly: Every Monday at 9:00 AM');
console.log('   📈 Monthly: 2nd day of each month at 10:00 AM');
console.log('   📊 Quarterly: 5th day of Jan/Apr/Jul/Oct at 11:00 AM');
console.log('   🗓️ Yearly: January 10th at 12:00 PM (Intelligent Data Selection)');