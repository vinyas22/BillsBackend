const express = require('express');
const router = express.Router();
const requireAuth = require('../middleware/requireAuth');
const entryController = require('../controllers/entryController');

// Secure all routes
router.use(requireAuth);

// Most-specific route first!
router.get('/categories', entryController.getCategories);

// Other routes
router.post('/:billId', entryController.addEntryGroup);
router.get('/:billId', entryController.getBillEntries);
// If you want to add more routes, do so here (e.g., custom reports)
if (entryController.getCustomReport) {
  router.get('/custom-report', entryController.getCustomReport);
}

module.exports = router;
