const express = require('express');
const router = express.Router();
const { feedHearingEntries } = require('../controllers/hearingController'); // Adjust path to your controller

// POST /api/hearings/feed - Batch save Adalat Peshi hearing entries
router.post('/feed', feedHearingEntries);

module.exports = router;