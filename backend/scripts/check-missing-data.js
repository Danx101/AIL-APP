#!/usr/bin/env node

const sqlite3 = require('sqlite3').verbose();
const mysql = require('mysql2/promise');
const path = require('path');

// Load environment variables
require('dotenv').config({ path: path.join(__dirname, '../.env') });

async function checkMissingData() {
  console.log('🔍 Checking for missing appointment data...\n');

  // SQLite connection
  const sqliteDbPath = path.join(__dirname, '../database.sqlite');
  const sqlite = new sqlite3.Database(sqliteDbPath);

  // MySQL connection
  const mysqlConfig = {
    host: process.env.DB_HOST || process.env.MYSQLHOST || 'hopper.proxy.rlwy.net',
    port: process.env.DB_PORT || process.env.MYSQLPORT || 34671,
    user: process.env.DB_USER || process.env.MYSQLUSER || 'root',
    password: process.env.DB_PASSWORD || process.env.MYSQLPASSWORD || 'bbr1hm1gPbZdyKSrAeRepjooYRiSayER',
    database: process.env.DB_NAME || process.env.MYSQLDATABASE || 'railway',
    ssl: { rejectUnauthorized: false }
  };

  const mysql2 = await mysql.createConnection(mysqlConfig);

  try {
    // Check appointment_types
    console.log('📊 Appointment Types:');
    const sqliteTypes = await new Promise((resolve, reject) => {
      sqlite.all('SELECT * FROM appointment_types WHERE studio_id IN (1, 3)', (err, rows) => {
        if (err) reject(err);
        else resolve(rows || []);
      });
    });
    
    const [mysqlTypes] = await mysql2.execute('SELECT * FROM appointment_types WHERE studio_id = 3');
    
    console.log(`  SQLite: ${sqliteTypes.length} appointment types`);
    console.log(`  MySQL: ${mysqlTypes.length} appointment types`);
    
    if (sqliteTypes.length > 0) {
      console.log('  SQLite appointment types:');
      sqliteTypes.forEach(t => {
        console.log(`    - ${t.name} (${t.duration_minutes} min, ${t.session_credits} credits)`);
      });
    }

    // Check session_blocks
    console.log('\n📊 Session Blocks:');
    const sqliteBlocks = await new Promise((resolve, reject) => {
      sqlite.all('SELECT * FROM session_blocks WHERE studio_id IN (1, 3)', (err, rows) => {
        if (err) reject(err);
        else resolve(rows || []);
      });
    });
    
    const [mysqlBlocks] = await mysql2.execute('SELECT * FROM session_blocks WHERE studio_id = 3');
    
    console.log(`  SQLite: ${sqliteBlocks.length} session blocks`);
    console.log(`  MySQL: ${mysqlBlocks.length} session blocks`);

    // Check customer_sessions
    console.log('\n📊 Customer Sessions:');
    const sqliteSessions = await new Promise((resolve, reject) => {
      sqlite.all('SELECT * FROM customer_sessions WHERE studio_id IN (1, 3)', (err, rows) => {
        if (err) reject(err);
        else resolve(rows || []);
      });
    });
    
    const [mysqlSessions] = await mysql2.execute('SELECT * FROM customer_sessions WHERE studio_id = 3');
    
    console.log(`  SQLite: ${sqliteSessions.length} customer sessions`);
    console.log(`  MySQL: ${mysqlSessions.length} customer sessions`);

    // Check appointments
    console.log('\n📊 Appointments:');
    const sqliteAppointments = await new Promise((resolve, reject) => {
      sqlite.all('SELECT * FROM appointments WHERE studio_id IN (1, 3)', (err, rows) => {
        if (err) reject(err);
        else resolve(rows || []);
      });
    });
    
    const [mysqlAppointments] = await mysql2.execute('SELECT * FROM appointments WHERE studio_id = 3');
    
    console.log(`  SQLite: ${sqliteAppointments.length} appointments`);
    console.log(`  MySQL: ${mysqlAppointments.length} appointments`);

    // Check leads
    console.log('\n📊 Leads:');
    const sqliteLeads = await new Promise((resolve, reject) => {
      sqlite.all('SELECT * FROM leads WHERE studio_id IN (1, 3)', (err, rows) => {
        if (err) reject(err);
        else resolve(rows || []);
      });
    });
    
    const [mysqlLeads] = await mysql2.execute('SELECT * FROM leads WHERE studio_id = 3');
    
    console.log(`  SQLite: ${sqliteLeads.length} leads`);
    console.log(`  MySQL: ${mysqlLeads.length} leads`);

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    sqlite.close();
    await mysql2.end();
  }
}

checkMissingData();