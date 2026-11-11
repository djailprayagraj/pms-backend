// fetchRecordsController.js

const PrisonerRecord = require("../models/PrisonerRecord");
const  AdalatAppearanceLog = require("../models/AdalatAppearanceLog");

/**
 * Controller to fetch prisoner records based on query parameters:
 * - utNumber (matches RegisterNo or embedded UT number in 'Prisoner Name')
 * - name (matches 'Prisoner Name' case-insensitively)
 * - firNo (matches 'FIR/Case No' case-insensitively)
 */
const getPrisonerRecords = async (req, res) => {
  try {
    const { utNumber, name, firNo } = req.query;
    let query = {};

    // 1. Search by UT Number (mapped to RegisterNo in jail records)
    if (utNumber) {
      query.RegisterNo = utNumber.trim(); 
    } 
    // 2. Search by Prisoner Name (Partial, case-insensitive match)
    else if (name) {
      query['Prisoner Name'] = { $regex: name.trim(), $options: 'i' };
    } 
    // 3. Search by FIR / Case Number (Handles flexible prefixes like FIR-, CR-, Case -, etc.)
    else if (firNo) {
      const cleanFir = firNo.trim().replace(/^(fir|cr|case)\s*[-:]?\s*/i, '');
      query['FIR/Case No'] = { $regex: new RegExp(cleanFir, 'i') };
    } else {
      return res.status(400).json({ 
        success: false, 
        message: 'Please provide a search parameter (utNumber, name, or firNo).' 
      });
    }

    let records = await PrisonerRecord.find(query);

    // Fallback search: If searching by utNumber failed on RegisterNo, search inside 'Prisoner Name'
    if ((!records || records.length === 0) && utNumber) {
      const cleanUt = utNumber.trim();
      records = await PrisonerRecord.find({
        'Prisoner Name': { $regex: cleanUt, $options: 'i' }
      });
    }

    // If still no records found after fallback
    if (!records || records.length === 0) {
      return res.status(404).json({ 
        success: false, 
        message: 'No prisoner records found matching the criteria or UT number.' 
      });
    }

    // Fetch logs from AdalatAppearanceLog for this prisoner's RegisterNo (utNumber)
    const targetUtNumber = records[0].RegisterNo;
    const adalatLogs = targetUtNumber ? await AdalatAppearanceLog.find({ utNumber: targetUtNumber }) : [];

    // Map firNumber -> warrantType and firNumber -> adalat courtName for quick O(1) lookups
    const warrantMap = new Map();
    const adalatCourtMap = new Map();

    adalatLogs.forEach(log => {
      if (log.firNumber) {
        const normalizedFir = log.firNumber.trim().toUpperCase();
        if (log.warrantType) {
          warrantMap.set(normalizedFir, log.warrantType);
        }
        if (log.courtName && log.courtName.trim().toUpperCase() !== 'N/A') {
          adalatCourtMap.set(normalizedFir, log.courtName.trim());
        }
      }
    });

    // Resolution priority:
    // 1. AdalatAppearanceLog courtName
    // 2. Record's Court Name
    // 3. Record's Judge Name
    // 4. 'N/A'
    const resolveCourtAndJudge = (record, normalizedFir) => {
      const adalatCourt = adalatCourtMap.get(normalizedFir);
      if (adalatCourt) {
        return adalatCourt;
      }

      const rawCourt = record['Court Name'] ? record['Court Name'].trim() : '';
      const rawJudge = record['Judge Name'] ? record['Judge Name'].trim() : '';

      const isCourtInvalid = !rawCourt || rawCourt.toUpperCase() === 'N/A';
      const isJudgeInvalid = !rawJudge || rawJudge.toUpperCase() === 'N/A';

      if (!isCourtInvalid) {
        return rawCourt;
      }
      if (!isJudgeInvalid) {
        return rawJudge;
      }
      return 'N/A';
    };

    // Deduplicate raw data and cases using a Map based on 'FIR/Case No'
    const uniqueRawMap = new Map();
    const uniqueCasesMap = new Map();
    
    records.forEach(record => {
      const firKey = record['FIR/Case No'] || record._id.toString();
      const normalizedFir = record['FIR/Case No'] ? record['FIR/Case No'].trim().toUpperCase() : '';
      
      // Resolve unified court/judge value following priority hierarchy
      const unifiedValue = resolveCourtAndJudge(record, normalizedFir);

      // Resolve Warrant Type safely with fallback chain
      const resolvedWarrantType = warrantMap.get(normalizedFir) || 
                                  (record.ImprisonmentType && record.ImprisonmentType.trim() !== '' ? record.ImprisonmentType.trim() : '167/187');

      // Store unique raw documents with synchronized fields and explicit warrantType
      if (!uniqueRawMap.has(firKey)) {
        const rawObj = record.toObject ? record.toObject() : { ...record };
        rawObj['Court Name'] = unifiedValue;
        rawObj['Judge Name'] = unifiedValue;
        rawObj['warrantType'] = resolvedWarrantType;
        uniqueRawMap.set(firKey, rawObj);
      }

      // Store unique formatted cases
      if (!uniqueCasesMap.has(firKey)) {
        uniqueCasesMap.set(firKey, {
          firNo: record['FIR/Case No'],
          actSection: record['Act Section'],
          psName: record['PS Name'],
          courtName: unifiedValue,
          judgeName: unifiedValue,
          warrantType: resolvedWarrantType,
          isRiha: record['Status(True Or False)'] === 'True' || record['Release Date'] ? true : false,
        });
      }
    });

    const uniqueRawData = Array.from(uniqueRawMap.values());
    const uniqueCases = Array.from(uniqueCasesMap.values());

    // Return structured response
    return res.status(200).json({
      success: true,
      count: uniqueCases.length,
      utNumber: uniqueRawData[0].RegisterNo || "N/A",
      prisonerName: uniqueRawData[0]['Prisoner Name'],
      fatherName: uniqueRawData[0]['Father Name'],
      barrack: uniqueRawData[0].Barrack || 'N/A',
      gender: uniqueRawData[0].Gender,
      age: uniqueRawData[0].Age,
      totalCases: uniqueCases.length,
      cases: uniqueCases,
      rawData: uniqueRawData
    });

  } catch (error) {
    console.error('Database Error:', error);
    return res.status(500).json({ 
      success: false, 
      message: 'Server error while fetching prisoner records.',
      error: error.message 
    });
  }
};


/**
 * 2. Fetch records by UT Number / Register No (e.g., "3857/26")
 * Endpoint: GET /api/prisoners/search-ut?part1=3857&part2=26
 */
const getRecordsByRegisterNo = async (req, res) => {
  try {
    const { part1, part2 } = req.query;
    if (!part1 || !part2) {
      return res.status(400).json({ success: false, error: "Both part1 and part2 are required." });
    }

    const registerNo = `${part1}/${part2}`;
    const records = await PrisonerRecord.find({ RegisterNo: registerNo });

    res.status(200).json({
      success: true,
      count: records.length,
      data: records
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

/**
 * 3. Filter records by Court Name (e.g., Allahabad District Court)
 * Endpoint: GET /api/prisoners/court?court=ALLAHABAD
 */
const getRecordsByCourt = async (req, res) => {
  try {
    const { court } = req.query;
    const query = court ? { 'Court Name': { $regex: court,$options: 'i' } } : {};
    const records = await PrisonerRecord.find(query);

    res.status(200).json({
      success: true,
      count: records.length,
      data: records
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

/**
 * 4. Filter records by Duty Point (e.g., Canteen Kaman, Bahar bagiya kaman)
 * Endpoint: GET /api/prisoners/duty?dutyPoint=Canteen
 */
const getRecordsByDutyPoint = async (req, res) => {
  try {
    const { dutyPoint } = req.query;
    const query = dutyPoint ? { 'Duty Point': { $regex: dutyPoint,$options: 'i' } } : {};
    const records = await PrisonerRecord.find(query);

    res.status(200).json({
      success: true,
      count: records.length,
      data: records
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

/**
 * 5. Generate Analytical Insights (Breakdown by Court, Occupation, and Religion)
 * Endpoint: GET /api/prisoners/insights
 */
const getPrisonerInsights = async (req, res) => {
  try {
    // Count breakdown by Court Name
    const courtStats = await PrisonerRecord.aggregate([
      { $group: { _id: "$Court Name", total: { $sum: 1 } } }, {$sort: { total: -1 } }
    ]);

    // Count breakdown by Occupation
    const occupationStats = await PrisonerRecord.aggregate([
      { $group: { _id: "$Occupation", total: { $sum: 1 } } }, {$sort: { total: -1 } }
    ]);

    // Count breakdown by Religion
    const religionStats = await PrisonerRecord.aggregate([
      { $group: { _id: "$Religion", total: { $sum: 1 } } }, {$sort: { total: -1 } }
    ]);

    res.status(200).json({
      success: true,
      insights: {
        byCourt: courtStats,
        byOccupation: occupationStats,
        byReligion: religionStats
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};



/**
 * 6. Fetch all prisoner records for the directory view
 * Endpoint: POST/GET /api/prisoners/all
 */
/**
 * Fetch unique prisoner records with pagination, search, and multi-case aggregation
 * Endpoint: GET /api/prisoners/all?page=1&limit=50&search=query
 */
const getAllPrisoners = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
    const skip = (page - 1) * limit;
    const search = req.query.search ? req.query.search.trim() : '';

    let matchQuery = {};
    if (search) {
      matchQuery = {
        $or: [
          { 'Prisoner Name': { $regex: search, $options: 'i' } },
          { RegisterNo: { $regex: search, $options: 'i' } },
          { 'FIR/Case No': { $regex: search, $options: 'i' } }
        ]
      };
    }

    const aggregationPipeline = [
      { $match: matchQuery },
      {
        $group: {
          _id: {
            registerNo: "$RegisterNo",
            firNo: "$FIR/Case No",
            actSection: "$Act Section"
          },
          doc: { $first: "$$ROOT" }
        }
      },
      {
        $group: {
          _id: "$doc.RegisterNo",
          primaryDoc: { $first: "$doc" },
          allCases: {
            $push: {
              _id: "$doc._id",
              firNo: "$doc.FIR/Case No",
              actSection: "$doc.Act Section",
              psName: "$doc.PS Name",
              courtName: "$doc.Court Name",
              judgeName: "$doc.Judge Name"
            }
          }
        }
      },
      {
        $replaceRoot: {
          newRoot: {
            $mergeObjects: [
              "$primaryDoc", 
              { 
                allCases: "$allCases", 
                totalCasesCount: { $size: "$allCases" } 
              }
            ]
          }
        }
      },
      // ✅ Corrected: Single $facet stage with parallel branches
      {
        $facet: {
          totalCount: [{ $count: "count" }],
          inCustodyCount: [
            {
              $match: {
                $or: [
                  { "Release Date": { $exists: false } },
                  { "Release Date": null },
                  { "Release Date": "" },
                  { "Release Date": " " }
                ]
              }
            },
            { $count: "count" }
          ],
          data: [{ $skip: skip }, { $limit: limit }]
        }
      }
    ];

    const result = await PrisonerRecord.aggregate(aggregationPipeline);

    const facetResult = result[0] || {};
    const totalCount = facetResult.totalCount?.[0]?.count || 0;
    const inCustodyCount = facetResult.inCustodyCount?.[0]?.count || 0;
    const releasedCount = Math.max(0, totalCount - inCustodyCount);
    const records = facetResult.data || [];

    return res.status(200).json({
      success: true,
      count: records.length,
      totalCount,
      inCustodyCount,
      releasedCount,
      currentPage: page,
      totalPages: Math.ceil(totalCount / limit),
      prisoners: records
    });

  } catch (error) {
    console.error('Database Error in getAllPrisoners:', error);
    return res.status(500).json({ 
      success: false, 
      message: 'Server error while fetching prisoner records.',
      error: error.message 
    });
  }
};

const updatePrisoner = async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    delete updateData._id;
    delete updateData.__v;

    const updatedPrisoner = await PrisonerRecord.findByIdAndUpdate(
      id,
      { $set: updateData },
      { returnDocument: 'after', runValidators: true } // <-- Updated here
    ).lean();

    if (!updatedPrisoner) {
      return res.status(404).json({
        success: false,
        message: 'Prisoner record not found.'
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Prisoner record updated successfully.',
      updatedPrisoner
    });

  } catch (error) {
    console.error('Error in updatePrisoner:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error while updating prisoner record.',
      error: error.message
    });
  }
};




/**
 * Fetch unique convicted prisoner records (Prisoner Type: "CT") with pagination, search, and server-calculated counts.
 * Endpoint: GET /api/prisoners/convicted?page=1&limit=50&search=query
 */
const getAllConvictedPrisoners = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
    const skip = (page - 1) * limit;
    const search = req.query.search ? req.query.search.trim() : '';

    // 🔒 Enforce "Prisoner Type": "CT" filter strictly
    let matchQuery = { "Prisoner Type": "CT" };

    if (search) {
      matchQuery.$or = [
        { 'Prisoner Name': { $regex: search, $options: 'i' } },
        { RegisterNo: { $regex: search, $options: 'i' } },
        { 'FIR/Case No': { $regex: search, $options: 'i' } }
      ];
    }

    const aggregationPipeline = [
      { $match: matchQuery },
      {
        $group: {
          _id: {
            registerNo: "$RegisterNo",
            firNo: "$FIR/Case No",
            actSection: "$Act Section"
          },
          doc: { $first: "$$ROOT" }
        }
      },
      {
        $group: {
          _id: "$doc.RegisterNo",
          primaryDoc: { $first: "$doc" },
          allCases: {
            $push: {
              _id: "$doc._id",
              firNo: "$doc.FIR/Case No",
              actSection: "$doc.Act Section",
              psName: "$doc.PS Name",
              courtName: "$doc.Court Name",
              judgeName: "$doc.Judge Name"
            }
          }
        }
      },
      {
        $replaceRoot: {
          newRoot: {
            $mergeObjects: [
              "$primaryDoc", 
              { 
                allCases: "$allCases", 
                totalCasesCount: { $size: "$allCases" } 
              }
            ]
          }
        }
      },
      {
        $facet: {
          totalCount: [{ $count: "count" }],
          inCustodyCount: [
            {
              $match: {
                $or: [
                  { "Release Date": { $exists: false } },
                  { "Release Date": null },
                  { "Release Date": "" },
                  { "Release Date": " " }
                ]
              }
            },
            { $count: "count" }
          ],
          data: [{ $skip: skip }, { $limit: limit }]
        }
      }
    ];

    const result = await PrisonerRecord.aggregate(aggregationPipeline);

    const facetResult = result[0] || {};
    const totalCount = facetResult.totalCount?.[0]?.count || 0;
    const inCustodyCount = facetResult.inCustodyCount?.[0]?.count || 0;
    const releasedCount = Math.max(0, totalCount - inCustodyCount);
    const records = facetResult.data || [];

    return res.status(200).json({
      success: true,
      count: records.length,
      totalCount,
      inCustodyCount,
      releasedCount,
      currentPage: page,
      totalPages: Math.ceil(totalCount / limit),
      prisoners: records
    });

  } catch (error) {
    console.error('Database Error in getAllConvictedPrisoners:', error);
    return res.status(500).json({ 
      success: false, 
      message: 'Server error while fetching convicted prisoner records.',
      error: error.message 
    });
  }
};




module.exports = {
 
  getRecordsByRegisterNo,
  getRecordsByCourt,
  getRecordsByDutyPoint,
  getPrisonerInsights,
  getPrisonerRecords,
  getAllPrisoners,
  updatePrisoner,
  getAllConvictedPrisoners,
};