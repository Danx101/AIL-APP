const mysql = require('mysql2/promise');
const path = require('path');

// Load environment variables
if (process.env.NODE_ENV !== 'production') {
  require('dotenv').config({ path: path.join(__dirname, '../.env') });
}

async function deleteAllCustomers() {
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
    console.log('🗑️  Starting complete customer data cleanup...\n');

    try {
      // 1. Delete all appointments for customers
      console.log('📝 Step 1: Deleting all customer appointments...');
      const [appointmentResult] = await connection.execute(
        'DELETE FROM appointments WHERE customer_id IS NOT NULL'
      );
      console.log(`  ✓ Deleted ${appointmentResult.affectedRows} appointments`);
      
      // 2. Delete all customer sessions
      console.log('\n📝 Step 2: Deleting all customer sessions...');
      const [sessionResult] = await connection.execute(
        'DELETE FROM customer_sessions'
      );
      console.log(`  ✓ Deleted ${sessionResult.affectedRows} session blocks`);
      
      // 3. Get all customer user IDs before deleting customers
      console.log('\n📝 Step 3: Finding customer user accounts...');
      const [customerUsers] = await connection.execute(
        'SELECT user_id FROM customers WHERE user_id IS NOT NULL'
      );
      const userIds = customerUsers.map(u => u.user_id);
      console.log(`  Found ${userIds.length} customer user accounts`);
      
      // 4. Delete all customers
      console.log('\n📝 Step 4: Deleting all customers...');
      const [customerResult] = await connection.execute(
        'DELETE FROM customers'
      );
      console.log(`  ✓ Deleted ${customerResult.affectedRows} customers`);
      
      // 5. Delete customer user accounts
      if (userIds.length > 0) {
        console.log('\n📝 Step 5: Deleting customer user accounts...');
        const placeholders = userIds.map(() => '?').join(',');
        const [userResult] = await connection.execute(
          `DELETE FROM users WHERE id IN (${placeholders})`,
          userIds
        );
        console.log(`  ✓ Deleted ${userResult.affectedRows} user accounts`);
      }
      
      // 6. Also delete any remaining customer role users (safety check)
      console.log('\n📝 Step 6: Safety check - removing any remaining customer users...');
      const [safetyResult] = await connection.execute(
        'DELETE FROM users WHERE role = "customer"'
      );
      console.log(`  ✓ Deleted ${safetyResult.affectedRows} additional customer accounts`);
      
      // Commit transaction
      await connection.commit();
      console.log('\n✅ All customer data deleted successfully!');
      
      // Verify final state
      console.log('\n📊 Verifying clean state...\n');
      
      const [customers] = await connection.execute('SELECT COUNT(*) as count FROM customers');
      console.log(`  Customers remaining: ${customers[0].count}`);
      
      const [sessions] = await connection.execute('SELECT COUNT(*) as count FROM customer_sessions');
      console.log(`  Session blocks remaining: ${sessions[0].count}`);
      
      const [customerAppointments] = await connection.execute(
        'SELECT COUNT(*) as count FROM appointments WHERE customer_id IS NOT NULL'
      );
      console.log(`  Customer appointments remaining: ${customerAppointments[0].count}`);
      
      const [customerUserCount] = await connection.execute(
        'SELECT COUNT(*) as count FROM users WHERE role = "customer"'
      );
      console.log(`  Customer user accounts remaining: ${customerUserCount[0].count}`);
      
      // Show remaining users (should be studio owners/admins only)
      const [remainingUsers] = await connection.execute(
        'SELECT id, email, role, first_name, last_name FROM users'
      );
      console.log('\n📋 Remaining users (studio owners/admins):');
      if (remainingUsers.length > 0) {
        console.table(remainingUsers);
      } else {
        console.log('  No users remaining');
      }
      
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
console.log('⚠️  WARNING: This will delete ALL customer data!\n');
console.log('This includes:');
console.log('  - All customers');
console.log('  - All customer sessions');
console.log('  - All customer appointments');
console.log('  - All customer user accounts\n');

deleteAllCustomers().catch(console.error);