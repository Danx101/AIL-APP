require('dotenv').config();
const db = require('../src/database/database-wrapper');

async function fixCustomerSessions(customerId) {
  try {
    await db.init();
    
    console.log(`🔍 Checking sessions for customer ${customerId}...`);
    
    // Get all sessions for this customer
    const sessions = await db.all(
      `SELECT * FROM customer_sessions 
       WHERE customer_id = ? 
       ORDER BY created_at DESC`,
      [customerId]
    );
    
    console.log(`Found ${sessions.length} session blocks:`);
    sessions.forEach(s => {
      console.log(`  - Block ${s.id}: ${s.total_sessions} sessions, Status: ${s.status}, Created: ${s.created_at}`);
    });
    
    // Count active and pending blocks
    const activeBlocks = sessions.filter(s => s.status === 'active');
    const pendingBlocks = sessions.filter(s => s.status === 'pending');
    
    console.log(`\nStatus counts:`);
    console.log(`  Active blocks: ${activeBlocks.length}`);
    console.log(`  Pending blocks: ${pendingBlocks.length}`);
    
    // Fix issues
    if (activeBlocks.length > 1) {
      console.log('\n⚠️  Multiple active blocks found! Keeping only the most recent one...');
      // Keep the first (most recent) active block, set others to completed
      for (let i = 1; i < activeBlocks.length; i++) {
        await db.run(
          `UPDATE customer_sessions SET status = 'completed' WHERE id = ?`,
          [activeBlocks[i].id]
        );
        console.log(`  ✅ Set block ${activeBlocks[i].id} to completed`);
      }
    }
    
    if (pendingBlocks.length > 1) {
      console.log('\n⚠️  Multiple pending blocks found! Keeping only the most recent one...');
      // Keep the first (most recent) pending block, cancel others
      for (let i = 1; i < pendingBlocks.length; i++) {
        await db.run(
          `UPDATE customer_sessions SET status = 'cancelled', notes = CONCAT(IFNULL(notes, ''), ' | Cancelled: Duplicate pending block') WHERE id = ?`,
          [pendingBlocks[i].id]
        );
        console.log(`  ✅ Cancelled block ${pendingBlocks[i].id}`);
      }
    }
    
    // If there's no active block but there are pending blocks, activate the oldest pending
    if (activeBlocks.length === 0 && pendingBlocks.length > 0) {
      console.log('\n⚠️  No active block found but pending blocks exist. Activating the oldest pending block...');
      const oldestPending = pendingBlocks[pendingBlocks.length - 1];
      await db.run(
        `UPDATE customer_sessions 
         SET status = 'active', activation_date = NOW() 
         WHERE id = ?`,
        [oldestPending.id]
      );
      console.log(`  ✅ Activated block ${oldestPending.id}`);
    }
    
    // Verify the fix
    console.log('\n📊 Final status:');
    const finalSessions = await db.all(
      `SELECT id, total_sessions, remaining_sessions, status 
       FROM customer_sessions 
       WHERE customer_id = ? AND status IN ('active', 'pending')
       ORDER BY created_at DESC`,
      [customerId]
    );
    
    finalSessions.forEach(s => {
      console.log(`  - Block ${s.id}: ${s.remaining_sessions}/${s.total_sessions} sessions, Status: ${s.status}`);
    });
    
    console.log('\n✅ Session blocks fixed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

// Get customer ID from command line or use default
const customerId = process.argv[2] || 21;

if (!customerId) {
  console.log('Usage: node fix-customer-sessions.js [customerId]');
  console.log('Example: node fix-customer-sessions.js 21');
  process.exit(1);
}

fixCustomerSessions(customerId);