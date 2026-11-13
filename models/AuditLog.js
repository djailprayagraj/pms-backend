const mongoose = require('mongoose');

const AuditLogSchema = new mongoose.Schema(
  {
    // Identifier of the entity being modified
    utNumber: {
      type: String,
      required: true,
      index: true,
      trim: true,
    },
    firNumber: {
      type: String,
      default: 'N/A',
      index: true,
      trim: true,
    },
    
    // Category of change for easy filtering/auditing
    changeCategory: {
      type: String,
      enum: [
        'COURT_CHANGE', 
        'WARRANT_COUNT_CHANGE', 
        'WARRANT_TYPE_MOVEMENT', 
        'APPEARANCE_MODE_CHANGE', 
        'BARRACK_TRANSFER',
        'RECORD_DELETION',
        'GENERAL_UPDATE'
      ],
      required: true,
      index: true,
    },

    // Detailed description of the mutation
    description: {
      type: String,
      required: true,
      trim: true,
    },

    // Before and After state tracking
    previousValue: {
      type: mongoose.Schema.Types.Mixed,
      required: true,
    },
    newValue: {
      type: mongoose.Schema.Types.Mixed,
      required: true,
    },

    // Accountability & Client Metadata
    performedBy: {
      userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },
      username: { type: String, default: 'System / Anonymous' },
      role: { type: String, default: 'staff' },
    },
    ipAddress: {
      type: String,
      default: '127.0.0.1',
    },
    userAgent: {
      type: String,
      default: 'N/A',
    },
  },
  {
    timestamps: { createdAt: 'changedAt', updatedAt: false },
  }
);

// High-performance compound indexes for audit searching and reporting
AuditLogSchema.index({ utNumber: 1, changedAt: -1 });
AuditLogSchema.index({ changeCategory: 1, changedAt: -1 });
AuditLogSchema.index({ 'performedBy.userId': 1, changedAt: -1 });

module.exports = mongoose.model('AuditLog', AuditLogSchema);