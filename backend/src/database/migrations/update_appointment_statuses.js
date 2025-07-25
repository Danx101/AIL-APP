const db = require('../connection');

/**
 * Update Appointment Statuses Migration
 * Adds German status terms to appointments table constraint
 */

const runMigration = () => {
  return new Promise((resolve, reject) => {
    console.log('🚀 Starting appointment statuses update migration...');

    // SQLite doesn't support modifying CHECK constraints directly
    // We need to recreate the table with the updated constraint
    db.serialize(() => {
      db.run('BEGIN TRANSACTION', (err) => {
        if (err) {
          console.error('❌ Failed to begin transaction:', err);
          return reject(err);
        }

        // Create a new table with updated status constraint
        const createNewTable = `
          CREATE TABLE appointments_new (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            studio_id INTEGER NOT NULL,
            customer_id INTEGER NOT NULL,
            appointment_type_id INTEGER,
            appointment_date DATE NOT NULL,
            start_time TIME NOT NULL,
            end_time TIME NOT NULL,
            status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN (
              'pending', 'confirmed', 'cancelled', 'completed', 'no_show',
              'bestätigt', 'abgesagt', 'abgeschlossen', 'nicht erschienen'
            )),
            notes TEXT,
            created_by_user_id INTEGER NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (studio_id) REFERENCES studios(id) ON DELETE CASCADE,
            FOREIGN KEY (customer_id) REFERENCES users(id) ON DELETE CASCADE,
            FOREIGN KEY (appointment_type_id) REFERENCES appointment_types(id),
            FOREIGN KEY (created_by_user_id) REFERENCES users(id) ON DELETE CASCADE
          )
        `;

        db.run(createNewTable, (err) => {
          if (err) {
            console.error('❌ Failed to create new appointments table:', err);
            db.run('ROLLBACK');
            return reject(err);
          }

          // Copy data from old table to new table
          const copyData = `
            INSERT INTO appointments_new 
            SELECT * FROM appointments
          `;

          db.run(copyData, (err) => {
            if (err) {
              console.error('❌ Failed to copy data to new table:', err);
              db.run('ROLLBACK');
              return reject(err);
            }

            // Drop old table
            db.run('DROP TABLE appointments', (err) => {
              if (err) {
                console.error('❌ Failed to drop old table:', err);
                db.run('ROLLBACK');
                return reject(err);
              }

              // Rename new table to original name
              db.run('ALTER TABLE appointments_new RENAME TO appointments', (err) => {
                if (err) {
                  console.error('❌ Failed to rename new table:', err);
                  db.run('ROLLBACK');
                  return reject(err);
                }

                // Recreate indexes
                const createIndexes = [
                  'CREATE INDEX IF NOT EXISTS idx_appointments_studio_date ON appointments(studio_id, appointment_date)',
                  'CREATE INDEX IF NOT EXISTS idx_appointments_customer ON appointments(customer_id)',
                  'CREATE INDEX IF NOT EXISTS idx_appointments_date ON appointments(appointment_date)',
                  'CREATE INDEX IF NOT EXISTS idx_appointments_status ON appointments(status)'
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
                        console.log('✅ Appointment statuses updated successfully');
                        console.log('🎉 Appointment statuses migration completed successfully');
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
      console.log('Appointment statuses migration completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Appointment statuses migration failed:', error);
      process.exit(1);
    });
}