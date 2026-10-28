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
    /**
     * ADALAT DATE / HEARING DATE
     * Stores the specific date when the prisoner went to or was scheduled for Adalat/VC
     */
    hearingDate: {
      type: Date,
      required: [true, 'Adalat hearing date is required'],
      index: true,
    },
    appearanceMode: {
      type: String,
      enum: ['VC', 'SESSION_ADALAT'], // SESSION_ADALAT implies Physical Court Adalat
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
      default: true, // true = Went / Produced, false = Did not go
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
    /**
     * RIHA OR ACTIVE CUSTODY STATUS
     * Tracks whether the prisoner is currently in custody or released (RIHA)
     */
    custodyStatus: {
      type: String,
      enum: ['ACTIVE_CUSTODY', 'RIHA'], // 'RIHA' = Released, 'ACTIVE_CUSTODY' = Still in Jail
      default: 'ACTIVE_CUSTODY',
      index: true,
    },

    // ==========================================
    // 6. WARRANT TYPE SNAPSHOT
    // ==========================================
    warrantType: {
      type: String,
      enum: ['167/187', '209/232', '309/346'],
      required: [true, 'Warrant type is required'],
      index: true,
    },

    // ==========================================
    // 7. DETAILED TRANSITION AUDIT LOGS
    // ==========================================
    warrantTypeTransition: {
      fromWarrant: {
        type: String,
        enum: ['167/187', '209/232', '309/346', null],
        default: null,
      },
      toWarrant: {
        type: String,
        enum: ['167/187', '209/232', '309/346'],
      },
      changedAt: {
        type: Date,
        default: Date.now,
      },
    },

    courtTransition: {
      fromCourt: {
        type: String,
        default: null,
        trim: true,
      },
      toCourt: {
        type: String,
        trim: true,
      },
      changedAt: {
        type: Date,
        default: Date.now,
      },
    },

    /**
     * RIHA STATUS TRANSITION LOG
     * Records the date and values when an inmate's status changed to/from RIHA
     */
    custodyStatusTransition: {
      fromStatus: {
        type: String,
        enum: ['ACTIVE_CUSTODY', 'RIHA', null],
        default: null,
      },
      toStatus: {
        type: String,
        enum: ['ACTIVE_CUSTODY', 'RIHA'],
      },
      changedAt: {
        type: Date,
        default: Date.now,
      },
    },
  },
  {
    timestamps: true, // Automatically handles createdAt and updatedAt
  }
);

// Unique Compound Index to Prevent Duplicate Entries
AdalatAppearanceLogSchema.index(
  {
    utNumber: 1,
    firNumber: 1,
    hearingDate: 1,
    appearanceMode: 1,
  },
  { unique: true }
);

// Compound Index for Analytics Queries Across Ranges
AdalatAppearanceLogSchema.index({
  hearingDate: 1,
  warrantType: 1,
  appearanceMode: 1,
  custodyStatus: 1,
  attended: 1,
});

module.exports = mongoose.model('AdalatAppearanceLog', AdalatAppearanceLogSchema);