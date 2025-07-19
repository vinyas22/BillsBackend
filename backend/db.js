const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

module.exports = pool;

// const pool = require('../db');
// const { startOfMonth, endOfMonth, startOfWeek, endOfWeek, differenceInCalendarWeeks } = require('date-fns');

// const getWeeklyByMonthReport = async (req, res) => {
//   const userId = req.user.userId;
//   const year = parseInt(req.params.year);
//   const month = parseInt(req.params.month); // 1-based
//   const today = new Date();

//   const monthStart = new Date(year, month - 1, 1);
//   const monthEnd = endOfMonth(monthStart);

//   try {
//     const result = await pool.query(`
//       SELECT 
//         DATE_TRUNC('week', de.entry_date) AS week_start,
//         MIN(de.entry_date) AS start_date,
//         MAX(de.entry_date) AS end_date,
//         SUM(ei.amount) AS total,
//         JSON_AGG(JSON_BUILD_OBJECT('category', ei.category, 'amount', ei.amount)) AS details
//       FROM entry_items ei
//       JOIN daily_entries de ON ei.daily_entry_id = de.id
//       WHERE de.user_id = $1
//         AND de.entry_date BETWEEN $2 AND $3
//       GROUP BY week_start
//       ORDER BY week_start ASC
//     `, [userId, monthStart, monthEnd]);

//     const weeklyData = result.rows.map((row, i, arr) => {
//       const prev = i > 0 ? arr[i - 1].total : null;
//       const current = parseFloat(row.total);
//       const comparison = prev !== null ? ((current - prev) / prev) * 100 : null;

//       const isCurrentWeek = today >= new Date(row.start_date) && today <= new Date(row.end_date);
//       const isFuture = today < new Date(row.start_date);

//       return {
//         week_range: `${row.start_date} to ${row.end_date}`,
//         total_spent: current,
//         by_category: row.details,
//         comparison: comparison !== null ? Math.round(comparison * 100) / 100 : null,
//         is_in_progress: isCurrentWeek,
//         is_future: isFuture
//       };
//     });

//     res.json({
//       month: `${year}-${String(month).padStart(2, '0')}`,
//       weeks: weeklyData
//     });

//   } catch (err) {
//     console.error(err);
//     res.status(500).json({ error: 'Failed to get weekly report by month' });
//   }
// };







// const getCustomReport = async (req, res) => {
//   const userId = req.user.userId;
//   const { billId } = req.params;
//   const { startDate, endDate } = req.query;

//   try {
//     const totalQuery = await pool.query(`
//       SELECT SUM(amount) AS total
//       FROM entry_items ei
//       JOIN daily_entries de ON ei.daily_entry_id = de.id
//       WHERE de.bill_id = $1 AND de.entry_date BETWEEN $2 AND $3
//     `, [billId, startDate, endDate]);

//     const categoryQuery = await pool.query(`
//       SELECT ei.category, SUM(ei.amount) AS total
//       FROM entry_items ei
//       JOIN daily_entries de ON ei.daily_entry_id = de.id
//       WHERE de.bill_id = $1 AND de.entry_date BETWEEN $2 AND $3
//       GROUP BY ei.category
//     `, [billId, startDate, endDate]);

//     const dateQuery = await pool.query(`
//       SELECT de.entry_date, SUM(ei.amount) AS total
//       FROM entry_items ei
//       JOIN daily_entries de ON ei.daily_entry_id = de.id
//       WHERE de.bill_id = $1 AND de.entry_date BETWEEN $2 AND $3
//       GROUP BY de.entry_date
//       ORDER BY de.entry_date
//     `, [billId, startDate, endDate]);

//     const balanceQuery = await pool.query(
//       `SELECT total_balance FROM work_bills WHERE id = $1 AND user_id = $2`,
//       [billId, userId]
//     );

//     const totalSpent = parseFloat(totalQuery.rows[0].total || 0);
//     const totalBalance = balanceQuery.rows[0]?.total_balance;

//     const response = {
//       range: `${startDate} to ${endDate}`,
//       total_spent: totalSpent,
//       by_category: categoryQuery.rows,
//       by_date: dateQuery.rows
//     };

//     if (totalBalance !== null && totalBalance !== undefined) {
//       response.remaining_balance = parseFloat(totalBalance) - totalSpent;
//     }

//     res.json(response);
//   } catch (err) {
//     res.status(500).json({ error: 'Failed to fetch report', details: err.message });
//   }
// };



// const { parseISO, startOfMonth, endOfMonth, startOfQuarter, endOfQuarter, startOfYear, endOfYear } = require('date-fns');

// const getConsolidatedReport = async (req, res) => {
//   const userId = req.user.userId;
//   const billId = req.params.billId;
//   const { type, date } = req.query;

//   try {
//     if (!type || !date) {
//       return res.status(400).json({ error: 'type and date are required' });
//     }

//     let startDate, endDate;
//     const baseDate = parseISO(date);

//     switch (type) {
//       case 'monthly':
//         startDate = startOfMonth(baseDate);
//         endDate = endOfMonth(baseDate);
//         break;
//       case 'quarterly':
//         startDate = startOfQuarter(baseDate);
//         endDate = endOfQuarter(baseDate);
//         break;
//       case 'yearly':
//         startDate = startOfYear(baseDate);
//         endDate = endOfYear(baseDate);
//         break;
//       default:
//         return res.status(400).json({ error: 'Invalid report type' });
//     }

//     const totalQuery = await pool.query(`
//       SELECT SUM(amount) AS total
//       FROM entry_items ei
//       JOIN daily_entries de ON ei.daily_entry_id = de.id
//       WHERE de.bill_id = $1 AND de.entry_date BETWEEN $2 AND $3
//     `, [billId, startDate, endDate]);

//     const categoryQuery = await pool.query(`
//       SELECT ei.category, SUM(ei.amount) AS total
//       FROM entry_items ei
//       JOIN daily_entries de ON ei.daily_entry_id = de.id
//       WHERE de.bill_id = $1 AND de.entry_date BETWEEN $2 AND $3
//       GROUP BY ei.category
//     `, [billId, startDate, endDate]);

//     const dateQuery = await pool.query(`
//       SELECT de.entry_date, SUM(ei.amount) AS total
//       FROM entry_items ei
//       JOIN daily_entries de ON ei.daily_entry_id = de.id
//       WHERE de.bill_id = $1 AND de.entry_date BETWEEN $2 AND $3
//       GROUP BY de.entry_date ORDER BY de.entry_date
//     `, [billId, startDate, endDate]);

//     const balanceQuery = await pool.query(`
//       SELECT total_balance FROM work_bills WHERE id = $1 AND user_id = $2
//     `, [billId, userId]);

//   const totalSpent = parseFloat(totalQuery.rows[0].total || 0);
// const totalBalance = balanceQuery.rows[0]?.total_balance;

// const response = {
//   range: { from: startDate.toISOString(), to: endDate.toISOString() },
//   total_spent: totalSpent,
//   by_category: categoryQuery.rows,
//   by_date: dateQuery.rows,
// };

// if (totalBalance !== null && totalBalance !== undefined) {
//   response.remaining_balance = parseFloat(totalBalance) - totalSpent;
// }

// res.json(response);

//   } catch (err) {
//     res.status(500).json({ error: 'Failed to fetch report', details: err.message });
//   }
// };




// module.exports = { getWeeklyByMonthReport };
