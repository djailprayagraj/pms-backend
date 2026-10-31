const AdalatAppearanceLog = require('../models/AdalatAppearanceLog');
const PrisonerRecord = require('../models/PrisonerRecord');

const ALLOWED_WARRANTS = ['167/187', '209/232', '309/346'];

/**
 * @desc    POST - Enter the entire list of Adalat appearance records with Gender mapping
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

    // 1. Deduplicate entries inside incoming payload array
    const seenKeys = new Set();
    const uniqueIncomingEntries = entries.filter((entry) => {
      const key = `${entry.utNumber}_${entry.firNumber}_${new Date(entry.hearingDate).toISOString()}_${entry.appearanceMode}`;
      if (seenKeys.has(key)) return false;
      seenKeys.add(key);
      return true;
    });

    const createdLogs = [];

    for (const entry of uniqueIncomingEntries) {
      let {
        utNumber,
        prisonerName,
        fatherName,
        gender: incomingGender,
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
        district = 'Prayagraj', // Updated default based on schema
        custodyStatus = 'ACTIVE_CUSTODY',
        warrantType = '167/187',
      } = entry;

      // Validate warrantType against schema enum
      if (!ALLOWED_WARRANTS.includes(warrantType)) {
        warrantType = '167/187';
      }

      const parsedHearingDate = new Date(hearingDate);

      // 2. Check for duplicate record in DB
      const duplicateInDb = await AdalatAppearanceLog.findOne({
        utNumber,
        firNumber,
        hearingDate: parsedHearingDate,
        appearanceMode,
      });

      if (duplicateInDb) {
        continue; // Skip existing record
      }

      // 3. Resolve Gender from Master PrisonerRecord if missing from payload
      let resolvedGender = incomingGender;

      if (!resolvedGender) {
        const prisonerDoc = await PrisonerRecord.findOne({
          $or: [
            { RegisterNo: utNumber },
            { utNumber: utNumber },
            { 'Prisoner Name': { $regex: utNumber, $options: 'i' } },
          ],
        }).select('Gender');

        resolvedGender = prisonerDoc?.Gender || 'Male';
      }

      // 4. Fetch previous log for transitions state tracking
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
        gender: resolvedGender,
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
 * @desc    PUT - Update existing Adalat log or create one from PrisonerRecord if missing
 * @route   PUT /api/adalat/ut/:utNumber
 */
const putAdalatEntryByUtNumber = async (req, res) => {
  try {
    const { utNumber } = req.params;
    const updateData = req.body;

    // Decode URL encoded utNumber (e.g. "3857%2F26" -> "3857/26")
    const decodedUtNumber = decodeURIComponent(utNumber);
    const now = new Date();

    let existingLog = await AdalatAppearanceLog.findOne({ utNumber: decodedUtNumber });

    // Fallback if log does not exist: Create new record from PrisonerRecord
    if (!existingLog) {
      const prisonerDoc = await PrisonerRecord.findOne({
        $or: [
          { RegisterNo: decodedUtNumber },
          { utNumber: decodedUtNumber },
          { 'Prisoner Name': { $regex: decodedUtNumber, $options: 'i' } }
        ]
      });

      if (!prisonerDoc) {
        return res.status(404).json({
          success: false,
          message: 'Adalat entry log not found and no matching Prisoner record found to create one.',
        });
      }

      let initialWarrant = updateData.warrantType || '167/187';
      if (!ALLOWED_WARRANTS.includes(initialWarrant)) {
        initialWarrant = '167/187';
      }

      const newLog = new AdalatAppearanceLog({
        utNumber: decodedUtNumber,
        prisonerName: prisonerDoc['Prisoner Name'] || prisonerDoc.prisonerName || 'Unknown',
        fatherName: prisonerDoc.fatherName || prisonerDoc.FatherName || 'N/A',
        gender: prisonerDoc.Gender || prisonerDoc.gender || 'Male',
        barrack: prisonerDoc.barrack || '6-B',
        firNumber: updateData.firNumber || prisonerDoc.firNumber || 'N/A',
        actSection: updateData.actSection || prisonerDoc.actSection || 'N/A',
        hearingDate: updateData.hearingDate ? new Date(updateData.hearingDate) : new Date(),
        appearanceMode: updateData.appearanceMode || 'SESSION_ADALAT', // Aligned with schema enum ['VC', 'SESSION_ADALAT']
        actionCategory: updateData.actionCategory || 'Jail Adalat',
        courtName: updateData.courtName || 'District Court',
        district: updateData.district || 'Prayagraj',
        custodyStatus: updateData.custodyStatus || 'ACTIVE_CUSTODY',
        warrantType: initialWarrant,
        warrantTypeTransition: {
          fromWarrant: null,
          toWarrant: initialWarrant,
          changedAt: now,
        },
        courtTransition: {
          fromCourt: null,
          toCourt: updateData.courtName || 'District Court',
          changedAt: now,
        },
        custodyStatusTransition: {
          fromStatus: null,
          toStatus: updateData.custodyStatus || 'ACTIVE_CUSTODY',
          changedAt: now,
        },
      });

      await newLog.save();

      return res.status(201).json({
        success: true,
        message: 'Adalat entry log successfully created from Prisoner record data.',
        data: newLog,
      });
    }

    // Standard Update Logic for existing log
    const updates = { ...updateData };

    if (updateData.warrantType && updateData.warrantType !== existingLog.warrantType) {
      if (!ALLOWED_WARRANTS.includes(updateData.warrantType)) {
        return res.status(400).json({
          success: false,
          message: `Invalid warrantType. Allowed values are: ${ALLOWED_WARRANTS.join(', ')}`
        });
      }

      updates.warrantTypeTransition = {
        fromWarrant: existingLog.warrantType,
        toWarrant: updateData.warrantType,
        changedAt: now,
      };
    }

    if (updateData.courtName && updateData.courtName !== existingLog.courtName) {
      updates.courtTransition = {
        fromCourt: existingLog.courtName,
        toCourt: updateData.courtName,
        changedAt: now,
      };
    }

    if (updateData.custodyStatus && updateData.custodyStatus !== existingLog.custodyStatus) {
      updates.custodyStatusTransition = {
        fromStatus: existingLog.custodyStatus,
        toStatus: updateData.custodyStatus,
        changedAt: now,
      };
    }

    const updatedLog = await AdalatAppearanceLog.findOneAndUpdate(
      { utNumber: decodedUtNumber }, 
      updates, 
      { new: true, runValidators: true }
    );

    return res.status(200).json({
      success: true,
      message: 'Adalat entry updated successfully by UT number.',
      data: updatedLog,
    });
  } catch (error) {
    console.error('Error in putAdalatEntryByUtNumber:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error while updating/creating Adalat entry.',
      error: error.message,
    });
  }
};

/**
 * @desc    GET - Get all Adalat entries for a specific date with Gender mapped
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

    const startOfDay = new Date(date);
    startOfDay.setUTCHours(0, 0, 0, 0);

    const endOfDay = new Date(date);
    endOfDay.setUTCHours(23, 59, 59, 999);

    const adalatList = await AdalatAppearanceLog.find({
      hearingDate: { $gte: startOfDay, $lte: endOfDay },
    }).sort({ createdAt: -1 });

    // Fallback mapping: Fill gender from PrisonerRecord if existing legacy rows miss it
    const mappedLogs = await Promise.all(
      adalatList.map(async (log) => {
        const logObj = log.toObject();
        if (!logObj.gender) {
          const prisoner = await PrisonerRecord.findOne({
            $or: [
              { RegisterNo: logObj.utNumber },
              { 'Prisoner Name': { $regex: logObj.utNumber, $options: 'i' } },
            ],
          }).select('Gender');

          logObj.gender = prisoner?.Gender || 'Male';
        }
        return logObj;
      })
    );

    return res.status(200).json({
      success: true,
      count: mappedLogs.length,
      date,
      data: mappedLogs,
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
  putAdalatEntryByUtNumber,
  getAdalatByDate,
  deleteAdalatEntry,
  removeDuplicateAdalatRecords,
};