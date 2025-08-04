#!/usr/bin/env node

const sqlite3 = require('sqlite3').verbose();
const mysql = require('mysql2/promise');
const readline = require('readline');
const fs = require('fs').promises;
const path = require('path');
require('dotenv').config();

// Helper function to convert SQLite datetime to MySQL datetime
function convertDateTime(sqliteDateTime) {
  if (!sqliteDateTime) return null;
  
  // Handle ISO format with T and Z
  if (sqliteDateTime.includes('T')) {
    // Replace T with space and remove Z and milliseconds
    return sqliteDateTime.replace('T', ' ').replace('Z', '').split('.')[0];
  }
  
  return sqliteDateTime;
}

// Helper function to convert time format
function convertTime(sqliteTime) {
  if (!sqliteTime) return null;
  
  // If it's already in HH:MM:SS format, return as is
  if (sqliteTime.match(/^\d{2}:\d{2}:\d{2}$/)) {
    return sqliteTime;
  }
  
  // If it's in HH:MM format, add :00
  if (sqliteTime.match(/^\d{2}:\d{2}$/)) {
    return sqliteTime + ':00';
  }
  
  return sqliteTime;
}

class DatabaseMigrator {
  constructor() {
    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });
    
    this.mysqlConfig = {
      host: process.env.DB_HOST || 'localhost',
      port: process.env.DB_PORT || 3306,
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME || 'abnehmen_app',
      timezone: 'Z'
    };
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

  async createMySQLTables(connection) {
    const tables = [
      // Disable foreign key checks
      `SET FOREIGN_KEY_CHECKS = 0`,
      
      // Drop existing tables
      `DROP TABLE IF EXISTS dialogflow_messages`,
      `DROP TABLE IF EXISTS dialogflow_conversations`,
      `DROP TABLE IF EXISTS google_sheets_integrations`,
      `DROP TABLE IF EXISTS lead_call_logs`,
      `DROP TABLE IF EXISTS leads`,
      `DROP TABLE IF EXISTS session_blocks`,
      `DROP TABLE IF EXISTS appointments`,
      `DROP TABLE IF EXISTS customers`,
      `DROP TABLE IF EXISTS activation_codes`,
      `DROP TABLE IF EXISTS appointment_types`,
      `DROP TABLE IF EXISTS manager_codes`,
      `DROP TABLE IF EXISTS studios`,
      `DROP TABLE IF EXISTS users`,
      
      // Re-enable foreign key checks
      `SET FOREIGN_KEY_CHECKS = 1`,
      
      // Create tables with complete schema matching SQLite
      `CREATE TABLE users (
        id INT AUTO_INCREMENT PRIMARY KEY,
        email VARCHAR(255) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        role ENUM('manager', 'studio_owner', 'customer') NOT NULL,
        first_name VARCHAR(100),
        last_name VARCHAR(100),
        phone VARCHAR(20),
        is_active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      )`,
      
      `CREATE TABLE studios (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        owner_id INT NOT NULL,
        address TEXT,
        phone VARCHAR(20),
        email VARCHAR(255),
        business_hours TEXT,
        city VARCHAR(100),
        cancellation_advance_hours INT DEFAULT 24,
        postponement_advance_hours INT DEFAULT 24,
        max_advance_booking_days INT DEFAULT 30,
        is_active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE CASCADE
      )`,
      
      `CREATE TABLE manager_codes (
        id INT AUTO_INCREMENT PRIMARY KEY,
        code VARCHAR(50) UNIQUE NOT NULL,
        created_by_user_id INT,
        used_by_user_id INT,
        is_used BOOLEAN DEFAULT FALSE,
        expires_at TIMESTAMP NULL,
        intended_city VARCHAR(100),
        intended_studio_name VARCHAR(255),
        intended_owner_name VARCHAR(255),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (created_by_user_id) REFERENCES users(id) ON DELETE SET NULL,
        FOREIGN KEY (used_by_user_id) REFERENCES users(id) ON DELETE SET NULL
      )`,
      
      `CREATE TABLE activation_codes (
        id INT AUTO_INCREMENT PRIMARY KEY,
        code VARCHAR(50) UNIQUE NOT NULL,
        studio_id INT,
        used_by_user_id INT,
        is_used BOOLEAN DEFAULT FALSE,
        expires_at TIMESTAMP NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (used_by_user_id) REFERENCES users(id) ON DELETE SET NULL,
        FOREIGN KEY (studio_id) REFERENCES studios(id) ON DELETE CASCADE
      )`,
      
      `CREATE TABLE appointment_types (
        id INT AUTO_INCREMENT PRIMARY KEY,
        studio_id INT NOT NULL,
        name VARCHAR(100) NOT NULL,
        duration_minutes INT NOT NULL DEFAULT 60,
        description TEXT,
        is_active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (studio_id) REFERENCES studios(id) ON DELETE CASCADE
      )`,
      
      `CREATE TABLE customers (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        studio_id INT NOT NULL,
        last_weight DECIMAL(5,2),
        goal_weight DECIMAL(5,2),
        initial_weight DECIMAL(5,2),
        notes TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY unique_user_studio (user_id, studio_id),
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (studio_id) REFERENCES studios(id) ON DELETE CASCADE
      )`,
      
      `CREATE TABLE appointments (
        id INT AUTO_INCREMENT PRIMARY KEY,
        customer_id INT NOT NULL,
        studio_id INT NOT NULL,
        appointment_date DATE NOT NULL,
        appointment_time TIME NOT NULL,
        duration_minutes INT DEFAULT 60,
        status ENUM('scheduled', 'confirmed', 'completed', 'cancelled', 'no_show') DEFAULT 'scheduled',
        notes TEXT,
        appointment_type_id INT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (customer_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (studio_id) REFERENCES studios(id) ON DELETE CASCADE,
        FOREIGN KEY (appointment_type_id) REFERENCES appointment_types(id) ON DELETE SET NULL
      )`,
      
      `CREATE TABLE session_blocks (
        id INT AUTO_INCREMENT PRIMARY KEY,
        customer_id INT NOT NULL,
        studio_id INT NOT NULL,
        total_sessions INT NOT NULL,
        used_sessions INT DEFAULT 0,
        price DECIMAL(10,2),
        purchase_date DATE NOT NULL,
        expiry_date DATE,
        notes TEXT,
        is_active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (customer_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (studio_id) REFERENCES studios(id) ON DELETE CASCADE
      )`,
      
      `CREATE TABLE leads (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        phone_number VARCHAR(20) NOT NULL,
        email VARCHAR(255),
        studio_id INT,
        status ENUM('new', 'contacted', 'interested', 'appointment_scheduled', 'converted', 'not_interested') DEFAULT 'new',
        source VARCHAR(100),
        notes TEXT,
        last_contact_date TIMESTAMP NULL,
        next_contact_date TIMESTAMP NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (studio_id) REFERENCES studios(id) ON DELETE SET NULL
      )`,
      
      `CREATE TABLE lead_call_logs (
        id INT AUTO_INCREMENT PRIMARY KEY,
        lead_id INT NOT NULL,
        call_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        call_duration INT,
        call_outcome VARCHAR(100),
        notes TEXT,
        created_by INT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (lead_id) REFERENCES leads(id) ON DELETE CASCADE,
        FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
      )`,
      
      `CREATE TABLE google_sheets_integrations (
        id INT AUTO_INCREMENT PRIMARY KEY,
        studio_id INT NOT NULL,
        sheet_id VARCHAR(255) NOT NULL,
        sheet_name VARCHAR(255),
        webhook_url TEXT,
        is_active BOOLEAN DEFAULT TRUE,
        last_sync_at TIMESTAMP NULL,
        sync_status VARCHAR(50),
        column_mapping TEXT,
        auto_sync_enabled BOOLEAN DEFAULT TRUE,
        sync_frequency_minutes INT DEFAULT 30,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (studio_id) REFERENCES studios(id) ON DELETE CASCADE
      )`,
      
      `CREATE TABLE dialogflow_conversations (
        id INT AUTO_INCREMENT PRIMARY KEY,
        session_id VARCHAR(255) NOT NULL,
        lead_id INT,
        phone_number VARCHAR(20),
        started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        ended_at TIMESTAMP NULL,
        status VARCHAR(50),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (lead_id) REFERENCES leads(id) ON DELETE SET NULL
      )`,
      
      `CREATE TABLE dialogflow_messages (
        id INT AUTO_INCREMENT PRIMARY KEY,
        conversation_id INT NOT NULL,
        message_type ENUM('user', 'bot') NOT NULL,
        message_text TEXT,
        intent_name VARCHAR(255),
        confidence_score DECIMAL(3,2),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (conversation_id) REFERENCES dialogflow_conversations(id) ON DELETE CASCADE
      )`
    ];

    for (const sql of tables) {
      try {
        await connection.execute(sql);
      } catch (error) {
        console.error('Error executing SQL:', sql.substring(0, 50) + '...');
        console.error('Error:', error.message);
        throw error;
      }
    }
  }

  async migrateTable(tableName, sqliteDb, mysqlConnection) {
    return new Promise((resolve, reject) => {
      console.log(`\nMigrating ${tableName}...`);
      
      sqliteDb.all(`SELECT * FROM ${tableName}`, async (err, rows) => {
        if (err) {
          console.log(`  ⚠️  Table ${tableName} not found in SQLite, skipping...`);
          resolve();
          return;
        }
        
        if (!rows || rows.length === 0) {
          console.log(`  ℹ️  No data in ${tableName}`);
          resolve();
          return;
        }
        
        console.log(`  📊 Found ${rows.length} records`);
        
        // Process rows and fix data formats
        const processedRows = rows.map(row => {
          const newRow = {...row};
          
          // Convert datetime fields
          const dateTimeFields = ['created_at', 'updated_at', 'expires_at', 'last_sync_at', 
                                 'last_contact_date', 'next_contact_date', 'started_at', 
                                 'ended_at', 'call_date'];
          dateTimeFields.forEach(field => {
            if (newRow[field]) {
              newRow[field] = convertDateTime(newRow[field]);
            }
          });
          
          // Convert time fields
          const timeFields = ['appointment_time'];
          timeFields.forEach(field => {
            if (newRow[field]) {
              newRow[field] = convertTime(newRow[field]);
            }
          });
          
          // Handle column name mappings
          if (tableName === 'leads' && newRow.phone) {
            newRow.phone_number = newRow.phone;
            delete newRow.phone;
          }
          
          return newRow;
        });
        
        // Process rows in batches
        const batchSize = 100;
        let successCount = 0;
        
        for (let i = 0; i < processedRows.length; i += batchSize) {
          const batch = processedRows.slice(i, i + batchSize);
          
          try {
            // Build insert query
            const columns = Object.keys(batch[0]).join(', ');
            const placeholders = batch.map(() => 
              `(${Object.keys(batch[0]).map(() => '?').join(', ')})`
            ).join(', ');
            
            const values = batch.flatMap(row => Object.values(row));
            
            const query = `INSERT INTO ${tableName} (${columns}) VALUES ${placeholders}
              ON DUPLICATE KEY UPDATE id=id`;
            
            await mysqlConnection.execute(query, values);
            
            successCount += batch.length;
            console.log(`  ✅ Migrated batch ${Math.floor(i/batchSize) + 1}/${Math.ceil(processedRows.length/batchSize)}`);
          } catch (error) {
            console.error(`  ❌ Error migrating ${tableName}:`, error.message);
            if (error.message.includes('Unknown column')) {
              console.error('    Columns in data:', Object.keys(batch[0]));
            }
          }
        }
        
        console.log(`  ✅ Successfully migrated ${successCount}/${processedRows.length} records`);
        resolve();
      });
    });
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
    
    let mysqlConnection;
    let sqliteDb;
    
    try {
      // Connect to MySQL
      console.log('\nConnecting to MySQL...');
      mysqlConnection = await mysql.createConnection(this.mysqlConfig);
      console.log('✅ Connected to MySQL');
      
      // Connect to SQLite
      sqliteDb = new sqlite3.Database('./database.sqlite');
      
      // Warn about data loss (auto-proceed in command line mode)
      console.log('\n⚠️  WARNING: This will replace all existing MySQL data!');
      console.log('   All existing data in the MySQL database will be deleted');
      console.log('   and replaced with data from SQLite.');
      console.log('✅ Auto-proceeding with migration...');
      
      // Step 2: Create MySQL schema
      console.log('\n' + '='.repeat(60));
      console.log('STEP 2: Creating MySQL Schema');
      console.log('='.repeat(60));
      
      await this.createMySQLTables(mysqlConnection);
      console.log('✅ MySQL schema created');
      
      // Step 3: Migrate data
      console.log('\n' + '='.repeat(60));
      console.log('STEP 3: Migrating Data');
      console.log('='.repeat(60));
      
      // Order matters due to foreign key constraints
      const migrationOrder = [
        'users',
        'studios',
        'manager_codes',
        'activation_codes',
        'appointment_types',
        'customers',
        'appointments',
        'session_blocks',
        'leads',
        'lead_call_logs',
        'google_sheets_integrations',
        'dialogflow_conversations',
        'dialogflow_messages'
      ];
      
      for (const table of migrationOrder) {
        await this.migrateTable(table, sqliteDb, mysqlConnection);
      }
      
      console.log('\n' + '='.repeat(60));
      console.log('✅ MIGRATION COMPLETED SUCCESSFULLY!');
      console.log('='.repeat(60));
      console.log('Your SQLite data has been successfully migrated to MySQL.');
      console.log('\nNext steps:');
      console.log('1. Test the application with MySQL');
      console.log('2. Deploy to production when ready');
      
      return true;
      
    } catch (error) {
      console.error('❌ Migration failed:', error);
      return false;
    } finally {
      if (mysqlConnection) {
        await mysqlConnection.end();
      }
      if (sqliteDb) {
        sqliteDb.close();
      }
    }
  }

  async showMenu() {
    console.log('\n📋 Database Migration Utility');
    console.log('='.repeat(40));
    console.log('1. Full migration (SQLite → MySQL)');
    console.log('2. Check environment');
    console.log('3. Exit');
    console.log('='.repeat(40));
    
    const choice = await this.promptUser('Choose an option (1-3): ');
    
    switch (choice) {
      case '1':
        await this.runFullMigration();
        break;
      case '2':
        await this.checkEnvironment();
        await this.checkSQLiteDatabase();
        break;
      case '3':
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
        case 'migrate':
        case 'full':
          await migrator.runFullMigration();
          break;
        case 'check':
          await migrator.checkEnvironment();
          await migrator.checkSQLiteDatabase();
          break;
        default:
          console.log('❌ Unknown command. Available commands: migrate, check');
          process.exit(1);
      }
    } else {
      // Interactive mode
      let continueRunning = true;
      while (continueRunning) {
        continueRunning = await migrator.showMenu();
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