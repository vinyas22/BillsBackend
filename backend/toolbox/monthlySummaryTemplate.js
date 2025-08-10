const { format } = require('date-fns');

function monthlySummaryTemplate(data) {
  const {
    userName,
    monthStart,
    monthEnd,
    totalExpense,
    categoryData,
    dailyData,
    weeklyTotals,
    previousMonthData,
    analytics,
    insights = []
  } = data;

  const monthName = format(new Date(monthStart), 'MMMM yyyy');
  const tdStyle = `style="padding: 10px 12px; border: 1px solid #ddd; font-size: 14px;"`;

  const colorAmount = (amt) => {
    if (amt >= 15000) return 'color: #dc2626; font-weight: bold;';
    if (amt <= 3000) return 'color: #16a34a; font-weight: bold;';
    return 'color: #444;';
  };

  const renderCategoryTable = () => {
    const entries = Object.entries(categoryData || {});
    if (!entries.length) {
      return `<tr><td ${tdStyle} colspan="3" style="text-align: center; color: #666;">No category data available</td></tr>`;
    }

    const sortedEntries = entries.sort(([, a], [, b]) => b - a);

    const rows = sortedEntries.map(([cat, amt], idx) => {
      const percentage = totalExpense > 0 ? ((amt / totalExpense) * 100).toFixed(1) : 0;
      return `
        <tr style="background-color: ${idx % 2 === 0 ? '#ffffff' : '#f9f9f9'};">
          <td ${tdStyle}>${cat || 'Uncategorized'}</td>
          <td ${tdStyle} style="${colorAmount(amt)}">₹${amt.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</td>
          <td ${tdStyle} style="color: #666; font-size: 13px;">${percentage}%</td>
        </tr>
      `;
    }).join('');

    const totalRow = `
      <tr style="background-color: #e0e7ff;">
        <td ${tdStyle}><strong>Total</strong></td>
        <td ${tdStyle}><strong>₹${totalExpense.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</strong></td>
        <td ${tdStyle}><strong>100%</strong></td>
      </tr>
    `;

    return rows + totalRow;
  };

  const renderWeeklyBreakdown = () => {
    const weeks = Object.entries(weeklyTotals || {}).sort(([a], [b]) => a - b);
    if (!weeks.length) {
      return `<tr><td ${tdStyle} colspan="2" style="text-align: center; color: #666;">No weekly data available</td></tr>`;
    }

    return weeks.map(([week, amount], idx) => `
      <tr style="background-color: ${idx % 2 === 0 ? '#ffffff' : '#f9f9f9'};">
        <td ${tdStyle}>Week ${week}</td>
        <td ${tdStyle} style="${colorAmount(amount)}">₹${amount.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</td>
      </tr>
    `).join('');
  };

  const renderComparison = () => {
    if (!previousMonthData) {
      return `<p style="color: #666; font-style: italic;">No previous month data available for comparison</p>`;
    }

    const diff = totalExpense - previousMonthData.totalExpense;
    const percentage = previousMonthData.totalExpense > 0 ? ((diff / previousMonthData.totalExpense) * 100).toFixed(1) : 0;
    const isIncrease = diff > 0;

    return `
      <div style="background-color: ${isIncrease ? '#fef2f2' : '#f0fdf4'}; padding: 20px; border-radius: 8px; margin: 20px 0;">
        <h3 style="margin-top: 0; color: ${isIncrease ? '#dc2626' : '#16a34a'};">
          📊 Month-over-Month Comparison
        </h3>
        <p style="font-size: 16px; margin: 5px 0;">
          <strong>${isIncrease ? '📈 Increased' : '📉 Decreased'} by ₹${Math.abs(diff).toLocaleString('en-IN')}</strong>
        </p>
        <p style="font-size: 14px; color: #666; margin: 0;">
          ${Math.abs(percentage)}% ${isIncrease ? 'increase' : 'decrease'} from last month
        </p>
      </div>
    `;
  };

  const renderAnalytics = () => {
    if (!analytics) return '';

    return `
      <div style="background-color: #f8fafc; padding: 20px; border-radius: 8px; margin: 20px 0;">
        <h3 style="margin-top: 0; color: #1e40af;">📈 Monthly Analytics</h3>
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px;">
          <div>
            <p style="margin: 5px 0; font-weight: bold;">Daily Average</p>
            <p style="margin: 0; font-size: 18px; color: #1f2937;">₹${(analytics.averageDaily || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}</p>
          </div>
          <div>
            <p style="margin: 5px 0; font-weight: bold;">Highest Day</p>
            <p style="margin: 0; font-size: 18px; color: #dc2626;">₹${(analytics.maxDailySpend || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}</p>
          </div>
          <div>
            <p style="margin: 5px 0; font-weight: bold;">Active Days</p>
            <p style="margin: 0; font-size: 18px; color: #059669;">${analytics.daysWithExpenses || 0}</p>
          </div>
          <div>
            <p style="margin: 5px 0; font-weight: bold;">Spending Pattern</p>
            <p style="margin: 0; font-size: 14px; color: #666;">${analytics.spendingConsistency || 'Unknown'}</p>
          </div>
        </div>
      </div>
    `;
  };

  const renderInsights = () => {
    if (!insights || insights.length === 0) {
      return `<p style="color: #666; font-style: italic;">No insights available this month</p>`;
    }

    const insightItems = insights.map(insight => `
      <li style="margin-bottom: 8px; color: #374151;">
        ${insight.icon} <strong>${insight.message}</strong>
      </li>
    `).join('');

    return `<ul style="margin: 0; padding-left: 20px;">${insightItems}</ul>`;
  };

  return `
  <div style="font-family: Arial, sans-serif; color: #333; max-width: 700px; margin: 0 auto; background-color: #ffffff;">
    <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px 24px; text-align: center; border-radius: 8px 8px 0 0;">
      <h1 style="margin: 0; font-size: 28px; font-weight: bold;">📅 Monthly Financial Report</h1>
      <p style="margin: 10px 0 0 0; font-size: 18px; opacity: 0.95;">${monthName}</p>
    </div>
    <div style="padding: 30px;">
      <p style="font-size: 16px;"><strong>Hello ${userName || 'User'},</strong></p>

      <div style="text-align: center; margin: 30px 0; padding: 25px; background: linear-gradient(135deg, #f3f4f6 0%, #e5e7eb 100%); border-radius: 12px;">
        <h2 style="margin: 0; font-size: 18px; color: #6b7280;">Total Monthly Expense</h2>
        <p style="font-size: 42px; font-weight: bold; margin: 10px 0; ${colorAmount(totalExpense)}">
          ₹${totalExpense.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
        </p>
      </div>

      ${renderComparison()}
      ${renderAnalytics()}

      <div style="background-color: #fffbeb; padding: 20px; border-radius: 8px; border-left: 4px solid #f59e0b; margin: 25px 0;">
        <h3 style="margin-top: 0; color: #92400e;">💡 Key Insights</h3>
        ${renderInsights()}
      </div>

      <h3 style="margin-top: 40px; color: #1f2937; font-size: 20px;">📊 Expense by Category</h3>
      <div style="overflow-x: auto; margin-bottom: 30px;">
        <table style="border-collapse: collapse; width: 100%; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
          <thead style="background-color: #374151; color: white;">
            <tr>
              <th ${tdStyle.replace('border: 1px solid #ddd;', 'border: none;')}>Category</th>
              <th ${tdStyle.replace('border: 1px solid #ddd;', 'border: none;')}>Amount</th>
              <th ${tdStyle.replace('border: 1px solid #ddd;', 'border: none;')}>%</th>
            </tr>
          </thead>
          <tbody>${renderCategoryTable()}</tbody>
        </table>
      </div>

      <h3 style="margin-top: 40px; color: #1f2937; font-size: 20px;">📈 Weekly Breakdown</h3>
      <div style="overflow-x: auto; margin-bottom: 30px;">
        <table style="border-collapse: collapse; width: 100%; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
          <thead style="background-color: #374151; color: white;">
            <tr>
              <th ${tdStyle.replace('border: 1px solid #ddd;', 'border: none;')}>Week</th>
              <th ${tdStyle.replace('border: 1px solid #ddd;', 'border: none;')}>Amount</th>
            </tr>
          </thead>
          <tbody>${renderWeeklyBreakdown()}</tbody>
        </table>
      </div>

      <div style="text-align: center; margin: 40px 0; padding: 25px; background-color: #f3f4f6; border-radius: 8px;">
        <h3 style="margin-top: 0; color: #1f2937;">📱 Take Control of Your Finances</h3>
        <p style="margin: 10px 0; color: #6b7280;">
          Review your detailed spending patterns and plan for the upcoming month.
        </p>
      </div>
    </div>

    <div style="background-color: #f9fafb; padding: 20px; text-align: center; border-radius: 0 0 8px 8px;">
      <p style="font-size: 12px; color: #6b7280; margin: 0;">
        📊 Monthly report generated automatically by Work Billing System<br>
        Report for ${monthName} • Generated on ${format(new Date(), 'PPP')}
      </p>
    </div>
  </div>
  `;
}

module.exports = monthlySummaryTemplate;
