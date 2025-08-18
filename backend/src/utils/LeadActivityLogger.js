const db = require('../database/database-wrapper');

/**
 * LeadActivityLogger - Centralized utility for logging lead activities
 * Provides consistent activity tracking across the application
 */
class LeadActivityLogger {
  
  /**
   * Activity types supported by the MySQL table enum
   * Based on existing table structure: enum('status_change','call','email','sms','note','appointment_scheduled','appointment_completed','conversion','archive')
   */
  static ACTIVITY_TYPES = {
    STATUS_CHANGE: 'status_change',
    CALL: 'call',
    EMAIL: 'email',
    SMS: 'sms',
    NOTE: 'note',
    APPOINTMENT_SCHEDULED: 'appointment_scheduled',
    APPOINTMENT_COMPLETED: 'appointment_completed',
    CONVERSION: 'conversion',
    ARCHIVE: 'archive'
  };

  /**
   * Log a lead activity
   * @param {Object} params - Activity parameters
   * @param {number} params.leadId - Lead ID
   * @param {number} params.studioId - Studio ID  
   * @param {string} params.activityType - Type of activity (use ACTIVITY_TYPES constants)
   * @param {string} params.description - Human-readable description of the activity
   * @param {string} [params.fromStatus] - Previous status (for status_change activities)
   * @param {string} [params.toStatus] - New status (for status_change activities)
   * @param {Object} [params.metadata] - Optional metadata object (will be stored as JSON)
   * @param {number} [params.createdBy] - User ID who performed the action
   * @returns {Promise<number>} - Activity ID
   */
  static async logActivity({ leadId, studioId, activityType, description, fromStatus = null, toStatus = null, metadata = null, createdBy = null }) {
    try {
      // Validate required parameters
      if (!leadId || !studioId || !activityType || !description) {
        throw new Error('leadId, studioId, activityType, and description are required');
      }

      // Validate activity type
      if (!Object.values(this.ACTIVITY_TYPES).includes(activityType)) {
        throw new Error(`Invalid activity type: ${activityType}. Must be one of: ${Object.values(this.ACTIVITY_TYPES).join(', ')}`);
      }

      // Insert activity record using MySQL syntax
      const sql = `
        INSERT INTO lead_activities (
          lead_id, 
          studio_id, 
          activity_type, 
          description,
          from_status,
          to_status, 
          metadata, 
          created_by,
          created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW())
      `;

      const params = [leadId, studioId, activityType, description, fromStatus, toStatus, metadata, createdBy];
      
      const result = await new Promise((resolve, reject) => {
        db.run(sql, params, function(err) {
          if (err) {
            console.error('❌ Error logging lead activity:', err);
            reject(err);
          } else {
            resolve(this.lastID || this.insertId);
          }
        });
      });

      console.log(`✅ Logged activity: ${activityType} for lead ${leadId} (activity ID: ${result})`);
      return result;

    } catch (error) {
      console.error('❌ LeadActivityLogger error:', error);
      throw error;
    }
  }

  // Removed logLeadCreated and logLeadUpdated as requested - no tracking of creation/updates

  /**
   * Log status change activity
   */
  static async logStatusChange(leadId, studioId, createdBy, oldStatus, newStatus, notes = null) {
    return this.logActivity({
      leadId,
      studioId,
      activityType: this.ACTIVITY_TYPES.STATUS_CHANGE,
      description: `Status changed from "${oldStatus}" to "${newStatus}"${notes ? ` - ${notes}` : ''}`,
      fromStatus: oldStatus,
      toStatus: newStatus,
      metadata: { 
        notes 
      },
      createdBy
    });
  }

  // Removed logCall as requested - no call tracking

  /**
   * Log conversion activity
   */
  static async logConversion(leadId, studioId, createdBy, conversionData = {}) {
    const { sessionCount, registrationCode } = conversionData;
    return this.logActivity({
      leadId,
      studioId,
      activityType: this.ACTIVITY_TYPES.CONVERSION,
      description: `Converted to customer${sessionCount ? ` with ${sessionCount} sessions` : ''}${registrationCode ? ` (${registrationCode})` : ''}`,
      metadata: conversionData,
      createdBy
    });
  }

  /**
   * Get activities for a lead
   * @param {number} leadId - Lead ID
   * @param {Object} options - Query options
   * @returns {Promise<Array>} - Array of activities
   */
  static async getLeadActivities(leadId, options = {}) {
    try {
      const { limit = 50, offset = 0, activityType = null } = options;

      let sql = `
        SELECT 
          la.*,
          u.first_name,
          u.last_name
        FROM lead_activities la
        LEFT JOIN users u ON la.created_by = u.id
        WHERE la.lead_id = ?
      `;
      const params = [leadId];

      if (activityType) {
        sql += ' AND la.activity_type = ?';
        params.push(activityType);
      }

      sql += ` ORDER BY la.created_at DESC LIMIT ${limit} OFFSET ${offset}`;
      // Don't push limit/offset as parameters due to MySQL compatibility issues

      return new Promise((resolve, reject) => {
        db.all(sql, params, (err, rows) => {
          if (err) {
            console.error('❌ Error getting lead activities:', err);
            reject(err);
          } else {
            // Parse metadata JSON for each activity
            const activities = rows.map(row => ({
              ...row,
              metadata: row.metadata ? JSON.parse(row.metadata) : null
            }));
            resolve(activities);
          }
        });
      });

    } catch (error) {
      console.error('❌ Error in getLeadActivities:', error);
      throw error;
    }
  }

  /**
   * Get activity statistics for a studio
   * @param {number} studioId - Studio ID
   * @returns {Promise<Object>} - Activity statistics
   */
  static async getStudioActivityStats(studioId) {
    try {
      const sql = `
        SELECT 
          activity_type,
          COUNT(*) as count,
          DATE(created_at) as date
        FROM lead_activities 
        WHERE studio_id = ?
        AND created_at >= date('now', '-30 days')
        GROUP BY activity_type, DATE(created_at)
        ORDER BY created_at DESC
      `;

      return new Promise((resolve, reject) => {
        db.all(sql, [studioId], (err, rows) => {
          if (err) {
            console.error('❌ Error getting studio activity stats:', err);
            reject(err);
          } else {
            resolve(rows);
          }
        });
      });

    } catch (error) {
      console.error('❌ Error in getStudioActivityStats:', error);
      throw error;
    }
  }
}

module.exports = LeadActivityLogger;