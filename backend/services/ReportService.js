const DatabaseService = require('./DatabaseService');
const { createError } = require('../middleware/errorHandler');
const { 
  parseISO, isValid, format, startOfMonth, endOfMonth,
  startOfQuarter, endOfQuarter, startOfYear, endOfYear,
  subMonths, subQuarters, subYears,subWeeks,
  startOfWeek, endOfWeek
} = require('date-fns');

class ReportService {
  // ===== UTILITY =====
  static validateDateParam(date) {
    if (!date) throw createError(400, 'Missing required parameter: date');

    const quarterMatch = date.match(/^(\d{4})-Q([1-4])$/);
    if (quarterMatch) {
      const year = quarterMatch[1];
      const quarter = parseInt(quarterMatch[2], 10);
      const monthMap = { 1: '01', 2: '04', 3: '07', 4: '10' };
      date = `${year}-${monthMap[quarter]}-01`;
    } else if (/^\d{4}-\d{2}$/.test(date)) {
      date = `${date}-01`;
    } else if (/^\d{4}$/.test(date)) {
      date = `${date}-01-01`;
    }

    const parsed = parseISO(date);
    if (!isValid(parsed)) throw createError(400, 'Invalid date format. Expected YYYY-MM-DD');
    return parsed;
  }

  static formatCurrency(amount) {
    return Number(parseFloat(amount || 0).toFixed(2));
  }

  static calculateSavings(income, expense) {
    const savings = income - expense;
    const savingsRate = income > 0 ? (savings / income) * 100 : 0;
    return { savings: this.formatCurrency(savings), savingsRate: Math.round(savingsRate) };
  }

  // ===== DATA FETCHERS =====
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
    const rows = await DatabaseService.query(sql, [userId, startDate, endDate]);
    return rows.map(r => ({ category: r.category, amount: this.formatCurrency(r.amount) }));
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
    const rows = await DatabaseService.query(sql, [userId, startDate, endDate]);
    return rows.map(r => ({ date: r.date, total: this.formatCurrency(r.total) }));
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
    const rows = await DatabaseService.query(sql, [userId, startDate, endDate]);
    return rows.map(r => ({ date: r.date, category: r.category, amount: this.formatCurrency(r.amount) }));
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
    const rows = await DatabaseService.query(sql, [userId, startDate, endDate]);
    return rows.map(r => ({ month: format(r.month, 'yyyy-MM'), total: this.formatCurrency(r.total) }));
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
    const rows = await DatabaseService.query(sql, [userId, startDate, endDate]);
    return rows.map(r => ({ month: format(r.month, 'yyyy-MM'), category: r.category, amount: this.formatCurrency(r.amount) }));
  }

  static async getQuarterlyTotals(userId, startDate, endDate) {
    const sql = `
      SELECT DATE_TRUNC('quarter', de.entry_date) AS quarter, SUM(ei.amount) AS total
      FROM entry_items ei
      JOIN daily_entries de ON ei.daily_entry_id = de.id
      JOIN work_bills wb ON wb.id = de.bill_id
      WHERE wb.user_id = $1 AND de.entry_date BETWEEN $2 AND $3
      GROUP BY DATE_TRUNC('quarter', de.entry_date)
      ORDER BY quarter
    `;
    const rows = await DatabaseService.query(sql, [userId, startDate, endDate]);
    return rows.map(r => ({ 
      quarter: `Q${Math.ceil((r.quarter.getMonth() + 1) / 3)} ${r.quarter.getFullYear()}`, 
      total: this.formatCurrency(r.total) 
    }));
  }

  static async getWeeklyTotals(userId, startDate, endDate) {
    const sql = `
      SELECT DATE_TRUNC('week', de.entry_date) AS week, SUM(ei.amount) AS total
      FROM entry_items ei
      JOIN daily_entries de ON ei.daily_entry_id = de.id
      JOIN work_bills wb ON wb.id = de.bill_id
      WHERE wb.user_id = $1 AND de.entry_date BETWEEN $2 AND $3
      GROUP BY DATE_TRUNC('week', de.entry_date)
      ORDER BY week
    `;
    const rows = await DatabaseService.query(sql, [userId, startDate, endDate]);
    return rows.map(r => ({ week: format(r.week, 'yyyy-MM-dd'), total: this.formatCurrency(r.total) }));
  }

  // ===== REPORT GENERATORS =====
  static async generateMonthlyReport(userId, date) {
    const parsed = this.validateDateParam(date);
    const start = startOfMonth(parsed);
    const end = endOfMonth(parsed);
    const prevStart = startOfMonth(subMonths(parsed, 1));
    const prevEnd = endOfMonth(subMonths(parsed, 1));

    const [
      currCategories,
      currIncome,
      prevIncome,
      currDaily,
      prevCategories,
      currDetailedDaily,
      prevDaily,
      prevDetailedDaily,
      currExpense,
      prevExpense
    ] = await Promise.all([
      this.getCategoryTotals(userId, start, end),
      DatabaseService.sum('work_bills','total_balance','WHERE user_id = $1 AND bill_month = $2', [userId, format(start,'yyyy-MM')]),
      DatabaseService.sum('work_bills','total_balance','WHERE user_id = $1 AND bill_month = $2', [userId, format(prevStart,'yyyy-MM')]),
      this.getDailyTotals(userId, start, end),
      this.getCategoryTotals(userId, prevStart, prevEnd),
      this.getDetailedDaily(userId, start, end),
      this.getDailyTotals(userId, prevStart, prevEnd),
      this.getDetailedDaily(userId, prevStart, prevEnd),
      DatabaseService.sum('entry_items ei JOIN daily_entries de ON ei.daily_entry_id = de.id JOIN work_bills wb ON wb.id = de.bill_id', 'ei.amount','WHERE wb.user_id = $1 AND de.entry_date BETWEEN $2 AND $3', [userId, start, end]),
      DatabaseService.sum('entry_items ei JOIN daily_entries de ON ei.daily_entry_id = de.id JOIN work_bills wb ON wb.id = de.bill_id', 'ei.amount','WHERE wb.user_id = $1 AND de.entry_date BETWEEN $2 AND $3', [userId, prevStart, prevEnd])
    ]);

    const currentSavings = this.calculateSavings(currIncome, currExpense);
    const previousSavings = this.calculateSavings(prevIncome, prevExpense);

    return {
      type: 'monthly',
      month: { year: start.getFullYear(), month: start.getMonth() + 1, label: format(start,'MMMM yyyy') },
      totalIncome: this.formatCurrency(currIncome),
      totalExpense: this.formatCurrency(currExpense),
      savings: currentSavings.savings,
      savingsRate: currentSavings.savingsRate,
      daily: currDaily,
      detailed_daily: currDetailedDaily,
      category: currCategories,
      previousMonth: {
        totalIncome: this.formatCurrency(prevIncome),
        totalExpense: this.formatCurrency(prevExpense),
        savings: previousSavings.savings,
        savingsRate: previousSavings.savingsRate,
        category: prevCategories,
        daily: prevDaily,
        detailed_daily: prevDetailedDaily
      }
    };
  }

  static async generateQuarterlyReport(userId, date) {
    const parsed = this.validateDateParam(date);
    const start = startOfQuarter(parsed);
    const end = endOfQuarter(parsed);
    const prevStart = startOfQuarter(subQuarters(parsed,1));
    const prevEnd = endOfQuarter(subQuarters(parsed,1));

    const [currIncome, prevIncome, currExpense, prevExpense, currCategories, prevCategories] = await Promise.all([
      DatabaseService.sum('work_bills','total_balance','WHERE user_id = $1', [userId]),
      DatabaseService.sum('work_bills','total_balance','WHERE user_id = $1', [userId]),
      DatabaseService.sum('entry_items ei JOIN daily_entries de ON ei.daily_entry_id = de.id JOIN work_bills wb ON wb.id = de.bill_id','ei.amount','WHERE wb.user_id = $1 AND de.entry_date BETWEEN $2 AND $3',[userId,start,end]),
      DatabaseService.sum('entry_items ei JOIN daily_entries de ON ei.daily_entry_id = de.id JOIN work_bills wb ON wb.id = de.bill_id','ei.amount','WHERE wb.user_id = $1 AND de.entry_date BETWEEN $2 AND $3',[userId,prevStart,prevEnd]),
      this.getCategoryTotals(userId,start,end),
      this.getCategoryTotals(userId,prevStart,prevEnd)
    ]);

    const currentSavings = this.calculateSavings(currIncome, currExpense);
    const previousSavings = this.calculateSavings(prevIncome, prevExpense);

    return {
      type: 'quarterly',
      quarter: `Q${Math.ceil((start.getMonth()+1)/3)} ${start.getFullYear()}`,
      totalIncome: this.formatCurrency(currIncome),
      totalExpense: this.formatCurrency(currExpense),
      savings: currentSavings.savings,
      savingsRate: currentSavings.savingsRate,
      category: currCategories,
      previousQuarter: {
        totalIncome: this.formatCurrency(prevIncome),
        totalExpense: this.formatCurrency(prevExpense),
        savings: previousSavings.savings,
        savingsRate: previousSavings.savingsRate,
        category: prevCategories
      }
    };
  }

 static async generateWeeklyReport(userId, date) {
  // Parse the input date
  const parsed = this.validateDateParam(date);

  // Current week: Sunday → Saturday
  const start = startOfWeek(parsed);
  const end = endOfWeek(parsed);

  // Previous week: also Sunday → Saturday
  const prevStart = startOfWeek(subWeeks(parsed, 1));
  const prevEnd = endOfWeek(subWeeks(parsed, 1));

  // Fetch all necessary data in parallel
  const [
    currIncome,
    prevIncome,
    currExpense,
    prevExpense,
    currCategories,
    prevCategories,
    weeklyTotals
  ] = await Promise.all([
    // Total income in current week
    DatabaseService.sum(
      'work_bills',
      'total_balance',
      'WHERE user_id = $1',
      [userId]
    ),
    // Total income in previous week
    DatabaseService.sum(
      'work_bills',
      'total_balance',
      'WHERE user_id = $1',
      [userId]
    ),
    // Total expense in current week
    DatabaseService.sum(
      'entry_items ei JOIN daily_entries de ON ei.daily_entry_id = de.id JOIN work_bills wb ON wb.id = de.bill_id',
      'ei.amount',
      'WHERE wb.user_id = $1 AND de.entry_date BETWEEN $2 AND $3',
      [userId, start, end]
    ),
    // Total expense in previous week
    DatabaseService.sum(
      'entry_items ei JOIN daily_entries de ON ei.daily_entry_id = de.id JOIN work_bills wb ON wb.id = de.bill_id',
      'ei.amount',
      'WHERE wb.user_id = $1 AND de.entry_date BETWEEN $2 AND $3',
      [userId, prevStart, prevEnd]
    ),
    // Category breakdown current week
    this.getCategoryTotals(userId, start, end),
    // Category breakdown previous week
    this.getCategoryTotals(userId, prevStart, prevEnd),
    // Weekly totals for chart
    this.getWeeklyTotals(userId, start, end)
  ]);

  const currentSavings = this.calculateSavings(currIncome, currExpense);
  const previousSavings = this.calculateSavings(prevIncome, prevExpense);

  return {
    type: 'weekly',
    weekStart: format(start, 'yyyy-MM-dd'),
    weekEnd: format(end, 'yyyy-MM-dd'),
    totalIncome: this.formatCurrency(currIncome),
    totalExpense: this.formatCurrency(currExpense),
    savings: currentSavings.savings,
    savingsRate: currentSavings.savingsRate,
    category: currCategories,
    weeklyTotals,
    previousWeek: {
      totalIncome: this.formatCurrency(prevIncome),
      totalExpense: this.formatCurrency(prevExpense),
      savings: previousSavings.savings,
      savingsRate: previousSavings.savingsRate,
      category: prevCategories
    }
  };
}


  static async generateYearlyReport(userId, date) {
    const parsedDate = this.validateDateParam(date);
    const start = startOfYear(parsedDate);
    const end = endOfYear(parsedDate);
    const prevStart = startOfYear(subYears(parsedDate,1));
    const prevEnd = endOfYear(subYears(parsedDate,1));

    const prevDataExists = await DatabaseService.exists(`
      SELECT 1 FROM entry_items ei
      JOIN daily_entries de ON ei.daily_entry_id = de.id
      JOIN work_bills wb ON wb.id = de.bill_id
      WHERE wb.user_id = $1 AND de.entry_date BETWEEN $2 AND $3
      LIMIT 1
    `, [userId, prevStart, prevEnd]);

    const queries = [
      this.getCategoryTotals(userId, start, end),
      DatabaseService.sum('work_bills','total_balance','WHERE user_id = $1', [userId]),
      DatabaseService.sum('entry_items ei JOIN daily_entries de ON ei.daily_entry_id = de.id JOIN work_bills wb ON wb.id = de.bill_id','ei.amount','WHERE wb.user_id = $1 AND de.entry_date BETWEEN $2 AND $3',[userId,start,end]),
      this.getMonthlyTotals(userId, start, end),
      this.getQuarterlyTotals(userId, start, end),
      this.getDetailedMonthly(userId, start, end)
    ];

    if (prevDataExists) {
      queries.push(
        DatabaseService.sum('work_bills','total_balance','WHERE user_id = $1', [userId]),
        DatabaseService.sum('entry_items ei JOIN daily_entries de ON ei.daily_entry_id = de.id JOIN work_bills wb ON wb.id = de.bill_id','ei.amount','WHERE wb.user_id = $1 AND de.entry_date BETWEEN $2 AND $3',[userId,prevStart,prevEnd]),
        this.getCategoryTotals(userId, prevStart, prevEnd),
        this.getMonthlyTotals(userId, prevStart, prevEnd),
        this.getDetailedMonthly(userId, prevStart, prevEnd)
      );
    }

    const results = await Promise.all(queries);
    const [catCurr, incomeCurr, currExpense, currMonthly, currQuarterly, currDetailedMonthly, ...rest] = results;

    const currentSavings = this.calculateSavings(incomeCurr, currExpense);

    const response = {
      type: 'yearly',
      year: { year: start.getFullYear(), label: `${start.getFullYear()}`, months: ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'], quarters: ['Q1','Q2','Q3','Q4'] },
      totalIncome: this.formatCurrency(incomeCurr),
      totalExpense: this.formatCurrency(currExpense),
      savings: currentSavings.savings,
      savingsRate: currentSavings.savingsRate,
      hasPreviousYearData: prevDataExists,
      category: catCurr,
      monthly: currMonthly,
      quarterly: currQuarterly,
      detailed_monthly: currDetailedMonthly
    };

    if (prevDataExists && rest.length === 5) {
      const [prevIncome, prevExpense, prevCategories, prevMonthly, prevDetailedMonthly] = rest;
      const previousSavings = this.calculateSavings(prevIncome, prevExpense);
      response.previousYear = {
        year: prevStart.getFullYear(),
        totalIncome: this.formatCurrency(prevIncome),
        totalExpense: this.formatCurrency(prevExpense),
        savings: previousSavings.savings,
        savingsRate: previousSavings.savingsRate,
        category: prevCategories,
        monthly: prevMonthly,
        detailed_monthly: prevDetailedMonthly
      };
    }

    return response;
  }
  static async generateDailyReport(userId, date) {
  const parsed = this.validateDateParam(date);

  // Current day
  const start = parsed;
  const end = parsed;

  // Previous day
  const prevDate = subDays(parsed, 1);
  const prevStart = prevDate;
  const prevEnd = prevDate;

  // Fetch all data in parallel
  const [
    currIncome,
    prevIncome,
    currExpense,
    prevExpense,
    currCategories,
    prevCategories,
    currDaily,
    prevDaily,
    currDetailed,
    prevDetailed
  ] = await Promise.all([
    // Total income for the day (bills due today)
    DatabaseService.sum('work_bills', 'total_balance', 'WHERE user_id = $1 AND bill_month = $2', [userId, format(start, 'yyyy-MM')]),
    // Previous day income
    DatabaseService.sum('work_bills', 'total_balance', 'WHERE user_id = $1 AND bill_month = $2', [userId, format(prevStart, 'yyyy-MM')]),
    // Total expense for the day
    DatabaseService.sum(
      'entry_items ei JOIN daily_entries de ON ei.daily_entry_id = de.id JOIN work_bills wb ON wb.id = de.bill_id',
      'ei.amount',
      'WHERE wb.user_id = $1 AND de.entry_date = $2',
      [userId, start]
    ),
    // Previous day expense
    DatabaseService.sum(
      'entry_items ei JOIN daily_entries de ON ei.daily_entry_id = de.id JOIN work_bills wb ON wb.id = de.bill_id',
      'ei.amount',
      'WHERE wb.user_id = $1 AND de.entry_date = $2',
      [userId, prevStart]
    ),
    // Category breakdown current day
    this.getCategoryTotals(userId, start, end),
    // Category breakdown previous day
    this.getCategoryTotals(userId, prevStart, prevEnd),
    // Daily totals for chart (only one day here, but consistent format)
    this.getDailyTotals(userId, start, end),
    this.getDailyTotals(userId, prevStart, prevEnd),
    // Detailed daily breakdown
    this.getDetailedDaily(userId, start, end),
    this.getDetailedDaily(userId, prevStart, prevEnd)
  ]);

  const currentSavings = this.calculateSavings(currIncome, currExpense);
  const previousSavings = this.calculateSavings(prevIncome, prevExpense);

  return {
    type: 'daily',
    date: format(start, 'yyyy-MM-dd'),
    totalIncome: this.formatCurrency(currIncome),
    totalExpense: this.formatCurrency(currExpense),
    savings: currentSavings.savings,
    savingsRate: currentSavings.savingsRate,
    category: currCategories,
    dailyTotals: currDaily,
    detailedDaily: currDetailed,
    previousDay: {
      date: format(prevStart, 'yyyy-MM-dd'),
      totalIncome: this.formatCurrency(prevIncome),
      totalExpense: this.formatCurrency(prevExpense),
      savings: previousSavings.savings,
      savingsRate: previousSavings.savingsRate,
      category: prevCategories,
      dailyTotals: prevDaily,
      detailedDaily: prevDetailed
    }
  };
}

}

module.exports = ReportService;
