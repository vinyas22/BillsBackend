const { sendWeeklyReportEmail } = require('./toolbox/emailService');

const dummyHtml = `
  <h2>Hello!</h2>
  <p>This is a test weekly report email.</p>
`;

sendWeeklyReportEmail('vinyasb18@gmail.com', 'Test Email', dummyHtml)
  .then(() => console.log('Test email sent ✅'))
  .catch(err => console.error('Error sending test email ❌', err));
