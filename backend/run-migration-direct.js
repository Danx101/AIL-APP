const mysql = require('mysql2/promise');
require('dotenv').config();

async function runMigrationDirect() {
  console.log('🔄 Running migration directly with MySQL2');

  let connection;
  try {
    // Create MySQL connection
    connection = await mysql.createConnection({
      host: process.env.DB_HOST || 'hopper.proxy.rlwy.net',
      port: process.env.DB_PORT || 34671,
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || 'bbrlhmlgPbZdyKSrAeRepjooYRiSayER',
      database: process.env.DB_NAME || 'railway'
    });

    console.log('✅ Connected to MySQL database');

    // Check if column already exists
    console.log('🔍 Checking if verification_attempts column exists...');
    try {
      const [columns] = await connection.execute("SHOW COLUMNS FROM users LIKE 'verification_attempts'");
      if (columns.length > 0) {
        console.log('ℹ️  verification_attempts column already exists!');
        console.log('Column details:', columns[0]);
        return;
      }
    } catch (error) {
      console.log('Could not check existing columns:', error.message);
    }

    // Add the verification_attempts column
    console.log('🚀 Adding verification_attempts column...');
    await connection.execute(`
      ALTER TABLE users 
      ADD COLUMN verification_attempts INT DEFAULT 0 
      AFTER email_verification_expires
    `);
    console.log('✅ verification_attempts column added successfully');

    // Update existing unverified users
    console.log('🔄 Updating existing unverified users...');
    const [result] = await connection.execute(`
      UPDATE users 
      SET verification_attempts = 1 
      WHERE email_verified = FALSE AND email_verification_token IS NOT NULL
    `);
    console.log(`✅ Updated ${result.affectedRows} unverified users`);

    // Verify the changes
    console.log('🔍 Verifying the migration...');
    const [testResult] = await connection.execute('SELECT verification_attempts FROM users LIMIT 1');
    console.log('✅ verification_attempts column is accessible');

    // Show updated table structure
    console.log('\n📋 Updated users table structure:');
    const [tableColumns] = await connection.execute('SHOW COLUMNS FROM users');
    tableColumns.forEach(col => {
      if (col.Field === 'verification_attempts') {
        console.log(`✨ NEW: ${col.Field}: ${col.Type} ${col.Null === 'YES' ? '(nullable)' : '(not null)'} default: ${col.Default}`);
      } else if (['email_verified', 'email_verification_token', 'email_verification_expires'].includes(col.Field)) {
        console.log(`   ${col.Field}: ${col.Type} ${col.Null === 'YES' ? '(nullable)' : '(not null)'} ${col.Default ? `default: ${col.Default}` : ''}`);
      }
    });

    console.log('\n✅ Migration completed successfully!');

  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    
    if (error.code === 'ER_DUP_FIELDNAME') {
      console.log('ℹ️  Column already exists - this is normal if migration was run before');
    }
  } finally {
    if (connection) {
      await connection.end();
      console.log('🔌 Database connection closed');
    }
  }
}

// Run the migration
runMigrationDirect().catch(console.error);