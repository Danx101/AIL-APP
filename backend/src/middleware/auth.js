const jwt = require('jsonwebtoken');
const db = require('../database/database-wrapper');

// Authentication middleware
const authenticate = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    console.log('Auth middleware - authHeader:', authHeader);
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      console.log('Auth middleware - no valid auth header');
      return res.status(401).json({ message: 'Access token required' });
    }

    const token = authHeader.substring(7); // Remove 'Bearer ' prefix
    console.log('Auth middleware - token extracted:', token ? 'present' : 'missing');


    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
      
      // Verify user still exists and is active
      const user = await db.get('SELECT * FROM users WHERE id = ? AND is_active = 1', [decoded.userId]);

      if (!user) {
        return res.status(401).json({ message: 'Invalid token - user not found' });
      }

      // Add user info to request
      req.user = {
        userId: user.id,
        email: user.email,
        role: user.role,
        firstName: user.first_name,
        lastName: user.last_name
      };

      next();
    } catch (jwtError) {
      return res.status(401).json({ message: 'Invalid or expired token' });
    }
  } catch (error) {
    console.error('Authentication error:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

// Role-based authorization middleware
const authorize = (roles = []) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ message: 'Authentication required' });
    }

    if (roles.length && !roles.includes(req.user.role)) {
      return res.status(403).json({ message: 'Insufficient permissions' });
    }

    next();
  };
};

// Studio owner authorization (must own the studio)
const authorizeStudioOwner = async (req, res, next) => {
  try {
    if (!req.user || req.user.role !== 'studio_owner') {
      return res.status(403).json({ message: 'Studio owner access required' });
    }

    const studioId = req.params.studioId || req.body.studioId;
    
    if (studioId) {
      const studio = await db.get('SELECT * FROM studios WHERE id = ? AND owner_id = ?', [studioId, req.user.userId]);

      if (!studio) {
        return res.status(403).json({ message: 'Studio access denied' });
      }
    }

    next();
  } catch (error) {
    console.error('Studio authorization error:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

// Customer authorization (must be customer or studio owner)
const authorizeCustomerAccess = async (req, res, next) => {
  try {
    if (!req.user) {
      return res.status(401).json({ message: 'Authentication required' });
    }

    const customerId = req.params.customerId || req.body.customerId;
    
    // Studio owners can access all customers
    if (req.user.role === 'studio_owner') {
      return next();
    }

    // Customers can only access their own data
    if (req.user.role === 'customer') {
      if (customerId && customerId !== req.user.userId.toString()) {
        return res.status(403).json({ message: 'Customer access denied' });
      }
      return next();
    }

    return res.status(403).json({ message: 'Access denied' });
  } catch (error) {
    console.error('Customer authorization error:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

// Optional authentication (for public routes that can benefit from user info)
const optionalAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return next(); // No token, continue without user info
    }

    const token = authHeader.substring(7);

    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
      
      const user = await db.get('SELECT * FROM users WHERE id = ? AND is_active = 1', [decoded.userId]);

      if (user) {
        req.user = {
          userId: user.id,
          email: user.email,
          role: user.role,
          firstName: user.first_name,
          lastName: user.last_name
        };
      }
    } catch (jwtError) {
      // Invalid token, but continue without user info
    }

    next();
  } catch (error) {
    console.error('Optional auth error:', error);
    next(); // Don't fail the request for optional auth errors
  }
};

module.exports = {
  authenticate,
  authorize,
  authorizeStudioOwner,
  authorizeCustomerAccess,
  optionalAuth
};