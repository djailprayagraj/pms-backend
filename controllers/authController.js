const User = require('../models/Users');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'your_super_secret_key';

// @desc    Login User
// @route   POST /api/auth/login
// @desc    Login User
// @route   POST /api/auth/login
const loginUser = async (req, res) => {
  try {
    const { username, password } = req.body;

    // 1. Check if required fields are provided
    if (!username || !password) {
      return res.status(400).json({
        success: false,
        message: 'Validation Error: Username and password are required.',
      });
    }

    // 2. Check if user exists in database
    const user = await User.findOne({ username: username.toLowerCase().trim() });
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Account not found. No user exists with this username.',
      });
    }

    // 3. Direct plain text password check (No bcrypt)
    if (password !== user.password) {
      return res.status(401).json({
        success: false,
        message: 'Authentication Failed: Incorrect password provided.',
      });
    }

    // 4. Generate JWT Token
    const token = jwt.sign(
      { id: user._id, username: user.username, role: user.role },
      JWT_SECRET,
      { expiresIn: '1d' }
    );

    // 5. Return success response
    return res.status(200).json({
      success: true,
      message: 'Login successful.',
      token,
      user: {
        id: user._id,
        name: user.name,
        username: user.username,
        role: user.role,
      },
    });
  } catch (error) {
    console.error('Server error during login:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error during login process.',
      error: error.message,
    });
  }
};

// @desc    Add New User / Staff
// @route   POST /api/auth/add-user
const addUser = async (req, res) => {
  try {
    const { name, fatherName, firNo, utNumber, username, password, role } = req.body;

    // 1. Basic validation
    if (!name || !username || !password) {
      return res.status(400).json({
        success: false,
        message: 'Please provide all required fields: name, username, and password.',
      });
    }

    // 2. Check if username already exists
    const existingUser = await User.findOne({ username: username.toLowerCase() });
    if (existingUser) {
      return res.status(409).json({
        success: false,
        message: 'Username is already taken. Please choose another.',
      });
    }

    // 3. Hash the password securely
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // 4. Create and save the new user
    const newUser = await User.create({
      name,
      fatherName: fatherName || '',
      firNo: firNo || '',
      utNumber: utNumber || '',
      username: username.toLowerCase(),
      password: hashedPassword,
      role: role || 'staff',
    });

    // 5. Return success response
    return res.status(201).json({
      success: true,
      message: 'User created successfully in database.',
      data: {
        id: newUser._id,
        name: newUser.name,
        username: newUser.username,
        role: newUser.role,
        utNumber: newUser.utNumber,
      },
    });
  } catch (error) {
    console.error('Error in addUser controller:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Server error while adding user.',
    });
  }
};

// Export both controllers properly
module.exports = {
  loginUser,
  addUser,
};