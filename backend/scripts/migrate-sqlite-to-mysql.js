#!/usr/bin/env node

const SQLiteExporter = require('./export-sqlite-data');
const MySQLImporter = require('./import-to-mysql');
const readline = require('readline');
const fs = require('fs').promises;
const path = require('path');

class DatabaseMigrator {
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
      return true;
    } catch (error) {
      console.error(`❌ SQLite database not found: ${dbPath}`);
      return false;
    }
  }

  async runFullMigration() {
    console.log('🚀 Starting full database migration from SQLite to MySQL\n');
    
    // Step 1: Check prerequisites
    console.log('='.repeat(60));
    console.log('STEP 1: Checking Prerequisites');
    console.log('='.repeat(60));
    
    const envOk = await this.checkEnvironment();
    if (!envOk) {
      return false;
    }
    
    const sqliteOk = await this.checkSQLiteDatabase();
    if (!sqliteOk) {
      return false;
    }
    
    // Step 2: Export SQLite data
    console.log('='.repeat(60));
    console.log('STEP 2: Exporting SQLite Data');
    console.log('='.repeat(60));
    
    const exporter = new SQLiteExporter();
    try {
      await exporter.initialize();
      await exporter.exportAllTables();
    } catch (error) {
      console.error('❌ SQLite export failed:', error.message);
      return false;
    } finally {
      await exporter.close();
    }
    
    // Step 3: Import to MySQL
    console.log('\n' + '='.repeat(60));
    console.log('STEP 3: Importing to MySQL');
    console.log('='.repeat(60));
    
    const importer = new MySQLImporter();
    try {
      await importer.connect();
      await importer.testConnection();
      
      const existingTables = await importer.checkIfTablesExist();
      
      // Warn about data loss
      if (existingTables.length > 0) {
        console.log('\n⚠️  WARNING: Existing data will be deleted!');
        console.log('   This operation will clear all existing data in the MySQL database');
        console.log('   and replace it with data from SQLite.');
        
        const proceed = await this.promptUser('\nDo you want to continue? (yes/no): ');
        if (proceed !== 'yes' && proceed !== 'y') {
          console.log('❌ Migration cancelled by user');
          return false;
        }
      }
      
      // Initialize tables if needed
      if (existingTables.length === 0) {
        await importer.initializeTables();
        await importer.close();
        await importer.connect();
      }
      
      // Clear existing data
      if (existingTables.length > 0) {
        await importer.clearExistingData();
      }
      
      // Import data
      await importer.importSQLFile();
      
      // Verify import
      await importer.verifyImport();
      
    } catch (error) {
      console.error('❌ MySQL import failed:', error.message);
      return false;
    } finally {
      await importer.close();
    }
    
    console.log('\n' + '='.repeat(60));
    console.log('✅ MIGRATION COMPLETED SUCCESSFULLY!');
    console.log('='.repeat(60));
    console.log('Your SQLite data has been successfully migrated to MySQL.');
    console.log('You can now deploy your application with the MySQL database.');
    
    return true;
  }

  async exportOnly() {
    console.log('📤 Exporting SQLite data only...\n');
    
    const sqliteOk = await this.checkSQLiteDatabase();
    if (!sqliteOk) {
      return false;
    }
    
    const exporter = new SQLiteExporter();
    try {
      await exporter.initialize();
      await exporter.exportAllTables();
      return true;
    } catch (error) {
      console.error('❌ Export failed:', error.message);
      return false;
    } finally {
      await exporter.close();
    }
  }

  async importOnly() {
    console.log('📥 Importing to MySQL only...\n');
    
    const envOk = await this.checkEnvironment();
    if (!envOk) {
      return false;
    }
    
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
      
      await importer.importSQLFile();
      await importer.verifyImport();
      
      return true;
    } catch (error) {
      console.error('❌ Import failed:', error.message);
      return false;
    } finally {
      await importer.close();
    }
  }

  async showMenu() {
    console.log('\n📋 Database Migration Utility');
    console.log('='.repeat(40));
    console.log('1. Full migration (Export SQLite → Import to MySQL)');
    console.log('2. Export SQLite data only');
    console.log('3. Import to MySQL only');
    console.log('4. Check environment');
    console.log('5. Exit');
    console.log('='.repeat(40));
    
    const choice = await this.promptUser('Choose an option (1-5): ');
    
    switch (choice) {
      case '1':
        await this.runFullMigration();
        break;
      case '2':
        await this.exportOnly();
        break;
      case '3':
        await this.importOnly();
        break;
      case '4':
        await this.checkEnvironment();
        await this.checkSQLiteDatabase();
        break;
      case '5':
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
  const migrator = new DatabaseMigrator();
  
  try {
    // Check if command line arguments are provided
    const args = process.argv.slice(2);
    
    if (args.length > 0) {
      const command = args[0].toLowerCase();
      
      switch (command) {
        case 'export':
          await migrator.exportOnly();
          break;
        case 'import':
          await migrator.importOnly();
          break;
        case 'migrate':
        case 'full':
          await migrator.runFullMigration();
          break;
        case 'check':
          await migrator.checkEnvironment();
          await migrator.checkSQLiteDatabase();
          break;
        default:
          console.log('❌ Unknown command. Available commands: export, import, migrate, check');
          process.exit(1);
      }
    } else {
      // Interactive mode
      let continueRunning = true;
      while (continueRunning) {
        continueRunning = await migrator.showMenu();
        if (continueRunning) {
          const restart = await migrator.promptUser('\nRun another operation? (yes/no): ');
          continueRunning = restart === 'yes' || restart === 'y';
        }
      }
    }
    
  } catch (error) {
    console.error('❌ Migration utility error:', error.message);
    process.exit(1);
  } finally {
    await migrator.close();
  }
}

// Run if called directly
if (require.main === module) {
  main();
}

module.exports = DatabaseMigrator;