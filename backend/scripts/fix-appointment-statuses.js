#!/usr/bin/env node

/**
 * Fix Appointment Statuses
 * Converts all German statuses to English in the appointments table
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

async function fixAppointmentStatuses() {
    let connection;
    
    try {
        // Create connection
        connection = await mysql.createConnection(dbConfig);
        console.log('✅ Connected to MySQL database');
        
        // First, check what statuses we have
        console.log('\n📋 Checking current appointment statuses...');
        
        const [statusCount] = await connection.execute(
            `SELECT status, COUNT(*) as count 
             FROM appointments 
             GROUP BY status`
        );
        
        console.log('Current status distribution:');
        statusCount.forEach(row => {
            console.log(`  - ${row.status}: ${row.count} appointments`);
        });
        
        // Map German statuses to English
        const statusMap = {
            'bestätigt': 'confirmed',
            'abgesagt': 'cancelled',
            'abgeschlossen': 'completed',
            'nicht erschienen': 'no_show',
            'storniert': 'cancelled',
            'absolviert': 'completed'
        };
        
        // Fix each German status
        console.log('\n🔧 Fixing German statuses...');
        
        for (const [germanStatus, englishStatus] of Object.entries(statusMap)) {
            const [result] = await connection.execute(
                `UPDATE appointments 
                 SET status = ? 
                 WHERE status = ?`,
                [englishStatus, germanStatus]
            );
            
            if (result.affectedRows > 0) {
                console.log(`  ✅ Updated ${result.affectedRows} appointments from "${germanStatus}" to "${englishStatus}"`);
            }
        }
        
        // Check the results
        console.log('\n📋 Checking updated status distribution...');
        
        const [newStatusCount] = await connection.execute(
            `SELECT status, COUNT(*) as count 
             FROM appointments 
             GROUP BY status`
        );
        
        console.log('New status distribution:');
        newStatusCount.forEach(row => {
            console.log(`  - ${row.status}: ${row.count} appointments`);
        });
        
        // Check for any remaining non-English statuses
        const validEnglishStatuses = ['pending', 'scheduled', 'confirmed', 'cancelled', 'completed', 'no_show'];
        const [invalidStatuses] = await connection.execute(
            `SELECT DISTINCT status 
             FROM appointments 
             WHERE status NOT IN (${validEnglishStatuses.map(() => '?').join(',')})`,
            validEnglishStatuses
        );
        
        if (invalidStatuses.length > 0) {
            console.log('\n⚠️ Warning: Found non-standard statuses:');
            invalidStatuses.forEach(row => {
                console.log(`  - ${row.status}`);
            });
        } else {
            console.log('\n✅ All appointment statuses are now in English!');
        }
        
        // Now run the auto-update for past appointments
        console.log('\n🔄 Running auto-update for past appointments...');
        
        const now = new Date();
        const currentDateTime = now.toISOString().slice(0, 19).replace('T', ' ');
        
        const [updateResult] = await connection.execute(
            `UPDATE appointments 
             SET status = 'completed', updated_at = NOW() 
             WHERE CONCAT(appointment_date, ' ', end_time) < ? 
               AND status = 'confirmed'`,
            [currentDateTime]
        );
        
        if (updateResult.affectedRows > 0) {
            console.log(`  ✅ Auto-updated ${updateResult.affectedRows} past appointments to 'completed'`);
        } else {
            console.log('  ℹ️ No appointments needed auto-updating');
        }
        
        console.log('\n✅ All appointment statuses have been fixed!');
        
    } catch (error) {
        console.error('❌ Error:', error.message);
        console.error(error);
    } finally {
        if (connection) {
            await connection.end();
            console.log('\n🔌 Database connection closed');
        }
    }
}

// Run the fix
console.log('🔧 Starting Appointment Status Fix...');
console.log('=====================================\n');

fixAppointmentStatuses().catch(console.error);