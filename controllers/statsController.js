// statsController.js
const AdalatAppearanceLog = require('../models/AdalatAppearanceLog');
const PrisonerRecord = require('../models/PrisonerRecord');



const getAdalatLogs = async (req, res) => {
  try {
    const {
      startDate,
      endDate,
      warrantType,
      appearanceMode,
      custodyStatus,
      attended,
      search = '',
      page = 1,
      limit = 50,
    } = req.query;

    const pageNum = parseInt(page) || 1;
    const limitNum = parseInt(limit) || 50;
    const skip = (pageNum - 1) * limitNum;

    // 1. Base Date Range Filter (Ensures summary stats cover the entire date bracket)
    const dateMatch = {};
    if (startDate || endDate) {
      dateMatch.hearingDate = {};
      if (startDate) {
        dateMatch.hearingDate.$gte = new Date(startDate);
      }
      if (endDate) {
        const endDateTime = new Date(endDate);
        endDateTime.setHours(23, 59, 59, 999);
        dateMatch.hearingDate.$lte = endDateTime;
      }
    }

    // 2. Active Table Filters for paginated rows
    const tableMatch = { ...dateMatch };

    if (warrantType && warrantType.trim() !== '' && warrantType.toUpperCase() !== 'ALL') {
      const cleanWarrant = warrantType.trim();
      if (cleanWarrant === '167') tableMatch.warrantType = '167/187';
      else if (cleanWarrant === '209') tableMatch.warrantType = '209/232';
      else if (cleanWarrant === '309') tableMatch.warrantType = '309/346';
      else tableMatch.warrantType = cleanWarrant;
    }

    if (appearanceMode && appearanceMode.trim() !== '' && appearanceMode.toUpperCase() !== 'ALL') {
      tableMatch.appearanceMode = appearanceMode.trim().toUpperCase();
    }

    if (custodyStatus && custodyStatus.trim() !== '' && custodyStatus.toUpperCase() !== 'ALL') {
      tableMatch.custodyStatus = custodyStatus.trim().toUpperCase();
    }

    if (attended !== undefined && attended !== '' && attended.toLowerCase() !== 'all') {
      tableMatch.attended = attended === 'true' || attended === true;
    }

    if (search && search.trim() !== '') {
      const regex = { $regex: search.trim(), $options: 'i' };
      tableMatch.$or = [
        { utNumber: regex },
        { prisonerName: regex },
        { firNumber: regex },
      ];
    }

    // 3. Comprehensive Aggregation Pipeline (Date-range cross-tabs + filtered pagination)
    const pipeline = [
      { $match: dateMatch },
      {
        $facet: {
          // Comprehensive backend intelligence & cross-tab calculations for date range
          dateRangeStats: [
            {
              $group: {
                _id: null,
                totalInRange: { $sum: 1 },
                // Warrant overall breakdown
                count167: { $sum: { $cond: [{ $eq: ['$warrantType', '167/187'] }, 1, 0] } },
                count209: { $sum: { $cond: [{ $eq: ['$warrantType', '209/232'] }, 1, 0] } },
                count309: { $sum: { $cond: [{ $eq: ['$warrantType', '309/346'] }, 1, 0] } },
                // Production Mode breakdown
                vcCount: { $sum: { $cond: [{ $eq: ['$appearanceMode', 'VC'] }, 1, 0] } },
                sessionCount: { $sum: { $cond: [{ $eq: ['$appearanceMode', 'SESSION_ADALAT'] }, 1, 0] } },
                // Cross-tab: VC breakdown by Warrant Type
                vc167: { $sum: { $cond: [{ $and: [{ $eq: ['$appearanceMode', 'VC'] }, { $eq: ['$warrantType', '167/187'] }] }, 1, 0] } },
                vc209: { $sum: { $cond: [{ $and: [{ $eq: ['$appearanceMode', 'VC'] }, { $eq: ['$warrantType', '209/232'] }] }, 1, 0] } },
                vc309: { $sum: { $cond: [{ $and: [{ $eq: ['$appearanceMode', 'VC'] }, { $eq: ['$warrantType', '309/346'] }] }, 1, 0] } },
                // Cross-tab: Session breakdown by Warrant Type
                session167: { $sum: { $cond: [{ $and: [{ $eq: ['$appearanceMode', 'SESSION_ADALAT'] }, { $eq: ['$warrantType', '167/187'] }] }, 1, 0] } },
                session209: { $sum: { $cond: [{ $and: [{ $eq: ['$appearanceMode', 'SESSION_ADALAT'] }, { $eq: ['$warrantType', '209/232'] }] }, 1, 0] } },
                session309: { $sum: { $cond: [{ $and: [{ $eq: ['$appearanceMode', 'SESSION_ADALAT'] }, { $eq: ['$warrantType', '309/346'] }] }, 1, 0] } },
              },
            },
          ],
          // Total count for table filtering & pagination
          filteredTotalCount: [{ $match: tableMatch }, { $count: 'count' }],
          // Paginated records for TanStack windowing
          paginatedLogs: [
            { $match: tableMatch },
            { $sort: { hearingDate: -1, createdAt: -1 } },
            { $skip: skip },
            { $limit: limitNum },
          ],
        },
      },
    ];

    const [result] = await AdalatAppearanceLog.aggregate(pipeline);

    const statsObj = result?.dateRangeStats?.[0] || {
      totalInRange: 0,
      count167: 0,
      count209: 0,
      count309: 0,
      vcCount: 0,
      sessionCount: 0,
      vc167: 0,
      vc209: 0,
      vc309: 0,
      session167: 0,
      session209: 0,
      session309: 0,
    };

    const filteredTotal = result?.filteredTotalCount?.[0]?.count || 0;
    const logs = result?.paginatedLogs || [];

    return res.status(200).json({
      success: true,
      stats: statsObj,
      filteredTotalCount: filteredTotal,
      currentPage: pageNum,
      totalPages: Math.ceil(filteredTotal / limitNum),
      data: logs,
    });
  } catch (error) {
    console.error('Error fetching Adalat logs:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error while fetching Adalat appearance logs.',
      error: error.message,
    });
  }
};





const getIndividualPrisonerStats = async (req, res) => {
  try {
    const {
      utNumber = '',
      firNumber = '',
      prisonerName = '',
      fatherName = '',
      startDate = '',
      endDate = '',
    } = req.query;

    const cleanUT = utNumber.trim();
    const cleanFIR = firNumber.trim();
    const cleanName = prisonerName.trim();
    const cleanFather = fatherName.trim();

    if (!cleanUT && !cleanFIR && !cleanName) {
      return res.status(400).json({
        success: false,
        message: 'Please provide UT Number, FIR Number, or Prisoner Name to search.',
      });
    }

    const matchConditions = [];

    // STRICT EXACT MATCH for UT Number using caret (^) and dollar ($) anchors
    if (cleanUT) {
      matchConditions.push({
        $or: [
          { utNumber: { $regex: `^${cleanUT}$`, $options: 'i' } },
          { registerNo: { $regex: `^${cleanUT}$`, $options: 'i' } },
        ],
      });
    }
    if (cleanFIR) {
      matchConditions.push({ firNumber: { $regex: cleanFIR, $options: 'i' } });
    }
    if (cleanName && cleanFather) {
      matchConditions.push({
        $and: [
          { prisonerName: { $regex: cleanName, $options: 'i' } },
          { fatherName: { $regex: cleanFather, $options: 'i' } },
        ],
      });
    } else if (cleanName) {
      matchConditions.push({ prisonerName: { $regex: cleanName, $options: 'i' } });
    }

    const baseMatch = matchConditions.length === 1 ? matchConditions[0] : { $and: matchConditions };

    // Apply strict date range filtering on Adalat appearances
    if (startDate || endDate) {
      baseMatch.hearingDate = {};
      if (startDate) baseMatch.hearingDate.$gte = new Date(startDate);
      if (endDate) {
        const endDateTime = new Date(endDate);
        endDateTime.setHours(23, 59, 59, 999);
        baseMatch.hearingDate.$lte = endDateTime;
      }
    }

    const pipeline = [
      { $match: baseMatch },
      { $sort: { hearingDate: -1, createdAt: -1 } },
      {
        $facet: {
          summaryMetrics: [
            {
              $group: {
                _id: null,
                totalProductions: { $sum: 1 },
                attendedCount: { $sum: { $cond: [{ $eq: ['$attended', true] }, 1, 0] } },
                missedCount: { $sum: { $cond: [{ $eq: ['$attended', false] }, 1, 0] } },
                
                // Mode Breakdown (VC vs Physical / Session Adalat)
                vcCount: { $sum: { $cond: [{ $eq: ['$appearanceMode', 'VC'] }, 1, 0] } },
                physicalCount: { $sum: { $cond: [{ $in: ['$appearanceMode', ['PHYSICAL', 'SESSION_ADALAT', 'COURT']] }, 1, 0] } },

                // Warrant Totals & Mode Cross-Tabs
                vc167: { $sum: { $cond: [{ $and: [{ $eq: ['$appearanceMode', 'VC'] }, { $regexMatch: { input: '$warrantType', regex: /167|187/i } }] }, 1, 0] } },
                physical167: { $sum: { $cond: [{ $and: [{ $in: ['$appearanceMode', ['PHYSICAL', 'SESSION_ADALAT', 'COURT']] }, { $regexMatch: { input: '$warrantType', regex: /167|187/i } }] }, 1, 0] } },

                vc209: { $sum: { $cond: [{ $and: [{ $eq: ['$appearanceMode', 'VC'] }, { $regexMatch: { input: '$warrantType', regex: /209|232/i } }] }, 1, 0] } },
                physical209: { $sum: { $cond: [{ $and: [{ $in: ['$appearanceMode', ['PHYSICAL', 'SESSION_ADALAT', 'COURT']] }, { $regexMatch: { input: '$warrantType', regex: /209|232/i } }] }, 1, 0] } },

                vc309: { $sum: { $cond: [{ $and: [{ $eq: ['$appearanceMode', 'VC'] }, { $regexMatch: { input: '$warrantType', regex: /309|346/i } }] }, 1, 0] } },
                physical309: { $sum: { $cond: [{ $and: [{ $in: ['$appearanceMode', ['PHYSICAL', 'SESSION_ADALAT', 'COURT']] }, { $regexMatch: { input: '$warrantType', regex: /309|346/i } }] }, 1, 0] } },

                firstHearingDate: { $min: '$hearingDate' },
                lastHearingDate: { $max: '$hearingDate' },
                distinctUTs: { $addToSet: '$utNumber' },
                distinctFIRs: { $addToSet: '$firNumber' },
                distinctCourts: { $addToSet: '$courtName' },
                distinctActSections: { $addToSet: '$actSection' },

                latestName: { $last: '$prisonerName' },
                latestFatherName: { $last: '$fatherName' },
                latestGender: { $last: '$gender' },
                latestBarrack: { $last: '$barrack' },
                latestDistrict: { $last: '$district' },
                latestCourt: { $last: '$courtName' },
                latestWarrantType: { $last: '$warrantType' },
                latestCustodyStatus: { $last: '$custodyStatus' },
              },
            },
          ],
          courtBreakdown: [
            {
              $group: {
                _id: '$courtName',
                totalHearings: { $sum: 1 },
                lastVisited: { $max: '$hearingDate' },
              },
            },
            { $sort: { totalHearings: -1 } },
          ],
          firBreakdown: [
            {
              $group: {
                _id: '$firNumber',
                actSection: { $last: '$actSection' },
                courtName: { $last: '$courtName' },
                currentWarrant: { $last: '$warrantType' },
                custodyStatus: { $last: '$custodyStatus' },
                custodyDate: { $min: '$hearingDate' },
                rihaDate: { $max: { $cond: [{ $eq: ['$custodyStatus', 'RIHA'] }, '$hearingDate', null] } },
                totalHearings: { $sum: 1 },
              },
            },
            { $sort: { lastDate: -1 } },
          ],
          appearanceHistory: [
            {
              $project: {
                hearingDate: 1,
                appearanceMode: 1,
                warrantType: 1,
                courtName: 1,
                firNumber: 1,
                custodyStatus: 1,
                custodyDate: 1,
                rihaDate: 1,
              },
            },
            { $sort: { hearingDate: -1 } },
          ],
        },
      },
    ];

    const [aggResult] = await AdalatAppearanceLog.aggregate(pipeline);
    let summary = aggResult?.summaryMetrics?.[0] || null;

    // Strict Exact Match filter for PrisonerRecord Master collection
    const prisonerMasterFilter = [];
    if (cleanUT) {
      prisonerMasterFilter.push({
        $or: [
          { RegisterNo: { $regex: `^${cleanUT}$`, $options: 'i' } },
          { utNumber: { $regex: `^${cleanUT}$`, $options: 'i' } },
          { JID: { $regex: `^${cleanUT}$`, $options: 'i' } },
        ],
      });
    }
    if (cleanFIR) prisonerMasterFilter.push({ 'FIR/Case No': { $regex: cleanFIR, $options: 'i' } });
    if (cleanName) prisonerMasterFilter.push({ 'Prisoner Name': { $regex: cleanName, $options: 'i' } });

    const masterRecords = prisonerMasterFilter.length > 0
      ? await PrisonerRecord.find(prisonerMasterFilter.length === 1 ? prisonerMasterFilter[0] : { $or: prisonerMasterFilter }).lean()
      : [];

    if (!summary && masterRecords.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'No prisoner records found matching exact UT Number search criteria.',
      });
    }

    if (!summary && masterRecords.length > 0) {
      const m = masterRecords[0];
      summary = {
        distinctUTs: [m.RegisterNo || m.utNumber || cleanUT],
        latestName: m['Prisoner Name'] || m.name || 'Unknown',
        latestFatherName: m['Father Name'] || m.fatherName || 'N/A',
        latestGender: m['Gender'] || m.gender || 'Male',
        latestBarrack: m['Ward'] || m['Barrack'] || 'Unassigned',
        latestDistrict: m['PSDistrict'] || m['district'] || 'Prayagraj',
        latestCourt: m['Court Name'] || m['courtName'] || 'District Court',
        latestWarrantType: m['JudgeName'] ? `Judge: ${m['JudgeName']}` : '167/187',
        latestCustodyStatus: m['Status'] === 'True' ? 'ACTIVE_CUSTODY' : 'RIHA',
        distinctFIRs: [m['FIR/Case No'] || m['14-Digit FIR No'] || cleanFIR].filter(Boolean),
        distinctActSections: [m['Act Section']].filter(Boolean),
        totalProductions: 0,
        vcCount: 0,
        physicalCount: 0,
        vc167: 0, physical167: 0,
        vc209: 0, physical209: 0,
        vc309: 0, physical309: 0,
        distinctCourts: [],
      };
    }

    return res.status(200).json({
      success: true,
      profile: {
        utNumbers: summary.distinctUTs,
        prisonerName: summary.latestName,
        fatherName: summary.latestFatherName,
        gender: summary.latestGender,
        barrack: summary.latestBarrack,
        district: summary.latestDistrict,
        currentCourt: summary.latestCourt,
        currentWarrantStage: summary.latestWarrantType,
        custodyStatus: summary.latestCustodyStatus,
        associatedFIRs: summary.distinctFIRs,
        actSections: summary.distinctActSections.filter(Boolean),
      },
      masterRecords,
      stats: {
        totalProductions: summary.totalProductions || 0,
        vcCount: summary.vcCount || 0,
        physicalCount: summary.physicalCount || 0,
        vc167: summary.vc167 || 0,
        physical167: summary.physical167 || 0,
        vc209: summary.vc209 || 0,
        physical209: summary.physical209 || 0,
        vc309: summary.vc309 || 0,
        physical309: summary.physical309 || 0,
        firstHearingDate: summary.firstHearingDate || null,
        lastHearingDate: summary.lastHearingDate || null,
      },
      breakdowns: {
        byCourt: aggResult?.courtBreakdown || [],
        byFIR: aggResult?.firBreakdown || [],
      },
      history: aggResult?.appearanceHistory || [],
    });
  } catch (error) {
    console.error('Error fetching individual prisoner stats:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error while fetching individual prisoner statistics.',
      error: error.message,
    });
  }
};



module.exports = {
  getAdalatLogs,
  getIndividualPrisonerStats,
};
