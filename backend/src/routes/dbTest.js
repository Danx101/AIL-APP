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

// Test customers for specific studio
router.get('/test-customers/:studioId', async (req, res) => {
  try {
    const { studioId } = req.params;
    const results = {};
    
    // Get studio info
    try {
      const studio = await db.get('SELECT * FROM studios WHERE id = ?', [studioId]);
      results.studio = studio;
    } catch (err) {
      results.studioError = err.message;
    }
    
    // Get customers query - test the exact query used in getCustomers
    try {
      const customers = await db.all(
        `SELECT DISTINCT u.id, u.email, u.first_name, u.last_name, u.phone, u.created_at
         FROM users u
         JOIN activation_codes ac ON u.id = ac.used_by_user_id
         WHERE ac.studio_id = ? AND u.role = 'customer'
         ORDER BY u.created_at DESC`,
        [studioId]
      );
      results.customerCount = customers.length;
      results.customers = customers;
    } catch (err) {
      results.customersError = err.message;
      results.customersErrorStack = err.stack;
    }
    
    // Also check activation codes for this studio
    try {
      const codes = await db.all(
        'SELECT * FROM activation_codes WHERE studio_id = ?',
        [studioId]
      );
      results.activationCodes = codes;
    } catch (err) {
      results.codesError = err.message;
    }
    
    res.json(results);
  } catch (error) {
    res.status(500).json({ 
      error: error.message,
      stack: error.stack 
    });
  }
});

// Create default appointment types
router.post('/create-default-appointment-types', async (req, res) => {
  try {
    // Check if appointment types already exist for studio 3
    const existing = await db.all('SELECT COUNT(*) as count FROM appointment_types WHERE studio_id = 3');
    
    if (existing[0].count > 0) {
      return res.json({ 
        message: 'Appointment types already exist',
        count: existing[0].count 
      });
    }
    
    // Create default appointment types
    const defaultTypes = [
      { name: 'Erstbehandlung', duration: 90, description: 'Erste Behandlung für neue Kunden', color: '#007bff' },
      { name: 'Folgebehandlung', duration: 60, description: 'Reguläre Folgebehandlung', color: '#28a745' },
      { name: 'Beratungsgespräch', duration: 30, description: 'Kostenloses Beratungsgespräch', color: '#ffc107' }
    ];
    
    let created = 0;
    for (const type of defaultTypes) {
      await db.run(
        `INSERT INTO appointment_types (name, duration, description, studio_id, color, is_active, created_at, updated_at)
         VALUES (?, ?, ?, 3, ?, 1, datetime('now'), datetime('now'))`,
        [type.name, type.duration, type.description, type.color]
      );
      created++;
    }
    
    res.json({ 
      message: 'Default appointment types created',
      created: created 
    });
    
  } catch (error) {
    res.status(500).json({ 
      error: error.message,
      stack: error.stack 
    });
  }
});

// Clear and recreate appointment types with correct names
router.post('/reset-appointment-types', async (req, res) => {
  try {
    // Delete existing appointment types for studio 3
    await db.run('DELETE FROM appointment_types WHERE studio_id = 3');
    
    // Create the two required appointment types
    const requiredTypes = [
      { name: 'Behandlung', duration: 60, description: 'Standard Behandlung', color: '#007bff' },
      { name: 'Beratung', duration: 30, description: 'Beratungsgespräch', color: '#28a745' }
    ];
    
    let created = 0;
    for (const type of requiredTypes) {
      await db.run(
        `INSERT INTO appointment_types (name, duration, description, studio_id, color, is_active, created_at, updated_at)
         VALUES (?, ?, ?, 3, ?, 1, datetime('now'), datetime('now'))`,
        [type.name, type.duration, type.description, type.color]
      );
      created++;
    }
    
    res.json({ 
      message: 'Appointment types reset successfully',
      created: created 
    });
    
  } catch (error) {
    res.status(500).json({ 
      error: error.message,
      stack: error.stack 
    });
  }
});

module.exports = router;