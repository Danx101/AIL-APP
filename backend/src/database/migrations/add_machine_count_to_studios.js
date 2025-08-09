const db = require('../database-wrapper');

async function up() {
  console.log('Adding machine_count column to studios table...');
  
  try {
    await db.init();
    
    // Check if column already exists
    const columns = await db.all(`
      SELECT COLUMN_NAME 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = DATABASE() 
      AND TABLE_NAME = 'studios' 
      AND COLUMN_NAME = 'machine_count'
    `);
    
    if (!columns || columns.length === 0) {
      // Add machine_count column with default value of 1
      await db.run(`
        ALTER TABLE studios 
        ADD COLUMN machine_count INT DEFAULT 1 
        COMMENT 'Number of treatment machines/devices available in the studio'
      `);
      
      console.log('✅ Added machine_count column to studios table');
    } else {
      console.log('ℹ️ machine_count column already exists in studios table');
    }
    
  } catch (error) {
    console.error('Error adding machine_count column:', error);
    throw error;
  }
}

async function down() {
  console.log('Removing machine_count column from studios table...');
  
  try {
    await db.init();
    
    // Check if column exists before trying to drop it
    const columns = await db.all(`
      SELECT COLUMN_NAME 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = DATABASE() 
      AND TABLE_NAME = 'studios' 
      AND COLUMN_NAME = 'machine_count'
    `);
    
    if (columns && columns.length > 0) {
      await db.run(`
        ALTER TABLE studios 
        DROP COLUMN machine_count
      `);
      
      console.log('✅ Removed machine_count column from studios table');
    } else {
      console.log('ℹ️ machine_count column does not exist in studios table');
    }
    
  } catch (error) {
    console.error('Error removing machine_count column:', error);
    throw error;
  }
}

module.exports = { up, down };