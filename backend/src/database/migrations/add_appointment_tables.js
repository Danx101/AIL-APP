const db = require('../connection');

/**
 * Migration to add appointment system tables
 */
async function runMigration() {
  return new Promise((resolve, reject) => {
    db.serialize(() => {
      console.log('🚀 Starting appointment tables migration...');

      // Create appointment_types table
      db.run(`
        CREATE TABLE IF NOT EXISTS appointment_types (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          studio_id INTEGER NOT NULL,
          name TEXT NOT NULL,
          description TEXT,
          duration INTEGER NOT NULL DEFAULT 60,
          color TEXT DEFAULT '#007bff',
          is_active BOOLEAN DEFAULT 1,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (studio_id) REFERENCES studios(id) ON DELETE CASCADE
        )
      `, (err) => {
        if (err) {
          console.error('❌ Error creating appointment_types table:', err.message);
          reject(err);
          return;
        }
        console.log('✅ appointment_types table created successfully');
      });

      // Create appointments table
      db.run(`
        CREATE TABLE IF NOT EXISTS appointments (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          studio_id INTEGER NOT NULL,
          customer_id INTEGER NOT NULL,
          appointment_type_id INTEGER,
          appointment_date DATE NOT NULL,
          start_time TIME NOT NULL,
          end_time TIME NOT NULL,
          status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'cancelled', 'completed', 'no_show')),
          notes TEXT,
          created_by_user_id INTEGER NOT NULL,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (studio_id) REFERENCES studios(id) ON DELETE CASCADE,
          FOREIGN KEY (customer_id) REFERENCES users(id) ON DELETE CASCADE,
          FOREIGN KEY (appointment_type_id) REFERENCES appointment_types(id) ON DELETE SET NULL,
          FOREIGN KEY (created_by_user_id) REFERENCES users(id),
          UNIQUE(studio_id, appointment_date, start_time)
        )
      `, (err) => {
        if (err) {
          console.error('❌ Error creating appointments table:', err.message);
          reject(err);
          return;
        }
        console.log('✅ appointments table created successfully');
      });

      // Create recurring_appointments table for future use
      db.run(`
        CREATE TABLE IF NOT EXISTS recurring_appointments (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          studio_id INTEGER NOT NULL,
          customer_id INTEGER NOT NULL,
          appointment_type_id INTEGER,
          start_date DATE NOT NULL,
          end_date DATE,
          start_time TIME NOT NULL,
          end_time TIME NOT NULL,
          recurrence_pattern TEXT NOT NULL CHECK (recurrence_pattern IN ('daily', 'weekly', 'monthly')),
          recurrence_interval INTEGER DEFAULT 1,
          days_of_week TEXT,
          status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paused', 'cancelled')),
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
          console.error('❌ Error creating recurring_appointments table:', err.message);
          reject(err);
          return;
        }
        console.log('✅ recurring_appointments table created successfully');
      });

      // Insert default appointment types for existing studios
      db.all(`SELECT id, name FROM studios WHERE is_active = 1`, (err, studios) => {
        if (err) {
          console.error('❌ Error fetching studios:', err.message);
          reject(err);
          return;
        }

        if (studios.length === 0) {
          console.log('ℹ️  No active studios found, skipping default appointment types');
          console.log('✅ Appointment tables migration completed successfully');
          resolve();
          return;
        }

        let completedInserts = 0;
        const totalInserts = studios.length * 2; // 2 default types per studio

        studios.forEach(studio => {
          const defaultTypes = [
            { name: 'Behandlung', description: 'Standard Abnehmen im Liegen Behandlung', duration: 60, color: '#28a745' },
            { name: 'Beratung', description: 'Kostenlose Beratung und Aufklärung', duration: 30, color: '#17a2b8' }
          ];

          defaultTypes.forEach(type => {
            db.run(`
              INSERT INTO appointment_types (studio_id, name, description, duration, color)
              VALUES (?, ?, ?, ?, ?)
            `, [studio.id, type.name, type.description, type.duration, type.color], (err) => {
              if (err) {
                console.error(`❌ Error creating default appointment type for studio ${studio.name}:`, err.message);
                // Don't reject here, continue with other inserts
              } else {
                console.log(`✅ Created appointment type "${type.name}" for studio "${studio.name}"`);
              }
              
              completedInserts++;
              if (completedInserts === totalInserts) {
                console.log('✅ All default appointment types created successfully');
                console.log('🎉 Appointment tables migration completed successfully');
                resolve();
              }
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