const db = require('../database/database-wrapper');

/**
 * LeadStatsLogger - Simple utility for tracking essential lead statistics
 * Tracks only 'created' and 'converted' events for 30-day metrics
 */
class LeadStatsLogger {
  
  /**
   * Log a lead statistic event
   * @param {number} studioId - Studio ID
   * @param {number} leadId - Lead ID  
   * @param {string} eventType - 'created' or 'converted'
   * @param {Date} [eventDate] - Date of event (defaults to today)
   * @returns {Promise<number>} - Inserted record ID
   */
  static async logEvent(studioId, leadId, eventType, eventDate = null) {
    try {
      // Validate required parameters
      if (!studioId || !leadId || !eventType) {
        throw new Error('studioId, leadId, and eventType are required');
      }

      // Validate event type
      if (!['created', 'converted'].includes(eventType)) {
        throw new Error('eventType must be "created" or "converted"');
      }

      // Use provided date or current date
      const date = eventDate ? eventDate.toISOString().split('T')[0] : new Date().toISOString().split('T')[0];

      const result = await db.run(
        `INSERT INTO lead_stats (studio_id, lead_id, event_type, event_date) 
         VALUES (?, ?, ?, ?)`,
        [studioId, leadId, eventType, date]
      );

      return result.insertId;
    } catch (error) {
      console.error('Error logging lead stat:', error);
      // Don't throw - stats logging should never break main functionality
      return null;
    }
  }

  /**
   * Log lead creation event
   * @param {number} studioId - Studio ID
   * @param {number} leadId - Lead ID
   * @param {Date} [createdDate] - Creation date (defaults to today)
   */
  static async logLeadCreated(studioId, leadId, createdDate = null) {
    return this.logEvent(studioId, leadId, 'created', createdDate);
  }

  /**
   * Log lead conversion event
   * @param {number} studioId - Studio ID
   * @param {number} leadId - Lead ID
   * @param {Date} [convertedDate] - Conversion date (defaults to today)
   */
  static async logLeadConverted(studioId, leadId, convertedDate = null) {
    return this.logEvent(studioId, leadId, 'converted', convertedDate);
  }
}

module.exports = LeadStatsLogger;