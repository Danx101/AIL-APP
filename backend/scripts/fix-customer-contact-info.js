#!/usr/bin/env node

const mysql = require('mysql2/promise');
require('dotenv').config();

async function fixCustomerContactInfo() {
  console.log('🔧 Fixing customer contact information structure...\n');

  const config = {
    host: process.env.DB_HOST || process.env.MYSQLHOST || 'localhost',
    port: process.env.DB_PORT || process.env.MYSQLPORT || 3306,
    user: process.env.DB_USER || process.env.MYSQLUSER || 'root',
    password: process.env.DB_PASSWORD || process.env.MYSQLPASSWORD || '',
    database: process.env.DB_NAME || process.env.MYSQLDATABASE || 'abnehmen_app'
  };

  // Add SSL for production
  if (process.env.NODE_ENV === 'production' || process.env.RAILWAY_ENVIRONMENT) {
    config.ssl = { rejectUnauthorized: false };
  }

  try {
    const connection = await mysql.createConnection(config);
    console.log('✅ Connected to MySQL database\n');

    // Check if customers table exists
    console.log('📋 Checking if customers table exists...');
    const [tables] = await connection.execute(
      "SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'customers'",
      [config.database]
    );

    if (tables.length === 0) {
      console.log('❌ customers table does not exist. Creating it...');
      
      // Create the customers table for customer-specific data
      await connection.execute(`
        CREATE TABLE customers (
          id INT AUTO_INCREMENT PRIMARY KEY,
          user_id INT NOT NULL,
          studio_id INT NOT NULL,
          contact_email VARCHAR(255),
          contact_phone VARCHAR(50),
          contact_first_name VARCHAR(100),
          contact_last_name VARCHAR(100),
          probebehandlung_used BOOLEAN DEFAULT FALSE,
          probebehandlung_appointment_id INT,
          last_weight DECIMAL(5,2),
          goal_weight DECIMAL(5,2),
          initial_weight DECIMAL(5,2),
          notes TEXT,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          UNIQUE KEY unique_user_studio (user_id, studio_id),
          FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
          FOREIGN KEY (studio_id) REFERENCES studios(id) ON DELETE CASCADE,
          INDEX idx_studio_customers (studio_id)
        )
      `);
      console.log('✅ customers table created successfully');
      
      // Populate customers table from existing data
      console.log('\n📝 Populating customers table from existing users...');
      
      // Get all customers with their studio associations
      const [customerUsers] = await connection.execute(`
        SELECT DISTINCT u.id, u.first_name, u.last_name, u.email, u.phone, ac.studio_id
        FROM users u
        JOIN activation_codes ac ON u.id = ac.used_by_user_id
        WHERE u.role = 'customer' AND ac.studio_id IS NOT NULL
      `);
      
      console.log(`Found ${customerUsers.length} customer-studio relationships`);
      
      for (const user of customerUsers) {
        try {
          await connection.execute(`
            INSERT INTO customers (user_id, studio_id, contact_email, contact_phone, contact_first_name, contact_last_name)
            VALUES (?, ?, ?, ?, ?, ?)
            ON DUPLICATE KEY UPDATE
              contact_email = VALUES(contact_email),
              contact_phone = VALUES(contact_phone),
              contact_first_name = VALUES(contact_first_name),
              contact_last_name = VALUES(contact_last_name)
          `, [user.id, user.studio_id, user.email, user.phone, user.first_name, user.last_name]);
          
          console.log(`✅ Added customer ${user.first_name} ${user.last_name} to studio ${user.studio_id}`);
        } catch (err) {
          console.error(`⚠️ Failed to add customer ${user.id}:`, err.message);
        }
      }
    } else {
      console.log('✅ customers table exists');
      
      // Check if contact fields exist
      const [columns] = await connection.execute(
        "SELECT COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'customers'",
        [config.database]
      );
      
      const columnNames = columns.map(col => col.COLUMN_NAME);
      
      // Add contact fields if they don't exist
      if (!columnNames.includes('contact_email')) {
        console.log('⚠️ Adding contact_email column...');
        await connection.execute('ALTER TABLE customers ADD COLUMN contact_email VARCHAR(255) AFTER studio_id');
      }
      
      if (!columnNames.includes('contact_phone')) {
        console.log('⚠️ Adding contact_phone column...');
        await connection.execute('ALTER TABLE customers ADD COLUMN contact_phone VARCHAR(50) AFTER contact_email');
      }
      
      if (!columnNames.includes('contact_first_name')) {
        console.log('⚠️ Adding contact_first_name column...');
        await connection.execute('ALTER TABLE customers ADD COLUMN contact_first_name VARCHAR(100) AFTER contact_phone');
      }
      
      if (!columnNames.includes('contact_last_name')) {
        console.log('⚠️ Adding contact_last_name column...');
        await connection.execute('ALTER TABLE customers ADD COLUMN contact_last_name VARCHAR(100) AFTER contact_first_name');
      }
      
      // Sync contact info from users table if not already synced
      console.log('\n📝 Syncing contact information...');
      const [needsSync] = await connection.execute(`
        SELECT c.id, c.user_id, u.email, u.phone, u.first_name, u.last_name
        FROM customers c
        JOIN users u ON c.user_id = u.id
        WHERE c.contact_email IS NULL OR c.contact_first_name IS NULL
      `);
      
      if (needsSync.length > 0) {
        console.log(`Found ${needsSync.length} customers needing contact info sync`);
        
        for (const customer of needsSync) {
          await connection.execute(`
            UPDATE customers 
            SET contact_email = ?, contact_phone = ?, contact_first_name = ?, contact_last_name = ?
            WHERE id = ?
          `, [customer.email, customer.phone, customer.first_name, customer.last_name, customer.id]);
        }
        console.log('✅ Contact information synced');
      }
    }

    // Final check
    console.log('\n📊 Customer data summary:');
    const [customerCount] = await connection.execute('SELECT COUNT(*) as count FROM customers');
    console.log(`   Total customer records: ${customerCount[0].count}`);
    
    const [sampleCustomers] = await connection.execute(`
      SELECT c.*, u.email as login_email 
      FROM customers c
      JOIN users u ON c.user_id = u.id
      LIMIT 3
    `);
    
    console.log('\n   Sample customers:');
    sampleCustomers.forEach(c => {
      console.log(`   - ${c.contact_first_name} ${c.contact_last_name}`);
      console.log(`     Login: ${c.login_email}`);
      console.log(`     Contact: ${c.contact_email || 'Not set'}`);
    });

    await connection.end();
    console.log('\n🎉 Customer contact information structure is ready!');
    console.log('\n💡 Important: Customer login emails remain in the users table.');
    console.log('   Contact information is now stored separately in the customers table.');

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error('Full error:', error);
    process.exit(1);
  }
}

// Run the fix
fixCustomerContactInfo();