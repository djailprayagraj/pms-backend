const express = require('express');
const router = express.Router();
const { getAdalatLogs, getIndividualPrisonerStats } = require('../controllers/statsController');

// GET /api/statsLog/logs?startDate=2026-01-01&endDate=2026-03-31&warrantType=167/187&appearanceMode=VC
router.get('/logs', getAdalatLogs);



// GET /api/statsLog/individual
router.get('/individual', getIndividualPrisonerStats);




module.exports = router;