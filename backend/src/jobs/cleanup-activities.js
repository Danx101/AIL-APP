const db = require('../database/database-wrapper');

/**
 * Activity Cleanup Job
 * Deletes lead activities older than 30 days to optimize performance
 * Preserves all lead data permanently - only removes activity logs
 */
class ActivityCleanupJob {
  constructor() {
    this.retentionDays = parseInt(process.env.CLEANUP_RETENTION_DAYS) || 30;
    this.batchSize = parseInt(process.env.CLEANUP_BATCH_SIZE) || 1000;
    this.dryRun = process.env.CLEANUP_DRY_RUN === 'true';
  }

  /**
   * Run the cleanup job
   * @returns {Object} Cleanup results
   */
  async run() {
    const startTime = Date.now();
    console.log(`🧹 Starting activity cleanup job (retention: ${this.retentionDays} days, dry-run: ${this.dryRun})`);

    try {
      // Calculate cutoff date
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - this.retentionDays);
      const cutoffDateStr = cutoffDate.toISOString().split('T')[0];

      // First, count activities to be deleted
      const countSql = `
        SELECT COUNT(*) as total
        FROM lead_activities
        WHERE created_at < ?
      `;

      const countResult = await new Promise((resolve, reject) => {
        db.get(countSql, [cutoffDateStr], (err, row) => {
          if (err) reject(err);
          else resolve(row);
        });
      });

      const totalToDelete = countResult?.total || 0;

      if (totalToDelete === 0) {
        console.log('✅ No activities to clean up');
        return {
          success: true,
          deleted: 0,
          duration: Date.now() - startTime,
          dryRun: this.dryRun
        };
      }

      console.log(`📊 Found ${totalToDelete} activities to delete (older than ${cutoffDateStr})`);

      // If dry run, just return the count
      if (this.dryRun) {
        console.log('🔍 Dry run mode - no data deleted');
        return {
          success: true,
          deleted: 0,
          wouldDelete: totalToDelete,
          duration: Date.now() - startTime,
          dryRun: true
        };
      }

      // Delete activities in batches
      let deletedTotal = 0;
      let batchNumber = 0;

      while (deletedTotal < totalToDelete) {
        batchNumber++;
        
        // Delete a batch
        const deleteSql = `
          DELETE FROM lead_activities
          WHERE created_at < ?
          LIMIT ${this.batchSize}
        `;

        await new Promise((resolve, reject) => {
          db.run(deleteSql, [cutoffDateStr], function(err) {
            if (err) {
              reject(err);
            } else {
              const deletedInBatch = this.changes;
              deletedTotal += deletedInBatch;
              console.log(`  Batch ${batchNumber}: Deleted ${deletedInBatch} activities (${deletedTotal}/${totalToDelete})`);
              resolve(deletedInBatch);
            }
          });
        });

        // Small delay between batches to avoid overloading
        if (deletedTotal < totalToDelete) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      }

      const duration = Date.now() - startTime;
      console.log(`✅ Cleanup completed: ${deletedTotal} activities deleted in ${duration}ms`);

      return {
        success: true,
        deleted: deletedTotal,
        duration,
        dryRun: false,
        cutoffDate: cutoffDateStr
      };

    } catch (error) {
      console.error('❌ Activity cleanup job failed:', error);
      return {
        success: false,
        error: error.message,
        duration: Date.now() - startTime,
        dryRun: this.dryRun
      };
    }
  }

  /**
   * Get cleanup statistics
   * @returns {Object} Statistics about activities
   */
  async getStats() {
    try {
      const sql = `
        SELECT 
          COUNT(*) as total_activities,
          COUNT(CASE WHEN created_at < date('now', '-${this.retentionDays} days') THEN 1 END) as to_delete,
          COUNT(CASE WHEN created_at >= date('now', '-${this.retentionDays} days') THEN 1 END) as to_keep,
          MIN(created_at) as oldest_activity,
          MAX(created_at) as newest_activity
        FROM lead_activities
      `;

      return new Promise((resolve, reject) => {
        db.get(sql, [], (err, row) => {
          if (err) reject(err);
          else resolve(row);
        });
      });
    } catch (error) {
      console.error('❌ Failed to get cleanup stats:', error);
      throw error;
    }
  }
}

module.exports = ActivityCleanupJob;