#!/usr/bin/env node

/**
 * Simple Migration 013 Runner
 */

const fs = require('fs');
const path = require('path');
const db = require('../src/database/database-wrapper');

async function runSimpleMigration() {
  console.log('🚀 Starting Simple Migration 013: Appointments Customer Reference Fix');
  
  try {
    // First, check current table structure
    console.log('📋 Checking current appointments table structure...');
    const columns = await db.all("SHOW COLUMNS FROM appointments");
    console.table(columns);
    
    const hasCustomerRefId = columns.some(col => col.Field === 'customer_ref_id');
    const hasSessionBlockId = columns.some(col => col.Field === 'session_block_id');
    const hasSessionsConsumedCount = columns.some(col => col.Field === 'sessions_consumed_count');
    
    console.log(`📊 Migration status check:`);
    console.log(`   customer_ref_id: ${hasCustomerRefId ? '✅ EXISTS' : '❌ MISSING'}`);
    console.log(`   session_block_id: ${hasSessionBlockId ? '✅ EXISTS' : '❌ MISSING'}`);
    console.log(`   sessions_consumed_count: ${hasSessionsConsumedCount ? '✅ EXISTS' : '❌ MISSING'}`);
    
    if (hasCustomerRefId && hasSessionBlockId && hasSessionsConsumedCount) {
      console.log('✅ Migration appears to already be completed!');
      
      // Still run verification
      console.log('\n🔍 Running verification queries...');
      
      const totalAppointments = await db.get('SELECT COUNT(*) as count FROM appointments');
      console.log(`📊 Total appointments: ${totalAppointments.count}`);
      
      if (totalAppointments.count > 0) {
        const customerAppointments = await db.get(`
          SELECT 
            COUNT(*) as total_customer_appointments,
            SUM(CASE WHEN customer_ref_id IS NOT NULL THEN 1 ELSE 0 END) as with_customer_ref,
            SUM(CASE WHEN person_type = 'customer' THEN 1 ELSE 0 END) as customer_type_count
          FROM appointments 
          WHERE person_type = 'customer' OR customer_id IS NOT NULL
        `);
        console.table(customerAppointments);
      }
      
      return;
    }
    
    console.log('\n⚡ Adding missing columns...');
    
    // Add columns one by one with error handling
    if (!hasCustomerRefId) {
      try {
        await db.run('ALTER TABLE appointments ADD COLUMN customer_ref_id INT AFTER customer_id');
        console.log('✅ Added customer_ref_id column');
      } catch (error) {
        if (error.message.includes('duplicate column name')) {
          console.log('⚠️  customer_ref_id column already exists');
        } else {
          throw error;
        }
      }
    }
    
    if (!hasSessionBlockId) {
      try {
        await db.run('ALTER TABLE appointments ADD COLUMN session_block_id INT AFTER person_type');
        console.log('✅ Added session_block_id column');
      } catch (error) {
        if (error.message.includes('duplicate column name')) {
          console.log('⚠️  session_block_id column already exists');
        } else {
          throw error;
        }
      }
    }
    
    if (!hasSessionsConsumedCount) {
      try {
        await db.run('ALTER TABLE appointments ADD COLUMN sessions_consumed_count INT DEFAULT 1 AFTER session_consumed');
        console.log('✅ Added sessions_consumed_count column');
      } catch (error) {
        if (error.message.includes('duplicate column name')) {
          console.log('⚠️  sessions_consumed_count column already exists');
        } else {
          throw error;
        }
      }
    }
    
    console.log('\n📊 Creating performance indexes...');
    
    const indexes = [
      { name: 'idx_appointment_customer_ref', sql: 'CREATE INDEX idx_appointment_customer_ref ON appointments(customer_ref_id)' },
      { name: 'idx_appointment_session_block', sql: 'CREATE INDEX idx_appointment_session_block ON appointments(session_block_id)' },
      { name: 'idx_appointment_timeslot', sql: 'CREATE INDEX idx_appointment_timeslot ON appointments(studio_id, appointment_date, start_time, end_time, status)' },
      { name: 'idx_appointment_studio_date', sql: 'CREATE INDEX idx_appointment_studio_date ON appointments(studio_id, appointment_date)' }
    ];
    
    for (const index of indexes) {
      try {
        await db.run(index.sql);
        console.log(`✅ Created index: ${index.name}`);
      } catch (error) {
        if (error.message.includes('already exists') || error.message.includes('Duplicate key name')) {
          console.log(`⚠️  Index ${index.name} already exists`);
        } else {
          console.log(`⚠️  Could not create index ${index.name}: ${error.message}`);
        }
      }
    }
    
    console.log('\n🔍 Post-migration verification...');
    
    // Check final table structure
    const finalColumns = await db.all("SHOW COLUMNS FROM appointments");
    console.log('\n📋 Final appointments table structure:');
    console.table(finalColumns.map(col => ({ 
      Field: col.Field, 
      Type: col.Type, 
      Null: col.Null,
      Key: col.Key,
      Default: col.Default 
    })));
    
    // Check appointment counts
    const counts = await db.get(`
      SELECT 
        COUNT(*) as total_appointments,
        SUM(CASE WHEN person_type = 'customer' THEN 1 ELSE 0 END) as customer_appointments,
        SUM(CASE WHEN person_type = 'lead' THEN 1 ELSE 0 END) as lead_appointments
      FROM appointments
    `);
    
    console.log('\n📊 Appointment counts by type:');
    console.table(counts);
    
    console.log('\n✅ Simple Migration 013 completed successfully!');
    console.log('\n📌 Next steps:');
    console.log('   1. Appointments API now supports customer_ref_id field');
    console.log('   2. Session tracking is ready via session_block_id');
    console.log('   3. Test appointment creation with new fields');
    
  } catch (error) {
    console.error('\n❌ Simple migration failed:', error);
    throw error;
  }
}

// Run the migration if this script is called directly
if (require.main === module) {
  runSimpleMigration()
    .then(() => {
      console.log('\n🎉 Simple migration process completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n💥 Simple migration process failed:', error);
      process.exit(1);
    });
}

module.exports = { runSimpleMigration };