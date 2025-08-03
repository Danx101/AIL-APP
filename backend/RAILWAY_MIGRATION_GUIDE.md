# Railway MySQL Migration Guide

## 🎯 Overview

This guide provides a comprehensive approach to migrating data from SQLite to Railway MySQL using **incremental sync** to prevent data loss.

## 📁 Database Locations

### Correct Database Files:
- **Primary SQLite Database**: `backend/database.sqlite` (401KB - contains user data)
- **Secondary SQLite Database**: `backend/src/database/abnehmen_app.db` (94KB - limited tables)
- **MySQL Database**: Railway hosted at `hopper.proxy.rlwy.net:34671`

### ⚠️ Important: 
The main database with user data is `backend/database.sqlite`, NOT `abnehmen_app.db`!

## 🔧 Pre-Migration Setup

### 1. Railway MySQL Environment Variables
```bash
# Railway provides these automatically:
MYSQL_DATABASE=railway
MYSQL_PUBLIC_URL=mysql://root:bbr1hm1gPbZdyKSrAeRepjooYRiSayER@hopper.proxy.rlwy.net:34671/railway
MYSQL_ROOT_PASSWORD=bbr1hm1gPbZdyKSrAeRepjooYRiSayER
MYSQL_URL=mysql://root:bbr1hm1gPbZdyKSrAeRepjooYRiSayER@mysql.railway.internal:3306/railway
MYSQLDATABASE=railway
MYSQLHOST=hopper.proxy.rlwy.net
MYSQLPASSWORD=bbr1hm1gPbZdyKSrAeRepjooYRiSayER
MYSQLPORT=34671
MYSQLUSER=root

# Your app needs these in Railway:
NODE_ENV=production
PORT=3001
DB_HOST=hopper.proxy.rlwy.net
DB_PORT=34671
DB_USER=root
DB_PASSWORD=bbr1hm1gPbZdyKSrAeRepjooYRiSayER
DB_NAME=railway
JWT_SECRET=abnehmen-im-liegen-jwt-secret-2025-secure-key
JWT_EXPIRES_IN=24d
FRONTEND_URL=https://ail-app.vercel.app
```

### 2. Fix Schema Mismatches First

Before migration, update your MySQL schema to match SQLite:

```sql
-- Run these in Railway MySQL console or through a script:

-- Studios table
ALTER TABLE studios ADD COLUMN IF NOT EXISTS cancellation_advance_hours INT DEFAULT 48;
ALTER TABLE studios ADD COLUMN IF NOT EXISTS postponement_advance_hours INT DEFAULT 48;
ALTER TABLE studios ADD COLUMN IF NOT EXISTS max_advance_booking_days INT DEFAULT 30;
ALTER TABLE studios ADD COLUMN IF NOT EXISTS settings_updated_at TIMESTAMP;

-- Manager codes table  
ALTER TABLE manager_codes ADD COLUMN IF NOT EXISTS intended_owner_name VARCHAR(255);
ALTER TABLE manager_codes ADD COLUMN IF NOT EXISTS intended_city VARCHAR(255);
ALTER TABLE manager_codes ADD COLUMN IF NOT EXISTS intended_studio_name VARCHAR(255);

-- Google sheets integrations table
ALTER TABLE google_sheets_integrations ADD COLUMN IF NOT EXISTS last_sync_at TIMESTAMP;
ALTER TABLE google_sheets_integrations ADD COLUMN IF NOT EXISTS sync_status VARCHAR(50);
ALTER TABLE google_sheets_integrations ADD COLUMN IF NOT EXISTS column_mapping TEXT;
ALTER TABLE google_sheets_integrations ADD COLUMN IF NOT EXISTS auto_sync_enabled BOOLEAN DEFAULT TRUE;
ALTER TABLE google_sheets_integrations ADD COLUMN IF NOT EXISTS sync_frequency_minutes INT DEFAULT 30;

-- Add session tables if missing
CREATE TABLE IF NOT EXISTS session_blocks (
  id INT AUTO_INCREMENT PRIMARY KEY,
  customer_id INT NOT NULL,
  studio_id INT NOT NULL,
  package_type VARCHAR(50) NOT NULL,
  total_sessions INT NOT NULL,
  used_sessions INT DEFAULT 0,
  remaining_sessions INT NOT NULL,
  purchase_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  expiry_date TIMESTAMP,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (customer_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (studio_id) REFERENCES studios(id) ON DELETE CASCADE
);
```

## 🚀 Migration Process

### Option 1: Incremental Sync (Recommended)

```bash
# 1. Navigate to backend directory
cd /path/to/abnehmen-app/backend

# 2. Set Railway MySQL credentials in .env file
cat > .env << EOF
NODE_ENV=production
DB_HOST=hopper.proxy.rlwy.net
DB_PORT=34671
DB_USER=root
DB_PASSWORD=bbr1hm1gPbZdyKSrAeRepjooYRiSayER
DB_NAME=railway
EOF

# 3. Preview what will be synced
npm run db:preview

# 4. Run incremental sync (preserves existing data)
npm run db:sync

# 5. Verify sync status
npm run db:status
```

### Option 2: Manual Migration with Fixes

```bash
# 1. Export from SQLite with format fixes
cd backend/scripts
node export-sqlite-data.js

# 2. Fix datetime and time formats in exported SQL
# This step requires manual editing or a conversion script

# 3. Import to MySQL
DB_HOST=hopper.proxy.rlwy.net \
DB_PORT=34671 \
DB_USER=root \
DB_PASSWORD=bbr1hm1gPbZdyKSrAeRepjooYRiSayER \
DB_NAME=railway \
NODE_ENV=production \
node import-to-mysql.js
```

## 📊 Current Data Status

### From Latest Export (August 3, 2025):
- **Users**: 12 records (including customers, studio owners)
- **Studios**: 3 records
- **Activation Codes**: 9 records
- **Appointments**: 25 records
- **Customer Sessions**: 25 records
- **Session Transactions**: 77 records
- **Leads**: 2 records
- **Google Sheets Integrations**: 859 records

### Known Issues:
1. **Customers not showing**: They exist in the database but need activation codes linked to studios
2. **Time format errors**: SQLite stores time as '09:30', MySQL needs '09:30:00'
3. **DateTime format errors**: SQLite uses ISO format, MySQL needs standard format

## 🛡️ Safety Measures

### Before Migration:
1. **Backup Railway MySQL**: Use Railway's backup feature
2. **Test locally first**: Use a local MySQL instance
3. **Preview changes**: Always use `npm run db:preview`

### During Migration:
1. **Use transactions**: All imports wrapped in transactions
2. **Monitor logs**: Check Railway logs during import
3. **Verify incrementally**: Check data after each table

### After Migration:
1. **Verify user login**: Test with maxberger@ail.com
2. **Check customer visibility**: Ensure customers appear in studio dashboard
3. **Test appointments**: Create and view appointments
4. **Monitor errors**: Check browser console and Railway logs

## 🔄 Future Syncs

### Development Workflow:
```bash
# Daily sync from local SQLite to Railway MySQL
npm run db:sync

# Check what changed
npm run db:status

# Rollback if needed
npm run db:rollback
```

### Automated Sync:
```bash
# Set up cron job for automatic sync
# Add to Railway's cron configuration:
0 2 * * * cd /app && npm run db:sync
```

## 📝 Troubleshooting

### Common Issues:

1. **"Access denied for user 'root'@'IP'"**
   - Ensure all environment variables are set correctly
   - Check if Railway MySQL allows external connections
   - Try using MYSQL_PUBLIC_URL for connection

2. **"Unknown column" errors**
   - Run the schema update SQL commands above
   - Check MIGRATION_RESULTS.md for specific column issues

3. **"No data showing in UI"**
   - Verify customers have activation codes linked to studios
   - Check browser network tab for API errors
   - Ensure CORS is configured for your domain

4. **Time/DateTime format errors**
   - Update export script to format times as HH:MM:SS
   - Convert ISO dates to MySQL format: YYYY-MM-DD HH:MM:SS

## 🎯 Success Checklist

- [ ] Railway MySQL environment variables configured
- [ ] Schema mismatches fixed with ALTER TABLE commands
- [ ] Export script uses correct database path (backend/database.sqlite)
- [ ] Time and DateTime formats converted properly
- [ ] Incremental sync tested with preview
- [ ] User authentication working
- [ ] Customers visible in studio dashboard
- [ ] Appointments displaying correctly
- [ ] No data loss from production

## 🚨 Emergency Recovery

If something goes wrong:

1. **Stop the application**: Prevent further changes
2. **Use Railway backup**: Restore to previous state
3. **Check sync logs**: `npm run db:status`
4. **Re-run with fixes**: Address specific errors
5. **Contact support**: Railway and Vercel support channels

Remember: Always use incremental sync for production to prevent data loss!