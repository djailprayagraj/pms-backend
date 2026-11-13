const express = require('express');
const router = express.Router();
const {
  postAdalatEntries,
  putAdalatEntryByUtNumber,
  getAdalatByDate,
  deleteAdalatEntry,
  removeDuplicateAdalatRecords,
  getAllCourts,
  feedNewCourt,
  getNextHearingRecords,
  updateNextHearingDate,
} = require('../controllers/adalatController');

// @route   POST /api/adalat/feed
// @desc    Feed list of Adalat appearance records
router.post('/feed', postAdalatEntries);          // posting a new adalat or vc entry 

// @route   PUT /api/adalat/:id
// @desc    Update specific entry data by ID (warrant type, court, status, etc.)
router.put('/ut/:utNumber', putAdalatEntryByUtNumber);

// @route   GET /api/adalat/date/:date
// @desc    Get all Adalat records for a specific date (Format: YYYY-MM-DD)
router.get('/date/:date', getAdalatByDate);

// 5. Delete single entry by record MongoDB _id
// DELETE /api/adalat/:id
router.delete('/:id', deleteAdalatEntry);


// @route  - get all courts
// @desc   - GET     /api/adalat/getAllCourts
router.get('/getAllCourts', getAllCourts);


// @route  - feed new court to the db
// @desc   - POST     /api/adalat/feedNewCourt
router.post('/getAllCourts', feedNewCourt);


router.get('/cleanData',removeDuplicateAdalatRecords);




router.get('/next-hearings', getNextHearingRecords);


router.put('/update-next-hearing', updateNextHearingDate);



module.exports = router;