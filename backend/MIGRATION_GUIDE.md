# SQLite to MySQL Migration Guide

This guide explains how to migrate your data from SQLite (development) to MySQL (production) for Railway deployment.

## Overview

Your application uses:
- **SQLite** for development (`NODE_ENV=development`)
- **MySQL** for production (`NODE_ENV=production`)

When you develop locally, changes are saved to SQLite. For production deployment, you need to migrate this data to MySQL.

## Prerequisites

### 1. Environment Variables
Ensure these variables are set in your Railway deployment:

```bash
NODE_ENV=production
DB_HOST=<your-mysql-host>
DB_PORT=3306
DB_USER=<your-mysql-user>
DB_PASSWORD=<your-mysql-password>
DB_NAME=<your-database-name>
```

### 2. Local Setup
Your `.env` file should have the MySQL credentials for testing:

```bash
NODE_ENV=development  # Keep this for local SQLite development
# MySQL credentials (for migration testing)
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=your-password
DB_NAME=abnehmen_app
```

## Migration Scripts

### Available Commands

```bash
# Export SQLite data only
npm run db:export

# Import to MySQL only (requires exported data)
npm run db:import

# Full migration (export + import)
npm run db:migrate
```

### Interactive Migration Utility

For step-by-step guidance:

```bash
npm run db:migrate
```

This will show a menu with options:
1. Full migration (Export SQLite → Import to MySQL)
2. Export SQLite data only
3. Import to MySQL only
4. Check environment
5. Exit

## Migration Process

### Step 1: Export SQLite Data

```bash
npm run db:export
```

This will:
- Read all data from your SQLite database
- Generate MySQL-compatible INSERT statements
- Save files to `migrations/data/` directory:
  - `sqlite_export.sql` - Combined SQL file
  - `export_summary.json` - Export statistics
  - Individual table files (e.g., `users.sql`, `leads.sql`)

### Step 2: Import to MySQL

```bash
npm run db:import
```

This will:
- Connect to your MySQL database
- Create tables if they don't exist
- Clear existing data (with confirmation)
- Import the exported data
- Verify the import was successful

### Step 3: Deploy

After successful migration:
1. Commit your changes (but not the database files)
2. Deploy to Railway
3. Your production app will use MySQL automatically

## Command Line Usage

For automation or CI/CD:

```bash
# Export only
node scripts/export-sqlite-data.js

# Import only
node scripts/import-to-mysql.js

# Full migration with commands
node scripts/migrate-sqlite-to-mysql.js migrate
node scripts/migrate-sqlite-to-mysql.js export
node scripts/migrate-sqlite-to-mysql.js import
node scripts/migrate-sqlite-to-mysql.js check
```

## Important Notes

### Data Safety
- **Backup your MySQL database** before running imports
- The import process **clears existing MySQL data**
- SQLite data remains unchanged during export

### Development Workflow
1. **Local development**: Work with SQLite as usual
2. **Before deployment**: Run migration to sync MySQL
3. **Production**: Runs on MySQL automatically

### Schema Sync
- Tables are created automatically during import
- Schema differences between SQLite and MySQL are handled
- Foreign key constraints are properly managed

## Troubleshooting

### Common Issues

1. **Connection failed**
   - Check MySQL credentials in environment variables
   - Verify database server is running and accessible

2. **Export shows 0 records**
   - Normal if you haven't added data yet
   - Check SQLite database path: `backend/src/database/abnehmen_app.db`

3. **Import fails with table errors**
   - Ensure MySQL user has CREATE/DROP privileges
   - Check that database exists

4. **Foreign key constraint errors**
   - Scripts handle this automatically with `SET FOREIGN_KEY_CHECKS = 0`
   - Tables are imported in dependency order

### Logs and Debugging

Check these files for details:
- `migrations/data/export_summary.json` - Export statistics
- `migrations/data/import_summary.json` - Import results
- Console output during migration

## File Structure

```
backend/
├── scripts/
│   ├── export-sqlite-data.js      # SQLite export script
│   ├── import-to-mysql.js         # MySQL import script
│   └── migrate-sqlite-to-mysql.js # Combined migration utility
├── migrations/
│   └── data/                      # Generated migration files
│       ├── sqlite_export.sql      # Combined SQL export
│       ├── export_summary.json    # Export statistics
│       ├── import_summary.json    # Import results
│       └── [table].sql           # Individual table exports
└── src/database/
    ├── connection.js              # SQLite connection (development)
    ├── mysql-connection.js        # MySQL connection (production)
    └── abnehmen_app.db           # SQLite database file
```

## Best Practices

1. **Test the migration** with a copy of your production MySQL database first
2. **Run migrations during low-traffic periods**
3. **Keep export files** for backup purposes
4. **Verify data integrity** after migration using the built-in verification
5. **Document any custom data transformations** needed for your specific use case