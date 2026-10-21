// fetchRecordsController.js

const PrisonerRecord = require("../models/PrisonerRecord");

/**
 * 1. Fetch all records with optional pagination
 * Endpoint: GET /api/prisoners/all?page=1&limit=50
 */
const getAllRecords = async (req, res) => {
  try {
    const { page = 1, limit = 50 } = req.query;
    const records = await PrisonerRecord.find()
      .limit(Number(limit))
      .skip((Number(page) - 1) * Number(limit))
      .exec();
    
    const count = await PrisonerRecord.countDocuments();
    
    res.status(200).json({
      success: true,
      totalPages: Math.ceil(count / limit),
      currentPage: Number(page),
      totalRecords: count,
      data: records
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
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
  getAllRecords,
  getRecordsByRegisterNo,
  getRecordsByCourt,
  getRecordsByDutyPoint,
  getPrisonerInsights
};