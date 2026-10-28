// fetchRecordsController.js

const PrisonerRecord = require("../models/PrisonerRecord");

/**
 * Controller to fetch prisoner records based on query parameters:
 * - utNumber (matches RegisterNo)
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
    // 3. Search by FIR / Case Number
    else if (firNo) {
      query['FIR/Case No'] = { $regex: firNo.trim(), $options: 'i' };
    } else {
      return res.status(400).json({ 
        success: false, 
        message: 'Please provide a search parameter (utNumber, name, or firNo).' 
      });
    }

    // Execute query in MongoDB
    const records = await PrisonerRecord.find(query);

    if (!records || records.length === 0) {
      return res.status(404).json({ 
        success: false, 
        message: 'No prisoner records found matching the criteria.' 
      });
    }

    // Return structured response
    return res.status(200).json({
      success: true,
      count: records.length,
      // If fetching by UT/RegisterNo, you can structure it to match your frontend mock response layout
      utNumber: utNumber || records[0].RegisterNo,
      prisonerName: records[0]['Prisoner Name'],
      fatherName: records[0]['Father Name'],
      barrack: records[0].Barrack || 'N/A',
      gender: records[0].Gender,
      age: records[0].Age,
      totalCases: records.length,
      cases: records.map(record => ({
        firNo: record['FIR/Case No'],
        actSection: record['Act Section'],
        psName: record['PS Name'],
        courtName: record['Court Name'],
        warrantType: record.ImprisonmentType || 'Standard',
        isRiha: record['Status(True Or False)'] === 'True' || record['Release Date'] ? true : false,
      })),
      rawData: records // Full documents if needed
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

module.exports = {
 
  getRecordsByRegisterNo,
  getRecordsByCourt,
  getRecordsByDutyPoint,
  getPrisonerInsights,
  getPrisonerRecords
};