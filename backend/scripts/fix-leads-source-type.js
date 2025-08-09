const mysql = require('mysql2/promise');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

async function fixLeadsTable() {
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
       AND TABLE_NAME = 'leads' 
       AND COLUMN_NAME = 'source_type'`,
      [process.env.DB_NAME || 'abnehmen_app']
    );

    if (columns.length > 0) {
      console.log('✅ Column source_type already exists');
      return;
    }

    // Add the missing column
    console.log('Adding source_type column to leads table...');
    await connection.execute(`
      ALTER TABLE leads 
      ADD COLUMN source_type VARCHAR(50) DEFAULT 'manual' AFTER source
    `);

    console.log('✅ Successfully added source_type column');

    // Also check and add created_by_manager_id if missing
    const [managerIdColumns] = await connection.execute(
      `SELECT COLUMN_NAME 
       FROM INFORMATION_SCHEMA.COLUMNS 
       WHERE TABLE_SCHEMA = ? 
       AND TABLE_NAME = 'leads' 
       AND COLUMN_NAME = 'created_by_manager_id'`,
      [process.env.DB_NAME || 'abnehmen_app']
    );

    if (managerIdColumns.length === 0) {
      console.log('Adding created_by_manager_id column to leads table...');
      await connection.execute(`
        ALTER TABLE leads 
        ADD COLUMN created_by_manager_id INT
      `);
      
      // Add foreign key constraint
      await connection.execute(`
        ALTER TABLE leads 
        ADD CONSTRAINT fk_leads_manager 
        FOREIGN KEY (created_by_manager_id) 
        REFERENCES users(id) ON DELETE SET NULL
      `);
      
      console.log('✅ Successfully added created_by_manager_id column');
    }

    // Show current structure
    const [structure] = await connection.execute('DESCRIBE leads');
    console.log('\nCurrent leads table structure:');
    structure.forEach(col => {
      console.log(`- ${col.Field}: ${col.Type} ${col.Null === 'YES' ? 'NULL' : 'NOT NULL'}`);
    });

  } catch (error) {
    console.error('Error fixing leads table:', error);
    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

// Run the fix
fixLeadsTable();