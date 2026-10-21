const mongoose = require('mongoose');

// ==========================================
// 1. PRISONER MASTER SCHEMA
// ==========================================
// Ensures a prisoner has a single unique UT Code, but can be linked to multiple FIRs.
const prisonerSchema = new mongoose.Schema({
  ut_code: { 
    type: String, 
    required: true, 
    unique: true, 
    trim: true,
    index: true 
  },
  full_name: { 
    type: String, 
    required: true, 
    trim: true 
  },
  gender: { 
    type: String, 
    enum: ['MALE', 'FEMALE', 'OTHER'], 
    required: true 
  },
  date_of_birth: { 
    type: Date, 
    default: null 
  }
}, { 
  timestamps: true 
});


// ==========================================
// 2. FIR MASTER SCHEMA
// ==========================================
// Links multiple FIRs to a single prisoner via prisoner_id.
const firSchema = new mongoose.Schema({
  fir_number: { 
    type: String, 
    required: true, 
    unique: true, 
    trim: true,
    index: true 
  },
  police_station: { 
    type: String, 
    required: true, 
    trim: true 
  },
  under_sections: { 
    type: String, 
    required: true, 
    trim: true 
  },
  current_court: { 
    type: String, 
    required: true, 
    trim: true 
  },
  prisoner_id: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Prisoner', 
    required: true, 
    index: true 
  }
}, { 
  timestamps: true 
});


// ==========================================
// 3. HEARING (PESHI) EVENT LOG SCHEMA
// ==========================================
// Tracks daily hearings (500/day over 100 years). 
// Denormalized fields (ut_code, gender) are included to ensure lightning-fast aggregations without expensive joins.
const hearingSchema = new mongoose.Schema({
  hearing_date: { 
    type: Date, 
    required: true, 
    index: true 
  },
  prisoner_id: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Prisoner', 
    required: true, 
    index: true 
  },
  fir_id: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'FIR', 
    required: true, 
    index: true 
  },
  
  // Denormalized fields for 0-join statistics & fast filtering
  ut_code: { 
    type: String, 
    required: true, 
    index: true 
  },
  gender: { 
    type: String, 
    enum: ['MALE', 'FEMALE', 'OTHER'], 
    required: true 
  },
  court_name: { 
    type: String, 
    required: true, 
    trim: true 
  },
  
  // Production / Attendance details
  appearance_mode: { 
    type: String, 
    enum: [ 'VC', 'ADALAT', 'NOT_PRODUCED'], 
    required: true,
    index: true
  },
  is_produced: { 
    type: Boolean, 
    required: true 
  }, // true if PHYSICAL, VC, or ADALAT
  
  // Legal Provisions under CrPC / BNSS
  legal_provision: { 
    type: String, 
    enum: [
      'SEC_167_CRPC', 
      'SEC_187_BNSS', 
      'SEC_209_CRPC', 
      'SEC_232_BNSS', 
      'SEC_309_CRPC', 
      'SEC_346_BNSS', 
      'OTHER'
    ], 
    required: true,
    index: true
  },
  
  // Failure / Exception tracking (For Requirements 7 & 8)
  non_production_reason: { 
    type: String, 
    enum: [
      'NO_ESCORT', 
      'MEDICAL_UNFIT', 
      'STRIKE', 
      'TECH_FAILURE', 
      'ADMINISTRATIVE', 
      'NONE'
    ], 
    default: 'NONE' 
  },
  comment: { 
    type: String, 
    default: "", 
    trim: true 
  }
}, { 
  timestamps: true 
});


// ==========================================
// ADVANCED COMPOUND INDEXES FOR O(log N) QUERIES
// ==========================================
hearingSchema.index({ hearing_date: 1, appearance_mode: 1, legal_provision: 1 });
hearingSchema.index({ prisoner_id: 1, appearance_mode: 1, hearing_date: -1 });
hearingSchema.index({ fir_id: 1, is_produced: 1, hearing_date: -1 });


// Compile and Export Models
const Prisoner = mongoose.model('Prisoner', prisonerSchema);
const FIR = mongoose.model('FIR', firSchema);
const Hearing = mongoose.model('Hearing', hearingSchema);

module.exports = {
  Prisoner,
  FIR,
  Hearing
};