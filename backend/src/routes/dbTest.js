const express = require('express');
const router = express.Router();
const db = require('../database/database-wrapper');

// Test database connection and data
router.get('/test', async (req, res) => {
  try {
    const results = {};
    
    // Check environment
    results.environment = {
      NODE_ENV: process.env.NODE_ENV,
      isProduction: process.env.NODE_ENV === 'production',
      hasDBHost: !!process.env.DB_HOST,
      hasMySQLHost: !!process.env.MYSQLHOST
    };
    
    // Count users
    try {
      const users = await db.all('SELECT COUNT(*) as count FROM users');
      results.userCount = users[0].count;
    } catch (err) {
      results.userCountError = err.message;
    }
    
    // Count studios
    try {
      const studios = await db.all('SELECT COUNT(*) as count FROM studios');
      results.studioCount = studios[0].count;
    } catch (err) {
      results.studioCountError = err.message;
    }
    
    // Get maxberger's studios
    try {
      const maxStudios = await db.all(`
        SELECT s.* FROM studios s 
        JOIN users u ON s.owner_id = u.id 
        WHERE u.email = 'maxberger@ail.com'
      `);
      results.maxbergersStudios = maxStudios.length;
      results.maxbergersStudioNames = maxStudios.map(s => s.name);
    } catch (err) {
      results.maxStudiosError = err.message;
    }
    
    // Check activation codes
    try {
      const codes = await db.all('SELECT COUNT(*) as count FROM activation_codes');
      results.activationCodeCount = codes[0].count;
    } catch (err) {
      results.activationCodeError = err.message;
    }
    
    // Check appointment types
    try {
      const types = await db.all('SELECT COUNT(*) as count FROM appointment_types');
      results.appointmentTypeCount = types[0].count;
    } catch (err) {
      results.appointmentTypeError = err.message;
    }
    
    res.json(results);
  } catch (error) {
    res.status(500).json({ 
      error: error.message,
      stack: error.stack 
    });
  }
});

module.exports = router;