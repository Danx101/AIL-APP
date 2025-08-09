const db = require('../src/database/database-wrapper');

async function cleanupExpiredCodes() {
  try {
    await db.init();
    console.log('Connected to MySQL database');

    // Delete expired activation codes
    console.log('Cleaning up expired activation codes...');
    const activationResult = await db.run(`
      DELETE FROM activation_codes 
      WHERE expires_at IS NOT NULL AND expires_at <= NOW()
    `);
    console.log(`✅ Deleted ${activationResult.changes} expired activation codes`);

    // Delete expired manager codes
    console.log('Cleaning up expired manager codes...');
    const managerResult = await db.run(`
      DELETE FROM manager_codes 
      WHERE expires_at IS NOT NULL AND expires_at <= NOW()
    `);
    console.log(`✅ Deleted ${managerResult.changes} expired manager codes`);

    console.log('✅ Cleanup completed successfully');

  } catch (error) {
    console.error('❌ Error during cleanup:', error.message);
    console.error('Stack:', error.stack);
  } finally {
    await db.close();
  }
}

// Run cleanup
cleanupExpiredCodes();

// This script can be run via cron job:
// Add to crontab: 0 0 * * * node /path/to/backend/scripts/cleanup-expired-codes.js