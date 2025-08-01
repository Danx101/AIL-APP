const db = require("../database/database-wrapper");

/**
 * DialogflowConversation Model
 * Handles Dialogflow conversation data operations
 */
class DialogflowConversation {
  constructor(data = {}) {
    this.id = data.id || null;
    this.lead_id = data.lead_id || null;
    this.call_log_id = data.call_log_id || null;
    this.session_id = data.session_id || null;
    this.intent_name = data.intent_name || null;
    this.confidence_score = data.confidence_score || 0;
    this.user_message = data.user_message || null;
    this.bot_response = data.bot_response || null;
    this.context_data = data.context_data || null;
    this.created_at = data.created_at || null;
  }

  /**
   * Validate conversation data
   */
  validate() {
    const errors = [];

    if (!this.lead_id) errors.push('Lead ID is required');
    if (!this.session_id) errors.push('Session ID is required');
    if (!this.user_message && !this.bot_response) {
      errors.push('Either user message or bot response is required');
    }

    return errors;
  }

  /**
   * Create a new conversation entry
   */
  async create() {
    const errors = this.validate();
    if (errors.length > 0) {
      throw new Error(`Validation failed: ${errors.join(', ')}`);
    }

    return new Promise((resolve, reject) => {
      const query = `
        INSERT INTO dialogflow_conversations (
          lead_id, call_log_id, session_id, intent_name, confidence_score,
          user_message, bot_response, context_data
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `;

      db.run(query, [
        this.lead_id,
        this.call_log_id,
        this.session_id,
        this.intent_name,
        this.confidence_score,
        this.user_message,
        this.bot_response,
        this.context_data
      ], function(err) {
        if (err) {
          reject(err);
        } else {
          resolve(this.lastID);
        }
      });
    });
  }

  /**
   * Update conversation entry
   */
  async update() {
    if (!this.id) {
      throw new Error('Cannot update conversation without ID');
    }

    const errors = this.validate();
    if (errors.length > 0) {
      throw new Error(`Validation failed: ${errors.join(', ')}`);
    }

    return new Promise((resolve, reject) => {
      const query = `
        UPDATE dialogflow_conversations SET 
          lead_id = ?, call_log_id = ?, session_id = ?, intent_name = ?,
          confidence_score = ?, user_message = ?, bot_response = ?, context_data = ?
        WHERE id = ?
      `;

      db.run(query, [
        this.lead_id,
        this.call_log_id,
        this.session_id,
        this.intent_name,
        this.confidence_score,
        this.user_message,
        this.bot_response,
        this.context_data,
        this.id
      ], function(err) {
        if (err) {
          reject(err);
        } else {
          resolve(this.changes);
        }
      });
    });
  }

  /**
   * Find conversation by ID
   */
  static async findById(id) {
    return new Promise((resolve, reject) => {
      const query = `
        SELECT dc.*, 
               l.name as lead_name, l.phone_number as lead_phone,
               lcl.twilio_call_sid
        FROM dialogflow_conversations dc
        LEFT JOIN leads l ON dc.lead_id = l.id
        LEFT JOIN lead_call_logs lcl ON dc.call_log_id = lcl.id
        WHERE dc.id = ?
      `;

      db.get(query, [id], (err, row) => {
        if (err) {
          reject(err);
        } else {
          resolve(row ? new DialogflowConversation(row) : null);
        }
      });
    });
  }

  /**
   * Find conversations by session ID
   */
  static async findBySessionId(sessionId) {
    return new Promise((resolve, reject) => {
      const query = `
        SELECT dc.*, 
               l.name as lead_name, l.phone_number as lead_phone
        FROM dialogflow_conversations dc
        LEFT JOIN leads l ON dc.lead_id = l.id
        WHERE dc.session_id = ?
        ORDER BY dc.created_at ASC
      `;

      db.all(query, [sessionId], (err, rows) => {
        if (err) {
          reject(err);
        } else {
          resolve(rows.map(row => new DialogflowConversation(row)));
        }
      });
    });
  }

  /**
   * Find conversations by lead ID
   */
  static async findByLeadId(leadId, limit = 50) {
    return new Promise((resolve, reject) => {
      const query = `
        SELECT dc.*, 
               lcl.twilio_call_sid, lcl.call_status, lcl.started_at
        FROM dialogflow_conversations dc
        LEFT JOIN lead_call_logs lcl ON dc.call_log_id = lcl.id
        WHERE dc.lead_id = ?
        ORDER BY dc.created_at DESC
        LIMIT ?
      `;

      db.all(query, [leadId, limit], (err, rows) => {
        if (err) {
          reject(err);
        } else {
          resolve(rows.map(row => new DialogflowConversation(row)));
        }
      });
    });
  }

  /**
   * Find conversations by call log ID
   */
  static async findByCallLogId(callLogId) {
    return new Promise((resolve, reject) => {
      const query = `
        SELECT * FROM dialogflow_conversations
        WHERE call_log_id = ?
        ORDER BY created_at ASC
      `;

      db.all(query, [callLogId], (err, rows) => {
        if (err) {
          reject(err);
        } else {
          resolve(rows.map(row => new DialogflowConversation(row)));
        }
      });
    });
  }

  /**
   * Get conversation statistics
   */
  static async getConversationStats(filters = {}) {
    return new Promise((resolve, reject) => {
      let query = `
        SELECT 
          COUNT(*) as total_conversations,
          COUNT(DISTINCT session_id) as unique_sessions,
          COUNT(DISTINCT lead_id) as unique_leads,
          AVG(confidence_score) as avg_confidence,
          COUNT(CASE WHEN intent_name = 'BookAppointment' THEN 1 END) as booking_intents,
          COUNT(CASE WHEN intent_name = 'DefaultFallback' THEN 1 END) as fallback_intents
        FROM dialogflow_conversations
        WHERE 1=1
      `;

      const params = [];

      // Add date filter
      if (filters.fromDate && filters.toDate) {
        query += ' AND DATE(created_at) BETWEEN ? AND ?';
        params.push(filters.fromDate, filters.toDate);
      }

      // Add lead filter
      if (filters.leadId) {
        query += ' AND lead_id = ?';
        params.push(filters.leadId);
      }

      // Add intent filter
      if (filters.intentName) {
        query += ' AND intent_name = ?';
        params.push(filters.intentName);
      }

      db.get(query, params, (err, row) => {
        if (err) {
          reject(err);
        } else {
          resolve(row);
        }
      });
    });
  }

  /**
   * Get intent distribution
   */
  static async getIntentDistribution(filters = {}) {
    return new Promise((resolve, reject) => {
      let query = `
        SELECT 
          intent_name,
          COUNT(*) as count,
          AVG(confidence_score) as avg_confidence,
          ROUND(COUNT(*) * 100.0 / (SELECT COUNT(*) FROM dialogflow_conversations), 2) as percentage
        FROM dialogflow_conversations
        WHERE intent_name IS NOT NULL
      `;

      const params = [];

      // Add filters
      if (filters.fromDate && filters.toDate) {
        query += ' AND DATE(created_at) BETWEEN ? AND ?';
        params.push(filters.fromDate, filters.toDate);
      }

      query += ' GROUP BY intent_name ORDER BY count DESC';

      db.all(query, params, (err, rows) => {
        if (err) {
          reject(err);
        } else {
          resolve(rows);
        }
      });
    });
  }

  /**
   * Get conversation transcript for a session
   */
  static async getSessionTranscript(sessionId) {
    return new Promise((resolve, reject) => {
      const query = `
        SELECT 
          user_message,
          bot_response,
          intent_name,
          confidence_score,
          created_at
        FROM dialogflow_conversations
        WHERE session_id = ?
        ORDER BY created_at ASC
      `;

      db.all(query, [sessionId], (err, rows) => {
        if (err) {
          reject(err);
        } else {
          // Format as conversation transcript
          const transcript = [];
          rows.forEach(row => {
            if (row.user_message) {
              transcript.push({
                type: 'user',
                message: row.user_message,
                timestamp: row.created_at
              });
            }
            if (row.bot_response) {
              transcript.push({
                type: 'bot',
                message: row.bot_response,
                intent: row.intent_name,
                confidence: row.confidence_score,
                timestamp: row.created_at
              });
            }
          });
          resolve(transcript);
        }
      });
    });
  }

  /**
   * Delete conversations older than specified days
   */
  static async deleteOldConversations(daysOld = 90) {
    return new Promise((resolve, reject) => {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysOld);
      
      const query = `
        DELETE FROM dialogflow_conversations
        WHERE created_at < ?
      `;

      db.run(query, [cutoffDate.toISOString()], function(err) {
        if (err) {
          reject(err);
        } else {
          resolve(this.changes);
        }
      });
    });
  }

  /**
   * Static method to create conversation entry
   */
  static async create(data) {
    const conversation = new DialogflowConversation(data);
    const id = await conversation.create();
    conversation.id = id;
    return conversation;
  }
}

module.exports = DialogflowConversation;