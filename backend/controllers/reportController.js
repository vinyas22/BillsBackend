const ReportService = require('../services/ReportService');
const { asyncHandler, createError } = require('../middleware/errorHandler');

class ReportController {
  // Weekly data
  static getWeeklyData = asyncHandler(async (req, res) => {
    const userId = req.user.userId;
    const { weekValue } = req.params;

    if (!weekValue) {
      throw createError(400, 'Missing required parameter: weekValue');
    }

    console.log(`📅 Controller: Loading weekly data for ${weekValue}, user: ${userId}`);

    const reportData = await ReportService.generateWeeklyReport(userId, weekValue);

    res.json({
      success: true,
      data: reportData,
      timestamp: new Date().toISOString()
    });
  });

  // Monthly report
  static getMonthlyReport = asyncHandler(async (req, res) => {
    const userId = req.user.userId;
    const { date } = req.query;

    const reportData = await ReportService.generateMonthlyReport(userId, date);

    res.json({
      success: true,
      data: reportData,
      timestamp: new Date().toISOString()
    });
  });

  // Quarterly report
  static getQuarterlyReport = asyncHandler(async (req, res) => {
    const userId = req.user.userId;
    const { date } = req.query;

    const reportData = await ReportService.generateQuarterlyReport(userId, date);

    res.json({
      success: true,
      data: reportData,
      timestamp: new Date().toISOString()
    });
  });

  // Yearly report
  static getYearlyReport = asyncHandler(async (req, res) => {
    const userId = req.user.userId;
    const { date } = req.query;

    const reportData = await ReportService.generateYearlyReport(userId, date);

    res.json({
      success: true,
      data: reportData,
      timestamp: new Date().toISOString()
    });
  });

  // Available quarters
  static getAvailableQuarters = asyncHandler(async (req, res) => {
    const userId = req.user.userId;
    const quarters = await ReportService.getAvailableQuarters(userId);

    res.json({
      success: true,
      data: { quarters },
      count: quarters.length
    });
  });

  // Available years
  static getAvailableYears = asyncHandler(async (req, res) => {
    const userId = req.user.userId;
    const years = await ReportService.getAvailableYears(userId);

    res.json({
      success: true,
      data: { years },
      count: years.length
    });
  });

  // Available months
  static getAvailableMonths = asyncHandler(async (req, res) => {
    const userId = req.user.userId;
    const months = await ReportService.getAvailableMonths(userId);

    res.json({
      success: true,
      data: { periods: months },
      count: months.length
    });
  });

  // Available weeks
  static getAvailableWeeks = asyncHandler(async (req, res) => {
    const userId = req.user.userId;
    const weeks = await ReportService.getAvailableWeeks(userId);

    res.json({
      success: true,
      data: { periods: weeks },
      count: weeks.length
    });
  });

  // Weekly by month report
  static getWeeklyByMonthReport = asyncHandler(async (req, res) => {
    const { billId, date } = req.params;
    
    if (!billId || !date) {
      throw createError(400, 'Missing required parameters: billId and date');
    }

    const reportData = await ReportService.generateWeeklyByMonthReport(
      parseInt(billId), 
      date
    );

    res.json({
      success: true,
      data: reportData,
      timestamp: new Date().toISOString()
    });
  });

  // Monthly data by period
  static getMonthlyData = asyncHandler(async (req, res) => {
    const userId = req.user.userId;
    const { monthValue } = req.params;

    if (!monthValue) {
      throw createError(400, 'Missing required parameter: monthValue');
    }

    // Convert monthValue (2024-07) to date format
    const [year, month] = monthValue.split('-');
    const date = `${year}-${month}-01`;
    
    const reportData = await ReportService.generateMonthlyReport(userId, date);

    res.json({
      success: true,
      data: reportData,
      timestamp: new Date().toISOString()
    });
  });

  // Quarterly data by period
  static getQuarterlyData = asyncHandler(async (req, res) => {
    const userId = req.user.userId;
    const { quarterValue } = req.params;

    if (!quarterValue) {
      throw createError(400, 'Missing required parameter: quarterValue');
    }

    // Convert quarterValue (2024-Q1) to date format
    const [year, quarterPart] = quarterValue.split('-Q');
    const quarter = parseInt(quarterPart);
    const month = (quarter - 1) * 3;
    const date = `${year}-${String(month + 1).padStart(2, '0')}-01`;
    
    const reportData = await ReportService.generateQuarterlyReport(userId, date);

    res.json({
      success: true,
      data: reportData,
      timestamp: new Date().toISOString()
    });
  });

  // Yearly data by period
 static getYearlyData = asyncHandler(async (req, res) => {
    const userId = req.user.userId;
    const { yearValue } = req.params;

    if (!yearValue) {
      throw createError(400, 'Missing required parameter: yearValue');
    }

    // Accept both '2024' or '2024-01-01'
    let date = yearValue;
    if (/^\d{4}$/.test(yearValue)) {
      date = `${yearValue}-01-01`; // only append if it's just a year
    }

    const reportData = await ReportService.generateYearlyReport(userId, date);

    res.json({
      success: true,
      data: reportData,
      timestamp: new Date().toISOString()
    });
});

}

// Export individual functions for backward compatibility
module.exports = {
  getWeeklyByMonthReport: ReportController.getWeeklyByMonthReport,
  getMonthlyReport: ReportController.getMonthlyReport,
  getQuarterlyReport: ReportController.getQuarterlyReport,
  getYearlyReport: ReportController.getYearlyReport,
  getAvailableQuarters: ReportController.getAvailableQuarters,
  getAvailableYears: ReportController.getAvailableYears,
  getAvailableMonths: ReportController.getAvailableMonths,
  getAvailableWeeks: ReportController.getAvailableWeeks,
  getWeeklyData: ReportController.getWeeklyData,
  getMonthlyData: ReportController.getMonthlyData,
  getQuarterlyData: ReportController.getQuarterlyData,
  getYearlyData: ReportController.getYearlyData
};
