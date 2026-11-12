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



module.exports = {
  getAdalatLogs,
};
