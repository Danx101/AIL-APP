const db = require("../database/database-wrapper");

class Subscription {
  /**
   * Create a new subscription (typically trial for new users)
   * @param {Object} subscriptionData - Subscription information
   * @returns {Promise<Object>} Created subscription with ID
   */
  static async create(subscriptionData) {
    return new Promise((resolve, reject) => {
      const { 
        user_id, 
        plan_type = 'trial', 
        status = 'trial',
        trial_started_at,
        trial_ends_at,
        max_studios_allowed = 1,
        stripe_customer_id = null
      } = subscriptionData;
      
      const query = `
        INSERT INTO subscriptions (
          user_id, plan_type, status, trial_started_at, trial_ends_at, 
          max_studios_allowed, stripe_customer_id
        )
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `;
      
      db.run(query, [
        user_id, plan_type, status, trial_started_at, trial_ends_at,
        max_studios_allowed, stripe_customer_id
      ], function(err) {
        if (err) {
          reject(err);
        } else {
          resolve({
            id: this.lastID,
            user_id,
            plan_type,
            status,
            trial_started_at,
            trial_ends_at,
            max_studios_allowed,
            stripe_customer_id,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          });
        }
      });
    });
  }

  /**
   * Find subscription by user ID
   * @param {number} userId - User ID
   * @returns {Promise<Object|null>} Subscription object or null
   */
  static async findByUserId(userId) {
    return new Promise((resolve, reject) => {
      const query = `
        SELECT s.*, 
               u.email, u.first_name, u.last_name,
               CASE 
                 WHEN s.status = 'trial' AND s.trial_ends_at > NOW() THEN TRUE
                 WHEN s.status = 'active' AND s.current_period_end > NOW() THEN TRUE
                 ELSE FALSE
               END as is_active,
               CASE 
                 WHEN s.status = 'trial' AND s.trial_ends_at > NOW() 
                 THEN DATEDIFF(s.trial_ends_at, NOW())
                 ELSE 0
               END as trial_days_remaining
        FROM subscriptions s
        JOIN users u ON s.user_id = u.id
        WHERE s.user_id = ?
      `;
      
      db.get(query, [userId], (err, row) => {
        if (err) {
          reject(err);
        } else {
          resolve(row || null);
        }
      });
    });
  }

  /**
   * Find subscription by ID
   * @param {number} id - Subscription ID
   * @returns {Promise<Object|null>} Subscription object or null
   */
  static async findById(id) {
    return new Promise((resolve, reject) => {
      const query = `
        SELECT s.*, u.email, u.first_name, u.last_name
        FROM subscriptions s
        JOIN users u ON s.user_id = u.id
        WHERE s.id = ?
      `;
      
      db.get(query, [id], (err, row) => {
        if (err) {
          reject(err);
        } else {
          resolve(row || null);
        }
      });
    });
  }

  /**
   * Update subscription information
   * @param {number} userId - User ID
   * @param {Object} updateData - Fields to update
   * @returns {Promise<Object>} Updated subscription
   */
  static async update(userId, updateData) {
    return new Promise((resolve, reject) => {
      const allowedFields = [
        'plan_type', 'status', 'trial_ends_at', 'current_period_start', 
        'current_period_end', 'max_studios_allowed', 'stripe_customer_id', 
        'stripe_subscription_id'
      ];
      const fields = Object.keys(updateData).filter(key => allowedFields.includes(key));
      
      if (fields.length === 0) {
        reject(new Error('No valid fields to update'));
        return;
      }
      
      const setClause = fields.map(field => `${field} = ?`).join(', ');
      const values = fields.map(field => updateData[field]);
      values.push(userId);
      
      const query = `
        UPDATE subscriptions 
        SET ${setClause}, updated_at = NOW()
        WHERE user_id = ?
      `;
      
      db.run(query, values, function(err) {
        if (err) {
          reject(err);
        } else if (this.changes === 0) {
          reject(new Error('Subscription not found or no changes made'));
        } else {
          // Return updated subscription
          Subscription.findByUserId(userId)
            .then(subscription => resolve(subscription))
            .catch(err => reject(err));
        }
      });
    });
  }

  /**
   * Extend trial period (for promocode redemption)
   * @param {number} userId - User ID
   * @param {number} additionalMonths - Months to add to trial
   * @returns {Promise<Object>} Updated subscription with extension details
   */
  static async extendTrial(userId, additionalMonths) {
    return new Promise((resolve, reject) => {
      // First get current subscription
      this.findByUserId(userId)
        .then(subscription => {
          if (!subscription) {
            throw new Error('Subscription not found');
          }

          // Calculate new trial end date
          const currentTrialEnd = new Date(subscription.trial_ends_at);
          const newTrialEnd = new Date(currentTrialEnd);
          newTrialEnd.setMonth(newTrialEnd.getMonth() + additionalMonths);

          // Update the subscription
          const query = `
            UPDATE subscriptions 
            SET trial_ends_at = ?, updated_at = NOW()
            WHERE user_id = ?
          `;

          db.run(query, [newTrialEnd.toISOString(), userId], function(err) {
            if (err) {
              reject(err);
            } else {
              resolve({
                previous_trial_end: currentTrialEnd.toISOString(),
                new_trial_end: newTrialEnd.toISOString(),
                months_added: additionalMonths
              });
            }
          });
        })
        .catch(err => reject(err));
    });
  }

  /**
   * Check if user can create more studios
   * @param {number} userId - User ID
   * @returns {Promise<Object>} Studio limit check result
   */
  static async checkStudioLimit(userId) {
    return new Promise((resolve, reject) => {
      const query = `
        SELECT 
          s.max_studios_allowed,
          s.status,
          s.trial_ends_at,
          s.current_period_end,
          COALESCE(studio_count.count, 0) as current_studios,
          CASE 
            WHEN s.status = 'trial' AND s.trial_ends_at > NOW() THEN TRUE
            WHEN s.status = 'active' AND s.current_period_end > NOW() THEN TRUE
            ELSE FALSE
          END as subscription_active
        FROM subscriptions s
        LEFT JOIN (
          SELECT owner_id, COUNT(*) as count 
          FROM studios 
          WHERE is_active = 1 
          GROUP BY owner_id
        ) studio_count ON s.user_id = studio_count.owner_id
        WHERE s.user_id = ?
      `;

      db.get(query, [userId], (err, row) => {
        if (err) {
          reject(err);
        } else if (!row) {
          reject(new Error('No subscription found for user'));
        } else {
          const canCreateStudio = row.subscription_active && 
                                  row.current_studios < row.max_studios_allowed;
          
          resolve({
            can_create_studio: canCreateStudio,
            current_studios: row.current_studios,
            max_studios_allowed: row.max_studios_allowed,
            subscription_active: row.subscription_active,
            reason: !canCreateStudio ? 
              (!row.subscription_active ? 'Subscription expired' : 'Studio limit reached') : null
          });
        }
      });
    });
  }

  /**
   * Get all subscriptions (for manager dashboard)
   * @param {Object} options - Query options
   * @returns {Promise<Array>} Array of subscriptions with user details
   */
  static async findAll(options = {}) {
    return new Promise((resolve, reject) => {
      const { limit = 50, offset = 0, status = null } = options;
      
      let query = `
        SELECT 
          s.*,
          u.email, u.first_name, u.last_name, u.created_at as user_created,
          COALESCE(studio_count.count, 0) as current_studios,
          CASE 
            WHEN s.status = 'trial' AND s.trial_ends_at > NOW() 
            THEN DATEDIFF(s.trial_ends_at, NOW())
            ELSE 0
          END as trial_days_remaining,
          CASE 
            WHEN s.status = 'trial' AND s.trial_ends_at > NOW() THEN 'trial_active'
            WHEN s.status = 'active' AND s.current_period_end > NOW() THEN 'subscription_active'
            WHEN s.status = 'trial' AND s.trial_ends_at <= NOW() THEN 'trial_expired'
            WHEN s.status = 'active' AND s.current_period_end <= NOW() THEN 'subscription_expired'
            ELSE s.status
          END as health_status
        FROM subscriptions s
        JOIN users u ON s.user_id = u.id
        LEFT JOIN (
          SELECT owner_id, COUNT(*) as count 
          FROM studios 
          WHERE is_active = 1 
          GROUP BY owner_id
        ) studio_count ON s.user_id = studio_count.owner_id
      `;
      
      const params = [];
      
      if (status) {
        query += ' WHERE s.status = ?';
        params.push(status);
      }
      
      query += ' ORDER BY s.created_at DESC LIMIT ? OFFSET ?';
      params.push(limit, offset);
      
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
   * Get subscription statistics for manager dashboard
   * @returns {Promise<Object>} Subscription statistics
   */
  static async getStatistics() {
    return new Promise((resolve, reject) => {
      const query = `
        SELECT 
          COUNT(*) as total_subscriptions,
          COUNT(CASE WHEN status = 'trial' AND trial_ends_at > NOW() THEN 1 END) as active_trials,
          COUNT(CASE WHEN status = 'active' AND current_period_end > NOW() THEN 1 END) as active_subscriptions,
          COUNT(CASE WHEN status = 'trial' AND trial_ends_at <= NOW() THEN 1 END) as expired_trials,
          COUNT(CASE WHEN status = 'payment_failed' THEN 1 END) as payment_failed,
          COUNT(CASE WHEN plan_type = 'single_studio' AND status = 'active' THEN 1 END) as single_plans,
          COUNT(CASE WHEN plan_type = 'dual_studio' AND status = 'active' THEN 1 END) as dual_plans,
          COUNT(CASE WHEN plan_type = 'triple_studio' AND status = 'active' THEN 1 END) as triple_plans,
          
          -- Revenue calculation (monthly)
          (COUNT(CASE WHEN plan_type = 'single_studio' AND status = 'active' THEN 1 END) * 29 +
           COUNT(CASE WHEN plan_type = 'dual_studio' AND status = 'active' THEN 1 END) * 49 +
           COUNT(CASE WHEN plan_type = 'triple_studio' AND status = 'active' THEN 1 END) * 69) as monthly_revenue_eur
           
        FROM subscriptions
      `;

      db.get(query, [], (err, row) => {
        if (err) {
          reject(err);
        } else {
          resolve(row);
        }
      });
    });
  }

  /**
   * Find expired trials that need attention
   * @param {number} graceDays - Days after trial expiry to include
   * @returns {Promise<Array>} Expired trials within grace period
   */
  static async findExpiredTrials(graceDays = 7) {
    return new Promise((resolve, reject) => {
      const query = `
        SELECT 
          s.*,
          u.email, u.first_name, u.last_name,
          DATEDIFF(NOW(), s.trial_ends_at) as days_overdue
        FROM subscriptions s
        JOIN users u ON s.user_id = u.id
        WHERE s.status = 'trial' 
        AND s.trial_ends_at <= NOW()
        AND s.trial_ends_at >= DATE_SUB(NOW(), INTERVAL ? DAY)
        ORDER BY s.trial_ends_at ASC
      `;

      db.all(query, [graceDays], (err, rows) => {
        if (err) {
          reject(err);
        } else {
          resolve(rows);
        }
      });
    });
  }
}

module.exports = Subscription;