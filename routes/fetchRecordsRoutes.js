
const express = require('express');
const router = express.Router();
const {
  getPrisonerRecords,
  getRecordsByRegisterNo,
  getRecordsByCourt,
  getRecordsByDutyPoint,
  getPrisonerInsights
} = require('../controllers/fetchRecordsController');

router.get('/users', getPrisonerRecords);
router.get('/search-ut', getRecordsByRegisterNo);
router.get('/court', getRecordsByCourt);
router.get('/duty', getRecordsByDutyPoint);
router.get('/insights', getPrisonerInsights);

module.exports = router;



