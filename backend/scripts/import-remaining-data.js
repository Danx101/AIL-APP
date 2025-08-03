#!/usr/bin/env node

const mysql = require('mysql2/promise');
const sqlite3 = require('sqlite3');
const { promisify } = require('util');

async function importRemainingData() {
  console.log('🚀 Importing remaining data to Railway MySQL...\n');

  const mysqlConfig = {
    host: process.env.DB_HOST || process.env.MYSQLHOST || process.env.MYSQL_HOST,
    port: process.env.DB_PORT || process.env.MYSQLPORT || process.env.MYSQL_PORT || 3306,
    user: process.env.DB_USER || process.env.MYSQLUSER || process.env.MYSQL_USER,
    password: process.env.DB_PASSWORD || process.env.MYSQLPASSWORD || process.env.MYSQL_PASSWORD,
    database: process.env.DB_NAME || process.env.MYSQLDATABASE || process.env.MYSQL_DATABASE,
    ssl: { rejectUnauthorized: false }
  };

  try {
    // Connect to MySQL
    const connection = await mysql.createConnection(mysqlConfig);
    console.log('✅ Connected to Railway MySQL');

    // Connect to SQLite
    const sqliteDb = new sqlite3.Database('./database.sqlite');
    const sqliteAll = promisify(sqliteDb.all.bind(sqliteDb));
    console.log('✅ Connected to SQLite\n');

    // Import appointments (fixing time format)
    console.log('📤 Importing appointments...');
    const appointments = await sqliteAll('SELECT * FROM appointments');
    console.log(`   Found ${appointments.length} appointments in SQLite`);
    
    let appointmentCount = 0;
    for (const apt of appointments) {
      try {
        // Fix time format: add seconds if missing
        const startTime = apt.start_time.includes(':') && apt.start_time.split(':').length === 2 
          ? `${apt.start_time}:00` 
          : apt.start_time;
        const endTime = apt.end_time.includes(':') && apt.end_time.split(':').length === 2 
          ? `${apt.end_time}:00` 
          : apt.end_time;

        await connection.execute(`
          INSERT INTO appointments (
            id, studio_id, customer_id, appointment_type_id, appointment_date,
            start_time, end_time, status, notes, created_by_user_id, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON DUPLICATE KEY UPDATE
            studio_id = VALUES(studio_id),
            customer_id = VALUES(customer_id),
            appointment_type_id = VALUES(appointment_type_id),
            appointment_date = VALUES(appointment_date),
            start_time = VALUES(start_time),
            end_time = VALUES(end_time),
            status = VALUES(status),
            notes = VALUES(notes)
        `, [
          apt.id, apt.studio_id, apt.customer_id, apt.appointment_type_id,
          apt.appointment_date, startTime, endTime, apt.status, apt.notes,
          apt.created_by_user_id, apt.created_at, apt.updated_at
        ]);
        appointmentCount++;
      } catch (err) {
        console.log(`   ❌ Failed appointment ${apt.id}: ${err.message}`);
      }
    }
    console.log(`   ✓ Imported ${appointmentCount} appointments`);

    // Import customer_sessions
    console.log('\n📤 Importing customer sessions...');
    try {
      const sessions = await sqliteAll('SELECT * FROM customer_sessions');
      console.log(`   Found ${sessions.length} sessions in SQLite`);
      
      let sessionCount = 0;
      for (const session of sessions) {
        try {
          // Fix time format
          const startTime = session.start_time && session.start_time.includes(':') && session.start_time.split(':').length === 2 
            ? `${session.start_time}:00` 
            : session.start_time;
          const endTime = session.end_time && session.end_time.includes(':') && session.end_time.split(':').length === 2 
            ? `${session.end_time}:00` 
            : session.end_time;

          await connection.execute(`
            INSERT INTO customer_sessions (
              id, customer_id, studio_id, appointment_id, session_date,
              start_time, end_time, status, notes, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON DUPLICATE KEY UPDATE
              status = VALUES(status),
              notes = VALUES(notes)
          `, [
            session.id, session.customer_id, session.studio_id, session.appointment_id,
            session.session_date, startTime, endTime, session.status, session.notes,
            session.created_at, session.updated_at
          ]);
          sessionCount++;
        } catch (err) {
          console.log(`   ❌ Failed session ${session.id}: ${err.message}`);
        }
      }
      console.log(`   ✓ Imported ${sessionCount} customer sessions`);
    } catch (err) {
      console.log(`   ⚠️  customer_sessions table might not exist in SQLite`);
    }

    // Import session_blocks
    console.log('\n📤 Importing session blocks...');
    try {
      const blocks = await sqliteAll('SELECT * FROM session_blocks');
      console.log(`   Found ${blocks.length} session blocks in SQLite`);
      
      for (const block of blocks) {
        await connection.execute(`
          INSERT INTO session_blocks (
            id, customer_id, studio_id, package_type, total_sessions,
            used_sessions, remaining_sessions, purchase_date, expiry_date,
            is_active, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON DUPLICATE KEY UPDATE
            used_sessions = VALUES(used_sessions),
            remaining_sessions = VALUES(remaining_sessions),
            is_active = VALUES(is_active)
        `, [
          block.id, block.customer_id, block.studio_id, block.package_type,
          block.total_sessions, block.used_sessions, block.remaining_sessions,
          block.purchase_date, block.expiry_date, block.is_active,
          block.created_at, block.updated_at
        ]);
      }
      console.log(`   ✓ Imported ${blocks.length} session blocks`);
    } catch (err) {
      console.log(`   ⚠️  session_blocks table might not exist in SQLite`);
    }

    // Import session_transactions
    console.log('\n📤 Importing session transactions...');
    try {
      const transactions = await sqliteAll('SELECT * FROM session_transactions');
      console.log(`   Found ${transactions.length} transactions in SQLite`);
      
      for (const trans of transactions) {
        await connection.execute(`
          INSERT INTO session_transactions (
            id, customer_id, studio_id, session_block_id, transaction_type,
            sessions_count, reason, created_by_user_id, created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON DUPLICATE KEY UPDATE
            transaction_type = VALUES(transaction_type),
            sessions_count = VALUES(sessions_count)
        `, [
          trans.id, trans.customer_id, trans.studio_id, trans.session_block_id,
          trans.transaction_type, trans.sessions_count, trans.reason,
          trans.created_by_user_id, trans.created_at
        ]);
      }
      console.log(`   ✓ Imported ${transactions.length} session transactions`);
    } catch (err) {
      console.log(`   ⚠️  session_transactions table might not exist in SQLite`);
    }

    // Verify final counts
    console.log('\n📊 Final verification...');
    const tables = ['appointments', 'customer_sessions', 'session_blocks', 'session_transactions'];
    
    for (const table of tables) {
      const [result] = await connection.execute(`SELECT COUNT(*) as count FROM ${table}`);
      console.log(`   ${table}: ${result[0].count} records`);
    }

    sqliteDb.close();
    await connection.end();
    console.log('\n🎉 Import completed!');

  } catch (error) {
    console.error('\n❌ Import failed:', error.message);
    process.exit(1);
  }
}

// Check if running through Railway
if (!process.env.RAILWAY_ENVIRONMENT && !process.env.DB_HOST) {
  console.error('❌ This script must be run through Railway CLI:');
  console.error('   railway run node scripts/import-remaining-data.js');
  process.exit(1);
}

importRemainingData();