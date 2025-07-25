const db = require('../connection');

/**
 * Update Session Transaction Types Migration
 * Adds 'edit' and 'deactivation' transaction types to session_transactions table
 */

const runMigration = () => {
  return new Promise((resolve, reject) => {
    console.log('🚀 Starting session transaction types update migration...');

    // SQLite doesn't support modifying CHECK constraints directly
    // We need to recreate the table with the new constraint
    db.serialize(() => {
      db.run('BEGIN TRANSACTION', (err) => {
        if (err) {
          console.error('❌ Failed to begin transaction:', err);
          return reject(err);
        }

        // Create a new table with updated constraints
        const createNewTable = `
          CREATE TABLE session_transactions_new (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            customer_session_id INTEGER NOT NULL,
            transaction_type TEXT NOT NULL CHECK (transaction_type IN ('purchase', 'deduction', 'topup', 'refund', 'edit', 'deactivation')),
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

        db.run(createNewTable, (err) => {
          if (err) {
            console.error('❌ Failed to create new session_transactions table:', err);
            db.run('ROLLBACK');
            return reject(err);
          }

          // Copy data from old table to new table
          const copyData = `
            INSERT INTO session_transactions_new 
            SELECT * FROM session_transactions
          `;

          db.run(copyData, (err) => {
            if (err) {
              console.error('❌ Failed to copy data to new table:', err);
              db.run('ROLLBACK');
              return reject(err);
            }

            // Drop old table
            db.run('DROP TABLE session_transactions', (err) => {
              if (err) {
                console.error('❌ Failed to drop old table:', err);
                db.run('ROLLBACK');
                return reject(err);
              }

              // Rename new table to original name
              db.run('ALTER TABLE session_transactions_new RENAME TO session_transactions', (err) => {
                if (err) {
                  console.error('❌ Failed to rename new table:', err);
                  db.run('ROLLBACK');
                  return reject(err);
                }

                // Recreate indexes
                const createIndexes = [
                  'CREATE INDEX IF NOT EXISTS idx_session_transactions_customer_session ON session_transactions(customer_session_id)',
                  'CREATE INDEX IF NOT EXISTS idx_session_transactions_type ON session_transactions(transaction_type)',
                  'CREATE INDEX IF NOT EXISTS idx_session_transactions_appointment ON session_transactions(appointment_id)'
                ];

                let indexCount = 0;
                createIndexes.forEach((indexQuery, index) => {
                  db.run(indexQuery, (err) => {
                    if (err) {
                      console.error(`❌ Failed to create index ${index + 1}:`, err);
                      db.run('ROLLBACK');
                      return reject(err);
                    }
                    indexCount++;
                    if (indexCount === createIndexes.length) {
                      // Commit transaction
                      db.run('COMMIT', (err) => {
                        if (err) {
                          console.error('❌ Failed to commit transaction:', err);
                          db.run('ROLLBACK');
                          return reject(err);
                        }
                        console.log('✅ Session transaction types updated successfully');
                        console.log('🎉 Session transaction types migration completed successfully');
                        resolve();
                      });
                    }
                  });
                });
              });
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
      console.log('Session transaction types migration completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Session transaction types migration failed:', error);
      process.exit(1);
    });
}