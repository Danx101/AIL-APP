#!/usr/bin/env node

/**
 * Check Appointments Table Structure
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

async function checkTable() {
    let connection;
    
    try {
        // Create connection
        connection = await mysql.createConnection(dbConfig);
        console.log('✅ Connected to MySQL database');
        
        // Get table structure
        console.log('\n📋 Appointments table structure:');
        
        const [columns] = await connection.execute(
            `SHOW COLUMNS FROM appointments WHERE Field = 'status'`
        );
        
        if (columns.length > 0) {
            const statusColumn = columns[0];
            console.log('\nStatus column definition:');
            console.log(`  Field: ${statusColumn.Field}`);
            console.log(`  Type: ${statusColumn.Type}`);
            console.log(`  Null: ${statusColumn.Null}`);
            console.log(`  Key: ${statusColumn.Key}`);
            console.log(`  Default: ${statusColumn.Default}`);
            
            // Extract ENUM values
            if (statusColumn.Type.startsWith('enum')) {
                const enumValues = statusColumn.Type
                    .replace('enum(', '')
                    .replace(')', '')
                    .split(',')
                    .map(v => v.trim().replace(/'/g, ''));
                    
                console.log('\n  Allowed ENUM values:');
                enumValues.forEach(value => {
                    console.log(`    - "${value}"`);
                });
            }
        }
        
    } catch (error) {
        console.error('❌ Error:', error.message);
    } finally {
        if (connection) {
            await connection.end();
            console.log('\n🔌 Database connection closed');
        }
    }
}

// Run the check
console.log('🔍 Checking Appointments Table Structure...');
console.log('==========================================\n');

checkTable().catch(console.error);