
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
  getAllConvictedPrisoners,
} = require('../controllers/fetchRecordsController');

router.get('/users', getPrisonerRecords);
router.get('/search-ut', getRecordsByRegisterNo);
router.get('/court', getRecordsByCourt);
router.get('/duty', getRecordsByDutyPoint);
router.get('/insights', getPrisonerInsights);
router.get('/all',getAllPrisoners); // used in frontend users side All Prisoners side nav
router.get('/convicted', getAllConvictedPrisoners); // veeru get all convicted
router.put('/:id', updatePrisoner); // at frontend all prisoners Update 

module.exports = router;



