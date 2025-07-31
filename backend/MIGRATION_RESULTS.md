# Database Migration Results & Schema Mismatches

## 🎉 Migration Summary

**Date:** July 31, 2025  
**Status:** Partially Successful  
**Database:** Railway MySQL  

### ✅ Successfully Migrated
- **Users**: 11 records ✅
- **Total MySQL Database**: 11 records

### ❌ Failed Migrations
- **Studios**: 0/3 records
- **Activation Codes**: 0/9 records  
- **Manager Codes**: 0/4 records
- **Appointments**: 0/25 records
- **Leads**: 0/2 records
- **Google Sheets Integrations**: 0/582 records
- **Lead Call Logs**: 0/0 records (empty)
- **Dialogflow Conversations**: 0/0 records (empty)

## 🔧 Schema Mismatches to Resolve

### 1. Studios Table
**Error:** `Unknown column 'cancellation_advance_hours' in 'field list'`

**Issue:** SQLite has additional column not in MySQL schema
```sql
-- Missing in MySQL:
cancellation_advance_hours INTEGER
```

**Fix Required:** Add column to MySQL schema in `mysql-connection.js`

### 2. Manager Codes Table  
**Error:** `Unknown column 'intended_owner_name' in 'field list'`

**Issue:** SQLite has additional columns not in MySQL schema
```sql
-- Missing in MySQL:
intended_owner_name TEXT
intended_city TEXT  
intended_studio_name TEXT
```

**Fix Required:** Add columns to MySQL schema in `mysql-connection.js`

### 3. Leads Table
**Error:** `Unknown column 'phone_number' in 'field list'`

**Issue:** Column name mismatch between SQLite and MySQL
- **SQLite:** `phone_number` 
- **MySQL:** `phone`

**Fix Required:** Standardize column name (recommend `phone` for consistency)

### 4. Google Sheets Integrations Table
**Error:** `Unknown column 'last_sync_at' in 'field list'`

**Issue:** SQLite has additional columns not in MySQL schema
```sql
-- Missing in MySQL:
last_sync_at TIMESTAMP
sync_status TEXT
column_mapping TEXT
auto_sync_enabled BOOLEAN
sync_frequency_minutes INTEGER  
```

**Fix Required:** Add columns to MySQL schema in `mysql-connection.js`

### 5. Appointments Table
**Error:** `You have an error in your SQL syntax... near ':30, 10:30'`

**Issue:** Time format incompatibility between SQLite and MySQL
- **SQLite stores:** `09:30` (as TEXT)
- **MySQL expects:** `'09:30:00'` (proper TIME format)

**Fix Required:** Update export script to format TIME values properly for MySQL

### 6. Activation Codes Table
**Error:** `Incorrect datetime value: '2025-07-21T14:23:49.427Z' for column 'expires_at'`

**Issue:** DateTime format incompatibility  
- **SQLite stores:** ISO format with 'T' and 'Z'
- **MySQL expects:** Standard datetime format

**Fix Required:** Update export script to convert ISO datetime to MySQL format

## 🛠️ Recommended Fixes

### Priority 1: Critical Schema Updates
1. **Update MySQL schema** in `src/database/mysql-connection.js`:
   ```sql
   -- Studios table
   ALTER TABLE studios ADD COLUMN cancellation_advance_hours INT;
   
   -- Manager codes table  
   ALTER TABLE manager_codes ADD COLUMN intended_owner_name VARCHAR(255);
   ALTER TABLE manager_codes ADD COLUMN intended_city VARCHAR(255);
   ALTER TABLE manager_codes ADD COLUMN intended_studio_name VARCHAR(255);
   
   -- Leads table (rename column)
   ALTER TABLE leads CHANGE COLUMN phone phone_number VARCHAR(20);
   
   -- Google sheets integrations table
   ALTER TABLE google_sheets_integrations ADD COLUMN last_sync_at TIMESTAMP;
   ALTER TABLE google_sheets_integrations ADD COLUMN sync_status VARCHAR(50);
   ALTER TABLE google_sheets_integrations ADD COLUMN column_mapping TEXT;
   ALTER TABLE google_sheets_integrations ADD COLUMN auto_sync_enabled BOOLEAN DEFAULT TRUE;  
   ALTER TABLE google_sheets_integrations ADD COLUMN sync_frequency_minutes INT DEFAULT 30;
   ```

### Priority 2: Data Format Fixes
2. **Update export scripts** to handle format conversions:
   - Convert ISO datetime to MySQL datetime format
   - Format TIME values with seconds (HH:MM:SS)
   - Handle NULL values properly

### Priority 3: Sync Script Updates  
3. **Enhance sync scripts** to detect and handle schema differences automatically

## 📋 Current Workaround

**For immediate deployment:**
- ✅ **User authentication works** (11 users migrated)
- ✅ **Basic app functionality** available
- ⚠️ **Other features** will recreate data naturally through app usage
- ⚠️ **Existing appointments/leads** need manual recreation or schema fix + re-migration

## 🚀 Next Steps

1. **Deploy current state** - User authentication works
2. **Fix schema mismatches** using the SQL commands above
3. **Re-run migration** after schema fixes
4. **Test full functionality** with migrated data

## 📊 Migration Files

**Generated during migration:**
- `migrations/data/sqlite_export.sql` - Original export (268KB)
- `migrations/data/export_summary.json` - Export statistics  
- `migrations/data/import_summary.json` - Import results

**Final Status:** Ready for production deployment with user authentication. Schema fixes recommended for full data migration.