const mysql = require('mysql2/promise');

async function runMigration() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || 'hopper.proxy.rlwy.net',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || 'bbrlhmlgPbZdyKSrAeRepjooYRiSayER',
    database: process.env.DB_NAME || 'railway',
    port: process.env.DB_PORT || 34671
  });

  try {
    console.log('🚀 Starting Session Blocks Migration...\n');

    // Step 1: Check existing columns
    const [columns] = await connection.execute(
      `SELECT COLUMN_NAME 
       FROM information_schema.COLUMNS 
       WHERE TABLE_SCHEMA = DATABASE() 
       AND TABLE_NAME = 'customer_sessions'`
    );
    const existingColumns = columns.map(col => col.COLUMN_NAME);
    console.log('Existing columns:', existingColumns);

    // Step 2: Add missing columns
    if (!existingColumns.includes('payment_method')) {
      await connection.execute(`ALTER TABLE customer_sessions ADD COLUMN payment_method VARCHAR(20) DEFAULT 'cash'`);
      console.log('✅ Added payment_method column');
    }

    if (!existingColumns.includes('payment_amount')) {
      await connection.execute(`ALTER TABLE customer_sessions ADD COLUMN payment_amount DECIMAL(10,2)`);
      console.log('✅ Added payment_amount column');
    }

    if (!existingColumns.includes('status')) {
      await connection.execute(`ALTER TABLE customer_sessions ADD COLUMN status ENUM('active', 'pending', 'completed') DEFAULT 'active'`);
      console.log('✅ Added status column');
    }

    if (!existingColumns.includes('activation_date')) {
      await connection.execute(`ALTER TABLE customer_sessions ADD COLUMN activation_date DATETIME`);
      console.log('✅ Added activation_date column');
    }

    if (!existingColumns.includes('block_type')) {
      await connection.execute(`ALTER TABLE customer_sessions ADD COLUMN block_type INT`);
      console.log('✅ Added block_type column');
    }

    // Step 3: Update existing records
    console.log('\n📊 Updating existing records...');
    
    // Set status based on remaining sessions
    await connection.execute(`
      UPDATE customer_sessions 
      SET status = CASE
        WHEN remaining_sessions = 0 THEN 'completed'
        WHEN is_active = 1 THEN 'active'
        ELSE 'pending'
      END
      WHERE status IS NULL
    `);
    console.log('✅ Updated status for existing blocks');

    // Set block_type from total_sessions
    await connection.execute(`
      UPDATE customer_sessions 
      SET block_type = total_sessions
      WHERE block_type IS NULL
    `);
    console.log('✅ Set block_type values');

    // Set activation_date for active blocks
    await connection.execute(`
      UPDATE customer_sessions 
      SET activation_date = COALESCE(purchase_date, created_at)
      WHERE status = 'active' AND activation_date IS NULL
    `);
    console.log('✅ Set activation dates');

    // Step 4: Clean up duplicate active blocks per customer
    console.log('\n🧹 Cleaning up duplicate blocks...');
    
    const [duplicates] = await connection.execute(`
      SELECT customer_id, COUNT(*) as count
      FROM customer_sessions
      WHERE status = 'active'
      GROUP BY customer_id
      HAVING COUNT(*) > 1
    `);

    for (const dup of duplicates) {
      // Keep oldest active, make others pending
      const [actives] = await connection.execute(
        `SELECT id FROM customer_sessions 
         WHERE customer_id = ? AND status = 'active' 
         ORDER BY id ASC`,
        [dup.customer_id]
      );
      
      for (let i = 1; i < actives.length; i++) {
        await connection.execute(
          `UPDATE customer_sessions SET status = 'pending', activation_date = NULL WHERE id = ?`,
          [actives[i].id]
        );
      }
      console.log(`✅ Fixed customer ${dup.customer_id}: kept 1 active, ${actives.length - 1} set to pending`);
    }

    // Step 5: Clean up multiple pending blocks (keep newest)
    const [pendingDups] = await connection.execute(`
      SELECT customer_id, COUNT(*) as count
      FROM customer_sessions
      WHERE status = 'pending'
      GROUP BY customer_id
      HAVING COUNT(*) > 1
    `);

    for (const dup of pendingDups) {
      const [pendings] = await connection.execute(
        `SELECT id FROM customer_sessions 
         WHERE customer_id = ? AND status = 'pending' 
         ORDER BY id DESC`,
        [dup.customer_id]
      );
      
      // Keep first (newest), complete others
      for (let i = 1; i < pendings.length; i++) {
        await connection.execute(
          `UPDATE customer_sessions SET status = 'completed' WHERE id = ?`,
          [pendings[i].id]
        );
      }
      console.log(`✅ Fixed customer ${dup.customer_id}: kept 1 pending, ${pendings.length - 1} completed`);
    }

    // Step 6: Remove old columns if they exist
    if (existingColumns.includes('queue_position')) {
      await connection.execute(`ALTER TABLE customer_sessions DROP COLUMN queue_position`);
      console.log('✅ Removed queue_position column');
    }

    if (existingColumns.includes('is_active')) {
      await connection.execute(`ALTER TABLE customer_sessions DROP COLUMN is_active`);
      console.log('✅ Removed is_active column');
    }

    // Step 7: Show final status
    console.log('\n📈 Migration Results:');
    const [summary] = await connection.execute(`
      SELECT 
        COUNT(DISTINCT customer_id) as total_customers,
        SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) as active_blocks,
        SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending_blocks,
        SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed_blocks,
        SUM(remaining_sessions) as total_remaining_sessions
      FROM customer_sessions
    `);
    console.table(summary[0]);

    // Show updated structure
    const [structure] = await connection.execute('DESCRIBE customer_sessions');
    console.log('\n📋 Updated Table Structure:');
    console.table(structure.map(col => ({
      Field: col.Field,
      Type: col.Type,
      Null: col.Null,
      Key: col.Key,
      Default: col.Default
    })));

    console.log('\n✨ Migration completed successfully!');

  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    throw error;
  } finally {
    await connection.end();
  }
}

// Run the migration
runMigration().catch(console.error);