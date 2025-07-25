const db = require('../connection');

/**
 * Migration to add studio settings for appointment policies
 */
async function runMigration() {
  return new Promise((resolve, reject) => {
    db.serialize(() => {
      console.log('🚀 Starting studio settings migration...');

      // Add studio settings columns
      const alterQueries = [
        `ALTER TABLE studios ADD COLUMN cancellation_advance_hours INTEGER DEFAULT 48`,
        `ALTER TABLE studios ADD COLUMN postponement_advance_hours INTEGER DEFAULT 48`,
        `ALTER TABLE studios ADD COLUMN max_advance_booking_days INTEGER DEFAULT 30`,
        `ALTER TABLE studios ADD COLUMN settings_updated_at DATETIME`
      ];

      let completedQueries = 0;
      const totalQueries = alterQueries.length;

      alterQueries.forEach((query, index) => {
        db.run(query, (err) => {
          if (err) {
            // Check if column already exists (this is safe to ignore)
            if (err.message && err.message.includes('duplicate column name')) {
              console.log(`⚠️  Column already exists (${index + 1}/${totalQueries})`);
            } else {
              console.error(`❌ Error in query ${index + 1}:`, err.message);
              reject(err);
              return;
            }
          } else {
            console.log(`✅ Added studio setting column (${index + 1}/${totalQueries})`);
          }
          
          completedQueries++;
          if (completedQueries === totalQueries) {
            console.log('✅ Studio settings columns added successfully');
            
            // Update existing studios with default values
            db.run(`
              UPDATE studios 
              SET cancellation_advance_hours = 48,
                  postponement_advance_hours = 48,
                  max_advance_booking_days = 30,
                  settings_updated_at = CURRENT_TIMESTAMP
              WHERE cancellation_advance_hours IS NULL
            `, (updateErr) => {
              if (updateErr) {
                console.error('❌ Error updating existing studios:', updateErr.message);
                reject(updateErr);
              } else {
                console.log('✅ Existing studios updated with default settings');
                console.log('🎉 Studio settings migration completed successfully');
                resolve();
              }
            });
          }
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