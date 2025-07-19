const db = require('../database/connection');

/**
 * CustomerSession Model
 * Handles customer session package data operations and business logic
 */
class CustomerSession {
  constructor(data = {}) {
    this.id = data.id || null;
    this.customer_id = data.customer_id || null;
    this.studio_id = data.studio_id || null;
    this.total_sessions = data.total_sessions || null;
    this.remaining_sessions = data.remaining_sessions || null;
    this.purchase_date = data.purchase_date || null;
    this.notes = data.notes || null;
    this.is_active = data.is_active !== undefined ? data.is_active : true;
    this.created_at = data.created_at || null;
    this.updated_at = data.updated_at || null;
  }

  /**
   * Validate customer session data
   */
  validate() {
    const errors = [];

    if (!this.customer_id) errors.push('Customer ID is required');
    if (!this.studio_id) errors.push('Studio ID is required');
    if (!this.total_sessions || this.total_sessions <= 0) {
      errors.push('Total sessions must be a positive number');
    }
    if (this.remaining_sessions < 0) {
      errors.push('Remaining sessions cannot be negative');
    }
    if (this.remaining_sessions > this.total_sessions) {
      errors.push('Remaining sessions cannot exceed total sessions');
    }

    return errors;
  }

  /**
   * Create a new customer session package
   */
  async create() {
    const errors = this.validate();
    if (errors.length > 0) {
      throw new Error(`Validation failed: ${errors.join(', ')}`);
    }

    return new Promise((resolve, reject) => {
      const query = `
        INSERT INTO customer_sessions (
          customer_id, studio_id, total_sessions, remaining_sessions, 
          purchase_date, notes, is_active
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
      `;

      db.run(query, [
        this.customer_id,
        this.studio_id,
        this.total_sessions,
        this.remaining_sessions || this.total_sessions,
        this.purchase_date || new Date().toISOString(),
        this.notes,
        this.is_active
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
   * Update existing customer session
   */
  async update() {
    if (!this.id) {
      throw new Error('Cannot update customer session without ID');
    }

    const errors = this.validate();
    if (errors.length > 0) {
      throw new Error(`Validation failed: ${errors.join(', ')}`);
    }

    return new Promise((resolve, reject) => {
      const query = `
        UPDATE customer_sessions SET 
          remaining_sessions = ?, notes = ?, is_active = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `;

      db.run(query, [
        this.remaining_sessions,
        this.notes,
        this.is_active,
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
   * Find customer session by ID
   */
  static async findById(id) {
    return new Promise((resolve, reject) => {
      const query = `
        SELECT cs.*, 
               u.first_name as customer_first_name, u.last_name as customer_last_name, u.email as customer_email,
               s.name as studio_name
        FROM customer_sessions cs
        LEFT JOIN users u ON cs.customer_id = u.id
        LEFT JOIN studios s ON cs.studio_id = s.id
        WHERE cs.id = ?
      `;

      db.get(query, [id], (err, row) => {
        if (err) {
          reject(err);
        } else {
          resolve(row ? row : null);
        }
      });
    });
  }

  /**
   * Find customer sessions by customer ID
   */
  static async findByCustomer(customerId, filters = {}) {
    return new Promise((resolve, reject) => {
      let query = `
        SELECT cs.*, 
               u.first_name as customer_first_name, u.last_name as customer_last_name, u.email as customer_email,
               s.name as studio_name
        FROM customer_sessions cs
        LEFT JOIN users u ON cs.customer_id = u.id
        LEFT JOIN studios s ON cs.studio_id = s.id
        WHERE cs.customer_id = ?
      `;

      const params = [customerId];

      // Add filters
      if (filters.is_active !== undefined) {
        query += ' AND cs.is_active = ?';
        params.push(filters.is_active);
      }

      if (filters.studio_id) {
        query += ' AND cs.studio_id = ?';
        params.push(filters.studio_id);
      }

      query += ' ORDER BY cs.created_at DESC';

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
   * Find customer sessions by studio ID
   */
  static async findByStudio(studioId, filters = {}) {
    return new Promise((resolve, reject) => {
      let query = `
        SELECT cs.*, 
               u.first_name as customer_first_name, u.last_name as customer_last_name, u.email as customer_email,
               s.name as studio_name
        FROM customer_sessions cs
        LEFT JOIN users u ON cs.customer_id = u.id
        LEFT JOIN studios s ON cs.studio_id = s.id
        WHERE cs.studio_id = ?
      `;

      const params = [studioId];

      // Add filters
      if (filters.is_active !== undefined) {
        query += ' AND cs.is_active = ?';
        params.push(filters.is_active);
      }

      if (filters.customer_id) {
        query += ' AND cs.customer_id = ?';
        params.push(filters.customer_id);
      }

      query += ' ORDER BY cs.created_at DESC';

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
   * Get active session for customer in studio
   */
  static async getActiveSession(customerId, studioId) {
    return new Promise((resolve, reject) => {
      const query = `
        SELECT cs.*, 
               u.first_name as customer_first_name, u.last_name as customer_last_name, u.email as customer_email,
               s.name as studio_name
        FROM customer_sessions cs
        LEFT JOIN users u ON cs.customer_id = u.id
        LEFT JOIN studios s ON cs.studio_id = s.id
        WHERE cs.customer_id = ? AND cs.studio_id = ? AND cs.is_active = 1 AND cs.remaining_sessions > 0
        ORDER BY cs.created_at DESC
        LIMIT 1
      `;

      db.get(query, [customerId, studioId], (err, row) => {
        if (err) {
          reject(err);
        } else {
          resolve(row ? row : null);
        }
      });
    });
  }

  /**
   * Deduct session from customer's active session package
   */
  static async deductSession(customerId, studioId, appointmentId, deductedByUserId, notes = null) {
    return new Promise(async (resolve, reject) => {
      try {
        // Get active session
        const activeSession = await CustomerSession.getActiveSession(customerId, studioId);
        
        if (!activeSession || activeSession.remaining_sessions <= 0) {
          throw new Error('No active sessions available for deduction');
        }

        // Start transaction
        db.serialize(() => {
          db.run('BEGIN TRANSACTION', (err) => {
            if (err) return reject(err);

            // Update remaining sessions
            const updateQuery = `
              UPDATE customer_sessions 
              SET remaining_sessions = remaining_sessions - 1, updated_at = CURRENT_TIMESTAMP
              WHERE id = ? AND remaining_sessions > 0
            `;

            db.run(updateQuery, [activeSession.id], function(updateErr) {
              if (updateErr) {
                db.run('ROLLBACK');
                return reject(updateErr);
              }

              if (this.changes === 0) {
                db.run('ROLLBACK');
                return reject(new Error('Failed to deduct session - no sessions available'));
              }

              // Create transaction record
              const SessionTransaction = require('./SessionTransaction');
              const transaction = new SessionTransaction({
                customer_session_id: activeSession.id,
                transaction_type: 'deduction',
                amount: -1,
                appointment_id: appointmentId,
                created_by_user_id: deductedByUserId,
                notes: notes || 'Session deducted for completed appointment'
              });

              transaction.create().then((transactionId) => {
                db.run('COMMIT', (commitErr) => {
                  if (commitErr) {
                    db.run('ROLLBACK');
                    return reject(commitErr);
                  }
                  resolve({
                    sessionId: activeSession.id,
                    transactionId: transactionId,
                    remainingSessions: activeSession.remaining_sessions - 1
                  });
                });
              }).catch((transactionErr) => {
                db.run('ROLLBACK');
                reject(transactionErr);
              });
            });
          });
        });
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Add sessions to customer's session package (top-up)
   */
  static async addSessions(customerId, studioId, sessionCount, addedByUserId, notes = null) {
    return new Promise(async (resolve, reject) => {
      try {
        // Get active session or create new one
        let activeSession = await CustomerSession.getActiveSession(customerId, studioId);
        
        if (!activeSession) {
          // Create new session package
          const newSession = new CustomerSession({
            customer_id: customerId,
            studio_id: studioId,
            total_sessions: sessionCount,
            remaining_sessions: sessionCount,
            notes: notes || `Initial session package (${sessionCount} sessions)`
          });
          
          const sessionId = await newSession.create();
          activeSession = await CustomerSession.findById(sessionId);
        }

        // Start transaction
        db.serialize(() => {
          db.run('BEGIN TRANSACTION', (err) => {
            if (err) return reject(err);

            // Update sessions
            const updateQuery = `
              UPDATE customer_sessions 
              SET remaining_sessions = remaining_sessions + ?, 
                  total_sessions = total_sessions + ?,
                  updated_at = CURRENT_TIMESTAMP
              WHERE id = ?
            `;

            db.run(updateQuery, [sessionCount, sessionCount, activeSession.id], function(updateErr) {
              if (updateErr) {
                db.run('ROLLBACK');
                return reject(updateErr);
              }

              // Create transaction record
              const SessionTransaction = require('./SessionTransaction');
              const transaction = new SessionTransaction({
                customer_session_id: activeSession.id,
                transaction_type: activeSession.total_sessions === sessionCount ? 'purchase' : 'topup',
                amount: sessionCount,
                created_by_user_id: addedByUserId,
                notes: notes || `Added ${sessionCount} sessions`
              });

              transaction.create().then((transactionId) => {
                db.run('COMMIT', (commitErr) => {
                  if (commitErr) {
                    db.run('ROLLBACK');
                    return reject(commitErr);
                  }
                  resolve({
                    sessionId: activeSession.id,
                    transactionId: transactionId,
                    remainingSessions: activeSession.remaining_sessions + sessionCount
                  });
                });
              }).catch((transactionErr) => {
                db.run('ROLLBACK');
                reject(transactionErr);
              });
            });
          });
        });
      } catch (error) {
        reject(error);
      }
    });
  }
}

module.exports = CustomerSession;