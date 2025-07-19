const pool = require('../db');

const addEntryGroup = async (req, res) => {
  const billId = req.params.billId;
  const { entry_date, items } = req.body;
  const userId = req.user.userId;

  try {
    const totalDebit = items.reduce((sum, item) => sum + Number(item.amount), 0);

    const entryResult = await pool.query(
      'INSERT INTO daily_entries (bill_id, entry_date, total_debit) VALUES ($1, $2, $3) RETURNING id',
      [billId, entry_date, totalDebit]
    );
    const dailyEntryId = entryResult.rows[0].id;

    const itemInsertPromises = items.map(item =>
      pool.query(
        'INSERT INTO entry_items (daily_entry_id, category, description, amount, proof_url) VALUES ($1, $2, $3, $4, $5)',
        [dailyEntryId, item.category, item.description, item.amount, item.proof_url || null]
      )
    );
    await Promise.all(itemInsertPromises);

    await pool.query(
      'UPDATE work_bills SET total_balance = total_balance - $1 WHERE id = $2',
      [totalDebit, billId]
    );

    await pool.query(
      'INSERT INTO activity_logs (user_id, action, detail) VALUES ($1, $2, $3)',
      [userId, 'Add Entry Group', `Bill ID: ${billId}, Date: ${entry_date}, Debit: ${totalDebit}`]
    );

    res.status(201).json({ message: 'Entry group added', dailyEntryId });
  } catch (err) {
    res.status(500).json({ error: 'Failed to add entry group', details: err.message });
  }
};

module.exports = { addEntryGroup };


const getBillEntries = async (req, res) => {
  const billId = req.params.billId;

  try {
    const entries = await pool.query(
      "SELECT * FROM daily_entries WHERE bill_id = $1 ORDER BY entry_date DESC",
      [billId]
    );

    const allEntries = await Promise.all(entries.rows.map(async (entry) => {
      const items = await pool.query(
        "SELECT * FROM entry_items WHERE daily_entry_id = $1",
        [entry.id]
      );
      return { ...entry, items: items.rows };
    }));

    res.json(allEntries);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch entries', details: err.message });
  }
};



module.exports = { addEntryGroup, getBillEntries };
