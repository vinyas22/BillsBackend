const { format } = require('date-fns');

function yearlySummaryTemplate(data) {
  // Destructure with comprehensive defaults
  const {
    userName = 'User',
    dataStrategy = { strategy: 'default' },
    reportPeriod = { 
      label: 'Yearly Report', 
      start: new Date(), 
      end: new Date() 
    },
    totalExpense = 0,
    monthlyData = {},
    quarterlyData = {},
    categoryData = {},
    seasonalData = {},
    analytics = {
      dataCompleteness: 0,
      activeMonths: 0,
      averageMonthly: 0,
      maxMonthlySpend: 0,
      yearlyGrowthTrend: 'N/A',
      spendingVolatility: 'Unknown',
      categoryDiversification: 0,
      averageDaily: 0
    },
    insights = [],
    comparisonData = {}
  } = data;

  // Helper functions with robust error handling
  const formatCurrency = (amount) => {
    try {
      const num = typeof amount === 'number' ? amount : Number(amount) || 0;
      return `₹${num.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
    } catch {
      return '₹0';
    }
  };

  const colorAmount = (amt) => {
    const amount = typeof amt === 'number' ? amt : 0;
    if (amount >= 500000) return 'color: #dc2626; font-weight: bold;';
    if (amount <= 200000) return 'color: #16a34a; font-weight: bold;';
    return 'color: #1f2937;';
  };

  const safeToFixed = (value, digits = 0) => {
    try {
      const num = typeof value === 'number' ? value : 0;
      return num.toFixed(digits);
    } catch {
      return '0';
    }
  };

  const safeDateFormat = (date, formatStr = 'MMM d, yyyy') => {
    try {
      if (!date) return '';
      const d = date instanceof Date ? date : new Date(date);
      return isNaN(d) ? '' : format(d, formatStr);
    } catch {
      return '';
    }
  };

  // Data Strategy Banner
  const renderDataStrategyBanner = () => {
    const strategyConfig = {
      'current_year_complete': { color: '#10b981', label: '🎯 Complete Current Year Analysis' },
      'previous_year_complete': { color: '#3b82f6', label: '📅 Complete Previous Year Analysis' },
      'rolling_12_months': { color: '#8b5cf6', label: '🔄 Optimal 12-Month Period Analysis' },
      'partial_year': { color: '#f59e0b', label: '📊 Best Available Data Analysis' },
      'default': { color: '#6b7280', label: 'Financial Analysis' }
    };

    const strategy = strategyConfig[dataStrategy.strategy] || strategyConfig.default;
    const completeness = safeToFixed(analytics.dataCompleteness, 0);
    const activeMonths = analytics.activeMonths || 0;

    return `
      <div style="
        background: linear-gradient(135deg, ${strategy.color} 0%, ${darkenColor(strategy.color, 20)} 100%);
        color: white; 
        padding: clamp(16px, 3vw, 20px);
        border-radius: 12px; 
        margin: clamp(16px, 3vw, 24px) 0;
        text-align: center;
        box-shadow: 0 4px 6px rgba(0,0,0,0.1);
      ">
        <h3 style="margin: 0; font-size: clamp(16px, 3vw, 20px);">
          ${strategy.label}
        </h3>
        <p style="margin: 8px 0 0 0; opacity: 0.9; font-size: clamp(12px, 2.5vw, 14px);">
          ${completeness}% data completeness • ${activeMonths} months analyzed
        </p>
      </div>
    `;
  };

  // Monthly Spending Chart
  const renderMonthlyChart = () => {
    try {
      const months = Object.entries(monthlyData).sort(([a], [b]) => a.localeCompare(b));
      if (!months.length) return '<p style="color: #666; text-align: center;">No monthly data available</p>';
      
      const amounts = months.map(([, amt]) => typeof amt === 'number' ? amt : 0);
      const maxAmount = Math.max(...amounts);
      const minAmount = Math.min(...amounts);
      
      return months.map(([month, amount]) => {
        const monthName = safeDateFormat(month + '-01', 'MMM yyyy');
        const numAmount = typeof amount === 'number' ? amount : 0;
        const barWidth = maxAmount > minAmount ? 
          ((numAmount - minAmount) / (maxAmount - minAmount)) * 90 + 10 : 
          50;
        
        return `
          <div style="margin-bottom: 16px;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px; gap: 8px; flex-wrap: wrap;">
              <span style="font-weight: bold; font-size: clamp(13px, 2.5vw, 16px);">${monthName}</span>
              <span style="${colorAmount(numAmount)} font-size: clamp(13px, 2.5vw, 16px);">
                ${formatCurrency(numAmount)}
              </span>
            </div>
            <div style="background-color: #e5e7eb; height: 12px; border-radius: 6px; overflow: hidden;">
              <div style="
                background: linear-gradient(90deg, rgba(16, 185, 129, 0.8), rgba(5, 150, 105, 0.8));
                height: 100%; 
                width: ${barWidth}%;
              "></div>
            </div>
          </div>
        `;
      }).join('');
    } catch {
      return '<p style="color: #666; text-align: center;">Error loading monthly data</p>';
    }
  };

  // Quarterly Breakdown
  const renderQuarterlyBreakdown = () => {
    try {
      const quarters = Object.entries(quarterlyData);
      if (!quarters.length) return '<p style="color: #666; text-align: center;">No quarterly data available</p>';
      
      return quarters.map(([quarter, amount]) => {
        const numAmount = typeof amount === 'number' ? amount : 0;
        return `
          <div style="
            background: white; 
            padding: clamp(14px, 3vw, 20px);
            border-radius: 10px; 
            box-shadow: 0 3px 6px rgba(0,0,0,0.1); 
            text-align: center;
          ">
            <h4 style="margin: 0 0 8px 0; color: #374151; font-size: clamp(14px, 3vw, 18px);">
              ${quarter}
            </h4>
            <p style="margin: 0; font-size: clamp(18px, 4vw, 24px); font-weight: bold; ${colorAmount(numAmount)}">
              ${formatCurrency(numAmount)}
            </p>
          </div>
        `;
      }).join('');
    } catch {
      return '<p style="color: #666; text-align: center;">Error loading quarterly data</p>';
    }
  };

  // Seasonal Analysis
  const renderSeasonalAnalysis = () => {
    try {
      const seasons = Object.entries(seasonalData);
      if (!seasons.length) return '<p style="color: #666; text-align: center;">No seasonal data available</p>';
      
      const seasonIcons = { 
        Spring: '🌸', Summer: '☀️', Monsoon: '🌧️', 
        Winter: '❄️', Fall: '🍂', default: '🌍'
      };
      
      return seasons.map(([season, amount]) => {
        const numAmount = typeof amount === 'number' ? amount : 0;
        return `
          <div style="
            background: white; 
            padding: clamp(12px, 3vw, 18px);
            border-radius: 8px; 
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
          ">
            <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 8px; flex-wrap: wrap;">
              <span style="font-size: clamp(20px, 4vw, 24px);">
                ${seasonIcons[season] || seasonIcons.default}
              </span>
              <span style="font-weight: bold; color: #374151; font-size: clamp(14px, 3vw, 16px);">
                ${season}
              </span>
            </div>
            <p style="margin: 0; font-size: clamp(16px, 3.5vw, 20px); font-weight: bold; ${colorAmount(numAmount)}">
              ${formatCurrency(numAmount)}
            </p>
          </div>
        `;
      }).join('');
    } catch {
      return '<p style="color: #666; text-align: center;">Error loading seasonal data</p>';
    }
  };

  // Category Table
  const renderCategoryTable = () => {
    try {
      const entries = Object.entries(categoryData);
      if (!entries.length) {
        return `
          <tr>
            <td colspan="3" style="
              padding: clamp(12px, 3vw, 18px);
              text-align: center; 
              color: #666;
              font-style: italic;
            ">
              No category data available
            </td>
          </tr>
        `;
      }

      return entries
        .sort(([,a], [,b]) => (b || 0) - (a || 0))
        .map(([cat, amt], idx) => {
          const numAmt = typeof amt === 'number' ? amt : 0;
          const percentage = totalExpense > 0 ? safeToFixed((numAmt / totalExpense) * 100, 1) : '0';
          
          return `
            <tr style="background-color: ${idx % 2 === 0 ? '#ffffff' : '#f9f9f9'};">
              <td style="
                padding: clamp(10px, 2.5vw, 16px);
                border: 1px solid #e5e7eb;
                font-size: clamp(12px, 2.5vw, 14px);
              ">
                ${cat || 'Uncategorized'}
              </td>
              <td style="
                padding: clamp(10px, 2.5vw, 16px);
                border: 1px solid #e5e7eb;
                font-size: clamp(12px, 2.5vw, 14px);
                ${colorAmount(numAmt)};
                text-align: right;
              ">
                ${formatCurrency(numAmt)}
              </td>
              <td style="
                padding: clamp(10px, 2.5vw, 16px);
                border: 1px solid #e5e7eb;
                font-size: clamp(11px, 2vw, 13px);
                color: #6b7280;
                text-align: right;
              ">
                ${percentage}%
              </td>
            </tr>
          `;
        }).join('');
    } catch {
      return `
        <tr>
          <td colspan="3" style="
            padding: clamp(12px, 3vw, 18px);
            text-align: center; 
            color: #dc2626;
          ">
            Error loading category data
          </td>
        </tr>
      `;
    }
  };

  // Year-over-Year Comparison
  const renderYearlyComparison = () => {
    try {
      if (!comparisonData || typeof comparisonData.totalExpense !== 'number') {
        return `
          <p style="
            color: #666; 
            font-style: italic;
            text-align: center;
            padding: 16px;
          ">
            No comparison data available
          </p>
        `;
      }

      const current = typeof totalExpense === 'number' ? totalExpense : 0;
      const previous = comparisonData.totalExpense;
      const diff = current - previous;
      const percentage = previous !== 0 ? safeToFixed((diff / previous) * 100, 1) : '0';
      const isIncrease = diff > 0;
      const changeType = isIncrease ? 'increase' : 'decrease';
      const changeIcon = isIncrease ? '📈' : '📉';
      
      return `
        <div style="
          background-color: ${isIncrease ? '#fef2f2' : '#f0fdf4'};
          padding: clamp(18px, 4vw, 24px);
          border-radius: 12px;
          margin: clamp(20px, 4vw, 32px) 0;
        ">
          <h3 style="
            margin-top: 0;
            color: ${isIncrease ? '#dc2626' : '#16a34a'};
            font-size: clamp(18px, 4vw, 22px);
            display: flex;
            align-items: center;
            gap: 8px;
          ">
            ${changeIcon} Year-over-Year Comparison
          </h3>
          <p style="
            font-size: clamp(16px, 3.5vw, 20px);
            margin: 12px 0;
            ${colorAmount(Math.abs(diff))};
          ">
            <strong>${changeIcon} ${changeType.charAt(0).toUpperCase() + changeType.slice(1)} by ${formatCurrency(Math.abs(diff))}</strong>
          </p>
          <p style="
            font-size: clamp(12px, 2.5vw, 14px);
            color: #6b7280;
            margin: 0;
          ">
            ${Math.abs(percentage)}% ${changeType} compared to ${comparisonData.period || 'previous period'}
          </p>
        </div>
      `;
    } catch {
      return `
        <p style="
          color: #dc2626;
          text-align: center;
          padding: 16px;
        ">
          Error loading comparison data
        </p>
      `;
    }
  };

  // Insights Section
  const renderInsights = () => {
    try {
      if (!insights || !insights.length) {
        return `
          <p style="
            color: #666;
            font-style: italic;
            text-align: center;
            padding: 16px;
          ">
            No insights available
          </p>
        `;
      }

      return `
        <ul style="
          margin: 0;
          padding: 0;
          list-style: none;
        ">
          ${insights.map(insight => `
            <li style="
              margin-bottom: 12px;
              padding: 12px 0;
              border-bottom: 1px solid #f3f4f6;
              display: flex;
              align-items: flex-start;
              gap: 12px;
            ">
              <span style="font-size: clamp(18px, 3.5vw, 22px);">
                ${insight.icon || '💡'}
              </span>
              <span style="
                font-size: clamp(14px, 3vw, 16px);
                color: #374151;
              ">
                ${insight.message || 'No insight message'}
              </span>
            </li>
          `).join('')}
        </ul>
      `;
    } catch {
      return `
        <p style="
          color: #dc2626;
          text-align: center;
          padding: 16px;
        ">
          Error loading insights
        </p>
      `;
    }
  };

  // Analytics Dashboard
  const renderAnalyticsDashboard = () => {
    try {
      const metrics = [
        {
          label: 'Monthly Average',
          value: analytics.averageMonthly || 0,
          color: '#1f2937'
        },
        {
          label: 'Peak Month',
          value: analytics.maxMonthlySpend || 0,
          color: '#dc2626'
        },
        {
          label: 'Growth Trend',
          value: analytics.yearlyGrowthTrend || 'N/A',
          color: '#059669'
        },
        {
          label: 'Spending Volatility',
          value: analytics.spendingVolatility || 'Unknown',
          color: '#6b7280',
          small: true
        },
        {
          label: 'Categories Used',
          value: analytics.categoryDiversification || 0,
          color: '#7c3aed'
        },
        {
          label: 'Data Completeness',
          value: `${safeToFixed(analytics.dataCompleteness, 0)}%`,
          color: '#0369a1'
        }
      ];
      
      return `
        <div style="
          background: #f8fafc;
          padding: clamp(18px, 4vw, 24px);
          border-radius: 12px;
          margin: clamp(20px, 4vw, 32px) 0;
        ">
          <h3 style="
            margin-top: 0;
            color: #1e40af;
            font-size: clamp(18px, 4vw, 22px);
            display: flex;
            align-items: center;
            gap: 8px;
          ">
            📈 Comprehensive Analytics
          </h3>
          <div style="
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(min(160px, 100%), 1fr));
            gap: clamp(12px, 3vw, 20px);
            margin-top: 16px;
          ">
            ${metrics.map(metric => `
              <div style="
                background: white;
                padding: clamp(12px, 3vw, 18px);
                border-radius: 8px;
                box-shadow: 0 2px 4px rgba(0,0,0,0.05);
              ">
                <p style="
                  margin: 0 0 6px 0;
                  font-weight: bold;
                  color: #6b7280;
                  font-size: clamp(12px, 2.5vw, 14px);
                ">
                  ${metric.label}
                </p>
                <p style="
                  margin: 0;
                  font-size: ${metric.small ? 'clamp(14px, 3vw, 16px)' : 'clamp(16px, 3.5vw, 20px)'};
                  color: ${metric.color};
                  font-weight: ${metric.small ? 'normal' : 'bold'};
                ">
                  ${typeof metric.value === 'number' ? formatCurrency(metric.value) : metric.value}
                </p>
              </div>
            `).join('')}
          </div>
        </div>
      `;
    } catch {
      return `
        <p style="
          color: #dc2626;
          text-align: center;
          padding: 16px;
        ">
          Error loading analytics dashboard
        </p>
      `;
    }
  };

  // Utility function to darken colors (simplified)
  function darkenColor(color, percent) {
    return color; // In a real implementation, this would darken the color
  }

  // Main Template
  return `
    <div style="
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      color: #1f2937;
      max-width: min(900px, 95vw);
      margin: 0 auto;
      background-color: #ffffff;
      box-shadow: 0 4px 12px rgba(0,0,0,0.1);
      border-radius: clamp(12px, 3vw, 20px);
      overflow: hidden;
    ">
      <!-- Header -->
      <div style="
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        color: white;
        padding: clamp(24px, 5vw, 40px) clamp(16px, 4vw, 32px);
        text-align: center;
      ">
        <h1 style="
          margin: 0;
          font-size: clamp(22px, 5vw, 36px);
          font-weight: bold;
          line-height: 1.2;
        ">
          📊 Yearly Financial Report
        </h1>
        <p style="
          margin: clamp(12px, 3vw, 20px) 0 0 0;
          font-size: clamp(14px, 3vw, 18px);
          opacity: 0.95;
        ">
          ${reportPeriod.label || 'Yearly Report'}
        </p>
        <p style="
          margin: clamp(6px, 2vw, 12px) 0 0 0;
          font-size: clamp(12px, 2.5vw, 14px);
          opacity: 0.9;
        ">
          ${safeDateFormat(reportPeriod.start, 'MMM d, yyyy')} - ${safeDateFormat(reportPeriod.end, 'MMM d, yyyy')}
        </p>
      </div>
      
      <!-- Main Content -->
      <div style="padding: clamp(16px, 4vw, 32px);">
        <p style="font-size: clamp(14px, 3vw, 16px);">
          <strong>Hello ${userName},</strong>
        </p>
        
        ${renderDataStrategyBanner()}
        
        <!-- Total Expense Highlight -->
        <div style="
          text-align: center;
          margin: clamp(24px, 5vw, 40px) 0;
          padding: clamp(20px, 5vw, 36px);
          background: #f3f4f6;
          border-radius: 12px;
          position: relative;
        ">
          <div style="
            position: absolute;
            top: -12px;
            left: 50%;
            transform: translateX(-50%);
            background: #10b981;
            padding: 6px 16px;
            border-radius: 20px;
            font-size: clamp(12px, 2.5vw, 14px);
            font-weight: bold;
            color: white;
          ">
            YEARLY TOTAL
          </div>
          <h2 style="
            margin: 16px 0 0 0;
            font-size: clamp(16px, 3.5vw, 20px);
            color: #6b7280;
          ">
            Total Expenses
          </h2>
          <p style="
            font-size: clamp(28px, 7vw, 48px);
            font-weight: bold;
            margin: 12px 0;
            ${colorAmount(totalExpense)};
            line-height: 1.1;
          ">
            ${formatCurrency(totalExpense)}
          </p>
          <div style="
            font-size: clamp(12px, 2.5vw, 14px);
            color: #6b7280;
            margin: 0;
            display: flex;
            justify-content: center;
            align-items: center;
            flex-wrap: wrap;
            gap: 8px;
          ">
            <span>Average: ${formatCurrency(analytics.averageMonthly || 0)}/month</span>
            <span>•</span>
            <span>${formatCurrency(analytics.averageDaily || 0)}/day</span>
          </div>
        </div>

        ${renderYearlyComparison()}
        ${renderAnalyticsDashboard()}

        <!-- Quarterly Overview -->
        <h3 style="
          margin: clamp(32px, 6vw, 48px) 0 clamp(16px, 3vw, 24px) 0;
          font-size: clamp(18px, 4vw, 24px);
          color: #1f2937;
        ">
          📊 Quarterly Performance
        </h3>
        <div style="
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(min(160px, 100%), 1fr));
          gap: clamp(12px, 3vw, 20px);
          margin-bottom: clamp(20px, 4vw, 32px);
        ">
          ${renderQuarterlyBreakdown()}
        </div>

        <!-- Seasonal Analysis -->
        <h3 style="
          margin: clamp(32px, 6vw, 48px) 0 clamp(16px, 3vw, 24px) 0;
          font-size: clamp(18px, 4vw, 24px);
          color: #1f2937;
        ">
          🌍 Seasonal Patterns
        </h3>
        <div style="
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(min(140px, 100%), 1fr));
          gap: clamp(12px, 3vw, 20px);
          margin-bottom: clamp(20px, 4vw, 32px);
        ">
          ${renderSeasonalAnalysis()}
        </div>

        <!-- Monthly Chart -->
        <h3 style="
          margin: clamp(32px, 6vw, 48px) 0 clamp(16px, 3vw, 24px) 0;
          font-size: clamp(18px, 4vw, 24px);
          color: #1f2937;
        ">
          📈 Monthly Timeline
        </h3>
        <div style="
          background: #f9fafb;
          padding: clamp(16px, 4vw, 24px);
          border-radius: 12px;
          margin-bottom: clamp(20px, 4vw, 32px);
        ">
          ${renderMonthlyChart()}
        </div>

        <!-- Insights -->
        <div style="
          background: #fffbeb;
          padding: clamp(16px, 4vw, 24px);
          border-radius: 12px;
          border-left: 6px solid #f59e0b;
          margin: clamp(20px, 4vw, 32px) 0;
        ">
          <h3 style="
            margin-top: 0;
            color: #92400e;
            font-size: clamp(18px, 4vw, 22px);
            display: flex;
            align-items: center;
            gap: 8px;
          ">
            💡 Key Insights
          </h3>
          ${renderInsights()}
        </div>

        <!-- Category Breakdown -->
        <h3 style="
          margin: clamp(32px, 6vw, 48px) 0 clamp(16px, 3vw, 24px) 0;
          font-size: clamp(18px, 4vw, 24px);
          color: #1f2937;
        ">
          🏷️ Category Analysis
        </h3>
        <div style="
          overflow-x: auto;
          margin-bottom: clamp(24px, 5vw, 40px);
          -webkit-overflow-scrolling: touch;
        ">
          <table style="
            border-collapse: collapse;
            width: 100%;
            min-width: 400px;
            border-radius: 12px;
            overflow: hidden;
            box-shadow: 0 4px 12px rgba(0,0,0,0.1);
          ">
            <thead style="
              background: #1f2937;
              color: white;
            ">
              <tr>
                <th style="
                  padding: clamp(12px, 3vw, 16px);
                  font-size: clamp(12px, 2.5vw, 14px);
                  text-align: left;
                ">
                  Category
                </th>
                <th style="
                  padding: clamp(12px, 3vw, 16px);
                  font-size: clamp(12px, 2.5vw, 14px);
                  text-align: right;
                ">
                  Amount
                </th>
                <th style="
                  padding: clamp(12px, 3vw, 16px);
                  font-size: clamp(12px, 2.5vw, 14px);
                  text-align: right;
                ">
                  % of Total
                </th>
              </tr>
            </thead>
            <tbody>
              ${renderCategoryTable()}
            </tbody>
          </table>
        </div>

        <!-- Recommendations -->
        <div style="
          background: #eff6ff;
          padding: clamp(20px, 4vw, 32px);
          border-radius: 12px;
          margin: clamp(24px, 5vw, 40px) 0;
          text-align: center;
        ">
          <h3 style="
            margin-top: 0;
            color: #1e40af;
            font-size: clamp(18px, 4vw, 24px);
          ">
            🎯 Next Steps
          </h3>
          <p style="
            margin: clamp(12px, 3vw, 20px) 0;
            color: #1e40af;
            font-size: clamp(14px, 3vw, 16px);
          ">
            Use these insights to optimize your financial strategy for next year
          </p>
          <div style="
            margin-top: 16px;
            font-size: clamp(12px, 2.5vw, 14px);
            color: #3730a3;
          ">
            <strong>Consider:</strong> Budget adjustments • Expense tracking • Seasonal planning
          </div>
        </div>
      </div>
      
      <!-- Footer -->
      <div style="
        background: #f9fafb;
        padding: clamp(16px, 4vw, 24px);
        text-align: center;
        border-top: 1px solid #e5e7eb;
      ">
        <p style="
          margin: 0;
          color: #6b7280;
          font-size: clamp(10px, 2vw, 12px);
        ">
          Report generated on ${safeDateFormat(new Date(), 'PPPpp')}
        </p>
        <p style="
          margin: 4px 0 0 0;
          color: #9ca3af;
          font-size: clamp(10px, 2vw, 12px);
        ">
          Analysis method: ${dataStrategy.strategy ? dataStrategy.strategy.replace(/_/g, ' ') : 'default'}
        </p>
      </div>
    </div>
  `;
}

module.exports = yearlySummaryTemplate;