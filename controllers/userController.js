const User = require('../models/Users');
const bcrypt = require('bcryptjs');


exports.getAllUsers = async (req, res) => {
  try {
    // Fetch all users, excluding sensitive fields like password
    const allUsers = await User.find();

    // Return 200 OK with the retrieved users array
    return res.status(200).json({
      success: true,
      count: allUsers.length,
      data: allUsers,
    });
  } catch (error) {
    console.error('Error fetching users:', error);

    // Return 500 Internal Server Error for database or server-side failure
    return res.status(500).json({
      success: false,
      message: 'Server error while fetching user records.',
      error: error.message,
    });
  }
};






// Admin: Update user name or password
exports.updateUserAdmin = async (req, res) => {
  try {
    const { username, newPassword, ...otherUpdates } = req.body;

    if (!username) {
      return res.status(400).json({ 
        success: false, 
        message: 'Username is required to update records.' 
      });
    }

    // Find user by username using findOne
    const user = await User.findOne({ username });
    if (!user) {
      return res.status(404).json({ 
        success: false, 
        message: 'Username not found' 
      });
    }

    // Prepare update data
    const updateData = { ...otherUpdates };
    
    // Assign plain text password if provided
    if (newPassword && newPassword.trim() !== '') {
      updateData.password = newPassword;
    }

    // Update document in MongoDB
    const updatedUser = await User.findOneAndUpdate(
      { username },
      { $set: updateData },
      { new: true, runValidators: true }
    ).select('-password'); // Exclude password from response

    return res.status(200).json({
      success: true,
      message: 'User updated successfully',
      data: updatedUser,
    });

  } catch (error) {
    console.error('Error in updateUserAdmin:', error);
    return res.status(500).json({ 
      success: false, 
      message: error.message 
    });
  }
};


exports.addUser = async (req, res) => {
  try {
    const { name, fatherName, firNo, utNumber, username, password, role } = req.body;

    // Validate required fields explicitly if needed
    if (!name || !username || !password) {
      return res.status(400).json({
        success: false,
        message: 'Name, username, and password are required fields.',
      });
    }

    // Check if username already exists
    const existingUser = await User.findOne({ username: username.toLowerCase().trim() });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'Username is already taken. Please choose another.',
      });
    }

    // Create new user (saved in plain text per your setup)
    const newUser = await User.create({
      name,
      fatherName,
      firNo,
      utNumber,
      username,
      password,
      role: role || 'staff',
    });

    // Omit password from response
    const userResponse = newUser.toObject();
    delete userResponse.password;

    return res.status(201).json({
      success: true,
      message: 'User created successfully.',
      data: userResponse,
    });

  } catch (error) {
    console.error('Error creating user:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Server error while creating user.',
    });
  }
};



