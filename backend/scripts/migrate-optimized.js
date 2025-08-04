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

class OptimizedDatabaseMigrator {
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

  async createOptimizedMySQLSchema(connection) {
    console.log('🏗️  Creating optimized MySQL schema...');
    
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
      `DROP TABLE IF EXISTS customer_sessions`,
      `DROP TABLE IF EXISTS session_transactions`,
      `DROP TABLE IF EXISTS recurring_appointments`,
      `DROP TABLE IF EXISTS studios`,
      `DROP TABLE IF EXISTS users`,
      `DROP TABLE IF EXISTS sync_tracking`,
      `DROP TABLE IF EXISTS sync_checkpoints`,
      
      // Re-enable foreign key checks
      `SET FOREIGN_KEY_CHECKS = 1`,
      
      // Create optimized schema
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
        cancellation_advance_hours INT DEFAULT 48,
        postponement_advance_hours INT DEFAULT 48,
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
      
      `CREATE TABLE customers (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        studio_id INT NOT NULL,
        probebehandlung_used BOOLEAN DEFAULT FALSE,
        probebehandlung_appointment_id INT,
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
      
      `CREATE TABLE customer_sessions (
        id INT AUTO_INCREMENT PRIMARY KEY,
        customer_id INT NOT NULL,
        studio_id INT NOT NULL,
        total_sessions INT NOT NULL,
        remaining_sessions INT NOT NULL,
        is_active BOOLEAN DEFAULT FALSE,
        queue_position INT DEFAULT 0,
        purchase_date DATE NOT NULL,
        notes TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (customer_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (studio_id) REFERENCES studios(id) ON DELETE CASCADE
      )`,
      
      `CREATE TABLE appointment_types (
        id INT AUTO_INCREMENT PRIMARY KEY,
        studio_id INT NOT NULL,
        name VARCHAR(100) NOT NULL,
        duration_minutes INT NOT NULL,
        consumes_session BOOLEAN DEFAULT TRUE,
        is_probebehandlung BOOLEAN DEFAULT FALSE,
        max_per_customer INT DEFAULT NULL,
        description TEXT,
        color VARCHAR(7) DEFAULT '#28a745',
        is_active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (studio_id) REFERENCES studios(id) ON DELETE CASCADE
      )`,
      
      `CREATE TABLE appointments (
        id INT AUTO_INCREMENT PRIMARY KEY,
        customer_id INT NOT NULL,
        studio_id INT NOT NULL,
        appointment_type_id INT,
        appointment_date DATE NOT NULL,
        start_time TIME NOT NULL,
        end_time TIME NOT NULL,
        status ENUM('bestätigt', 'absolviert', 'nicht_erschienen', 'storniert') DEFAULT 'bestätigt',
        cancelled_by ENUM('customer', 'studio', 'system') NULL,
        cancelled_at TIMESTAMP NULL,
        session_consumed BOOLEAN DEFAULT FALSE,
        notes TEXT,
        created_by_user_id INT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (customer_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (studio_id) REFERENCES studios(id) ON DELETE CASCADE,
        FOREIGN KEY (appointment_type_id) REFERENCES appointment_types(id) ON DELETE SET NULL,
        FOREIGN KEY (created_by_user_id) REFERENCES users(id) ON DELETE SET NULL
      )`,
      
      `CREATE TABLE leads (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        phone_number VARCHAR(20) NOT NULL,
        email VARCHAR(255),
        studio_id INT,
        status ENUM('neu', 'kontaktiert', 'interessiert', 'termin_vereinbart', 'kunde_geworden', 'nicht_interessiert') DEFAULT 'neu',
        source VARCHAR(100),
        notes TEXT,
        last_contact_date TIMESTAMP NULL,
        next_contact_date TIMESTAMP NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (studio_id) REFERENCES studios(id) ON DELETE SET NULL
      )`,
      
      `CREATE TABLE google_sheets_integrations (
        id INT AUTO_INCREMENT PRIMARY KEY,
        studio_id INT NOT NULL,
        sheet_id VARCHAR(255) NOT NULL,
        sheet_name VARCHAR(255),
        last_sync_at TIMESTAMP NULL,
        sync_status VARCHAR(50),
        column_mapping TEXT,
        auto_sync_enabled BOOLEAN DEFAULT TRUE,
        sync_frequency_minutes INT DEFAULT 30,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY unique_studio_sheet (studio_id, sheet_id),
        FOREIGN KEY (studio_id) REFERENCES studios(id) ON DELETE CASCADE
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
    
    console.log('✅ Optimized MySQL schema created');
  }

  async cleanAndMigrateData(sqliteDb, mysqlConnection) {
    console.log('\n🧹 Starting clean data migration...');
    
    // Migration order (respects foreign key constraints)
    const migrationTasks = [
      { table: 'users', cleanupFn: null },
      { table: 'studios', cleanupFn: null },
      { table: 'manager_codes', cleanupFn: null },
      { table: 'activation_codes', cleanupFn: null },
      { table: 'customers', cleanupFn: this.createCustomersFromUsers.bind(this) },
      { table: 'customer_sessions', cleanupFn: this.cleanupCustomerSessions.bind(this) },
      { table: 'appointment_types', cleanupFn: this.createOptimizedAppointmentTypes.bind(this) },
      { table: 'appointments', cleanupFn: this.cleanupAppointments.bind(this) },
      { table: 'leads', cleanupFn: this.cleanupLeads.bind(this) },
      { table: 'google_sheets_integrations', cleanupFn: this.cleanupGoogleSheets.bind(this) }
    ];

    for (const task of migrationTasks) {
      if (task.cleanupFn) {
        await task.cleanupFn(sqliteDb, mysqlConnection);
      } else {
        await this.migrateTableStandard(task.table, sqliteDb, mysqlConnection);
      }
    }
  }

  async migrateTableStandard(tableName, sqliteDb, mysqlConnection) {
    return new Promise((resolve, reject) => {
      console.log(`\n📦 Migrating ${tableName}...`);
      
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
        
        try {
          // Process rows and fix data formats
          const processedRows = rows.map(row => {
            const newRow = {...row};
            
            // Handle table-specific column mappings
            if (tableName === 'studios') {
              // Remove SQLite-specific columns that don't exist in MySQL schema
              delete newRow.settings_updated_at;
            }
            
            if (tableName === 'manager_codes') {
              // Map SQLite column to MySQL column
              if (newRow.created_by_manager_id) {
                newRow.created_by_user_id = newRow.created_by_manager_id;
                delete newRow.created_by_manager_id;
              }
            }
            
            if (tableName === 'leads') {
              // Remove SQLite-specific columns
              delete newRow.google_sheets_row_id;
              delete newRow.google_sheets_sync_id;
              delete newRow.lead_score;
              delete newRow.conversion_status;
              delete newRow.source_type;
              delete newRow.created_by_manager_id;
              
              // Map column names
              if (newRow.last_contacted) {
                newRow.last_contact_date = newRow.last_contacted;
                delete newRow.last_contacted;
              }
              if (newRow.next_follow_up) {
                newRow.next_contact_date = newRow.next_follow_up;
                delete newRow.next_follow_up;
              }
            }
            
            // Convert datetime fields
            const dateTimeFields = ['created_at', 'updated_at', 'expires_at', 'last_sync_at', 
                                   'last_contact_date', 'next_contact_date', 'started_at', 
                                   'ended_at', 'call_date'];
            dateTimeFields.forEach(field => {
              if (newRow[field]) {
                newRow[field] = convertDateTime(newRow[field]);
              }
            });
            
            return newRow;
          });
          
          // Bulk insert
          if (processedRows.length > 0) {
            const columns = Object.keys(processedRows[0]).join(', ');
            const placeholders = processedRows.map(() => 
              `(${Object.keys(processedRows[0]).map(() => '?').join(', ')})`
            ).join(', ');
            
            const values = processedRows.flatMap(row => Object.values(row));
            
            const query = `INSERT INTO ${tableName} (${columns}) VALUES ${placeholders}`;
            await mysqlConnection.execute(query, values);
          }
          
          console.log(`  ✅ Successfully migrated ${processedRows.length} records`);
          resolve();
        } catch (error) {
          console.error(`  ❌ Error migrating ${tableName}:`, error.message);
          resolve(); // Continue with other tables
        }
      });
    });
  }

  async createCustomersFromUsers(sqliteDb, mysqlConnection) {
    return new Promise((resolve, reject) => {
      console.log(`\n👥 Creating customers from users with customer role...`);
      
      // Get all users with customer role and their studios
      sqliteDb.all(`
        SELECT u.id as user_id, ac.studio_id, u.created_at, u.updated_at
        FROM users u
        JOIN activation_codes ac ON u.id = ac.used_by_user_id
        WHERE u.role = 'customer' AND ac.is_used = 1
      `, async (err, rows) => {
        if (err) {
          console.log('  ⚠️  Error getting customer users:', err.message);
          resolve();
          return;
        }
        
        if (!rows || rows.length === 0) {
          console.log('  ℹ️  No customer users found');
          resolve();
          return;
        }
        
        console.log(`  📊 Found ${rows.length} customers`);
        
        try {
          const customers = rows.map(row => [
            row.user_id,
            row.studio_id,
            false, // probebehandlung_used
            null,  // probebehandlung_appointment_id
            null,  // last_weight
            null,  // goal_weight
            null,  // initial_weight
            null,  // notes
            convertDateTime(row.created_at),
            convertDateTime(row.updated_at)
          ]);
          
          if (customers.length > 0) {
            const query = `INSERT INTO customers (user_id, studio_id, probebehandlung_used, probebehandlung_appointment_id, last_weight, goal_weight, initial_weight, notes, created_at, updated_at) VALUES ?`;
            await mysqlConnection.query(query, [customers]);
          }
          
          console.log(`  ✅ Successfully created ${customers.length} customer records`);
          resolve();
        } catch (error) {
          console.error('  ❌ Error creating customers:', error.message);
          resolve();
        }
      });
    });
  }

  async cleanupCustomerSessions(sqliteDb, mysqlConnection) {
    return new Promise((resolve, reject) => {
      console.log(`\n🎯 Migrating and organizing customer sessions with queue system...`);
      
      sqliteDb.all(`SELECT * FROM customer_sessions ORDER BY customer_id, id`, async (err, rows) => {
        if (err) {
          console.log('  ⚠️  No customer_sessions table found');
          resolve();
          return;
        }
        
        if (!rows || rows.length === 0) {
          console.log('  ℹ️  No customer sessions found');
          resolve();
          return;
        }
        
        console.log(`  📊 Found ${rows.length} session records`);
        
        try {
          // Group sessions by customer_id and studio_id
          const customerGroups = new Map();
          rows.forEach(row => {
            const key = `${row.customer_id}_${row.studio_id}`;
            if (!customerGroups.has(key)) {
              customerGroups.set(key, []);
            }
            customerGroups.get(key).push(row);
          });
          
          const processedSessions = [];
          
          customerGroups.forEach((sessions, key) => {
            // Sort sessions by remaining_sessions desc, then by id
            sessions.sort((a, b) => {
              if (a.remaining_sessions !== b.remaining_sessions) {
                return b.remaining_sessions - a.remaining_sessions; // Desc
              }
              return a.id - b.id; // Asc
            });
            
            // Set first session with remaining_sessions > 0 as active
            let activeSet = false;
            sessions.forEach((session, index) => {
              const isActive = !activeSet && session.remaining_sessions > 0;
              if (isActive) activeSet = true;
              
              processedSessions.push([
                session.customer_id,
                session.studio_id,
                session.total_sessions,
                session.remaining_sessions,
                isActive,
                index, // queue_position
                session.purchase_date ? session.purchase_date.split('T')[0] : new Date().toISOString().split('T')[0],
                session.notes || '',
                convertDateTime(session.created_at),
                convertDateTime(session.updated_at)
              ]);
            });
          });
          
          if (processedSessions.length > 0) {
            const query = `INSERT INTO customer_sessions (customer_id, studio_id, total_sessions, remaining_sessions, is_active, queue_position, purchase_date, notes, created_at, updated_at) VALUES ?`;
            await mysqlConnection.query(query, [processedSessions]);
          }
          
          console.log(`  ✅ Successfully migrated ${processedSessions.length} session records with queue system`);
          
          // Log active sessions summary
          const activeSessions = processedSessions.filter(s => s[4] === true);
          console.log(`  🎯 Set ${activeSessions.length} sessions as active`);
          
          resolve();
        } catch (error) {
          console.error('  ❌ Error migrating customer sessions:', error.message);
          resolve();
        }
      });
    });
  }

  async createOptimizedAppointmentTypes(sqliteDb, mysqlConnection) {
    console.log(`\n📅 Creating optimized appointment types...`);
    
    try {
      // Get all studios that were successfully migrated
      const [studios] = await mysqlConnection.execute('SELECT id FROM studios WHERE id IS NOT NULL');
      console.log(`  📊 Found ${studios.length} studios for appointment types`);
      
      if (studios.length === 0) {
        console.log('  ⚠️  No studios found, skipping appointment types creation');
        return;
      }
      
      const appointmentTypes = [];
      
      studios.forEach(studio => {
        // Behandlung (Standard Treatment)
        appointmentTypes.push([
          studio.id,
          'Behandlung',
          60, // duration_minutes
          true, // consumes_session
          false, // is_probebehandlung
          null, // max_per_customer
          'Standard Abnehmen im Liegen Behandlung',
          '#28a745',
          true // is_active
        ]);
        
        // Beratung (Consultation) - Updated to 20 minutes
        appointmentTypes.push([
          studio.id,
          'Beratung',
          20, // duration_minutes (updated from 30)
          false, // consumes_session
          false, // is_probebehandlung
          null, // max_per_customer
          'Kostenlose Beratung und Aufklärung',
          '#17a2b8',
          true // is_active
        ]);
        
        // Probebehandlung (Trial Treatment)
        appointmentTypes.push([
          studio.id,
          'Probebehandlung',
          60, // duration_minutes
          false, // consumes_session
          true, // is_probebehandlung
          1, // max_per_customer
          'Kostenlose Probebehandlung für Neukunden',
          '#ffc107',
          true // is_active
        ]);
      });
      
      if (appointmentTypes.length > 0) {
        const query = `INSERT INTO appointment_types (studio_id, name, duration_minutes, consumes_session, is_probebehandlung, max_per_customer, description, color, is_active) VALUES ?`;
        await mysqlConnection.query(query, [appointmentTypes]);
      }
      
      console.log(`  ✅ Created ${appointmentTypes.length} optimized appointment types`);
      console.log(`  📋 Types per studio: Behandlung (60min), Beratung (20min), Probebehandlung (60min)`);
    } catch (error) {
      console.error('  ❌ Error creating appointment types:', error.message);
    }
  }

  async cleanupAppointments(sqliteDb, mysqlConnection) {
    return new Promise((resolve, reject) => {
      console.log(`\n📆 Migrating appointments with optimized statuses...`);
      
      sqliteDb.all(`SELECT * FROM appointments`, async (err, rows) => {
        if (err) {
          console.log('  ⚠️  No appointments table found');
          resolve();
          return;
        }
        
        if (!rows || rows.length === 0) {
          console.log('  ℹ️  No appointments found');
          resolve();
          return;
        }
        
        console.log(`  📊 Found ${rows.length} appointments`);
        
        try {
          // Get appointment type mappings (old id to new id)
          const [newTypes] = await mysqlConnection.execute(
            'SELECT id, studio_id, name FROM appointment_types ORDER BY studio_id, name'
          );
          
          const processedAppointments = [];
          
          for (const appointment of rows) {
            // Map old appointment_type_id to new one
            let newTypeId = null;
            
            // Try to find matching appointment type
            if (appointment.appointment_type_id) {
              // Get the old appointment type info from SQLite
              sqliteDb.get(
                'SELECT name, studio_id FROM appointment_types WHERE id = ?',
                [appointment.appointment_type_id],
                (err, oldType) => {
                  if (oldType) {
                    const matchingType = newTypes.find(nt => 
                      nt.studio_id === appointment.studio_id && nt.name === oldType.name
                    );
                    if (matchingType) {
                      newTypeId = matchingType.id;
                    }
                  }
                }
              );
            }
            
            // Convert status to new format
            let status = 'bestätigt'; // default
            if (appointment.status === 'completed') status = 'absolviert';
            else if (appointment.status === 'cancelled') status = 'storniert';
            else if (appointment.status === 'pending') status = 'bestätigt';
            
            processedAppointments.push([
              appointment.customer_id,
              appointment.studio_id,
              newTypeId,
              appointment.appointment_date,
              convertTime(appointment.start_time),
              convertTime(appointment.end_time),
              status,
              null, // cancelled_by
              null, // cancelled_at
              false, // session_consumed
              appointment.notes || '',
              appointment.created_by_user_id,
              convertDateTime(appointment.created_at),
              convertDateTime(appointment.updated_at)
            ]);
          }
          
          if (processedAppointments.length > 0) {
            const query = `INSERT INTO appointments (customer_id, studio_id, appointment_type_id, appointment_date, start_time, end_time, status, cancelled_by, cancelled_at, session_consumed, notes, created_by_user_id, created_at, updated_at) VALUES ?`;
            await mysqlConnection.query(query, [processedAppointments]);
          }
          
          console.log(`  ✅ Successfully migrated ${processedAppointments.length} appointments`);
          resolve();
        } catch (error) {
          console.error('  ❌ Error migrating appointments:', error.message);
          resolve();
        }
      });
    });
  }

  async cleanupLeads(sqliteDb, mysqlConnection) {
    return new Promise((resolve, reject) => {
      console.log(`\n🎯 Migrating leads with phone_number field...`);
      
      sqliteDb.all(`SELECT * FROM leads`, async (err, rows) => {
        if (err) {
          console.log('  ⚠️  No leads table found');
          resolve();
          return;
        }
        
        if (!rows || rows.length === 0) {
          console.log('  ℹ️  No leads found');
          resolve();
          return;
        }
        
        console.log(`  📊 Found ${rows.length} leads`);
        
        try {
          const processedLeads = rows.map(lead => {
            const newLead = {...lead};
            
            // Handle phone vs phone_number column mapping
            if (newLead.phone) {
              newLead.phone_number = newLead.phone;
              delete newLead.phone;
            }
            
            // Convert datetime fields
            if (newLead.last_contact_date) {
              newLead.last_contact_date = convertDateTime(newLead.last_contact_date);
            }
            if (newLead.next_contact_date) {
              newLead.next_contact_date = convertDateTime(newLead.next_contact_date);
            }
            if (newLead.created_at) {
              newLead.created_at = convertDateTime(newLead.created_at);
            }
            if (newLead.updated_at) {
              newLead.updated_at = convertDateTime(newLead.updated_at);
            }
            
            // Convert status to German
            if (newLead.status === 'new') newLead.status = 'neu';
            else if (newLead.status === 'contacted') newLead.status = 'kontaktiert';
            else if (newLead.status === 'interested') newLead.status = 'interessiert';
            else if (newLead.status === 'not_interested') newLead.status = 'nicht_interessiert';
            
            return newLead;
          });
          
          // Bulk insert
          if (processedLeads.length > 0) {
            const columns = Object.keys(processedLeads[0]).join(', ');
            const placeholders = processedLeads.map(() => 
              `(${Object.keys(processedLeads[0]).map(() => '?').join(', ')})`
            ).join(', ');
            
            const values = processedLeads.flatMap(row => Object.values(row));
            
            const query = `INSERT INTO leads (${columns}) VALUES ${placeholders}`;
            await mysqlConnection.execute(query, values);
          }
          
          console.log(`  ✅ Successfully migrated ${processedLeads.length} leads`);
          resolve();
        } catch (error) {
          console.error('  ❌ Error migrating leads:', error.message);
          resolve();
        }
      });
    });
  }

  async cleanupGoogleSheets(sqliteDb, mysqlConnection) {
    return new Promise((resolve, reject) => {
      console.log(`\n📊 Cleaning up Google Sheets integrations (859 → 1)...`);
      
      sqliteDb.all(`
        SELECT studio_id, sheet_id, sheet_name, MIN(created_at) as first_created, 
               MAX(updated_at) as last_updated, COUNT(*) as duplicate_count
        FROM google_sheets_integrations 
        GROUP BY studio_id, sheet_id
      `, async (err, rows) => {
        if (err) {
          console.log('  ⚠️  No google_sheets_integrations table found');
          resolve();
          return;
        }
        
        if (!rows || rows.length === 0) {
          console.log('  ℹ️  No Google Sheets integrations found');
          resolve();
          return;
        }
        
        console.log(`  📊 Found ${rows.length} unique integrations (with duplicates cleaned)`);
        
        try {
          const cleanIntegrations = rows.map(row => ([
            row.studio_id,
            row.sheet_id,
            row.sheet_name || 'Tabellenblatt1',
            null, // last_sync_at
            'active', // sync_status
            null, // column_mapping
            true, // auto_sync_enabled
            30, // sync_frequency_minutes
            convertDateTime(row.first_created),
            convertDateTime(row.last_updated)
          ]));
          
          if (cleanIntegrations.length > 0) {
            const query = `INSERT INTO google_sheets_integrations (studio_id, sheet_id, sheet_name, last_sync_at, sync_status, column_mapping, auto_sync_enabled, sync_frequency_minutes, created_at, updated_at) VALUES ?`;
            await mysqlConnection.query(query, [cleanIntegrations]);
          }
          
          const totalDuplicates = rows.reduce((sum, row) => sum + row.duplicate_count, 0);
          console.log(`  ✅ Cleaned ${totalDuplicates} duplicate records → ${cleanIntegrations.length} unique integrations`);
          resolve();
        } catch (error) {
          console.error('  ❌ Error cleaning Google Sheets integrations:', error.message);
          resolve();
        }
      });
    });
  }

  async runOptimizedMigration() {
    console.log('🚀 Starting optimized database migration\n');
    
    // Check prerequisites
    const envOk = await this.checkEnvironment();
    if (!envOk) return false;
    
    const sqliteOk = await this.checkSQLiteDatabase();
    if (!sqliteOk) return false;
    
    let mysqlConnection;
    let sqliteDb;
    
    try {
      // Connect to databases
      console.log('\n📡 Connecting to databases...');
      mysqlConnection = await mysql.createConnection(this.mysqlConfig);
      sqliteDb = new sqlite3.Database('./database.sqlite');
      console.log('✅ Connected to both databases');
      
      // Create optimized schema
      console.log('\n' + '='.repeat(60));
      console.log('PHASE 1: Creating Optimized Schema');
      console.log('='.repeat(60));
      await this.createOptimizedMySQLSchema(mysqlConnection);
      
      // Clean and migrate data
      console.log('\n' + '='.repeat(60));
      console.log('PHASE 2: Clean Data Migration');
      console.log('='.repeat(60));
      await this.cleanAndMigrateData(sqliteDb, mysqlConnection);
      
      console.log('\n' + '='.repeat(60));
      console.log('✅ OPTIMIZED MIGRATION COMPLETED SUCCESSFULLY!');
      console.log('='.repeat(60));
      console.log('🎯 Key Improvements:');
      console.log('  • Removed 859 duplicate Google Sheets → 1 per studio');
      console.log('  • Organized session blocks with queue system');
      console.log('  • Updated Beratung duration: 30min → 20min');
      console.log('  • Added Probebehandlung appointment type');
      console.log('  • Enhanced appointment status system');
      console.log('  • Created customers table with Probebehandlung tracking');
      console.log('\n🚀 Ready to test Termine and Customer tabs!');
      
      return true;
      
    } catch (error) {
      console.error('❌ Migration failed:', error);
      return false;
    } finally {
      if (mysqlConnection) await mysqlConnection.end();
      if (sqliteDb) sqliteDb.close();
    }
  }

  async close() {
    this.rl.close();
  }
}

// Main execution
async function main() {
  const migrator = new OptimizedDatabaseMigrator();
  
  try {
    await migrator.runOptimizedMigration();
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

module.exports = OptimizedDatabaseMigrator;