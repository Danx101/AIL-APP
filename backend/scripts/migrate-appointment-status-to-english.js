#!/usr/bin/env node

/**
 * Migrate Appointment Status Column to English
 * Changes the ENUM values from German to English
 */

const mysql = require('mysql2/promise');
require('dotenv').config();

// Database configuration
const dbConfig = {
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 3306,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'railway'
};

async function migrateStatusColumn() {
    let connection;
    
    try {
        // Create connection
        connection = await mysql.createConnection(dbConfig);
        console.log('✅ Connected to MySQL database');
        
        // Step 1: Add a temporary column with the new ENUM values
        console.log('\n📋 Step 1: Adding temporary status column with English values...');
        
        await connection.execute(`
            ALTER TABLE appointments 
            ADD COLUMN status_new ENUM('pending', 'scheduled', 'confirmed', 'cancelled', 'completed', 'no_show') 
            DEFAULT 'confirmed' 
            AFTER status
        `);
        
        console.log('✅ Temporary column added');
        
        // Step 2: Map German values to English in the new column
        console.log('\n📋 Step 2: Migrating status values from German to English...');
        
        const mappings = [
            ['bestätigt', 'confirmed'],
            ['absolviert', 'completed'],
            ['abgeschlossen', 'completed'],
            ['nicht_erschienen', 'no_show'],
            ['nicht erschienen', 'no_show'],
            ['storniert', 'cancelled'],
            ['abgesagt', 'cancelled']
        ];
        
        for (const [german, english] of mappings) {
            const [result] = await connection.execute(
                `UPDATE appointments 
                 SET status_new = ? 
                 WHERE status = ?`,
                [english, german]
            );
            
            if (result.affectedRows > 0) {
                console.log(`  ✅ Migrated ${result.affectedRows} rows: "${german}" → "${english}"`);
            }
        }
        
        // Handle any NULL statuses
        const [nullResult] = await connection.execute(
            `UPDATE appointments 
             SET status_new = 'confirmed' 
             WHERE status IS NULL OR status_new IS NULL`
        );
        
        if (nullResult.affectedRows > 0) {
            console.log(`  ✅ Set ${nullResult.affectedRows} NULL statuses to 'confirmed'`);
        }
        
        // Step 3: Drop the old column and rename the new one
        console.log('\n📋 Step 3: Replacing old status column...');
        
        await connection.execute(`ALTER TABLE appointments DROP COLUMN status`);
        console.log('  ✅ Dropped old status column');
        
        await connection.execute(`ALTER TABLE appointments CHANGE COLUMN status_new status ENUM('pending', 'scheduled', 'confirmed', 'cancelled', 'completed', 'no_show') DEFAULT 'confirmed'`);
        console.log('  ✅ Renamed new column to status');
        
        // Step 4: Verify the migration
        console.log('\n📋 Step 4: Verifying migration...');
        
        const [statusCount] = await connection.execute(
            `SELECT status, COUNT(*) as count 
             FROM appointments 
             GROUP BY status
             ORDER BY count DESC`
        );
        
        console.log('\nFinal status distribution:');
        statusCount.forEach(row => {
            console.log(`  - ${row.status}: ${row.count} appointments`);
        });
        
        // Check column definition
        const [columns] = await connection.execute(
            `SHOW COLUMNS FROM appointments WHERE Field = 'status'`
        );
        
        if (columns.length > 0) {
            const statusColumn = columns[0];
            console.log('\nNew status column definition:');
            console.log(`  Type: ${statusColumn.Type}`);
            console.log(`  Default: ${statusColumn.Default}`);
        }
        
        // Step 5: Auto-update past appointments
        console.log('\n📋 Step 5: Auto-updating past appointments...');
        
        const now = new Date();
        const currentDateTime = now.toISOString().slice(0, 19).replace('T', ' ');
        
        const [updateResult] = await connection.execute(
            `UPDATE appointments 
             SET status = 'completed' 
             WHERE CONCAT(appointment_date, ' ', end_time) < ? 
               AND status = 'confirmed'`,
            [currentDateTime]
        );
        
        if (updateResult.affectedRows > 0) {
            console.log(`  ✅ Auto-updated ${updateResult.affectedRows} past appointments to 'completed'`);
        } else {
            console.log('  ℹ️ No appointments needed auto-updating');
        }
        
        console.log('\n✅ Migration completed successfully!');
        console.log('   All appointment statuses are now in English.');
        
    } catch (error) {
        console.error('\n❌ Migration failed:', error.message);
        console.error('\nAttempting rollback...');
        
        // Try to rollback if something went wrong
        if (connection) {
            try {
                // Check if temporary column exists
                const [columns] = await connection.execute(
                    `SHOW COLUMNS FROM appointments WHERE Field = 'status_new'`
                );
                
                if (columns.length > 0) {
                    await connection.execute(`ALTER TABLE appointments DROP COLUMN status_new`);
                    console.log('✅ Rolled back temporary column');
                }
            } catch (rollbackError) {
                console.error('❌ Rollback failed:', rollbackError.message);
            }
        }
        
        throw error;
        
    } finally {
        if (connection) {
            await connection.end();
            console.log('\n🔌 Database connection closed');
        }
    }
}

// Run the migration
console.log('🔄 Starting Appointment Status Migration to English...');
console.log('====================================================\n');

migrateStatusColumn().catch(console.error);