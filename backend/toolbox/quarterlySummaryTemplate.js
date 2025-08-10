const { format } = require('date-fns');

function quarterlySummaryTemplate(data) {
  const {
    userName, quarterStart, quarterEnd, totalExpense,
    monthlyData, categoryData, analytics, insights = [], previousQuarterData
  } = data;

  const quarterName = format(new Date(quarterStart), 'QQQ yyyy');
  const tdStyle = `style="padding: 12px 16px; border: 1px solid #ddd; font-size: 14px;"`;

  // Color coding helper
  const colorAmount = (amt, isPositive = true) => {
    if (amt >= 200000) return 'color: #dc2626; font-weight: bold;';
    if (amt <= 100000) return `color: ${isPositive ? '#16a34a' : '#dc2626'}; font-weight: bold;`;
    return 'color: #444;';
  };

  // 1. Quarterly Comparison Renderer
  const renderQuarterlyComparison = () => {
    if (!previousQuarterData || previousQuarterData.totalExpense === 0) {
      return `<p style="color: #666; font-style: italic;">No previous quarter data available for comparison</p>`;
    }

    const diff = totalExpense - previousQuarterData.totalExpense;
    const percentage = ((diff / previousQuarterData.totalExpense) * 100).toFixed(1);
    const isIncrease = diff > 0;
    
    return `
      <div style="background-color: ${isIncrease ? '#fef2f2' : '#f0fdf4'}; 
          padding: 24px; border-radius: 12px; margin: 24px 0;">
        <h3 style="margin-top: 0; color: ${isIncrease ? '#dc2626' : '#16a34a'}; 
            display: flex; align-items: center; gap: 8px;">
          📊 Quarter-over-Quarter Comparison
        </h3>
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 16px;">
          <div>
            <p style="font-size: 24px; margin: 0; font-weight: bold; 
                color: ${isIncrease ? '#dc2626' : '#16a34a'};">
              ${isIncrease ? '📈 +' : '📉 -'}₹${Math.abs(diff).toLocaleString('en-IN')}
            </p>
            <p style="font-size: 14px; color: #666; margin: 4px 0 0 0;">Absolute Change</p>
          </div>
          <div>
            <p style="font-size: 24px; margin: 0; font-weight: bold; 
                color: ${isIncrease ? '#dc2626' : '#16a34a'};">
              ${Math.abs(percentage)}%
            </p>
            <p style="font-size: 14px; color: #666; margin: 4px 0 0 0;">Percentage Change</p>
          </div>
          <div>
            <p style="font-size: 16px; margin: 0; color: #374151;">
              <strong>Previous Quarter:</strong> ₹${previousQuarterData.totalExpense.toLocaleString('en-IN')}
            </p>
            <p style="font-size: 16px; margin: 4px 0 0 0; color: #374151;">
              <strong>Current Quarter:</strong> ₹${totalExpense.toLocaleString('en-IN')}
            </p>
          </div>
        </div>
      </div>
    `;
  };

  // 2. Category Table Renderer
  const renderCategoryTable = () => {
    const entries = Object.entries(categoryData || {});
    if (!entries.length) {
      return `<tr><td ${tdStyle} colspan="3" style="text-align: center; color: #666;">No category data available</td></tr>`;
    }

    const sortedEntries = entries.sort(([,a], [,b]) => b - a);
    
    const rows = sortedEntries.map(([cat, amt], idx) => {
      const percentage = totalExpense > 0 ? ((amt / totalExpense) * 100).toFixed(1) : 0;
      const avgMonthly = amt / 3;
      return `
        <tr style="background-color: ${idx % 2 === 0 ? '#ffffff' : '#f9f9f9'};">
          <td ${tdStyle}>
            <div style="font-weight: bold;">${cat || 'Uncategorized'}</div>
            <div style="font-size: 11px; color: #6b7280;">₹${avgMonthly.toLocaleString('en-IN')}/month</div>
          </td>
          <td ${tdStyle} style="${colorAmount(amt)}">₹${amt.toLocaleString('en-IN')}</td>
          <td ${tdStyle} style="color: #666; font-size: 13px;">
            <div>${percentage}%</div>
            <div style="font-size: 10px; color: #9ca3af;">${idx < 3 ? 'Top 3' : ''}</div>
          </td>
        </tr>
      `;
    }).join('');

    const totalRow = `
      <tr style="background-color: #e0e7ff;">
        <td ${tdStyle}><strong>Total</strong></td>
        <td ${tdStyle}><strong>₹${totalExpense.toLocaleString('en-IN')}</strong></td>
        <td ${tdStyle}><strong>100%</strong></td>
      </tr>
    `;

    return rows + totalRow;
  };

  // 3. Insights Enhancement System
  const enhanceInsights = (insights) => {
    const enhanced = [...insights];
    
    if (analytics?.budgetComparison) {
      const { variance } = analytics.budgetComparison;
      enhanced.push({
        type: 'budget',
        priority: 1,
        icon: variance > 0 ? '⚠️' : '✅',
        message: variance > 0 
          ? `Exceeded budget by ₹${Math.abs(variance).toLocaleString('en-IN')}`
          : `Under budget by ₹${Math.abs(variance).toLocaleString('en-IN')}`,
        action: variance > 0 ? 'Review discretionary spending' : 'Consider increasing savings'
      });
    }

    return enhanced.sort((a, b) => (a.priority || 99) - (b.priority || 99));
  };

  // 4. Insights Renderer
  const renderInsights = () => {
    const enhancedInsights = enhanceInsights(insights);
    
    if (!enhancedInsights.length) {
      return `<p style="color: #666; font-style: italic;">No insights available this quarter</p>`;
    }

    return `
      <div style="background: #fffbeb; padding: 24px; border-radius: 12px; margin: 24px 0;">
        <h3 style="margin-top: 0; color: #92400e;">💡 Key Insights</h3>
        <ul style="margin: 0; padding-left: 0; list-style: none;">
          ${enhancedInsights.map(insight => `
            <li style="margin-bottom: 12px; padding: 12px; background: white; border-radius: 8px;
                border-left: 4px solid ${insight.priority === 1 ? '#ef4444' : '#f59e0b'};">
              <div style="display: flex; align-items: center; gap: 8px;">
                <span style="font-size: 20px;">${insight.icon}</span>
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

  // Main Template
  return `
  <div style="font-family: Arial, sans-serif; max-width: 900px; margin: 0 auto;">
    <!-- Header -->
    <div style="background: #6366f1; color: white; padding: 32px; text-align: center; border-radius: 8px 8px 0 0;">
      <h1 style="margin: 0;">📊 Quarterly Report</h1>
      <p style="margin: 8px 0 0 0; font-size: 18px;">${quarterName}</p>
    </div>
    
    <!-- Content -->
    <div style="padding: 24px;">
      <p>Hello ${userName},</p>
      
      ${renderQuarterlyComparison()}
      
      <div style="background: #f8fafc; padding: 24px; border-radius: 8px; margin: 24px 0;">
        <h3 style="margin-top: 0;">📈 Quarterly Summary</h3>
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 16px;">
          <div>
            <div style="font-size: 14px; color: #6b7280;">Total Spending</div>
            <div style="font-size: 24px; font-weight: bold; ${colorAmount(totalExpense)}">
              ₹${totalExpense.toLocaleString('en-IN')}
            </div>
          </div>
          <div>
            <div style="font-size: 14px; color: #6b7280;">Monthly Average</div>
            <div style="font-size: 24px; font-weight: bold;">
              ₹${(analytics?.averageMonthly || 0).toLocaleString('en-IN')}
            </div>
          </div>
        </div>
      </div>
      
      ${renderInsights()}
      
      <h3>🏷️ Spending by Category</h3>
      <div style="overflow-x: auto;">
        <table style="width: 100%; border-collapse: collapse;">
          <thead style="background: #1f2937; color: white;">
            <tr>
              <th ${tdStyle}>Category</th>
              <th ${tdStyle}>Amount</th>
              <th ${tdStyle}>%</th>
            </tr>
          </thead>
          <tbody>${renderCategoryTable()}</tbody>
        </table>
      </div>
    </div>
    
    <!-- Footer -->
    <div style="background: #f3f4f6; padding: 16px; text-align: center; border-radius: 0 0 8px 8px;">
      <p style="margin: 0; font-size: 12px; color: #6b7280;">
        Generated on ${format(new Date(), 'PPP')}
      </p>
    </div>
  </div>
  `;
}

module.exports = quarterlySummaryTemplate;