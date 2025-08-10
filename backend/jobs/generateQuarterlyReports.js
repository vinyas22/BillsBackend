const db = require('../db');
const { startOfQuarter, endOfQuarter, format, subQuarters } = require('date-fns');
const quarterlySummaryTemplate = require('../toolbox/quarterlySummaryTemplate');
const { sendQuarterlyReportEmail } = require('../toolbox/emailService');
const NotificationService = require('../services/notificationService');

async function generateQuarterlyReports() {
  console.log('📈 Running Quarterly Report Cron...');

  const users = await db.query('SELECT id, email, name FROM users');

  let io;
  try {
    const { app } = require('../server');
    io = app?.get('io');
  } catch {
    console.warn('⚠️ Socket.IO not available');
  }

  for (const user of users.rows) {
    try {
      const currentDate = new Date();
      const lastQuarter = subQuarters(currentDate, 1);
      const quarterStart = startOfQuarter(lastQuarter);
      const quarterEnd = endOfQuarter(lastQuarter);

      console.log(`Processing ${user.email} for ${format(quarterStart, 'QQQ yyyy')}`);

      const quarterlyData = await generateQuarterlyAnalytics(user.id, quarterStart, quarterEnd, user.name);

      if (quarterlyData.totalExpense === 0) {
        console.log(`ℹ️ No expenses for ${user.email}`);
        continue;
      }

      await saveQuarterlyReport(user.id, quarterStart, quarterlyData);

      const htmlContent = quarterlySummaryTemplate(quarterlyData);
      await sendQuarterlyReportEmail(
        user.email,
        `📊 Quarterly Financial Summary - ${format(quarterStart, 'QQQ yyyy')}`,
        htmlContent
      );

      const notificationData = {
        reportType: 'quarterly',
        quarter: format(quarterStart, 'QQQ'),
        year: format(quarterStart, 'yyyy'),
        period: `${format(quarterStart, 'QQQ yyyy')}`,
        totalExpense: quarterlyData.totalExpense,
        reportUrl: `/reports/quarterly-report`,
        topCategory: getTopCategory(quarterlyData.categoryData),
        monthlyAverage: quarterlyData.analytics.averageMonthly,
        previousQuarterComparison: quarterlyData.previousQuarterData ? {
          change: quarterlyData.totalExpense - quarterlyData.previousQuarterData.totalExpense,
          percentChange: quarterlyData.previousQuarterData.totalExpense > 0 
            ? ((quarterlyData.totalExpense - quarterlyData.previousQuarterData.totalExpense) / quarterlyData.previousQuarterData.totalExpense) * 100 
            : 0
        } : null
      };

      const notification = await NotificationService.createNotification(
        user.id,
        'quarterly_report_ready',
        `Quarterly Report Ready! 📈`,
        `Your ${format(quarterStart, 'QQQ yyyy')} report is ready. Total spending: ₹${quarterlyData.totalExpense.toLocaleString('en-IN')}.`,
        notificationData
      );

      if (io && notification) {
        NotificationService.emitNotification(io, user.id, notification);
      }

      console.log(`✅ Sent to ${user.email}`);
    } catch (err) {
      console.error(`❌ Error for ${user.email}`, err);
    }
  }

  console.log('✅ All Quarterly Reports Generated');
}

function getTopCategory(categoryData) {
  const sorted = Object.entries(categoryData).sort(([, a], [, b]) => b - a);
  if (!sorted.length) return null;
  const [name, amount] = sorted[0];
  const total = Object.values(categoryData).reduce((a, b) => a + b, 0);
  return {
    name,
    amount,
    percentage: ((amount / total) * 100).toFixed(1)
  };
}

async function generateQuarterlyAnalytics(userId, quarterStart, quarterEnd, userName) {
  const bills = await db.query(
    `SELECT id FROM work_bills WHERE user_id = $1 AND bill_month BETWEEN $2 AND $3`,
    [userId, quarterStart, quarterEnd]
  );
  if (!bills.rows.length) {
    return {
      userId,
      userName,
      quarterStart,
      quarterEnd,
      totalExpense: 0,
      monthlyData: {},
      categoryData: {},
      weeklyData: {},
      dailyData: {},
      analytics: {},
      insights: [],
      previousQuarterData: null
    };
  }

  const billIds = bills.rows.map(b => b.id);
  const entries = await db.query(
    `SELECT e.entry_date, i.amount, i.category 
     FROM daily_entries e 
     JOIN entry_items i ON e.id = i.daily_entry_id 
     WHERE e.bill_id = ANY($1) AND e.entry_date BETWEEN $2 AND $3`,
    [billIds, quarterStart, quarterEnd]
  );

  const prevQuarterStart = subQuarters(quarterStart, 1);
  const prevQuarterEnd = endOfQuarter(prevQuarterStart);
  const prevBills = await db.query(
    `SELECT id FROM work_bills WHERE user_id = $1 AND bill_month BETWEEN $2 AND $3`,
    [userId, prevQuarterStart, prevQuarterEnd]
  );

  let previousQuarterData = null;
  if (prevBills.rows.length) {
    const prevIds = prevBills.rows.map(b => b.id);
    const prevTotal = await db.query(
      `SELECT COALESCE(SUM(i.amount), 0) AS total 
       FROM daily_entries e JOIN entry_items i ON e.id = i.daily_entry_id 
       WHERE e.bill_id = ANY($1) AND e.entry_date BETWEEN $2 AND $3`,
      [prevIds, prevQuarterStart, prevQuarterEnd]
    );
    previousQuarterData = {
      totalExpense: parseFloat(prevTotal.rows[0].total || 0),
      quarterStart: prevQuarterStart,
      quarterEnd: prevQuarterEnd
    };
  }

  const monthlyData = {}, categoryData = {}, weeklyData = {}, dailyData = {};
  let totalExpense = 0;

  for (const row of entries.rows) {
    const date = new Date(row.entry_date);
    const dateKey = date.toISOString().split('T')[0];
    const monthKey = format(date, 'yyyy-MM');
    const weekKey = format(date, 'yyyy-ww');
    const amount = parseFloat(row.amount || 0);
    const category = row.category?.trim() || 'Uncategorized';

    monthlyData[monthKey] = (monthlyData[monthKey] || 0) + amount;
    weeklyData[weekKey] = (weeklyData[weekKey] || 0) + amount;
    dailyData[dateKey] = (dailyData[dateKey] || 0) + amount;
    categoryData[category] = (categoryData[category] || 0) + amount;

    totalExpense += amount;
  }

  const monthlyValues = Object.values(monthlyData);
  const dailyValues = Object.values(dailyData);
  const analytics = {
    averageMonthly: monthlyValues.length ? totalExpense / monthlyValues.length : 0,
    averageDaily: dailyValues.length ? totalExpense / dailyValues.length : 0,
    maxMonthlySpend: Math.max(...monthlyValues),
    minMonthlySpend: Math.min(...monthlyValues.filter(v => v > 0)),
    quarterlyGrowthRate: calcGrowth(monthlyValues),
    spendingConsistency: calcConsistency(monthlyValues),
    activeMonths: monthlyValues.length,
    activeDays: dailyValues.length,
    topSpendingMonth: getTopMonth(monthlyData),
    categoryDiversification: Object.keys(categoryData).length
  };

  const insights = generateQuarterlyInsights(categoryData, monthlyData, previousQuarterData, analytics);

  return {
    userId,
    userName,
    quarterStart,
    quarterEnd,
    totalExpense,
    monthlyData,
    categoryData,
    weeklyData,
    dailyData,
    analytics,
    insights,
    previousQuarterData
  };
}

function calcGrowth(values) {
  if (values.length < 2 || values[0] === 0) return 'N/A';
  const rate = ((values[values.length - 1] - values[0]) / values[0]) * 100;
  return rate.toFixed(1) + '%';
}

function calcConsistency(values) {
  if (values.length < 2) return 'N/A';
  const mean = values.reduce((a, b) => a + b) / values.length;
  const stddev = Math.sqrt(values.reduce((acc, v) => acc + Math.pow(v - mean, 2), 0) / values.length);
  const cv = stddev / mean;
  if (cv < 0.15) return 'Very consistent';
  if (cv < 0.3) return 'Consistent';
  if (cv < 0.5) return 'Moderate variation';
  return 'Highly variable';
}

function getTopMonth(data) {
  const sorted = Object.entries(data).sort(([, a], [, b]) => b - a);
  if (!sorted.length) return null;
  const [period, amount] = sorted[0];
  return { period, amount };
}

function generateQuarterlyInsights(categoryData, monthlyData, prevData, analytics) {
  const insights = [];
  const total = Object.values(categoryData).reduce((a, b) => a + b, 0);

  // Growth
  if (!['N/A', 'Cannot calculate'].includes(analytics.quarterlyGrowthRate)) {
    const val = parseFloat(analytics.quarterlyGrowthRate);
    insights.push({
      type: 'growth',
      icon: val > 0 ? '📈' : '📉',
      message: `Spending ${val > 0 ? 'increased' : 'decreased'} by ${Math.abs(val).toFixed(1)}% this quarter.`
    });
  }

  // Top category
  const topCat = getTopCategory(categoryData);
  if (topCat) {
    insights.push({
      type: 'top_category',
      icon: '🏆',
      message: `${topCat.name} was the top category, contributing ${topCat.percentage}%.`
    });
  }

  // Compare to previous
  if (prevData && prevData.totalExpense > 0) {
    const change = total - prevData.totalExpense;
    const pct = ((change / prevData.totalExpense) * 100).toFixed(1);
    insights.push({
      type: 'compare',
      icon: change > 0 ? '🆙' : '🟢',
      message: `${change > 0 ? 'Increased' : 'Reduced'} by ₹${Math.abs(change).toLocaleString('en-IN')} (${Math.abs(pct)}%) from last quarter.`
    });
  }

  // Consistency
  insights.push({
    type: 'consistency',
    icon: '📋',
    message: `Spending was ${analytics.spendingConsistency.toLowerCase()} across ${analytics.activeMonths} months.`
  });

  // Peak month
  if (analytics.topSpendingMonth) {
    insights.push({
      type: 'peak',
      icon: '⭐',
      message: `Highest spending in ${format(new Date(analytics.topSpendingMonth.period + '-01'), 'MMMM yyyy')} (₹${analytics.topSpendingMonth.amount.toLocaleString('en-IN')})`
    });
  }

  return insights;
}

async function saveQuarterlyReport(userId, quarterStart, data) {
  const existing = await db.query(
    `SELECT id FROM quarterly_reports WHERE user_id = $1 AND quarter_start = $2`,
    [userId, quarterStart]
  );

  const values = [
    userId,
    quarterStart,
    data.quarterEnd,
    data.totalExpense,
    JSON.stringify(data.monthlyData),
    JSON.stringify(data.categoryData),
    JSON.stringify(data.weeklyData),
    JSON.stringify(data.dailyData),
    JSON.stringify(data.analytics),
    JSON.stringify(data.insights),
    JSON.stringify(data.previousQuarterData)
  ];

  if (existing.rows.length) {
    await db.query(
      `UPDATE quarterly_reports SET quarter_end = $3, total_expense = $4,
       monthly_breakdown = $5, category_breakdown = $6, weekly_breakdown = $7, daily_breakdown = $8,
       analytics_data = $9, insights = $10, comparison_data = $11, created_at = now()
       WHERE user_id = $1 AND quarter_start = $2`,
      values
    );
    console.log(`🔁 Updated report for user ${userId}`);
  } else {
    await db.query(
      `INSERT INTO quarterly_reports (
         user_id, quarter_start, quarter_end, total_expense,
         monthly_breakdown, category_breakdown, weekly_breakdown, daily_breakdown,
         analytics_data, insights, comparison_data, created_at
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, now())`,
      values
    );
    console.log(`🆕 Created new report for user ${userId}`);
  }
}

module.exports = generateQuarterlyReports;
