const XLSX = require('xlsx');
const PrisonerRecord = require("../models/PrisonerRecord");

/**
 * @desc    Upload raw ePrisons Excel file, parse rows, and insert into MongoDB
 * @route   POST /api/data/import
 * @access  all 
 */
const importDataToDb = async (req, res) => {
  try {
    // 1. Verify file presence
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'Please upload an Excel file (.xlsx, .xls, or .csv)',
      });
    }

    console.log(`📄 Received file for import: ${req.file.originalname}`);

    // 2. Read Excel workbook directly from memory buffer
    const workbook = XLSX.read(req.file.buffer, { type: 'buffer' });

    // 3. Extract target sheet name & worksheet data
    const firstSheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[firstSheetName];

    // 4. Convert sheet data into JSON rows
    const jsonData = XLSX.utils.sheet_to_json(worksheet);

    console.log(`📊 Extracted ${jsonData.length} rows from sheet: "${firstSheetName}"`);

    if (!jsonData || jsonData.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'The uploaded Excel sheet contains no data rows.',
      });
    }

    // 5. Bulk insert records into MongoDB using PrisonerRecord model
    // { ordered: false } allows valid documents to insert even if duplicate key errors occur
    const insertedRecords = await PrisonerRecord.insertMany(jsonData, { ordered: false });

    return res.status(201).json({
      success: true,
      message: `Successfully imported ${insertedRecords.length} prisoner records into MongoDB.`,
      count: insertedRecords.length,
      sampleRecord: insertedRecords[0],
    });

  } catch (error) {
    console.error('❌ Error during Excel file extraction/MongoDB import:', error);

    // Mongoose BulkWriteError / Duplicate handling
    if (error.name === 'BulkWriteError' || error.code === 11000) {
      return res.status(207).json({
        success: true,
        message: 'Partial import completed. Some duplicate records were skipped.',
        insertedCount: error.result ? error.result.nInserted : 0,
      });
    }

    return res.status(500).json({
      success: false,
      message: 'Failed to process Excel file and save to database.',
      error: error.message,
    });
  }
};


/**
 * @desc    Get the latest uploaded record and overall record metadata
 * @route   GET /api/data/importHistory
 * @access  All / Jail Admin
 */
const getImportHistory = async (req, res) => {
  try {
    // 1. Get total record count in MongoDB
    const totalRecords = await PrisonerRecord.countDocuments();

    // 2. Find the single most recently inserted record (sorted by createdAt descending)
    const latestRecord = await PrisonerRecord.findOne().sort({ createdAt: -1 });

    if (!latestRecord) {
      return res.status(200).json({
        success: true,
        message: 'No prisoner records found in the database yet.',
        data: {
          totalRecords: 0,
          lastUpdated: null,
          latestRecordSample: null,
        },
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Upload history fetched successfully.',
      data: {
        totalRecords,
        lastUpdated: latestRecord.createdAt || latestRecord.updatedAt || null,
        latestRecordSample: latestRecord,
      },
    });
  } catch (error) {
    console.error('❌ Error fetching import history:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve import history.',
      error: error.message,
    });
  }
};

module.exports = {
  importDataToDb,
  getImportHistory,
};