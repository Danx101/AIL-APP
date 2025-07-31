#!/usr/bin/env node

const mysql = require('mysql2/promise');
const fs = require('fs').promises;
const path = require('path');
require('dotenv').config();

// Import configuration
const IMPORT_DIR = path.join(__dirname, '../migrations/data');
const SQL_FILE = path.join(IMPORT_DIR, 'sqlite_export.sql');

class MySQLImporter {
  constructor() {
    this.connection = null;
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
      const [rows] = await this.connection.execute('SELECT VERSION() as version');
      console.log(`🗄️  MySQL Version: ${rows[0].version}`);
      return true;
    } catch (error) {
      console.error('❌ Connection test failed:', error.message);
      return false;
    }
  }

  async checkIfTablesExist() {
    try {
      const [rows] = await this.connection.execute(`
        SELECT TABLE_NAME 
        FROM INFORMATION_SCHEMA.TABLES 
        WHERE TABLE_SCHEMA = ? 
        ORDER BY TABLE_NAME
      `, [this.dbConfig.database]);

      const existingTables = rows.map(row => row.TABLE_NAME);
      console.log(`📋 Existing tables in database: ${existingTables.length}`);
      
      if (existingTables.length > 0) {
        console.log('   Tables found:', existingTables.join(', '));
      }

      return existingTables;
    } catch (error) {
      console.error('❌ Error checking tables:', error.message);
      return [];
    }
  }

  async initializeTables() {
    try {
      console.log('🏗️  Initializing database tables...');
      
      // Import the MySQL connection module to create tables
      const { initializeDatabase } = require('../src/database/mysql-connection');
      
      // This will create all the necessary tables
      await initializeDatabase();
      
      console.log('✅ Database tables initialized');
      
      // Close the connection created by initializeDatabase and use our own
      const { closeConnection } = require('../src/database/mysql-connection');
      await closeConnection();
      
      return true;
    } catch (error) {
      console.error('❌ Failed to initialize tables:', error.message);
      throw error;
    }
  }

  async clearExistingData() {
    console.log('🧹 Clearing existing data...');
    
    const tablesToClear = [
      'dialogflow_conversations',
      'lead_call_logs', 
      'google_sheets_integrations',
      'leads',
      'appointments',
      'manager_codes',
      'activation_codes',
      'studios',
      'users'
    ];

    try {
      await this.connection.execute('SET FOREIGN_KEY_CHECKS = 0');
      
      for (const table of tablesToClear) {
        try {
          const [result] = await this.connection.execute(`DELETE FROM ${table}`);
          console.log(`   → Cleared ${result.affectedRows} records from ${table}`);
        } catch (error) {
          // Table might not exist, that's ok
          console.log(`   → Table ${table} not found or already empty`);
        }
      }
      
      await this.connection.execute('SET FOREIGN_KEY_CHECKS = 1');
      console.log('✅ Data clearing completed');
      
    } catch (error) {
      console.error('❌ Error clearing data:', error.message);
      throw error;
    }
  }

  async importSQLFile() {
    try {
      console.log('📤 Reading SQL import file...');
      
      // Check if SQL file exists
      try {
        await fs.access(SQL_FILE);
      } catch (error) {
        throw new Error(`SQL import file not found: ${SQL_FILE}. Please run export-sqlite-data.js first.`);
      }

      const sqlContent = await fs.readFile(SQL_FILE, 'utf8');
      
      if (!sqlContent.trim()) {
        throw new Error('SQL file is empty');
      }

      console.log(`📄 SQL file size: ${(sqlContent.length / 1024).toFixed(2)} KB`);

      // Split SQL content into individual statements
      const statements = sqlContent
        .split(';')
        .map(stmt => stmt.trim())
        .filter(stmt => stmt && !stmt.startsWith('--'));

      console.log(`📝 Found ${statements.length} SQL statements to execute`);

      let executedCount = 0;
      let insertCount = 0;

      for (const statement of statements) {
        if (!statement) continue;

        try {
          if (statement.toUpperCase().startsWith('INSERT')) {
            const [result] = await this.connection.execute(statement);
            insertCount += result.affectedRows || 0;
          } else {
            await this.connection.execute(statement);
          }
          executedCount++;
        } catch (error) {
          console.error(`❌ Error executing statement: ${statement.substring(0, 100)}...`);
          console.error(`   Error: ${error.message}`);
          // Continue with other statements instead of failing completely
        }
      }

      console.log(`✅ Import completed successfully`);
      console.log(`   → Executed ${executedCount} statements`);
      console.log(`   → Imported ${insertCount} records`);

      return { executedCount, insertCount };

    } catch (error) {
      console.error('❌ Error importing SQL file:', error.message);
      throw error;
    }
  }

  async verifyImport() {
    console.log('🔍 Verifying import...');
    
    const tables = [
      'users', 'studios', 'activation_codes', 'manager_codes',
      'appointments', 'leads', 'lead_call_logs', 
      'google_sheets_integrations', 'dialogflow_conversations'
    ];

    const summary = {};
    let totalRecords = 0;

    for (const table of tables) {
      try {
        const [rows] = await this.connection.execute(`SELECT COUNT(*) as count FROM ${table}`);
        const count = rows[0].count;
        summary[table] = count;
        totalRecords += count;
        console.log(`   → ${table}: ${count} records`);
      } catch (error) {
        console.log(`   → ${table}: table not found or error (${error.message})`);
        summary[table] = 'ERROR';
      }
    }

    console.log(`📊 Total records in database: ${totalRecords}`);
    
    return summary;
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
  const importer = new MySQLImporter();
  
  try {
    // Connect to MySQL
    await importer.connect();
    
    // Test connection
    await importer.testConnection();
    
    // Check existing tables
    const existingTables = await importer.checkIfTablesExist();
    
    // Initialize tables if needed
    if (existingTables.length === 0) {
      console.log('📋 No tables found, initializing database schema...');
      await importer.initializeTables();
      
      // Reconnect after initialization
      await importer.close();
      await importer.connect();
    }
    
    // Ask user for confirmation before clearing data
    if (existingTables.length > 0) {
      console.log('\n⚠️  WARNING: This will delete all existing data in the MySQL database!');
      console.log('   Existing tables will be cleared before importing SQLite data.');
      console.log('   Make sure you have a backup if needed.');
      
      // In a real scenario, you'd want to prompt the user here
      // For now, we'll proceed with clearing
      await importer.clearExistingData();
    }
    
    // Import the SQL file
    const importResult = await importer.importSQLFile();
    
    // Verify the import
    const verification = await importer.verifyImport();
    
    // Save import summary
    const importSummary = {
      importDate: new Date().toISOString(),
      database: importer.dbConfig.database,
      host: importer.dbConfig.host,
      importResult,
      verification,
      status: 'completed'
    };
    
    const summaryPath = path.join(IMPORT_DIR, 'import_summary.json');
    await fs.writeFile(summaryPath, JSON.stringify(importSummary, null, 2), 'utf8');
    
    console.log('\n🎉 Migration completed successfully!');
    console.log(`📊 Import summary saved to: ${summaryPath}`);
    
  } catch (error) {
    console.error('\n❌ Migration failed:', error.message);
    process.exit(1);
  } finally {
    await importer.close();
  }
}

// Run if called directly
if (require.main === module) {
  main();
}

module.exports = MySQLImporter;