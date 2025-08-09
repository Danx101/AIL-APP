#!/usr/bin/env node

/**
 * Fix Future Appointments
 * Resets appointments that were incorrectly marked as completed
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

async function fixFutureAppointments() {
    let connection;
    
    try {
        // Create connection
        connection = await mysql.createConnection(dbConfig);
        console.log('✅ Connected to MySQL database');
        
        // Find appointments that are completed but shouldn't be
        console.log('\n📋 Finding incorrectly completed appointments...');
        
        const [incorrectlyCompleted] = await connection.execute(
            `SELECT id, appointment_date, start_time, end_time, status 
             FROM appointments 
             WHERE status = 'completed' 
               AND CONCAT(appointment_date, ' ', end_time) > NOW()
             ORDER BY appointment_date, start_time`
        );
        
        if (incorrectlyCompleted.length > 0) {
            console.log(`Found ${incorrectlyCompleted.length} appointments incorrectly marked as completed:`);
            
            incorrectlyCompleted.forEach(apt => {
                console.log(`  - ID ${apt.id}: ${apt.appointment_date} ${apt.start_time}-${apt.end_time}`);
            });
            
            // Reset them to confirmed
            console.log('\n🔧 Resetting to confirmed status...');
            
            const [result] = await connection.execute(
                `UPDATE appointments 
                 SET status = 'confirmed' 
                 WHERE status = 'completed' 
                   AND CONCAT(appointment_date, ' ', end_time) > NOW()`
            );
            
            console.log(`✅ Reset ${result.affectedRows} appointments to 'confirmed'`);
        } else {
            console.log('✅ No incorrectly completed appointments found');
        }
        
        // Check current status distribution
        console.log('\n📊 Current appointment status for today:');
        
        const [todayAppointments] = await connection.execute(
            `SELECT id, start_time, end_time, status,
                    CASE 
                        WHEN CONCAT(appointment_date, ' ', end_time) < NOW() THEN 'past'
                        WHEN CONCAT(appointment_date, ' ', start_time) > NOW() THEN 'future'
                        ELSE 'current'
                    END as time_status
             FROM appointments 
             WHERE appointment_date = CURDATE()
             ORDER BY start_time`
        );
        
        todayAppointments.forEach(apt => {
            console.log(`  ID ${apt.id}: ${apt.start_time}-${apt.end_time} [${apt.time_status}] status=${apt.status}`);
        });
        
        console.log('\n✅ All appointments fixed!');
        
    } catch (error) {
        console.error('❌ Error:', error.message);
    } finally {
        if (connection) {
            await connection.end();
            console.log('\n🔌 Database connection closed');
        }
    }
}

// Run the fix
console.log('🔧 Fixing Future Appointments...');
console.log('================================\n');

fixFutureAppointments().catch(console.error);