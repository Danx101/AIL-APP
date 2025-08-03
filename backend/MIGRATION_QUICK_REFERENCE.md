# Migration Quick Reference Card

## 🚀 Quick Migration Steps

### 1. Fix MySQL Schema First (Run in Railway MySQL Console)
```sql
-- Copy and paste this entire block:
ALTER TABLE studios ADD COLUMN IF NOT EXISTS cancellation_advance_hours INT DEFAULT 48;
ALTER TABLE studios ADD COLUMN IF NOT EXISTS postponement_advance_hours INT DEFAULT 48;
ALTER TABLE studios ADD COLUMN IF NOT EXISTS max_advance_booking_days INT DEFAULT 30;
ALTER TABLE studios ADD COLUMN IF NOT EXISTS settings_updated_at TIMESTAMP;

ALTER TABLE manager_codes ADD COLUMN IF NOT EXISTS intended_owner_name VARCHAR(255);
ALTER TABLE manager_codes ADD COLUMN IF NOT EXISTS intended_city VARCHAR(255);
ALTER TABLE manager_codes ADD COLUMN IF NOT EXISTS intended_studio_name VARCHAR(255);

ALTER TABLE google_sheets_integrations ADD COLUMN IF NOT EXISTS last_sync_at TIMESTAMP;
ALTER TABLE google_sheets_integrations ADD COLUMN IF NOT EXISTS sync_status VARCHAR(50);
ALTER TABLE google_sheets_integrations ADD COLUMN IF NOT EXISTS column_mapping TEXT;
ALTER TABLE google_sheets_integrations ADD COLUMN IF NOT EXISTS auto_sync_enabled BOOLEAN DEFAULT TRUE;
ALTER TABLE google_sheets_integrations ADD COLUMN IF NOT EXISTS sync_frequency_minutes INT DEFAULT 30;
```

### 2. Run Migration (from backend directory)
```bash
# Set environment variables
export DB_HOST=hopper.proxy.rlwy.net
export DB_PORT=34671
export DB_USER=root
export DB_PASSWORD=bbr1hm1gPbZdyKSrAeRepjooYRiSayER
export DB_NAME=railway
export NODE_ENV=production

# Run incremental sync
npm run db:sync
```

## 📊 Data Check
Your SQLite database (backend/database.sqlite) contains:
- 12 users (including maxberger@ail.com)
- 3 studios
- 25 appointments
- 9 activation codes
- 25 customer sessions

## 🔍 Verify Success
1. Login at https://ail-app.vercel.app with maxberger@ail.com
2. Check if customers appear in the dashboard
3. Verify appointments are visible

## ⚠️ Common Fixes
- **No customers showing?** Customers need activation codes linked to studios
- **Time errors?** Need to convert '09:30' to '09:30:00' format
- **Auth errors?** Check Railway MySQL is accepting connections

## 🆘 If Things Go Wrong
```bash
# Check what was synced
npm run db:status

# Preview without making changes
npm run db:preview

# Run in test mode
npm run db:test
```

Remember: The sync is INCREMENTAL - it won't delete existing production data!