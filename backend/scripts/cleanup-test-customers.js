const mysql = require('mysql2/promise');
const path = require('path');

// Load environment variables
if (process.env.NODE_ENV !== 'production') {
  require('dotenv').config({ path: path.join(__dirname, '../.env') });
}

async function cleanupTestCustomers() {
  let connection;
  
  try {
    // Database configuration
    const dbConfig = {
      host: process.env.DB_HOST || 'localhost',
      port: process.env.DB_PORT || 3306,
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME || 'abnehmen_app',
      multipleStatements: true
    };

    console.log('🔧 Connecting to database...');
    connection = await mysql.createConnection(dbConfig);
    console.log('✅ Connected to MySQL database\n');

    // Start transaction
    await connection.beginTransaction();
    console.log('🔄 Starting cleanup transaction...\n');

    try {
      // 1. Delete customers without sessions (IDs: 1, 2, 3, 4, 6, 7)
      console.log('📝 Step 1: Deleting test customers without sessions...');
      
      const customersToDelete = [1, 2, 3, 4, 6, 7];
      
      // First get user IDs to delete
      const [usersToDelete] = await connection.execute(
        'SELECT user_id FROM customers WHERE id IN (?, ?, ?, ?, ?, ?) AND user_id IS NOT NULL',
        customersToDelete
      );
      
      const userIds = usersToDelete.map(u => u.user_id);
      console.log(`  Found ${userIds.length} user accounts to delete: ${userIds.join(', ')}`);
      
      // Delete appointments for these customers
      const [appointmentResult] = await connection.execute(
        'DELETE FROM appointments WHERE customer_id IN (?, ?, ?, ?, ?, ?)',
        customersToDelete
      );
      console.log(`  ✓ Deleted ${appointmentResult.affectedRows} appointments`);
      
      // Delete customers
      const [customerResult] = await connection.execute(
        'DELETE FROM customers WHERE id IN (?, ?, ?, ?, ?, ?)',
        customersToDelete
      );
      console.log(`  ✓ Deleted ${customerResult.affectedRows} customers`);
      
      // Delete user accounts
      if (userIds.length > 0) {
        const placeholders = userIds.map(() => '?').join(',');
        const [userResult] = await connection.execute(
          `DELETE FROM users WHERE id IN (${placeholders})`,
          userIds
        );
        console.log(`  ✓ Deleted ${userResult.affectedRows} user accounts`);
      }
      
      // 2. Clean orphaned session blocks (customer IDs that don't exist)
      console.log('\n📝 Step 2: Cleaning orphaned session blocks...');
      
      // Find orphaned session blocks
      const [orphanedSessions] = await connection.execute(`
        SELECT DISTINCT cs.customer_id 
        FROM customer_sessions cs
        LEFT JOIN customers c ON cs.customer_id = c.id
        WHERE c.id IS NULL
      `);
      
      if (orphanedSessions.length > 0) {
        const orphanedIds = orphanedSessions.map(s => s.customer_id);
        console.log(`  Found orphaned sessions for customer IDs: ${orphanedIds.join(', ')}`);
        
        const placeholders = orphanedIds.map(() => '?').join(',');
        const [orphanResult] = await connection.execute(
          `DELETE FROM customer_sessions WHERE customer_id IN (${placeholders})`,
          orphanedIds
        );
        console.log(`  ✓ Deleted ${orphanResult.affectedRows} orphaned session blocks`);
      } else {
        console.log('  ✓ No orphaned session blocks found');
      }
      
      // 3. Update Lena Schmidt's acquisition type
      console.log('\n📝 Step 3: Updating Lena Schmidt...');
      
      const [updateResult] = await connection.execute(
        `UPDATE customers 
         SET acquisition_type = 'direct_purchase',
             notes = 'Test customer with sessions - kept for testing'
         WHERE id = 5`
      );
      console.log(`  ✓ Updated ${updateResult.affectedRows} customer record`);
      
      // Recalculate total sessions for Lena
      const [sessionCalc] = await connection.execute(`
        UPDATE customers c
        SET total_sessions_purchased = (
          SELECT COALESCE(SUM(total_sessions), 0)
          FROM customer_sessions cs
          WHERE cs.customer_id = c.id
        )
        WHERE c.id = 5
      `);
      console.log(`  ✓ Recalculated total sessions`);
      
      // Commit transaction
      await connection.commit();
      console.log('\n✅ Cleanup completed successfully!');
      
      // 4. Verify final state
      console.log('\n📊 Verifying final state...\n');
      
      const [customers] = await connection.execute(
        'SELECT * FROM customers'
      );
      console.log('Remaining customers:');
      console.table(customers);
      
      const [sessions] = await connection.execute(
        `SELECT cs.*, c.contact_first_name, c.contact_last_name 
         FROM customer_sessions cs
         JOIN customers c ON cs.customer_id = c.id
         ORDER BY cs.customer_id, cs.queue_position`
      );
      console.log('\nSession blocks:');
      console.table(sessions.map(s => ({
        customer: `${s.contact_first_name} ${s.contact_last_name}`,
        total_sessions: s.total_sessions,
        remaining: s.remaining_sessions,
        active: s.is_active ? 'Yes' : 'No',
        queue_pos: s.queue_position
      })));
      
      const [users] = await connection.execute(
        'SELECT COUNT(*) as customer_users FROM users WHERE role = "customer"'
      );
      console.log(`\nRemaining customer user accounts: ${users[0].customer_users}`);
      
    } catch (error) {
      await connection.rollback();
      console.error('\n❌ Error during cleanup, rolling back:', error);
      throw error;
    }
    
  } catch (error) {
    console.error('\n❌ Cleanup failed:', error.message);
    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
      console.log('\n🔒 Database connection closed');
    }
  }
}

// Run the cleanup
console.log('🧹 Starting test customer cleanup...\n');
console.log('This will:');
console.log('  - Delete customers without sessions (IDs: 1, 2, 3, 4, 6, 7)');
console.log('  - Delete their user accounts and appointments');
console.log('  - Clean orphaned session blocks');
console.log('  - Keep Lena Schmidt (ID: 5) with her 60 sessions\n');

cleanupTestCustomers().catch(console.error);