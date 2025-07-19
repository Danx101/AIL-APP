const db = require('../database/connection');

/**
 * SessionTransaction Model
 * Handles session transaction data operations and audit trail
 */
class SessionTransaction {
  constructor(data = {}) {
    this.id = data.id || null;
    this.customer_session_id = data.customer_session_id || null;
    this.transaction_type = data.transaction_type || null;
    this.amount = data.amount || null;
    this.appointment_id = data.appointment_id || null;
    this.created_by_user_id = data.created_by_user_id || null;
    this.notes = data.notes || null;
    this.created_at = data.created_at || null;
  }

  /**
   * Validate session transaction data
   */
  validate() {
    const errors = [];

    if (!this.customer_session_id) errors.push('Customer session ID is required');
    if (!this.transaction_type) errors.push('Transaction type is required');
    if (!this.created_by_user_id) errors.push('Created by user ID is required');
    
    const validTypes = ['purchase', 'deduction', 'topup', 'refund'];
    if (this.transaction_type && !validTypes.includes(this.transaction_type)) {
      errors.push(`Invalid transaction type. Must be one of: ${validTypes.join(', ')}`);
    }

    if (this.amount === null || this.amount === undefined) {
      errors.push('Amount is required');
    }

    if (typeof this.amount !== 'number') {
      errors.push('Amount must be a number');
    }

    return errors;
  }

  /**
   * Create a new session transaction
   */
  async create() {
    const errors = this.validate();
    if (errors.length > 0) {
      throw new Error(`Validation failed: ${errors.join(', ')}`);
    }

    return new Promise((resolve, reject) => {
      const query = `
        INSERT INTO session_transactions (
          customer_session_id, transaction_type, amount, appointment_id, 
          created_by_user_id, notes
        ) VALUES (?, ?, ?, ?, ?, ?)
      `;

      db.run(query, [
        this.customer_session_id,
        this.transaction_type,
        this.amount,
        this.appointment_id,
        this.created_by_user_id,
        this.notes
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
   * Find session transaction by ID
   */
  static async findById(id) {
    return new Promise((resolve, reject) => {
      const query = `
        SELECT st.*, 
               cs.customer_id, cs.studio_id,
               u.first_name as created_by_first_name, u.last_name as created_by_last_name,
               customer.first_name as customer_first_name, customer.last_name as customer_last_name,
               a.appointment_date, a.start_time
        FROM session_transactions st
        LEFT JOIN customer_sessions cs ON st.customer_session_id = cs.id
        LEFT JOIN users u ON st.created_by_user_id = u.id
        LEFT JOIN users customer ON cs.customer_id = customer.id
        LEFT JOIN appointments a ON st.appointment_id = a.id
        WHERE st.id = ?
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
   * Find transactions by customer session ID
   */
  static async findByCustomerSession(customerSessionId, filters = {}) {
    return new Promise((resolve, reject) => {
      let query = `
        SELECT st.*, 
               cs.customer_id, cs.studio_id,
               u.first_name as created_by_first_name, u.last_name as created_by_last_name,
               customer.first_name as customer_first_name, customer.last_name as customer_last_name,
               a.appointment_date, a.start_time
        FROM session_transactions st
        LEFT JOIN customer_sessions cs ON st.customer_session_id = cs.id
        LEFT JOIN users u ON st.created_by_user_id = u.id
        LEFT JOIN users customer ON cs.customer_id = customer.id
        LEFT JOIN appointments a ON st.appointment_id = a.id
        WHERE st.customer_session_id = ?
      `;

      const params = [customerSessionId];

      // Add filters
      if (filters.transaction_type) {
        query += ' AND st.transaction_type = ?';
        params.push(filters.transaction_type);
      }

      if (filters.from_date && filters.to_date) {
        query += ' AND DATE(st.created_at) BETWEEN ? AND ?';
        params.push(filters.from_date, filters.to_date);
      }

      query += ' ORDER BY st.created_at DESC';

      if (filters.limit) {
        query += ' LIMIT ?';
        params.push(filters.limit);
      }

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
   * Find transactions by customer ID across all sessions
   */
  static async findByCustomer(customerId, filters = {}) {
    return new Promise((resolve, reject) => {
      let query = `
        SELECT st.*, 
               cs.customer_id, cs.studio_id, cs.total_sessions, cs.remaining_sessions,
               u.first_name as created_by_first_name, u.last_name as created_by_last_name,
               customer.first_name as customer_first_name, customer.last_name as customer_last_name,
               studio.name as studio_name,
               a.appointment_date, a.start_time
        FROM session_transactions st
        LEFT JOIN customer_sessions cs ON st.customer_session_id = cs.id
        LEFT JOIN users u ON st.created_by_user_id = u.id
        LEFT JOIN users customer ON cs.customer_id = customer.id
        LEFT JOIN studios studio ON cs.studio_id = studio.id
        LEFT JOIN appointments a ON st.appointment_id = a.id
        WHERE cs.customer_id = ?
      `;

      const params = [customerId];

      // Add filters
      if (filters.studio_id) {
        query += ' AND cs.studio_id = ?';
        params.push(filters.studio_id);
      }

      if (filters.transaction_type) {
        query += ' AND st.transaction_type = ?';
        params.push(filters.transaction_type);
      }

      if (filters.from_date && filters.to_date) {
        query += ' AND DATE(st.created_at) BETWEEN ? AND ?';
        params.push(filters.from_date, filters.to_date);
      }

      query += ' ORDER BY st.created_at DESC';

      if (filters.limit) {
        query += ' LIMIT ?';
        params.push(filters.limit);
      }

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
   * Find transactions by studio ID
   */
  static async findByStudio(studioId, filters = {}) {
    return new Promise((resolve, reject) => {
      let query = `
        SELECT st.*, 
               cs.customer_id, cs.studio_id, cs.total_sessions, cs.remaining_sessions,
               u.first_name as created_by_first_name, u.last_name as created_by_last_name,
               customer.first_name as customer_first_name, customer.last_name as customer_last_name,
               studio.name as studio_name,
               a.appointment_date, a.start_time
        FROM session_transactions st
        LEFT JOIN customer_sessions cs ON st.customer_session_id = cs.id
        LEFT JOIN users u ON st.created_by_user_id = u.id
        LEFT JOIN users customer ON cs.customer_id = customer.id
        LEFT JOIN studios studio ON cs.studio_id = studio.id
        LEFT JOIN appointments a ON st.appointment_id = a.id
        WHERE cs.studio_id = ?
      `;

      const params = [studioId];

      // Add filters
      if (filters.customer_id) {
        query += ' AND cs.customer_id = ?';
        params.push(filters.customer_id);
      }

      if (filters.transaction_type) {
        query += ' AND st.transaction_type = ?';
        params.push(filters.transaction_type);
      }

      if (filters.from_date && filters.to_date) {
        query += ' AND DATE(st.created_at) BETWEEN ? AND ?';
        params.push(filters.from_date, filters.to_date);
      }

      query += ' ORDER BY st.created_at DESC';

      if (filters.limit) {
        query += ' LIMIT ?';
        params.push(filters.limit);
      }

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
   * Get session transaction statistics for a studio
   */
  static async getStudioStats(studioId, fromDate, toDate) {
    return new Promise((resolve, reject) => {
      const query = `
        SELECT 
          COUNT(*) as total_transactions,
          COUNT(CASE WHEN st.transaction_type = 'purchase' THEN 1 END) as purchases,
          COUNT(CASE WHEN st.transaction_type = 'topup' THEN 1 END) as topups,
          COUNT(CASE WHEN st.transaction_type = 'deduction' THEN 1 END) as deductions,
          COUNT(CASE WHEN st.transaction_type = 'refund' THEN 1 END) as refunds,
          SUM(CASE WHEN st.transaction_type IN ('purchase', 'topup') THEN st.amount ELSE 0 END) as sessions_added,
          SUM(CASE WHEN st.transaction_type IN ('deduction', 'refund') THEN ABS(st.amount) ELSE 0 END) as sessions_deducted
        FROM session_transactions st
        LEFT JOIN customer_sessions cs ON st.customer_session_id = cs.id
        WHERE cs.studio_id = ? 
          AND DATE(st.created_at) BETWEEN ? AND ?
      `;

      db.get(query, [studioId, fromDate, toDate], (err, row) => {
        if (err) {
          reject(err);
        } else {
          resolve(row);
        }
      });
    });
  }
}

module.exports = SessionTransaction;