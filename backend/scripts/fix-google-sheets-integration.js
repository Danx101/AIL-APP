const mysql = require('mysql2/promise');

async function fixGoogleSheetsIntegration() {
  const connection = await mysql.createConnection({
    host: 'hopper.proxy.rlwy.net',
    port: 34671,
    user: 'root',
    password: 'bbrlhmlgPbZdyKSrAeRepjooYRiSayER',
    database: 'railway'
  });

  try {
    // Get the existing integration
    const [integrations] = await connection.execute(
      "SELECT * FROM google_sheets_integrations WHERE id = 1"
    );
    
    if (integrations.length === 0) {
      console.log('❌ No integration found with ID 1');
      return;
    }
    
    const integration = integrations[0];
    console.log('Found integration:', {
      id: integration.id,
      studio_id: integration.studio_id,
      sheet_id: integration.sheet_id,
      column_mapping: integration.column_mapping
    });
    
    if (!integration.column_mapping) {
      console.log('\n⚠️ Column mapping is null. Setting default column mapping...');
      
      // Set a default column mapping
      const defaultMapping = {
        name: 'Name',
        phone_number: 'Phone',
        email: 'Email',
        notes: 'Notes'
      };
      
      await connection.execute(
        "UPDATE google_sheets_integrations SET column_mapping = ? WHERE id = ?",
        [JSON.stringify(defaultMapping), integration.id]
      );
      
      console.log('✅ Updated column mapping to:', defaultMapping);
      
      // Also update the sheet_name if null
      if (!integration.sheet_name) {
        await connection.execute(
          "UPDATE google_sheets_integrations SET sheet_name = ? WHERE id = ?",
          ['Lead Import Sheet', integration.id]
        );
        console.log('✅ Updated sheet name to: Lead Import Sheet');
      }
      
      // Set the manager_id if missing
      if (!integration.manager_id) {
        // Get the manager user
        const [managers] = await connection.execute(
          "SELECT id FROM users WHERE role = 'manager' LIMIT 1"
        );
        
        if (managers.length > 0) {
          await connection.execute(
            "UPDATE google_sheets_integrations SET manager_id = ? WHERE id = ?",
            [managers[0].id, integration.id]
          );
          console.log('✅ Updated manager_id to:', managers[0].id);
        }
      }
    } else {
      console.log('✅ Column mapping already exists:', integration.column_mapping);
    }
    
    // Verify the update
    const [updated] = await connection.execute(
      "SELECT * FROM google_sheets_integrations WHERE id = 1"
    );
    
    console.log('\nUpdated integration:', {
      id: updated[0].id,
      studio_id: updated[0].studio_id,
      sheet_id: updated[0].sheet_id,
      column_mapping: updated[0].column_mapping,
      manager_id: updated[0].manager_id,
      sheet_name: updated[0].sheet_name
    });
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await connection.end();
  }
}

fixGoogleSheetsIntegration();