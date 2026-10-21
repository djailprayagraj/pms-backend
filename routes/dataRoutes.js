const express = require('express');
const router = express.Router();
const { importDataToDb } = require('../controllers/importDataToDb');

// Define the route: GET /api/data/import
router.get('/import', importDataToDb);

module.exports = router;