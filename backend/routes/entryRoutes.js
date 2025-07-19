const express = require('express');
const router = express.Router();
const requireAuth = require('../middleware/requireAuth');
const { addEntryGroup, getBillEntries, getCustomReport } = require('../controllers/entryController');

router.use(requireAuth);

router.post('/:billId', addEntryGroup);
router.get('/:billId', getBillEntries)


module.exports = router;
