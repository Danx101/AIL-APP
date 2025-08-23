const db = require("../database/database-wrapper");

class PromoCode {
  /**
   * Create a new promocode
   * @param {Object} promoData - Promocode information
   * @returns {Promise<Object>} Created promocode with ID
   */
  static async create(promoData) {
    return new Promise((resolve, reject) => {
      const { 
        code,
        created_by_manager_id,
        extension_months = 2,
        max_uses = 1,
        expires_at = null,
        description = null
      } = promoData;
      
      const query = `
        INSERT INTO promocodes (
          code, created_by_manager_id, extension_months, max_uses, 
          expires_at, description
        )
        VALUES (?, ?, ?, ?, ?, ?)
      `;
      
      db.run(query, [
        code, created_by_manager_id, extension_months, max_uses,
        expires_at, description
      ], function(err) {
        if (err) {
          reject(err);
        } else {
          resolve({
            id: this.lastID,
            code,
            created_by_manager_id,
            extension_months,
            max_uses,
            used_count: 0,
            expires_at,
            description,
            is_active: true,
            created_at: new Date().toISOString()
          });
        }
      });
    });
  }

  /**
   * Find promocode by code
   * @param {string} code - Promocode
   * @returns {Promise<Object|null>} Promocode object or null
   */
  static async findByCode(code) {
    return new Promise((resolve, reject) => {
      const currentTime = new Date().toISOString();
      const query = `
        SELECT 
          p.*,
          u.first_name as manager_first_name,
          u.last_name as manager_last_name,
          u.email as manager_email,
          CASE 
            WHEN p.is_active = FALSE THEN 'inactive'
            WHEN p.expires_at IS NOT NULL AND p.expires_at <= ? THEN 'expired'
            WHEN p.used_count >= p.max_uses THEN 'used_up'
            ELSE 'valid'
          END as status
        FROM promocodes p
        JOIN users u ON p.created_by_manager_id = u.id
        WHERE p.code = ?
      `;
      
      db.get(query, [currentTime, code], (err, row) => {
        if (err) {
          reject(err);
        } else {
          resolve(row || null);
        }
      });
    });
  }

  /**
   * Validate promocode for redemption
   * @param {string} code - Promocode to validate
   * @returns {Promise<Object>} Validation result
   */
  static async validateForRedemption(code) {
    return new Promise((resolve, reject) => {
      this.findByCode(code)
        .then(promoCode => {
          if (!promoCode) {
            resolve({
              valid: false,
              reason: 'Promocode not found',
              code: 'INVALID_CODE'
            });
            return;
          }

          // Check if active
          if (!promoCode.is_active) {
            resolve({
              valid: false,
              reason: 'Promocode is no longer active',
              code: 'INACTIVE_CODE'
            });
            return;
          }

          // Check expiry
          if (promoCode.expires_at && new Date(promoCode.expires_at) <= new Date()) {
            resolve({
              valid: false,
              reason: 'Promocode has expired',
              code: 'EXPIRED_CODE'
            });
            return;
          }

          // Check usage limit
          if (promoCode.used_count >= promoCode.max_uses) {
            resolve({
              valid: false,
              reason: 'Promocode has been used maximum times',
              code: 'USED_UP'
            });
            return;
          }

          // Valid promocode
          resolve({
            valid: true,
            promocode: promoCode,
            extension_months: promoCode.extension_months
          });
        })
        .catch(err => reject(err));
    });
  }

  /**
   * Redeem promocode for a user
   * @param {string} code - Promocode to redeem
   * @param {number} userId - User ID redeeming the code
   * @param {number} subscriptionId - User's subscription ID
   * @returns {Promise<Object>} Redemption result
   */
  static async redeem(code, userId, subscriptionId) {
    return new Promise((resolve, reject) => {
      // Start transaction
      db.beginTransaction((err) => {
        if (err) {
          reject(err);
          return;
        }

        // First validate the promocode
        this.validateForRedemption(code)
          .then(validation => {
            if (!validation.valid) {
              db.rollback();
              resolve(validation);
              return;
            }

            const promoCode = validation.promocode;

            // Check if user already used this specific code
            const checkUsageQuery = `
              SELECT id FROM promocode_usage 
              WHERE promocode_id = ? AND user_id = ?
            `;

            db.get(checkUsageQuery, [promoCode.id, userId], (err, existingUsage) => {
              if (err) {
                db.rollback();
                reject(err);
                return;
              }

              if (existingUsage) {
                db.rollback();
                resolve({
                  valid: false,
                  reason: 'You have already used this promocode',
                  code: 'ALREADY_USED'
                });
                return;
              }

              // Get current trial end date
              const getTrialQuery = `
                SELECT trial_ends_at FROM subscriptions WHERE id = ?
              `;

              db.get(getTrialQuery, [subscriptionId], (err, subscription) => {
                if (err) {
                  db.rollback();
                  reject(err);
                  return;
                }

                const previousTrialEnd = new Date(subscription.trial_ends_at);
                const newTrialEnd = new Date(previousTrialEnd);
                newTrialEnd.setMonth(newTrialEnd.getMonth() + promoCode.extension_months);

                // Update subscription trial end
                const updateSubscriptionQuery = `
                  UPDATE subscriptions 
                  SET trial_ends_at = ?, updated_at = ?
                  WHERE id = ?
                `;

                db.run(updateSubscriptionQuery, [
                  newTrialEnd.toISOString(), new Date().toISOString(), subscriptionId
                ], function(err) {
                  if (err) {
                    db.rollback();
                    reject(err);
                    return;
                  }

                  // Record promocode usage
                  const recordUsageQuery = `
                    INSERT INTO promocode_usage (
                      promocode_id, user_id, subscription_id, months_added,
                      previous_trial_end, new_trial_end
                    )
                    VALUES (?, ?, ?, ?, ?, ?)
                  `;

                  db.run(recordUsageQuery, [
                    promoCode.id, userId, subscriptionId, promoCode.extension_months,
                    previousTrialEnd.toISOString(), newTrialEnd.toISOString()
                  ], function(err) {
                    if (err) {
                      db.rollback();
                      reject(err);
                      return;
                    }

                    // Increment used count
                    const incrementUsageQuery = `
                      UPDATE promocodes 
                      SET used_count = used_count + 1, updated_at = ?
                      WHERE id = ?
                    `;

                    db.run(incrementUsageQuery, [new Date().toISOString(), promoCode.id], (err) => {
                      if (err) {
                        db.rollback();
                        reject(err);
                        return;
                      }

                      // Commit transaction
                      db.commit((err) => {
                        if (err) {
                          db.rollback();
                          reject(err);
                          return;
                        }

                        resolve({
                          valid: true,
                          redeemed: true,
                          months_added: promoCode.extension_months,
                          previous_trial_end: previousTrialEnd.toISOString(),
                          new_trial_end: newTrialEnd.toISOString(),
                          usage_id: this.lastID
                        });
                      });
                    });
                  });
                });
              });
            });
          })
          .catch(err => {
            db.rollback();
            reject(err);
          });
      });
    });
  }

  /**
   * Get all promocodes created by a manager
   * @param {number} managerId - Manager's user ID
   * @param {Object} options - Query options
   * @returns {Promise<Array>} Array of promocodes
   */
  static async findByManager(managerId, options = {}) {
    return new Promise((resolve, reject) => {
      const { limit = 50, offset = 0, active_only = false } = options;
      const currentTime = new Date().toISOString();
      
      let query = `
        SELECT 
          p.*,
          CASE 
            WHEN p.is_active = FALSE THEN 'inactive'
            WHEN p.expires_at IS NOT NULL AND p.expires_at <= ? THEN 'expired'
            WHEN p.used_count >= p.max_uses THEN 'used_up'
            ELSE 'active'
          END as status,
          (p.max_uses - p.used_count) as remaining_uses
        FROM promocodes p
        WHERE p.created_by_manager_id = ?
      `;
      
      const params = [currentTime, managerId];
      
      if (active_only) {
        query += ` AND p.is_active = TRUE 
                   AND (p.expires_at IS NULL OR p.expires_at > ?)
                   AND p.used_count < p.max_uses`;
        params.push(currentTime);
      }
      
      query += ` ORDER BY p.created_at DESC LIMIT ${parseInt(limit)} OFFSET ${parseInt(offset)}`;
      
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
   * Get promocode usage history
   * @param {number} promoCodeId - Promocode ID
   * @returns {Promise<Array>} Array of usage records
   */
  static async getUsageHistory(promoCodeId) {
    return new Promise((resolve, reject) => {
      const query = `
        SELECT 
          pu.*,
          u.email, u.first_name, u.last_name,
          s.plan_type, s.status as subscription_status
        FROM promocode_usage pu
        JOIN users u ON pu.user_id = u.id
        JOIN subscriptions s ON pu.subscription_id = s.id
        WHERE pu.promocode_id = ?
        ORDER BY pu.used_at DESC
      `;
      
      db.all(query, [promoCodeId], (err, rows) => {
        if (err) {
          reject(err);
        } else {
          resolve(rows);
        }
      });
    });
  }

  /**
   * Generate a unique promocode
   * @param {string} prefix - Optional prefix for the code
   * @param {number} length - Length of random part (default 6)
   * @returns {string} Generated promocode
   */
  static generateCode(prefix = 'AIL', length = 6) {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let randomPart = '';
    
    for (let i = 0; i < length; i++) {
      randomPart += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    
    return `${prefix}${randomPart}`;
  }

  /**
   * Deactivate a promocode
   * @param {number} id - Promocode ID
   * @param {number} managerId - Manager deactivating (for authorization)
   * @returns {Promise<boolean>} Success status
   */
  static async deactivate(id, managerId) {
    return new Promise((resolve, reject) => {
      const currentTime = new Date().toISOString();
      const query = `
        UPDATE promocodes 
        SET is_active = FALSE, updated_at = ?
        WHERE id = ? AND created_by_manager_id = ?
      `;
      
      db.run(query, [currentTime, id, managerId], function(err) {
        if (err) {
          reject(err);
        } else {
          resolve(this.changes > 0);
        }
      });
    });
  }

  /**
   * Get promocode statistics for managers
   * @param {number} managerId - Manager ID (optional, for specific manager stats)
   * @returns {Promise<Object>} Promocode statistics
   */
  static async getStatistics(managerId = null) {
    return new Promise((resolve, reject) => {
      const currentTime = new Date().toISOString();
      let query = `
        SELECT 
          COUNT(*) as total_codes,
          COUNT(CASE WHEN is_active = TRUE AND (expires_at IS NULL OR expires_at > ?) 
                     AND used_count < max_uses THEN 1 END) as active_codes,
          COUNT(CASE WHEN used_count >= max_uses THEN 1 END) as used_up_codes,
          COUNT(CASE WHEN expires_at IS NOT NULL AND expires_at <= ? THEN 1 END) as expired_codes,
          SUM(used_count) as total_redemptions,
          SUM(max_uses - used_count) as remaining_uses
        FROM promocodes
      `;
      
      const params = [currentTime, currentTime];
      
      if (managerId) {
        query += ' WHERE created_by_manager_id = ?';
        params.push(managerId);
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
}

module.exports = PromoCode;