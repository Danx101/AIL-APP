const mysql = require('mysql2/promise');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

async function fixGoogleSheetsTable() {
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
       AND TABLE_NAME = 'google_sheets_integrations' 
       AND COLUMN_NAME = 'manager_id'`,
      [process.env.DB_NAME || 'abnehmen_app']
    );

    if (columns.length > 0) {
      console.log('✅ Column manager_id already exists');
      return;
    }

    // Add the missing column
    console.log('Adding manager_id column...');
    await connection.execute(`
      ALTER TABLE google_sheets_integrations 
      ADD COLUMN manager_id INT AFTER studio_id
    `);

    // Add foreign key constraint
    console.log('Adding foreign key constraint...');
    await connection.execute(`
      ALTER TABLE google_sheets_integrations 
      ADD CONSTRAINT fk_google_sheets_manager 
      FOREIGN KEY (manager_id) 
      REFERENCES users(id) ON DELETE SET NULL
    `);

    // Update existing integrations to assign to the manager user
    console.log('Updating existing integrations...');
    await connection.execute(`
      UPDATE google_sheets_integrations gsi
      SET manager_id = (
        SELECT id FROM users WHERE role = 'manager' LIMIT 1
      )
      WHERE manager_id IS NULL
    `);

    console.log('✅ Successfully fixed google_sheets_integrations table');

    // Show current structure
    const [structure] = await connection.execute('DESCRIBE google_sheets_integrations');
    console.log('\nCurrent table structure:');
    structure.forEach(col => {
      console.log(`- ${col.Field}: ${col.Type} ${col.Null === 'YES' ? 'NULL' : 'NOT NULL'}`);
    });

  } catch (error) {
    console.error('Error fixing google_sheets_integrations table:', error);
    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

// Run the fix
fixGoogleSheetsTable();