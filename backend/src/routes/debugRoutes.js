const express = require('express');
const router = express.Router();
const db = require('../database/database-wrapper');

// Debug endpoint to check database connection and user data
router.get('/check-user/:email', async (req, res) => {
  try {
    const { email } = req.params;
    
    // Test database connection
    const user = await db.get('SELECT * FROM users WHERE email = ?', [email]);
    
    if (!user) {
      return res.json({ 
        message: 'User not found',
        email: email 
      });
    }
    
    // Return user structure (without sensitive data)
    const userInfo = {
      id: user.id,
      email: user.email,
      role: user.role,
      hasPasswordHash: !!user.password_hash,
      passwordHashField: user.password_hash ? 'exists' : 'missing',
      allFields: Object.keys(user),
      firstName: user.first_name,
      lastName: user.last_name
    };
    
    res.json({
      message: 'User found',
      user: userInfo,
      databaseType: process.env.NODE_ENV === 'production' ? 'MySQL' : 'SQLite'
    });
    
  } catch (error) {
    res.status(500).json({ 
      error: error.message,
      stack: error.stack 
    });
  }
});

// Check database tables
router.get('/check-tables', async (req, res) => {
  try {
    if (process.env.NODE_ENV === 'production') {
      // MySQL query to show tables
      const tables = await db.all("SHOW TABLES");
      res.json({ 
        database: 'MySQL',
        tables: tables 
      });
    } else {
      // SQLite query to show tables
      const tables = await db.all("SELECT name FROM sqlite_master WHERE type='table'");
      res.json({ 
        database: 'SQLite',
        tables: tables 
      });
    }
  } catch (error) {
    res.status(500).json({ 
      error: error.message,
      stack: error.stack 
    });
  }
});

module.exports = router;