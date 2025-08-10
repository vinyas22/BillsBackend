const DatabaseService = require('./DatabaseService');
const { createError } = require('../middleware/errorHandler');
const { 
  parseISO, isValid, format, startOfMonth, endOfMonth, startOfQuarter, endOfQuarter, startOfYear, endOfYear,
  subMonths, subQuarters, subYears
} = require('date-fns');

class ReportService {
  // ---- Utility Methods ----
  static validateDateParam(date) {
    if (!date) throw createError(400, 'Missing required parameter: date');
    const parsed = parseISO(date);
    if (!isValid(parsed)) throw createError(400, 'Invalid date format. Expected YYYY-MM-DD');
    return parsed;
  }
  static formatCurrency(amount) {
    return parseFloat(amount || 0);
  }
  static calculateSavings(income, expense) {
    const savings = income - expense;
    const savingsRate = income > 0 ? (savings / income) * 100 : 0;
    return { savings, savingsRate: Math.round(savingsRate) };
  }

  // ---- Data Fetching Methods ----
  static async getUserBillForMonth(userId, billMonth) {
    const sql = `SELECT total_balance FROM work_bills WHERE user_id = $1 AND bill_month = $2 LIMIT 1`;
    return await DatabaseService.findOne(sql, [userId, billMonth]);
  }
  static async getCategoryTotals(userId, startDate, endDate) {
    const sql = `
      SELECT category, SUM(amount) AS amount
      FROM entry_items ei
      JOIN daily_entries de ON ei.daily_entry_id = de.id
      JOIN work_bills wb ON wb.id = de.bill_id
      WHERE wb.user_id = $1 AND de.entry_date BETWEEN $2 AND $3
      GROUP BY category
      ORDER BY amount DESC
    `;
    return await DatabaseService.query(sql, [userId, startDate, endDate]);
  }
  static async getDailyTotals(userId, startDate, endDate) {
    const sql = `
      SELECT de.entry_date::date AS date, SUM(ei.amount) AS total
      FROM entry_items ei
      JOIN daily_entries de ON ei.daily_entry_id = de.id
      JOIN work_bills wb ON wb.id = de.bill_id
      WHERE wb.user_id = $1 AND de.entry_date BETWEEN $2 AND $3
      GROUP BY de.entry_date
      ORDER BY de.entry_date
    `;
    return await DatabaseService.query(sql, [userId, startDate, endDate]);
  }
  static async getDetailedDaily(userId, startDate, endDate) {
    const sql = `
      SELECT de.entry_date::date AS date, ei.category, SUM(ei.amount) AS amount
      FROM entry_items ei
      JOIN daily_entries de ON ei.daily_entry_id = de.id
      JOIN work_bills wb ON wb.id = de.bill_id
      WHERE wb.user_id = $1 AND de.entry_date BETWEEN $2 AND $3
      GROUP BY de.entry_date, ei.category
      ORDER BY de.entry_date, ei.category
    `;
    return await DatabaseService.query(sql, [userId, startDate, endDate]);
  }
  static async getMonthlyTotals(userId, startDate, endDate) {
    const sql = `
      SELECT DATE_TRUNC('month', de.entry_date) AS month, SUM(ei.amount) AS total
      FROM entry_items ei
      JOIN daily_entries de ON ei.daily_entry_id = de.id
      JOIN work_bills wb ON wb.id = de.bill_id
      WHERE wb.user_id = $1 AND de.entry_date BETWEEN $2 AND $3
      GROUP BY DATE_TRUNC('month', de.entry_date)
      ORDER BY month
    `;
    return await DatabaseService.query(sql, [userId, startDate, endDate]);
  }
  static async getQuarterlyTotals(userId, startDate, endDate) {
    const sql = `
      SELECT EXTRACT(QUARTER FROM de.entry_date) AS quarter, SUM(ei.amount) AS total
      FROM entry_items ei
      JOIN daily_entries de ON ei.daily_entry_id = de.id
      JOIN work_bills wb ON wb.id = de.bill_id
      WHERE wb.user_id = $1 AND de.entry_date BETWEEN $2 AND $3
      GROUP BY EXTRACT(QUARTER FROM de.entry_date)
      ORDER BY quarter
    `;
    return await DatabaseService.query(sql, [userId, startDate, endDate]);
  }
  static async getDetailedMonthly(userId, startDate, endDate) {
    const sql = `
      SELECT DATE_TRUNC('month', de.entry_date) AS month, ei.category, SUM(ei.amount) AS amount
      FROM entry_items ei
      JOIN daily_entries de ON ei.daily_entry_id = de.id
      JOIN work_bills wb ON wb.id = de.bill_id
      WHERE wb.user_id = $1 AND de.entry_date BETWEEN $2 AND $3
      GROUP BY DATE_TRUNC('month', de.entry_date), ei.category
      ORDER BY month, ei.category
    `;
    return await DatabaseService.query(sql, [userId, startDate, endDate]);
  }

  // ---- Report Generator: Weekly (NO income, just compare expenses) ----
static async generateWeeklyReport(userId, weekValue) {
  // Parse week boundaries
  const weekDate = new Date(weekValue);
  const weekStart = new Date(weekDate);
  weekStart.setDate(weekDate.getDate() - weekDate.getDay());
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 6);

  // Previous week boundaries
  const prevWeekStart = new Date(weekStart);
  prevWeekStart.setDate(weekStart.getDate() - 7);
  const prevWeekEnd = new Date(prevWeekStart);
  prevWeekEnd.setDate(prevWeekStart.getDate() + 6);

  // Fetch all breakdowns and totals
  const [
    currCategories,
    currDaily,
    currDetailedDaily,
    prevCategories,
    prevDaily,
    prevExpenseSum
  ] = await Promise.all([
    this.getCategoryTotals(userId, weekStart, weekEnd),
    this.getDailyTotals(userId, weekStart, weekEnd),
    this.getDetailedDaily(userId, weekStart, weekEnd),
    this.getCategoryTotals(userId, prevWeekStart, prevWeekEnd),
    this.getDailyTotals(userId, prevWeekStart, prevWeekEnd),
    DatabaseService.sum(
      'entry_items ei JOIN daily_entries de ON ei.daily_entry_id = de.id JOIN work_bills wb ON wb.id = de.bill_id',
      'ei.amount',
      'WHERE wb.user_id = $1 AND de.entry_date BETWEEN $2 AND $3',
      [userId, prevWeekStart, prevWeekEnd]
    )
  ]);

  // Calculate this week's expense
  const totalExpense = currCategories.reduce((sum, cat) => sum + this.formatCurrency(cat.amount), 0);
  const previousWeekExpense = this.formatCurrency(prevExpenseSum);

  // Calculate "weekly savings" and "weekly savings rate" (previous - current)
  const weeklySavings = previousWeekExpense - totalExpense;
  const weeklySavingsRate = previousWeekExpense > 0 
    ? (weeklySavings / previousWeekExpense) * 100
    : null; // null if no historic expense

  return {
    type: 'weekly',
    week: {
      weekStart: weekStart.toISOString(),
      weekEnd: weekEnd.toISOString(),
      label: `Week of ${format(weekStart, 'MMM d, yyyy')}`,
      days: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
    },
    totalExpense: totalExpense,
    weeklySavings,
    weeklySavingsRate,
    category: currCategories.map(row => ({
      category: row.category,
      amount: this.formatCurrency(row.amount)
    })),
    daily: currDaily.map(row => ({
      date: row.date,
      total: this.formatCurrency(row.total)
    })),
    detailed_daily: currDetailedDaily.map(row => ({
      date: row.date,
      category: row.category,
      amount: this.formatCurrency(row.amount)
    })),
    previousWeek: {
      weekStart: prevWeekStart.toISOString(),
      weekEnd: prevWeekEnd.toISOString(),
      totalExpense: previousWeekExpense,
      category: prevCategories.map(row => ({
        category: row.category,
        amount: this.formatCurrency(row.amount)
      })),
      daily: prevDaily.map(row => ({
        date: row.date,
        total: this.formatCurrency(row.total)
      }))
    },
    fromCache: false
  };
}


static async getAvailableWeeks(userId) {
  const sql = `
    SELECT DISTINCT 
      DATE_TRUNC('week', de.entry_date) as week_start,
      DATE_TRUNC('week', de.entry_date) + INTERVAL '6 days' as week_end,
      COUNT(DISTINCT de.id) as entry_count,
      SUM(ei.amount) as total_amount
    FROM entry_items ei
    JOIN daily_entries de ON ei.daily_entry_id = de.id
    JOIN work_bills wb ON wb.id = de.bill_id
    WHERE wb.user_id = $1
    GROUP BY DATE_TRUNC('week', de.entry_date)
    ORDER BY week_start DESC
    LIMIT 12
  `;
  const weeks = await DatabaseService.query(sql, [userId]);
  return weeks.map(row => {
    const weekStart = new Date(row.week_start);
    return {
      label: `Week of ${format(weekStart, 'MMM d, yyyy')}`,
      value: format(weekStart, 'yyyy-MM-dd'),
      weekStart: row.week_start,
      weekEnd: row.week_end,
      entryCount: parseInt(row.entry_count),
      totalAmount: this.formatCurrency(row.total_amount)
    };
  });
}

  // ---- Report Generator: Monthly ----
  static async generateMonthlyReport(userId, date) {
    const parsed = this.validateDateParam(date);
    const start = startOfMonth(parsed);
    const end = endOfMonth(parsed);
    const prevStart = startOfMonth(subMonths(parsed, 1));
    const prevEnd = endOfMonth(subMonths(parsed, 1));
    const billMonth = format(start, 'yyyy-MM');
    const prevBillMonth = format(prevStart, 'yyyy-MM');
    const [
      currCategories,
      currIncome,
      prevIncome,
      prevExpense,
      currDaily,
      prevCategories,
      currDetailedDaily
    ] = await Promise.all([
      this.getCategoryTotals(userId, start, end),
      this.getUserBillForMonth(userId, billMonth),
      this.getUserBillForMonth(userId, prevBillMonth),
      DatabaseService.sum('entry_items ei JOIN daily_entries de ON ei.daily_entry_id = de.id JOIN work_bills wb ON wb.id = de.bill_id', 'ei.amount', 'WHERE wb.user_id = $1 AND de.entry_date BETWEEN $2 AND $3', [userId, prevStart, prevEnd]),
      this.getDailyTotals(userId, start, end),
      this.getCategoryTotals(userId, prevStart, prevEnd),
      this.getDetailedDaily(userId, start, end)
    ]);
    const totalIncome = this.formatCurrency(currIncome?.total_balance);
    const totalExpense = currCategories.reduce((sum, cat) => sum + this.formatCurrency(cat.amount), 0);
    const previousIncome = this.formatCurrency(prevIncome?.total_balance);
    const previousExpense = this.formatCurrency(prevExpense);
    const currentSavings = this.calculateSavings(totalIncome, totalExpense);
    const previousSavings = this.calculateSavings(previousIncome, previousExpense);
    return {
      type: 'monthly',
      month: {
        year: start.getFullYear(),
        month: start.getMonth() + 1,
        label: format(start, 'MMMM yyyy'),
        monthStart: start,
        monthEnd: end
      },
      billMonth,
      totalIncome,
      totalExpense,
      savings: currentSavings.savings,
      savingsRate: currentSavings.savingsRate,
      category: currCategories,
      daily: currDaily,
      detailed_daily: currDetailedDaily,
      previousMonth: {
        totalIncome: previousIncome,
        totalExpense: previousExpense,
        savings: previousSavings.savings,
        savingsRate: previousSavings.savingsRate,
        category: prevCategories
      }
    };
  }

  // ---- Report Generator: Quarterly ----
  static async generateQuarterlyReport(userId, date) {
    const parsedDate = this.validateDateParam(date);
    const start = startOfQuarter(parsedDate);
    const end = endOfQuarter(parsedDate);
    const prevStart = startOfQuarter(subQuarters(parsedDate, 1));
    const prevEnd = endOfQuarter(subQuarters(parsedDate, 1));
    const getQuarterInfo = (d) => {
      const y = d.getFullYear();
      const q = Math.floor(d.getMonth() / 3) + 1;
      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      return { year: y, quarter: q, label: `Q${q} ${y}`, months: months.slice((q - 1) * 3, q * 3) };
    };
    const startMonth = format(start, 'yyyy-MM');
    const endMonth = format(end, 'yyyy-MM');
    const prevStartMonth = format(prevStart, 'yyyy-MM');
    const prevEndMonth = format(prevEnd, 'yyyy-MM');
    const [
      catCurr,
      incomeCurr,
      incomePrev,
      expensePrev,
      dailyCurr,
      catPrev,
      detailedCurr
    ] = await Promise.all([
      this.getCategoryTotals(userId, start, end),
      DatabaseService.sum('work_bills', 'total_balance', 'WHERE user_id = $1 AND bill_month BETWEEN $2 AND $3', [userId, startMonth, endMonth]),
      DatabaseService.sum('work_bills', 'total_balance', 'WHERE user_id = $1 AND bill_month BETWEEN $2 AND $3', [userId, prevStartMonth, prevEndMonth]),
      DatabaseService.sum('entry_items ei JOIN daily_entries de ON ei.daily_entry_id = de.id JOIN work_bills wb ON wb.id = de.bill_id', 'ei.amount', 'WHERE wb.user_id = $1 AND de.entry_date BETWEEN $2 AND $3', [userId, prevStart, prevEnd]),
      this.getDailyTotals(userId, start, end),
      this.getCategoryTotals(userId, prevStart, prevEnd),
      this.getDetailedDaily(userId, start, end)
    ]);
    const totalIncome = this.formatCurrency(incomeCurr);
    const totalExpense = catCurr.reduce((sum, cat) => sum + this.formatCurrency(cat.amount), 0);
    const previousIncome = this.formatCurrency(incomePrev);
    const previousExpense = this.formatCurrency(expensePrev);
    const currentSavings = this.calculateSavings(totalIncome, totalExpense);
    const previousSavings = this.calculateSavings(previousIncome, previousExpense);
    return {
      type: 'quarterly',
      quarter: getQuarterInfo(parsedDate),
      totalIncome,
      totalExpense,
      savings: currentSavings.savings,
      savingsRate: currentSavings.savingsRate,
      category: catCurr,
      daily: dailyCurr,
      detailed_daily: detailedCurr,
      previousQuarter: {
        totalIncome: previousIncome,
        totalExpense: previousExpense,
        savings: previousSavings.savings,
        savingsRate: previousSavings.savingsRate,
        category: catPrev
      }
    };
  }
static async getDetailedQuarterly(userId, startDate, endDate) {
    const sql = `
      SELECT
        EXTRACT(QUARTER FROM de.entry_date) AS quarter,
        ei.category,
        SUM(ei.amount) AS total
      FROM entry_items ei
      JOIN daily_entries de ON ei.daily_entry_id = de.id
      JOIN work_bills wb ON wb.id = de.bill_id
      WHERE wb.user_id = $1 AND de.entry_date BETWEEN $2 AND $3
      GROUP BY quarter, ei.category
      ORDER BY quarter, ei.category
    `;
    return await DatabaseService.query(sql, [userId, startDate, endDate]);
  }
  // ---- Report Generator: Yearly ----
 static padQuarters(quarterlyArr) {
    const out = [];
    for (let q = 1; q <= 4; q++) {
      const item = quarterlyArr.find(x => Number(x.quarter) === q);
      out.push({ quarter: q, total: item ? Number(item.total) : 0 });
    }
    return out;
  }

  // ---- Yearly Report ----
  static async generateYearlyReport(userId, date) {
    const { parseISO, isValid, format, startOfYear, endOfYear, subYears } = require('date-fns');
    const parsedDate = this.validateDateParam(date);

    const start = startOfYear(parsedDate);
    const end = endOfYear(parsedDate);
    const prevStart = startOfYear(subYears(parsedDate, 1));
    const prevEnd = endOfYear(subYears(parsedDate, 1));
    const startMonth = format(start, 'yyyy-MM');
    const endMonth = format(end, 'yyyy-MM');
    const prevStartMonth = format(prevStart, 'yyyy-MM');
    const prevEndMonth = format(prevEnd, 'yyyy-MM');

    // Check if previous year data exists
    const prevDataExists = await DatabaseService.exists(`
      SELECT 1 FROM entry_items ei
      JOIN daily_entries de ON ei.daily_entry_id = de.id
      JOIN work_bills wb ON wb.id = de.bill_id
      WHERE wb.user_id = $1 AND de.entry_date BETWEEN $2 AND $3
      LIMIT 1
    `, [userId, prevStart, prevEnd]);

    const queries = [
      this.getCategoryTotals(userId, start, end),
      DatabaseService.sum('work_bills', 'total_balance', 'WHERE user_id = $1 AND bill_month BETWEEN $2 AND $3', [userId, startMonth, endMonth]),
      this.getMonthlyTotals(userId, start, end),
      this.getQuarterlyTotals(userId, start, end),
      this.getDailyTotals(userId, start, end),
      this.getDetailedMonthly(userId, start, end),
      this.getDetailedQuarterly(userId, start, end) // <--- NEW: Detailed per-quarter per-category
    ];

    if (prevDataExists) {
      queries.push(
        DatabaseService.sum('work_bills', 'total_balance', 'WHERE user_id = $1 AND bill_month BETWEEN $2 AND $3', [userId, prevStartMonth, prevEndMonth]),
        DatabaseService.sum('entry_items ei JOIN daily_entries de ON ei.daily_entry_id = de.id JOIN work_bills wb ON wb.id = de.bill_id', 'ei.amount', 'WHERE wb.user_id = $1 AND de.entry_date BETWEEN $2 AND $3', [userId, prevStart, prevEnd]),
        this.getCategoryTotals(userId, prevStart, prevEnd)
      );
    }

    const results = await Promise.all(queries);

    // Destructure—must add currDetailedQuarterly at the right index
    const [
      catCurr,
      incomeCurr,
      currMonthly,
      currQuarterlyRaw,
      currDaily,
      currDetailedMonthly,
      currDetailedQuarterly, // <--- your new detailed data
      ...rest // previous year data, if any
    ] = results;

    const currQuarterly = this.padQuarters(currQuarterlyRaw);
    const totalIncome = this.formatCurrency(incomeCurr);
    const totalExpense = catCurr.reduce((sum, cat) => sum + this.formatCurrency(cat.amount), 0);
    const currentSavings = this.calculateSavings(totalIncome, totalExpense);

    let response = {
      type: 'yearly',
      year: {
        year: start.getFullYear(),
        label: `${start.getFullYear()}`,
        months: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
        quarters: ['Q1', 'Q2', 'Q3', 'Q4']
      },
      totalIncome,
      totalExpense,
      savings: currentSavings.savings,
      savingsRate: currentSavings.savingsRate,
      hasPreviousYearData: prevDataExists,
      category: catCurr,
      monthly: currMonthly,
      quarterly: currQuarterly,
      daily: currDaily,
      detailed_monthly: currDetailedMonthly,
      detailed_quarterly: currDetailedQuarterly // <--- NEW property in API
    };

    if (prevDataExists && rest.length === 3) {
      const [prevIncome, prevExpense, prevCategories] = rest;
      const previousIncome = this.formatCurrency(prevIncome);
      const previousExpense = this.formatCurrency(prevExpense);
      const previousSavings = this.calculateSavings(previousIncome, previousExpense);
      response.previousYear = {
        year: prevStart.getFullYear(),
        totalIncome: previousIncome,
        totalExpense: previousExpense,
        savings: previousSavings.savings,
        savingsRate: previousSavings.savingsRate,
        category: prevCategories
      };
    }

    return response;
  }


  // ---- Available Periods (for UI filter dropdowns, etc.) ----
  static async getAvailableQuarters(userId) {
    const sql = `
      SELECT DISTINCT 
        EXTRACT(YEAR FROM de.entry_date) as year,
        EXTRACT(QUARTER FROM de.entry_date) as quarter,
        COUNT(DISTINCT de.id) as entry_count,
        SUM(ei.amount) as total_amount
      FROM entry_items ei
      JOIN daily_entries de ON ei.daily_entry_id = de.id
      JOIN work_bills wb ON wb.id = de.bill_id
      WHERE wb.user_id = $1
      GROUP BY EXTRACT(YEAR FROM de.entry_date), EXTRACT(QUARTER FROM de.entry_date)
      ORDER BY year DESC, quarter DESC
    `;
    const quarters = await DatabaseService.query(sql, [userId]);
    return quarters.map(row => ({
      year: parseInt(row.year),
      quarter: parseInt(row.quarter),
      label: `Q${row.quarter} ${row.year}`,
      value: `${row.year}-Q${row.quarter}`,
      entryCount: parseInt(row.entry_count),
      totalAmount: this.formatCurrency(row.total_amount)
    }));
  }
  static async getAvailableYears(userId) {
    const sql = `
      SELECT DISTINCT 
        EXTRACT(YEAR FROM de.entry_date) as year,
        COUNT(DISTINCT de.id) as entry_count,
        SUM(ei.amount) as total_amount
      FROM entry_items ei
      JOIN daily_entries de ON ei.daily_entry_id = de.id
      JOIN work_bills wb ON wb.id = de.bill_id
      WHERE wb.user_id = $1
      GROUP BY EXTRACT(YEAR FROM de.entry_date)
      ORDER BY year DESC
    `;
    const years = await DatabaseService.query(sql, [userId]);
    return years.map(row => ({
      year: parseInt(row.year),
      label: `${row.year}`,
      value: `${row.year}`,
      entryCount: parseInt(row.entry_count),
      totalAmount: this.formatCurrency(row.total_amount)
    }));
  }
  static async getAvailableMonths(userId) {
    const sql = `
      SELECT DISTINCT 
        DATE_TRUNC('month', de.entry_date) as month_start,
        COUNT(DISTINCT de.id) as entry_count,
        SUM(ei.amount) as total_amount
      FROM entry_items ei
      JOIN daily_entries de ON ei.daily_entry_id = de.id
      JOIN work_bills wb ON wb.id = de.bill_id
      WHERE wb.user_id = $1
      GROUP BY DATE_TRUNC('month', de.entry_date)
      ORDER BY month_start DESC
      LIMIT 24
    `;
    const months = await DatabaseService.query(sql, [userId]);
    return months.map(row => ({
      label: format(new Date(row.month_start), 'MMMM yyyy'),
      value: format(new Date(row.month_start), 'yyyy-MM'),
      monthStart: row.month_start,
      entryCount: parseInt(row.entry_count),
      totalAmount: this.formatCurrency(row.total_amount)
    }));
  }

  // For frontends that use weeks dropdowns, add implementation similar to above if needed
}

module.exports = ReportService;
