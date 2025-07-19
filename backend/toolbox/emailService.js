// Fixed emailService.js
const nodemailer = require('nodemailer');

// Fix: Use createTransport instead of createTransporter
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

/**
 * Send a weekly HTML email report with retry logic.
 * @param {string} toEmail - Recipient email address
 * @param {string} subject - Subject line
 * @param {string} htmlContent - Full HTML body
 * @param {number} retries - Number of retry attempts
 */
async function sendWeeklyReportEmail(toEmail, subject, htmlContent, retries = 3) {
  const mailOptions = {
    from: `"Work Billing System" <${process.env.EMAIL_USER}>`,
    to: toEmail,
    subject: subject,
    html: htmlContent
  };

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const info = await transporter.sendMail(mailOptions);
      console.log(`📧 Email sent to ${toEmail} (attempt ${attempt})`);
      return info;
    } catch (err) {
      console.error(`❌ Failed to send email to ${toEmail} (attempt ${attempt})`, err.message);
      
      if (attempt === retries) {
        console.error(`💥 All ${retries} attempts failed for ${toEmail}`);
        throw new Error(`Failed to send email after ${retries} attempts: ${err.message}`);
      }
      
      // Exponential backoff: wait 1s, 2s, 4s, etc.
      const waitTime = 1000 * Math.pow(2, attempt - 1);
      console.log(`⏳ Waiting ${waitTime}ms before retry...`);
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }
  }
}

/**
 * Validate email address format
 * @param {string} email 
 * @returns {boolean}
 */
function isValidEmail(email) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}
async function sendMonthlyReportEmail(toEmail, subject, htmlContent, retries = 3) {
  return sendWeeklyReportEmail(toEmail, subject, htmlContent, retries);
}

function isValidEmail(email) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

module.exports = {
  sendWeeklyReportEmail,
  sendMonthlyReportEmail,
  isValidEmail
};