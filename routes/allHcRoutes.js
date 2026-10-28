const express = require('express');
const router = express.Router();
const { fetchCourtData } = require('../controllers/allHcController');

// Define the route path (e.g., GET /api/court-data)
router.get('/allHc', fetchCourtData);

module.exports = router;