const db = require('../connection');

/**
 * Migration to fix appointment status constraint to include German statuses
 */
async function runMigration() {
  return new Promise((resolve, reject) => {
    db.serialize(() => {
      console.log('🚀 Starting appointment status constraint fix migration...');

      // Drop the existing appointments table constraint and recreate with both English and German statuses
      // Since SQLite doesn't support ALTER TABLE to modify CHECK constraints,
      // we need to create a new table and copy data

      // Step 1: Create new appointments table with correct constraint
      db.run(`
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
          FOREIGN KEY (appointment_type_id) REFERENCES appointment_types(id) ON DELETE SET NULL,
          FOREIGN KEY (created_by_user_id) REFERENCES users(id)
        )
      `, (err) => {
        if (err) {
          console.error('❌ Error creating new appointments table:', err.message);
          reject(err);
          return;
        }
        console.log('✅ New appointments table created successfully');

        // Step 2: Copy data from old table to new table
        db.run(`
          INSERT INTO appointments_new 
          SELECT * FROM appointments
        `, (err) => {
          if (err) {
            console.error('❌ Error copying appointment data:', err.message);
            reject(err);
            return;
          }
          console.log('✅ Appointment data copied successfully');

          // Step 3: Drop old table
          db.run('DROP TABLE appointments', (err) => {
            if (err) {
              console.error('❌ Error dropping old appointments table:', err.message);
              reject(err);
              return;
            }
            console.log('✅ Old appointments table dropped successfully');

            // Step 4: Rename new table to original name
            db.run('ALTER TABLE appointments_new RENAME TO appointments', (err) => {
              if (err) {
                console.error('❌ Error renaming new appointments table:', err.message);
                reject(err);
                return;
              }
              console.log('✅ New appointments table renamed successfully');

              // Step 5: Recreate indexes
              db.run('CREATE INDEX idx_appointments_studio_date ON appointments(studio_id, appointment_date)', (err) => {
                if (err) {
                  console.error('❌ Error creating studio_date index:', err.message);
                }
                console.log('✅ Studio_date index created');
              });

              db.run('CREATE INDEX idx_appointments_customer ON appointments(customer_id)', (err) => {
                if (err) {
                  console.error('❌ Error creating customer index:', err.message);
                }
                console.log('✅ Customer index created');
              });

              db.run('CREATE INDEX idx_appointments_date ON appointments(appointment_date)', (err) => {
                if (err) {
                  console.error('❌ Error creating date index:', err.message);
                }
                console.log('✅ Date index created');
              });

              db.run('CREATE INDEX idx_appointments_status ON appointments(status)', (err) => {
                if (err) {
                  console.error('❌ Error creating status index:', err.message);
                } else {
                  console.log('✅ Status index created');
                }
                
                console.log('🎉 Appointment status constraint fix migration completed successfully');
                resolve();
              });
            });
          });
        });
      });
    });
  });
}

module.exports = { runMigration };

// Run migration if this file is executed directly
if (require.main === module) {
  runMigration()
    .then(() => {
      console.log('✅ Migration completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Migration failed:', error);
      process.exit(1);
    });
}