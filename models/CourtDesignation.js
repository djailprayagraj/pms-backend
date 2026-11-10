const mongoose = require('mongoose');

const courtDesignationSchema = new mongoose.Schema(
  {
    sr_no: {
      type: Number,
      required: true,
    },
    designation: {
      type: String,
      required: [true, 'Designation is required'],
      unique: true, // Creates a unique index in MongoDB
      trim: true,
    },
  },
  {
    timestamps: true, // Automatically adds createdAt and updatedAt fields
  }
);

module.exports = mongoose.model('CourtDesignation', courtDesignationSchema);
