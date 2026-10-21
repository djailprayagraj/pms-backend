const express = require('express');
const router = express.Router();
const { loginUser , createUser} = require('../controllers/authController');




//@METHOD - POST
//@ACCESS - USER / ADMIN
//@Path - /api/auth/login    
router.post('/login', loginUser);

// router.post('/createUser', createUser);

module.exports = router;