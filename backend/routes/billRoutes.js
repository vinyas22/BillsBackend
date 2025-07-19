const express = require('express');
const router = express.Router();
const requireAuth = require('../middleware/requireAuth');
const { createMonthlySalary, getBills, updateTotalBalance } = require('../controllers/billController');

router.use(requireAuth);

router.post('/', requireAuth, createMonthlySalary);
router.get('/', getBills);
router.put('/:billId', updateTotalBalance);
router.put('/:id/total', requireAuth, updateTotalBalance);

module.exports = router;
