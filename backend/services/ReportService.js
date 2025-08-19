const DatabaseService = require('./DatabaseService');
const { createError } = require('../middleware/errorHandler');
const { 
  parseISO, isValid, format, startOfMonth, endOfMonth,
  startOfQuarter, endOfQuarter, startOfYear, endOfYear,
  subMonths, subQuarters, subYears
} = require('date-fns');

class ReportService {
  // ===== FIXED UTILITY METHODS =====
  static validateDateParam(date) {
    if (!date) throw createError(400, 'Missing required parameter: date');

    console.log('🔧 validateDateParam input:', date);

    // Handle YYYY-Q# format (e.g., "2025-Q3")
    const quarterMatch = date.match(/^(\d{4})-Q([1-4])$/);
    if (quarterMatch) {
      const year = quarterMatch[1];
      const quarter = parseInt(quarterMatch[2], 10);
      const monthMap = { 1: '01', 2: '04', 3: '07', 4: '10' };
      date = `${year}-${monthMap[quarter]}-01`;
      console.log('🔧 Converted YYYY-Q# to:', date);
    }
    // Handle YYYY-MM format
    else if (/^\d{4}-\d{2}$/.test(date)) {
      date = `${date}-01`;
      console.log('🔧 Converted YYYY-MM to:', date);
    }
    // Handle YYYY only
    else if (/^\d{4}$/.test(date)) {
      date = `${date}-01-01`;
      console.log('🔧 Converted YYYY to:', date);
    }

    const parsed = parseISO(date);
    if (!isValid(parsed)) {
      throw createError(400, 'Invalid date format. Expected YYYY-MM-DD');
    }
    
    console.log('🔧 Final parsed date:', parsed.toISOString());
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
  static async getUserBillForMonth(userId, billMonth) {
    const sql = `SELECT total_balance FROM work_bills WHERE user_id = $1 AND bill_month = $2 LIMIT 1`;
    const result = await DatabaseService.findOne(sql, [userId, billMonth]);
    return result ? this.formatCurrency(result.total_balance) : 0;
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

  // ===== REPORT GENERATORS =====
  static async generateWeeklyReport(userId, weekValue) {
    const weekDate = new Date(weekValue);
    const weekStart = new Date(weekDate);
    weekStart.setDate(weekDate.getDate() - weekDate.getDay());
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 6);

    const prevWeekStart = new Date(weekStart);
    prevWeekStart.setDate(weekStart.getDate() - 7);
    const prevWeekEnd = new Date(prevWeekStart);
    prevWeekEnd.setDate(prevWeekStart.getDate() + 6);

    const [
      currCategories,
      currDaily,
      currDetailedDaily,
      prevCategories,
      prevDaily
    ] = await Promise.all([
      this.getCategoryTotals(userId, weekStart, weekEnd),
      this.getDailyTotals(userId, weekStart, weekEnd),
      this.getDetailedDaily(userId, weekStart, weekEnd),
      this.getCategoryTotals(userId, prevWeekStart, prevWeekEnd),
      this.getDailyTotals(userId, prevWeekStart, prevWeekEnd)
    ]);

    return {
      type: 'weekly',
      daily: currDaily,
      detailed_daily: currDetailedDaily,
      category: currCategories,
      totalExpense: currCategories.reduce((s, c) => s + c.amount, 0),
      previousWeek: {
        category: prevCategories,
        daily: prevDaily,
        totalExpense: prevCategories.reduce((s, c) => s + c.amount, 0)
      }
    };
  }

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
      prevDetailedDaily
    ] = await Promise.all([
      this.getCategoryTotals(userId, start, end),
      this.getUserBillForMonth(userId, format(start, 'yyyy-MM')),
      this.getUserBillForMonth(userId, format(prevStart, 'yyyy-MM')),
      this.getDailyTotals(userId, start, end),
      this.getCategoryTotals(userId, prevStart, prevEnd),
      this.getDetailedDaily(userId, start, end),
      this.getDailyTotals(userId, prevStart, prevEnd),
      this.getDetailedDaily(userId, prevStart, prevEnd)
    ]);

    const currentExpense = currCategories.reduce((s,c) => s + c.amount, 0);
    const previousExpense = prevCategories.reduce((s,c) => s + c.amount, 0);

    return {
      type: 'monthly',
      month: {
        year: start.getFullYear(),
        month: start.getMonth() + 1,
        label: format(start, 'MMMM yyyy')
      },
      totalIncome: currIncome,
      totalExpense: currentExpense,
      daily: currDaily,
      detailed_daily: currDetailedDaily,
      category: currCategories,
      previousMonth: {
        totalIncome: prevIncome,
        totalExpense: previousExpense,
        category: prevCategories,
        daily: prevDaily,
        detailed_daily: prevDetailedDaily
      }
    };
  }

  // ===== FIXED QUARTERLY REPORT WITH DEBUG LOGGING =====
  static async generateQuarterlyReport(userId, date) {
    console.log('🏁 ReportService.generateQuarterlyReport CALLED');
    console.log('   userId:', userId);
    console.log('   date:', date);

    const parsedDate = this.validateDateParam(date);
    const start = startOfQuarter(parsedDate);
    const end = endOfQuarter(parsedDate);
    const prevStart = startOfQuarter(subQuarters(parsedDate, 1));
    const prevEnd = endOfQuarter(subQuarters(parsedDate, 1));

    // Enhanced debug logging
    console.log('🔍 DETAILED DATE BREAKDOWN:');
    console.log('   Original input:', date);
    console.log('   After validateDateParam:', parsedDate.toISOString());
    console.log('   startOfQuarter(parsedDate):', startOfQuarter(parsedDate).toISOString());
    console.log('   endOfQuarter(parsedDate):', endOfQuarter(parsedDate).toISOString());
    console.log('   subQuarters(parsedDate, 1):', subQuarters(parsedDate, 1).toISOString());
    console.log('   startOfQuarter(subQuarters(parsedDate, 1)):', startOfQuarter(subQuarters(parsedDate, 1)).toISOString());
    console.log('   endOfQuarter(subQuarters(parsedDate, 1)):', endOfQuarter(subQuarters(parsedDate, 1)).toISOString());

    console.log('🔍 QUARTERLY REPORT DEBUG:');
    console.log('📅 Current Quarter:', format(start, 'yyyy-MM-dd'), 'to', format(end, 'yyyy-MM-dd'));
    console.log('📅 Previous Quarter:', format(prevStart, 'yyyy-MM-dd'), 'to', format(prevEnd, 'yyyy-MM-dd'));

    const startMonth = format(start, 'yyyy-MM');
    const endMonth = format(end, 'yyyy-MM');
    const prevStartMonth = format(prevStart, 'yyyy-MM');
    const prevEndMonth = format(prevEnd, 'yyyy-MM');

    console.log('💰 Income Query Ranges:');
    console.log('   Current:', startMonth, 'to', endMonth);
    console.log('   Previous:', prevStartMonth, 'to', prevEndMonth);

    // Test the exact query before running the full report
    const currentTest = await DatabaseService.query(`
      SELECT COUNT(*) as count, COALESCE(SUM(ei.amount), 0) as total
      FROM entry_items ei
      JOIN daily_entries de ON ei.daily_entry_id = de.id
      JOIN work_bills wb ON wb.id = de.bill_id
      WHERE wb.user_id = $1 AND de.entry_date BETWEEN $2 AND $3
    `, [userId, start, end]);

    const previousTest = await DatabaseService.query(`
      SELECT COUNT(*) as count, COALESCE(SUM(ei.amount), 0) as total
      FROM entry_items ei
      JOIN daily_entries de ON ei.daily_entry_id = de.id
      JOIN work_bills wb ON wb.id = de.bill_id
      WHERE wb.user_id = $1 AND de.entry_date BETWEEN $2 AND $3
    `, [userId, prevStart, prevEnd]);

    console.log('💾 CURRENT quarter test:', currentTest[0]);
    console.log('💾 PREVIOUS quarter test:', previousTest[0]);

    const [
      catCurr,
      incomeCurr,
      incomePrev,
      dailyCurr,
      catPrev,
      detailedCurr,
      prevDaily,
      prevDetailedDaily
    ] = await Promise.all([
      this.getCategoryTotals(userId, start, end),
      DatabaseService.sum('work_bills', 'total_balance', 'WHERE user_id = $1 AND bill_month BETWEEN $2 AND $3', [userId, startMonth, endMonth]),
      DatabaseService.sum('work_bills', 'total_balance', 'WHERE user_id = $1 AND bill_month BETWEEN $2 AND $3', [userId, prevStartMonth, prevEndMonth]),
      this.getDailyTotals(userId, start, end),
      this.getCategoryTotals(userId, prevStart, prevEnd),
      this.getDetailedDaily(userId, start, end),
      this.getDailyTotals(userId, prevStart, prevEnd),
      this.getDetailedDaily(userId, prevStart, prevEnd)
    ]);

    const currentExpense = catCurr.reduce((s,c) => s + c.amount, 0);
    const previousExpense = catPrev.reduce((s,c) => s + c.amount, 0);

    console.log('📊 Query Results:');
    console.log('   Current Income:', incomeCurr);
    console.log('   Previous Income:', incomePrev);
    console.log('   Current Expense:', currentExpense);
    console.log('   Previous Expense:', previousExpense);
    console.log('   Current Categories:', catCurr.length);
    console.log('   Previous Categories:', catPrev.length);

    const result = {
      type: 'quarterly',
      quarter: {
        year: start.getFullYear(),
        quarter: Math.ceil((start.getMonth() + 1) / 3),
        label: `Q${Math.ceil((start.getMonth() + 1) / 3)} ${start.getFullYear()}`,
        months: [
          format(start, 'MMM'),
          format(new Date(start.getFullYear(), start.getMonth() + 1), 'MMM'),
          format(new Date(start.getFullYear(), start.getMonth() + 2), 'MMM')
        ]
      },
      totalIncome: this.formatCurrency(incomeCurr),
      totalExpense: currentExpense,
      daily: dailyCurr,
      detailed_daily: detailedCurr,
      category: catCurr,
      previousQuarter: {
        totalIncome: this.formatCurrency(incomePrev),
        totalExpense: previousExpense,
        category: catPrev,
        daily: prevDaily,
        detailed_daily: prevDetailedDaily
      }
    };

    console.log('🏁 ReportService.generateQuarterlyReport RETURNING:', {
      type: result.type,
      totalExpense: result.totalExpense,
      previousQuarter: result.previousQuarter ? 'Present' : 'Missing',
      previousQuarterExpense: result.previousQuarter?.totalExpense
    });

    return result;
  }

  static async generateYearlyReport(userId, date) {
    const parsedDate = this.validateDateParam(date);
    const start = startOfYear(parsedDate);
    const end = endOfYear(parsedDate);
    const prevStart = startOfYear(subYears(parsedDate, 1));
    const prevEnd = endOfYear(subYears(parsedDate, 1));

    const prevDataExists = await DatabaseService.exists(`
      SELECT 1 FROM entry_items ei
      JOIN daily_entries de ON ei.daily_entry_id = de.id
      JOIN work_bills wb ON wb.id = de.bill_id
      WHERE wb.user_id = $1 AND de.entry_date BETWEEN $2 AND $3
      LIMIT 1
    `, [userId, prevStart, prevEnd]);

    const queries = [
      this.getCategoryTotals(userId, start, end),
      DatabaseService.sum('work_bills','total_balance','WHERE user_id = $1 AND bill_month BETWEEN $2 AND $3', [userId, format(start, 'yyyy-MM'), format(end, 'yyyy-MM')]),
      this.getMonthlyTotals(userId, start, end),
      this.getQuarterlyTotals(userId, start, end),
      this.getDetailedMonthly(userId, start, end)
    ];

    if (prevDataExists) {
      queries.push(
        DatabaseService.sum('work_bills','total_balance','WHERE user_id = $1 AND bill_month BETWEEN $2 AND $3', [userId, format(prevStart, 'yyyy-MM'), format(prevEnd, 'yyyy-MM')]),
        DatabaseService.sum('entry_items ei JOIN daily_entries de ON ei.daily_entry_id = de.id JOIN work_bills wb ON wb.id = de.bill_id', 'ei.amount','WHERE wb.user_id = $1 AND de.entry_date BETWEEN $2 AND $3', [userId, prevStart, prevEnd]),
        this.getCategoryTotals(userId, prevStart, prevEnd),
        this.getMonthlyTotals(userId, prevStart, prevEnd),
        this.getDetailedMonthly(userId, prevStart, prevEnd)
      );
    }

    const results = await Promise.all(queries);
    const [catCurr, incomeCurr, currMonthly, currQuarterly, currDetailedMonthly, ...rest] = results;

    const totalIncome = this.formatCurrency(incomeCurr);
    const totalExpense = catCurr.reduce((sum, cat) => sum + cat.amount, 0);
    const currentSavings = this.calculateSavings(totalIncome, totalExpense);

    const response = {
      type: 'yearly',
      year: {
        year: start.getFullYear(),
        label: `${start.getFullYear()}`,
        months: ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'],
        quarters: ['Q1','Q2','Q3','Q4']
      },
      totalIncome,
      totalExpense,
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
      const previousIncome = this.formatCurrency(prevIncome);
      const previousExpense = this.formatCurrency(prevExpense);
      const previousSavings = this.calculateSavings(previousIncome, previousExpense);
      response.previousYear = {
        year: prevStart.getFullYear(),
        totalIncome: previousIncome,
        totalExpense: previousExpense,
        savings: previousSavings.savings,
        savingsRate: previousSavings.savingsRate,
        category: prevCategories,
        monthly: prevMonthly,
        detailed_monthly: prevDetailedMonthly
      };
    }

    return response;
  }

  // ===== AVAILABLE DATA METHODS =====
  static async getAvailableQuarters(userId) {
    console.log('📅 getAvailableQuarters called for user:', userId);
    
    const sql = `
      SELECT DISTINCT
        EXTRACT(YEAR FROM de.entry_date) AS year,
        EXTRACT(QUARTER FROM de.entry_date) AS quarter,
        COUNT(*) as entry_count,
        SUM(ei.amount) as total_amount
      FROM daily_entries de
      JOIN entry_items ei ON ei.daily_entry_id = de.id
      JOIN work_bills wb ON wb.id = de.bill_id
      WHERE wb.user_id = $1
      GROUP BY EXTRACT(YEAR FROM de.entry_date), EXTRACT(QUARTER FROM de.entry_date)
      ORDER BY year DESC, quarter DESC
    `;
    
    const rows = await DatabaseService.query(sql, [userId]);
    console.log('📅 Raw quarters from DB:', rows);
    
    const quarters = rows.map(r => ({
      year: Number(r.year),
      quarter: Number(r.quarter),
      label: `Q${r.quarter} ${r.year}`,
      value: `${r.year}-${String((r.quarter - 1) * 3 + 1).padStart(2, '0')}-01`,
      entryCount: Number(r.entry_count),
      totalAmount: this.formatCurrency(r.total_amount)
    }));
    
    console.log('📅 Processed quarters:', quarters);
    return quarters;
  }

  static async getAvailableYears(userId) {
    const sql = `
      SELECT DISTINCT
        EXTRACT(YEAR FROM de.entry_date) AS year,
        COUNT(*) as entry_count,
        SUM(ei.amount) as total_amount
      FROM daily_entries de
      JOIN entry_items ei ON ei.daily_entry_id = de.id
      JOIN work_bills wb ON wb.id = de.bill_id
      WHERE wb.user_id = $1
      GROUP BY EXTRACT(YEAR FROM de.entry_date)
      ORDER BY year DESC
    `;
    const rows = await DatabaseService.query(sql, [userId]);
    return rows.map(r => ({
      year: Number(r.year),
      label: `${r.year}`,
      value: `${r.year}-01-01`,
      entryCount: Number(r.entry_count),
      totalAmount: this.formatCurrency(r.total_amount)
    }));
  }
}

module.exports = ReportService;
