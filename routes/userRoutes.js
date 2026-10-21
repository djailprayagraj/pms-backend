const express = require('express');
const router = express.Router();
const {updateUserAdmin, getAllUsers , addUser} = require('../controllers/userController');
const { protect, authorizeRoles } = require('../middleware/auth');

// Protected routes (Admin role only)
// router.post('/', protect, authorizeRoles('admin'), createUser);
router.put('/updateUserAdmin',updateUserAdmin );
router.get('/getAllUsers',  getAllUsers); // get all lusers initially made for admin .
router.post('/addUser', addUser );

module.exports = router;