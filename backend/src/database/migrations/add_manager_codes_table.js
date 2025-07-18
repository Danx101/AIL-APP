const db = require('../connection');

/**
 * Migration to add manager_codes table and update users table
 */
async function runMigration() {
  return new Promise((resolve, reject) => {
    db.serialize(() => {
      // Add city column to studios table if it doesn't exist
      db.run(`ALTER TABLE studios ADD COLUMN city TEXT`, (err) => {
        if (err && !err.message.includes('duplicate column')) {
          console.error('Error adding city column to studios:', err.message);
        }
      });

      // Create manager_codes table
      db.run(`
        CREATE TABLE IF NOT EXISTS manager_codes (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          code TEXT UNIQUE NOT NULL,
          intended_owner_name TEXT NOT NULL,
          intended_city TEXT NOT NULL,
          intended_studio_name TEXT,
          created_by_manager_id INTEGER NOT NULL,
          used_by_user_id INTEGER,
          is_used BOOLEAN DEFAULT 0,
          expires_at DATETIME,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (created_by_manager_id) REFERENCES users(id),
          FOREIGN KEY (used_by_user_id) REFERENCES users(id)
        )
      `, (err) => {
        if (err) {
          console.error('Error creating manager_codes table:', err.message);
          reject(err);
        } else {
          console.log('✅ Manager codes table created successfully');
          resolve();
        }
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