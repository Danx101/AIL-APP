const db = require('../connection');

/**
 * Fix leads duplication by adding unique constraint and removing duplicates
 */
function fixLeadsDuplicates() {
  return new Promise((resolve, reject) => {
    console.log('🔧 Starting leads duplication fix...');
    
    db.serialize(() => {
      // First, find and remove duplicate leads (keep the oldest one per phone_number + studio_id)
      db.run(`
        DELETE FROM leads 
        WHERE id NOT IN (
          SELECT MIN(id) 
          FROM leads 
          GROUP BY phone_number, studio_id
        )
      `, (err) => {
        if (err) {
          console.error('❌ Error removing duplicate leads:', err.message);
          reject(err);
          return;
        }
        console.log('✅ Removed duplicate leads');
        
        // Create unique index to prevent future duplicates
        db.run(`
          CREATE UNIQUE INDEX IF NOT EXISTS idx_leads_unique_phone_studio 
          ON leads(phone_number, studio_id)
        `, (err) => {
          if (err) {
            console.error('❌ Error creating unique index:', err.message);
            reject(err);
          } else {
            console.log('✅ Created unique index for leads (phone_number + studio_id)');
            resolve();
          }
        });
      });
    });
  });
}

// Export the function for use in other migration files or manual execution
module.exports = { fixLeadsDuplicates };

// Run the migration if this file is executed directly
if (require.main === module) {
  fixLeadsDuplicates()
    .then(() => {
      console.log('✅ Leads duplication fix completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Leads duplication fix failed:', error);
      process.exit(1);
    });
}