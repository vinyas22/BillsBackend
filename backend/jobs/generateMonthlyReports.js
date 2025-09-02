// generateMonthlyReports.js
const db = require('../db');
const { format, subMonths, startOfMonth } = require('date-fns');
const ReportService = require('../services/ReportService');
const NotificationService = require('../services/notificationService');
const monthlySummaryTemplate = require('../toolbox/monthlySummaryTemplate');
const { sendMonthlyReportEmail } = require('../toolbox/emailService');
const generateSpendingInsights = require('../services/generateSpendingInsights');

async function generateMonthlyReports() {
  console.log('📊 Running Monthly Report Cron...');

  const users = await db.query('SELECT id, email, name FROM users');
  const currentDate = new Date();
  const lastMonth = subMonths(currentDate, 1);
  const dateParam = format(startOfMonth(lastMonth), 'yyyy-MM-dd');

  for (const user of users.rows) {
    try {
      const report = await ReportService.generateMonthlyReport(user.id, dateParam);
      const fallbackStart = startOfMonth(lastMonth);
const fallbackEnd = endOfMonth(lastMonth);

if (!report.month) {
  report.month = {};
}
if (!report.month.monthStart) {
  report.month.monthStart = fallbackStart;
}
if (!report.month.monthEnd) {
  report.month.monthEnd = fallbackEnd;
}
if (!report.month.label) {
  report.month.label = format(fallbackStart, 'MMMM yyyy');
} 
      // Build email content
      const html = monthlySummaryTemplate({
        userName: user.name,
        monthStart: report.month.monthStart,
        monthEnd: report.month.monthEnd,
        totalExpense: report.totalExpense,
        categoryData: report.category.reduce((acc, cur) => {
          acc[cur.category] = cur.amount;
          return acc;
        }, {}),
        dailyData: report.daily.reduce((acc, cur) => {
          acc[cur.date] = cur.total;
          return acc;
        }, {}),
        weeklyTotals: report.daily.reduce((acc, cur) => {
          const week = Math.ceil(new Date(cur.date).getDate() / 7);
          if (!acc[week]) acc[week] = 0;
          acc[week] += cur.total;
          return acc;
        }, {}),
        previousMonthData: {
          totalExpense: report.previousMonth.totalExpense,
          categoryData: report.previousMonth.category.reduce((acc, cur) => {
            acc[cur.category] = cur.amount;
            return acc;
          }, {})
        },
        analytics: {
          averageDaily:
            report.daily.length > 0
              ? Math.round(report.totalExpense / report.daily.length)
              : 0,
          maxDailySpend: Math.max(...report.daily.map(d => d.total), 0),
          daysWithExpenses: report.daily.length,
          spendingConsistency:
            report.daily.length >= 25 ? 'Consistent' : 'Irregular'
        },
insights: generateSpendingInsights(report, 'monthly')
      });

      // Send email
      await sendMonthlyReportEmail(
        user.email,
        `📊 Monthly Financial Summary - ${report.month.label}`,
        html
      );

      // Send notification
      await NotificationService.createReportNotification(user.id, 'monthly', {
        period: report.month.label,
        totalExpense: report.totalExpense,
        savings: report.savings,
        savingsRate: report.savingsRate,
        category: report.category
      });

      console.log(`✅ Monthly report sent to ${user.email}`);
    } catch (err) {
      console.error(`❌ Error generating monthly report for ${user.email}`, err);
    }
  }
}

module.exports = generateMonthlyReports;
