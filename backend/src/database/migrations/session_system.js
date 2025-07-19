const db = require('../connection');

/**
 * Session System Database Migration
 * Creates tables for customer session packages and transaction tracking
 */

const runMigration = () => {
  return new Promise((resolve, reject) => {
    console.log('🚀 Starting session system migration...');

    // Create customer_sessions table
    const createCustomerSessionsTable = `
      CREATE TABLE IF NOT EXISTS customer_sessions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        customer_id INTEGER NOT NULL,
        studio_id INTEGER NOT NULL,
        total_sessions INTEGER NOT NULL CHECK (total_sessions > 0),
        remaining_sessions INTEGER NOT NULL CHECK (remaining_sessions >= 0),
        purchase_date DATETIME DEFAULT CURRENT_TIMESTAMP,
        notes TEXT,
        is_active BOOLEAN DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (customer_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (studio_id) REFERENCES studios(id) ON DELETE CASCADE
      )
    `;

    // Create session_transactions table
    const createSessionTransactionsTable = `
      CREATE TABLE IF NOT EXISTS session_transactions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        customer_session_id INTEGER NOT NULL,
        transaction_type TEXT NOT NULL CHECK (transaction_type IN ('purchase', 'deduction', 'topup', 'refund')),
        amount INTEGER NOT NULL,
        appointment_id INTEGER,
        created_by_user_id INTEGER NOT NULL,
        notes TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (customer_session_id) REFERENCES customer_sessions(id) ON DELETE CASCADE,
        FOREIGN KEY (appointment_id) REFERENCES appointments(id) ON DELETE SET NULL,
        FOREIGN KEY (created_by_user_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `;

    // Create indexes for better performance
    const createIndexes = [
      'CREATE INDEX IF NOT EXISTS idx_customer_sessions_customer_studio ON customer_sessions(customer_id, studio_id)',
      'CREATE INDEX IF NOT EXISTS idx_customer_sessions_active ON customer_sessions(is_active)',
      'CREATE INDEX IF NOT EXISTS idx_session_transactions_customer_session ON session_transactions(customer_session_id)',
      'CREATE INDEX IF NOT EXISTS idx_session_transactions_type ON session_transactions(transaction_type)',
      'CREATE INDEX IF NOT EXISTS idx_session_transactions_appointment ON session_transactions(appointment_id)'
    ];

    // Execute table creation
    db.serialize(() => {
      db.run(createCustomerSessionsTable, (err) => {
        if (err) {
          console.error('❌ Failed to create customer_sessions table:', err);
          return reject(err);
        }
        console.log('✅ customer_sessions table created successfully');

        db.run(createSessionTransactionsTable, (err) => {
          if (err) {
            console.error('❌ Failed to create session_transactions table:', err);
            return reject(err);
          }
          console.log('✅ session_transactions table created successfully');

          // Create indexes
          let indexCount = 0;
          createIndexes.forEach((indexQuery, index) => {
            db.run(indexQuery, (err) => {
              if (err) {
                console.error(`❌ Failed to create index ${index + 1}:`, err);
                return reject(err);
              }
              indexCount++;
              if (indexCount === createIndexes.length) {
                console.log('✅ All session system indexes created successfully');
                console.log('🎉 Session system migration completed successfully');
                resolve();
              }
            });
          });
        });
      });
    });
  });
};

module.exports = {
  runMigration
};

// Run migration if this file is executed directly
if (require.main === module) {
  runMigration()
    .then(() => {
      console.log('Session system migration completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Session system migration failed:', error);
      process.exit(1);
    });
}