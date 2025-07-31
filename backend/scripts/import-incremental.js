#!/usr/bin/env node

const mysql = require('mysql2/promise');
const fs = require('fs').promises;
const path = require('path');
require('dotenv').config();

// Import configuration
const IMPORT_DIR = path.join(__dirname, '../migrations/data');
const SQL_FILE = path.join(IMPORT_DIR, 'incremental_export.sql');

class IncrementalImporter {
  constructor(options = {}) {
    this.connection = null;
    this.options = {
      dryRun: options.dryRun || false,
      preview: options.preview || false,
      rollback: options.rollback || false
    };
    this.dbConfig = {
      host: process.env.DB_HOST || 'localhost',
      port: process.env.DB_PORT || 3306,
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME || 'abnehmen_app',
      ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
      timezone: 'Z',
      multipleStatements: true
    };
    this.importStats = {
      startTime: new Date(),
      sessionId: null,
      recordsProcessed: 0,
      recordsInserted: 0,
      recordsUpdated: 0,
      tablesAffected: [],
      errors: []
    };
  }

  async connect() {
    try {
      console.log('🔌 Connecting to MySQL database...');
      console.log(`   Host: ${this.dbConfig.host}:${this.dbConfig.port}`);
      console.log(`   Database: ${this.dbConfig.database}`);
      
      this.connection = await mysql.createConnection(this.dbConfig);
      
      console.log('✅ MySQL database connected successfully');
      return true;
    } catch (error) {
      console.error('❌ MySQL connection failed:', error.message);
      throw error;
    }
  }

  async testConnection() {
    try {
      const [rows] = await this.connection.execute('SELECT VERSION() as version, NOW() as current_time');
      console.log(`🗄️  MySQL Version: ${rows[0].version}`);
      console.log(`⏰ Server Time: ${rows[0].current_time}`);
      return true;
    } catch (error) {
      console.error('❌ Connection test failed:', error.message);
      return false;
    }
  }

  async ensureSyncTables() {
    try {
      console.log('🔍 Ensuring sync tracking tables exist...');
      
      // Check if sync tables exist
      const [tables] = await this.connection.execute(`
        SELECT TABLE_NAME 
        FROM INFORMATION_SCHEMA.TABLES 
        WHERE TABLE_SCHEMA = ? AND TABLE_NAME IN ('sync_tracking', 'sync_checkpoints')
        ORDER BY TABLE_NAME
      `, [this.dbConfig.database]);

      const existingTables = tables.map(row => row.TABLE_NAME);
      const hasTracking = existingTables.includes('sync_tracking');
      const hasCheckpoints = existingTables.includes('sync_checkpoints');

      if (!hasTracking || !hasCheckpoints) {
        console.log('📋 Creating missing sync tracking tables...');
        const { createMySQLSyncTables } = require('../src/database/migrations/add_sync_tracking');
        await createMySQLSyncTables(this.connection);
      } else {
        console.log('✅ Sync tracking tables already exist');
      }

      return { hasTracking, hasCheckpoints };
    } catch (error) {
      console.error('❌ Error ensuring sync tables:', error.message);
      throw error;
    }
  }

  async createImportSession() {
    try {
      const insertSQL = `
        INSERT INTO sync_tracking (
          sync_type, direction, started_at, status, sync_metadata
        ) VALUES (?, ?, ?, ?, ?)
      `;
      
      const metadata = JSON.stringify({
        options: this.options,
        importFile: 'incremental_export.sql'
      });

      const [result] = await this.connection.execute(
        insertSQL,
        ['incremental', 'sqlite_to_mysql', new Date(), 'in_progress', metadata]
      );

      this.importStats.sessionId = result.insertId;
      console.log(`📝 Created import session: ${this.importStats.sessionId}`);
      
      return this.importStats.sessionId;
    } catch (error) {
      console.error('❌ Error creating import session:', error.message);
      throw error;
    }
  }

  async updateImportSession(status, errorMessage = null) {
    if (!this.importStats.sessionId) return;

    try {
      const updateSQL = `
        UPDATE sync_tracking 
        SET status = ?, completed_at = ?, records_imported = ?, 
            tables_affected = ?, error_message = ?
        WHERE id = ?
      `;
      
      const tablesAffected = JSON.stringify(this.importStats.tablesAffected);
      
      await this.connection.execute(updateSQL, [
        status,
        new Date(),
        this.importStats.recordsProcessed,
        tablesAffected,
        errorMessage,
        this.importStats.sessionId
      ]);

      console.log(`📝 Updated session ${this.importStats.sessionId} status: ${status}`);
    } catch (error) {
      console.error('❌ Error updating import session:', error.message);
    }
  }

  async updateCheckpoints(tableStats) {
    try {
      console.log('📋 Updating sync checkpoints...');
      
      for (const [tableName, stats] of Object.entries(tableStats)) {
        if (stats.recordCount > 0) {
          const upsertSQL = `
            INSERT INTO sync_checkpoints (table_name, last_sync_at, records_count)
            VALUES (?, ?, ?)
            ON DUPLICATE KEY UPDATE 
              last_sync_at = VALUES(last_sync_at),
              records_count = records_count + VALUES(records_count),
              updated_at = CURRENT_TIMESTAMP
          `;
          
          await this.connection.execute(upsertSQL, [
            tableName,
            stats.newLastSyncAt || new Date(),
            stats.recordCount
          ]);
          
          console.log(`   → Updated checkpoint for ${tableName}: +${stats.recordCount} records`);
        }
      }
      
      console.log('✅ Checkpoints updated successfully');
    } catch (error) {
      console.error('❌ Error updating checkpoints:', error.message);
      throw error;
    }
  }

  async previewImport() {
    try {
      console.log('🔍 Reading import file for preview...');
      
      // Check if SQL file exists
      try {
        await fs.access(SQL_FILE);
      } catch (error) {
        throw new Error(`Import file not found: ${SQL_FILE}`);
      }

      const sqlContent = await fs.readFile(SQL_FILE, 'utf8');
      
      if (!sqlContent.trim()) {
        console.log('ℹ️  Import file is empty - no changes to apply');
        return;
      }

      // Parse SQL content to count operations
      const insertStatements = sqlContent.match(/INSERT INTO \w+/gi) || [];
      const tableNames = [...new Set(
        insertStatements.map(stmt => {
          const match = stmt.match(/INSERT INTO (\w+)/i);
          return match ? match[1] : null;
        }).filter(Boolean)
      )];

      console.log('\n📋 IMPORT PREVIEW:');
      console.log('='.repeat(50));
      console.log(`📄 Import file: ${path.basename(SQL_FILE)}`);
      console.log(`📊 Total statements: ${insertStatements.length}`);
      console.log(`📋 Tables affected: ${tableNames.length}`);
      
      if (tableNames.length > 0) {
        console.log('\n📊 Operations by table:');
        for (const tableName of tableNames) {
          const tableStatements = insertStatements.filter(stmt => 
            stmt.toLowerCase().includes(tableName.toLowerCase())
          );
          console.log(`   • ${tableName}: ${tableStatements.length} UPSERT operations`);
        }
      }

      console.log('\n' + '='.repeat(50));
      console.log('ℹ️  Use --dry-run to execute without making changes');
      console.log('ℹ️  Use normal import to apply these changes');

    } catch (error) {
      console.error('❌ Preview failed:', error.message);
      throw error;
    }
  }

  async importSQLFile() {
    try {
      console.log('📤 Reading incremental import file...');
      
      // Check if SQL file exists
      try {
        await fs.access(SQL_FILE);
      } catch (error) {
        throw new Error(`Import file not found: ${SQL_FILE}. Please run incremental export first.`);
      }

      const sqlContent = await fs.readFile(SQL_FILE, 'utf8');
      
      if (!sqlContent.trim()) {
        console.log('ℹ️  Import file is empty - no changes to apply');
        return { executed: 0, inserted: 0, updated: 0 };
      }

      console.log(`📄 SQL file size: ${(sqlContent.length / 1024).toFixed(2)} KB`);

      // Read summary file for table statistics
      let tableStats = {};
      try {
        const summaryPath = path.join(IMPORT_DIR, 'incremental_export_summary.json');
        const summaryContent = await fs.readFile(summaryPath, 'utf8');
        const summary = JSON.parse(summaryContent);
        tableStats = summary.tableStats || {};
        console.log(`📊 Found export summary with ${Object.keys(tableStats).length} tables`);
      } catch (error) {
        console.log('⚠️  Could not read export summary, proceeding without detailed stats');
      }

      if (this.options.dryRun) {
        console.log('\n🏃‍♂️ DRY RUN MODE - No changes will be made');
      }

      // Start transaction for safety
      await this.connection.execute('START TRANSACTION');
      console.log('🔄 Started database transaction');

      try {
        // Split SQL content into individual statements
        const statements = sqlContent
          .split(';')
          .map(stmt => stmt.trim())
          .filter(stmt => stmt && !stmt.startsWith('--') && !stmt.match(/^(SET|START|COMMIT)/i));

        console.log(`📝 Found ${statements.length} SQL statements to execute`);

        let executedCount = 0;
        let insertedCount = 0;
        let updatedCount = 0;
        const processedTables = new Set();

        for (const statement of statements) {
          if (!statement) continue;

          try {
            // Extract table name from INSERT statement
            const tableMatch = statement.match(/INSERT INTO (\w+)/i);
            if (tableMatch) {
              processedTables.add(tableMatch[1]);
            }

            if (!this.options.dryRun) {
              const [result] = await this.connection.execute(statement);
              
              // MySQL returns affectedRows for INSERT...ON DUPLICATE KEY UPDATE
              // If affectedRows = 1, it was an INSERT
              // If affectedRows = 2, it was an UPDATE
              const affected = result.affectedRows || 0;
              if (affected === 1) {
                insertedCount++;
              } else if (affected === 2) {
                updatedCount++;
              }
            }
            
            executedCount++;
            
            // Show progress for large imports
            if (executedCount % 100 === 0) {
              console.log(`   → Processed ${executedCount}/${statements.length} statements...`);
            }
            
          } catch (error) {
            console.error(`❌ Error executing statement: ${statement.substring(0, 100)}...`);
            console.error(`   Error: ${error.message}`);
            this.importStats.errors.push({
              statement: statement.substring(0, 200),
              error: error.message
            });
            
            // For incremental imports, we might want to continue on errors
            // rather than failing the entire import
            if (error.code !== 'ER_DUP_ENTRY') {
              throw error;
            }
          }
        }

        this.importStats.recordsProcessed = executedCount;
        this.importStats.recordsInserted = insertedCount;
        this.importStats.recordsUpdated = updatedCount;
        this.importStats.tablesAffected = Array.from(processedTables);

        if (this.options.dryRun) {
          console.log('\n🏃‍♂️ DRY RUN COMPLETE - Rolling back transaction');
          await this.connection.execute('ROLLBACK');
        } else {
          console.log('\n💾 Committing transaction...');
          await this.connection.execute('COMMIT');
          
          // Update sync checkpoints
          if (Object.keys(tableStats).length > 0) {
            await this.updateCheckpoints(tableStats);
          }
        }

        console.log(`✅ Import completed successfully`);
        console.log(`   → Executed ${executedCount} statements`);
        console.log(`   → Inserted ${insertedCount} new records`);
        console.log(`   → Updated ${updatedCount} existing records`);
        console.log(`   → Tables affected: ${this.importStats.tablesAffected.join(', ')}`);

        if (this.importStats.errors.length > 0) {
          console.log(`⚠️  ${this.importStats.errors.length} errors encountered (mostly duplicates)`);
        }

        return { 
          executed: executedCount, 
          inserted: insertedCount, 
          updated: updatedCount,
          tables: this.importStats.tablesAffected
        };

      } catch (error) {
        console.error('❌ Import failed, rolling back transaction...');
        await this.connection.execute('ROLLBACK');
        throw error;
      }

    } catch (error) {
      console.error('❌ Error importing SQL file:', error.message);
      throw error;
    }
  }

  async verifyImport() {
    console.log('🔍 Verifying import...');
    
    const tables = this.importStats.tablesAffected.length > 0 
      ? this.importStats.tablesAffected 
      : [
          'users', 'studios', 'activation_codes', 'manager_codes',
          'appointments', 'leads', 'lead_call_logs', 
          'google_sheets_integrations', 'dialogflow_conversations'
        ];

    const verification = {};
    let totalRecords = 0;

    for (const table of tables) {
      try {
        const [rows] = await this.connection.execute(`SELECT COUNT(*) as count FROM ${table}`);
        const count = rows[0].count;
        verification[table] = count;
        totalRecords += count;
        console.log(`   → ${table}: ${count} records`);
      } catch (error) {
        console.log(`   → ${table}: error (${error.message})`);
        verification[table] = 'ERROR';
      }
    }

    console.log(`📊 Total records in database: ${totalRecords}`);
    
    return verification;
  }

  async rollbackLastImport() {
    try {
      console.log('🔄 Rolling back last import...');
      
      // Find the last completed import session
      const [sessions] = await this.connection.execute(`
        SELECT id, started_at, records_imported, tables_affected 
        FROM sync_tracking 
        WHERE direction = 'sqlite_to_mysql' AND status = 'completed'
        ORDER BY started_at DESC 
        LIMIT 1
      `);

      if (sessions.length === 0) {
        console.log('ℹ️  No completed import sessions found to rollback');
        return false;
      }

      const lastSession = sessions[0];
      console.log(`📝 Found last import session: ${lastSession.id} (${lastSession.started_at})`);
      console.log(`   → Records imported: ${lastSession.records_imported}`);
      
      const tablesAffected = JSON.parse(lastSession.tables_affected || '[]');
      console.log(`   → Tables affected: ${tablesAffected.join(', ')}`);

      // This is a simplified rollback - in a production system you'd want more sophisticated tracking
      console.log('⚠️  Rollback is not fully implemented in this version');
      console.log('   Consider restoring from a backup or manually reviewing changes');
      
      // Mark the session as rolled back
      await this.connection.execute(
        'UPDATE sync_tracking SET status = ? WHERE id = ?',
        ['rolled_back', lastSession.id]
      );

      return true;
    } catch (error) {
      console.error('❌ Rollback failed:', error.message);
      throw error;
    }
  }

  async close() {
    if (this.connection) {
      try {
        await this.connection.end();
        console.log('🔌 MySQL connection closed');
      } catch (error) {
        console.error('Error closing connection:', error.message);
      }
    }
  }
}

// Main execution function
async function main() {
  const args = process.argv.slice(2);
  const options = {
    dryRun: args.includes('--dry-run') || args.includes('-d'),
    preview: args.includes('--preview') || args.includes('-p'), 
    rollback: args.includes('--rollback') || args.includes('-r')
  };

  if (args.includes('--help') || args.includes('-h')) {
    console.log(`
Incremental MySQL Import Tool

Usage: node import-incremental.js [options]

Options:
  --preview, -p     Show what would be imported without making changes
  --dry-run, -d     Execute import in transaction but rollback (test run)
  --rollback, -r    Rollback the last completed import
  --help, -h        Show this help message

Examples:
  node import-incremental.js --preview
  node import-incremental.js --dry-run
  node import-incremental.js --rollback
`);
    return;
  }

  const importer = new IncrementalImporter(options);
  
  try {
    // Connect to MySQL
    await importer.connect();
    await importer.testConnection();
    
    // Ensure sync tracking tables exist
    await importer.ensureSyncTables();
    
    if (options.rollback) {
      await importer.rollbackLastImport();
      return;
    }
    
    if (options.preview) {
      await importer.previewImport();
      return;
    }
    
    // Create import session
    await importer.createImportSession();
    
    try {
      // Import the SQL file
      const importResult = await importer.importSQLFile();
      
      // Verify the import
      const verification = await importer.verifyImport();
      
      // Update import session
      await importer.updateImportSession('completed');
      
      // Save import summary
      const importSummary = {
        importDate: new Date().toISOString(),
        sessionId: importer.importStats.sessionId,
        database: importer.dbConfig.database,
        host: importer.dbConfig.host,
        importResult,
        verification,
        stats: importer.importStats,
        status: options.dryRun ? 'dry_run' : 'completed'
      };
      
      const summaryPath = path.join(IMPORT_DIR, 'incremental_import_summary.json');
      await fs.writeFile(summaryPath, JSON.stringify(importSummary, null, 2), 'utf8');
      
      console.log('\n🎉 Incremental import completed successfully!');
      console.log(`📊 Import summary saved to: ${summaryPath}`);
      
      if (options.dryRun) {
        console.log('ℹ️  This was a dry run - no actual changes were made');
      }
      
    } catch (error) {
      await importer.updateImportSession('failed', error.message);
      throw error;
    }
    
  } catch (error) {
    console.error('\n❌ Import failed:', error.message);
    process.exit(1);
  } finally {
    await importer.close();
  }
}

// Run if called directly
if (require.main === module) {
  main();
}

module.exports = IncrementalImporter;