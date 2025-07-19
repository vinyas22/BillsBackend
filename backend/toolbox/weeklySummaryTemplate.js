// Updated weeklySummaryTemplate.js
const { format } = require('date-fns');

/**
 * Renders a weekly summary HTML email with enhanced features.
 */
function weeklySummaryTemplate({
  name,
  weekStart,
  weekEnd,
  total,
  dailyData,
  categoryData,
  isFullWeek,
  prevTotal = null,
  prevIsFullWeek = false
}) {
  const formatDate = date =>
    typeof date === 'string' ? new Date(date).toDateString() : date.toDateString();

  const formattedStart = formatDate(weekStart);
  const formattedEnd = formatDate(weekEnd);

  const tdStyle = `style="padding: 8px 12px; border: 1px solid #ddd; font-size: 14px;"`;

  const colorAmount = (amt) => {
    if (amt >= 10000) return 'color: #dc2626; font-weight: bold;'; // red
    if (amt <= 2000) return 'color: #16a34a; font-weight: bold;'; // green
    return 'color: #444;';
  };

  const getSpendingInsight = () => {
    const dailyAverage = total / Object.keys(dailyData).length;
    const projectedMonthly = dailyAverage * 30;
    
    if (dailyAverage > 1500) {
      return `⚠️ High daily average: ₹${dailyAverage.toLocaleString('en-IN', { maximumFractionDigits: 0 })}. Consider reviewing expenses.`;
    } else if (dailyAverage < 500) {
      return `✅ Great control! Daily average: ₹${dailyAverage.toLocaleString('en-IN', { maximumFractionDigits: 0 })}.`;
    }
    return `📊 Daily average: ₹${dailyAverage.toLocaleString('en-IN', { maximumFractionDigits: 0 })}. Projected monthly: ₹${projectedMonthly.toLocaleString('en-IN', { maximumFractionDigits: 0 })}.`;
  };

  const renderCategoryTable = () => {
    const entries = Object.entries(categoryData);
    if (!entries.length) {
      return `<tr><td ${tdStyle} colspan="3">No category data available</td></tr>`;
    }

    const sortedEntries = entries.sort(([,a], [,b]) => b - a);
    const totalCat = sortedEntries.reduce((sum, [, amt]) => sum + amt, 0);

    const rows = sortedEntries.map(([cat, amt], idx) => {
      const percentage = totalCat > 0 ? ((amt / totalCat) * 100).toFixed(1) : 0;
      return `
        <tr style="background-color: ${idx % 2 === 0 ? '#ffffff' : '#f9f9f9'};">
          <td ${tdStyle}>${cat || 'Uncategorized'}</td>
          <td ${tdStyle} style="${colorAmount(amt)}">₹${amt.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</td>
          <td ${tdStyle} style="color: #666; font-size: 13px;">${percentage}%</td>
        </tr>
      `;
    }).join('');

    const totalRow = `
      <tr style="background-color: #e0e7ff;">
        <td ${tdStyle}><strong>Total</strong></td>
        <td ${tdStyle}><strong>₹${totalCat.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</strong></td>
        <td ${tdStyle}><strong>100%</strong></td>
      </tr>
    `;

    return rows + totalRow;
  };

  const renderDailyTable = () => {
    const sorted = Object.entries(dailyData).sort(([a], [b]) => new Date(a) - new Date(b));
    if (!sorted.length) {
      return `<tr><td ${tdStyle} colspan="2">No daily data available</td></tr>`;
    }

    const totalDaily = sorted.reduce((sum, [, amt]) => sum + amt, 0);
    const average = totalDaily / sorted.length;

    const rows = sorted.map(([date, amt], idx) => {
      const isHighSpending = amt > average * 1.5;
      const dayName = format(new Date(date), 'EEE');
      const dateFormatted = format(new Date(date), 'MMM d');
      
      return `
        <tr style="background-color: ${idx % 2 === 0 ? '#ffffff' : '#f9f9f9'};">
          <td ${tdStyle}>${dayName}, ${dateFormatted} ${isHighSpending ? '⚠️' : ''}</td>
          <td ${tdStyle} style="${colorAmount(amt)}">₹${amt.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</td>
        </tr>
      `;
    }).join('');

    const totalRow = `
      <tr style="background-color: #e0e7ff;">
        <td ${tdStyle}><strong>Total</strong></td>
        <td ${tdStyle}><strong>₹${totalDaily.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</strong></td>
      </tr>
    `;

    return rows + totalRow;
  };

  const renderComparison = () => {
    if (prevIsFullWeek && isFullWeek && typeof prevTotal === 'number' && prevTotal > 0) {
      const diff = total - prevTotal;
      const percentage = ((diff / prevTotal) * 100).toFixed(1);
      const isIncrease = diff > 0;
      const trend = Math.abs(percentage) > 20 ? (isIncrease ? '📈 Significant increase' : '📉 Significant decrease') : 
                   Math.abs(percentage) > 10 ? (isIncrease ? '⬆️ Notable increase' : '⬇️ Notable decrease') :
                   '➡️ Similar spending';
      
      return `
        <div style="background-color: ${isIncrease ? '#fef2f2' : '#f0fdf4'}; padding: 16px; border-radius: 8px; margin: 16px 0;">
          <h3 style="margin-top: 0;">📊 Week-over-Week Comparison</h3>
          <p style="font-size: 15px; margin: 8px 0;">
            <strong>${trend}</strong><br>
            ${isIncrease ? '⬆️ Increase' : '⬇️ Decrease'} of <strong>₹${Math.abs(diff).toLocaleString('en-IN', { maximumFractionDigits: 2 })}</strong>
            (<strong>${Math.abs(percentage)}%</strong>) compared to previous week.
          </p>
          ${Math.abs(percentage) > 25 ? 
            `<p style="font-size: 13px; color: #666; font-style: italic;">💡 Tip: Review your ${isIncrease ? 'highest' : 'recent'} expense categories for optimization opportunities.</p>` : 
            ''
          }
        </div>
      `;
    }
    return `<p style="font-size: 14px; color: #666;"><em>Week-over-week comparison not available (insufficient data)</em></p>`;
  };

  const renderInsights = () => {
    const topCategory = Object.entries(categoryData).sort(([,a], [,b]) => b - a)[0];
    const insight = getSpendingInsight();
    
    return `
      <div style="background-color: #f8fafc; padding: 16px; border-radius: 8px; border-left: 4px solid #3b82f6;">
        <h3 style="margin-top: 0; color: #1e40af;">💡 Weekly Insights</h3>
        <ul style="margin: 0; padding-left: 20px; color: #374151;">
          <li>${insight}</li>
          ${topCategory ? `<li>Top spending category: <strong>${topCategory[0]}</strong> (₹${topCategory[1].toLocaleString('en-IN', { maximumFractionDigits: 2 })})</li>` : ''}
          <li>Expense entries logged: <strong>${Object.keys(dailyData).length}</strong> day${Object.keys(dailyData).length !== 1 ? 's' : ''}</li>
        </ul>
      </div>
    `;
  };

  return `
  <div style="font-family: Arial, sans-serif; color: #333; max-width: 600px; margin: 0 auto;">
    <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 24px; text-align: center; border-radius: 8px 8px 0 0;">
      <h2 style="margin: 0; font-size: 24px;">📅 Weekly Expense Report</h2>
      <p style="margin: 8px 0 0 0; opacity: 0.9;">${formattedStart} – ${formattedEnd}</p>
    </div>
    
    <div style="padding: 24px; background: #ffffff;">
      <p><strong>Hello ${name || 'User'},</strong></p>
      <div style="text-align: center; margin: 20px 0;">
        <p style="font-size: 18px; margin: 0;">Total Expense</p>
        <p style="font-size: 32px; font-weight: bold; color: #1f2937; margin: 8px 0; ${colorAmount(total)}"}>
          ₹${total.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
        </p>
        ${!isFullWeek ? '<p style="font-size: 12px; color: #ef4444;">⚠️ Partial week data</p>' : ''}
      </div>

      ${renderComparison()}
      ${renderInsights()}

      <h3 style="margin-top: 32px; color: #1f2937;">📊 Expense by Category</h3>
      <div style="overflow-x: auto;">
        <table style="border-collapse: collapse; width: 100%; margin-bottom: 24px;" cellpadding="0" cellspacing="0">
          <thead style="background-color: #f3f4f6;">
            <tr>
              <th ${tdStyle}>Category</th>
              <th ${tdStyle}>Amount</th>
              <th ${tdStyle}>%</th>
            </tr>
          </thead>
          <tbody>${renderCategoryTable()}</tbody>
        </table>
      </div>

      <h3 style="margin-top: 32px; color: #1f2937;">📅 Daily Breakdown</h3>
      <div style="overflow-x: auto;">
        <table style="border-collapse: collapse; width: 100%;" cellpadding="0" cellspacing="0">
          <thead style="background-color: #f3f4f6;">
            <tr>
              <th ${tdStyle}>Date</th>
              <th ${tdStyle}>Amount</th>
            </tr>
          </thead>
          <tbody>${renderDailyTable()}</tbody>
        </table>
      </div>

      <div style="margin-top: 32px; padding: 16px; background-color: #f9fafb; border-radius: 8px; text-align: center;">
        <p style="margin: 0; font-size: 14px; color: #6b7280;">
          📱 <strong>Track expenses on the go!</strong><br>
          Login to your dashboard to add more entries or view detailed analytics.
        </p>
      </div>
    </div>
    
    <div style="background-color: #f3f4f6; padding: 16px; text-align: center; border-radius: 0 0 8px 8px;">
      <p style="font-size: 12px; color: #6b7280; margin: 0;">
        This report was automatically generated by your Work Billing System.<br>
        Week of ${formattedStart} • Generated on ${new Date().toLocaleDateString()}
      </p>
    </div>
  </div>
  `;
}

module.exports = weeklySummaryTemplate;
