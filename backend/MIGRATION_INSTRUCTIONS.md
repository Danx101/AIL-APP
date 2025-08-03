# Migration Instructions for Railway MySQL

## Current Situation
- ✅ Data exported successfully (914 records)
- ❌ Direct connection to Railway MySQL blocked (external access restricted)
- ✅ Your app IS connected to Railway MySQL successfully

## Migration Options

### Option 1: Use Railway CLI (Recommended)
```bash
# 1. Install Railway CLI
npm install -g @railway/cli

# 2. Login to Railway
railway login

# 3. Link to your project
railway link

# 4. Run the schema fixes
railway run mysql -u root -p$MYSQL_ROOT_PASSWORD railway < scripts/fix-mysql-schema.sql

# 5. Import the data
railway run mysql -u root -p$MYSQL_ROOT_PASSWORD railway < migrations/data/incremental_export.sql
```

### Option 2: Railway Web Console
1. Go to Railway Dashboard
2. Select your MySQL database
3. Click "Query" tab
4. Copy and paste from `scripts/fix-mysql-schema.sql`
5. Run the queries
6. Then copy and paste from `migrations/data/incremental_export.sql`
7. Run the import

### Option 3: Create Import Endpoint (Advanced)
Add a temporary import endpoint to your backend that runs on Railway:

```javascript
// Add to your backend temporarily
app.post('/api/v1/admin/import-data', authenticate, authorize(['manager']), async (req, res) => {
  const fs = require('fs').promises;
  const path = require('path');
  
  try {
    // Read the SQL file
    const sqlPath = path.join(__dirname, '../migrations/data/incremental_export.sql');
    const sqlContent = await fs.readFile(sqlPath, 'utf8');
    
    // Execute the SQL
    const connection = mysqlConnection.getConnection();
    await connection.query(sqlContent);
    
    res.json({ message: 'Import successful' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
```

## Verification Steps

After import:
1. Check user count: Should be 12 (not 11)
2. Login with maxberger@ail.com / IchbinMax123
3. Check if customers appear (they need activation codes)
4. Verify appointments show up

## Your Exported Data Summary
- Users: 12 (including maxberger@ail.com)
- Studios: 3 (including "AiL Berlin" owned by maxberger)
- Activation codes: 9
- Appointments: 25
- Customer sessions: 25
- Leads: 2
- Google Sheets integrations: 859

## Schema Fixes Required First
Before importing, run the SQL from `scripts/fix-mysql-schema.sql` to add missing columns.