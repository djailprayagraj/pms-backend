
const express = require('express');
const router = express.Router();
const {
  getPrisonerRecords,
  getRecordsByRegisterNo,
  getRecordsByCourt,
  getRecordsByDutyPoint,
  getPrisonerInsights,
  getAllPrisoners,
  updatePrisoner,
} = require('../controllers/fetchRecordsController');

router.get('/users', getPrisonerRecords);
router.get('/search-ut', getRecordsByRegisterNo);
router.get('/court', getRecordsByCourt);
router.get('/duty', getRecordsByDutyPoint);
router.get('/insights', getPrisonerInsights);
router.get('/all',getAllPrisoners); // used in frontend users side All Prisoners side nav
router.put('/:id', updatePrisoner);

module.exports = router;



