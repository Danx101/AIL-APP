#!/usr/bin/env node

const sqlite3 = require('sqlite3').verbose();
const fs = require('fs').promises;
const path = require('path');

// Path to SQLite database
const DB_PATH = path.join(__dirname, '../database.sqlite');
const OUTPUT_DIR = path.join(__dirname, '../migrations/data');

// Tables to sync (in dependency order)
const SYNC_TABLES = [
  'users',
  'studios', 
  'activation_codes',
  'manager_codes',
  'appointments',
  'leads',
  'lead_call_logs',
  'google_sheets_integrations',
  'dialogflow_conversations'
];

class IncrementalExporter {
  constructor(options = {}) {
    this.db = null;
    this.options = {
      force: options.force || false,
      preview: options.preview || false,
      since: options.since || null
    };
    this.exportStats = {
      totalRecords: 0,
      tableStats: {},
      exportType: 'incremental',
      startTime: new Date()
    };
  }

  async initialize() {
    return new Promise((resolve, reject) => {
      this.db = new sqlite3.Database(DB_PATH, (err) => {
        if (err) {
          reject(new Error(`Failed to open SQLite database: ${err.message}`));
        } else {
          console.log('✅ Connected to SQLite database');
          resolve();
        }
      });
    });
  }

  async checkSyncTables() {
    return new Promise((resolve, reject) => {
      const checkSQL = `
        SELECT name FROM sqlite_master 
        WHERE type='table' AND name IN ('sync_tracking', 'sync_checkpoints')
      `;
      
      this.db.all(checkSQL, [], (err, rows) => {
        if (err) {
          reject(err);
        } else {
          const tables = rows.map(row => row.name);
          const hasTracking = tables.includes('sync_tracking');
          const hasCheckpoints = tables.includes('sync_checkpoints');
          
          if (!hasTracking || !hasCheckpoints) {
            console.log('⚠️  Sync tracking tables not found. This appears to be a first-time setup.');
            console.log('   Creating initial sync checkpoints...');
          }
          
          resolve({ hasTracking, hasCheckpoints });
        }
      });
    });
  }

  async getLastSyncInfo(tableName) {
    return new Promise((resolve, reject) => {
      const query = `
        SELECT last_sync_at, last_record_id, records_count 
        FROM sync_checkpoints 
        WHERE table_name = ?
      `;
      
      this.db.get(query, [tableName], (err, row) => {
        if (err) {
          reject(err);
        } else if (!row) {
          // No checkpoint exists, this is first sync
          resolve({
            lastSyncAt: '1970-01-01 00:00:00',
            lastRecordId: 0,
            recordsCount: 0
          });
        } else {
          resolve({
            lastSyncAt: row.last_sync_at,
            lastRecordId: row.last_record_id,
            recordsCount: row.records_count
          });
        }
      });
    });
  }

  async getTableSchema(tableName) {
    return new Promise((resolve, reject) => {
      const query = `PRAGMA table_info(${tableName})`;
      this.db.all(query, [], (err, rows) => {
        if (err) {
          reject(err);
        } else {
          resolve(rows);
        }
      });
    });
  }

  async getIncrementalData(tableName, lastSyncAt, lastRecordId) {
    return new Promise((resolve, reject) => {
      // First check if table exists and has the required columns
      this.getTableSchema(tableName).then(schema => {
        const columns = schema.map(col => col.name);
        const hasCreatedAt = columns.includes('created_at');
        const hasUpdatedAt = columns.includes('updated_at');
        const hasId = columns.includes('id');

        let whereConditions = [];
        let params = [];

        if (this.options.since) {
          // Use custom since timestamp
          if (hasCreatedAt) {
            whereConditions.push('(created_at > ? OR updated_at > ?)');
            params.push(this.options.since, this.options.since);
          }
        } else {
          // Use last sync timestamp
          if (hasCreatedAt && hasUpdatedAt) {
            // Records created or updated since last sync
            whereConditions.push('(created_at > ? OR updated_at > ?)');
            params.push(lastSyncAt, lastSyncAt);
          } else if (hasCreatedAt) {
            // Only created_at available
            whereConditions.push('created_at > ?');
            params.push(lastSyncAt);
          } else if (hasId && lastRecordId > 0) {
            // Fall back to ID-based incremental (less reliable but better than nothing)
            whereConditions.push('id > ?');
            params.push(lastRecordId);
          }
        }

        // If this is a forced full export or no incremental method available
        if (this.options.force || whereConditions.length === 0) {
          console.log(`📦 Full export for table ${tableName} (no timestamp columns or forced)`);
          whereConditions = [];
          params = [];
        }

        const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';
        const query = `SELECT * FROM ${tableName} ${whereClause} ORDER BY ${hasId ? 'id' : 'rowid'}`;

        this.db.all(query, params, (err, rows) => {
          if (err) {
            reject(err);
          } else {
            resolve(rows);
          }
        });
      }).catch(reject);
    });
  }

  escapeValue(value, type) {
    if (value === null || value === undefined) {
      return 'NULL';
    }
    
    if (type === 'TEXT' || type === 'VARCHAR' || type === 'DATETIME' || type === 'TIMESTAMP') {
      return `'${String(value).replace(/'/g, "''")}'`;
    }
    
    if (type === 'BOOLEAN') {
      return value ? 'TRUE' : 'FALSE';
    }
    
    return String(value);
  }

  generateUpsertStatements(tableName, data, schema) {
    if (!data || data.length === 0) {
      return '';
    }

    const columns = schema.map(col => col.name);
    const columnTypes = schema.reduce((acc, col) => {
      acc[col.name] = col.type;
      return acc;
    }, {});

    // Find primary key or unique columns for ON DUPLICATE KEY
    const primaryKey = schema.find(col => col.pk === 1);
    const uniqueKey = primaryKey ? primaryKey.name : 'id';

    let sql = `-- Incremental data for table: ${tableName}\n`;
    sql += `-- Records found: ${data.length}\n\n`;

    for (const row of data) {
      const columnList = columns.join(', ');
      const values = columns.map(col => this.escapeValue(row[col], columnTypes[col])).join(', ');
      
      // Generate UPDATE clause for ON DUPLICATE KEY
      const updateClauses = columns
        .filter(col => col !== uniqueKey) // Don't update the primary key
        .map(col => `${col} = VALUES(${col})`)
        .join(', ');

      sql += `INSERT INTO ${tableName} (${columnList}) VALUES (${values})`;
      
      if (updateClauses) {
        sql += `\nON DUPLICATE KEY UPDATE ${updateClauses}`;
      }
      
      sql += ';\n';
    }

    sql += '\n';
    return sql;
  }

  async exportTable(tableName) {
    try {
      // Check if table exists
      const schema = await this.getTableSchema(tableName);
      if (schema.length === 0) {
        console.log(`⚠️  Table '${tableName}' does not exist, skipping...`);
        return null;
      }

      // Get last sync info
      const syncInfo = await this.getLastSyncInfo(tableName);
      
      console.log(`📤 Analyzing table: ${tableName}`);
      console.log(`   Last sync: ${syncInfo.lastSyncAt}`);
      console.log(`   Previous record count: ${syncInfo.recordsCount}`);

      // Get incremental data
      const data = await this.getIncrementalData(
        tableName, 
        syncInfo.lastSyncAt, 
        syncInfo.lastRecordId
      );

      const recordCount = data.length;
      const isIncremental = !this.options.force && syncInfo.lastSyncAt !== '1970-01-01 00:00:00';
      
      console.log(`   → Found ${recordCount} ${isIncremental ? 'new/updated' : 'total'} records`);

      this.exportStats.tableStats[tableName] = {
        recordCount,
        isIncremental,
        lastSyncAt: syncInfo.lastSyncAt,
        newLastSyncAt: new Date().toISOString()
      };

      this.exportStats.totalRecords += recordCount;

      if (this.options.preview) {
        return {
          tableName,
          recordCount,
          isIncremental,
          preview: data.slice(0, 3).map(row => ({ 
            id: row.id, 
            created_at: row.created_at,
            updated_at: row.updated_at 
          }))
        };
      }

      const upsertSQL = this.generateUpsertStatements(tableName, data, schema);
      
      return {
        tableName,
        recordCount,
        isIncremental,
        sql: upsertSQL
      };

    } catch (error) {
      console.error(`❌ Error exporting table ${tableName}:`, error.message);
      return null;
    }
  }

  async createSyncSession() {
    return new Promise((resolve, reject) => {
      const insertSQL = `
        INSERT INTO sync_tracking (
          sync_type, direction, started_at, status, sync_metadata
        ) VALUES (?, ?, ?, ?, ?)
      `;
      
      const metadata = JSON.stringify({
        options: this.options,
        tables: SYNC_TABLES
      });

      this.db.run(
        insertSQL,
        ['incremental', 'sqlite_to_mysql', new Date().toISOString(), 'in_progress', metadata],
        function(err) {
          if (err) {
            reject(err);
          } else {
            resolve(this.lastID);
          }
        }
      );
    });
  }

  async updateSyncSession(sessionId, status, stats = {}) {
    return new Promise((resolve, reject) => {
      const updateSQL = `
        UPDATE sync_tracking 
        SET status = ?, completed_at = ?, records_exported = ?, tables_affected = ?
        WHERE id = ?
      `;
      
      const tablesAffected = JSON.stringify(Object.keys(stats));
      const totalRecords = Object.values(stats).reduce((sum, table) => sum + (table.recordCount || 0), 0);
      
      this.db.run(
        updateSQL,
        [status, new Date().toISOString(), totalRecords, tablesAffected, sessionId],
        (err) => {
          if (err) {
            reject(err);
          } else {
            resolve();
          }
        }
      );
    });
  }

  async exportAllTables() {
    console.log('🚀 Starting incremental SQLite export...\n');
    
    // Ensure output directory exists
    try {
      await fs.mkdir(OUTPUT_DIR, { recursive: true });
    } catch (error) {
      console.error('Failed to create output directory:', error.message);
      return;
    }

    // Check if sync tracking tables exist
    const trackingInfo = await this.checkSyncTables();
    
    let sessionId = null;
    if (trackingInfo.hasTracking) {
      sessionId = await this.createSyncSession();
      console.log(`📝 Created sync session: ${sessionId}\n`);
    }

    const exportResults = [];
    
    try {
      // Export each table
      for (const tableName of SYNC_TABLES) {
        const result = await this.exportTable(tableName);
        if (result) {
          exportResults.push(result);
        }
      }

      if (this.options.preview) {
        console.log('\n📋 EXPORT PREVIEW:');
        console.log('='.repeat(50));
        
        let totalChanges = 0;
        for (const result of exportResults) {
          if (result.recordCount > 0) {
            console.log(`\n📊 ${result.tableName}:`);
            console.log(`   • ${result.recordCount} ${result.isIncremental ? 'changed' : 'total'} records`);
            console.log(`   • Type: ${result.isIncremental ? 'Incremental' : 'Full export'}`);
            
            if (result.preview && result.preview.length > 0) {
              console.log('   • Sample records:');
              result.preview.forEach((record, i) => {
                console.log(`     ${i+1}. ID: ${record.id}, Created: ${record.created_at}, Updated: ${record.updated_at}`);
              });
            }
            totalChanges += result.recordCount;
          }
        }
        
        console.log('\n' + '='.repeat(50));
        console.log(`📦 Total records to sync: ${totalChanges}`);
        console.log(`🔄 Export type: ${this.options.force ? 'Full (forced)' : 'Incremental'}`);
        
        if (sessionId && trackingInfo.hasTracking) {
          await this.updateSyncSession(sessionId, 'completed', this.exportStats.tableStats);
        }
        
        return;
      }

      // Generate combined SQL file
      let combinedSQL = `-- Incremental SQLite to MySQL Export
-- Generated: ${new Date().toISOString()}
-- Export type: ${this.options.force ? 'Full (forced)' : 'Incremental'}
-- Tables: ${exportResults.length}
-- Total records: ${this.exportStats.totalRecords}

SET FOREIGN_KEY_CHECKS = 0;
SET sql_mode = 'NO_AUTO_VALUE_ON_ZERO';

`;

      // Add all UPSERT statements
      for (const result of exportResults) {
        if (result.sql) {
          combinedSQL += result.sql;
        }
      }

      combinedSQL += `
SET FOREIGN_KEY_CHECKS = 1;

-- Export completed successfully
-- Session ID: ${sessionId || 'N/A'}
`;

      // Write combined file
      const outputPath = path.join(OUTPUT_DIR, 'incremental_export.sql');
      await fs.writeFile(outputPath, combinedSQL, 'utf8');

      // Write individual table files
      for (const result of exportResults) {
        if (result.sql) {
          const tablePath = path.join(OUTPUT_DIR, `${result.tableName}_incremental.sql`);
          await fs.writeFile(tablePath, result.sql, 'utf8');
        }
      }

      // Generate export summary
      const summary = {
        exportDate: new Date().toISOString(),
        exportType: this.options.force ? 'full' : 'incremental',
        sessionId: sessionId,
        totalTables: exportResults.length,
        totalRecords: this.exportStats.totalRecords,
        options: this.options,
        tableStats: this.exportStats.tableStats,
        files: {
          combined: 'incremental_export.sql',
          individual: exportResults.map(r => `${r.tableName}_incremental.sql`)
        }
      };

      const summaryPath = path.join(OUTPUT_DIR, 'incremental_export_summary.json');
      await fs.writeFile(summaryPath, JSON.stringify(summary, null, 2), 'utf8');

      // Update sync session
      if (sessionId && trackingInfo.hasTracking) {
        await this.updateSyncSession(sessionId, 'completed', this.exportStats.tableStats);
      }

      console.log('\n✅ Incremental export completed successfully!');
      console.log(`📁 Output directory: ${OUTPUT_DIR}`);
      console.log(`📄 Combined SQL file: ${outputPath}`);
      console.log(`📊 Export summary: ${summaryPath}`);
      console.log(`📦 Total records exported: ${this.exportStats.totalRecords}`);
      
      if (this.exportStats.totalRecords === 0) {
        console.log('ℹ️  No changes found since last sync. Database is up to date.');
      }

    } catch (error) {
      console.error('❌ Export failed:', error.message);
      
      if (sessionId && trackingInfo.hasTracking) {
        try {
          await this.updateSyncSession(sessionId, 'failed');
        } catch (updateError) {
          console.error('Failed to update sync session:', updateError.message);
        }
      }
      
      throw error;
    }
  }

  async close() {
    if (this.db) {
      return new Promise((resolve) => {
        this.db.close((err) => {
          if (err) {
            console.error('Error closing database:', err.message);
          } else {
            console.log('🔌 Database connection closed');
          }
          resolve();
        });
      });
    }
  }
}

// Main execution
async function main() {
  const args = process.argv.slice(2);
  const options = {
    force: args.includes('--force') || args.includes('-f'),
    preview: args.includes('--preview') || args.includes('-p'),
    since: args.find(arg => arg.startsWith('--since='))?.split('=')[1]
  };

  if (args.includes('--help') || args.includes('-h')) {
    console.log(`
Incremental SQLite Export Tool

Usage: node export-incremental.js [options]

Options:
  --preview, -p     Show what would be exported without creating files
  --force, -f       Force full export instead of incremental
  --since=DATE      Export records since specific date (ISO format)
  --help, -h        Show this help message

Examples:
  node export-incremental.js --preview
  node export-incremental.js --force
  node export-incremental.js --since=2025-01-01T00:00:00Z
`);
    return;
  }

  const exporter = new IncrementalExporter(options);
  
  try {
    await exporter.initialize();
    await exporter.exportAllTables();
  } catch (error) {
    console.error('❌ Export failed:', error.message);
    process.exit(1);
  } finally {
    await exporter.close();
  }
}

// Run if called directly
if (require.main === module) {
  main();
}

module.exports = IncrementalExporter;