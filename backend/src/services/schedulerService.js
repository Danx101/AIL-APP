const cron = require('node-cron');
const googleSheetsService = require('./googleSheetsService');

class SchedulerService {
  constructor() {
    this.jobs = new Map();
    this.initialized = false;
  }

  /**
   * Initialize scheduler service
   */
  async initialize() {
    try {
      // Start auto-sync job if enabled
      if (process.env.AUTO_SYNC_ENABLED === 'true') {
        await this.scheduleAutoSync();
      }

      this.initialized = true;
      console.log('✅ Scheduler service initialized successfully');
      
    } catch (error) {
      console.error('❌ Failed to initialize scheduler service:', error);
    }
  }

  /**
   * Schedule automatic Google Sheets sync
   */
  async scheduleAutoSync() {
    try {
      const intervalMinutes = parseInt(process.env.AUTO_SYNC_INTERVAL_MINUTES) || 30;
      
      // Create cron expression for the interval
      let cronExpression;
      if (intervalMinutes === 30) {
        cronExpression = '*/30 * * * *'; // Every 30 minutes
      } else if (intervalMinutes === 15) {
        cronExpression = '*/15 * * * *'; // Every 15 minutes
      } else if (intervalMinutes === 60) {
        cronExpression = '0 * * * *'; // Every hour
      } else if (intervalMinutes === 5) {
        cronExpression = '*/5 * * * *'; // Every 5 minutes (for testing)
      } else {
        cronExpression = `*/${intervalMinutes} * * * *`; // Custom interval
      }

      // Schedule the job
      const job = cron.schedule(cronExpression, async () => {
        console.log(`🔄 Starting scheduled Google Sheets auto-sync (every ${intervalMinutes} minutes)`);
        
        try {
          await googleSheetsService.scheduleAutoSync();
          console.log('✅ Scheduled auto-sync completed successfully');
        } catch (error) {
          console.error('❌ Scheduled auto-sync failed:', error);
        }
      }, {
        scheduled: false, // Don't start immediately
        timezone: 'Europe/Berlin' // German timezone
      });

      // Start the job
      job.start();
      this.jobs.set('google-sheets-sync', job);

      console.log(`📅 Auto-sync scheduled to run every ${intervalMinutes} minutes`);
      console.log(`📅 Cron expression: ${cronExpression}`);

    } catch (error) {
      console.error('Error scheduling auto-sync:', error);
      throw error;
    }
  }

  /**
   * Schedule daily cleanup tasks
   */
  async scheduleDailyCleanup() {
    try {
      // Run cleanup every day at 2 AM
      const job = cron.schedule('0 2 * * *', async () => {
        console.log('🧹 Starting daily cleanup tasks');
        
        try {
          await this.performDailyCleanup();
          console.log('✅ Daily cleanup completed successfully');
        } catch (error) {
          console.error('❌ Daily cleanup failed:', error);
        }
      }, {
        scheduled: true,
        timezone: 'Europe/Berlin'
      });

      this.jobs.set('daily-cleanup', job);
      console.log('📅 Daily cleanup scheduled for 2:00 AM');

    } catch (error) {
      console.error('Error scheduling daily cleanup:', error);
      throw error;
    }
  }

  /**
   * Schedule lead follow-up reminders
   */
  async scheduleLeadReminders() {
    try {
      // Check for follow-up reminders every hour
      const job = cron.schedule('0 * * * *', async () => {
        console.log('📬 Checking for lead follow-up reminders');
        
        try {
          await this.checkLeadReminders();
          console.log('✅ Lead reminder check completed');
        } catch (error) {
          console.error('❌ Lead reminder check failed:', error);
        }
      }, {
        scheduled: true,
        timezone: 'Europe/Berlin'
      });

      this.jobs.set('lead-reminders', job);
      console.log('📅 Lead reminders scheduled to check every hour');

    } catch (error) {
      console.error('Error scheduling lead reminders:', error);
      throw error;
    }
  }

  /**
   * Perform daily cleanup tasks
   */
  async performDailyCleanup() {
    const db = require("../database/database-wrapper");
    
    return new Promise((resolve, reject) => {
      db.serialize(() => {
        // Clean up old call logs (older than 90 days)
        db.run(`
          DELETE FROM lead_call_logs 
          WHERE created_at < datetime('now', '-90 days')
        `, (err) => {
          if (err) {
            console.error('Error cleaning up old call logs:', err);
          } else {
            console.log('✅ Cleaned up old call logs');
          }
        });

        // Clean up old Dialogflow conversations (older than 30 days)
        db.run(`
          DELETE FROM dialogflow_conversations 
          WHERE created_at < datetime('now', '-30 days')
        `, (err) => {
          if (err) {
            console.error('Error cleaning up old conversations:', err);
          } else {
            console.log('✅ Cleaned up old conversations');
          }
        });

        // Update lead scores based on activity
        db.run(`
          UPDATE leads SET 
            lead_score = CASE 
              WHEN last_contacted IS NULL THEN lead_score - 1
              WHEN last_contacted < datetime('now', '-30 days') THEN lead_score - 2
              WHEN last_contacted > datetime('now', '-7 days') THEN lead_score + 1
              ELSE lead_score
            END
          WHERE lead_score > 0
        `, (err) => {
          if (err) {
            console.error('Error updating lead scores:', err);
          } else {
            console.log('✅ Updated lead scores based on activity');
          }
        });

        resolve();
      });
    });
  }

  /**
   * Check for lead follow-up reminders
   */
  async checkLeadReminders() {
    const db = require("../database/database-wrapper");
    
    return new Promise((resolve, reject) => {
      const sql = `
        SELECT l.*, s.studio_name, u.email as owner_email
        FROM leads l
        JOIN studios s ON l.studio_id = s.id
        JOIN users u ON s.owner_id = u.id
        WHERE l.next_follow_up IS NOT NULL 
        AND date(l.next_follow_up) = date('now')
        AND l.status NOT IN ('converted', 'lost')
      `;

      db.all(sql, [], (err, rows) => {
        if (err) {
          console.error('Error checking lead reminders:', err);
          reject(err);
          return;
        }

        if (rows.length > 0) {
          console.log(`📬 Found ${rows.length} leads requiring follow-up today`);
          
          // TODO: Send email notifications to studio owners
          // This would integrate with an email service
          rows.forEach(lead => {
            console.log(`📬 Follow-up reminder: ${lead.name} (${lead.phone_number}) for ${lead.studio_name}`);
          });
        }

        resolve(rows);
      });
    });
  }

  /**
   * Stop a specific scheduled job
   */
  stopJob(jobName) {
    const job = this.jobs.get(jobName);
    if (job) {
      job.stop();
      this.jobs.delete(jobName);
      console.log(`⏹️ Stopped job: ${jobName}`);
      return true;
    }
    return false;
  }

  /**
   * Stop all scheduled jobs
   */
  stopAllJobs() {
    this.jobs.forEach((job, name) => {
      job.stop();
      console.log(`⏹️ Stopped job: ${name}`);
    });
    this.jobs.clear();
    console.log('⏹️ All scheduled jobs stopped');
  }

  /**
   * Get status of all jobs
   */
  getJobStatus() {
    const status = {};
    this.jobs.forEach((job, name) => {
      status[name] = {
        running: job.running,
        scheduled: job.scheduled
      };
    });
    return status;
  }

  /**
   * Manually trigger Google Sheets sync
   */
  async triggerManualSync() {
    try {
      console.log('🔄 Manual Google Sheets sync triggered');
      await googleSheetsService.scheduleAutoSync();
      console.log('✅ Manual sync completed successfully');
      return { success: true, message: 'Manual sync completed' };
    } catch (error) {
      console.error('❌ Manual sync failed:', error);
      return { success: false, error: error.message };
    }
  }
}

module.exports = new SchedulerService();