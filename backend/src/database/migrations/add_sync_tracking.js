const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const createSyncTrackingTable = `
  CREATE TABLE IF NOT EXISTS sync_tracking (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    sync_type TEXT NOT NULL CHECK (sync_type IN ('full', 'incremental')),
    direction TEXT NOT NULL CHECK (direction IN ('sqlite_to_mysql', 'mysql_to_sqlite')),
    started_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    completed_at DATETIME,
    status TEXT DEFAULT 'in_progress' CHECK (status IN ('in_progress', 'completed', 'failed', 'rolled_back')),
    records_exported INTEGER DEFAULT 0,
    records_imported INTEGER DEFAULT 0,
    tables_affected TEXT, -- JSON array of table names
    error_message TEXT,
    sync_metadata TEXT, -- JSON object with additional sync info
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`;

const createSyncCheckpointsTable = `
  CREATE TABLE IF NOT EXISTS sync_checkpoints (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    table_name TEXT NOT NULL,
    last_sync_at DATETIME NOT NULL,
    last_record_id INTEGER,
    records_count INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(table_name)
  )
`;

// Add indexes for better performance
const createIndexes = [
  `CREATE INDEX IF NOT EXISTS idx_sync_tracking_status ON sync_tracking(status)`,
  `CREATE INDEX IF NOT EXISTS idx_sync_tracking_started_at ON sync_tracking(started_at)`,
  `CREATE INDEX IF NOT EXISTS idx_sync_checkpoints_table ON sync_checkpoints(table_name)`,
  `CREATE INDEX IF NOT EXISTS idx_sync_checkpoints_last_sync ON sync_checkpoints(last_sync_at)`
];

async function runMigration() {
  return new Promise((resolve, reject) => {
    const dbPath = path.join(__dirname, '../../../database.sqlite');
    const db = new sqlite3.Database(dbPath, (err) => {
      if (err) {
        reject(new Error(`Failed to open database: ${err.message}`));
        return;
      }

      console.log('🔄 Running sync tracking migration...');

      // Run the migration in a transaction
      db.serialize(() => {
        db.run('BEGIN TRANSACTION');

        // Create sync tracking table
        db.run(createSyncTrackingTable, (err) => {
          if (err) {
            console.error('Error creating sync_tracking table:', err.message);
            db.run('ROLLBACK');
            reject(err);
            return;
          }
          console.log('✅ Created sync_tracking table');
        });

        // Create sync checkpoints table
        db.run(createSyncCheckpointsTable, (err) => {
          if (err) {
            console.error('Error creating sync_checkpoints table:', err.message);
            db.run('ROLLBACK');
            reject(err);
            return;
          }
          console.log('✅ Created sync_checkpoints table');
        });

        // Create indexes
        let indexCount = 0;
        createIndexes.forEach((indexSQL, index) => {
          db.run(indexSQL, (err) => {
            if (err) {
              console.error(`Error creating index ${index}:`, err.message);
              db.run('ROLLBACK');
              reject(err);
              return;
            }
            indexCount++;
            if (indexCount === createIndexes.length) {
              console.log('✅ Created sync tracking indexes');
              
              // Initialize checkpoints for existing tables
              initializeCheckpoints(db, () => {
                db.run('COMMIT', (err) => {
                  if (err) {
                    console.error('Error committing transaction:', err.message);
                    reject(err);
                  } else {
                    console.log('✅ Sync tracking migration completed successfully');
                    db.close();
                    resolve();
                  }
                });
              });
            }
          });
        });
      });
    });
  });
}

function initializeCheckpoints(db, callback) {
  // Get list of all tables that should be tracked
  const trackedTables = [
    'users', 'studios', 'activation_codes', 'manager_codes',
    'appointments', 'leads', 'lead_call_logs', 
    'google_sheets_integrations', 'dialogflow_conversations'
  ];

  let processedTables = 0;
  const now = new Date().toISOString();

  trackedTables.forEach(tableName => {
    // Check if table exists first
    db.get(
      "SELECT name FROM sqlite_master WHERE type='table' AND name=?",
      [tableName],
      (err, row) => {
        if (err) {
          console.error(`Error checking table ${tableName}:`, err.message);
          processedTables++;
          if (processedTables === trackedTables.length) callback();
          return;
        }

        if (row) {
          // Table exists, initialize checkpoint
          db.run(
            `INSERT OR IGNORE INTO sync_checkpoints (table_name, last_sync_at, last_record_id, records_count) 
             VALUES (?, ?, 0, 0)`,
            [tableName, '2000-01-01 00:00:00'],
            (err) => {
              if (err) {
                console.error(`Error initializing checkpoint for ${tableName}:`, err.message);
              } else {
                console.log(`📋 Initialized checkpoint for table: ${tableName}`);
              }
              processedTables++;
              if (processedTables === trackedTables.length) callback();
            }
          );
        } else {
          console.log(`⚠️  Table ${tableName} does not exist, skipping checkpoint`);
          processedTables++;
          if (processedTables === trackedTables.length) callback();
        }
      }
    );
  });
}

// MySQL version of the same tables
const mysqlSyncTrackingTable = `
  CREATE TABLE IF NOT EXISTS sync_tracking (
    id INT AUTO_INCREMENT PRIMARY KEY,
    sync_type ENUM('full', 'incremental') NOT NULL,
    direction ENUM('sqlite_to_mysql', 'mysql_to_sqlite') NOT NULL,
    started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP NULL,
    status ENUM('in_progress', 'completed', 'failed', 'rolled_back') DEFAULT 'in_progress',
    records_exported INT DEFAULT 0,
    records_imported INT DEFAULT 0,
    tables_affected JSON,
    error_message TEXT,
    sync_metadata JSON,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_sync_tracking_status (status),
    INDEX idx_sync_tracking_started_at (started_at)
  )
`;

const mysqlSyncCheckpointsTable = `
  CREATE TABLE IF NOT EXISTS sync_checkpoints (
    id INT AUTO_INCREMENT PRIMARY KEY,
    table_name VARCHAR(100) NOT NULL,
    last_sync_at TIMESTAMP NOT NULL,
    last_record_id INT,
    records_count INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY unique_table_name (table_name),
    INDEX idx_sync_checkpoints_table (table_name),
    INDEX idx_sync_checkpoints_last_sync (last_sync_at)
  )
`;

async function createMySQLSyncTables(connection) {
  try {
    console.log('🔄 Creating MySQL sync tracking tables...');
    
    await connection.execute(mysqlSyncTrackingTable);
    console.log('✅ Created MySQL sync_tracking table');
    
    await connection.execute(mysqlSyncCheckpointsTable);
    console.log('✅ Created MySQL sync_checkpoints table');
    
    // Initialize checkpoints for MySQL tables
    const trackedTables = [
      'users', 'studios', 'activation_codes', 'manager_codes',
      'appointments', 'leads', 'lead_call_logs', 
      'google_sheets_integrations', 'dialogflow_conversations'
    ];
    
    for (const tableName of trackedTables) {
      try {
        await connection.execute(
          `INSERT INTO sync_checkpoints (table_name, last_sync_at, last_record_id, records_count) 
           VALUES (?, ?, 0, 0)
           ON DUPLICATE KEY UPDATE table_name = table_name`,
          [tableName, '2000-01-01 00:00:00']
        );
        console.log(`📋 Initialized MySQL checkpoint for table: ${tableName}`);
      } catch (error) {
        // Ignore duplicate key errors
        if (!error.message.includes('Duplicate entry')) {
          console.error(`Error initializing MySQL checkpoint for ${tableName}:`, error.message);
        }
      }
    }
    
    console.log('✅ MySQL sync tracking setup completed');
    return true;
  } catch (error) {
    console.error('❌ Error creating MySQL sync tables:', error.message);
    throw error;
  }
}

module.exports = {
  runMigration,
  createMySQLSyncTables,
  up: runMigration
};