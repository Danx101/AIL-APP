#!/usr/bin/env node

const IncrementalExporter = require('./export-incremental');
const IncrementalImporter = require('./import-incremental');
const SQLiteExporter = require('./export-sqlite-data');
const MySQLImporter = require('./import-to-mysql');
const readline = require('readline');
const fs = require('fs').promises;
const path = require('path');

class DatabaseSyncer {
  constructor() {
    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });
  }

  async promptUser(question) {
    return new Promise((resolve) => {
      this.rl.question(question, (answer) => {
        resolve(answer.toLowerCase().trim());
      });
    });
  }

  async checkEnvironment() {
    console.log('🔍 Checking environment configuration...\n');
    
    const requiredEnvVars = ['DB_HOST', 'DB_USER', 'DB_PASSWORD', 'DB_NAME'];
    const missingVars = [];
    
    for (const varName of requiredEnvVars) {
      if (!process.env[varName]) {
        missingVars.push(varName);
      } else {
        console.log(`✅ ${varName}: ${varName === 'DB_PASSWORD' ? '[HIDDEN]' : process.env[varName]}`);
      }
    }
    
    if (missingVars.length > 0) {
      console.error(`\n❌ Missing required environment variables: ${missingVars.join(', ')}`);
      console.error('Please set these variables in your .env file or environment.');
      return false;
    }
    
    console.log('✅ All required environment variables are set\n');
    return true;
  }

  async checkSQLiteDatabase() {
    const dbPath = path.join(__dirname, '../database.sqlite');
    
    try {
      const stats = await fs.stat(dbPath);
      console.log(`✅ SQLite database found: ${dbPath}`);
      console.log(`   Size: ${(stats.size / 1024).toFixed(2)} KB`);
      
      // Check if database has sync tracking tables
      const sqlite3 = require('sqlite3').verbose();
      return new Promise((resolve, reject) => {
        const db = new sqlite3.Database(dbPath, (err) => {
          if (err) {
            reject(err);
            return;
          }
          
          db.get("SELECT name FROM sqlite_master WHERE type='table' AND name='sync_tracking'", (err, row) => {
            db.close();
            if (err) {
              reject(err);
            } else {
              const hasTracking = !!row;
              console.log(`📋 Sync tracking: ${hasTracking ? '✅ Enabled' : '⚠️  Not set up'}`);
              resolve(hasTracking);
            }
          });
        });
      });
    } catch (error) {
      console.error(`❌ SQLite database not found: ${dbPath}`);
      return false;
    }
  }

  async runIncrementalSync() {
    console.log('🔄 Starting incremental database sync...\n');
    
    // Step 1: Check prerequisites
    console.log('='.repeat(60));
    console.log('STEP 1: Checking Prerequisites');
    console.log('='.repeat(60));
    
    const envOk = await this.checkEnvironment();
    if (!envOk) return false;
    
    const sqliteOk = await this.checkSQLiteDatabase();
    if (!sqliteOk) return false;
    
    // Step 2: Preview changes
    console.log('='.repeat(60));
    console.log('STEP 2: Analyzing Changes');
    console.log('='.repeat(60));
    
    const exporter = new IncrementalExporter({ preview: true });
    try {
      await exporter.initialize();
      await exporter.exportAllTables();
    } catch (error) {
      console.error('❌ Change analysis failed:', error.message);
      return false;
    } finally {
      await exporter.close();
    }
    
    // Ask user to proceed
    const proceed = await this.promptUser('\nProceed with sync? (yes/no): ');
    if (proceed !== 'yes' && proceed !== 'y') {
      console.log('❌ Sync cancelled by user');
      return false;
    }
    
    // Step 3: Export incremental changes
    console.log('\n' + '='.repeat(60));
    console.log('STEP 3: Exporting Changes');
    console.log('='.repeat(60));
    
    const realExporter = new IncrementalExporter();
    try {
      await realExporter.initialize();
      await realExporter.exportAllTables();
    } catch (error) {
      console.error('❌ Export failed:', error.message);
      return false;
    } finally {
      await realExporter.close();
    }
    
    // Step 4: Import to MySQL
    console.log('\n' + '='.repeat(60));
    console.log('STEP 4: Importing to MySQL');
    console.log('='.repeat(60));
    
    const importer = new IncrementalImporter();
    try {
      await importer.connect();
      await importer.testConnection();
      await importer.ensureSyncTables();
      
      await importer.importSQLFile();
      await importer.verifyImport();
      
    } catch (error) {
      console.error('❌ Import failed:', error.message);
      return false;
    } finally {
      await importer.close();
    }
    
    console.log('\n' + '='.repeat(60));
    console.log('✅ INCREMENTAL SYNC COMPLETED!');
    console.log('='.repeat(60));
    console.log('Your changes have been safely synced to MySQL.');
    console.log('Production data was preserved and only new/updated records were transferred.');
    
    return true;
  }

  async runFullMigration() {
    console.log('🚀 Starting full database migration...\n');
    console.log('⚠️  WARNING: This will replace ALL data in MySQL with SQLite data!');
    console.log('   Use incremental sync instead if you want to preserve production data.');
    
    const confirm = await this.promptUser('\nContinue with FULL migration? (yes/no): ');
    if (confirm !== 'yes' && confirm !== 'y') {
      console.log('❌ Migration cancelled');
      return false;
    }
    
    // Use the original migration scripts
    const SQLiteExporter = require('./export-sqlite-data');
    const MySQLImporter = require('./import-to-mysql');
    
    console.log('\n' + '='.repeat(60));
    console.log('STEP 1: Full SQLite Export');
    console.log('='.repeat(60));
    
    const exporter = new SQLiteExporter();
    try {
      await exporter.initialize();
      await exporter.exportAllTables();
    } catch (error) {
      console.error('❌ Export failed:', error.message);
      return false;
    } finally {
      await exporter.close();
    }
    
    console.log('\n' + '='.repeat(60));
    console.log('STEP 2: MySQL Import (DESTRUCTIVE)');
    console.log('='.repeat(60));
    
    const importer = new MySQLImporter();
    try {
      await importer.connect();
      await importer.testConnection();
      
      const existingTables = await importer.checkIfTablesExist();
      
      if (existingTables.length === 0) {
        await importer.initializeTables();
        await importer.close();
        await importer.connect();
      }
      
      await importer.clearExistingData();
      await importer.importSQLFile();
      await importer.verifyImport();
      
    } catch (error) {
      console.error('❌ Import failed:', error.message);
      return false;
    } finally {
      await importer.close();
    }
    
    console.log('\n' + '='.repeat(60));
    console.log('✅ FULL MIGRATION COMPLETED!');
    console.log('='.repeat(60));
    
    return true;
  }

  async previewChanges() {
    console.log('👀 Previewing database changes...\n');
    
    const sqliteOk = await this.checkSQLiteDatabase();
    if (!sqliteOk) return false;
    
    const exporter = new IncrementalExporter({ preview: true });
    try {
      await exporter.initialize();
      await exporter.exportAllTables();
      return true;
    } catch (error) {
      console.error('❌ Preview failed:', error.message);
      return false;
    } finally {
      await exporter.close();
    }
  }

  async testImport() {
    console.log('🧪 Testing import (dry run)...\n');
    
    const envOk = await this.checkEnvironment();
    if (!envOk) return false;
    
    const importer = new IncrementalImporter({ dryRun: true });
    try {
      await importer.connect();
      await importer.testConnection();
      await importer.ensureSyncTables();
      await importer.importSQLFile();
      
      console.log('\n✅ Dry run completed successfully!');
      console.log('   All operations would succeed when run for real.');
      return true;
    } catch (error) {
      console.error('❌ Dry run failed:', error.message);
      return false;
    } finally {
      await importer.close();
    }
  }

  async rollbackLastSync() {
    console.log('↩️  Rolling back last sync...\n');
    
    const envOk = await this.checkEnvironment();
    if (!envOk) return false;
    
    const importer = new IncrementalImporter({ rollback: true });
    try {
      await importer.connect();
      await importer.rollbackLastImport();
      return true;
    } catch (error) {
      console.error('❌ Rollback failed:', error.message);
      return false;
    } finally {
      await importer.close();
    }
  }

  async showSyncStatus() {
    console.log('📊 Database Sync Status\n');
    
    const sqliteOk = await this.checkSQLiteDatabase();
    const envOk = await this.checkEnvironment();
    
    if (!sqliteOk || !envOk) {
      console.log('❌ Cannot check sync status due to configuration issues');
      return false;
    }
    
    // Check MySQL sync history
    try {
      const mysql = require('mysql2/promise');
      const connection = await mysql.createConnection({
        host: process.env.DB_HOST,
        port: process.env.DB_PORT || 3306,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME,
        ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
      });
      
      try {
        const [sessions] = await connection.execute(`
          SELECT sync_type, direction, started_at, completed_at, status, records_imported
          FROM sync_tracking 
          WHERE direction = 'sqlite_to_mysql'
          ORDER BY started_at DESC 
          LIMIT 5
        `);
        
        if (sessions.length > 0) {
          console.log('📈 Recent Sync History:');
          console.log('-'.repeat(80));
          sessions.forEach((session, i) => {
            const duration = session.completed_at 
              ? Math.round((new Date(session.completed_at) - new Date(session.started_at)) / 1000)
              : 'N/A';
            console.log(`${i+1}. ${session.started_at} | ${session.sync_type} | ${session.status} | ${session.records_imported || 0} records | ${duration}s`);
          });
        } else {
          console.log('📋 No sync history found - this appears to be a fresh setup');
        }
        
        // Check checkpoints
        const [checkpoints] = await connection.execute(`
          SELECT table_name, last_sync_at, records_count 
          FROM sync_checkpoints 
          ORDER BY table_name
        `);
        
        if (checkpoints.length > 0) {
          console.log('\n📋 Sync Checkpoints:');
          console.log('-'.repeat(50));
          checkpoints.forEach(cp => {
            console.log(`${cp.table_name}: ${cp.records_count} records (last: ${cp.last_sync_at})`);
          });
        }
        
      } finally {
        await connection.end();
      }
      
      return true;
    } catch (error) {
      console.error('❌ Error checking sync status:', error.message);
      return false;
    }
  }

  async showMenu() {
    console.log('\n🔄 Database Sync Utility');
    console.log('='.repeat(50));
    console.log('1. 🔄 Incremental sync (recommended)');
    console.log('2. 👀 Preview changes');
    console.log('3. 🧪 Test import (dry run)');
    console.log('4. 📊 Show sync status');
    console.log('5. ↩️  Rollback last sync');
    console.log('6. 🚀 Full migration (destructive)');
    console.log('7. 🔧 Check configuration');
    console.log('8. Exit');
    console.log('='.repeat(50));
    
    const choice = await this.promptUser('Choose an option (1-8): ');
    
    switch (choice) {
      case '1':
        await this.runIncrementalSync();
        break;
      case '2':
        await this.previewChanges();
        break;
      case '3':
        await this.testImport();
        break;
      case '4':
        await this.showSyncStatus();
        break;
      case '5':
        await this.rollbackLastSync();
        break;
      case '6':
        await this.runFullMigration();
        break;
      case '7':
        await this.checkEnvironment();
        await this.checkSQLiteDatabase();
        break;
      case '8':
        console.log('👋 Goodbye!');
        return false;
      default:
        console.log('❌ Invalid choice. Please try again.');
        break;
    }
    
    return true;
  }

  async close() {
    this.rl.close();
  }
}

// Main execution
async function main() {
  const syncer = new DatabaseSyncer();
  
  try {
    const args = process.argv.slice(2);
    
    if (args.length > 0) {
      const command = args[0].toLowerCase();
      
      switch (command) {
        case 'sync':
        case 'incremental':
          await syncer.runIncrementalSync();
          break;
        case 'preview':
          await syncer.previewChanges();
          break;
        case 'test':
        case 'dry-run':
          await syncer.testImport();
          break;
        case 'status':
          await syncer.showSyncStatus();
          break;
        case 'rollback':
          await syncer.rollbackLastSync();
          break;
        case 'migrate':
        case 'full':
          await syncer.runFullMigration();
          break;
        case 'check':
          await syncer.checkEnvironment();
          await syncer.checkSQLiteDatabase();
          break;
        default:
          console.log(`❌ Unknown command: ${command}`);
          console.log('Available commands: sync, preview, test, status, rollback, migrate, check');
          process.exit(1);
      }
    } else {
      // Interactive mode
      let continueRunning = true;
      while (continueRunning) {
        continueRunning = await syncer.showMenu();
        if (continueRunning) {
          const restart = await syncer.promptUser('\nRun another operation? (yes/no): ');
          continueRunning = restart === 'yes' || restart === 'y';
        }
      }
    }
    
  } catch (error) {
    console.error('❌ Sync utility error:', error.message);
    process.exit(1);
  } finally {
    await syncer.close();
  }
}

// Run if called directly
if (require.main === module) {
  main();
}

module.exports = DatabaseSyncer;