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
   * Get all studios overview with Google Sheets integration status
   * GET /api/v1/manager/studios
   */
  async getStudiosOverview(req, res) {
    try {
      const managerId = req.user.userId;
      const { 
        search, 
        address, 
        city, 
        hasSheet,
        page = 1, 
        limit = 20 
      } = req.query;
      const offset = (page - 1) * limit;
      
      console.log('getStudiosOverview called with:', { managerId, search, address, city, hasSheet, page, limit });

      // Build base query with Google Sheets integration info
      let query = `
        SELECT 
          s.*,
          u.email as owner_email,
          u.first_name as owner_first_name,
          u.last_name as owner_last_name,
          CASE WHEN gsi.id IS NOT NULL THEN 1 ELSE 0 END as has_google_sheet,
          gsi.sheet_name,
          gsi.sheet_url,
          gsi.last_sync_at,
          gsi.auto_sync_enabled,
          COUNT(DISTINCT l.id) as total_leads,
          COUNT(DISTINCT CASE 
            WHEN l.source = 'google_sheets' 
            THEN l.id 
          END) as imported_leads
        FROM studios s
        JOIN users u ON s.owner_id = u.id
        LEFT JOIN google_sheets_integrations gsi ON s.id = gsi.studio_id AND gsi.is_active = 1
        LEFT JOIN leads l ON s.id = l.studio_id
        WHERE s.created_by_manager_id = ?
      `;
      
      const params = [managerId];

      // Add search filters
      if (search) {
        query += ` AND (
          s.name LIKE ? OR 
          s.address LIKE ? OR 
          s.city LIKE ? OR
          CONCAT(u.first_name, ' ', u.last_name) LIKE ?
        )`;
        const searchPattern = `%${search}%`;
        params.push(searchPattern, searchPattern, searchPattern, searchPattern);
      }

      // Add address filter
      if (address) {
        query += ` AND s.address LIKE ?`;
        params.push(`%${address}%`);
      }

      // Add city filter
      if (city) {
        query += ` AND s.city = ?`;
        params.push(city);
      }

      // Add Google Sheets filter
      if (hasSheet !== undefined) {
        if (hasSheet === 'true') {
          query += ` AND gsi.id IS NOT NULL`;
        } else if (hasSheet === 'false') {
          query += ` AND gsi.id IS NULL`;
        }
      }

      // Group by studio and add ordering
      query += ` GROUP BY s.id ORDER BY s.created_at DESC`;

      // Add pagination
      query += ` LIMIT ${parseInt(limit)} OFFSET ${parseInt(offset)}`;

      console.log('Running enhanced query with params:', params);
      const studios = await db.all(query, params);
      console.log('Query returned', studios.length, 'studios');

      // Get total count for pagination
      let countQuery = `
        SELECT COUNT(DISTINCT s.id) as total
        FROM studios s
        JOIN users u ON s.owner_id = u.id
        LEFT JOIN google_sheets_integrations gsi ON s.id = gsi.studio_id AND gsi.is_active = 1
        WHERE s.created_by_manager_id = ?
      `;
      
      const countParams = [managerId];

      if (search) {
        countQuery += ` AND (
          s.name LIKE ? OR 
          s.address LIKE ? OR 
          s.city LIKE ? OR
          CONCAT(u.first_name, ' ', u.last_name) LIKE ?
        )`;
        const searchPattern = `%${search}%`;
        countParams.push(searchPattern, searchPattern, searchPattern, searchPattern);
      }

      if (address) {
        countQuery += ` AND s.address LIKE ?`;
        countParams.push(`%${address}%`);
      }

      if (city) {
        countQuery += ` AND s.city = ?`;
        countParams.push(city);
      }

      if (hasSheet !== undefined) {
        if (hasSheet === 'true') {
          countQuery += ` AND gsi.id IS NOT NULL`;
        } else if (hasSheet === 'false') {
          countQuery += ` AND gsi.id IS NULL`;
        }
      }

      const { total } = await db.get(countQuery, countParams) || { total: 0 };

      // Format response with Google Sheets integration details
      const formattedStudios = studios.map(studio => ({
        ...studio,
        has_google_sheet: studio.has_google_sheet === 1,
        google_sheets_integration: studio.has_google_sheet ? {
          connected: true,
          sheet_name: studio.sheet_name,
          sheet_url: studio.sheet_url,
          last_sync: studio.last_sync_at,
          auto_sync_enabled: studio.auto_sync_enabled === 1,
          total_leads_imported: studio.imported_leads || 0
        } : {
          connected: false
        }
      }));

      res.json({ 
        studios: formattedStudios,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / limit)
        }
      });
    } catch (error) {
      console.error('Error fetching studios overview:', error);
      console.error('Error stack:', error.stack);
      res.status(500).json({ message: 'Internal server error' });
    }
  }

  /**
   * Get studio-specific Google Sheets integration details
   * GET /api/v1/manager/studios/:studioId/integration
   */
  async getStudioIntegration(req, res) {
    try {
      const managerId = req.user.userId;
      const { studioId } = req.params;

      // Verify the studio belongs to this manager
      const studio = await db.get(`
        SELECT 
          s.*,
          u.email as owner_email,
          u.first_name as owner_first_name,
          u.last_name as owner_last_name,
          gsi.id as integration_id,
          gsi.sheet_url,
          gsi.sheet_name,
          gsi.column_mapping,
          gsi.auto_sync_enabled,
          gsi.last_sync_at,
          gsi.created_at as integration_created_at
        FROM studios s
        JOIN users u ON s.owner_id = u.id
        LEFT JOIN google_sheets_integrations gsi ON s.id = gsi.studio_id AND gsi.is_active = 1
        WHERE s.id = ? AND s.created_by_manager_id = ?
      `, [studioId, managerId]);

      if (!studio) {
        return res.status(404).json({ message: 'Studio not found or access denied' });
      }

      // Get sync history if integration exists
      let syncHistory = [];
      if (studio.integration_id) {
        syncHistory = await db.all(`
          SELECT * FROM sync_tracking
          WHERE entity_type = 'studio' AND entity_id = ?
          ORDER BY synced_at DESC
          LIMIT 10
        `, [studioId]);
      }

      // Get lead statistics
      const leadStats = await db.get(`
        SELECT 
          COUNT(*) as total_leads,
          COUNT(CASE WHEN source = 'google_sheets' THEN 1 END) as imported_leads,
          COUNT(CASE WHEN DATE(created_at) = CURDATE() THEN 1 END) as leads_today
        FROM leads
        WHERE studio_id = ?
      `, [studioId]);

      const response = {
        studio: {
          id: studio.id,
          name: studio.name,
          owner_name: `${studio.owner_first_name} ${studio.owner_last_name}`,
          owner_email: studio.owner_email,
          city: studio.city,
          address: studio.address,
          phone: studio.phone,
          is_active: studio.is_active
        },
        integration: studio.integration_id ? {
          connected: true,
          integration_id: studio.integration_id,
          sheet_url: studio.sheet_url,
          sheet_name: studio.sheet_name,
          column_mapping: JSON.parse(studio.column_mapping || '{}'),
          auto_sync_enabled: studio.auto_sync_enabled === 1,
          last_sync: studio.last_sync_at,
          created_at: studio.integration_created_at,
          sync_history: syncHistory
        } : {
          connected: false
        },
        statistics: {
          total_leads: leadStats.total_leads || 0,
          imported_leads: leadStats.imported_leads || 0,
          leads_today: leadStats.leads_today || 0
        }
      };

      res.json(response);
    } catch (error) {
      console.error('Error fetching studio integration details:', error);
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