const mongoose = require('mongoose');

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Full name is required'],
      trim: true,
    },
    fatherName: {
      type: String,
      trim: true,
      default: '',
    },
    firNo: {
      type: String,
      trim: true,
      default: '',
    },
    utNumber: {
      type: String,
      trim: true,
      default: '',
    },
    username: {
      type: String,
      required: [true, 'Username is required'],
      unique: true,
      trim: true,
      lowercase: true,
    },
    password: {
      type: String,
      required: [true, 'Password is required'],
      minlength: [6, 'Password must be at least 6 characters long'],
    },
    role: {
      type: String,
      enum: ['staff', 'user', 'admin'],
      default: 'staff',
    },
  },
  {
    timestamps: true, // Automatically adds createdAt and updatedAt
  }
);

module.exports = mongoose.model('User', userSchema);