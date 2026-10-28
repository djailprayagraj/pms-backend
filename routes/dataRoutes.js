const express = require('express');
const router = express.Router();
const multer = require('multer');
const { importDataToDb, getImportHistory } = require('../controllers/importDataToDb');

// Configure multer to store the file in memory buffer (matches req.file.buffer in your controller)
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

// Access - to all
// POST /api/data/import
// data - file (expects multipart/form-data with key 'file')
router.post('/import', upload.single('file'), importDataToDb);

// GET /api/data/importHistory - Get last updated timestamp & history
router.get('/importHistory', getImportHistory);

module.exports = router;