const jwt = require('jsonwebtoken');
const JWT_SECRET = process.env.JWT_SECRET || 'your_super_secret_key';

// Protect routes (Verify JWT token)
const protect = (req, res, next) => {
  let token = req.headers.authorization;
  if (token && token.startsWith('Bearer ')) {
    try {
      token = token.split(' ')[1];
      const decoded = jwt.verify(token, JWT_SECRET);
      req.user = decoded;
      next();
    } catch (error) {
      return res.status(401).json({ success: false, message: 'Not authorized, token failed' });
    }
  } else {
    return res.status(401).json({ success: false, message: 'Not authorized, no token provided' });
  }
};

// Authorize roles (RBAC)
const authorizeRoles = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ 
        success: false, 
        message: `Role '${req.user.role}' is not authorized to access this route` 
      });
    }
    next();
  };
};

module.exports = { protect, authorizeRoles };