const ReportService = require('../services/ReportService');

/**
 * Get weekly report by month for a specific bill
 */
const getWeeklyByMonthReport = async (req, res) => {
  try {
    const { billId, date } = req.params;
    const userId = req.user.userId;
    
    const report = await ReportService.generateWeeklyReport(userId, date);
    
    res.json({
      success: true,
      data: report,
      message: 'Weekly report generated successfully'
    });
  } catch (error) {
    console.error('Weekly by month report error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to generate weekly report',
      error: error.message
    });
  }
};

/**
 * Get monthly report
 */
const getMonthlyReport = async (req, res) => {
  try {
    const { date } = req.query;
    const userId = req.user.userId;
    
    if (!date) {
      return res.status(400).json({
        success: false,
        message: 'Date parameter is required'
      });
    }
    
    const report = await ReportService.generateMonthlyReport(userId, date);
    
    res.json({
      success: true,
      data: report,
      message: 'Monthly report generated successfully'
    });
  } catch (error) {
    console.error('Monthly report error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to generate monthly report',
      error: error.message
    });
  }
};

/**
 * Get quarterly report - FIXED VERSION
 */
const getQuarterlyReport = async (req, res) => {
  try {
    const { date } = req.query;
    const userId = req.user.userId;
    
    console.log('📅 Quarterly report requested with date:', date);
    console.log('📅 User ID:', userId);
    
    if (!date) {
      return res.status(400).json({
        success: false,
        message: 'Date parameter is required'
      });
    }
    
    // Call the service method
    const report = await ReportService.generateQuarterlyReport(userId, date);
    
    console.log('📊 Generated report data:', {
      type: report?.type,
      totalExpense: report?.totalExpense,
      previousQuarter: report?.previousQuarter ? 'Present' : 'Missing',
      categoriesCount: report?.category?.length,
      previousCategoriesCount: report?.previousQuarter?.category?.length
    });
    
    // FIXED: Make sure to return the report data
    res.json({
      success: true,
      data: report,  // ✅ This was missing in your backend
      message: 'Quarterly report generated successfully'
    });
  } catch (error) {
    console.error('❌ Quarterly report error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to generate quarterly report',
      error: error.message
    });
  }
};

/**
 * Get quarterly report by path parameter
 */
const getQuarterlyData = async (req, res) => {
  try {
    const { quarterValue } = req.params;
    const userId = req.user.userId;
    
    console.log('📅 Quarterly data requested with quarterValue:', quarterValue);
    
    if (!quarterValue) {
      return res.status(400).json({
        success: false,
        message: 'Quarter value parameter is required'
      });
    }
    
    const report = await ReportService.generateQuarterlyReport(userId, quarterValue);
    
    res.json({
      success: true,
      data: report,
      message: 'Quarterly report generated successfully'
    });
  } catch (error) {
    console.error('Quarterly data error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to generate quarterly report',
      error: error.message
    });
  }
};

/**
 * Get yearly report
 */
const getYearlyReport = async (req, res) => {
  try {
    const { date } = req.query;
    const userId = req.user.userId;
    
    if (!date) {
      return res.status(400).json({
        success: false,
        message: 'Date parameter is required'
      });
    }
    
    const report = await ReportService.generateYearlyReport(userId, date);
    
    res.json({
      success: true,
      data: report,
      message: 'Yearly report generated successfully'
    });
  } catch (error) {
    console.error('Yearly report error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to generate yearly report',
      error: error.message
    });
  }
};

/**
 * Get available quarters for the user
 */
const getAvailableQuarters = async (req, res) => {
  try {
    const userId = req.user.userId;
    
    console.log('📌 Fetching available quarters for user:', userId);
    
    const quarters = await ReportService.getAvailableQuarters(userId);
    
    console.log('📊 DB returned quarters:', quarters.length, 'quarters');
    
    res.json({
      success: true,
      data: {
        quarters: quarters
      },
      message: 'Available quarters retrieved successfully'
    });
  } catch (error) {
    console.error('Available quarters error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve available quarters',
      error: error.message
    });
  }
};

/**
 * Get available years for the user
 */
const getAvailableYears = async (req, res) => {
  try {
    const userId = req.user.userId;
    
    const years = await ReportService.getAvailableYears(userId);
    
    res.json({
      success: true,
      data: {
        years: years
      },
      message: 'Available years retrieved successfully'
    });
  } catch (error) {
    console.error('Available years error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve available years',
      error: error.message
    });
  }
};

/**
 * Get available months for the user
 */
const getAvailableMonths = async (req, res) => {
  try {
    const userId = req.user.userId;
    
    // Generate available months from available quarters data
    const quarters = await ReportService.getAvailableQuarters(userId);
    const months = [];
    
    quarters.forEach(quarter => {
      const startMonth = (quarter.quarter - 1) * 3 + 1;
      for (let i = 0; i < 3; i++) {
        const month = startMonth + i;
        if (month <= 12) {
          months.push({
            year: quarter.year,
            month: month,
            label: `${new Date(quarter.year, month - 1).toLocaleDateString('en-US', { month: 'long' })} ${quarter.year}`,
            value: `${quarter.year}-${String(month).padStart(2, '0')}-01`
          });
        }
      }
    });
    
    // Sort months by year and month descending
    months.sort((a, b) => {
      if (a.year !== b.year) return b.year - a.year;
      return b.month - a.month;
    });
    
    res.json({
      success: true,
      data: {
        periods: months
      },
      message: 'Available months retrieved successfully'
    });
  } catch (error) {
    console.error('Available months error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve available months',
      error: error.message
    });
  }
};

/**
 * Get available weeks for the user
 */
const getAvailableWeeks = async (req, res) => {
  try {
    const userId = req.user.userId;
    
    // Generate last 12 weeks based on current date
    const weeks = [];
    const today = new Date();
    
    for (let i = 0; i < 12; i++) {
      const weekStart = new Date(today);
      weekStart.setDate(today.getDate() - (today.getDay()) - (i * 7));
      
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekStart.getDate() + 6);
      
      weeks.push({
        label: `Week of ${weekStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`,
        value: weekStart.toISOString().split('T')[0],
        startDate: weekStart.toISOString().split('T')[0],
        endDate: weekEnd.toISOString().split('T')[0]
      });
    }
    
    res.json({
      success: true,
      data: {
        periods: weeks
      },
      message: 'Available weeks retrieved successfully'
    });
  } catch (error) {
    console.error('Available weeks error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve available weeks',
      error: error.message
    });
  }
};

/**
 * Get weekly data by week value
 */
const getWeeklyData = async (req, res) => {
  try {
    const { weekValue } = req.params;
    const userId = req.user.userId;
    
    if (!weekValue) {
      return res.status(400).json({
        success: false,
        message: 'Week value parameter is required'
      });
    }
    
    const report = await ReportService.generateWeeklyReport(userId, weekValue);
    
    res.json({
      success: true,
      data: report,
      message: 'Weekly report generated successfully'
    });
  } catch (error) {
    console.error('Weekly data error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to generate weekly report',
      error: error.message
    });
  }
};

/**
 * Get monthly data by month value
 */
const getMonthlyData = async (req, res) => {
  try {
    const { monthValue } = req.params;
    const userId = req.user.userId;
    
    if (!monthValue) {
      return res.status(400).json({
        success: false,
        message: 'Month value parameter is required'
      });
    }
    
    const report = await ReportService.generateMonthlyReport(userId, monthValue);
    
    res.json({
      success: true,
      data: report,
      message: 'Monthly report generated successfully'
    });
  } catch (error) {
    console.error('Monthly data error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to generate monthly report',
      error: error.message
    });
  }
};

/**
 * Get yearly data by year value
 */
const getYearlyData = async (req, res) => {
  try {
    const { yearValue } = req.params;
    const userId = req.user.userId;
    
    if (!yearValue) {
      return res.status(400).json({
        success: false,
        message: 'Year value parameter is required'
      });
    }
    
    const report = await ReportService.generateYearlyReport(userId, yearValue);
    
    res.json({
      success: true,
      data: report,
      message: 'Yearly report generated successfully'
    });
  } catch (error) {
    console.error('Yearly data error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to generate yearly report',
      error: error.message
    });
  }
};

module.exports = {
  getWeeklyByMonthReport,
  getMonthlyReport,
  getQuarterlyReport,
  getYearlyReport,
  getAvailableQuarters,
  getAvailableYears,
  getAvailableMonths,
  getAvailableWeeks,
  getWeeklyData,
  getMonthlyData,
  getQuarterlyData,
  getYearlyData
};
