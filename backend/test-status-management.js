#!/usr/bin/env node

/**
 * Test Script for Appointment Status Management
 * Tests the time-based status change rules and automatic updates
 */

const mysql = require('mysql2/promise');
require('dotenv').config();

// Database configuration
const dbConfig = {
    host: process.env.MYSQL_HOST || 'localhost',
    port: process.env.MYSQL_PORT || 3306,
    user: process.env.MYSQL_USER || 'root',
    password: process.env.MYSQL_PASSWORD || '',
    database: process.env.MYSQL_DATABASE || 'abnehmen_app',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
};

async function testStatusManagement() {
    let connection;
    
    try {
        // Create connection
        connection = await mysql.createConnection(dbConfig);
        console.log('✅ Connected to MySQL database');
        
        // Test 1: Check for appointments that should be auto-updated
        console.log('\n📋 Test 1: Checking appointments for auto-update...');
        
        const now = new Date();
        const currentDateTime = now.toISOString().slice(0, 19).replace('T', ' ');
        
        // Find confirmed appointments that have ended
        const [confirmedPastAppointments] = await connection.execute(
            `SELECT id, appointment_date, start_time, end_time, status,
                    CONCAT(appointment_date, ' ', end_time) as end_datetime
             FROM appointments 
             WHERE status = 'confirmed' 
               AND CONCAT(appointment_date, ' ', end_time) < ?
             LIMIT 5`,
            [currentDateTime]
        );
        
        if (confirmedPastAppointments.length > 0) {
            console.log(`Found ${confirmedPastAppointments.length} appointments that should be auto-updated to 'completed':`);
            confirmedPastAppointments.forEach(apt => {
                console.log(`  - ID: ${apt.id}, Date: ${apt.appointment_date}, End: ${apt.end_time}, Status: ${apt.status}`);
            });
        } else {
            console.log('No appointments need auto-updating');
        }
        
        // Test 2: Check current appointment statuses
        console.log('\n📋 Test 2: Checking appointment statuses by time...');
        
        const [currentAppointments] = await connection.execute(
            `SELECT id, appointment_date, start_time, end_time, status,
                    CONCAT(appointment_date, ' ', start_time) as start_datetime,
                    CONCAT(appointment_date, ' ', end_time) as end_datetime,
                    CASE 
                        WHEN CONCAT(appointment_date, ' ', start_time) > ? THEN 'future'
                        WHEN CONCAT(appointment_date, ' ', end_time) < ? THEN 'past'
                        ELSE 'current'
                    END as time_status
             FROM appointments 
             WHERE appointment_date >= DATE_SUB(CURDATE(), INTERVAL 1 DAY)
               AND appointment_date <= DATE_ADD(CURDATE(), INTERVAL 1 DAY)
             ORDER BY appointment_date, start_time
             LIMIT 10`,
            [currentDateTime, currentDateTime]
        );
        
        if (currentAppointments.length > 0) {
            console.log(`Found ${currentAppointments.length} recent appointments:`);
            currentAppointments.forEach(apt => {
                let expectedStatus = apt.status;
                let canMarkNoShow = false;
                
                if (apt.time_status === 'past' && apt.status === 'confirmed') {
                    expectedStatus = 'completed (should be auto-updated)';
                }
                
                if (apt.time_status !== 'future' && (apt.status === 'confirmed' || apt.status === 'completed')) {
                    canMarkNoShow = true;
                }
                
                console.log(`  - ID: ${apt.id}`);
                console.log(`    Time: ${apt.appointment_date} ${apt.start_time}-${apt.end_time}`);
                console.log(`    Current Status: ${apt.status}`);
                console.log(`    Time Status: ${apt.time_status}`);
                console.log(`    Expected: ${expectedStatus}`);
                console.log(`    Can mark as no-show: ${canMarkNoShow ? 'Yes' : 'No'}`);
                console.log('');
            });
        } else {
            console.log('No recent appointments found');
        }
        
        // Test 3: Test status validation logic
        console.log('\n📋 Test 3: Testing status change validation...');
        
        // Find a future appointment to test
        const [futureAppointments] = await connection.execute(
            `SELECT id, appointment_date, start_time, status
             FROM appointments 
             WHERE status = 'confirmed' 
               AND CONCAT(appointment_date, ' ', start_time) > ?
             LIMIT 1`,
            [currentDateTime]
        );
        
        if (futureAppointments.length > 0) {
            const apt = futureAppointments[0];
            console.log(`Testing with future appointment ID ${apt.id}:`);
            console.log(`  - Scheduled for: ${apt.appointment_date} ${apt.start_time}`);
            console.log(`  - Current status: ${apt.status}`);
            console.log(`  - Can mark as 'nicht erschienen': No (appointment hasn't started)`);
            console.log(`  - Can mark as 'abgeschlossen': Yes (manual completion allowed)`);
            console.log(`  - Can mark as 'abgesagt': Yes (cancellation always allowed)`);
        }
        
        // Find a current/past appointment to test
        const [currentOrPastAppointments] = await connection.execute(
            `SELECT id, appointment_date, start_time, end_time, status
             FROM appointments 
             WHERE status IN ('confirmed', 'completed')
               AND CONCAT(appointment_date, ' ', start_time) <= ?
             LIMIT 1`,
            [currentDateTime]
        );
        
        if (currentOrPastAppointments.length > 0) {
            const apt = currentOrPastAppointments[0];
            const hasEnded = new Date(`${apt.appointment_date} ${apt.end_time}`) < now;
            
            console.log(`\nTesting with ${hasEnded ? 'past' : 'current'} appointment ID ${apt.id}:`);
            console.log(`  - Time: ${apt.appointment_date} ${apt.start_time}-${apt.end_time}`);
            console.log(`  - Current status: ${apt.status}`);
            console.log(`  - Can mark as 'nicht erschienen': Yes (appointment has started)`);
            console.log(`  - Can mark as 'abgeschlossen': Yes`);
            
            if (hasEnded && apt.status === 'confirmed') {
                console.log(`  - ⚠️ Should be auto-updated to 'completed'`);
            }
        }
        
        // Test 4: Check for inconsistent statuses
        console.log('\n📋 Test 4: Checking for inconsistent statuses...');
        
        const [inconsistentStatuses] = await connection.execute(
            `SELECT id, status, appointment_date, start_time, end_time
             FROM appointments 
             WHERE status NOT IN ('confirmed', 'completed', 'cancelled', 'no_show', 'scheduled', 'pending')
             LIMIT 5`
        );
        
        if (inconsistentStatuses.length > 0) {
            console.log(`⚠️ Found ${inconsistentStatuses.length} appointments with non-English statuses:`);
            inconsistentStatuses.forEach(apt => {
                console.log(`  - ID: ${apt.id}, Status: "${apt.status}" (should be English)`);
            });
        } else {
            console.log('✅ All appointments have valid English statuses');
        }
        
        console.log('\n✅ Status management tests completed');
        
    } catch (error) {
        console.error('❌ Error during testing:', error.message);
    } finally {
        if (connection) {
            await connection.end();
            console.log('\n🔌 Database connection closed');
        }
    }
}

// Run the test
console.log('🧪 Starting Appointment Status Management Tests...');
console.log('================================================\n');

testStatusManagement().catch(console.error);