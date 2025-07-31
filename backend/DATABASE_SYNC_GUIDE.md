# Smart Database Sync Guide

This enhanced system provides **safe incremental synchronization** between your SQLite development database and MySQL production database.

## 🆕 New Workflow (Incremental Sync)

### **Development → Production Sync**
```bash
# 1. Preview what will be synced
npm run db:preview

# 2. Sync only your changes (SAFE - preserves production data)
npm run db:sync

# 3. Check sync status
npm run db:status
```

### **Your New Development Workflow**
1. **Develop locally** → Changes saved to SQLite automatically
2. **Preview changes** → See what's new since last sync  
3. **Sync incrementally** → Only your changes go to production
4. **Production data safe** → User data in MySQL never gets lost

## 🔧 Available Commands

### **Incremental Sync Commands (Recommended)**
```bash
npm run db:sync        # Smart sync - only changed records
npm run db:preview     # Show what would be synced
npm run db:test        # Test sync without making changes  
npm run db:status      # Show sync history and table status
npm run db:rollback    # Undo last sync (limited functionality)
```

### **Full Migration Commands (Destructive)**
```bash
npm run db:migrate     # Full replacement migration (original)
npm run db:export      # Export all SQLite data
npm run db:import      # Import all data to MySQL (replaces everything)
```

### **Interactive Mode**
```bash
# Launch interactive menu
node scripts/sync-database.js
```

## 📊 How Incremental Sync Works

### **Change Tracking**
- **Timestamps**: Uses `created_at` and `updated_at` to track changes
- **Sync checkpoints**: Remembers when each table was last synced
- **Smart detection**: Only exports records newer than last sync

### **Safe Import Process**  
- **UPSERT operations**: `INSERT ... ON DUPLICATE KEY UPDATE`
- **Preserves existing data**: Production records stay safe
- **Conflict resolution**: Updates existing records, inserts new ones
- **Transaction safety**: All changes wrapped in database transactions

### **Example Sync Session**
```
📊 Changes to sync:
- leads: 5 new, 2 updated  
- appointments: 3 new
- users: 1 updated

Total: 8 new, 3 updated records
Continue? (yes/no): yes

✅ Sync completed successfully!
```

## 🆚 Incremental vs Full Migration

| Feature | Incremental Sync | Full Migration |
|---------|------------------|----------------|
| **Data Safety** | ✅ Preserves production data | ❌ Replaces all data |
| **Speed** | ✅ Fast (only changes) | ❌ Slow (all data) |
| **Production Risk** | ✅ Low risk | ❌ High risk |
| **Use Case** | Daily development sync | Initial setup only |
| **Rollback** | ✅ Possible | ❌ Data loss |

## 🔄 Sync Scenarios

### **Scenario 1: Daily Development**
```bash
# Monday: Add 10 leads locally
npm run db:sync  # → Syncs 10 new leads

# Tuesday: Users book 5 appointments in production (stays safe!)  
# Tuesday: You update 2 leads locally
npm run db:sync  # → Syncs 2 updated leads, preserves 5 appointments
```

### **Scenario 2: Conflict Resolution**
```bash
# You update lead #123 locally
# User updates lead #123 in production  
npm run db:sync  # → Your changes overwrite production (configurable)
```

### **Scenario 3: First-Time Setup**
```bash
# No previous sync data
npm run db:sync  # → Syncs ALL data (like full migration)
```

## 🛠️ Configuration & Setup

### **Environment Variables**
Required for production MySQL connection:
```bash
NODE_ENV=production
DB_HOST=your-mysql-host
DB_PORT=3306
DB_USER=your-username  
DB_PASSWORD=your-password
DB_NAME=your-database
```

### **Automatic Setup**
The sync system automatically:
- ✅ Creates tracking tables (`sync_tracking`, `sync_checkpoints`)
- ✅ Adds missing timestamp columns (`updated_at`)
- ✅ Initializes sync checkpoints for all tables
- ✅ Handles first-time vs incremental sync detection

## 📋 Monitoring & Debugging

### **Check Sync Status**
```bash
npm run db:status
```
Shows:
- Recent sync history
- Records synced per session  
- Last sync timestamp per table
- Sync performance metrics

### **Preview Before Sync**
```bash
npm run db:preview
```
Shows:
- Exactly what records will be synced
- New vs updated record counts
- Sample record details
- Estimated sync time

### **Test Mode (Dry Run)**
```bash
npm run db:test
```
- Executes full sync process
- Makes no actual changes  
- Shows what would happen
- Validates sync logic

## 🚨 Error Handling

### **Common Issues**

1. **"No changes found"**
   - ✅ Normal - means database is up to date
   - Everything already synced

2. **"Connection failed"**  
   - Check MySQL credentials in environment
   - Verify database server accessibility

3. **"Sync tracking not enabled"**
   - Run once to initialize tracking tables
   - Automatic setup on first run

4. **"Table not found"**
   - Table doesn't exist in SQLite
   - Normal for fresh installations

### **Recovery Options**

```bash
# View detailed logs
npm run db:status

# Test connectivity  
npm run db:test

# Rollback if needed (limited)
npm run db:rollback

# Force full sync if corrupted
node scripts/sync-database.js full
```

## 🔐 Data Safety Features

### **Built-in Protections**
- ✅ **Transaction safety**: Changes wrapped in database transactions  
- ✅ **Rollback capability**: Can undo last sync operation
- ✅ **Dry run mode**: Test without making changes
- ✅ **Preview mode**: See changes before applying
- ✅ **Error recovery**: Failed syncs don't corrupt data
- ✅ **Audit trail**: Complete history of all sync operations

### **Best Practices**
1. **Always preview** changes before syncing to production
2. **Test sync process** in staging environment first  
3. **Monitor sync status** regularly for issues
4. **Keep backups** of production database
5. **Use incremental sync** for daily development
6. **Reserve full migration** for initial setup only

## 📚 File Structure

```
backend/
├── scripts/
│   ├── sync-database.js          # Main sync utility (interactive)
│   ├── export-incremental.js     # Smart incremental export  
│   ├── import-incremental.js     # Safe incremental import
│   ├── export-sqlite-data.js     # Full export (legacy)
│   └── import-to-mysql.js        # Full import (legacy)
├── src/database/migrations/
│   ├── add_sync_tracking.js      # Sync tables migration
│   └── add_missing_timestamps.js # Timestamp columns migration  
└── migrations/data/              # Generated sync files
    ├── incremental_export.sql    # Latest changes
    ├── incremental_export_summary.json
    └── incremental_import_summary.json
```

This system gives you the best of both worlds: easy local development with SQLite, and safe production sync with MySQL! 🎉