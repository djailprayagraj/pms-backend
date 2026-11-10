const AdalatAppearanceLog = require('../models/AdalatAppearanceLog');
const PrisonerRecord = require('../models/PrisonerRecord');

// ==========================================
// 1. FETCH LOGS (Fixed Exact Boundary Matching)
// GET /api/universal-adalat/logs
// ==========================================
exports.getAdalatLogs = async (req, res) => {
  try {
    const { utNumber, firNumber, hearingDate, custodyStatus, page = 1, limit = 100 } = req.query;

    let filter = {};

    // FIX: Anchor regex with ^ and $ to force exact match (prevents 752/26 matching 3752/26)
    if (utNumber && utNumber.trim()) {
      const cleanUt = utNumber.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); // Escape special regex chars
      filter.utNumber = { $regex: `^${cleanUt}$`, $options: 'i' };
    }

    // FIX: Exact anchor match for FIR/Crime number as well
    if (firNumber && firNumber.trim()) {
      const cleanFir = firNumber.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      filter.firNumber = { $regex: `^${cleanFir}$`, $options: 'i' };
    }

    if (hearingDate) {
      const startOfDay = new Date(hearingDate);
      startOfDay.setUTCHours(0, 0, 0, 0);

      const endOfDay = new Date(hearingDate);
      endOfDay.setUTCHours(23, 59, 59, 999);

      filter.hearingDate = { $gte: startOfDay, $lte: endOfDay };
    }

    if (custodyStatus) {
      filter.custodyStatus = custodyStatus;
    }

    const logs = await AdalatAppearanceLog.find(filter)
      .sort({ hearingDate: -1, createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(Number(limit))
      .lean();

    const total = await AdalatAppearanceLog.countDocuments(filter);

    return res.status(200).json({
      success: true,
      count: logs.length,
      total,
      data: logs,
    });
  } catch (error) {
    console.error('Error fetching Adalat logs:', error);
    return res.status(500).json({
      success: false,
      message: 'Server Error fetching Adalat logs',
      error: error.message,
    });
  }
};

// ==========================================
// 2. CREATE A SINGLE ADALAT ENTRY
// POST /api/universal-adalat/log
// ==========================================
exports.createAdalatEntry = async (req, res) => {
  try {
    const {
      utNumber,
      prisonerName,
      fatherName,
      gender,
      barrack,
      firNumber,
      actSection,
      hearingDate,
      appearanceMode,
      actionCategory,
      attended,
      nonAttendanceReason,
      remarks,
      courtName,
      district,
      custodyStatus,
      warrantType,
      warrantCount,
    } = req.body;

    if (!utNumber || !prisonerName || !fatherName || !firNumber || !courtName || !warrantType) {
      return res.status(400).json({
        success: false,
        message: 'UT Number, Prisoner Name, Father Name, FIR Number, Court Name, and Warrant Type are required.',
      });
    }

    const newLog = new AdalatAppearanceLog({
      utNumber: utNumber.trim(),
      prisonerName: prisonerName.trim(),
      fatherName: fatherName.trim(),
      gender: gender || 'Male',
      barrack: barrack ? barrack.trim() : '6-B',
      firNumber: firNumber.trim(),
      actSection: actSection ? actSection.trim() : '',
      hearingDate: hearingDate ? new Date(hearingDate) : new Date(),
      appearanceMode: appearanceMode || 'VC',
      actionCategory: actionCategory || 'Jail Adalat',
      attended: attended !== undefined ? attended : true,
      nonAttendanceReason: nonAttendanceReason || 'N/A',
      remarks: remarks ? remarks.trim() : '',
      courtName: courtName.trim(),
      district: district || 'Prayagraj',
      custodyStatus: custodyStatus || 'ACTIVE_CUSTODY',
      warrantType,
      warrantCount: warrantCount ? Number(warrantCount) : 1,
    });

    await newLog.save();

    return res.status(201).json({
      success: true,
      message: 'Adalat Log entry created successfully',
      data: newLog,
    });
  } catch (error) {
    console.error('Error creating Adalat log:', error);

    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        message: 'Duplicate record exists for this UT, FIR, Date, and Appearance Mode.',
      });
    }

    return res.status(500).json({
      success: false,
      message: 'Failed to create Adalat log entry',
      error: error.message,
    });
  }
};

// ==========================================
// 3. UPDATE LOG BY ID
// PUT /api/universal-adalat/:id
// ==========================================
exports.updateAdalatEntryById = async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = { ...req.body };

    const existingLog = await AdalatAppearanceLog.findById(id);
    if (!existingLog) {
      return res.status(404).json({
        success: false,
        message: 'Adalat Log entry not found.',
      });
    }

    if (updateData.warrantType && updateData.warrantType !== existingLog.warrantType) {
      updateData.warrantTypeTransition = {
        fromWarrant: existingLog.warrantType,
        toWarrant: updateData.warrantType,
        changedAt: new Date(),
      };
    }

    if (updateData.courtName && updateData.courtName !== existingLog.courtName) {
      updateData.courtTransition = {
        fromCourt: existingLog.courtName,
        toCourt: updateData.courtName,
        changedAt: new Date(),
      };
    }

    if (updateData.custodyStatus && updateData.custodyStatus !== existingLog.custodyStatus) {
      updateData.custodyStatusTransition = {
        fromStatus: existingLog.custodyStatus,
        toStatus: updateData.custodyStatus,
        changedAt: new Date(),
      };
    }

    const updatedLog = await AdalatAppearanceLog.findByIdAndUpdate(
      id,
      { $set: updateData },
      { new: true, runValidators: true }
    );

    return res.status(200).json({
      success: true,
      message: 'Adalat Log updated successfully',
      data: updatedLog,
    });
  } catch (error) {
    console.error('Error updating Adalat log by ID:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to update Adalat log entry',
      error: error.message,
    });
  }
};

// ==========================================
// 4. UPDATE LOG BY UT NUMBER
// PUT /api/universal-adalat/ut/:utNumber
// ==========================================
exports.updateAdalatEntryByUt = async (req, res) => {
  try {
    const { utNumber } = req.params;
    const decodedUt = decodeURIComponent(utNumber).trim();
    const updateData = req.body;

    // Use exact match for bulk UT update
    const result = await AdalatAppearanceLog.updateMany(
      { utNumber: decodedUt },
      { $set: updateData }
    );

    return res.status(200).json({
      success: true,
      message: `Updated entries matching UT Number: ${decodedUt}`,
      modifiedCount: result.modifiedCount,
    });
  } catch (error) {
    console.error('Error updating Adalat log by UT:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to update entries by UT Number',
      error: error.message,
    });
  }
};

// ==========================================
// 5. DELETE LOG ENTRY BY ID
// DELETE /api/universal-adalat/:id
// ==========================================
exports.deleteAdalatEntry = async (req, res) => {
  try {
    const { id } = req.params;

    const deletedLog = await AdalatAppearanceLog.findByIdAndDelete(id);

    if (!deletedLog) {
      return res.status(404).json({
        success: false,
        message: 'Log entry not found',
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Log entry deleted successfully',
      data: deletedLog,
    });
  } catch (error) {
    console.error('Error deleting Adalat log:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to delete Adalat log entry',
      error: error.message,
    });
  }
};

// ==========================================
// 6. BULK REPLACE COURT NAMES (Master Record)
// PUT /api/universal-adalat/bulk-update-court
// ==========================================
exports.bulkReplaceMasterCourtName = async (req, res) => {
  try {
    const { targetCourt, newCourt } = req.body;

    if (!targetCourt || newCourt === undefined) {
      return res.status(400).json({
        success: false,
        message: 'Both targetCourt and newCourt string values are required.',
      });
    }

    const cleanTarget = targetCourt.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const filter = {
      'Court Name': { $regex: new RegExp(`^${cleanTarget}$`, 'i') },
    };

    const result = await PrisonerRecord.updateMany(filter, {
      $set: { 'Court Name': newCourt },
    });

    return res.status(200).json({
      success: true,
      message: `Successfully replaced ${result.modifiedCount} records from "${targetCourt}" to "${newCourt}".`,
      modifiedCount: result.modifiedCount,
    });
  } catch (error) {
    console.error('Error performing bulk court name replace:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to execute bulk court update',
      error: error.message,
    });
  }
};