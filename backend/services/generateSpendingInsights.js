// generateSpendingInsights.js

function generateSpendingInsights(report, type = 'monthly') {
  const insights = [];
  const daily = report.daily || [];
  const categories = report.category || [];
  const previous = report.previousMonth || report.previousPeriod || null;

  // Total spend & savings
  const total = report.totalExpense || 0;
  const savings = report.savings || 0;

  // 1. No-spend days
  const noSpendDays = daily.filter(d => d.total === 0).length;
  if (noSpendDays >= 3) {
    insights.push({
      icon: '🧘',
      message: `You had ${noSpendDays} no-spend day${noSpendDays > 1 ? 's' : ''} — great self-control!`
    });
  }

  // 2. High-spend days (over ₹3000)
  const highSpendDays = daily.filter(d => d.total >= 3000);
  if (highSpendDays.length > 0) {
    insights.push({
      icon: '💸',
      message: `${highSpendDays.length} day${highSpendDays.length > 1 ? 's' : ''} exceeded ₹3,000 in spending. Watch for costly days.`
    });
  }

  // 3. Most expensive day
  const topDay = daily.reduce((max, curr) => (curr.total > max.total ? curr : max), { total: 0 });
  if (topDay.total > 0) {
    insights.push({
      icon: '📅',
      message: `Your most expensive day was ${topDay.date}, spending ₹${topDay.total.toLocaleString('en-IN')}.`
    });
  }

  // 4. Top spending category
  const topCategory = [...categories].sort((a, b) => b.amount - a.amount)[0];
  if (topCategory) {
    insights.push({
      icon: '🏷️',
      message: `Top spending category: ${topCategory.category} — ₹${topCategory.amount.toLocaleString('en-IN')}`
    });
  }

  // 5. Wants vs Needs (basic assumption)
  const needCategories = ['Rent', 'Groceries', 'Bills', 'Transport'];
  let needSpend = 0;
  let wantSpend = 0;
  for (const cat of categories) {
    if (needCategories.includes(cat.category)) needSpend += cat.amount;
    else wantSpend += cat.amount;
  }

  const wantPct = ((wantSpend / (total || 1)) * 100).toFixed(1);
  if (wantSpend > 0) {
    insights.push({
      icon: wantPct > 40 ? '⚠️' : '🧠',
      message: `Spending on "wants" was ${wantPct}% of your total. Aim for below 30% to grow savings.`
    });
  }

  // 6. Repeated purchases in same category
  const repeatCategory = categories.find(c => c.count && c.count >= 8);
  if (repeatCategory) {
    insights.push({
      icon: '🔁',
      message: `You spent in "${repeatCategory.category}" ${repeatCategory.count} times — consider consolidating purchases.`
    });
  }

  // 7. Compare with previous period
  if (previous && previous.totalExpense) {
    const change = total - previous.totalExpense;
    const pctChange = ((change / previous.totalExpense) * 100).toFixed(1);

    if (Math.abs(pctChange) > 10) {
      insights.push({
        icon: change > 0 ? '📈' : '📉',
        message: `Spending ${change > 0 ? 'increased' : 'decreased'} by ₹${Math.abs(change).toLocaleString()} (${Math.abs(pctChange)}%) compared to last ${type}.`
      });
    }
  }

  // 8. Positive reinforcement for saving
  if (savings >= 3000) {
    insights.push({
      icon: '💰',
      message: `You saved ₹${savings.toLocaleString()} this ${type} — keep it up!`
    });
  }

  // 9. Generic awareness tip (rotating)
  const tips = [
    "Avoid impulse buys — wait 24 hours before making a purchase.",
    "Try a no-spend weekend to reset your budget.",
    "Track subscriptions — they quietly drain your wallet.",
    "Small expenses daily add up fast — stay mindful.",
    "Set a weekly category limit to control overspending."
  ];
  const randomTip = tips[Math.floor(Math.random() * tips.length)];
  insights.push({
    icon: '💡',
    message: randomTip
  });

  return insights;
}

module.exports = generateSpendingInsights;
