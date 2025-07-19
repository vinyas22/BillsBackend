const cron = require('node-cron');
const pool = require('../backend/db'); // Correct relative path - assumes 'db.js' is in backend root
const sendMail = require('../backend/toolbox/mailBuddy'); // Adjust if path is different

// Main reminder function
const sendDailyReminders = async () => {
  try {
    const result = await pool.query(
      "SELECT DISTINCT u.email, u.name FROM users u JOIN work_bills w ON u.id = w.user_id WHERE u.is_verified = true"
    );

    for (const user of result.rows) {
      const html = `
        <h3>Hi ${user.name} 👋</h3>
        <p>This is a friendly reminder to add your expenses for today in your Work Billing System.</p>
        <p><a href="http://your-frontend-app.com/login">Click here to log in</a></p>
        <p style="font-size: 12px; color: gray;">This is an automated reminder.</p>
      `;
      await sendMail(user.email, "📌 Daily Reminder: Don't forget today's entry!", html);
    }

    console.log('✅ Daily reminder emails sent.');
  } catch (err) {
    console.error('❌ Error sending daily reminders:', err.message);
  }
};

// Export for manual or test triggering if needed
module.exports = sendDailyReminders;

// Direct execution for testing (optional)
if (require.main === module) {
  sendDailyReminders();
}

// Schedule job to run at 9:00 AM IST daily (server time must be IST or adjust for UTC)
// '0 9 * * *' = Every day at 09:00
cron.schedule('0 9 * * *', () => {
  console.log('⏰ Running daily reminder job...');
  sendDailyReminders();
});
