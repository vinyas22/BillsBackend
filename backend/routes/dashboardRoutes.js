const express = require('express');
const router = express.Router();
const db = require('../db');
const auth = require('../middleware/requireAuth'); // Use your correct auth middleware
const { startOfWeek, endOfWeek, startOfMonth, endOfMonth, startOfQuarter, endOfQuarter, startOfYear, endOfYear, subWeeks, subMonths, subQuarters, subYears, format } = require('date-fns');

// Add to routes/dashboardRoutes.js

// Get available quarters for dropdown
router.get('/available-quarters', auth, async (req, res) => {
  try {
    const userId = req.user.userId || req.user.id; // ✅ Support both cases
    console.log("📌 Fetching available quarters for user:", userId);

    const quartersQuery = await db.query(
      `SELECT DISTINCT 
         EXTRACT(YEAR FROM de.entry_date) AS year,
         EXTRACT(QUARTER FROM de.entry_date) AS quarter
       FROM daily_entries de
       INNER JOIN work_bills wb ON de.bill_id = wb.id
       WHERE wb.user_id = $1
       ORDER BY year DESC, quarter DESC`,
      [userId]
    );

    console.log("📊 DB returned quarters:", quartersQuery.rows);

    const quarters = quartersQuery.rows.map(row => ({
      year: parseInt(row.year),
      quarter: parseInt(row.quarter),
      label: `Q${row.quarter} ${row.year}`,
      value: `${row.year}-Q${row.quarter}`
    }));

    res.json({ quarters });
  } catch (error) {
    console.error('❌ Error fetching available quarters:', error);
    res.status(500).json({ error: 'Failed to load available quarters' });
  }
});
 

// Get quarterly report data
router.get('/quarterly-report/:year/:quarter', auth, async (req, res) => {
  try {
    const userId = req.user.id;
    const { year, quarter } = req.params;
    
    // Calculate quarter start/end dates
    const quarterStart = new Date(year, (quarter - 1) * 3, 1);
    const quarterEnd = new Date(year, quarter * 3, 0);
    
    const quarterlyData = await db.query(
      `SELECT ei.category,
              SUM(ei.amount) as total_amount,
              COUNT(ei.id) as transaction_count,
              AVG(ei.amount) as avg_amount
       FROM daily_entries de
       INNER JOIN entry_items ei ON de.id = ei.daily_entry_id
       INNER JOIN work_bills wb ON de.bill_id = wb.id
       WHERE wb.user_id = $1 
         AND de.entry_date BETWEEN $2 AND $3
       GROUP BY ei.category
       ORDER BY total_amount DESC`,
      [userId, quarterStart, quarterEnd]
    );

    const totalAmount = quarterlyData.rows.reduce((sum, cat) => sum + parseFloat(cat.total_amount), 0);

    res.json({
      quarter: `Q${quarter} ${year}`,
      startDate: quarterStart,
      endDate: quarterEnd,
      totalAmount,
      categories: quarterlyData.rows.map(row => ({
        category: row.category,
        amount: parseFloat(row.total_amount),
        count: parseInt(row.transaction_count),
        average: parseFloat(row.avg_amount),
        percentage: totalAmount > 0 ? (parseFloat(row.total_amount) / totalAmount) * 100 : 0
      }))
    });
  } catch (error) {
    console.error('Error fetching quarterly report:', error);
    res.status(500).json({ error: 'Failed to load quarterly report' });
  }
});

// Get dashboard statistics
router.get('/stats', auth, async (req, res) => {
  try {
    const userId = req.user.userId; // Make sure this matches your JWT payload
    
    console.log(`📊 Loading dashboard stats for user ${userId}`);
    
    // Get actual data from your database
    const weeklyData = await getWeeklyStats(userId);
    const monthlyData = await getMonthlyStats(userId);
    const quarterlyData = await getQuarterlyStats(userId);
    const yearlyData = await getYearlyStats(userId);
    
    res.json({
      weekly: { amount: weeklyData.total, change: weeklyData.percentChange },
      monthly: { amount: monthlyData.total, change: monthlyData.percentChange },
      quarterly: { amount: quarterlyData.total, change: quarterlyData.percentChange },
      yearly: { amount: yearlyData.total, change: yearlyData.percentChange }
    });
  } catch (error) {
    console.error('Error fetching dashboard stats:', error);
    res.status(500).json({ error: 'Failed to load dashboard stats' });
  }
});

// Get recent transactions for dashboard
router.get('/recent-transactions', auth, async (req, res) => {
  try {
    const userId = req.user.userId;
    const limit = parseInt(req.query.limit) || 10;
    
    console.log(`📋 Loading recent transactions for user ${userId}`);
    
    const transactions = await db.query(
      `SELECT de.entry_date, ei.amount, ei.category, ei.description, wb.bill_month
       FROM daily_entries de
       INNER JOIN entry_items ei ON de.id = ei.daily_entry_id
       INNER JOIN work_bills wb ON de.bill_id = wb.id
       WHERE wb.user_id = $1
       ORDER BY de.entry_date DESC, de.created_at DESC
       LIMIT $2`,
      [userId, limit]
    );
    
    res.json({
      transactions: transactions.rows.map(t => ({
        date: t.entry_date,
        amount: parseFloat(t.amount),
        category: t.category,
        description: t.description,
        month: t.bill_month
      }))
    });
  } catch (error) {
    console.error('Error fetching recent transactions:', error);
    res.status(500).json({ error: 'Failed to load recent transactions' });
  }
});

// Get category breakdown for dashboard
router.get('/category-breakdown', auth, async (req, res) => {
  try {
    const userId = req.user.userId;
    const period = req.query.period || 'month'; // week, month, quarter, year
    
    console.log(`📈 Loading category breakdown for user ${userId}, period: ${period}`);
    
    let startDate, endDate;
    const now = new Date();
    
    switch (period) {
      case 'week':
        startDate = startOfWeek(now);
        endDate = endOfWeek(now);
        break;
      case 'quarter':
        startDate = startOfQuarter(now);
        endDate = endOfQuarter(now);
        break;
      case 'year':
        startDate = startOfYear(now);
        endDate = endOfYear(now);
        break;
      default: // month
        startDate = startOfMonth(now);
        endDate = endOfMonth(now);
    }
    
    const categoryBreakdown = await db.query(
      `SELECT ei.category, 
              SUM(ei.amount) as total_amount,
              COUNT(ei.id) as transaction_count
       FROM daily_entries de
       INNER JOIN entry_items ei ON de.id = ei.daily_entry_id
       INNER JOIN work_bills wb ON de.bill_id = wb.id
       WHERE wb.user_id = $1 
         AND de.entry_date BETWEEN $2 AND $3
         AND ei.category IS NOT NULL
         AND ei.category != ''
       GROUP BY ei.category
       ORDER BY total_amount DESC
       LIMIT 10`,
      [userId, startDate, endDate]
    );
    
    const totalAmount = categoryBreakdown.rows.reduce((sum, cat) => sum + parseFloat(cat.total_amount), 0);
    
    res.json({
      period,
      categories: categoryBreakdown.rows.map(cat => ({
        category: cat.category,
        amount: parseFloat(cat.total_amount),
        count: parseInt(cat.transaction_count),
        percentage: totalAmount > 0 ? (parseFloat(cat.total_amount) / totalAmount) * 100 : 0
      })),
      totalAmount
    });
  } catch (error) {
    console.error('Error fetching category breakdown:', error);
    res.status(500).json({ error: 'Failed to load category breakdown' });
  }
});

// Get dashboard summary
router.get('/summary', auth, async (req, res) => {
  try {
    const userId = req.user.userId;
    
    console.log(`📊 Loading dashboard summary for user ${userId}`);
    
    // Get total number of transactions
    const transactionCountQuery = await db.query(
      `SELECT COUNT(*) as count
       FROM daily_entries de
       INNER JOIN work_bills wb ON de.bill_id = wb.id
       WHERE wb.user_id = $1`,
      [userId]
    );

    // Get number of active categories
    const categoryCountQuery = await db.query(
      `SELECT COUNT(DISTINCT ei.category) as count
       FROM daily_entries de
       INNER JOIN entry_items ei ON de.id = ei.daily_entry_id
       INNER JOIN work_bills wb ON de.bill_id = wb.id
       WHERE wb.user_id = $1 
         AND ei.category IS NOT NULL 
         AND ei.category != ''`,
      [userId]
    );

    // Get first transaction date
    const firstTransactionQuery = await db.query(
      `SELECT MIN(de.entry_date) as first_date
       FROM daily_entries de
       INNER JOIN work_bills wb ON de.bill_id = wb.id
       WHERE wb.user_id = $1`,
      [userId]
    );

    // Get average daily spending (last 30 days)
    const avgDailyQuery = await db.query(
      `SELECT AVG(daily_total) as avg_daily
       FROM (
         SELECT DATE(de.entry_date) as date, SUM(ei.amount) as daily_total
         FROM daily_entries de
         INNER JOIN entry_items ei ON de.id = ei.daily_entry_id
         INNER JOIN work_bills wb ON de.bill_id = wb.id
         WHERE wb.user_id = $1 
           AND de.entry_date >= NOW() - INTERVAL '30 days'
         GROUP BY DATE(de.entry_date)
       ) daily_sums`,
      [userId]
    );

    res.json({
      totalTransactions: parseInt(transactionCountQuery.rows[0].count),
      activeCategories: parseInt(categoryCountQuery.rows[0].count),
      firstTransactionDate: firstTransactionQuery.rows[0].first_date,
      averageDailySpending: parseFloat(avgDailyQuery.rows[0].avg_daily || 0),
      accountAge: firstTransactionQuery.rows[0].first_date ? 
        Math.floor((new Date() - new Date(firstTransactionQuery.rows[0].first_date)) / (1000 * 60 * 60 * 24)) : 0
    });
  } catch (error) {
    console.error('Error fetching dashboard summary:', error);
    res.status(500).json({ error: 'Failed to load dashboard summary' });
  }
});

// Helper function to get weekly stats
async function getWeeklyStats(userId) {
  try {
    const currentWeekStart = startOfWeek(new Date());
    const currentWeekEnd = endOfWeek(new Date());
    const previousWeekStart = startOfWeek(subWeeks(new Date(), 1));
    const previousWeekEnd = endOfWeek(subWeeks(new Date(), 1));

    // Get current week total
    const currentWeekQuery = await db.query(
      `SELECT COALESCE(SUM(ei.amount), 0) as total
       FROM daily_entries de
       INNER JOIN entry_items ei ON de.id = ei.daily_entry_id
       INNER JOIN work_bills wb ON de.bill_id = wb.id
       WHERE wb.user_id = $1 
         AND de.entry_date BETWEEN $2 AND $3`,
      [userId, currentWeekStart, currentWeekEnd]
    );

    // Get previous week total
    const previousWeekQuery = await db.query(
      `SELECT COALESCE(SUM(ei.amount), 0) as total
       FROM daily_entries de
       INNER JOIN entry_items ei ON de.id = ei.daily_entry_id
       INNER JOIN work_bills wb ON de.bill_id = wb.id
       WHERE wb.user_id = $1 
         AND de.entry_date BETWEEN $2 AND $3`,
      [userId, previousWeekStart, previousWeekEnd]
    );

    const currentTotal = parseFloat(currentWeekQuery.rows[0].total);
    const previousTotal = parseFloat(previousWeekQuery.rows[0].total);
    
    const percentChange = previousTotal > 0 ? ((currentTotal - previousTotal) / previousTotal) * 100 : 0;

    return {
      total: currentTotal,
      previousTotal,
      percentChange: Math.round(percentChange * 10) / 10 // Round to 1 decimal
    };
  } catch (error) {
    console.error('Error in getWeeklyStats:', error);
    return { total: 0, previousTotal: 0, percentChange: 0 };
  }
}

// Helper function to get monthly stats
async function getMonthlyStats(userId) {
  try {
    const currentMonthStart = startOfMonth(new Date());
    const currentMonthEnd = endOfMonth(new Date());
    const previousMonthStart = startOfMonth(subMonths(new Date(), 1));
    const previousMonthEnd = endOfMonth(subMonths(new Date(), 1));

    // Get current month total
    const currentMonthQuery = await db.query(
      `SELECT COALESCE(SUM(ei.amount), 0) as total
       FROM daily_entries de
       INNER JOIN entry_items ei ON de.id = ei.daily_entry_id
       INNER JOIN work_bills wb ON de.bill_id = wb.id
       WHERE wb.user_id = $1 
         AND de.entry_date BETWEEN $2 AND $3`,
      [userId, currentMonthStart, currentMonthEnd]
    );

    // Get previous month total
    const previousMonthQuery = await db.query(
      `SELECT COALESCE(SUM(ei.amount), 0) as total
       FROM daily_entries de
       INNER JOIN entry_items ei ON de.id = ei.daily_entry_id
       INNER JOIN work_bills wb ON de.bill_id = wb.id
       WHERE wb.user_id = $1 
         AND de.entry_date BETWEEN $2 AND $3`,
      [userId, previousMonthStart, previousMonthEnd]
    );

    const currentTotal = parseFloat(currentMonthQuery.rows[0].total);
    const previousTotal = parseFloat(previousMonthQuery.rows[0].total);
    
    const percentChange = previousTotal > 0 ? ((currentTotal - previousTotal) / previousTotal) * 100 : 0;

    return {
      total: currentTotal,
      previousTotal,
      percentChange: Math.round(percentChange * 10) / 10
    };
  } catch (error) {
    console.error('Error in getMonthlyStats:', error);
    return { total: 0, previousTotal: 0, percentChange: 0 };
  }
}

// Helper function to get quarterly stats
async function getQuarterlyStats(userId) {
  try {
    const currentQuarterStart = startOfQuarter(new Date());
    const currentQuarterEnd = endOfQuarter(new Date());
    const previousQuarterStart = startOfQuarter(subQuarters(new Date(), 1));
    const previousQuarterEnd = endOfQuarter(subQuarters(new Date(), 1));

    // Get current quarter total
    const currentQuarterQuery = await db.query(
      `SELECT COALESCE(SUM(ei.amount), 0) as total
       FROM daily_entries de
       INNER JOIN entry_items ei ON de.id = ei.daily_entry_id
       INNER JOIN work_bills wb ON de.bill_id = wb.id
       WHERE wb.user_id = $1 
         AND de.entry_date BETWEEN $2 AND $3`,
      [userId, currentQuarterStart, currentQuarterEnd]
    );

    // Get previous quarter total
    const previousQuarterQuery = await db.query(
      `SELECT COALESCE(SUM(ei.amount), 0) as total
       FROM daily_entries de
       INNER JOIN entry_items ei ON de.id = ei.daily_entry_id
       INNER JOIN work_bills wb ON de.bill_id = wb.id
       WHERE wb.user_id = $1 
         AND de.entry_date BETWEEN $2 AND $3`,
      [userId, previousQuarterStart, previousQuarterEnd]
    );

    const currentTotal = parseFloat(currentQuarterQuery.rows[0].total);
    const previousTotal = parseFloat(previousQuarterQuery.rows[0].total);
    
    const percentChange = previousTotal > 0 ? ((currentTotal - previousTotal) / previousTotal) * 100 : 0;

    return {
      total: currentTotal,
      previousTotal,
      percentChange: Math.round(percentChange * 10) / 10
    };
  } catch (error) {
    console.error('Error in getQuarterlyStats:', error);
    return { total: 0, previousTotal: 0, percentChange: 0 };
  }
}

// Helper function to get yearly stats
async function getYearlyStats(userId) {
  try {
    const currentYearStart = startOfYear(new Date());
    const currentYearEnd = endOfYear(new Date());
    const previousYearStart = startOfYear(subYears(new Date(), 1));
    const previousYearEnd = endOfYear(subYears(new Date(), 1));

    // Get current year total
    const currentYearQuery = await db.query(
      `SELECT COALESCE(SUM(ei.amount), 0) as total
       FROM daily_entries de
       INNER JOIN entry_items ei ON de.id = ei.daily_entry_id
       INNER JOIN work_bills wb ON de.bill_id = wb.id
       WHERE wb.user_id = $1 
         AND de.entry_date BETWEEN $2 AND $3`,
      [userId, currentYearStart, currentYearEnd]
    );

    // Get previous year total
    const previousYearQuery = await db.query(
      `SELECT COALESCE(SUM(ei.amount), 0) as total
       FROM daily_entries de
       INNER JOIN entry_items ei ON de.id = ei.daily_entry_id
       INNER JOIN work_bills wb ON de.bill_id = wb.id
       WHERE wb.user_id = $1 
         AND de.entry_date BETWEEN $2 AND $3`,
      [userId, previousYearStart, previousYearEnd]
    );

    const currentTotal = parseFloat(currentYearQuery.rows[0].total);
    const previousTotal = parseFloat(previousYearQuery.rows[0].total);
    
    const percentChange = previousTotal > 0 ? ((currentTotal - previousTotal) / previousTotal) * 100 : 0;

    return {
      total: currentTotal,
      previousTotal,
      percentChange: Math.round(percentChange * 10) / 10
    };
  } catch (error) {
    console.error('Error in getYearlyStats:', error);
    return { total: 0, previousTotal: 0, percentChange: 0 };
  }
}

module.exports = router;
