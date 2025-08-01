const db = require("../database/database-wrapper");

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
    this.block_order = data.block_order || null;
    this.block_type = data.block_type || 'standard';
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
          purchase_date, notes, is_active, block_order, block_type
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `;

      db.run(query, [
        this.customer_id,
        this.studio_id,
        this.total_sessions,
        this.remaining_sessions || this.total_sessions,
        this.purchase_date || new Date().toISOString(),
        this.notes,
        this.is_active,
        this.block_order,
        this.block_type
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
          remaining_sessions = ?, notes = ?, is_active = ?, block_type = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `;

      db.run(query, [
        this.remaining_sessions,
        this.notes,
        this.is_active,
        this.block_type,
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
   * Add new session block to customer's queue (FIFO system)
   */
  static async addSessionBlock(customerId, studioId, sessionCount, addedByUserId, notes = null, blockType = 'standard') {
    return new Promise(async (resolve, reject) => {
      try {
        // Get next block order number
        const nextBlockOrder = await CustomerSession.getNextBlockOrder(customerId, studioId);
        
        // Create new session block
        const newBlock = new CustomerSession({
          customer_id: customerId,
          studio_id: studioId,
          total_sessions: sessionCount,
          remaining_sessions: sessionCount,
          notes: notes || `Session block (${sessionCount} sessions)`,
          block_order: nextBlockOrder,
          block_type: blockType
        });
        
        const sessionId = await newBlock.create();

        // Create transaction record
        const SessionTransaction = require('./SessionTransaction');
        const transaction = new SessionTransaction({
          customer_session_id: sessionId,
          transaction_type: 'purchase',
          amount: sessionCount,
          created_by_user_id: addedByUserId,
          notes: notes || `Added ${sessionCount} session block`
        });

        const transactionId = await transaction.create();

        resolve({
          sessionId: sessionId,
          transactionId: transactionId,
          blockOrder: nextBlockOrder,
          remainingSessions: sessionCount
        });

      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Get next block order number for customer
   */
  static async getNextBlockOrder(customerId, studioId) {
    return new Promise((resolve, reject) => {
      const query = `
        SELECT COALESCE(MAX(block_order), 0) + 1 as next_order
        FROM customer_sessions 
        WHERE customer_id = ? AND studio_id = ?
      `;

      db.get(query, [customerId, studioId], (err, row) => {
        if (err) {
          reject(err);
        } else {
          resolve(row.next_order);
        }
      });
    });
  }

  /**
   * Get customer's session blocks in FIFO order
   */
  static async getCustomerBlockQueue(customerId, studioId) {
    return new Promise((resolve, reject) => {
      const query = `
        SELECT cs.*, 
               u.first_name as customer_first_name, u.last_name as customer_last_name, u.email as customer_email,
               s.name as studio_name
        FROM customer_sessions cs
        LEFT JOIN users u ON cs.customer_id = u.id
        LEFT JOIN studios s ON cs.studio_id = s.id
        WHERE cs.customer_id = ? AND cs.studio_id = ? AND cs.is_active = 1
        ORDER BY cs.block_order ASC
      `;

      db.all(query, [customerId, studioId], (err, rows) => {
        if (err) {
          reject(err);
        } else {
          resolve(rows);
        }
      });
    });
  }

  /**
   * Deduct session using FIFO block consumption
   */
  static async deductSessionFIFO(customerId, studioId, appointmentId, deductedByUserId, notes = null) {
    return new Promise(async (resolve, reject) => {
      try {
        // Get first block with remaining sessions (FIFO order)
        const activeBlock = await new Promise((resolve, reject) => {
          const query = `
            SELECT * FROM customer_sessions 
            WHERE customer_id = ? AND studio_id = ? AND is_active = 1 AND remaining_sessions > 0
            ORDER BY block_order ASC
            LIMIT 1
          `;

          db.get(query, [customerId, studioId], (err, row) => {
            if (err) reject(err);
            else resolve(row);
          });
        });
        
        if (!activeBlock) {
          throw new Error('No active session blocks available for deduction');
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

            db.run(updateQuery, [activeBlock.id], function(updateErr) {
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
                customer_session_id: activeBlock.id,
                transaction_type: 'deduction',
                amount: -1,
                appointment_id: appointmentId,
                created_by_user_id: deductedByUserId,
                notes: notes || `Session deducted from block ${activeBlock.block_order}`
              });

              transaction.create().then((transactionId) => {
                db.run('COMMIT', (commitErr) => {
                  if (commitErr) {
                    db.run('ROLLBACK');
                    return reject(commitErr);
                  }
                  resolve({
                    sessionId: activeBlock.id,
                    transactionId: transactionId,
                    blockOrder: activeBlock.block_order,
                    remainingSessions: activeBlock.remaining_sessions - 1
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
   * Get total remaining sessions across all active blocks
   */
  static async getTotalRemainingSessions(customerId, studioId) {
    return new Promise((resolve, reject) => {
      const query = `
        SELECT COALESCE(SUM(remaining_sessions), 0) as total_remaining
        FROM customer_sessions 
        WHERE customer_id = ? AND studio_id = ? AND is_active = 1
      `;

      db.get(query, [customerId, studioId], (err, row) => {
        if (err) {
          reject(err);
        } else {
          resolve(row.total_remaining);
        }
      });
    });
  }

  /**
   * Add sessions to customer's session package (top-up) - DEPRECATED
   * Use addSessionBlock instead
   */
  static async addSessions(customerId, studioId, sessionCount, addedByUserId, notes = null) {
    // Redirect to new block-based system
    return CustomerSession.addSessionBlock(customerId, studioId, sessionCount, addedByUserId, notes);
  }
}

module.exports = CustomerSession;