const express = require('express');
const router = express.Router();
const db = require('../database/database-wrapper');
const bcrypt = require('bcryptjs');

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

// Check environment variables
router.get('/check-env', async (req, res) => {
  const mysqlVars = {
    NODE_ENV: process.env.NODE_ENV,
    // Railway MySQL vars
    MYSQL_PUBLIC_URL: process.env.MYSQL_PUBLIC_URL ? 'SET (hidden)' : 'NOT SET',
    MYSQL_URL: process.env.MYSQL_URL ? 'SET (hidden)' : 'NOT SET',
    MYSQL_DATABASE: process.env.MYSQL_DATABASE || 'NOT SET',
    MYSQLDATABASE: process.env.MYSQLDATABASE || 'NOT SET',
    MYSQLHOST: process.env.MYSQLHOST || 'NOT SET',
    MYSQLPORT: process.env.MYSQLPORT || 'NOT SET',
    MYSQLUSER: process.env.MYSQLUSER || 'NOT SET',
    MYSQLPASSWORD: process.env.MYSQLPASSWORD ? 'SET (hidden)' : 'NOT SET',
    // Custom DB vars
    DB_HOST: process.env.DB_HOST || 'NOT SET',
    DB_PORT: process.env.DB_PORT || 'NOT SET',
    DB_NAME: process.env.DB_NAME || 'NOT SET',
    DB_USER: process.env.DB_USER || 'NOT SET',
    DB_PASSWORD: process.env.DB_PASSWORD ? 'SET (hidden)' : 'NOT SET',
    // JWT vars
    JWT_SECRET: process.env.JWT_SECRET ? 'SET (hidden)' : 'NOT SET',
    JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || 'NOT SET'
  };
  
  res.json({ mysqlVars });
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

// Check users table structure
router.get('/check-users-table', async (req, res) => {
  try {
    if (process.env.NODE_ENV === 'production') {
      // MySQL query to describe table
      const columns = await db.all("DESCRIBE users");
      res.json({ 
        database: 'MySQL',
        columns: columns 
      });
    } else {
      // SQLite query to show table structure
      const columns = await db.all("PRAGMA table_info(users)");
      res.json({ 
        database: 'SQLite',
        columns: columns 
      });
    }
  } catch (error) {
    res.status(500).json({ 
      error: error.message,
      stack: error.stack 
    });
  }
});

// Get sample user (first user in database)
router.get('/check-sample-user', async (req, res) => {
  try {
    const user = await db.get('SELECT * FROM users LIMIT 1');
    
    if (!user) {
      return res.json({ 
        message: 'No users in database'
      });
    }
    
    // Return all fields and their values (except password)
    const userFields = {};
    for (const [key, value] of Object.entries(user)) {
      if (key.toLowerCase().includes('password')) {
        userFields[key] = value ? 'HAS_VALUE' : 'NULL';
      } else {
        userFields[key] = value;
      }
    }
    
    res.json({
      message: 'Sample user structure',
      fields: userFields,
      fieldNames: Object.keys(user)
    });
    
  } catch (error) {
    res.status(500).json({ 
      error: error.message,
      stack: error.stack 
    });
  }
});

// Test raw MySQL query
router.get('/test-user-query/:email', async (req, res) => {
  try {
    const { email } = req.params;
    
    // Test the exact query used in login
    const user = await db.get('SELECT * FROM users WHERE email = ? AND is_active = 1', [email]);
    
    // Also test without is_active filter
    const userNoFilter = await db.get('SELECT * FROM users WHERE email = ?', [email]);
    
    // Test selecting specific columns
    const userSpecific = await db.get('SELECT id, email, password_hash FROM users WHERE email = ?', [email]);
    
    res.json({
      queryWithIsActive: {
        found: !!user,
        fields: user ? Object.keys(user) : [],
        passwordHashExists: user ? !!user.password_hash : false,
        allData: user
      },
      queryWithoutIsActive: {
        found: !!userNoFilter,
        fields: userNoFilter ? Object.keys(userNoFilter) : [],
        passwordHashExists: userNoFilter ? !!userNoFilter.password_hash : false,
        isActive: userNoFilter ? userNoFilter.is_active : null
      },
      querySpecificColumns: {
        found: !!userSpecific,
        fields: userSpecific ? Object.keys(userSpecific) : [],
        passwordHashExists: userSpecific ? !!userSpecific.password_hash : false,
        data: userSpecific
      }
    });
    
  } catch (error) {
    res.status(500).json({ 
      error: error.message,
      stack: error.stack 
    });
  }
});

// Test login simulation
router.post('/test-login', async (req, res) => {
  try {
    const { email, password } = req.body;
    
    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password are required' });
    }
    
    // Exact same query as login
    const user = await db.get('SELECT * FROM users WHERE email = ? AND is_active = 1', [email]);
    
    if (!user) {
      return res.json({ 
        message: 'User not found',
        email: email 
      });
    }
    
    // Debug info
    const debugInfo = {
      userFound: true,
      email: user.email,
      hasPasswordHash: !!user.password_hash,
      passwordHashType: typeof user.password_hash,
      passwordHashValue: user.password_hash,
      allFields: Object.keys(user),
      userObject: JSON.stringify(user)
    };
    
    // Try bcrypt compare
    let bcryptResult = null;
    let bcryptError = null;
    
    try {
      bcryptResult = await bcrypt.compare(password, user.password_hash);
    } catch (err) {
      bcryptError = {
        message: err.message,
        stack: err.stack
      };
    }
    
    res.json({
      debugInfo,
      bcryptResult,
      bcryptError
    });
    
  } catch (error) {
    res.status(500).json({ 
      error: error.message,
      stack: error.stack 
    });
  }
});

// Test database connection
router.get('/test-connection', async (req, res) => {
  try {
    // Test simple query
    const result = await db.get('SELECT 1 as test');
    
    // Test user count
    const userCount = await db.get('SELECT COUNT(*) as count FROM users');
    
    // Get connection status
    const mysqlConnection = require('../database/mysql-connection');
    const conn = mysqlConnection.getConnection();
    
    res.json({
      connectionTest: result,
      userCount: userCount,
      connectionState: conn.state || 'unknown',
      isProduction: process.env.NODE_ENV === 'production'
    });
    
  } catch (error) {
    res.status(500).json({ 
      error: error.message,
      stack: error.stack,
      config: {
        DB_HOST: process.env.DB_HOST || 'NOT SET',
        DB_PORT: process.env.DB_PORT || 'NOT SET',
        DB_NAME: process.env.DB_NAME || 'NOT SET',
        DB_USER: process.env.DB_USER || 'NOT SET'
      }
    });
  }
});

module.exports = router;