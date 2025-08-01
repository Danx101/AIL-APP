const { validationResult } = require('express-validator');
const db = require('../database/database-wrapper');

class ManagerController {
  /**
   * Generate manager codes for studio owners
   * POST /api/v1/manager/studio-owner-codes
   */
  generateStudioOwnerCodes = async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { 
        intendedOwnerName, 
        intendedCity, 
        intendedStudioName, 
        count = 1, 
        expiresInDays = 30 
      } = req.body;

      const managerId = req.user.userId;
      const codes = [];

      // Generate expiration date
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + expiresInDays);

      // Generate codes
      for (let i = 0; i < count; i++) {
        // Generate 8-character code
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
        let code = '';
        for (let j = 0; j < 8; j++) {
          code += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        
        const codeId = await new Promise((resolve, reject) => {
          db.run(
            `INSERT INTO manager_codes 
             (code, intended_owner_name, intended_city, intended_studio_name, created_by_manager_id, expires_at) 
             VALUES (?, ?, ?, ?, ?, ?)`,
            [code, intendedOwnerName, intendedCity, intendedStudioName, managerId, expiresAt.toISOString()],
            function(err) {
              if (err) reject(err);
              else resolve(this.lastID);
            }
          );
        });

        codes.push({
          id: codeId,
          code,
          intended_owner_name: intendedOwnerName,
          intended_city: intendedCity,
          intended_studio_name: intendedStudioName,
          expires_at: expiresAt.toISOString(),
          created_at: new Date().toISOString()
        });
      }

      res.status(201).json({
        message: `${codes.length} manager code(s) generated successfully`,
        codes
      });
    } catch (error) {
      console.error('Error generating manager codes:', error);
      console.error('Error details:', error.message);
      console.error('Stack trace:', error.stack);
      res.status(500).json({ message: 'Internal server error', error: error.message });
    }
  }

  /**
   * Get all manager codes
   * GET /api/v1/manager/studio-owner-codes
   */
  async getStudioOwnerCodes(req, res) {
    try {
      const { 
        page = 1, 
        limit = 20, 
        showUsed = false, 
        city,
        includeExpired = false 
      } = req.query;

      const managerId = req.user.userId;
      const offset = (page - 1) * limit;

      let query = `
        SELECT mc.*, u.email as used_by_email, u.first_name as used_by_first_name, u.last_name as used_by_last_name
        FROM manager_codes mc
        LEFT JOIN users u ON mc.used_by_user_id = u.id
        WHERE mc.created_by_manager_id = ?
      `;
      
      const params = [managerId];

      if (!showUsed) {
        query += ' AND mc.is_used = 0';
      }

      if (city) {
        query += ' AND mc.intended_city = ?';
        params.push(city);
      }

      if (!includeExpired) {
        query += ' AND (mc.expires_at IS NULL OR mc.expires_at > datetime("now"))';
      }

      query += ' ORDER BY mc.created_at DESC LIMIT ? OFFSET ?';
      params.push(parseInt(limit), offset);

      const codes = await new Promise((resolve, reject) => {
        db.all(query, params, (err, rows) => {
          if (err) reject(err);
          else resolve(rows);
        });
      });

      // Get total count for pagination
      let countQuery = `
        SELECT COUNT(*) as total
        FROM manager_codes mc
        WHERE mc.created_by_manager_id = ?
      `;
      
      const countParams = [managerId];

      if (!showUsed) {
        countQuery += ' AND mc.is_used = 0';
      }

      if (city) {
        countQuery += ' AND mc.intended_city = ?';
        countParams.push(city);
      }

      if (!includeExpired) {
        countQuery += ' AND (mc.expires_at IS NULL OR mc.expires_at > datetime("now"))';
      }

      const { total } = await new Promise((resolve, reject) => {
        db.get(countQuery, countParams, (err, row) => {
          if (err) reject(err);
          else resolve(row);
        });
      });

      res.json({
        codes,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / limit)
        }
      });
    } catch (error) {
      console.error('Error fetching manager codes:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  }

  /**
   * Get manager code statistics
   * GET /api/v1/manager/stats
   */
  async getStatistics(req, res) {
    try {
      const managerId = req.user.userId;

      const stats = await new Promise((resolve, reject) => {
        db.get(
          `SELECT 
            COUNT(*) as total_codes,
            COUNT(CASE WHEN is_used = 1 THEN 1 END) as used_codes,
            COUNT(CASE WHEN is_used = 0 AND (expires_at IS NULL OR expires_at > datetime("now")) THEN 1 END) as active_codes,
            COUNT(CASE WHEN is_used = 0 AND expires_at <= datetime("now") THEN 1 END) as expired_codes,
            COUNT(DISTINCT intended_city) as cities_count
           FROM manager_codes 
           WHERE created_by_manager_id = ?`,
          [managerId],
          (err, row) => {
            if (err) reject(err);
            else resolve(row);
          }
        );
      });

      // Get studios count
      const studioStats = await new Promise((resolve, reject) => {
        db.get(
          `SELECT COUNT(*) as total_studios
           FROM studios s
           JOIN users u ON s.owner_id = u.id
           JOIN manager_codes mc ON mc.used_by_user_id = u.id
           WHERE mc.created_by_manager_id = ?`,
          [managerId],
          (err, row) => {
            if (err) reject(err);
            else resolve(row);
          }
        );
      });

      res.json({
        statistics: {
          codes: {
            total: stats.total_codes || 0,
            used: stats.used_codes || 0,
            active: stats.active_codes || 0,
            expired: stats.expired_codes || 0
          },
          studios: {
            total: studioStats.total_studios || 0
          },
          cities: {
            count: stats.cities_count || 0
          }
        }
      });
    } catch (error) {
      console.error('Error fetching manager statistics:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  }

  /**
   * Get all studios overview
   * GET /api/v1/manager/studios
   */
  async getStudiosOverview(req, res) {
    try {
      const managerId = req.user.userId;
      const { city, page = 1, limit = 20 } = req.query;
      const offset = (page - 1) * limit;

      let query = `
        SELECT s.*, u.email as owner_email, u.first_name as owner_first_name, u.last_name as owner_last_name,
               mc.intended_city, mc.code as manager_code
        FROM studios s
        JOIN users u ON s.owner_id = u.id
        JOIN manager_codes mc ON mc.used_by_user_id = u.id
        WHERE mc.created_by_manager_id = ?
      `;
      
      const params = [managerId];

      if (city) {
        query += ' AND s.city = ?';
        params.push(city);
      }

      query += ' ORDER BY s.created_at DESC LIMIT ? OFFSET ?';
      params.push(parseInt(limit), offset);

      const studios = await new Promise((resolve, reject) => {
        db.all(query, params, (err, rows) => {
          if (err) reject(err);
          else resolve(rows);
        });
      });

      res.json({ studios });
    } catch (error) {
      console.error('Error fetching studios overview:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  }

  /**
   * Get cities overview
   * GET /api/v1/manager/cities
   */
  async getCitiesOverview(req, res) {
    try {
      const managerId = req.user.userId;

      const cities = await new Promise((resolve, reject) => {
        db.all(
          `SELECT 
            mc.intended_city as city,
            COUNT(*) as total_codes,
            COUNT(CASE WHEN mc.is_used = 1 THEN 1 END) as used_codes,
            COUNT(CASE WHEN s.id IS NOT NULL THEN 1 END) as studios_count
           FROM manager_codes mc
           LEFT JOIN users u ON mc.used_by_user_id = u.id
           LEFT JOIN studios s ON u.id = s.owner_id
           WHERE mc.created_by_manager_id = ?
           GROUP BY mc.intended_city
           ORDER BY studios_count DESC, city ASC`,
          [managerId],
          (err, rows) => {
            if (err) reject(err);
            else resolve(rows);
          }
        );
      });

      res.json({ cities });
    } catch (error) {
      console.error('Error fetching cities overview:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  }

  /**
   * Generate a unique 8-character alphanumeric code
   */
  generateCode() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let code = '';
    for (let i = 0; i < 8; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
  }
}

module.exports = new ManagerController();