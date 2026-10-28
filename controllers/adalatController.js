// /controllers/adalatController.js
const AdalatAppearanceLog = require('../models/AdalatAppearanceLog');

/**
 * @desc    POST - Enter the entire list of Adalat appearance records
 * @route   POST /api/adalat
 */
const postAdalatEntries = async (req, res) => {
  try {
    const { entries } = req.body;

    if (!entries || !Array.isArray(entries) || entries.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Please provide a valid array of adalat entries.',
      });
    }

    // 1. Deduplicate entries inside the incoming array payload
    const seenKeys = new Set();
    const uniqueIncomingEntries = entries.filter((entry) => {
      const key = `${entry.utNumber}_${entry.firNumber}_${new Date(entry.hearingDate).toISOString()}_${entry.appearanceMode}`;
      if (seenKeys.has(key)) return false;
      seenKeys.add(key);
      return true;
    });

    const createdLogs = [];

    for (const entry of uniqueIncomingEntries) {
      const {
        utNumber,
        prisonerName,
        fatherName,
        barrack = '6-B',
        firNumber,
        actSection = 'N/A',
        hearingDate,
        appearanceMode,
        actionCategory = 'Jail Adalat',
        attended = true,
        nonAttendanceReason = 'N/A',
        remarks = '',
        courtName = 'District Court',
        district = 'Gorakhpur',
        custodyStatus = 'ACTIVE_CUSTODY',
        warrantType = '167/187',
      } = entry;

      const parsedHearingDate = new Date(hearingDate);

      // 2. Check if identical record already exists in the database
      const duplicateInDb = await AdalatAppearanceLog.findOne({
        utNumber,
        firNumber,
        hearingDate: parsedHearingDate,
        appearanceMode,
      });

      if (duplicateInDb) {
        continue; // Skip existing record
      }

      // 3. Fetch previous log for transitions state tracking
      const existingPreviousLog = await AdalatAppearanceLog.findOne({
        utNumber,
        firNumber,
      }).sort({ createdAt: -1 });

      const prevWarrant = existingPreviousLog ? existingPreviousLog.warrantType : null;
      const prevCourt = existingPreviousLog ? existingPreviousLog.courtName : null;
      const prevStatus = existingPreviousLog ? existingPreviousLog.custodyStatus : null;

      const now = new Date();

      const appearanceLog = new AdalatAppearanceLog({
        utNumber,
        prisonerName,
        fatherName,
        barrack,
        firNumber,
        actSection,
        hearingDate: parsedHearingDate,
        appearanceMode,
        actionCategory,
        attended,
        nonAttendanceReason: attended ? 'N/A' : nonAttendanceReason,
        remarks,
        courtName,
        district,
        custodyStatus,
        warrantType,
        warrantTypeTransition: {
          fromWarrant: prevWarrant,
          toWarrant: warrantType,
          changedAt: now,
        },
        courtTransition: {
          fromCourt: prevCourt,
          toCourt: courtName,
          changedAt: now,
        },
        custodyStatusTransition: {
          fromStatus: prevStatus,
          toStatus: custodyStatus,
          changedAt: now,
        },
      });

      await appearanceLog.save();
      createdLogs.push(appearanceLog);
    }

    return res.status(201).json({
      success: true,
      message: `${createdLogs.length} unique Adalat entries created.`,
      skipped: entries.length - createdLogs.length,
      data: createdLogs,
    });
  } catch (error) {
    console.error('Error in postAdalatEntries:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error while inserting Adalat entries.',
      error: error.message,
    });
  }
};

/**
 * @desc    PUT - Update specific data in an existing Adalat log by record ID
 * @route   PUT /api/adalat/:id
 */
const putAdalatEntry = async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    const existingLog = await AdalatAppearanceLog.findById(id);
    if (!existingLog) {
      return res.status(404).json({
        success: false,
        message: 'Adalat entry log not found.',
      });
    }

    const now = new Date();
    const updates = { ...updateData };

    // Track Warrant Transition if changed
    if (updateData.warrantType && updateData.warrantType !== existingLog.warrantType) {
      updates.warrantTypeTransition = {
        fromWarrant: existingLog.warrantType,
        toWarrant: updateData.warrantType,
        changedAt: now,
      };
    }

    // Track Court Transition if changed
    if (updateData.courtName && updateData.courtName !== existingLog.courtName) {
      updates.courtTransition = {
        fromCourt: existingLog.courtName,
        toCourt: updateData.courtName,
        changedAt: now,
      };
    }

    // Track Custody Status Transition if changed
    if (updateData.custodyStatus && updateData.custodyStatus !== existingLog.custodyStatus) {
      updates.custodyStatusTransition = {
        fromStatus: existingLog.custodyStatus,
        toStatus: updateData.custodyStatus,
        changedAt: now,
      };
    }

    const updatedLog = await AdalatAppearanceLog.findByIdAndUpdate(id, updates, {
      new: true,
      runValidators: true,
    });

    return res.status(200).json({
      success: true,
      message: 'Adalat entry updated successfully.',
      data: updatedLog,
    });
  } catch (error) {
    console.error('Error in putAdalatEntry:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error while updating Adalat entry.',
      error: error.message,
    });
  }
};

/**
 * @desc    GET - Get all Adalat entries for a specific date (Format: YYYY-MM-DD)
 * @route   GET /api/adalat/date/:date
 */
const getAdalatByDate = async (req, res) => {
  try {
    const { date } = req.params; // e.g. '2026-10-26'

    if (!date) {
      return res.status(400).json({
        success: false,
        message: 'Please provide a valid date parameter.',
      });
    }

    // Set full 24-hour range for specified date
    const startOfDay = new Date(date);
    startOfDay.setUTCHours(0, 0, 0, 0);

    const endOfDay = new Date(date);
    endOfDay.setUTCHours(23, 59, 59, 999);

    const adalatList = await AdalatAppearanceLog.find({
      hearingDate: { $gte: startOfDay, $lte: endOfDay },
    }).sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      count: adalatList.length,
      date,
      data: adalatList,
    });
  } catch (error) {
    console.error('Error in getAdalatByDate:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error while fetching Adalat list by date.',
      error: error.message,
    });
  }
};

/**
 * @desc    DELETE - Delete a unique Adalat entry by MongoDB Record ID
 * @route   DELETE /api/adalat/:id
 */
const deleteAdalatEntry = async (req, res) => {
  try {
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({
        success: false,
        message: 'Please provide a valid record ID for deletion.',
      });
    }

    const deletedEntry = await AdalatAppearanceLog.findByIdAndDelete(id);

    if (!deletedEntry) {
      return res.status(404).json({
        success: false,
        message: 'Adalat record not found in the database.',
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Adalat entry successfully deleted from the database.',
      data: deletedEntry,
    });
  } catch (error) {
    console.error('Error in deleteAdalatEntry:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error while deleting the Adalat entry.',
      error: error.message,
    });
  }
};

/**
 * @desc    GET - Purges duplicate records across the entire collection
 * @route   GET /api/adalat/cleanup-duplicates
 */
const removeDuplicateAdalatRecords = async (req, res) => {
  try {
    const records = await AdalatAppearanceLog.find({}).sort({ createdAt: -1 });

    const seenMap = new Map();
    const duplicateIds = [];

    for (const record of records) {
      if (!record.utNumber || !record.hearingDate) continue;

      const dateStr = new Date(record.hearingDate).toISOString().split('T')[0];
      const utKey = record.utNumber.trim().toUpperCase();
      const modeKey = (record.appearanceMode || 'SESSION_ADALAT').toUpperCase();

      const signature = `${utKey}_${dateStr}_${modeKey}`;

      if (seenMap.has(signature)) {
        duplicateIds.push(record._id);
      } else {
        seenMap.set(signature, record._id);
      }
    }

    if (duplicateIds.length > 0) {
      await AdalatAppearanceLog.deleteMany({ _id: { $in: duplicateIds } });

      return res.status(200).json({
        success: true,
        message: `Successfully removed ${duplicateIds.length} duplicate entries across all dates.`,
        deletedCount: duplicateIds.length,
        totalUniqueRecordsRemaining: seenMap.size,
      });
    }

    return res.status(200).json({
      success: true,
      message: 'No duplicate entries found in the collection. Database is already clean.',
      deletedCount: 0,
      totalUniqueRecordsRemaining: seenMap.size,
    });
  } catch (error) {
    console.error('[Cleanup Error] Failed to remove duplicate records:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to process cleanup operation.',
      error: error.message,
    });
  }
};

module.exports = {
  postAdalatEntries,
  putAdalatEntry,
  getAdalatByDate,
  deleteAdalatEntry,
  removeDuplicateAdalatRecords,
};