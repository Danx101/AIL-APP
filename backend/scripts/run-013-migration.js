#!/usr/bin/env node

/**
 * Migration 013 Runner - Fix appointments customer reference
 * 
 * This script runs the critical migration to fix appointments table
 * to properly reference customers instead of users.
 */

const fs = require('fs');
const path = require('path');
const db = require('../src/database/database-wrapper');

async function runMigration() {
  console.log('🚀 Starting Migration 013: Appointments Customer Reference Fix');
  console.log('⚠️  This migration fixes critical database issues for appointments');
  
  try {
    // Read the migration file
    const migrationPath = path.join(__dirname, '../migrations/013_appointments_customer_reference_fix.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
    
    // Split SQL statements (basic splitting on semicolon + newline)
    const statements = migrationSQL
      .split(';\n')
      .map(stmt => stmt.trim())
      .filter(stmt => stmt && !stmt.startsWith('--') && !stmt.startsWith('/*'));
    
    console.log(`📄 Found ${statements.length} SQL statements to execute`);
    
    // Execute each statement
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];
      
      if (!statement || statement.length < 5) continue;
      
      console.log(`⚡ Executing statement ${i + 1}/${statements.length}`);
      
      try {
        // Handle different types of statements
        if (statement.toLowerCase().includes('select')) {
          const result = await db.all(statement);
          if (result && result.length > 0) {
            console.log(`📊 Query result:`, result);
          }
        } else {
          const result = await db.run(statement);
          console.log(`✅ Statement executed successfully`);
          if (result.changes) {
            console.log(`   → Affected rows: ${result.changes}`);
          }
        }
      } catch (statementError) {
        console.error(`❌ Error in statement ${i + 1}:`, statementError.message);
        console.error(`   Statement: ${statement.substring(0, 100)}...`);
        
        // Some errors are expected (like if column already exists)
        if (statementError.message.includes('duplicate column name') || 
            statementError.message.includes('already exists')) {
          console.log(`   ⚠️  Continuing (expected error)`);
          continue;
        }
        
        throw statementError;
      }
    }
    
    // Final verification
    console.log('\n🔍 Running post-migration verification...');
    
    const verificationQueries = [
      {
        name: 'Check new columns exist',
        query: 'PRAGMA table_info(appointments)'
      },
      {
        name: 'Count migrated appointments',
        query: `SELECT 
          COUNT(*) as total_customer_appointments,
          SUM(CASE WHEN customer_ref_id IS NOT NULL THEN 1 ELSE 0 END) as successfully_migrated,
          SUM(CASE WHEN customer_ref_id IS NULL THEN 1 ELSE 0 END) as needs_manual_fix
        FROM appointments 
        WHERE person_type = 'customer'`
      }
    ];
    
    for (const verification of verificationQueries) {
      console.log(`\n📋 ${verification.name}:`);
      const result = await db.all(verification.query);
      console.table(result);
    }
    
    console.log('\n✅ Migration 013 completed successfully!');
    console.log('\n📌 Next steps:');
    console.log('   1. Update appointment API queries to use customer_ref_id');
    console.log('   2. Test appointment creation and display');
    console.log('   3. Verify session consumption tracking');
    
  } catch (error) {
    console.error('\n❌ Migration failed:', error);
    console.error('\n🔄 Rolling back changes...');
    
    // Attempt basic rollback
    try {
      await db.run('ALTER TABLE appointments DROP COLUMN customer_ref_id');
      await db.run('ALTER TABLE appointments DROP COLUMN session_block_id'); 
      await db.run('ALTER TABLE appointments DROP COLUMN sessions_consumed_count');
      console.log('✅ Rollback completed');
    } catch (rollbackError) {
      console.error('❌ Rollback failed:', rollbackError.message);
      console.error('⚠️  Database may be in inconsistent state - manual intervention required');
    }
    
    throw error;
  }
}

// Run the migration if this script is called directly
if (require.main === module) {
  runMigration()
    .then(() => {
      console.log('\n🎉 Migration process completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n💥 Migration process failed:', error);
      process.exit(1);
    });
}

module.exports = { runMigration };