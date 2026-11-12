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

    // 5. Detect file type based on whether the 'location' or 'Location' column exists
    const hasLocationColumn = jsonData.some(
      (row) => row.location !== undefined || row.Location !== undefined
    );

    if (hasLocationColumn) {
      // ==========================================
      // SCENARIO A: Location-Only File Upload
      // ==========================================
      const bulkOperations = jsonData
        .filter((row) => row.RegisterNo && String(row.RegisterNo).trim() !== '')
        .map((row) => {
          const locValue = row.location !== undefined ? row.location : row.Location;
          return {
            updateMany: {
              filter: { RegisterNo: String(row.RegisterNo).trim() },
              update: {
                $set: {
                  location: String(locValue).trim().toUpperCase(),
                },
              },
            },
          };
        });

      if (bulkOperations.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'No valid RegisterNo entries found in the location sheet.',
        });
      }

      const bulkResult = await PrisonerRecord.bulkWrite(bulkOperations, { ordered: false });

      return res.status(200).json({
        success: true,
        message: `Location sync completed. Matched ${bulkResult.matchedCount} records and updated ${bulkResult.modifiedCount} records.`,
        matchedCount: bulkResult.matchedCount,
        modifiedCount: bulkResult.modifiedCount,
      });

    } else {
      // ==========================================
      // SCENARIO B: Full Prisoner Data File Upload
      // ==========================================
      const bulkOperations = jsonData.map((row) => {
        // Sanitize keys to fix MongoDB trailing dot errors (e.g., "Case No." -> "Case No")
        const sanitizedRow = {};
        Object.keys(row).forEach((key) => {
          const cleanKey = key.trim().endsWith('.') ? key.trim().slice(0, -1) : key.trim();
          sanitizedRow[cleanKey] = row[key];
        });

        const registerNo = sanitizedRow.RegisterNo ? String(sanitizedRow.RegisterNo).trim() : '';
        const firNo = sanitizedRow['FIR/Case No'] ? String(sanitizedRow['FIR/Case No']).trim() : '';

        // Composite filter to uniquely identify a case/record without duplicates
        const filter = firNo && registerNo 
          ? { RegisterNo: registerNo, 'FIR/Case No': firNo } 
          : { RegisterNo: registerNo };

        return {
          updateOne: {
            filter: filter,
            update: { $set: sanitizedRow },
            upsert: true // Inserts if new, updates in-place if it already exists
          }
        };
      });

      if (bulkOperations.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'The uploaded data sheet contains no valid records.',
        });
      }

      const bulkResult = await PrisonerRecord.bulkWrite(bulkOperations, { ordered: false });

      return res.status(201).json({
        success: true,
        message: `Successfully processed full data import.`,
        upsertedCount: bulkResult.upsertedCount,
        modifiedCount: bulkResult.modifiedCount,
      });
    }

  } catch (error) {
    console.error('❌ Error during Excel file extraction/MongoDB import:', error);

    if (error.name === 'BulkWriteError' || error.code === 11000) {
      return res.status(207).json({
        success: true,
        message: 'Partial import completed with some duplicate key conflicts handled.',
        error: error.message,
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