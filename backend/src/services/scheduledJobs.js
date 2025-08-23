const cron = require('node-cron');
const db = require('../database/database-wrapper');

class ScheduledJobs {
  constructor() {
    this.jobs = new Map();
  }

  // Initialize all scheduled jobs
  initialize() {
    console.log('🕐 Initializing scheduled jobs...');
    
    // Clean up unverified users daily at 2 AM
    this.scheduleUnverifiedUserCleanup();
    
    console.log('✅ Scheduled jobs initialized');
  }

  // Clean up unverified users older than 7 days
  scheduleUnverifiedUserCleanup() {
    const job = cron.schedule('0 2 * * *', async () => {
      try {
        console.log('🧹 Starting cleanup of unverified users...');
        
        // Find unverified users older than 7 days
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - 7);
        
        const unverifiedUsers = await db.all(
          `SELECT id, email, first_name, last_name, created_at 
           FROM users 
           WHERE email_verified = FALSE 
           AND created_at < ? 
           AND role = 'studio_owner'`, // Only clean up studio owners for now
          [cutoffDate.toISOString()]
        );

        if (unverifiedUsers.length === 0) {
          console.log('ℹ️  No unverified users to clean up');
          return;
        }

        console.log(`🗑️  Found ${unverifiedUsers.length} unverified users to clean up`);

        // Log users being deleted for audit trail
        for (const user of unverifiedUsers) {
          console.log(`   Deleting unverified user: ${user.email} (ID: ${user.id}, Created: ${user.created_at})`);
        }

        // Delete unverified users
        const userIds = unverifiedUsers.map(u => u.id);
        const placeholders = userIds.map(() => '?').join(',');
        
        const result = await db.run(
          `DELETE FROM users WHERE id IN (${placeholders})`,
          userIds
        );

        console.log(`✅ Cleanup completed: ${result.changes} unverified users deleted`);

        // Optional: Log to a cleanup audit table if it exists
        try {
          await db.run(
            `INSERT INTO cleanup_audit (type, count, details, performed_at) 
             VALUES ('unverified_users', ?, ?, NOW())`,
            [result.changes, JSON.stringify(unverifiedUsers.map(u => ({ id: u.id, email: u.email })))]
          );
        } catch (auditError) {
          // Audit table might not exist, ignore error
          console.log('ℹ️  Cleanup audit logging skipped (table may not exist)');
        }

      } catch (error) {
        console.error('❌ Error during unverified user cleanup:', error);
      }
    }, {
      scheduled: false // Don't start immediately
    });

    this.jobs.set('unverifiedUserCleanup', job);
    console.log('📅 Scheduled unverified user cleanup job (daily at 2 AM)');
    return job;
  }

  // Start all jobs
  start() {
    console.log('▶️  Starting all scheduled jobs...');
    for (const [name, job] of this.jobs) {
      job.start();
      console.log(`   Started job: ${name}`);
    }
  }

  // Stop all jobs
  stop() {
    console.log('⏹️  Stopping all scheduled jobs...');
    for (const [name, job] of this.jobs) {
      job.stop();
      console.log(`   Stopped job: ${name}`);
    }
  }

  // Manual cleanup function for testing
  async runUnverifiedUserCleanup() {
    console.log('🧪 Running manual cleanup of unverified users...');
    
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - 7);
      
      const unverifiedUsers = await db.all(
        `SELECT id, email, first_name, last_name, created_at 
         FROM users 
         WHERE email_verified = FALSE 
         AND created_at < ? 
         AND role = 'studio_owner'`,
        [cutoffDate.toISOString()]
      );

      if (unverifiedUsers.length === 0) {
        console.log('ℹ️  No unverified users to clean up');
        return { cleaned: 0, users: [] };
      }

      console.log(`🗑️  Found ${unverifiedUsers.length} unverified users to clean up`);

      const userIds = unverifiedUsers.map(u => u.id);
      const placeholders = userIds.map(() => '?').join(',');
      
      const result = await db.run(
        `DELETE FROM users WHERE id IN (${placeholders})`,
        userIds
      );

      console.log(`✅ Manual cleanup completed: ${result.changes} unverified users deleted`);
      
      return { 
        cleaned: result.changes, 
        users: unverifiedUsers.map(u => ({ id: u.id, email: u.email, created_at: u.created_at }))
      };

    } catch (error) {
      console.error('❌ Error during manual cleanup:', error);
      throw error;
    }
  }

  // Get status of all jobs
  getStatus() {
    const status = {};
    for (const [name, job] of this.jobs) {
      status[name] = {
        running: job.running || false,
        scheduled: job.scheduled || false
      };
    }
    return status;
  }
}

// Create singleton instance
const scheduledJobs = new ScheduledJobs();

module.exports = scheduledJobs;