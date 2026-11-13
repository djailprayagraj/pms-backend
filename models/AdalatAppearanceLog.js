const mongoose = require('mongoose');

const AdalatAppearanceLogSchema = new mongoose.Schema(
  {
    // ==========================================
    // 1. PRISONER & FIR IDENTIFIERS
    // ==========================================
    utNumber: {
      type: String,
      required: [true, 'UT Number is required'],
      index: true,
      trim: true,
    },
    prisonerName: {
      type: String,
      required: [true, 'Prisoner Name is required'],
      trim: true,
    },
    fatherName: {
      type: String,
      required: [true, 'Father Name is required'],
      trim: true,
    },
    gender: { type: String, default: 'Male' },
    barrack: {
      type: String,
      default: '6-B',
      trim: true,
    },
    firNumber: {
      type: String,
      required: [true, 'FIR / Crime number is required'],
      index: true,
      trim: true,
    },
    actSection: {
      type: String,
      trim: true,
    },

    // ==========================================
    // 2. ADALAT DATE & APPEARANCE MODE METADATA
    // ==========================================
    hearingDate: {
      type: Date,
      required: [true, 'Adalat hearing date is required'],
      index: true,
    },
    // NEW: Next Hearing Date tracking
    nextHearingDate: {
      type: Date,
      index: true,
    },
    appearanceMode: {
      type: String,
      enum: ['VC', 'SESSION_ADALAT'],
      required: [true, 'Appearance mode (VC or SESSION_ADALAT) is required'],
      index: true,
    },
    actionCategory: {
      type: String,
      default: 'Jail Adalat',
      trim: true,
    },

    // ==========================================
    // 3. ATTENDANCE & NON-ATTENDANCE TRACKING
    // ==========================================
    attended: {
      type: Boolean,
      default: true,
      index: true,
    },
    nonAttendanceReason: {
      type: String,
      enum: [
        'N/A',
        'MEDICAL_UNFIT',
        'ESCORT_UNAVAILABLE',
        'COURT_HOLIDAY',
        'PRISONER_REFUSED',
        'LAW_AND_ORDER_ISSUE',
        'OTHER',
      ],
      default: 'N/A',
    },
    remarks: {
      type: String,
      trim: true,
    },

    // ==========================================
    // 4. COURT SNAPSHOT
    // ==========================================
    courtName: {
      type: String,
      required: [true, 'Court name is required'],
      trim: true,
    },
    district: {
      type: String,
      default: 'Prayagraj',
      trim: true,
    },

    // ==========================================
    // 5. RIHA / CUSTODY STATUS SECTION
    // ==========================================
    custodyStatus: {
      type: String,
      enum: ['ACTIVE_CUSTODY', 'RIHA'],
      default: 'ACTIVE_CUSTODY',
      index: true,
    },

    // ==========================================
    // 6. WARRANT TYPE & COUNT SNAPSHOT
    // ==========================================
    warrantType: {
      type: String,
      enum: ['167/187', '209/232', '309/346'],
      required: [true, 'Warrant type is required'],
      index: true,
    },
    warrantCount: {
      type: Number,
      default: 1,
      min: [1, 'Warrant count must be at least 1'],
    },
  },
  {
    timestamps: true,
  }
);

AdalatAppearanceLogSchema.index(
  { utNumber: 1, firNumber: 1, hearingDate: 1, appearanceMode: 1 },
  { unique: true }
);

module.exports = mongoose.model('AdalatAppearanceLog', AdalatAppearanceLogSchema);