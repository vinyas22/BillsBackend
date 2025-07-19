const express = require('express');
const cors = require('cors');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5001;

app.use(cors());
app.use(express.json());

/**
 * ✅ Mount test routes FIRST — completely bypasses auth middleware
 */
app.use('/api/test', require('./routes/testRoutes')); // ⬅️ move to top!
app.get('/api/test', async (req, res) => {
  try {
    const generateMonthlyReports = require('../jobs/generateMonthlyReports');
    await generateMonthlyReports();
    res.json({ message: 'Monthly reports generated successfully' });
  } catch (error) {
    console.error('Error running monthly reports:', error);
    res.status(500).json({ error: 'Failed to generate monthly reports' });
  }
});
// Protected routes (that require tokens)
app.use('/api/auth', require('./routes/authRoutes'));
app.use('/api/bills', require('./routes/billRoutes'));
app.use('/api/entries', require('./routes/entryRoutes'));
app.use('/api', require('./routes/reportRoutes'));

// Scheduled background jobs
require('../jobs/weeklyReportCron');
require('../jobs/dailyReminder');

app.get('/', (req, res) => {
  res.send('Work Billing API Running');
});
// Add this route to test monthly reports


app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
