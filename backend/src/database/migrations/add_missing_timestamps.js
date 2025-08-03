const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// Define which tables need which timestamp columns
const timestampUpdates = [
  {
    table: 'lead_call_logs',
    columns: ['updated_at']
  },
  {
    table: 'google_sheets_integrations', 
    columns: ['updated_at'] // already has created_at
  },
  {
    table: 'dialogflow_conversations',
    columns: ['updated_at'] // already has created_at
  }
  // Note: users, studios, activation_codes should already have proper timestamps from createBasicTables()
];

async function runMigration() {
  return new Promise((resolve, reject) => {
    const dbPath = path.join(__dirname, '../../../../database.sqlite');
    const db = new sqlite3.Database(dbPath, (err) => {
      if (err) {
        reject(new Error(`Failed to open database: ${err.message}`));
        return;
      }

      console.log('🔄 Running missing timestamps migration...');

      db.serialize(() => {
        db.run('BEGIN TRANSACTION');

        let processedTables = 0;
        let hasErrors = false;

        for (const update of timestampUpdates) {
          const { table, columns } = update;
          
          // Check if table exists first
          db.get(
            "SELECT name FROM sqlite_master WHERE type='table' AND name=?",
            [table],
            (err, row) => {
              if (err) {
                console.error(`Error checking table ${table}:`, err.message);
                hasErrors = true;
                processedTables++;
                checkCompletion();
                return;
              }

              if (!row) {
                console.log(`⚠️  Table ${table} does not exist, skipping...`);
                processedTables++;
                checkCompletion();
                return;
              }

              // Check which columns already exist
              db.all(`PRAGMA table_info(${table})`, (err, tableInfo) => {
                if (err) {
                  console.error(`Error getting table info for ${table}:`, err.message);
                  hasErrors = true;
                  processedTables++;
                  checkCompletion();
                  return;
                }

                const existingColumns = tableInfo.map(col => col.name);
                const columnsToAdd = columns.filter(col => !existingColumns.includes(col));

                if (columnsToAdd.length === 0) {
                  console.log(`✅ Table ${table} already has all required timestamp columns`);
                  processedTables++;
                  checkCompletion();
                  return;
                }

                // Add missing columns
                let addedColumns = 0;
                for (const column of columnsToAdd) {
                  const alterSQL = `ALTER TABLE ${table} ADD COLUMN ${column} DATETIME DEFAULT CURRENT_TIMESTAMP`;
                  
                  db.run(alterSQL, (err) => {
                    if (err) {
                      console.error(`Error adding ${column} to ${table}:`, err.message);
                      hasErrors = true;
                    } else {
                      console.log(`✅ Added ${column} column to ${table} table`);
                    }
                    
                    addedColumns++;
                    if (addedColumns === columnsToAdd.length) {
                      processedTables++;
                      checkCompletion();
                    }
                  });
                }
              });
            }
          );
        }

        function checkCompletion() {
          if (processedTables === timestampUpdates.length) {
            if (hasErrors) {
              console.error('❌ Migration completed with errors, rolling back...');
              db.run('ROLLBACK', () => {
                db.close();
                reject(new Error('Migration failed due to errors'));
              });
            } else {
              db.run('COMMIT', (err) => {
                if (err) {
                  console.error('Error committing transaction:', err.message);
                  reject(err);
                } else {
                  console.log('✅ Missing timestamps migration completed successfully');
                  db.close();
                  resolve();
                }
              });
            }
          }
        }

        // Handle case where no tables need updates
        if (timestampUpdates.length === 0) {
          console.log('✅ No timestamp updates needed');
          db.run('COMMIT', () => {
            db.close();
            resolve();
          });
        }
      });
    });
  });
}

// MySQL version - add missing timestamps to existing tables
async function addMySQLTimestamps(connection) {
  try {
    console.log('🔄 Adding missing timestamps to MySQL tables...');
    
    const updates = [
      {
        table: 'lead_call_logs',
        column: 'updated_at',
        sql: 'ALTER TABLE lead_call_logs ADD COLUMN updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP'
      },
      {
        table: 'google_sheets_integrations', 
        column: 'updated_at',
        sql: 'ALTER TABLE google_sheets_integrations MODIFY COLUMN updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP'
      },
      {
        table: 'dialogflow_conversations',
        column: 'updated_at', 
        sql: 'ALTER TABLE dialogflow_conversations ADD COLUMN updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP'
      }
    ];
    
    for (const update of updates) {
      try {
        // Check if table exists first
        const [tables] = await connection.execute(
          'SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?',
          [update.table]
        );
        
        if (tables.length === 0) {
          console.log(`⚠️  MySQL table ${update.table} does not exist, skipping...`);
          continue;
        }
        
        // Check if column already exists
        const [columns] = await connection.execute(
          'SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?',
          [update.table, update.column]
        );
        
        if (columns.length > 0) {
          console.log(`✅ MySQL table ${update.table} already has ${update.column} column`);
          continue;
        }
        
        // Add the column
        await connection.execute(update.sql);
        console.log(`✅ Added ${update.column} column to MySQL ${update.table} table`);
        
      } catch (error) {
        // Some errors are expected (like column already exists)
        if (error.message.includes('Duplicate column name')) {
          console.log(`✅ MySQL table ${update.table} already has ${update.column} column`);
        } else {
          console.error(`Error updating MySQL table ${update.table}:`, error.message);
        }
      }
    }
    
    console.log('✅ MySQL timestamp updates completed');
    return true;
  } catch (error) {
    console.error('❌ Error adding MySQL timestamps:', error.message);
    throw error;
  }
}

module.exports = {
  runMigration,
  addMySQLTimestamps,
  up: runMigration
};