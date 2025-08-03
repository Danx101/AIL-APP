# Migration Issues Explained

## 🔍 What's Happening?

Your SQLite database and MySQL database have different structures (schemas). When we try to import data, MySQL rejects it because:

1. **Missing Columns** - SQLite has columns that don't exist in MySQL
2. **Different Column Names** - Some columns have different names
3. **Data Format Incompatibilities** - SQLite and MySQL store dates/times differently

## 📊 Issue #1: Missing Columns

### What the error looks like:
```
❌ Import error: Unknown column 'cancellation_advance_hours' in 'field list'
```

### Why it happens:
Your SQLite database has evolved over time. New columns were added to SQLite tables, but the MySQL database wasn't updated to match.

### Example:
- **SQLite studios table has**: name, address, phone, **cancellation_advance_hours** ✅
- **MySQL studios table has**: name, address, phone ❌ (missing the new column)

### Tables affected:
- `studios` - missing 4 columns
- `manager_codes` - missing 3 columns  
- `google_sheets_integrations` - missing 5 columns

## 🏷️ Issue #2: Different Column Names

### What the error looks like:
```
❌ Import error: Unknown column 'phone_number' in 'field list'
```

### Why it happens:
The same data has different column names in each database.

### Example:
- **SQLite leads table**: uses `phone_number`
- **MySQL leads table**: uses `phone`

## 📅 Issue #3: DateTime Format Differences

### What the error looks like:
```
❌ Import error: Incorrect datetime value: '2025-07-21T14:23:49.427Z' for column 'expires_at'
```

### Why it happens:
SQLite and MySQL store dates differently:

- **SQLite format**: `2025-07-21T14:23:49.427Z` (ISO 8601 with T and Z)
- **MySQL expects**: `2025-07-21 14:23:49` (space instead of T, no Z)

## ⏰ Issue #4: Time Format Differences

### What the error looks like:
```
❌ You have an error in your SQL syntax... near ':30, 10:30'
```

### Why it happens:
MySQL TIME columns require seconds:

- **SQLite stores**: `09:30` (just hours and minutes)
- **MySQL expects**: `09:30:00` (with seconds)

## 🔧 Issue #5: SQL Syntax Differences

### What the error looks like:
```
❌ Error: You have an error in your SQL syntax... near 'IF NOT EXISTS'
```

### Why it happens:
MySQL (especially older versions) doesn't support `IF NOT EXISTS` in `ALTER TABLE ADD COLUMN`.

- **Works in SQLite**: `ALTER TABLE studios ADD COLUMN IF NOT EXISTS ...`
- **MySQL needs**: `ALTER TABLE studios ADD COLUMN ...` (without IF NOT EXISTS)

## 🎯 The Solution Process

### Step 1: Fix the Schema (Structure)
We need to make MySQL tables match SQLite tables by:
1. Adding missing columns
2. Renaming columns to match
3. Ensuring data types are compatible

### Step 2: Fix the Data Format
Before importing, we need to:
1. Convert ISO dates to MySQL format
2. Add seconds to time values
3. Handle NULL values properly

### Step 3: Import Incrementally
Using `INSERT ... ON DUPLICATE KEY UPDATE` ensures:
1. New records are added
2. Existing records are updated
3. No data is lost

## 📈 Current Progress

✅ **What worked:**
- Railway MySQL connection established
- User authentication data partially imported
- maxberger@ail.com exists and can login

❌ **What failed:**
- Studios (missing columns)
- Appointments (time format issues)
- Leads (column name mismatch)
- Google Sheets data (missing columns)

## 🚀 Next Steps

1. **Run schema fixes** in Railway MySQL console
2. **Re-run the migration** after schema is fixed
3. **The script will handle** format conversions automatically

The good news: Your app is running and functional. These import errors just mean some historical data isn't migrated yet!