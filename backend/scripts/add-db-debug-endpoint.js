const fs = require('fs');
const path = require('path');

// Read the debugRoutes.js file
const filePath = path.join(__dirname, '../src/routes/debugRoutes.js');
const content = fs.readFileSync(filePath, 'utf8');

// Add new endpoint before module.exports
const newEndpoint = `
// Check which database is actually being used
router.get('/which-db', authenticate, authorize(['manager']), async (req, res) => {
  try {
    const dbType = process.env.NODE_ENV === 'production' ? 'MySQL' : 'SQLite';
    const actualNodeEnv = process.env.NODE_ENV;
    
    // Try a test query to verify
    let testResult = {};
    try {
      if (process.env.NODE_ENV === 'production') {
        // MySQL test
        const result = await db.get('SELECT COUNT(*) as count FROM users');
        testResult.userCount = result.count;
        testResult.actualDb = 'MySQL';
      } else {
        // SQLite test
        const result = await db.get('SELECT COUNT(*) as count FROM users');
        testResult.userCount = result.count;
        testResult.actualDb = 'SQLite';
      }
    } catch (err) {
      testResult.error = err.message;
    }
    
    // Get customer count for maxberger
    let customerCount = 0;
    try {
      const maxUser = await db.get('SELECT id FROM users WHERE email = ?', ['maxberger@ail.com']);
      if (maxUser) {
        const studios = await db.all('SELECT id FROM studios WHERE owner_id = ?', [maxUser.id]);
        const studioIds = studios.map(s => s.id);
        
        if (studioIds.length > 0) {
          const placeholders = studioIds.map(() => '?').join(',');
          const customers = await db.all(\`
            SELECT COUNT(DISTINCT u.id) as count
            FROM users u
            JOIN activation_codes ac ON u.id = ac.used_by_user_id
            WHERE u.role = 'customer' 
            AND ac.studio_id IN (\${placeholders})
            AND ac.is_used = 1
          \`, studioIds);
          customerCount = customers[0].count;
        }
      }
    } catch (err) {
      // Ignore
    }
    
    res.json({
      configured: dbType,
      nodeEnv: actualNodeEnv,
      testResult,
      customerCount,
      envVars: {
        NODE_ENV: process.env.NODE_ENV,
        DB_HOST: process.env.DB_HOST ? 'Set' : 'Not set',
        MYSQLHOST: process.env.MYSQLHOST ? 'Set' : 'Not set',
        RAILWAY_ENVIRONMENT: process.env.RAILWAY_ENVIRONMENT ? 'Set' : 'Not set'
      }
    });
  } catch (error) {
    console.error('Debug which-db error:', error);
    res.status(500).json({ error: error.message });
  }
});

`;

// Find the position to insert (before module.exports)
const insertPosition = content.lastIndexOf('module.exports = router;');

// Insert the new endpoint
const updatedContent = content.slice(0, insertPosition) + newEndpoint + '\n' + content.slice(insertPosition);

// Write back to file
fs.writeFileSync(filePath, updatedContent);

console.log('✅ Added /api/v1/debug/which-db endpoint to debugRoutes.js');
console.log('🚀 Deploy this change to Railway to check which database is being used');