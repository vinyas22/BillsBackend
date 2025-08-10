const db = require('../db');
const { startOfYear, endOfYear, format, subYears } = require('date-fns');
const NotificationService = require('../services/notificationService');
const { sendYearlyReportEmail } = require('../toolbox/emailService');
const yearlySummaryTemplate = require('../toolbox/yearlySummaryTemplate');

async function generateYearlyReports() {
  console.log('📆 Running Yearly Report Cron...');

  const users = await db.query('SELECT id, email, name FROM users');

  let io;
  try {
    const { app } = require('../server');
    io = app?.get('io');
  } catch (e) {
    console.warn('⚠️ Socket.IO not available for real-time notifications');
  }

  for (const user of users.rows) {
    try {
      const currentDate = new Date();
      const lastYearStart = startOfYear(subYears(currentDate, 1));
      const lastYearEnd = endOfYear(subYears(currentDate, 1));

      // Fixed query - joining through work_bills table
      const entries = await db.query(
        `SELECT e.entry_date, i.amount, i.category
         FROM work_bills b
         JOIN daily_entries e ON b.id = e.bill_id
         JOIN entry_items i ON e.id = i.daily_entry_id
         WHERE b.user_id = $1 AND e.entry_date BETWEEN $2 AND $3
         ORDER BY e.entry_date ASC`,
        [user.id, lastYearStart, lastYearEnd]
      );

      if (!entries.rows.length) {
        console.log(`ℹ️ No entries found for ${user.email} in ${format(lastYearStart, 'yyyy')}`);
        continue;
      }

      const monthlyData = {}, quarterlyData = {}, categoryData = {}, seasonalData = {};
      let totalExpense = 0;

      // Enhanced data processing
      for (const entry of entries.rows) {
        const date = new Date(entry.entry_date);
        const monthKey = format(date, 'yyyy-MM');
        const quarterKey = `Q${Math.ceil((date.getMonth() + 1)/3)} ${date.getFullYear()}`;
        const season = getSeason(date);
        const amount = parseFloat(entry.amount || 0);
        const category = entry.category?.trim() || 'Uncategorized';

        monthlyData[monthKey] = (monthlyData[monthKey] || 0) + amount;
        quarterlyData[quarterKey] = (quarterlyData[quarterKey] || 0) + amount;
        seasonalData[season] = (seasonalData[season] || 0) + amount;
        categoryData[category] = (categoryData[category] || 0) + amount;
        totalExpense += amount;
      }

      // Enhanced analytics
      const activeMonths = Object.keys(monthlyData).length;
      const averageMonthly = totalExpense / activeMonths;
      const sortedMonths = Object.entries(monthlyData).sort(([,a], [,b]) => b - a);
      const peakMonth = sortedMonths[0];
      const growthRate = calculateGrowthRate(monthlyData);

      const analytics = {
        averageMonthly,
        maxMonthlySpend: peakMonth[1],
        minMonthlySpend: sortedMonths[sortedMonths.length-1][1],
        peakMonth: peakMonth[0],
        activeMonths,
        categoryDiversification: Object.keys(categoryData).length,
        yearlyGrowthTrend: growthRate,
        spendingConsistency: activeMonths >= 11 ? 'Very Consistent' : 
                          activeMonths >= 8 ? 'Consistent' : 'Irregular',
        dataCompleteness: (activeMonths / 12 * 100).toFixed(1),
        seasonalVariance: calculateSeasonalVariance(seasonalData)
      };

      // Enhanced insights generation
      const insights = generateYearlyInsights({
        totalExpense,
        monthlyData,
        categoryData,
        seasonalData,
        analytics
      });

      // Get previous year data for comparison
      const prevYearStart = startOfYear(subYears(lastYearStart, 1));
      const prevYearEnd = endOfYear(subYears(lastYearEnd, 1));
      
      const prevYearData = await db.query(
        `SELECT COALESCE(SUM(i.amount), 0) as total
         FROM work_bills b
         JOIN daily_entries e ON b.id = e.bill_id
         JOIN entry_items i ON e.id = i.daily_entry_id
         WHERE b.user_id = $1 AND e.entry_date BETWEEN $2 AND $3`,
        [user.id, prevYearStart, prevYearEnd]
      );

      const previousYearTotal = parseFloat(prevYearData.rows[0]?.total || 0);

      // Prepare template data
      const templateData = {
        userName: user.name,
        year: format(lastYearStart, 'yyyy'),
        totalExpense,
        monthlyData,
        quarterlyData,
        categoryData,
        seasonalData,
        analytics,
        insights,
        comparisonData: previousYearTotal > 0 ? {
          totalExpense: previousYearTotal,
          period: format(prevYearStart, 'yyyy')
        } : null,
        reportPeriod: {
          start: lastYearStart,
          end: lastYearEnd,
          label: format(lastYearStart, 'yyyy')
        },
        dataStrategy: {
          strategy: activeMonths === 12 ? 'current_year_complete' : 
                  previousYearTotal > 0 && activeMonths === 12 ? 'previous_year_complete' :
                  'partial_year'
        }
      };

      const html = yearlySummaryTemplate(templateData);

      await sendYearlyReportEmail(
        user.email,
        `📆 Yearly Expense Summary - ${format(lastYearStart, 'yyyy')}`,
        html
      );

      // Enhanced notification
      const notificationData = {
        reportType: 'yearly',
        period: format(lastYearStart, 'yyyy'),
        totalExpense,
        peakMonth: analytics.peakMonth,
        avgMonthly: analytics.averageMonthly,
        comparison: previousYearTotal > 0 ? {
          change: totalExpense - previousYearTotal,
          percentage: ((totalExpense - previousYearTotal) / previousYearTotal * 100).toFixed(1)
        } : null
      };

      const notification = await NotificationService.createNotification(
        user.id,
        'yearly_report_ready',
        'Yearly Report Ready! 📆',
        `Your ${format(lastYearStart, 'yyyy')} spending: ₹${totalExpense.toLocaleString('en-IN')}` +
        (previousYearTotal > 0 ? 
          ` (${totalExpense > previousYearTotal ? '↑' : '↓'} ${Math.abs(((totalExpense - previousYearTotal)/previousYearTotal*100)).toFixed(1)}%)` : ''),
        notificationData
      );

      if (io && notification) {
        NotificationService.emitNotification(io, user.id, notification);
      }

      console.log(`✅ Yearly report sent to ${user.email}`);
    } catch (err) {
      console.error(`❌ Error generating yearly report for ${user.email}`, err);
    }
  }

  console.log('✅ Yearly Report Cron completed.');
}

// Helper functions
function getSeason(date) {
  const month = date.getMonth();
  if (month >= 2 && month <= 4) return 'Spring';
  if (month >= 5 && month <= 7) return 'Summer';
  if (month >= 8 && month <= 9) return 'Monsoon';
  return 'Winter';
}

function calculateGrowthRate(monthlyData) {
  const months = Object.entries(monthlyData).sort(([a], [b]) => a.localeCompare(b));
  if (months.length < 2) return 'N/A';
  
  const first = months[0][1];
  const last = months[months.length-1][1];
  const rate = ((last - first) / first * 100).toFixed(1);
  
  return rate > 0 ? `↑ ${rate}%` : rate < 0 ? `↓ ${Math.abs(rate)}%` : '→ Stable';
}

function calculateSeasonalVariance(seasonalData) {
  const values = Object.values(seasonalData);
  if (values.length < 2) return 'N/A';
  
  const avg = values.reduce((a,b) => a + b, 0) / values.length;
  const variance = Math.sqrt(values.reduce((a,b) => a + Math.pow(b-avg, 2), 0) / values.length);
  
  return (variance / avg * 100).toFixed(1) + '%';
}

function generateYearlyInsights(data) {
  const { totalExpense, monthlyData, categoryData, seasonalData, analytics } = data;
  const insights = [];
  
  // Top category insight
  const topCategory = Object.entries(categoryData).sort(([,a], [,b]) => b - a)[0];
  if (topCategory) {
    insights.push({
      type: 'top_category',
      priority: 1,
      icon: '🏆',
      message: `${topCategory[0]} was your top spending category (₹${topCategory[1].toLocaleString('en-IN')})`,
      action: topCategory[1] > totalExpense * 0.3 ? 'Consider budgeting for this category' : null
    });
  }

  // Seasonal insight
  const peakSeason = Object.entries(seasonalData).sort(([,a], [,b]) => b - a)[0];
  if (peakSeason) {
    insights.push({
      type: 'seasonal',
      priority: 2,
      icon: getSeasonIcon(peakSeason[0]),
      message: `Highest spending in ${peakSeason[0]} (₹${peakSeason[1].toLocaleString('en-IN')})`,
      action: peakSeason[1] > analytics.averageMonthly * 3 ? 'Plan ahead for next year' : null
    });
  }

  // Growth insight
  if (analytics.yearlyGrowthTrend !== 'N/A') {
    insights.push({
      type: 'growth',
      priority: 3,
      icon: analytics.yearlyGrowthTrend.includes('↑') ? '📈' : 
            analytics.yearlyGrowthTrend.includes('↓') ? '📉' : '➡️',
      message: `Yearly trend: ${analytics.yearlyGrowthTrend}`
    });
  }

  // Consistency insight
  insights.push({
    type: 'consistency',
    priority: 4,
    icon: '📅',
    message: `Spent in ${analytics.activeMonths}/12 months (${analytics.spendingConsistency})`
  });

  return insights;
}

function getSeasonIcon(season) {
  const icons = {
    'Spring': '🌸',
    'Summer': '☀️',
    'Monsoon': '🌧️',
    'Winter': '❄️'
  };
  return icons[season] || '📊';
}

module.exports = generateYearlyReports;