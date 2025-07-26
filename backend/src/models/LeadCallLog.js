const db = require('../database/connection');

class LeadCallLog {
  constructor(data) {
    this.id = data.id;
    this.lead_id = data.lead_id;
    this.studio_id = data.studio_id;
    this.initiated_by_user_id = data.initiated_by_user_id;
    this.twilio_call_sid = data.twilio_call_sid;
    this.call_status = data.call_status;
    this.call_direction = data.call_direction;
    this.duration_seconds = data.duration_seconds || 0;
    this.recording_url = data.recording_url;
    this.notes = data.notes;
    this.scheduled_at = data.scheduled_at;
    this.started_at = data.started_at;
    this.ended_at = data.ended_at;
    this.created_at = data.created_at;
  }

  // Valid call statuses
  static get STATUSES() {
    return {
      SCHEDULED: 'scheduled',
      INITIATED: 'initiated',
      RINGING: 'ringing',
      ANSWERED: 'answered',
      COMPLETED: 'completed',
      BUSY: 'busy',
      NO_ANSWER: 'no_answer',
      FAILED: 'failed',
      CANCELLED: 'cancelled'
    };
  }

  // Valid call directions
  static get DIRECTIONS() {
    return {
      OUTBOUND: 'outbound',
      INBOUND: 'inbound'
    };
  }

  /**
   * Save call log to database
   */
  async save() {
    return new Promise((resolve, reject) => {
      if (this.id) {
        // Update existing call log
        const sql = `
          UPDATE lead_call_logs SET 
            lead_id = ?, studio_id = ?, initiated_by_user_id = ?, twilio_call_sid = ?,
            call_status = ?, call_direction = ?, duration_seconds = ?, recording_url = ?,
            notes = ?, scheduled_at = ?, started_at = ?, ended_at = ?
          WHERE id = ?
        `;
        const params = [
          this.lead_id, this.studio_id, this.initiated_by_user_id, this.twilio_call_sid,
          this.call_status, this.call_direction, this.duration_seconds, this.recording_url,
          this.notes, this.scheduled_at, this.started_at, this.ended_at, this.id
        ];

        db.run(sql, params, function(err) {
          if (err) {
            reject(err);
          } else {
            resolve(this.changes);
          }
        });
      } else {
        // Create new call log
        const sql = `
          INSERT INTO lead_call_logs (
            lead_id, studio_id, initiated_by_user_id, twilio_call_sid,
            call_status, call_direction, duration_seconds, recording_url,
            notes, scheduled_at, started_at, ended_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `;
        const params = [
          this.lead_id, this.studio_id, this.initiated_by_user_id, this.twilio_call_sid,
          this.call_status, this.call_direction, this.duration_seconds, this.recording_url,
          this.notes, this.scheduled_at, this.started_at, this.ended_at
        ];

        db.run(sql, params, function(err) {
          if (err) {
            reject(err);
          } else {
            resolve(this.lastID);
          }
        });
      }
    });
  }

  /**
   * Find call log by ID
   */
  static async findById(id) {
    return new Promise((resolve, reject) => {
      const sql = `
        SELECT lcl.*, l.name as lead_name, l.phone_number, u.first_name, u.last_name
        FROM lead_call_logs lcl
        LEFT JOIN leads l ON lcl.lead_id = l.id
        LEFT JOIN users u ON lcl.initiated_by_user_id = u.id
        WHERE lcl.id = ?
      `;
      
      db.get(sql, [id], (err, row) => {
        if (err) {
          reject(err);
        } else if (row) {
          resolve(new LeadCallLog(row));
        } else {
          resolve(null);
        }
      });
    });
  }

  /**
   * Find call logs by lead ID
   */
  static async findByLeadId(leadId) {
    return new Promise((resolve, reject) => {
      const sql = `
        SELECT lcl.*, u.first_name, u.last_name
        FROM lead_call_logs lcl
        LEFT JOIN users u ON lcl.initiated_by_user_id = u.id
        WHERE lcl.lead_id = ?
        ORDER BY lcl.created_at DESC
      `;
      
      db.all(sql, [leadId], (err, rows) => {
        if (err) {
          reject(err);
        } else {
          const callLogs = rows.map(row => new LeadCallLog(row));
          resolve(callLogs);
        }
      });
    });
  }

  /**
   * Find call logs by studio ID
   */
  static async findByStudioId(studioId, options = {}) {
    return new Promise((resolve, reject) => {
      let sql = `
        SELECT lcl.*, l.name as lead_name, l.phone_number, u.first_name, u.last_name
        FROM lead_call_logs lcl
        LEFT JOIN leads l ON lcl.lead_id = l.id
        LEFT JOIN users u ON lcl.initiated_by_user_id = u.id
        WHERE lcl.studio_id = ?
      `;
      const params = [studioId];

      // Add filters
      if (options.status) {
        sql += ' AND lcl.call_status = ?';
        params.push(options.status);
      }
      
      if (options.direction) {
        sql += ' AND lcl.call_direction = ?';
        params.push(options.direction);
      }

      if (options.date_from) {
        sql += ' AND DATE(lcl.created_at) >= ?';
        params.push(options.date_from);
      }

      if (options.date_to) {
        sql += ' AND DATE(lcl.created_at) <= ?';
        params.push(options.date_to);
      }

      // Add ordering
      sql += ' ORDER BY lcl.created_at DESC';

      // Add pagination
      if (options.limit) {
        sql += ' LIMIT ?';
        params.push(parseInt(options.limit));
        
        if (options.offset) {
          sql += ' OFFSET ?';
          params.push(parseInt(options.offset));
        }
      }

      db.all(sql, params, (err, rows) => {
        if (err) {
          reject(err);
        } else {
          const callLogs = rows.map(row => new LeadCallLog(row));
          resolve(callLogs);
        }
      });
    });
  }

  /**
   * Find call log by Twilio SID
   */
  static async findByTwilioSid(twilioSid) {
    return new Promise((resolve, reject) => {
      const sql = 'SELECT * FROM lead_call_logs WHERE twilio_call_sid = ?';
      
      db.get(sql, [twilioSid], (err, row) => {
        if (err) {
          reject(err);
        } else if (row) {
          resolve(new LeadCallLog(row));
        } else {
          resolve(null);
        }
      });
    });
  }

  /**
   * Update call status
   */
  async updateStatus(newStatus, additionalData = {}) {
    return new Promise((resolve, reject) => {
      let sql = 'UPDATE lead_call_logs SET call_status = ?';
      const params = [newStatus];

      // Add optional fields to update
      if (additionalData.duration_seconds !== undefined) {
        sql += ', duration_seconds = ?';
        params.push(additionalData.duration_seconds);
      }

      if (additionalData.recording_url) {
        sql += ', recording_url = ?';
        params.push(additionalData.recording_url);
      }

      if (additionalData.started_at) {
        sql += ', started_at = ?';
        params.push(additionalData.started_at);
      }

      if (additionalData.ended_at) {
        sql += ', ended_at = ?';
        params.push(additionalData.ended_at);
      }

      if (additionalData.notes) {
        sql += ', notes = ?';
        params.push(additionalData.notes);
      }

      sql += ' WHERE id = ?';
      params.push(this.id);
      
      db.run(sql, params, function(err) {
        if (err) {
          reject(err);
        } else {
          resolve(this.changes);
        }
      });
    });
  }

  /**
   * Get call statistics for a studio
   */
  static async getStudioCallStats(studioId, dateFrom = null, dateTo = null) {
    return new Promise((resolve, reject) => {
      let sql = `
        SELECT 
          COUNT(*) as total_calls,
          COUNT(CASE WHEN call_status = 'completed' THEN 1 END) as completed_calls,
          COUNT(CASE WHEN call_status = 'answered' THEN 1 END) as answered_calls,
          COUNT(CASE WHEN call_status = 'no_answer' THEN 1 END) as no_answer_calls,
          COUNT(CASE WHEN call_status = 'busy' THEN 1 END) as busy_calls,
          COUNT(CASE WHEN call_status = 'failed' THEN 1 END) as failed_calls,
          COUNT(CASE WHEN call_direction = 'outbound' THEN 1 END) as outbound_calls,
          COUNT(CASE WHEN call_direction = 'inbound' THEN 1 END) as inbound_calls,
          SUM(duration_seconds) as total_duration_seconds,
          AVG(duration_seconds) as avg_duration_seconds,
          COUNT(CASE WHEN recording_url IS NOT NULL THEN 1 END) as recorded_calls
        FROM lead_call_logs 
        WHERE studio_id = ?
      `;
      const params = [studioId];

      if (dateFrom) {
        sql += ' AND DATE(created_at) >= ?';
        params.push(dateFrom);
      }

      if (dateTo) {
        sql += ' AND DATE(created_at) <= ?';
        params.push(dateTo);
      }
      
      db.get(sql, params, (err, row) => {
        if (err) {
          reject(err);
        } else {
          resolve(row);
        }
      });
    });
  }

  /**
   * Delete a call log
   */
  async delete() {
    return new Promise((resolve, reject) => {
      if (!this.id) {
        reject(new Error('Cannot delete call log without ID'));
        return;
      }

      const sql = 'DELETE FROM lead_call_logs WHERE id = ?';
      db.run(sql, [this.id], function(err) {
        if (err) {
          reject(err);
        } else {
          resolve(this.changes);
        }
      });
    });
  }
}

module.exports = LeadCallLog;