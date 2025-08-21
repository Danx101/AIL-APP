const db = require('../database/database-wrapper');

/**
 * LeadActivityLogger - Centralized utility for logging lead activities
 * Provides consistent activity tracking across the application
 */
class LeadActivityLogger {
  
  /**
   * Activity types supported by the MySQL table enum
   * Based on existing table structure: enum('status_change','call','email','sms','note','appointment_scheduled','appointment_completed','conversion','archive')
   * Extended with: 'new', 'moved', 'reactivated' for frontend filter support
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
    ARCHIVE: 'archive',
    NEW: 'new',          // For manually added or imported from Google Sheets
    MOVED: 'moved',      // For status changes to IN_BEARBEITUNG, QUALIFIZIERT, PROBEBEHANDLUNG_GEPLANT
    REACTIVATED: 'reactivated'  // For leads moved back from archive
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

      const params = [leadId, studioId, activityType, description, fromStatus, toStatus, metadata ? JSON.stringify(metadata) : null, createdBy];
      
      const result = await db.run(sql, params);
      const activityId = result.lastID || result.insertId;

      console.log(`✅ Logged activity: ${activityType} for lead ${leadId} (activity ID: ${activityId})`);
      return activityId;

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
   * Log new lead activity (manually added or imported)
   */
  static async logNewLead(leadId, studioId, createdBy, source = 'manual') {
    return this.logActivity({
      leadId,
      studioId,
      activityType: this.ACTIVITY_TYPES.NEW,
      description: `New lead added${source === 'google_sheets' ? ' from Google Sheets' : ' manually'}`,
      metadata: { source },
      createdBy
    });
  }

  /**
   * Log lead moved to working statuses
   */
  static async logLeadMoved(leadId, studioId, createdBy, fromStatus, toStatus) {
    const workingStatuses = ['IN_BEARBEITUNG', 'QUALIFIZIERT', 'PROBEBEHANDLUNG_GEPLANT'];
    if (workingStatuses.includes(toStatus)) {
      return this.logActivity({
        leadId,
        studioId,
        activityType: this.ACTIVITY_TYPES.MOVED,
        description: `Lead moved from ${fromStatus} to ${toStatus}`,
        fromStatus,
        toStatus,
        metadata: { timestamp: new Date().toISOString() },
        createdBy
      });
    }
    // Fall back to regular status change
    return this.logStatusChange(leadId, studioId, createdBy, fromStatus, toStatus);
  }

  /**
   * Log lead reactivation
   */
  static async logReactivation(leadId, studioId, createdBy, fromStatus) {
    return this.logActivity({
      leadId,
      studioId,
      activityType: this.ACTIVITY_TYPES.REACTIVATED,
      description: `Lead reactivated from ${fromStatus}`,
      fromStatus,
      toStatus: 'NEU',
      metadata: { reactivatedAt: new Date().toISOString() },
      createdBy
    });
  }

  /**
   * Log archive activity
   */
  static async logArchive(leadId, studioId, createdBy, reason) {
    return this.logActivity({
      leadId,
      studioId,
      activityType: this.ACTIVITY_TYPES.ARCHIVE,
      description: `Lead archived: ${reason}`,
      metadata: { reason, archivedAt: new Date().toISOString() },
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
              metadata: row.metadata ? (typeof row.metadata === 'string' ? JSON.parse(row.metadata) : row.metadata) : null
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
        AND created_at >= DATE_SUB(CURRENT_DATE(), INTERVAL 30 DAY)
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

  /**
   * Clean up old activities (older than specified days)
   * @param {number} retentionDays - Number of days to retain activities
   * @returns {Promise<number>} - Number of deleted records
   */
  static async cleanupOldActivities(retentionDays = 30) {
    try {
      const sql = `
        DELETE FROM lead_activities
        WHERE created_at < DATE_SUB(CURRENT_DATE(), INTERVAL ${retentionDays} DAY)
      `;

      const result = await db.run(sql, []);
      const deletedCount = result.changes || 0;
      console.log(`✅ Cleaned up ${deletedCount} old activities`);
      return deletedCount;

    } catch (error) {
      console.error('❌ Error in cleanupOldActivities:', error);
      throw error;
    }
  }
}

module.exports = LeadActivityLogger;