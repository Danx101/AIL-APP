# Railway CLI Migration Guide

## Step 1: Install Railway CLI

```bash
# Install using npm (you already have Node.js)
npm install -g @railway/cli

# Or using Homebrew on macOS
brew install railway
```

## Step 2: Login to Railway

```bash
# This will open your browser to authenticate
railway login
```

## Step 3: Link Your Project

```bash
# Navigate to your backend directory
cd /Users/danylogevel/Documents/Coding/AIL\ APP/abnehmen-app/backend

# Link to your Railway project
railway link

# It will ask you to select:
# 1. Your project (probably named "ail-app" or similar)
# 2. The environment (select "production")
```

## Step 4: Access MySQL Through Railway

```bash
# Connect to MySQL through Railway tunnel
railway run mysql -u root -p

# When prompted for password, enter: bbr1hm1gPbZdyKSrAeRepjooYRiSayER
```

## Step 5: Run Schema Fixes

Once connected to MySQL, run these commands:

```sql
-- First, select your database
USE railway;

-- Add missing columns to studios table
ALTER TABLE studios ADD COLUMN IF NOT EXISTS cancellation_advance_hours INT DEFAULT 48;
ALTER TABLE studios ADD COLUMN IF NOT EXISTS postponement_advance_hours INT DEFAULT 48;
ALTER TABLE studios ADD COLUMN IF NOT EXISTS max_advance_booking_days INT DEFAULT 30;
ALTER TABLE studios ADD COLUMN IF NOT EXISTS settings_updated_at TIMESTAMP;

-- Add missing columns to manager_codes table
ALTER TABLE manager_codes ADD COLUMN IF NOT EXISTS intended_owner_name VARCHAR(255);
ALTER TABLE manager_codes ADD COLUMN IF NOT EXISTS intended_city VARCHAR(255);
ALTER TABLE manager_codes ADD COLUMN IF NOT EXISTS intended_studio_name VARCHAR(255);

-- Add missing columns to google_sheets_integrations table
ALTER TABLE google_sheets_integrations ADD COLUMN IF NOT EXISTS last_sync_at TIMESTAMP;
ALTER TABLE google_sheets_integrations ADD COLUMN IF NOT EXISTS sync_status VARCHAR(50);
ALTER TABLE google_sheets_integrations ADD COLUMN IF NOT EXISTS column_mapping TEXT;
ALTER TABLE google_sheets_integrations ADD COLUMN IF NOT EXISTS auto_sync_enabled BOOLEAN DEFAULT TRUE;
ALTER TABLE google_sheets_integrations ADD COLUMN IF NOT EXISTS sync_frequency_minutes INT DEFAULT 30;

-- Check if columns were added
SHOW COLUMNS FROM studios;
SHOW COLUMNS FROM manager_codes;
SHOW COLUMNS FROM google_sheets_integrations;

-- Exit MySQL
exit;
```

## Step 6: Import Your Data

```bash
# Method 1: Direct import
railway run mysql -u root -pbbr1hm1gPbZdyKSrAeRepjooYRiSayER railway < migrations/data/incremental_export.sql

# Method 2: If Method 1 doesn't work, connect and paste
railway run mysql -u root -pbbr1hm1gPbZdyKSrAeRepjooYRiSayER railway

# Then in MySQL prompt:
source migrations/data/incremental_export.sql;
```

## Step 7: Verify Import Success

```bash
# Connect to MySQL again
railway run mysql -u root -pbbr1hm1gPbZdyKSrAeRepjooYRiSayER railway

# Run verification queries
SELECT COUNT(*) as user_count FROM users;
-- Should show: 12

SELECT COUNT(*) as studio_count FROM studios;
-- Should show: 3

SELECT COUNT(*) as appointment_count FROM appointments;
-- Should show: 25

SELECT email, role FROM users WHERE email = 'maxberger@ail.com';
-- Should show: maxberger@ail.com | studio_owner

-- Exit MySQL
exit;
```

## Alternative: Use Railway Shell

If the above doesn't work, try:

```bash
# Open a shell in your Railway environment
railway shell

# Now you're inside the Railway container
# Navigate to your app directory
cd /app

# Run the import directly
mysql -h $MYSQLHOST -P $MYSQLPORT -u $MYSQLUSER -p$MYSQLPASSWORD $MYSQLDATABASE < migrations/data/incremental_export.sql
```

## Troubleshooting

### "Command not found: railway"
- Make sure npm install completed: `npm list -g @railway/cli`
- Try restarting your terminal
- On macOS, you might need to add npm global bin to PATH

### "No project linked"
- Make sure you're in the backend directory
- Run `railway list` to see available projects
- Try `railway link --project <project-id>`

### "Access denied" errors
- The password has special characters, make sure to quote it
- Try without space after -p: `-pbbr1hm1gPbZdyKSrAeRepjooYRiSayER`

### Can't find the SQL files
- Make sure you're in the backend directory
- The files are at:
  - `scripts/fix-mysql-schema.sql`
  - `migrations/data/incremental_export.sql`

## After Successful Import

1. Go to https://ail-app.vercel.app
2. Login with maxberger@ail.com / IchbinMax123
3. Check if you can see:
   - Dashboard stats
   - Customer list
   - Appointments

The import is INCREMENTAL - it won't delete any existing data!