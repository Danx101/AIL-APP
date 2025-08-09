const mysql = require('mysql2/promise');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

async function fixManagerCodesTable() {
  let connection;
  
  try {
    // Create connection
    connection = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      port: process.env.DB_PORT || 3306,
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME || 'abnehmen_app'
    });

    console.log('Connected to MySQL database');

    // Check if column already exists
    const [columns] = await connection.execute(
      `SELECT COLUMN_NAME 
       FROM INFORMATION_SCHEMA.COLUMNS 
       WHERE TABLE_SCHEMA = ? 
       AND TABLE_NAME = 'manager_codes' 
       AND COLUMN_NAME = 'created_by_manager_id'`,
      [process.env.DB_NAME || 'abnehmen_app']
    );

    if (columns.length > 0) {
      console.log('✅ Column created_by_manager_id already exists');
      return;
    }

    // Add the missing column
    console.log('Adding created_by_manager_id column...');
    await connection.execute(`
      ALTER TABLE manager_codes 
      ADD COLUMN created_by_manager_id INT AFTER created_by_user_id
    `);

    // Copy data from created_by_user_id to created_by_manager_id
    console.log('Copying existing data...');
    await connection.execute(`
      UPDATE manager_codes 
      SET created_by_manager_id = created_by_user_id 
      WHERE created_by_user_id IS NOT NULL
    `);

    // Add foreign key constraint
    console.log('Adding foreign key constraint...');
    await connection.execute(`
      ALTER TABLE manager_codes 
      ADD CONSTRAINT fk_manager_codes_manager 
      FOREIGN KEY (created_by_manager_id) 
      REFERENCES users(id) ON DELETE SET NULL
    `);

    console.log('✅ Successfully fixed manager_codes table structure');

    // Show current structure
    const [structure] = await connection.execute('DESCRIBE manager_codes');
    console.log('\nCurrent table structure:');
    structure.forEach(col => {
      console.log(`- ${col.Field}: ${col.Type} ${col.Null === 'YES' ? 'NULL' : 'NOT NULL'}`);
    });

  } catch (error) {
    console.error('Error fixing manager_codes table:', error);
    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

// Run the fix
fixManagerCodesTable();