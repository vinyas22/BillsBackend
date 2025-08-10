// Complete emailService.js
const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

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
      
      const waitTime = 1000 * Math.pow(2, attempt - 1);
      console.log(`⏳ Waiting ${waitTime}ms before retry...`);
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }
  }
}

async function sendMonthlyReportEmail(toEmail, subject, htmlContent, retries = 3) {
  const mailOptions = {
    from: `"Monthly Financial Reports" <${process.env.EMAIL_USER}>`,
    to: toEmail,
    subject: subject,
    html: htmlContent
  };

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const info = await transporter.sendMail(mailOptions);
      console.log(`📧 Monthly email sent to ${toEmail} (attempt ${attempt})`);
      return info;
    } catch (err) {
      console.error(`❌ Failed to send monthly email to ${toEmail} (attempt ${attempt})`, err.message);
      
      if (attempt === retries) {
        console.error(`💥 All ${retries} monthly email attempts failed for ${toEmail}`);
        throw new Error(`Failed to send monthly email after ${retries} attempts: ${err.message}`);
      }
      
      const waitTime = 1000 * Math.pow(2, attempt - 1);
      console.log(`⏳ Waiting ${waitTime}ms before monthly email retry...`);
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }
  }
}

async function sendQuarterlyReportEmail(toEmail, subject, htmlContent, retries = 3) {
  const mailOptions = {
    from: `"Quarterly Financial Reports" <${process.env.EMAIL_USER}>`,
    to: toEmail,
    subject: subject,
    html: htmlContent
  };

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const info = await transporter.sendMail(mailOptions);
      console.log(`📧 Quarterly email sent to ${toEmail} (attempt ${attempt})`);
      return info;
    } catch (err) {
      console.error(`❌ Failed to send quarterly email to ${toEmail} (attempt ${attempt})`, err.message);
      
      if (attempt === retries) {
        console.error(`💥 All ${retries} quarterly email attempts failed for ${toEmail}`);
        throw new Error(`Failed to send quarterly email after ${retries} attempts: ${err.message}`);
      }
      
      const waitTime = 1000 * Math.pow(2, attempt - 1);
      console.log(`⏳ Waiting ${waitTime}ms before quarterly email retry...`);
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }
  }
}
// Add to your existing emailService.js
async function sendYearlyReportEmail(toEmail, subject, htmlContent, retries = 3) {
  const mailOptions = {
    from: `"Yearly Financial Intelligence" <${process.env.EMAIL_USER}>`,
    to: toEmail,
    subject: subject,
    html: htmlContent
  };

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const info = await transporter.sendMail(mailOptions);
      console.log(`📧 Yearly email sent to ${toEmail} (attempt ${attempt})`);
      return info;
    } catch (err) {
      console.error(`❌ Failed to send yearly email to ${toEmail} (attempt ${attempt})`, err.message);
      
      if (attempt === retries) {
        throw new Error(`Failed to send yearly email after ${retries} attempts: ${err.message}`);
      }
      
      const waitTime = 1000 * Math.pow(2, attempt - 1);
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }
  }
}

// Update module.exports


function isValidEmail(email) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

module.exports = {
  sendWeeklyReportEmail,
  sendMonthlyReportEmail,
  sendQuarterlyReportEmail,
  isValidEmail, sendYearlyReportEmail
};
