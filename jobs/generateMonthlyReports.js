const db = require('../backend/db');
const { startOfMonth, endOfMonth, format, subMonths } = require('date-fns');
const monthlySummaryTemplate = require('../backend/toolbox/monthlySummaryTemplate');
const { sendMonthlyReportEmail } = require('../backend/toolbox/emailService');

async function generateMonthlyReports() {
  console.log('📊 Running Monthly Report Cron...');
  
  const users = await db.query('SELECT id, email, name FROM users');
  
  for (const user of users.rows) {
    try {
      // Process previous month (completed month)
      const currentDate = new Date();
      const lastMonth = subMonths(currentDate, 1);
      const monthStart = startOfMonth(lastMonth);
      const monthEnd = endOfMonth(lastMonth);
      
      console.log(`Processing ${user.email} for ${format(monthStart, 'MMMM yyyy')}`);

      // Get bill for the month
      const bill = await db.query(
        'SELECT id FROM work_bills WHERE user_id = $1 AND bill_month = $2',
        [user.id, monthStart]
      );
      
      if (!bill.rows.length) {
        console.log(`⚠️ No bill found for ${user.email} in ${format(monthStart, 'MMMM yyyy')}`);
        continue;
      }
      
      const billId = bill.rows[0].id;

      // Check if report already exists
      const existingReport = await db.query(
        'SELECT id FROM monthly_reports WHERE user_id = $1 AND report_month = $2',
        [user.id, monthStart]
      );

      if (existingReport.rows.length > 0) {
        console.log(`ℹ️ Report already exists for ${user.email} - ${format(monthStart, 'MMMM yyyy')}`);
        continue;
      }

      // Generate monthly analytics
      const monthlyData = await generateMonthlyAnalytics(user.id, billId, monthStart, monthEnd, user.name);
      
      if (monthlyData.totalExpense === 0) {
        console.log(`ℹ️ No expenses found for ${user.email} in ${format(monthStart, 'MMMM yyyy')}`);
        continue;
      }

      // Save to database
      await saveMonthlyReport(user.id, billId, monthStart, monthlyData);
      
      // Generate and send email
      const htmlContent = monthlySummaryTemplate(monthlyData);
      await sendMonthlyReportEmail(
        user.email,
        `📈 Monthly Financial Summary - ${format(monthStart, 'MMMM yyyy')}`,
        htmlContent
      );
      
      console.log(`✅ Monthly report sent to ${user.email}`);
    } catch (err) {
      console.error(`❌ Error generating monthly report for ${user.email}:`, err);
    }
  }
  
  console.log('✅ Monthly Report Cron completed.');
}

async function generateMonthlyAnalytics(userId, billId, monthStart, monthEnd, userName) {
  // Get current month entries
  const entries = await db.query(
    `SELECT e.entry_date, e.total_debit, i.category, i.amount, i.description
     FROM daily_entries e
     LEFT JOIN entry_items i ON e.id = i.daily_entry_id
     WHERE e.bill_id = $1 AND e.entry_date BETWEEN $2 AND $3
     ORDER BY e.entry_date ASC`,
    [billId, monthStart, monthEnd]
  );
  
  // Get previous month for comparison
  const prevMonthStart = subMonths(monthStart, 1);
  const prevMonthEnd = endOfMonth(prevMonthStart);
  const prevBill = await db.query(
    'SELECT id FROM work_bills WHERE user_id = $1 AND bill_month = $2',
    [userId, prevMonthStart]
  );
  
  let previousMonthData = null;
  if (prevBill.rows.length > 0) {
    const prevEntries = await db.query(
      `SELECT COALESCE(SUM(i.amount), 0) as total
       FROM daily_entries e
       LEFT JOIN entry_items i ON e.id = i.daily_entry_id
       WHERE e.bill_id = $1 AND e.entry_date BETWEEN $2 AND $3`,
      [prevBill.rows[0].id, prevMonthStart, prevMonthEnd]
    );
    
    previousMonthData = {
      totalExpense: parseFloat(prevEntries.rows[0]?.total || 0)
    };
  }
  
  // Process current month data
  const dailyData = {};
  const categoryData = {};
  const weeklyTotals = {};
  let totalExpense = 0;
  
  entries.rows.forEach(row => {
    const amount = parseFloat(row.amount || 0);
    const date = new Date(row.entry_date);
    const dateKey = date.toISOString().split('T')[0];
    const weekNumber = Math.ceil(date.getDate() / 7);
    
    // Daily aggregation
    if (!dailyData[dateKey]) dailyData[dateKey] = 0;
    dailyData[dateKey] += amount;
    
    // Category aggregation
    if (row.category && row.category.trim()) {
      const category = row.category.trim();
      if (!categoryData[category]) categoryData[category] = 0;
      categoryData[category] += amount;
    }
    
    // Weekly aggregation
    if (!weeklyTotals[weekNumber]) weeklyTotals[weekNumber] = 0;
    weeklyTotals[weekNumber] += amount;
    
    totalExpense += amount;
  });
  
  // Calculate analytics
  const dailyAmounts = Object.values(dailyData);
  const analytics = {
    averageDaily: dailyAmounts.length > 0 ? totalExpense / dailyAmounts.length : 0,
    maxDailySpend: dailyAmounts.length > 0 ? Math.max(...dailyAmounts) : 0,
    minDailySpend: dailyAmounts.length > 0 ? Math.min(...dailyAmounts.filter(x => x > 0)) : 0,
    spendingConsistency: calculateSpendingConsistency(dailyAmounts),
    daysWithExpenses: dailyAmounts.length
  };
  
  // Generate insights
  const insights = generateMonthlyInsights(categoryData, dailyData, previousMonthData, analytics);
  
  return {
    userId,
    userName,
    billId,
    monthStart,
    monthEnd,
    totalExpense,
    dailyData,
    categoryData,
    weeklyTotals,
    previousMonthData,
    analytics,
    insights
  };
}

function calculateSpendingConsistency(dailyAmounts) {
  if (dailyAmounts.length < 2) return 'Insufficient data';
  
  const mean = dailyAmounts.reduce((a, b) => a + b, 0) / dailyAmounts.length;
  const variance = dailyAmounts.reduce((acc, val) => acc + Math.pow(val - mean, 2), 0) / dailyAmounts.length;
  const stdDev = Math.sqrt(variance);
  const coefficientOfVariation = stdDev / mean;
  
  if (coefficientOfVariation < 0.3) return 'Very consistent';
  if (coefficientOfVariation < 0.6) return 'Consistent';
  if (coefficientOfVariation < 1.0) return 'Moderate variation';
  return 'Highly variable';
}

function generateMonthlyInsights(categoryData, dailyData, previousMonthData, analytics) {
  const insights = [];
  
  // Top spending category
  const categoryEntries = Object.entries(categoryData);
  if (categoryEntries.length > 0) {
    const topCategory = categoryEntries.sort(([,a], [,b]) => b - a)[0];
    insights.push({
      type: 'top_category',
      icon: '📊',
      message: `Your highest expense category was ${topCategory[0]} (₹${topCategory[1].toLocaleString('en-IN', { maximumFractionDigits: 0 })})`
    });
  }
  
  // Month-over-month comparison
  if (previousMonthData && previousMonthData.totalExpense > 0) {
    const currentTotal = Object.values(categoryData).reduce((a, b) => a + b, 0);
    const change = currentTotal - previousMonthData.totalExpense;
    const percentChange = ((change / previousMonthData.totalExpense) * 100).toFixed(1);
    
    insights.push({
      type: 'monthly_comparison',
      icon: change > 0 ? '📈' : '📉',
      message: `${change > 0 ? 'Increased' : 'Decreased'} by ₹${Math.abs(change).toLocaleString('en-IN', { maximumFractionDigits: 0 })} (${Math.abs(percentChange)}%) compared to last month`
    });
  }
  
  // Spending pattern insight
  if (analytics.daysWithExpenses > 0) {
    insights.push({
      type: 'spending_pattern',
      icon: '📅',
      message: `You logged expenses on ${analytics.daysWithExpenses} days with ${analytics.spendingConsistency.toLowerCase()} spending patterns`
    });
  }
  
  // Daily average insight
  if (analytics.averageDaily > 0) {
    insights.push({
      type: 'daily_average',
      icon: '💰',
      message: `Your daily average spending was ₹${analytics.averageDaily.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`
    });
  }
  
  return insights;
}

async function saveMonthlyReport(userId, billId, reportMonth, data) {
  try {
    await db.query(
      `INSERT INTO monthly_reports (
        user_id, bill_id, report_month, total_expense, 
        category_breakdown, daily_breakdown, weekly_breakdown, 
        analytics_data, insights, comparison_data
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
      [
        userId,
        billId,
        reportMonth,
        data.totalExpense,
        JSON.stringify(data.categoryData),
        JSON.stringify(data.dailyData),
        JSON.stringify(data.weeklyTotals),
        JSON.stringify(data.analytics),
        JSON.stringify(data.insights),
        JSON.stringify(data.previousMonthData)
      ]
    );
    console.log(`✅ Monthly report saved to database for user ${userId}`);
  } catch (error) {
    console.error('❌ Error saving monthly report:', error);
    throw error;
  }
}

module.exports = generateMonthlyReports;
