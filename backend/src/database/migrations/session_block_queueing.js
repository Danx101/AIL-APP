const db = require('../connection');

/**
 * Session Block Queueing System Migration
 * Adds support for multiple session blocks with FIFO consumption order
 */

const runMigration = () => {
  return new Promise((resolve, reject) => {
    console.log('🚀 Starting session block queueing migration...');

    db.serialize(() => {
      // Add block_order column for FIFO consumption
      const addBlockOrderColumn = `
        ALTER TABLE customer_sessions 
        ADD COLUMN block_order INTEGER DEFAULT 1
      `;

      // Add block_type column for different session block types
      const addBlockTypeColumn = `
        ALTER TABLE customer_sessions 
        ADD COLUMN block_type TEXT DEFAULT 'standard'
      `;

      // Create index for efficient FIFO queries
      const createBlockOrderIndex = `
        CREATE INDEX IF NOT EXISTS idx_customer_sessions_block_order 
        ON customer_sessions(customer_id, studio_id, block_order, is_active)
      `;

      // Update existing records to have proper block_order
      const updateExistingBlockOrder = `
        UPDATE customer_sessions 
        SET block_order = id 
        WHERE block_order IS NULL OR block_order = 1
      `;

      // Execute migrations step by step
      db.run(addBlockOrderColumn, (err) => {
        if (err && !err.message.includes('duplicate column name')) {
          console.error('❌ Failed to add block_order column:', err);
          return reject(err);
        }
        console.log('✅ block_order column added successfully');

        db.run(addBlockTypeColumn, (err) => {
          if (err && !err.message.includes('duplicate column name')) {
            console.error('❌ Failed to add block_type column:', err);
            return reject(err);
          }
          console.log('✅ block_type column added successfully');

          db.run(createBlockOrderIndex, (err) => {
            if (err) {
              console.error('❌ Failed to create block_order index:', err);
              return reject(err);
            }
            console.log('✅ block_order index created successfully');

            db.run(updateExistingBlockOrder, (err) => {
              if (err) {
                console.error('❌ Failed to update existing block orders:', err);
                return reject(err);
              }
              console.log('✅ Existing session blocks updated with proper ordering');
              console.log('🎉 Session block queueing migration completed successfully');
              resolve();
            });
          });
        });
      });
    });
  });
};

const rollbackMigration = () => {
  return new Promise((resolve, reject) => {
    console.log('🔄 Rolling back session block queueing migration...');

    db.serialize(() => {
      // Note: SQLite doesn't support DROP COLUMN, so we'll just reset values
      const resetBlockOrder = `
        UPDATE customer_sessions 
        SET block_order = 1, block_type = 'standard'
      `;

      const dropBlockOrderIndex = `
        DROP INDEX IF EXISTS idx_customer_sessions_block_order
      `;

      db.run(dropBlockOrderIndex, (err) => {
        if (err) {
          console.error('❌ Failed to drop block_order index:', err);
          return reject(err);
        }
        console.log('✅ block_order index dropped');

        db.run(resetBlockOrder, (err) => {
          if (err) {
            console.error('❌ Failed to reset block orders:', err);
            return reject(err);
          }
          console.log('✅ Block orders reset to default values');
          console.log('🎉 Session block queueing rollback completed');
          resolve();
        });
      });
    });
  });
};

module.exports = {
  runMigration,
  rollbackMigration
};

// Run migration if this file is executed directly
if (require.main === module) {
  runMigration()
    .then(() => {
      console.log('Session block queueing migration completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Session block queueing migration failed:', error);
      process.exit(1);
    });
}