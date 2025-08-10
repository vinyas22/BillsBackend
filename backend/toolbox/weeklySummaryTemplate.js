const { format } = require('date-fns');

function weeklySummaryTemplate({
  userName,
  weekStart,
  weekEnd,
  totalExpense,
  dailyData,
  categoryData,
  analytics = {},
  insights = [],
  previousWeekData = null
}) {
  const weekName = `${format(new Date(weekStart), 'MMM d')} - ${format(new Date(weekEnd), 'MMM d, yyyy')}`;
  const tdStyle = `style="padding: 8px 12px; border: 1px solid #ddd; font-size: 14px;"`;

  // Enhanced color coding with thresholds
  const colorAmount = (amt, isPositive = true) => {
    if (amt >= 10000) return 'color: #dc2626; font-weight: bold;';
    if (amt <= 2000) return `color: ${isPositive ? '#16a34a' : '#dc2626'}; font-weight: bold;`;
    return 'color: #444;';
  };

  // Enhanced insight generation
  const enhanceInsights = (baseInsights) => {
    const enhanced = [...baseInsights];
    
    // Add budget insight if available
    if (analytics?.budgetComparison) {
      const { variance } = analytics.budgetComparison;
      enhanced.push({
        type: 'budget',
        priority: 1,
        icon: variance > 0 ? '⚠️' : '✅',
        message: variance > 0 
          ? `Exceeded weekly budget by ₹${Math.abs(variance).toLocaleString('en-IN')}`
          : `Under budget by ₹${Math.abs(variance).toLocaleString('en-IN')}`,
        action: variance > 0 ? 'Review discretionary spending' : 'Consider increasing savings'
      });
    }

    // Add savings opportunity insight
    const topCategory = Object.entries(categoryData || {}).sort(([,a], [,b]) => b - a)[0];
    if (topCategory && topCategory[1] > totalExpense * 0.4) {
      enhanced.push({
        type: 'savings',
        priority: 2,
        icon: '💰',
        message: `${topCategory[0]} accounts for ${Math.round((topCategory[1]/totalExpense)*100)}% of spending`,
        action: 'Explore cost-saving measures for this category'
      });
    }

    return enhanced.sort((a, b) => (a.priority || 99) - (b.priority || 99));
  };

  const enhancedInsights = enhanceInsights(insights);

  // Weekly comparison renderer
  const renderWeeklyComparison = () => {
    if (!previousWeekData || !previousWeekData.totalExpense) {
      return `<p style="color: #666; font-style: italic;">No previous week data for comparison</p>`;
    }

    const diff = totalExpense - previousWeekData.totalExpense;
    const percentage = ((diff / previousWeekData.totalExpense) * 100).toFixed(1);
    const isIncrease = diff > 0;
    
    return `
      <div style="background-color: ${isIncrease ? '#fef2f2' : '#f0fdf4'}; 
          padding: 16px; border-radius: 8px; margin: 16px 0;">
        <h3 style="margin-top: 0; color: ${isIncrease ? '#dc2626' : '#16a34a'};">
          📊 Week-over-Week Comparison
        </h3>
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 12px;">
          <div>
            <div style="font-size: 20px; font-weight: bold; color: ${isIncrease ? '#dc2626' : '#16a34a'};">
              ${isIncrease ? '+' : ''}₹${Math.abs(diff).toLocaleString('en-IN')}
            </div>
            <div style="font-size: 12px; color: #6b7280;">Difference</div>
          </div>
          <div>
            <div style="font-size: 20px; font-weight: bold; color: ${isIncrease ? '#dc2626' : '#16a34a'};">
              ${Math.abs(percentage)}%
            </div>
            <div style="font-size: 12px; color: #6b7280;">Change</div>
          </div>
        </div>
      </div>
    `;
  };

  // Category table renderer
  const renderCategoryTable = () => {
    const entries = Object.entries(categoryData || {});
    if (!entries.length) {
      return `<tr><td ${tdStyle} colspan="3">No category data available</td></tr>`;
    }

    const sorted = entries.sort(([,a], [,b]) => b - a);
    
    return sorted.map(([cat, amt], idx) => {
      const percentage = totalExpense > 0 ? ((amt / totalExpense) * 100).toFixed(1) : 0;
      return `
        <tr style="background-color: ${idx % 2 === 0 ? '#ffffff' : '#f9f9f9'};">
          <td ${tdStyle}>${cat || 'Uncategorized'}</td>
          <td ${tdStyle} style="${colorAmount(amt)}">₹${amt.toLocaleString('en-IN')}</td>
          <td ${tdStyle} style="color: #666;">${percentage}%</td>
        </tr>
      `;
    }).join('');
  };

  // Daily breakdown renderer
  const renderDailyBreakdown = () => {
    const days = Object.entries(dailyData || {}).sort(([a], [b]) => new Date(a) - new Date(b));
    if (!days.length) {
      return `<tr><td ${tdStyle} colspan="2">No daily data available</td></tr>`;
    }

    const avg = days.reduce((sum, [,amt]) => sum + amt, 0) / days.length;
    
    return days.map(([date, amt], idx) => {
      const dayName = format(new Date(date), 'EEE');
      const dateStr = format(new Date(date), 'MMM d');
      const isHigh = amt > avg * 1.5;
      
      return `
        <tr style="background-color: ${idx % 2 === 0 ? '#ffffff' : '#f9f9f9'};">
          <td ${tdStyle}>${dayName}, ${dateStr} ${isHigh ? '⚠️' : ''}</td>
          <td ${tdStyle} style="${colorAmount(amt)}">₹${amt.toLocaleString('en-IN')}</td>
        </tr>
      `;
    }).join('');
  };

  // Insights renderer
  const renderInsights = () => {
    if (!enhancedInsights.length) {
      return `<p style="color: #666; font-style: italic;">No insights available this week</p>`;
    }

    return `
      <div style="background: linear-gradient(135deg, #fffbeb 0%, #fef3c7 100%); 
          padding: 20px; border-radius: 8px; border-left: 4px solid #f59e0b;">
        <h3 style="margin-top: 0; color: #92400e;">💡 Weekly Insights</h3>
        <ul style="margin: 0; padding-left: 0; list-style: none;">
          ${enhancedInsights.map(insight => `
            <li style="margin-bottom: 12px; padding-bottom: 12px; 
                ${insight.priority <= 2 ? 'border-bottom: 1px dashed #fcd34d;' : ''}">
              <div style="display: flex; align-items: flex-start; gap: 8px;">
                <span style="font-size: 20px; color: ${
                  insight.priority === 1 ? '#dc2626' : 
                  insight.priority === 2 ? '#d97706' : '#3b82f6'
                };">${insight.icon}</span>
                <div>
                  <div style="font-weight: bold;">${insight.message}</div>
                  ${insight.action ? `
                  <div style="font-size: 13px; color: #4b5563; margin-top: 4px;">
                    <em>${insight.action}</em>
                  </div>
                  ` : ''}
                </div>
              </div>
            </li>
          `).join('')}
        </ul>
      </div>
    `;
  };

  // Main template
  return `
  <div style="font-family: Arial, sans-serif; color: #333; max-width: 600px; margin: 0 auto;">
    <!-- Header -->
    <div style="background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%); 
        color: white; padding: 28px; text-align: center; border-radius: 8px 8px 0 0;">
      <h1 style="margin: 0; font-size: 24px;">📅 Weekly Expense Report</h1>
      <p style="margin: 8px 0 0 0; font-size: 16px; opacity: 0.9;">${weekName}</p>
    </div>
    
    <!-- Content -->
    <div style="padding: 24px; background: #ffffff;">
      <p style="font-size: 16px;"><strong>Hello ${userName || 'User'},</strong></p>
      
      <!-- Summary Card -->
      <div style="text-align: center; margin: 24px 0; padding: 20px; 
          background: #f8fafc; border-radius: 8px;">
        <p style="margin: 0 0 8px 0; font-size: 14px; color: #6b7280;">Total Weekly Spending</p>
        <p style="margin: 0; font-size: 36px; font-weight: bold; ${colorAmount(totalExpense)}">
          ₹${totalExpense.toLocaleString('en-IN')}
        </p>
        ${analytics?.averageDaily ? `
        <p style="margin: 8px 0 0 0; font-size: 14px; color: #6b7280;">
          Daily average: ₹${analytics.averageDaily.toLocaleString('en-IN')}
        </p>
        ` : ''}
      </div>

      ${renderWeeklyComparison()}
      ${renderInsights()}

      <!-- Category Breakdown -->
      <h3 style="margin-top: 32px; color: #1f2937; font-size: 18px;">🏷️ Spending by Category</h3>
      <div style="overflow-x: auto; margin-bottom: 24px;">
        <table style="width: 100%; border-collapse: collapse;">
          <thead style="background: #f3f4f6;">
            <tr>
              <th ${tdStyle}>Category</th>
              <th ${tdStyle}>Amount</th>
              <th ${tdStyle}>%</th>
            </tr>
          </thead>
          <tbody>${renderCategoryTable()}</tbody>
        </table>
      </div>

      <!-- Daily Breakdown -->
      <h3 style="margin-top: 32px; color: #1f2937; font-size: 18px;">📅 Daily Spending</h3>
      <div style="overflow-x: auto;">
        <table style="width: 100%; border-collapse: collapse;">
          <thead style="background: #f3f4f6;">
            <tr>
              <th ${tdStyle}>Day</th>
              <th ${tdStyle}>Amount</th>
            </tr>
          </thead>
          <tbody>${renderDailyBreakdown()}</tbody>
        </table>
      </div>

      <!-- Call to Action -->
      <div style="margin-top: 32px; padding: 16px; background: #f0fdf4; 
          border-radius: 8px; text-align: center; border-left: 4px solid #10b981;">
        <p style="margin: 0; font-size: 14px; color: #065f46;">
          <strong>💡 Tip:</strong> Review your spending patterns weekly to identify savings opportunities
        </p>
      </div>
    </div>
    
    <!-- Footer -->
    <div style="background: #f3f4f6; padding: 16px; text-align: center; border-radius: 0 0 8px 8px;">
      <p style="margin: 0; font-size: 12px; color: #6b7280;">
        Generated on ${format(new Date(), 'PPP')} • Report covers ${Object.keys(dailyData || {}).length} days
      </p>
    </div>
  </div>
  `;
}

module.exports = weeklySummaryTemplate;