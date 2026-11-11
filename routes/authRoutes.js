const express = require('express');
const router = express.Router();
const { loginUser , deleteUserAdmin} = require('../controllers/authController');




//@METHOD - POST
//@ACCESS - USER / ADMIN
//@Path - /api/auth/login    
router.post('/login', loginUser);


//@METHOD - DELETE
//@ACCESS - USER / ADMIN
//@Path - /api/auth/users/:id    
router.delete('/users/:id', deleteUserAdmin);



module.exports = router;