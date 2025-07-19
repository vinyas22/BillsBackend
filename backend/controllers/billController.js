const pool = require('../db');

const createMonthlySalary = async (req, res) => {
  const userId = req.user.userId;
  const { title, total_balance, bill_month } = req.body;

  try {
    // Check if entry exists for this month
    const existing = await pool.query(
      `SELECT * FROM work_bills WHERE user_id = $1 AND bill_month = $2`,
      [userId, bill_month]
    );

    if (existing.rows.length > 0) {
      return res.status(400).json({ error: 'Salary for this month already exists.' });
    }

    const result = await pool.query(
      `INSERT INTO work_bills (user_id, title, total_balance, bill_month, created_at)
       VALUES ($1, $2, $3, $4, NOW()) RETURNING *`,
      [userId, title, total_balance, bill_month]
    );

    res.status(201).json({ message: 'Monthly salary created', data: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: 'Failed to create salary entry', details: err.message });
  }
};

const getBills = async (req, res) => {
  const userId = req.user.userId;

  try {
    const result = await pool.query(
      "SELECT * FROM work_bills WHERE user_id = $1 ORDER BY created_at DESC",
      [userId]
    );

    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch bills', details: err.message });
  }
};



const updateTotalBalance = async (req, res) => {
  const billId = req.params.id;
  const { total_balance } = req.body;
  const userId = req.user.userId;

  try {
    const result = await pool.query(
      `UPDATE work_bills SET total_balance = $1 WHERE id = $2 AND user_id = $3 RETURNING *`,
      [total_balance, billId, userId]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Bill not found or not authorized' });
    }

    res.json({ message: 'Total balance updated', bill: result.rows[0] });
  } catch (err) {
    console.error('Failed to update total balance:', err);
    res.status(500).json({ error: 'Failed to update total balance' });
  }
};




module.exports = { createMonthlySalary , getBills, updateTotalBalance };
