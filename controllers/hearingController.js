// Adalat Peshi feeding controller 
const { Prisoner, FIR, Hearing } = require('../models/CourtSystem'); // Adjust path to your schema file

// Helper function to map frontend legal provisions to schema Enums
const mapLegalProvision = (warrantType) => {
  if (!warrantType) return 'OTHER';
  const clean = warrantType.toUpperCase().trim();
  if (clean.includes('167') || clean.includes('CRPC')) return 'SEC_167_CRPC';
  if (clean.includes('187') || clean.includes('BNSS')) return 'SEC_187_BNSS';
  if (clean.includes('209')) return 'SEC_209_CRPC';
  if (clean.includes('232')) return 'SEC_232_BNSS';
  if (clean.includes('309')) return 'SEC_309_CRPC';
  if (clean.includes('346')) return 'SEC_346_BNSS';
  return 'OTHER';
};

// Helper function to map sub-options to schema appearance_mode
const mapAppearanceMode = (subOption) => {
  if (subOption === 'vc') return 'VC';
  if (subOption === 'session' || subOption === 'adalat') return 'ADALAT';
  return 'NOT_PRODUCED';
};

/**
 * POST /api/hearings/feed
 * Accepts prisoner details, selected FIR cases, and header selections.
 */
const feedHearingEntries = async (req, res) => {
  try {
    const { prisonerData, selectedCases, headerOptions } = req.body;

    if (!prisonerData || !selectedCases || selectedCases.length === 0) {
      return res.status(400).json({ success: false, message: 'Invalid or missing payload.' });
    }

    // 1. Find or Create Prisoner Record in MongoDB
    let prisoner = await Prisoner.findOne({ ut_code: prisonerData.utNumber });
    if (!prisoner) {
      prisoner = await Prisoner.create({
        ut_code: prisonerData.utNumber,
        full_name: prisonerData.prisonerName,
        gender: (prisonerData.gender || 'MALE').toUpperCase(),
        date_of_birth: prisonerData.dob || null,
      });
    }

    const savedHearings = [];

    // 2. Process each selected FIR and create the corresponding Hearing log
    for (const caseData of selectedCases) {
      // Find or Create FIR Record
      let fir = await FIR.findOne({ fir_number: caseData.firNo });
      if (!fir) {
        fir = await FIR.create({
          fir_number: caseData.firNo,
          police_station: caseData.psName || 'Unknown PS',
          under_sections: caseData.actSection || 'N/A',
          current_court: caseData.courtName || 'District Court',
          prisoner_id: prisoner._id,
        });
      }

      // Map Enums
      const appearanceMode = mapAppearanceMode(headerOptions.subOption);
      const isProduced = appearanceMode !== 'NOT_PRODUCED';
      const legalProvision = mapLegalProvision(caseData.warrantType);

      // Create Hearing Document
      const newHearing = new Hearing({
        hearing_date: new Date(headerOptions.selectedDate),
        prisoner_id: prisoner._id,
        fir_id: fir._id,
        ut_code: prisoner.ut_code,
        gender: prisoner.gender,
        court_name: caseData.courtName || fir.current_court,
        appearance_mode: appearanceMode,
        is_produced: isProduced,
        legal_provision: legalProvision,
        non_production_reason: 'NONE',
        comment: `Action Category: ${headerOptions.mainAction.toUpperCase()} | Sub-Option: ${headerOptions.subOption}`,
      });

      const savedDoc = await newHearing.save();
      
      // Construct populated object for frontend Redux state update
      savedHearings.push({
        _id: savedDoc._id,
        ut_code: savedDoc.ut_code,
        full_name: prisoner.full_name,
        barrack: prisonerData.barrack,
        fir_number: fir.fir_number,
        legal_provision: savedDoc.legal_provision,
        court_name: savedDoc.court_name,
        hearing_date: savedDoc.hearing_date.toISOString().split('T')[0],
        appearance_mode: savedDoc.appearance_mode,
        action_category: headerOptions.mainAction,
        sub_option: headerOptions.subOption,
        created_at: new Date(savedDoc.createdAt).toLocaleTimeString(),
      });
    }

    return res.status(201).json({
      success: true,
      message: `${savedHearings.length} hearing record(s) inserted successfully into MongoDB.`,
      records: savedHearings,
    });
  } catch (error) {
    console.error('Error saving hearing entries:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Server error saving entries to database.',
    });
  }
};

module.exports = { feedHearingEntries };