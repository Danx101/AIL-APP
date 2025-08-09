const mysql = require('mysql2/promise');

async function checkGoogleSheetsTable() {
  const connection = await mysql.createConnection({
    host: 'hopper.proxy.rlwy.net',
    port: 34671,
    user: 'root',
    password: 'bbrlhmlgPbZdyKSrAeRepjooYRiSayER',
    database: 'railway'
  });

  try {
    // Check if table exists
    const [tables] = await connection.execute(
      "SHOW TABLES LIKE 'google_sheets_integrations'"
    );
    
    if (tables.length === 0) {
      console.log('❌ Table google_sheets_integrations does not exist');
      
      // Create the table
      console.log('Creating google_sheets_integrations table...');
      
      await connection.execute(`
        CREATE TABLE google_sheets_integrations (
          id INT AUTO_INCREMENT PRIMARY KEY,
          studio_id INT NOT NULL,
          sheet_id VARCHAR(255) NOT NULL,
          sheet_name VARCHAR(255),
          column_mapping JSON,
          auto_sync_enabled BOOLEAN DEFAULT TRUE,
          sync_frequency_minutes INT DEFAULT 30,
          sync_status ENUM('active', 'paused', 'error') DEFAULT 'active',
          last_sync_at TIMESTAMP NULL,
          last_sync_result JSON,
          manager_id INT,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          FOREIGN KEY (studio_id) REFERENCES studios(id) ON DELETE CASCADE,
          FOREIGN KEY (manager_id) REFERENCES users(id) ON DELETE SET NULL,
          UNIQUE KEY unique_studio_sheet (studio_id, sheet_id)
        );
      `);
      
      console.log('✅ Table google_sheets_integrations created successfully');
    } else {
      console.log('✅ Table google_sheets_integrations exists');
      
      // Check table structure
      const [columns] = await connection.execute(
        "SHOW COLUMNS FROM google_sheets_integrations"
      );
      
      console.log('\nTable structure:');
      columns.forEach(col => {
        console.log(`- ${col.Field}: ${col.Type} ${col.Null === 'NO' ? 'NOT NULL' : 'NULL'} ${col.Default ? `DEFAULT ${col.Default}` : ''}`);
      });
      
      // Check for any existing integrations
      const [integrations] = await connection.execute(
        "SELECT * FROM google_sheets_integrations"
      );
      
      console.log(`\nTotal integrations: ${integrations.length}`);
      
      if (integrations.length > 0) {
        console.log('\nExisting integrations:');
        integrations.forEach(int => {
          console.log(`- ID: ${int.id}, Studio: ${int.studio_id}, Sheet: ${int.sheet_id}`);
          console.log(`  Column mapping: ${int.column_mapping}`);
          console.log(`  Auto sync: ${int.auto_sync_enabled}, Status: ${int.sync_status}`);
        });
      }
    }
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await connection.end();
  }
}

checkGoogleSheetsTable();