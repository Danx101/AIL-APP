const db = require('../database/database-wrapper');

/**
 * Notification Model
 * Handles system notifications like Google Sheets imports
 */
class Notification {
  constructor({
    id = null,
    studio_id,
    type,
    title,
    message,
    metadata = null,
    is_read = false,
    created_at = null,
    read_at = null
  }) {
    this.id = id;
    this.studio_id = studio_id;
    this.type = type; // 'google_sheets_import', 'system', 'warning', etc.
    this.title = title;
    this.message = message;
    this.metadata = metadata; // JSON data for additional info
    this.is_read = is_read;
    this.created_at = created_at;
    this.read_at = read_at;
  }

  /**
   * Save notification to database
   */
  async save() {
    try {
      if (this.id) {
        // Update existing notification
        await db.run(`
          UPDATE notifications 
          SET title = ?, message = ?, metadata = ?, is_read = ?, read_at = ?
          WHERE id = ?
        `, [this.title, this.message, this.metadata ? JSON.stringify(this.metadata) : null, 
            this.is_read, this.read_at, this.id]);
        return this.id;
      } else {
        // Create new notification
        const result = await db.run(`
          INSERT INTO notifications (studio_id, type, title, message, metadata, is_read, created_at)
          VALUES (?, ?, ?, ?, ?, ?, NOW())
        `, [this.studio_id, this.type, this.title, this.message, 
            this.metadata ? JSON.stringify(this.metadata) : null, this.is_read]);
        
        this.id = result.insertId || result.lastID;
        return this.id;
      }
    } catch (error) {
      console.error('Error saving notification:', error);
      throw error;
    }
  }

  /**
   * Mark notification as read
   */
  async markAsRead() {
    try {
      this.is_read = true;
      this.read_at = new Date().toISOString();
      
      await db.run(`
        UPDATE notifications 
        SET is_read = TRUE, read_at = NOW()
        WHERE id = ?
      `, [this.id]);
      
      return true;
    } catch (error) {
      console.error('Error marking notification as read:', error);
      throw error;
    }
  }

  /**
   * Get notifications for a studio
   */
  static async findByStudio(studioId, options = {}) {
    try {
      const { limit = 50, offset = 0, unreadOnly = false } = options;
      
      let sql = `
        SELECT * FROM notifications 
        WHERE studio_id = ?
      `;
      
      const params = [studioId];
      
      if (unreadOnly) {
        sql += ' AND is_read = FALSE';
      }
      
      sql += ` ORDER BY created_at DESC LIMIT ${limit} OFFSET ${offset}`;
      
      const rows = await db.all(sql, params);
      
      return rows.map(row => {
        let metadata = null;
        if (row.metadata) {
          try {
            // Handle case where metadata is already an object (MySQL) vs string (SQLite)
            metadata = typeof row.metadata === 'string' ? JSON.parse(row.metadata) : row.metadata;
          } catch (error) {
            console.warn('Invalid metadata JSON for notification', row.id, ':', row.metadata);
            metadata = null;
          }
        }
        
        return new Notification({
          ...row,
          metadata
        });
      });
    } catch (error) {
      console.error('Error getting studio notifications:', error);
      throw error;
    }
  }

  /**
   * Get unread notification count for studio
   */
  static async getUnreadCount(studioId) {
    try {
      const result = await db.get(`
        SELECT COUNT(*) as count 
        FROM notifications 
        WHERE studio_id = ? AND is_read = FALSE
      `, [studioId]);
      
      return result?.count || 0;
    } catch (error) {
      console.error('Error getting unread count:', error);
      throw error;
    }
  }

  /**
   * Create Google Sheets import notification
   */
  static async createImportNotification(studioId, importResult) {
    const notification = new Notification({
      studio_id: studioId,
      type: 'google_sheets_import',
      title: 'Neue Leads',
      message: `Sie haben ${importResult.imported || 0} neue Leads bekommen!`,
      metadata: {
        imported: importResult.imported || 0,
        updated: importResult.updated || 0,
        errors: importResult.errors || [],
        timestamp: new Date().toISOString(),
        leadDetails: importResult.leadDetails || []
      }
    });

    await notification.save();
    return notification;
  }

  /**
   * Clean up old notifications (older than 30 days)
   */
  static async cleanupOld(retentionDays = 30) {
    try {
      const result = await db.run(`
        DELETE FROM notifications 
        WHERE created_at < DATE_SUB(CURRENT_DATE(), INTERVAL ${retentionDays} DAY)
      `);
      
      console.log(`🧹 Cleaned up ${result.changes || 0} old notifications`);
      return result.changes || 0;
    } catch (error) {
      console.error('Error cleaning up notifications:', error);
      throw error;
    }
  }
}

module.exports = Notification;