#!/usr/bin/env node

/**
 * Migration script to fix Google Sheets lead integration issues
 * This script:
 * 1. Updates the leads table to use consistent column names
 * 2. Adds missing columns for tracking imported leads
 * 3. Updates google_sheets_integrations table structure
 * 4. Creates necessary indexes for performance
 */

const mysql = require('mysql2/promise');
require('dotenv').config();

async function runMigration() {
    let connection;
    
    try {
        // Create connection
        connection = await mysql.createConnection({
            host: process.env.DB_HOST || 'localhost',
            port: process.env.DB_PORT || 3306,
            user: process.env.DB_USER || 'root',
            password: process.env.DB_PASSWORD || '',
            database: process.env.DB_NAME || 'ail_app'
        });

        console.log('🔄 Starting Google Sheets integration fix migration...');

        // 1. Check and rename phone column to phone_number if needed
        console.log('📋 Checking leads table structure...');
        const [columns] = await connection.execute(
            "SHOW COLUMNS FROM leads WHERE Field = 'phone'"
        );
        
        if (columns.length > 0) {
            console.log('  → Renaming phone column to phone_number...');
            await connection.execute(
                "ALTER TABLE leads CHANGE COLUMN phone phone_number VARCHAR(20) NOT NULL"
            );
            console.log('  ✅ Column renamed successfully');
        } else {
            console.log('  ✓ phone_number column already exists');
        }

        // 2. Add missing columns to leads table
        const columnsToAdd = [
            { name: 'source_type', definition: "ENUM('manual', 'imported') DEFAULT 'manual'" },
            { name: 'google_sheets_row_id', definition: 'INT' },
            { name: 'google_sheets_sync_id', definition: 'VARCHAR(100)' },
            { name: 'created_by_manager_id', definition: 'INT' },
            { name: 'created_by_user_id', definition: 'INT' },
            { name: 'lead_score', definition: 'INT DEFAULT 0' },
            { name: 'conversion_status', definition: "ENUM('lead', 'prospect', 'customer', 'lost') DEFAULT 'lead'" },
            { name: 'last_contacted', definition: 'TIMESTAMP NULL' },
            { name: 'next_follow_up', definition: 'TIMESTAMP NULL' }
        ];

        for (const column of columnsToAdd) {
            const [existing] = await connection.execute(
                `SHOW COLUMNS FROM leads WHERE Field = '${column.name}'`
            );
            
            if (existing.length === 0) {
                console.log(`  → Adding column ${column.name}...`);
                await connection.execute(
                    `ALTER TABLE leads ADD COLUMN ${column.name} ${column.definition}`
                );
                console.log(`  ✅ Column ${column.name} added`);
            } else {
                console.log(`  ✓ Column ${column.name} already exists`);
            }
        }

        // 3. Update status enum values if needed
        console.log('📋 Updating status enum values...');
        try {
            await connection.execute(
                `ALTER TABLE leads MODIFY COLUMN status 
                ENUM('neu', 'kontaktiert', 'konvertiert', 'nicht_interessiert', 'new', 'contacted', 'interested', 'appointment_scheduled', 'converted', 'not_interested') 
                DEFAULT 'neu'`
            );
            
            // Update old status values to new German ones
            await connection.execute("UPDATE leads SET status = 'neu' WHERE status = 'new'");
            await connection.execute("UPDATE leads SET status = 'kontaktiert' WHERE status = 'contacted'");
            await connection.execute("UPDATE leads SET status = 'konvertiert' WHERE status = 'converted'");
            await connection.execute("UPDATE leads SET status = 'nicht_interessiert' WHERE status = 'not_interested'");
            
            console.log('  ✅ Status values updated');
        } catch (error) {
            console.log('  ⚠️ Status column update skipped (may already be correct)');
        }

        // 4. Create indexes for performance
        console.log('📋 Creating indexes...');
        const indexesToCreate = [
            { name: 'idx_phone_studio', columns: 'phone_number, studio_id' },
            { name: 'idx_sync_id', columns: 'google_sheets_sync_id' },
            { name: 'idx_source_type', columns: 'source_type' }
        ];

        for (const index of indexesToCreate) {
            try {
                await connection.execute(
                    `CREATE INDEX ${index.name} ON leads (${index.columns})`
                );
                console.log(`  ✅ Index ${index.name} created`);
            } catch (error) {
                if (error.code === 'ER_DUP_KEYNAME') {
                    console.log(`  ✓ Index ${index.name} already exists`);
                } else {
                    console.log(`  ⚠️ Failed to create index ${index.name}: ${error.message}`);
                }
            }
        }

        // 5. Update google_sheets_integrations table
        console.log('📋 Updating google_sheets_integrations table...');
        const integrationColumns = [
            { name: 'column_mapping', definition: 'JSON' },
            { name: 'auto_sync_enabled', definition: 'BOOLEAN DEFAULT TRUE' },
            { name: 'sync_frequency_minutes', definition: 'INT DEFAULT 60' },
            { name: 'last_sync_at', definition: 'TIMESTAMP NULL' },
            { name: 'sync_status', definition: "ENUM('active', 'paused', 'error') DEFAULT 'active'" }
        ];

        for (const column of integrationColumns) {
            const [existing] = await connection.execute(
                `SHOW COLUMNS FROM google_sheets_integrations WHERE Field = '${column.name}'`
            );
            
            if (existing.length === 0) {
                console.log(`  → Adding column ${column.name} to google_sheets_integrations...`);
                await connection.execute(
                    `ALTER TABLE google_sheets_integrations ADD COLUMN ${column.name} ${column.definition}`
                );
                console.log(`  ✅ Column ${column.name} added`);
            } else {
                console.log(`  ✓ Column ${column.name} already exists`);
            }
        }

        // 6. Mark all existing leads without source_type as manual
        console.log('📋 Updating existing leads...');
        const [updateResult] = await connection.execute(
            "UPDATE leads SET source_type = 'manual' WHERE source_type IS NULL"
        );
        console.log(`  ✅ Updated ${updateResult.affectedRows} existing leads`);

        console.log('\n✅ Migration completed successfully!');
        console.log('\n📝 Summary:');
        console.log('  • Leads table structure updated');
        console.log('  • Google Sheets integration columns added');
        console.log('  • Indexes created for better performance');
        console.log('  • Existing leads marked as manual entries');
        console.log('\n🚀 The Google Sheets lead integration is now ready to use!');

    } catch (error) {
        console.error('\n❌ Migration failed:', error.message);
        console.error('Stack trace:', error.stack);
        process.exit(1);
    } finally {
        if (connection) {
            await connection.end();
        }
    }
}

// Run the migration
runMigration().catch(error => {
    console.error('Unexpected error:', error);
    process.exit(1);
});