const { validationResult } = require('express-validator');
const db = require('../database/database-wrapper');
const Subscription = require('../models/Subscription');
const PromoCode = require('../models/PromoCode');
const SubscriptionService = require('../services/subscriptionService');

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
  getStudioOwnerCodes = async (req, res) => {
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
  getStatistics = async (req, res) => {
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

      // Get subscription statistics
      const subscriptionStats = await Subscription.getStatistics();
      const conversionStats = await SubscriptionService.getTrialConversionStats(30);
      const promocodeStats = await PromoCode.getStatistics(managerId);

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
          },
          subscriptions: {
            total: subscriptionStats.total_subscriptions || 0,
            active_trials: subscriptionStats.active_trials || 0,
            active_subscriptions: subscriptionStats.active_subscriptions || 0,
            expired_trials: subscriptionStats.expired_trials || 0,
            payment_failed: subscriptionStats.payment_failed || 0,
            monthly_revenue_eur: subscriptionStats.monthly_revenue_eur || 0,
            conversion_rate: conversionStats.conversion_rate || '0%'
          },
          promocodes: {
            total_created: promocodeStats.total_codes || 0,
            total_redeemed: promocodeStats.total_redemptions || 0,
            active_codes: promocodeStats.active_codes || 0,
            remaining_uses: promocodeStats.remaining_uses || 0
          }
        }
      });
    } catch (error) {
      console.error('Error fetching manager statistics:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  }

  /**
   * Get subscription overview for managers
   * GET /api/v1/manager/subscriptions
   */
  getSubscriptionsOverview = async (req, res) => {
    try {
      const { limit = 50, offset = 0, status } = req.query;
      
      const subscriptions = await Subscription.findAll({ 
        limit: parseInt(limit), 
        offset: parseInt(offset),
        status 
      });
      
      const statistics = await Subscription.getStatistics();
      const expiredTrials = await Subscription.findExpiredTrials(7);
      
      res.json({
        subscriptions,
        expired_trials_needing_attention: expiredTrials,
        statistics,
        pagination: {
          limit: parseInt(limit),
          offset: parseInt(offset),
          total: subscriptions.length
        }
      });

    } catch (error) {
      console.error('Error getting subscription overview:', error);
      res.status(500).json({ 
        error: 'Failed to get subscription overview',
        message: 'Internal server error' 
      });
    }
  }

  /**
   * Get all studios overview with Google Sheets integration status
   * GET /api/v1/manager/studios
   */
  getStudiosOverview = async (req, res) => {
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

      // Build base query with Google Sheets integration info and subscription data
      let query = `
        SELECT 
          s.*,
          u.email as owner_email,
          u.first_name as owner_first_name,
          u.last_name as owner_last_name,
          u.phone as owner_phone,
          CASE WHEN gsi.id IS NOT NULL THEN 1 ELSE 0 END as has_google_sheet,
          gsi.sheet_id,
          gsi.sheet_name,
          gsi.last_sync_at,
          gsi.auto_sync_enabled,
          sub.plan_type,
          sub.status as subscription_status,
          sub.trial_started_at,
          sub.trial_ends_at,
          sub.current_period_start,
          sub.current_period_end,
          sub.max_studios_allowed,
          CASE 
            WHEN sub.status = 'trial' AND sub.trial_ends_at > NOW() THEN 'Active Trial'
            WHEN sub.status = 'trial' AND sub.trial_ends_at <= NOW() THEN 'Expired Trial'
            WHEN sub.status = 'active' THEN 'Paid Subscription'
            WHEN sub.status = 'cancelled' THEN 'Cancelled'
            ELSE 'No Subscription'
          END as subscription_display_status,
          COUNT(DISTINCT l.id) as total_leads,
          COUNT(DISTINCT CASE 
            WHEN l.source = 'google_sheets' 
            THEN l.id 
          END) as imported_leads
        FROM studios s
        JOIN users u ON s.owner_id = u.id
        LEFT JOIN subscriptions sub ON u.id = sub.user_id
        LEFT JOIN google_sheets_integrations gsi ON s.id = gsi.studio_id
        LEFT JOIN leads l ON s.id = l.studio_id
        WHERE s.is_active = 1
      `;
      
      const params = [];

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
      query += ` GROUP BY s.id, u.email, u.first_name, u.last_name, u.phone, sub.id, sub.plan_type, sub.status, sub.trial_started_at, sub.trial_ends_at, sub.current_period_start, sub.current_period_end, sub.max_studios_allowed, gsi.id, gsi.sheet_id, gsi.sheet_name, gsi.last_sync_at, gsi.auto_sync_enabled ORDER BY s.created_at DESC`;

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
        LEFT JOIN subscriptions sub ON u.id = sub.user_id
        LEFT JOIN google_sheets_integrations gsi ON s.id = gsi.studio_id
        WHERE s.is_active = 1
      `;
      
      const countParams = [];

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
          sheet_id: studio.sheet_id,
          sheet_name: studio.sheet_name,
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
  getStudioIntegration = async (req, res) => {
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
          gsi.sheet_id,
          gsi.sheet_name,
          gsi.column_mapping,
          gsi.auto_sync_enabled,
          gsi.last_sync_at,
          gsi.created_at as integration_created_at
        FROM studios s
        JOIN users u ON s.owner_id = u.id
        LEFT JOIN google_sheets_integrations gsi ON s.id = gsi.studio_id
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
          is_active: true
        },
        integration: studio.integration_id ? {
          connected: true,
          integration_id: studio.integration_id,
          sheet_id: studio.sheet_id,
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
   * Get comprehensive studio details including subscription and payment history
   * GET /api/v1/manager/studios/:studioId/details
   */
  getStudioDetails = async (req, res) => {
    try {
      const { studioId } = req.params;
      
      // Get studio with owner and subscription info
      const studioQuery = `
        SELECT 
          s.*,
          u.email as owner_email,
          u.first_name as owner_first_name,
          u.last_name as owner_last_name,
          u.phone as owner_phone,
          u.created_at as owner_created_at,
          sub.id as subscription_id,
          sub.plan_type,
          sub.status as subscription_status,
          sub.trial_started_at,
          sub.trial_ends_at,
          sub.current_period_start,
          sub.current_period_end,
          sub.max_studios_allowed,
          sub.stripe_customer_id,
          sub.stripe_subscription_id,
          CASE 
            WHEN sub.status = 'trial' AND sub.trial_ends_at > NOW() 
            THEN DATEDIFF(sub.trial_ends_at, NOW())
            WHEN sub.status = 'active' AND sub.current_period_end > NOW()
            THEN DATEDIFF(sub.current_period_end, NOW())
            ELSE 0
          END as days_remaining,
          CASE 
            WHEN sub.status = 'trial' AND sub.trial_ends_at > NOW() THEN 'Active Trial'
            WHEN sub.status = 'trial' AND sub.trial_ends_at <= NOW() THEN 'Expired Trial'
            WHEN sub.status = 'active' THEN 'Paid Subscription'
            WHEN sub.status = 'cancelled' THEN 'Cancelled'
            WHEN sub.status = 'payment_failed' THEN 'Payment Failed'
            ELSE 'No Subscription'
          END as subscription_display_status
        FROM studios s
        JOIN users u ON s.owner_id = u.id
        LEFT JOIN subscriptions sub ON u.id = sub.user_id
        WHERE s.id = ?
      `;
      
      const studio = await db.get(studioQuery, [studioId]);
      
      if (!studio) {
        return res.status(404).json({ message: 'Studio not found' });
      }

      // Get payment history if subscription exists
      let paymentHistory = [];
      if (studio.subscription_id) {
        const paymentQuery = `
          SELECT 
            id,
            amount_cents,
            currency,
            status,
            payment_date,
            period_start,
            period_end,
            failure_reason,
            stripe_payment_intent_id,
            stripe_invoice_id,
            created_at
          FROM subscription_payments
          WHERE subscription_id = ?
          ORDER BY created_at DESC
          LIMIT 20
        `;
        paymentHistory = await db.all(paymentQuery, [studio.subscription_id]);
      }

      // Get promo code usage history
      let promoCodeUsage = [];
      if (studio.subscription_id) {
        const promoQuery = `
          SELECT 
            pu.id,
            pu.used_at,
            pu.months_added,
            pu.previous_trial_end,
            pu.new_trial_end,
            p.code as promo_code,
            p.description as promo_description,
            manager.email as created_by_manager
          FROM promocode_usage pu
          JOIN promocodes p ON pu.promocode_id = p.id
          JOIN users manager ON p.created_by_manager_id = manager.id
          WHERE pu.user_id = ?
          ORDER BY pu.used_at DESC
        `;
        promoCodeUsage = await db.all(promoQuery, [studio.owner_id]);
      }

      // Get lead statistics
      const leadStats = await db.get(`
        SELECT 
          COUNT(*) as total_leads,
          COUNT(CASE WHEN source = 'google_sheets' THEN 1 END) as imported_leads,
          COUNT(CASE WHEN source = 'manual' THEN 1 END) as manual_leads,
          COUNT(CASE WHEN status = 'neu' THEN 1 END) as new_leads,
          COUNT(CASE WHEN status = 'kontaktiert' THEN 1 END) as contacted_leads,
          COUNT(CASE WHEN status = 'konvertiert' THEN 1 END) as converted_leads,
          COUNT(CASE WHEN DATE(created_at) >= DATE_SUB(NOW(), INTERVAL 30 DAY) THEN 1 END) as leads_last_30_days
        FROM leads
        WHERE studio_id = ?
      `, [studioId]);

      // Get customer statistics
      const customerStats = await db.get(`
        SELECT 
          COUNT(*) as total_customers,
          COUNT(CASE WHEN DATE(created_at) >= DATE_SUB(NOW(), INTERVAL 30 DAY) THEN 1 END) as new_customers_30_days
        FROM users
        WHERE role = 'customer' 
        AND id IN (
          SELECT DISTINCT customer_id 
          FROM appointments 
          WHERE studio_id = ?
        )
      `, [studioId]);

      // Get Google Sheets integration status
      const integration = await db.get(`
        SELECT 
          id,
          sheet_id,
          sheet_name,
          auto_sync_enabled,
          last_sync_at,
          created_at
        FROM google_sheets_integrations
        WHERE studio_id = ?
      `, [studioId]);

      // Format response
      const response = {
        studio: {
          id: studio.id,
          name: studio.name,
          city: studio.city,
          address: studio.address,
          phone: studio.phone,
          email: studio.email,
          is_active: studio.is_active,
          created_at: studio.created_at
        },
        owner: {
          id: studio.owner_id,
          email: studio.owner_email,
          name: `${studio.owner_first_name || ''} ${studio.owner_last_name || ''}`.trim(),
          phone: studio.owner_phone,
          created_at: studio.owner_created_at
        },
        subscription: {
          id: studio.subscription_id,
          plan_type: studio.plan_type || 'none',
          status: studio.subscription_status || 'none',
          display_status: studio.subscription_display_status,
          days_remaining: studio.days_remaining || 0,
          trial_started_at: studio.trial_started_at,
          trial_ends_at: studio.trial_ends_at,
          current_period_start: studio.current_period_start,
          current_period_end: studio.current_period_end,
          max_studios_allowed: studio.max_studios_allowed || 1,
          stripe_customer_id: studio.stripe_customer_id,
          stripe_subscription_id: studio.stripe_subscription_id
        },
        payment_history: paymentHistory.map(payment => ({
          id: payment.id,
          amount_euros: (payment.amount_cents / 100).toFixed(2),
          currency: payment.currency,
          status: payment.status,
          payment_date: payment.payment_date,
          period_start: payment.period_start,
          period_end: payment.period_end,
          failure_reason: payment.failure_reason,
          created_at: payment.created_at
        })),
        promo_code_usage: promoCodeUsage,
        statistics: {
          leads: {
            total: leadStats?.total_leads || 0,
            imported: leadStats?.imported_leads || 0,
            manual: leadStats?.manual_leads || 0,
            new: leadStats?.new_leads || 0,
            contacted: leadStats?.contacted_leads || 0,
            converted: leadStats?.converted_leads || 0,
            last_30_days: leadStats?.leads_last_30_days || 0
          },
          customers: {
            total: customerStats?.total_customers || 0,
            new_last_30_days: customerStats?.new_customers_30_days || 0
          }
        },
        google_sheets_integration: integration ? {
          connected: true,
          sheet_id: integration.sheet_id,
          sheet_name: integration.sheet_name,
          auto_sync_enabled: integration.auto_sync_enabled,
          last_sync_at: integration.last_sync_at,
          created_at: integration.created_at
        } : {
          connected: false
        }
      };

      res.json(response);
    } catch (error) {
      console.error('Error fetching studio details:', error);
      res.status(500).json({ message: 'Internal server error', error: error.message });
    }
  }

  /**
   * Get cities overview
   * GET /api/v1/manager/cities
   */
  getCitiesOverview = async (req, res) => {
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
  generateCode = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let code = '';
    for (let i = 0; i < 8; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
  }
}

module.exports = new ManagerController();