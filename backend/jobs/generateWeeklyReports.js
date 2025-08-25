const db = require('../db');
const { startOfWeek, endOfWeek, format, subWeeks } = require('date-fns');
const NotificationService = require('../services/notificationService');
const { sendWeeklyReportEmail } = require('../toolbox/emailService');
const weeklySummaryTemplate = require('../toolbox/weeklySummaryTemplate');

async function generateWeeklyReports() {
  console.log('📅 Running Weekly Report Cron...');

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
const lastWeekStart = startOfWeek(subWeeks(currentDate, 1));
const lastWeekEnd = endOfWeek(subWeeks(currentDate, 1));

      // Fixed query - using bill_id to join with work_bills table first
      const entries = await db.query(
        `SELECT e.entry_date, i.amount, i.category
         FROM work_bills b
         JOIN daily_entries e ON b.id = e.bill_id
         JOIN entry_items i ON e.id = i.daily_entry_id
         WHERE b.user_id = $1 AND e.entry_date BETWEEN $2 AND $3
         ORDER BY e.entry_date ASC`,
        [user.id, lastWeekStart, lastWeekEnd]
      );

      if (!entries.rows.length) {
        console.log(`ℹ️ No weekly entries for ${user.email}`);
        continue;
      }

      const dailyData = {}, categoryData = {};
      let totalExpense = 0;

      for (const entry of entries.rows) {
        const dateKey = format(new Date(entry.entry_date), 'yyyy-MM-dd');
        const amount = parseFloat(entry.amount || 0);
        const category = entry.category?.trim() || 'Uncategorized';

        dailyData[dateKey] = (dailyData[dateKey] || 0) + amount;
        categoryData[category] = (categoryData[category] || 0) + amount;
        totalExpense += amount;
      }

      // Enhanced analytics calculation
      const daysWithData = Object.keys(dailyData).length;
      const averageDaily = totalExpense / daysWithData;
      const sortedDays = Object.entries(dailyData).sort(([, a], [, b]) => b - a);
      const peakDay = sortedDays[0];
      const lowestDay = sortedDays[sortedDays.length - 1];

      const analytics = {
        averageDaily,
        maxDailySpend: peakDay[1],
        minDailySpend: lowestDay[1],
        peakDay: peakDay[0],
        daysWithData,
        spendingConsistency: daysWithData >= 5 ? 'Consistent' : 'Irregular',
        dailyVariance: ((peakDay[1] - lowestDay[1]) / averageDaily * 100).toFixed(1) + '%'
      };

      // Enhanced insights generation
      const insights = [
        {
          type: 'peak_day',
          priority: 2,
          icon: '📆',
          message: `Highest spending on ${format(new Date(peakDay[0]), 'EEEE')} (₹${peakDay[1].toLocaleString('en-IN')})`,
          action: peakDay[1] > averageDaily * 1.5 ? 'Review expenses from this day' : null
        },
        {
          type: 'consistency',
          priority: 3,
          icon: '📋',
          message: `Spent on ${daysWithData} days (${analytics.spendingConsistency.toLowerCase()})`
        }
      ];

      // Add comparison if previous week data available
      const prevWeekStart = startOfWeek(subWeeks(lastWeekStart, 1));
const prevWeekEnd = endOfWeek(subWeeks(lastWeekEnd, 1));
      
      const prevWeekData = await db.query(
        `SELECT COALESCE(SUM(i.amount), 0) as total
         FROM work_bills b
         JOIN daily_entries e ON b.id = e.bill_id
         JOIN entry_items i ON e.id = i.daily_entry_id
         WHERE b.user_id = $1 AND e.entry_date BETWEEN $2 AND $3`,
        [user.id, prevWeekStart, prevWeekEnd]
      );

      const previousWeekTotal = parseFloat(prevWeekData.rows[0]?.total || 0);

      const html = weeklySummaryTemplate({
        userName: user.name,
        weekStart: lastWeekStart,
        weekEnd: lastWeekEnd,
        totalExpense,
        dailyData,
        categoryData,
        analytics,
        insights,
        previousWeekData: previousWeekTotal > 0 ? {
          totalExpense: previousWeekTotal,
          weekStart: prevWeekStart,
          weekEnd: prevWeekEnd
        } : null
      });

      await sendWeeklyReportEmail(
        user.email,
        `📅 Weekly Expense Summary - ${format(lastWeekStart, 'MMM d')} to ${format(lastWeekEnd, 'MMM d')}`,
        html
      );

      const notificationData = {
        reportType: 'weekly',
        period: `${format(lastWeekStart, 'MMM d')} - ${format(lastWeekEnd, 'MMM d')}`,
        totalExpense,
        topCategory: Object.entries(categoryData).sort(([, a], [, b]) => b - a)[0]?.[0] || '',
        peakDay: analytics.peakDay,
        comparison: previousWeekTotal > 0 ? {
          change: totalExpense - previousWeekTotal,
          percentage: ((totalExpense - previousWeekTotal) / previousWeekTotal * 100).toFixed(1)
        } : null
      };

      const notification = await NotificationService.createNotification(
        user.id,
        'weekly_report_ready',
        'Weekly Report Ready! 📅',
        `Your weekly spending was ₹${totalExpense.toLocaleString('en-IN')}. ` +
        (previousWeekTotal > 0 ? 
          (totalExpense > previousWeekTotal ? `↑ ₹${(totalExpense - previousWeekTotal).toLocaleString('en-IN')} from last week` : 
          `↓ ₹${(previousWeekTotal - totalExpense).toLocaleString('en-IN')} from last week`) : ''),
        notificationData
      );

      if (io && notification) {
        NotificationService.emitNotification(io, user.id, notification);
      }

      console.log(`✅ Weekly report sent to ${user.email}`);
    } catch (err) {
      console.error(`❌ Error generating weekly report for ${user.email}`, err);
    }
  }

  console.log('✅ Weekly Report Cron completed.');
}

module.exports = generateWeeklyReports;