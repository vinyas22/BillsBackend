const pool = require('../db');
const { parseISO, startOfWeek, endOfWeek, startOfMonth, endOfMonth, subMonths, subQuarters, subYears,
  startOfQuarter, endOfQuarter, startOfYear, endOfYear } = require('date-fns');

const userIdFrom = (req) => req.user.userId;
const sumAmount = (rows) => rows.reduce((acc, r) => acc + parseFloat(r.total || r.amount || 0), 0);

// 🔹 Reusable comparison helper
const getComparison = (curr, prev) => {
  const diff = curr - prev;
  return prev === 0 ? null : Math.round((diff / prev) * 100);
};


const getWeeklyByMonthReport = async (req, res) => {
  try {
    const billId = parseInt(req.params.billId);
    const date = req.params.date; // "YYYY-MM"
    const [year, month] = date.split('-').map(Number);

    const lastDay = new Date(year, month, 0).getDate();
    const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
    const endDate = `${year}-${String(month).padStart(2, '0')}-${lastDay}`;

    const result = await pool.query(
      `SELECT
         DATE_TRUNC('week', de.entry_date) AS week_start,
         DATE_TRUNC('week', de.entry_date) + INTERVAL '6 days' AS week_end,
         COUNT(DISTINCT de.entry_date) AS day_count,
         SUM(ei.amount) AS total,
         JSON_AGG(JSON_BUILD_OBJECT(
            'category', ei.category,
            'amount', ei.amount,
            'entry_date', de.entry_date
         )) AS items
       FROM entry_items ei
       JOIN daily_entries de ON ei.daily_entry_id = de.id
       WHERE de.bill_id = $1
         AND de.entry_date BETWEEN $2 AND $3
       GROUP BY week_start
       ORDER BY week_start`,
      [billId, startDate, endDate]
    );

    const weekly = result.rows.map((row, index) => {
      const itemsArray = Array.isArray(row.items)
        ? row.items.map(item => ({
            category: item.category,
            amount: parseFloat(item.amount),
            entry_date: item.entry_date
          }))
        : [];

      return {
        week_index: index + 1,
        week_start: row.week_start,
        week_end: row.week_end,
        total: parseFloat(row.total),
        isFullWeek: parseInt(row.day_count) === 7,
        items: itemsArray
      };
    });

    res.json({
      month: `${year}-${String(month).padStart(2, '0')}`,
      weekly
    });

  } catch (err) {
    if (!res.headersSent) {
      res.status(500).json({
        error: 'Failed to fetch weekly-by-month report',
        details: err.message
      });
    }
  }
};












const {   isValid } = require('date-fns');

const getMonthlyReport = async (req, res) => {
const userId = userIdFrom(req);
const { date } = req.query;

  // ✅ Enhanced validation
  if (!date) {
    return res.status(400).json({ error: 'Missing required query param: date' });
  }

  const parsedDate = parseISO(date);
  if (!isValid(parsedDate)) {
    return res.status(400).json({ error: 'Invalid date format. Expected YYYY-MM-DD' });
  }

  const base = parsedDate;
  const start = startOfMonth(base);
  const end = endOfMonth(base);
  const prevStart = startOfMonth(subMonths(base, 1));
  const prevEnd = endOfMonth(subMonths(base, 1));

  // Format dates as 'YYYY-MM-01'
  const billMonthDate = `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, '0')}-01`;
  const prevBillMonthDate = `${prevStart.getFullYear()}-${String(prevStart.getMonth() + 1).padStart(2, '0')}-01`;

  try {
    const [
      currCategories,
      currIncomeRow,
      prevIncomeRow,
      prevSpentRow,
      currDaily,
      prevCategories,
      currDetailedDaily
    ] = await Promise.all([

      // Current month: Category-wise totals
      pool.query(`
        SELECT category, SUM(amount) AS amount
        FROM entry_items ei
        JOIN daily_entries de ON ei.daily_entry_id = de.id
        JOIN work_bills wb ON wb.id = de.bill_id
        WHERE wb.user_id = $1 AND de.entry_date BETWEEN $2 AND $3
        GROUP BY category
      `, [userId, start, end]),

      // Current month: Total income
      pool.query(`
        SELECT total_balance
        FROM work_bills
        WHERE user_id = $1 AND bill_month = $2
        LIMIT 1
      `, [userId, billMonthDate]),

      // Previous month: Total income
      pool.query(`
        SELECT total_balance
        FROM work_bills
        WHERE user_id = $1 AND bill_month = $2
        LIMIT 1
      `, [userId, prevBillMonthDate]),

      // Previous month: Total spent
      pool.query(`
        SELECT SUM(amount) AS total
        FROM entry_items ei
        JOIN daily_entries de ON ei.daily_entry_id = de.id
        JOIN work_bills wb ON wb.id = de.bill_id
        WHERE wb.user_id = $1 AND de.entry_date BETWEEN $2 AND $3
      `, [userId, prevStart, prevEnd]),

      // Current month: Daily totals
      pool.query(`
        SELECT de.entry_date::date AS date, SUM(ei.amount) AS total
        FROM entry_items ei
        JOIN daily_entries de ON ei.daily_entry_id = de.id
        JOIN work_bills wb ON wb.id = de.bill_id
        WHERE wb.user_id = $1 AND de.entry_date BETWEEN $2 AND $3
        GROUP BY de.entry_date
        ORDER BY de.entry_date
      `, [userId, start, end]),

      // Previous month: Category-wise totals
      pool.query(`
        SELECT category, SUM(amount) AS amount
        FROM entry_items ei
        JOIN daily_entries de ON ei.daily_entry_id = de.id
        JOIN work_bills wb ON wb.id = de.bill_id
        WHERE wb.user_id = $1 AND de.entry_date BETWEEN $2 AND $3
        GROUP BY category
      `, [userId, prevStart, prevEnd]),

      // Detailed daily per category (for filtering)
      pool.query(`
        SELECT de.entry_date::date AS date, ei.category, SUM(ei.amount) AS amount
        FROM entry_items ei
        JOIN daily_entries de ON ei.daily_entry_id = de.id
        JOIN work_bills wb ON wb.id = de.bill_id
        WHERE wb.user_id = $1 AND de.entry_date BETWEEN $2 AND $3
        GROUP BY de.entry_date, ei.category
        ORDER BY de.entry_date
      `, [userId, start, end])
    ]);

    // ✅ Enhanced data processing with null safety
    const sumAmount = rows => rows.reduce((acc, row) => acc + parseFloat(row.amount || 0), 0);

    const totalIncome = parseFloat(currIncomeRow.rows[0]?.total_balance || 0);
    const totalSpent = sumAmount(currCategories.rows);
    const savings = totalIncome - totalSpent;
    const savingsRate = totalIncome === 0 ? 0 : Math.round((savings / totalIncome) * 100);

    const previousIncome = parseFloat(prevIncomeRow.rows[0]?.total_balance || 0);
    const previousSpent = parseFloat(prevSpentRow.rows[0]?.total || 0);
    const previousSavings = previousIncome - previousSpent;
    const previousSavingsRate = previousIncome === 0 ? 0 : Math.round((previousSavings / previousIncome) * 100);

    // ✅ Enhanced response with better data structure
    res.json({
      billMonth: billMonthDate,
      totalIncome,
      totalExpense: totalSpent,
      savings,
      savingsRate,
      category: currCategories.rows.map(row => ({
        category: row.category,
        amount: parseFloat(row.amount || 0)
      })),
      daily: currDaily.rows.map(row => ({
        date: row.date,
        total: parseFloat(row.total || 0)
      })),
      detailed_daily: currDetailedDaily.rows.map(row => ({
        date: row.date,
        category: row.category,
        amount: parseFloat(row.amount || 0)
      })),
      previousMonth: {
        totalIncome: previousIncome,
        totalExpense: previousSpent,
        savings: previousSavings,
        savingsRate: previousSavingsRate,
        category: prevCategories.rows.map(row => ({
          category: row.category,
          amount: parseFloat(row.amount || 0)
        }))
      }
    });

  } catch (err) {
    console.error('❌ Monthly report error:', err);
    res.status(500).json({ 
      error: 'Failed to fetch monthly report', 
      details: process.env.NODE_ENV === 'development' ? err.message : 'Internal server error'
    });
  }
};










const getQuarterlyReport = async (req, res) => {
  const userId = userIdFrom(req);
  const { date } = req.query;

  if (!date) {
    return res.status(400).json({ error: 'Missing required query param: date' });
  }

  const parsedDate = parseISO(date);
  if (!isValid(parsedDate)) {
    return res.status(400).json({ error: 'Invalid date format. Expected YYYY-MM-DD' });
  }

  const base = parsedDate;
  const start = startOfQuarter(base);
  const end = endOfQuarter(base);
  const prevStart = startOfQuarter(subQuarters(base, 1));
  const prevEnd = endOfQuarter(subQuarters(base, 1));

  // Helper functions
  const getQuarterInfo = (date) => {
    const year = date.getFullYear();
    const quarter = Math.floor(date.getMonth() / 3) + 1;
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const quarterMonths = months.slice((quarter - 1) * 3, quarter * 3);
    
    return {
      year,
      quarter,
      label: `Q${quarter} ${year}`,
      months: quarterMonths
    };
  };

  const formatQuarterRange = (start, end) => {
    const startMonth = `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, '0')}-01`;
    const endMonth = `${end.getFullYear()}-${String(end.getMonth() + 1).padStart(2, '0')}-01`;
    return { startMonth, endMonth };
  };

  const sumAmount = rows => rows.reduce((acc, row) => acc + parseFloat(row.amount || 0), 0);

  try {
    const currentRange = formatQuarterRange(start, end);
    const previousRange = formatQuarterRange(prevStart, prevEnd);

    const [
      currCategories,
      currIncomeRow,
      prevIncomeRow,
      prevSpentRow,
      currDaily,
      prevCategories,
      currDetailedDaily
    ] = await Promise.all([
      
      // Current quarter: Category-wise totals
      pool.query(`
        SELECT category, SUM(amount) AS amount
        FROM entry_items ei
        JOIN daily_entries de ON ei.daily_entry_id = de.id
        JOIN work_bills wb ON wb.id = de.bill_id
        WHERE wb.user_id = $1 AND de.entry_date BETWEEN $2 AND $3
        GROUP BY category
      `, [userId, start, end]),

      // Current quarter: Total income (sum of 3 months)
      pool.query(`
        SELECT SUM(total_balance) AS total_income
        FROM work_bills
        WHERE user_id = $1 AND bill_month BETWEEN $2 AND $3
      `, [userId, currentRange.startMonth, currentRange.endMonth]),

      // Previous quarter: Total income
      pool.query(`
        SELECT SUM(total_balance) AS total_income
        FROM work_bills
        WHERE user_id = $1 AND bill_month BETWEEN $2 AND $3
      `, [userId, previousRange.startMonth, previousRange.endMonth]),

      // Previous quarter: Total spent
      pool.query(`
        SELECT SUM(amount) AS total
        FROM entry_items ei
        JOIN daily_entries de ON ei.daily_entry_id = de.id
        JOIN work_bills wb ON wb.id = de.bill_id
        WHERE wb.user_id = $1 AND de.entry_date BETWEEN $2 AND $3
      `, [userId, prevStart, prevEnd]),

      // Current quarter: Daily totals for timeline chart
      pool.query(`
        SELECT de.entry_date::date AS date, SUM(ei.amount) AS total
        FROM entry_items ei
        JOIN daily_entries de ON ei.daily_entry_id = de.id
        JOIN work_bills wb ON wb.id = de.bill_id
        WHERE wb.user_id = $1 AND de.entry_date BETWEEN $2 AND $3
        GROUP BY de.entry_date
        ORDER BY de.entry_date
      `, [userId, start, end]),

      // Previous quarter: Categories
      pool.query(`
        SELECT category, SUM(amount) AS amount
        FROM entry_items ei
        JOIN daily_entries de ON ei.daily_entry_id = de.id
        JOIN work_bills wb ON wb.id = de.bill_id
        WHERE wb.user_id = $1 AND de.entry_date BETWEEN $2 AND $3
        GROUP BY category
      `, [userId, prevStart, prevEnd]),

      // Detailed daily per category for filtering
      pool.query(`
        SELECT de.entry_date::date AS date, ei.category, SUM(ei.amount) AS amount
        FROM entry_items ei
        JOIN daily_entries de ON ei.daily_entry_id = de.id
        JOIN work_bills wb ON wb.id = de.bill_id
        WHERE wb.user_id = $1 AND de.entry_date BETWEEN $2 AND $3
        GROUP BY de.entry_date, ei.category
        ORDER BY de.entry_date
      `, [userId, start, end])
    ]);

    const totalIncome = parseFloat(currIncomeRow.rows[0]?.total_income || 0);
    const totalSpent = sumAmount(currCategories.rows);
    const savings = totalIncome - totalSpent;
    const savingsRate = totalIncome === 0 ? 0 : Math.round((savings / totalIncome) * 100);

    const previousIncome = parseFloat(prevIncomeRow.rows[0]?.total_income || 0);
    const previousSpent = parseFloat(prevSpentRow.rows[0]?.total || 0);
    const previousSavings = previousIncome - previousSpent;
    const previousSavingsRate = previousIncome === 0 ? 0 : Math.round((previousSavings / previousIncome) * 100);

    res.json({
      type: 'quarterly',
      quarter: getQuarterInfo(base),
      totalIncome,
      totalExpense: totalSpent,
      savings,
      savingsRate,
      category: currCategories.rows.map(row => ({
        category: row.category,
        amount: parseFloat(row.amount || 0)
      })),
      daily: currDaily.rows.map(row => ({
        date: row.date,
        total: parseFloat(row.total || 0)
      })),
      detailed_daily: currDetailedDaily.rows.map(row => ({
        date: row.date,
        category: row.category,
        amount: parseFloat(row.amount || 0)
      })),
      previousQuarter: {
        totalIncome: previousIncome,
        totalExpense: previousSpent,
        savings: previousSavings,
        savingsRate: previousSavingsRate,
        category: prevCategories.rows.map(row => ({
          category: row.category,
          amount: parseFloat(row.amount || 0)
        }))
      }
    });

  } catch (err) {
    console.error('❌ Quarterly report error:', err);
    res.status(500).json({ 
      error: 'Failed to fetch quarterly report', 
      details: process.env.NODE_ENV === 'development' ? err.message : 'Internal server error'
    });
  }
};

const getAvailableQuarters = async (req, res) => {
  const userId = userIdFrom(req);

  try {
    // Get all quarters that have expense data
    const quartersWithData = await pool.query(`
      SELECT DISTINCT 
        EXTRACT(YEAR FROM de.entry_date) as year,
        EXTRACT(QUARTER FROM de.entry_date) as quarter
      FROM entry_items ei
      JOIN daily_entries de ON ei.daily_entry_id = de.id
      JOIN work_bills wb ON wb.id = de.bill_id
      WHERE wb.user_id = $1
      ORDER BY year DESC, quarter DESC
    `, [userId]);

    const quarters = quartersWithData.rows.map(row => ({
      year: parseInt(row.year),
      quarter: parseInt(row.quarter),
      label: `Q${row.quarter} ${row.year}`,
      value: `${row.year}-Q${row.quarter}`
    }));

    res.json({ quarters });

  } catch (err) {
    console.error('❌ Available quarters error:', err);
    res.status(500).json({ 
      error: 'Failed to fetch available quarters', 
      details: process.env.NODE_ENV === 'development' ? err.message : 'Internal server error'
    });
  }
};





const getYearlyReport = async (req, res) => {
  const userId = userIdFrom(req);
  const { date } = req.query;

  // ✅ Add validation like monthly/quarterly reports
  if (!date) {
    return res.status(400).json({ error: 'Missing required query param: date' });
  }

  const parsedDate = parseISO(date);
  if (!isValid(parsedDate)) {
    return res.status(400).json({ error: 'Invalid date format. Expected YYYY-MM-DD' });
  }

  const base = parsedDate;
  const start = startOfYear(base);
  const end = endOfYear(base);
  const prevStart = startOfYear(subYears(base, 1));
  const prevEnd = endOfYear(subYears(base, 1));

  // Helper functions
  const getYearInfo = (date) => {
    const year = date.getFullYear();
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const quarters = ['Q1', 'Q2', 'Q3', 'Q4'];
    
    return {
      year,
      label: `${year}`,
      months,
      quarters
    };
  };

  const formatYearRange = (start, end) => {
    const year = start.getFullYear();
    const startMonth = `${year}-01-01`;
    const endMonth = `${year}-12-01`;
    return { startMonth, endMonth };
  };

  const sumAmount = rows => rows.reduce((acc, row) => acc + parseFloat(row.amount || 0), 0);

  try {
    const currentRange = formatYearRange(start, end);
    const previousRange = formatYearRange(prevStart, prevEnd);

    // ✅ Check if previous year data exists first
    const prevDataCheck = await pool.query(`
      SELECT COUNT(*) as count
      FROM entry_items ei
      JOIN daily_entries de ON ei.daily_entry_id = de.id
      JOIN work_bills wb ON wb.id = de.bill_id
      WHERE wb.user_id = $1 AND de.entry_date BETWEEN $2 AND $3
    `, [userId, prevStart, prevEnd]);

    const hasPreviousYearData = parseInt(prevDataCheck.rows[0].count) > 0;

    const queries = [
      // Current year: Category-wise totals
      pool.query(`
        SELECT category, SUM(amount) AS amount
        FROM entry_items ei
        JOIN daily_entries de ON ei.daily_entry_id = de.id
        JOIN work_bills wb ON wb.id = de.bill_id
        WHERE wb.user_id = $1 AND de.entry_date BETWEEN $2 AND $3
        GROUP BY category
      `, [userId, start, end]),

      // Current year: Total income (sum of all 12 months)
      pool.query(`
        SELECT SUM(total_balance) AS total_income
        FROM work_bills
        WHERE user_id = $1 AND bill_month BETWEEN $2 AND $3
      `, [userId, currentRange.startMonth, currentRange.endMonth]),

      // Current year: Monthly totals for trend analysis
      pool.query(`
        SELECT 
          DATE_TRUNC('month', de.entry_date) AS month,
          SUM(ei.amount) AS total
        FROM entry_items ei
        JOIN daily_entries de ON ei.daily_entry_id = de.id
        JOIN work_bills wb ON wb.id = de.bill_id
        WHERE wb.user_id = $1 AND de.entry_date BETWEEN $2 AND $3
        GROUP BY DATE_TRUNC('month', de.entry_date)
        ORDER BY month
      `, [userId, start, end]),

      // Current year: Quarterly breakdown
      pool.query(`
        SELECT 
          EXTRACT(QUARTER FROM de.entry_date) AS quarter,
          SUM(ei.amount) AS total
        FROM entry_items ei
        JOIN daily_entries de ON ei.daily_entry_id = de.id
        JOIN work_bills wb ON wb.id = de.bill_id
        WHERE wb.user_id = $1 AND de.entry_date BETWEEN $2 AND $3
        GROUP BY EXTRACT(QUARTER FROM de.entry_date)
        ORDER BY quarter
      `, [userId, start, end]),

      // Current year: Daily totals for detailed timeline
      pool.query(`
        SELECT de.entry_date::date AS date, SUM(ei.amount) AS total
        FROM entry_items ei
        JOIN daily_entries de ON ei.daily_entry_id = de.id
        JOIN work_bills wb ON wb.id = de.bill_id
        WHERE wb.user_id = $1 AND de.entry_date BETWEEN $2 AND $3
        GROUP BY de.entry_date
        ORDER BY de.entry_date
      `, [userId, start, end]),

      // Detailed monthly per category for filtering
      pool.query(`
        SELECT 
          DATE_TRUNC('month', de.entry_date) AS month,
          ei.category,
          SUM(ei.amount) AS amount
        FROM entry_items ei
        JOIN daily_entries de ON ei.daily_entry_id = de.id
        JOIN work_bills wb ON wb.id = de.bill_id
        WHERE wb.user_id = $1 AND de.entry_date BETWEEN $2 AND $3
        GROUP BY DATE_TRUNC('month', de.entry_date), ei.category
        ORDER BY month
      `, [userId, start, end])
    ];

    // ✅ Conditionally add previous year queries only if data exists
    if (hasPreviousYearData) {
      queries.push(
        // Previous year: Total income
        pool.query(`
          SELECT SUM(total_balance) AS total_income
          FROM work_bills
          WHERE user_id = $1 AND bill_month BETWEEN $2 AND $3
        `, [userId, previousRange.startMonth, previousRange.endMonth]),

        // Previous year: Total spent
        pool.query(`
          SELECT SUM(amount) AS total
          FROM entry_items ei
          JOIN daily_entries de ON ei.daily_entry_id = de.id
          JOIN work_bills wb ON wb.id = de.bill_id
          WHERE wb.user_id = $1 AND de.entry_date BETWEEN $2 AND $3
        `, [userId, prevStart, prevEnd]),

        // Previous year: Categories
        pool.query(`
          SELECT category, SUM(amount) AS amount
          FROM entry_items ei
          JOIN daily_entries de ON ei.daily_entry_id = de.id
          JOIN work_bills wb ON wb.id = de.bill_id
          WHERE wb.user_id = $1 AND de.entry_date BETWEEN $2 AND $3
          GROUP BY category
        `, [userId, prevStart, prevEnd])
      );
    }

    const results = await Promise.all(queries);

    // Parse results
    const [
      currCategories,
      currIncomeRow,
      currMonthly,
      currQuarterly,
      currDaily,
      currDetailedMonthly
    ] = results;

    // Calculate current year metrics
    const totalIncome = parseFloat(currIncomeRow.rows[0]?.total_income || 0);
    const totalSpent = sumAmount(currCategories.rows);
    const savings = totalIncome - totalSpent;
    const savingsRate = totalIncome === 0 ? 0 : Math.round((savings / totalIncome) * 100);

    // Base response structure
    let response = {
      type: 'yearly',
      year: getYearInfo(base),
      totalIncome,
      totalExpense: totalSpent,
      savings,
      savingsRate,
      hasPreviousYearData,
      category: currCategories.rows.map(row => ({
        category: row.category,
        amount: parseFloat(row.amount || 0)
      })),
      monthly: currMonthly.rows.map(row => ({
        month: row.month,
        total: parseFloat(row.total || 0)
      })),
      quarterly: currQuarterly.rows.map(row => ({
        quarter: parseInt(row.quarter),
        total: parseFloat(row.total || 0)
      })),
      daily: currDaily.rows.map(row => ({
        date: row.date,
        total: parseFloat(row.total || 0)
      })),
      detailed_monthly: currDetailedMonthly.rows.map(row => ({
        month: row.month,
        category: row.category,
        amount: parseFloat(row.amount || 0)
      }))
    };

    // ✅ Add previous year data only if it exists
    if (hasPreviousYearData && results.length > 6) {
      const [prevIncomeRow, prevSpentRow, prevCategories] = results.slice(6);
      
      const previousIncome = parseFloat(prevIncomeRow.rows[0]?.total_income || 0);
      const previousSpent = parseFloat(prevSpentRow.rows[0]?.total || 0);
      const previousSavings = previousIncome - previousSpent;
      const previousSavingsRate = previousIncome === 0 ? 0 : Math.round((previousSavings / previousIncome) * 100);

      response.previousYear = {
        totalIncome: previousIncome,
        totalExpense: previousSpent,
        savings: previousSavings,
        savingsRate: previousSavingsRate,
        category: prevCategories.rows.map(row => ({
          category: row.category,
          amount: parseFloat(row.amount || 0)
        }))
      };
    }

    res.json(response);

  } catch (err) {
    console.error('❌ Yearly report error:', err);
    res.status(500).json({ 
      error: 'Failed to fetch yearly report', 
      details: process.env.NODE_ENV === 'development' ? err.message : 'Internal server error'
    });
  }
};
const getAvailableYears = async (req, res) => {
  const userId = userIdFrom(req);

  try {
    const yearsWithData = await pool.query(`
      SELECT DISTINCT 
        EXTRACT(YEAR FROM de.entry_date) as year
      FROM entry_items ei
      JOIN daily_entries de ON ei.daily_entry_id = de.id
      JOIN work_bills wb ON wb.id = de.bill_id
      WHERE wb.user_id = $1
      ORDER BY year DESC
    `, [userId]);

    const years = yearsWithData.rows.map(row => ({
      year: parseInt(row.year),
      label: `${row.year}`,
      value: `${row.year}`
    }));

    res.json({ years });

  } catch (err) {
    console.error('❌ Available years error:', err);
    res.status(500).json({ 
      error: 'Failed to fetch available years', 
      details: process.env.NODE_ENV === 'development' ? err.message : 'Internal server error'
    });
  }
};



module.exports = {
  getWeeklyByMonthReport,
  getMonthlyReport,
  getQuarterlyReport,
  getYearlyReport, getAvailableQuarters, getAvailableYears
};