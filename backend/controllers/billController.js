const pool = require('../db');

// Helper: validate 'YYYY-MM' format string
function isYYYYMM(val) {
  return typeof val === 'string' && /^\d{4}-\d{2}$/.test(val);
}

/**
 * Create a new monthly salary (bill) for the current user and month.
 * Expects: { title: string, total_balance: number, bill_month: 'YYYY-MM' }
 * Requires: work_bills.bill_month is VARCHAR(7) in DB!
 */
const createMonthlySalary = async (req, res) => {
  const userId = req.user.userId;
  let { title, total_balance, bill_month } = req.body;

  // Sanity/type check
  if (!title || !Number(total_balance) || !isYYYYMM(bill_month)) {
    return res.status(400).json({
      error: 'Invalid input: title, total_balance, and bill_month (YYYY-MM) are required.',
    });
  }

  try {
    // Block duplicate for user + month
    const existing = await pool.query(
      'SELECT 1 FROM work_bills WHERE user_id = $1 AND bill_month = $2',
      [userId, bill_month]
    );
    if (existing.rows.length > 0) {
      return res.status(400).json({ error: 'Salary for this month already exists.' });
    }

    // Insert new bill
    const result = await pool.query(
      `INSERT INTO work_bills (user_id, title, total_balance, bill_month, created_at)
       VALUES ($1, $2, $3, $4, NOW()) RETURNING *`,
      [userId, title, total_balance, bill_month]
    );

    return res.status(201).json({ message: 'Monthly salary created', data: result.rows[0] });
  } catch (err) {
    console.error('Failed to create salary entry:', err);
    res.status(500).json({ error: 'Failed to create salary entry', details: err.message });
  }
};

/**
 * Get all bills for logged-in user, newest first.
 */
const getBills = async (req, res) => {
  const userId = req.user.userId;

  try {
    const result = await pool.query(
      "SELECT * FROM work_bills WHERE user_id = $1 ORDER BY created_at DESC",
      [userId]
    );
    res.json(result.rows);
  } catch (err) {
    console.error('Failed to fetch bills:', err);
    res.status(500).json({ error: 'Failed to fetch bills', details: err.message });
  }
};

/**
 * Update balance of a bill by id—only if user is owner.
 * Path param: billId
 * PUT /api/bills/:billId
 * Body: { total_balance: number }
 */
const updateTotalBalance = async (req, res) => {
  const billId = req.params.billId;
  const { total_balance } = req.body;
  const userId = req.user.userId;

  // Optionally: check that total_balance is provided and numeric
  if (typeof total_balance !== 'number' || !isFinite(total_balance)) {
    return res.status(400).json({ error: 'total_balance (number) is required.' });
  }

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
    res.status(500).json({ error: 'Failed to update total balance', details: err.message });
  }
};

module.exports = {
  createMonthlySalary,
  getBills,
  updateTotalBalance
};
