const mysql = require('mysql2/promise');
require('dotenv').config();

async function runMigration011() {
  console.log('🔄 Running migration 011_address_components.sql');

  let connection;
  try {
    // Create MySQL connection
    connection = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      port: process.env.DB_PORT || 3306,
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME || 'abnehmen_app'
    });

    console.log('✅ Connected to MySQL database');

    // Check if columns already exist
    console.log('🔍 Checking existing address columns...');
    const [columns] = await connection.execute("SHOW COLUMNS FROM users LIKE '%country%'");
    if (columns.length > 0) {
      console.log('ℹ️  Address components already exist!');
      return;
    }

    // Add the new address component columns
    console.log('🚀 Adding address component columns...');
    
    await connection.execute(`
      ALTER TABLE users
      ADD COLUMN country VARCHAR(100) DEFAULT 'Österreich' AFTER address
    `);
    console.log('✅ country column added');

    await connection.execute(`
      ALTER TABLE users
      ADD COLUMN postal_code VARCHAR(20) AFTER country
    `);
    console.log('✅ postal_code column added');

    await connection.execute(`
      ALTER TABLE users
      ADD COLUMN street VARCHAR(200) AFTER postal_code
    `);
    console.log('✅ street column added');

    await connection.execute(`
      ALTER TABLE users
      ADD COLUMN house_number VARCHAR(50) AFTER street
    `);
    console.log('✅ house_number column added');

    await connection.execute(`
      ALTER TABLE users
      ADD COLUMN door_apartment VARCHAR(50) AFTER house_number
    `);
    console.log('✅ door_apartment column added');

    // Create index for better performance
    console.log('🔍 Creating index for location lookups...');
    await connection.execute(`
      CREATE INDEX idx_users_location ON users(country, postal_code, city)
    `);
    console.log('✅ Location index created');

    // Update existing users with default country
    console.log('🔄 Setting default country for existing users...');
    const [result] = await connection.execute(`
      UPDATE users 
      SET country = 'Österreich' 
      WHERE country IS NULL
    `);
    console.log(`✅ Updated ${result.affectedRows} users with default country`);

    // Verify the changes
    console.log('🔍 Verifying the migration...');
    const [testResult] = await connection.execute('SELECT country FROM users LIMIT 1');
    console.log('✅ Address component columns are accessible');

    // Show updated table structure
    console.log('\n📋 New address-related columns:');
    const [tableColumns] = await connection.execute('SHOW COLUMNS FROM users');
    const addressColumns = ['address', 'country', 'postal_code', 'street', 'house_number', 'door_apartment'];
    
    tableColumns.forEach(col => {
      if (addressColumns.includes(col.Field)) {
        const isNew = ['country', 'postal_code', 'street', 'house_number', 'door_apartment'].includes(col.Field);
        console.log(`${isNew ? '✨ NEW:' : '   '} ${col.Field}: ${col.Type} ${col.Null === 'YES' ? '(nullable)' : '(not null)'} ${col.Default ? `default: ${col.Default}` : ''}`);
      }
    });

    console.log('\n✅ Address components migration completed successfully!');

  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    
    if (error.code === 'ER_DUP_FIELDNAME') {
      console.log('ℹ️  Columns already exist - this is normal if migration was run before');
    }
  } finally {
    if (connection) {
      await connection.end();
      console.log('🔌 Database connection closed');
    }
  }
}

// Run the migration
runMigration011().catch(console.error);