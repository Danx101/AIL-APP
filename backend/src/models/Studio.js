const db = require('../database/connection');

class Studio {
  /**
   * Create a new studio
   * @param {Object} studioData - Studio information
   * @returns {Promise<Object>} Created studio with ID
   */
  static async create(studioData) {
    return new Promise((resolve, reject) => {
      const { name, owner_id, address, phone, email, business_hours, city } = studioData;
      
      const query = `
        INSERT INTO studios (name, owner_id, address, phone, email, business_hours, city)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `;
      
      db.run(query, [name, owner_id, address, phone, email, business_hours, city], function(err) {
        if (err) {
          reject(err);
        } else {
          resolve({
            id: this.lastID,
            name,
            owner_id,
            address,
            phone,
            email,
            business_hours,
            city,
            is_active: 1,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          });
        }
      });
    });
  }

  /**
   * Find studio by ID
   * @param {number} id - Studio ID
   * @returns {Promise<Object|null>} Studio object or null
   */
  static async findById(id) {
    return new Promise((resolve, reject) => {
      const query = `
        SELECT s.*, u.first_name, u.last_name, u.email as owner_email
        FROM studios s
        JOIN users u ON s.owner_id = u.id
        WHERE s.id = ? AND s.is_active = 1
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
   * Find studio by owner ID
   * @param {number} ownerId - Owner user ID
   * @returns {Promise<Object|null>} Studio object or null
   */
  static async findByOwnerId(ownerId) {
    return new Promise((resolve, reject) => {
      const query = `
        SELECT s.*, u.first_name, u.last_name, u.email as owner_email
        FROM studios s
        JOIN users u ON s.owner_id = u.id
        WHERE s.owner_id = ? AND s.is_active = 1
      `;
      
      db.get(query, [ownerId], (err, row) => {
        if (err) {
          reject(err);
        } else {
          resolve(row || null);
        }
      });
    });
  }

  /**
   * Update studio information
   * @param {number} id - Studio ID
   * @param {Object} updateData - Fields to update
   * @returns {Promise<Object>} Updated studio
   */
  static async update(id, updateData) {
    return new Promise((resolve, reject) => {
      const allowedFields = ['name', 'address', 'phone', 'email', 'business_hours', 'city'];
      const fields = Object.keys(updateData).filter(key => allowedFields.includes(key));
      
      if (fields.length === 0) {
        reject(new Error('No valid fields to update'));
        return;
      }
      
      const setClause = fields.map(field => `${field} = ?`).join(', ');
      const values = fields.map(field => updateData[field]);
      values.push(new Date().toISOString(), id);
      
      const query = `
        UPDATE studios 
        SET ${setClause}, updated_at = ?
        WHERE id = ? AND is_active = 1
      `;
      
      db.run(query, values, function(err) {
        if (err) {
          reject(err);
        } else if (this.changes === 0) {
          reject(new Error('Studio not found or no changes made'));
        } else {
          // Return updated studio
          Studio.findById(id)
            .then(studio => resolve(studio))
            .catch(err => reject(err));
        }
      });
    });
  }

  /**
   * Soft delete studio
   * @param {number} id - Studio ID
   * @returns {Promise<boolean>} Success status
   */
  static async delete(id) {
    return new Promise((resolve, reject) => {
      const query = `
        UPDATE studios 
        SET is_active = 0, updated_at = ?
        WHERE id = ? AND is_active = 1
      `;
      
      db.run(query, [new Date().toISOString(), id], function(err) {
        if (err) {
          reject(err);
        } else {
          resolve(this.changes > 0);
        }
      });
    });
  }

  /**
   * Get all studios (admin function)
   * @param {Object} options - Query options
   * @returns {Promise<Array>} Array of studios
   */
  static async findAll(options = {}) {
    return new Promise((resolve, reject) => {
      const { limit = 50, offset = 0, includeInactive = false } = options;
      
      let query = `
        SELECT s.*, u.first_name, u.last_name, u.email as owner_email
        FROM studios s
        JOIN users u ON s.owner_id = u.id
      `;
      
      const params = [];
      
      if (!includeInactive) {
        query += ' WHERE s.is_active = 1';
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
   * Get studio statistics
   * @param {number} studioId - Studio ID
   * @returns {Promise<Object>} Studio statistics
   */
  static async getStatistics(studioId) {
    return new Promise((resolve, reject) => {
      const query = `
        SELECT 
          COUNT(CASE WHEN ac.is_used = 1 THEN 1 END) as customers_registered,
          COUNT(CASE WHEN ac.is_used = 0 THEN 1 END) as unused_codes,
          COUNT(ac.id) as total_codes
        FROM activation_codes ac
        WHERE ac.studio_id = ?
      `;
      
      db.get(query, [studioId], (err, row) => {
        if (err) {
          reject(err);
        } else {
          resolve({
            customers_registered: row.customers_registered || 0,
            unused_codes: row.unused_codes || 0,
            total_codes: row.total_codes || 0
          });
        }
      });
    });
  }
}

module.exports = Studio;