const db = require('../src/database/database-wrapper');

async function addStudioManagerRelationship() {
  try {
    await db.init();
    console.log('Connected to MySQL database');

    // Add created_by_manager_id column to studios table
    console.log('Adding created_by_manager_id column to studios table...');
    await db.run(`
      ALTER TABLE studios 
      ADD COLUMN created_by_manager_id INT DEFAULT NULL,
      ADD FOREIGN KEY (created_by_manager_id) REFERENCES users(id) ON DELETE SET NULL
    `);
    console.log('✅ Added created_by_manager_id column to studios table');

    // Populate created_by_manager_id for existing studios based on manager_codes relationship
    console.log('Populating created_by_manager_id for existing studios...');
    const result = await db.run(`
      UPDATE studios s
      JOIN users u ON s.owner_id = u.id
      JOIN manager_codes mc ON mc.used_by_user_id = u.id
      SET s.created_by_manager_id = mc.created_by_manager_id
      WHERE s.created_by_manager_id IS NULL
    `);
    console.log(`✅ Updated ${result.changes} existing studios with manager relationships`);

    console.log('✅ Successfully added studio-manager relationship');

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error('Stack:', error.stack);
  } finally {
    await db.close();
  }
}

addStudioManagerRelationship();