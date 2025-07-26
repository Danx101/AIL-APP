const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// Database path
const dbPath = path.join(__dirname, '..', 'abnehmen_app.db');

const migration = {
  up: (db) => {
    return new Promise((resolve, reject) => {
      db.serialize(() => {
        // Add manager_id to google_sheets_integrations table
        db.run(`
          ALTER TABLE google_sheets_integrations 
          ADD COLUMN manager_id INTEGER REFERENCES users(id)
        `, function(err) {
          if (err && !err.message.includes('duplicate column')) {
            console.error('Error adding manager_id to google_sheets_integrations:', err);
            reject(err);
            return;
          }
          console.log('✅ Added manager_id to google_sheets_integrations');
        });

        // Add source_type to leads table to track import vs manual
        db.run(`
          ALTER TABLE leads 
          ADD COLUMN source_type TEXT DEFAULT 'manual'
        `, function(err) {
          if (err && !err.message.includes('duplicate column')) {
            console.error('Error adding source_type to leads:', err);
            reject(err);
            return;
          }
          console.log('✅ Added source_type to leads');
        });

        // Add created_by_manager_id to leads table
        db.run(`
          ALTER TABLE leads 
          ADD COLUMN created_by_manager_id INTEGER REFERENCES users(id)
        `, function(err) {
          if (err && !err.message.includes('duplicate column')) {
            console.error('Error adding created_by_manager_id to leads:', err);
            reject(err);
            return;
          }
          console.log('✅ Added created_by_manager_id to leads');
        });

        // Add created_by_user_id to leads table to track who created manual leads
        db.run(`
          ALTER TABLE leads 
          ADD COLUMN created_by_user_id INTEGER REFERENCES users(id)
        `, function(err) {
          if (err && !err.message.includes('duplicate column')) {
            console.error('Error adding created_by_user_id to leads:', err);
            reject(err);
            return;
          }
          console.log('✅ Added created_by_user_id to leads');
        });

        // Update existing leads to mark them as manual
        db.run(`
          UPDATE leads 
          SET source_type = 'manual' 
          WHERE source_type IS NULL
        `, function(err) {
          if (err) {
            console.error('Error updating existing leads source_type:', err);
          } else {
            console.log('✅ Updated existing leads to manual source_type');
          }
        });

        // Create index for manager authorization
        db.run(`
          CREATE INDEX IF NOT EXISTS idx_google_sheets_manager_id 
          ON google_sheets_integrations(manager_id)
        `, (err) => {
          if (err) console.error('Error creating manager_id index:', err);
          else console.log('✅ Created manager_id index');
        });

        // Create index for lead source tracking
        db.run(`
          CREATE INDEX IF NOT EXISTS idx_leads_source_type 
          ON leads(source_type)
        `, (err) => {
          if (err) console.error('Error creating source_type index:', err);
          else console.log('✅ Created source_type index');
        });

        // Create index for created_by tracking
        db.run(`
          CREATE INDEX IF NOT EXISTS idx_leads_created_by_user 
          ON leads(created_by_user_id)
        `, (err) => {
          if (err) console.error('Error creating created_by_user_id index:', err);
          else console.log('✅ Created created_by_user_id index');
        });

        // Resolve after all operations
        setTimeout(() => {
          console.log('🎉 Manager authorization migration completed successfully!');
          resolve();
        }, 100);
      });
    });
  },

  down: (db) => {
    return new Promise((resolve, reject) => {
      db.serialize(() => {
        // Note: SQLite doesn't support DROP COLUMN, so we'll just log the rollback
        console.log('⚠️ SQLite does not support DROP COLUMN. Manual cleanup required:');
        console.log('- manager_id column in google_sheets_integrations');
        console.log('- source_type column in leads');
        console.log('- created_by_manager_id column in leads');
        console.log('- created_by_user_id column in leads');
        
        setTimeout(() => {
          console.log('🗑️ Manager authorization migration rollback noted!');
          resolve();
        }, 100);
      });
    });
  }
};

// Run migration if called directly
if (require.main === module) {
  const db = new sqlite3.Database(dbPath);
  
  migration.up(db)
    .then(() => {
      console.log('✅ Migration completed successfully');
      db.close();
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Migration failed:', error);
      db.close();
      process.exit(1);
    });
}

module.exports = migration;