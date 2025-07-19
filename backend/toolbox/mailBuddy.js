const nodemailer = require('nodemailer');
require('dotenv').config();

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

const sendMail = async (to, subject, html) => {
  const mailOptions = {
    from: `"Work Billing App 👷‍♂️" <${process.env.EMAIL_USER}>`,
    to,
    subject,
    html
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log(`📧 Mail sent to: ${to}`);
  } catch (err) {
    console.error('❌ Mail send failed:', err.message);
  }
};

module.exports = sendMail;
