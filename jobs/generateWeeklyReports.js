// Updated generateWeeklyReports.js
const db = require('../backend/db');
const { format } = require('date-fns');
const generateWeeklySummaryHTML = require('../backend/toolbox/weeklySummaryTemplate');
const { sendWeeklyReportEmail } = require('../backend/toolbox/emailService');

async function generateWeeklyReports() {
  console.log('📅 Running Weekly Report Cron...');

  const users = await db.query('SELECT id, email, name FROM users');

  for (const user of users.rows) {
    try {
      const today = new Date();
      const weekStart = new Date(today);
      weekStart.setDate(today.getDate() - ((today.getDay() + 6) % 7)); // Monday
      weekStart.setHours(0, 0, 0, 0);

      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekStart.getDate() + 6);
      weekEnd.setHours(23, 59, 59, 999);

      // Calculate previous week dates
      const prevWeekStart = new Date(weekStart);
      prevWeekStart.setDate(weekStart.getDate() - 7);
      const prevWeekEnd = new Date(weekEnd);
      prevWeekEnd.setDate(weekEnd.getDate() - 7);

      const billMonth = new Date(weekStart.getFullYear(), weekStart.getMonth(), 1);
      const prevBillMonth = new Date(prevWeekStart.getFullYear(), prevWeekStart.getMonth(), 1);

      // Get current week bill
      const bill = await db.query(
        'SELECT id FROM work_bills WHERE user_id = $1 AND bill_month = $2',
        [user.id, billMonth]
      );

      if (!bill.rows.length) {
        console.log(`⚠️ No bill for ${user.email} in ${billMonth.toISOString().slice(0, 7)}`);
        continue;
      }

      const billId = bill.rows[0].id;

      // Get previous week bill (might be different month)
      const prevBill = await db.query(
        'SELECT id FROM work_bills WHERE user_id = $1 AND bill_month = $2',
        [user.id, prevBillMonth]
      );

      // Fetch current week data
      const entries = await db.query(
        `SELECT e.id, e.entry_date, e.total_debit, i.category, i.amount
         FROM daily_entries e
         LEFT JOIN entry_items i ON e.id = i.daily_entry_id
         INNER JOIN work_bills w ON e.bill_id = w.id
         WHERE w.user_id = $1 AND e.bill_id = $2 AND e.entry_date BETWEEN $3 AND $4
         ORDER BY e.entry_date ASC`,
        [user.id, billId, weekStart, weekEnd]
      );

      const entryRows = entries.rows;
      if (!entryRows.length) {
        console.log(`ℹ️ No entries for ${user.email} from ${weekStart.toDateString()} to ${weekEnd.toDateString()}`);
        continue;
      }

      // Fetch previous week data for comparison
      let prevTotal = null;
      let prevIsFullWeek = false;

      if (prevBill.rows.length > 0) {
        const prevEntries = await db.query(
          `SELECT COUNT(DISTINCT e.entry_date) as day_count, COALESCE(SUM(i.amount), 0) as total
           FROM daily_entries e
           LEFT JOIN entry_items i ON e.id = i.daily_entry_id
           WHERE e.bill_id = $1 AND e.entry_date BETWEEN $2 AND $3`,
          [prevBill.rows[0].id, prevWeekStart, prevWeekEnd]
        );

        if (prevEntries.rows.length > 0) {
          prevTotal = parseFloat(prevEntries.rows[0].total || 0);
          prevIsFullWeek = parseInt(prevEntries.rows[0].day_count || 0) === 7;
        }
      }

      // Aggregate current week data with validation
      const dailyData = {};
      const categoryData = {};
      let totalExpense = 0;

      entryRows.forEach(row => {
        const amount = parseFloat(row.amount || 0);
        
        // Validation for negative amounts
        if (amount < 0) {
          console.warn(`⚠️ Negative amount detected for user ${user.email}: ${amount}`);
        }

        const dateKey = row.entry_date.toISOString().split('T')[0];
        if (!dailyData[dateKey]) dailyData[dateKey] = 0;
        dailyData[dateKey] += amount;

        if (row.category && row.category.trim()) {
          const category = row.category.trim();
          if (!categoryData[category]) categoryData[category] = 0;
          categoryData[category] += amount;
        }

        totalExpense += amount;
      });

      const isFullWeek = Object.keys(dailyData).length === 7;

      // Save to DB with comparison data
      const comparisonData = prevTotal !== null ? {
        prevTotal,
        prevIsFullWeek,
        difference: totalExpense - prevTotal,
        percentageChange: prevTotal > 0 ? ((totalExpense - prevTotal) / prevTotal) * 100 : null
      } : null;

      await db.query(
        `INSERT INTO weekly_reports (
            user_id, bill_id, week_start, week_end, is_full_week,
            total_expense, category_data, daily_data, comparison_data, created_at
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, now())`,
        [
          user.id,
          billId,
          weekStart,
          weekEnd,
          isFullWeek,
          totalExpense,
          JSON.stringify(categoryData),
          JSON.stringify(dailyData),
          JSON.stringify(comparisonData)
        ]
      );

      // Generate email with comparison data
      const htmlContent = generateWeeklySummaryHTML({
        name: user.name,
        weekStart,
        weekEnd,
        total: totalExpense,
        dailyData,
        categoryData,
        isFullWeek,
        prevTotal,
        prevIsFullWeek
      });

      await sendWeeklyReportEmail(
        user.email,
        `📊 Weekly Summary (${weekStart.toDateString()} - ${weekEnd.toDateString()})`,
        htmlContent
      );

      console.log(`✅ Report sent to ${user.email}`);
    } catch (err) {
      console.error(`❌ Error generating report for ${user.email}`, err);
    }
  }

  console.log('✅ Weekly Report Cron completed.');
}

module.exports = generateWeeklyReports;
