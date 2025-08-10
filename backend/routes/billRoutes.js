const express = require('express');
const router = express.Router();
const requireAuth = require('../middleware/requireAuth');
const { createMonthlySalary, getBills, updateTotalBalance } = require('../controllers/billController');

router.use(requireAuth);

// Create a new monthly salary (bill)
// POST /api/bills
router.post('/', createMonthlySalary);

// Get all bills
// GET /api/bills
router.get('/', getBills);

// Update a bill's balance
// PUT /api/bills/:billId
router.put('/:billId', updateTotalBalance);

module.exports = router;
