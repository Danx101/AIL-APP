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
        expiresInDays = 3 
      } = req.body;

      const managerId = req.user.userId;
      const codes = [];
      
      console.log('Generating manager code with params:', { intendedOwnerName, intendedCity, intendedStudioName, count, expiresInDays, managerId });

      // Generate expiration date
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + expiresInDays);
      
      // Format datetime for MySQL
      const mysqlExpiresAt = expiresAt.toISOString().slice(0, 19).replace('T', ' ');

      // Generate codes
      for (let i = 0; i < count; i++) {
        // Generate 8-character code
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
        let code = '';
        for (let j = 0; j < 8; j++) {
          code += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        
        const result = await db.run(
          `INSERT INTO manager_codes 
           (code, intended_owner_name, intended_city, intended_studio_name, created_by_manager_id, expires_at, created_at) 
           VALUES (?, ?, ?, ?, ?, DATE_ADD(NOW(), INTERVAL ? DAY), NOW())`,
          [code, intendedOwnerName, intendedCity, intendedStudioName, managerId, expiresInDays]
        );
        const codeId = result.lastID;

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
        city,
        includeExpired = false 
      } = req.query;

      const managerId = req.user.userId;
      const offset = (page - 1) * limit;

      let query = `
        SELECT mc.*
        FROM manager_codes mc
        WHERE mc.created_by_manager_id = ?
      `;
      
      const params = [managerId];

      if (city) {
        query += ' AND mc.intended_city = ?';
        params.push(city);
      }

      if (!includeExpired) {
        query += ' AND (mc.expires_at IS NULL OR mc.expires_at > NOW())';
      }

      query += ` ORDER BY mc.created_at DESC LIMIT ${parseInt(limit)} OFFSET ${parseInt(offset)}`;

      const codes = await db.all(query, params);

      // Get total count for pagination
      let countQuery = `
        SELECT COUNT(*) as total
        FROM manager_codes mc
        WHERE mc.created_by_manager_id = ?
      `;
      
      const countParams = [managerId];

      if (city) {
        countQuery += ' AND mc.intended_city = ?';
        countParams.push(city);
      }

      if (!includeExpired) {
        countQuery += ' AND (mc.expires_at IS NULL OR mc.expires_at > NOW())';
      }

      const { total } = await db.get(countQuery, countParams);

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

      const stats = await db.get(
        `SELECT 
          COUNT(*) as total_codes,
          0 as used_codes,
          COUNT(CASE WHEN expires_at IS NULL OR expires_at > NOW() THEN 1 END) as active_codes,
          COUNT(CASE WHEN expires_at <= NOW() THEN 1 END) as expired_codes,
          COUNT(DISTINCT intended_city) as cities_count
         FROM manager_codes 
         WHERE created_by_manager_id = ?`,
        [managerId]
      );

      // Get studios count using direct relationship
      const studioStats = await db.get(
        `SELECT COUNT(*) as total_studios
         FROM studios s
         WHERE s.created_by_manager_id = ?`,
        [managerId]
      );

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
      
      console.log('getStudiosOverview called with:', { managerId, city, page, limit, offset });

      let query = `
        SELECT s.*, u.email as owner_email, u.first_name as owner_first_name, u.last_name as owner_last_name
        FROM studios s
        JOIN users u ON s.owner_id = u.id
        WHERE s.created_by_manager_id = ?
      `;
      
      const params = [managerId];

      if (city) {
        query += ' AND s.city = ?';
        params.push(city);
      }

      query += ` ORDER BY s.created_at DESC LIMIT ${parseInt(limit)} OFFSET ${parseInt(offset)}`;

      console.log('Running query with params:', params);
      const studios = await db.all(query, params);
      console.log('Query returned', studios.length, 'studios');

      res.json({ studios });
    } catch (error) {
      console.error('Error fetching studios overview:', error);
      console.error('Error stack:', error.stack);
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

      const cities = await db.all(
        `SELECT 
          s.city,
          COUNT(DISTINCT s.id) as studios_count,
          COUNT(DISTINCT mc.id) as total_codes,
          0 as used_codes
         FROM studios s
         LEFT JOIN manager_codes mc ON mc.intended_city = s.city AND mc.created_by_manager_id = ?
         WHERE s.created_by_manager_id = ?
         GROUP BY s.city
         UNION
         SELECT 
          mc.intended_city as city,
          0 as studios_count,
          COUNT(*) as total_codes,
          0 as used_codes
         FROM manager_codes mc
         WHERE mc.created_by_manager_id = ?
           AND mc.intended_city NOT IN (
             SELECT DISTINCT city FROM studios WHERE created_by_manager_id = ?
           )
         GROUP BY mc.intended_city
         ORDER BY studios_count DESC, city ASC`,
        [managerId, managerId, managerId, managerId]
      );

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