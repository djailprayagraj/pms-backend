const express = require('express');
const router = express.Router();
const universalAdalatController = require('../controllers/universalAdalatController');

// 1. Fetch filtered logs
router.get('/logs', universalAdalatController.getAdalatLogs);

// 2. Create single log entry
router.post('/log', universalAdalatController.createAdalatEntry);

// 3. Update entry by MongoDB _id
router.put('/:id', universalAdalatController.updateAdalatEntryById);

// 4. Update entry by UT Number
router.put('/ut/:utNumber', universalAdalatController.updateAdalatEntryByUt);

// 5. Delete entry by ID
router.delete('/:id', universalAdalatController.deleteAdalatEntry);

// 6. Bulk replace court names in Master collection
router.put('/bulk-update-court', universalAdalatController.bulkReplaceMasterCourtName);

module.exports = router;