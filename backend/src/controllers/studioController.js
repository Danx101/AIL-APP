const { validationResult } = require('express-validator');
const Studio = require('../models/Studio');
const activationCodeService = require('../services/activationCodeService');
const db = require('../database/database-wrapper');

class StudioController {
  /**
   * Get pre-filled studio information from manager code
   * GET /api/v1/studios/prefill-info
   */
  async getPreFillInfo(req, res) {
    try {
      const owner_id = req.user.userId;

      // Get manager code information for pre-filling
      const managerCodeInfo = await new Promise((resolve, reject) => {
        db.get(
          'SELECT intended_city, intended_studio_name, intended_owner_name FROM manager_codes WHERE used_by_user_id = ?',
          [owner_id],
          (err, row) => {
            if (err) reject(err);
            else resolve(row);
          }
        );
      });

      if (!managerCodeInfo) {
        return res.status(404).json({ message: 'No manager code information found' });
      }

      res.json({
        preFillInfo: {
          studioName: managerCodeInfo.intended_studio_name || '',
          city: managerCodeInfo.intended_city || '',
          ownerName: managerCodeInfo.intended_owner_name || ''
        }
      });
    } catch (error) {
      console.error('Error fetching pre-fill info:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  }

  /**
   * Get all studios owned by the current user
   * GET /api/v1/studios/my-studios
   */
  async getMyStudios(req, res) {
    try {
      const ownerId = req.user.userId;
      
      // Get all studios owned by this user
      const studios = await new Promise((resolve, reject) => {
        db.all(
          `SELECT * FROM studios WHERE owner_id = ? AND is_active = 1 ORDER BY created_at DESC`,
          [ownerId],
          (err, rows) => {
            if (err) reject(err);
            else resolve(rows || []);
          }
        );
      });
      
      res.json({ 
        success: true,
        studios,
        count: studios.length
      });
    } catch (error) {
      console.error('Error getting user studios:', error);
      res.status(500).json({ 
        success: false,
        message: 'Internal server error' 
      });
    }
  }

  /**
   * Create a new studio
   * POST /api/v1/studios
   */
  async create(req, res) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { name, address, phone, email, business_hours, city, machine_count } = req.body;
      const owner_id = req.user.userId;

      // Note: We now allow multiple studios per owner
      // No longer checking if user already has a studio

      // Get manager code information for pre-filling and manager relationship
      const managerCodeInfo = await new Promise((resolve, reject) => {
        db.get(
          'SELECT intended_city, intended_studio_name, created_by_manager_id FROM manager_codes WHERE used_by_user_id = ?',
          [owner_id],
          (err, row) => {
            if (err) reject(err);
            else resolve(row);
          }
        );
      });

      // Use manager code information for pre-filling if not provided
      const finalName = name || managerCodeInfo?.intended_studio_name || '';
      const finalCity = city || managerCodeInfo?.intended_city || '';

      // Create studio with manager relationship
      const studio = await Studio.create({
        name: finalName,
        owner_id,
        address,
        phone,
        email,
        business_hours,
        city: finalCity,
        machine_count: machine_count || 1,
        created_by_manager_id: managerCodeInfo?.created_by_manager_id || null
      });

      res.status(201).json({
        message: 'Studio created successfully',
        studio
      });
    } catch (error) {
      console.error('Error creating studio:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  }

  /**
   * Get studio by ID
   * GET /api/v1/studios/:id
   */
  async getById(req, res) {
    try {
      const { id } = req.params;
      const studio = await Studio.findById(id);

      if (!studio) {
        return res.status(404).json({ message: 'Studio not found' });
      }

      // Check if user owns this studio or is admin
      if (req.user.role !== 'admin' && studio.owner_id !== req.user.userId) {
        return res.status(403).json({ message: 'Access denied' });
      }

      res.json({ studio });
    } catch (error) {
      console.error('Error fetching studio:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  }

  /**
   * Get current user's studio(s)
   * GET /api/v1/studios/my-studio
   */
  async getMyStudio(req, res) {
    try {
      // Get all studios owned by the user
      const studios = await new Promise((resolve, reject) => {
        db.all(
          'SELECT * FROM studios WHERE owner_id = ? AND is_active = 1',
          [req.user.userId],
          (err, rows) => {
            if (err) reject(err);
            else resolve(rows || []);
          }
        );
      });

      if (!studios || studios.length === 0) {
        return res.status(404).json({ message: 'No studio found for this user' });
      }

      // For backward compatibility, if only one studio, return as 'studio'
      // Otherwise return as 'studios' array
      if (studios.length === 1) {
        res.json({ studio: studios[0] });
      } else {
        // Return first studio as primary for compatibility
        res.json({ 
          studio: studios[0],
          studios: studios 
        });
      }
    } catch (error) {
      console.error('Error fetching user studios:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  }

  /**
   * Update studio information
   * PUT /api/v1/studios/:id
   */
  async update(req, res) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { id } = req.params;
      const updateData = req.body;

      // Check if studio exists and user owns it
      const studio = await Studio.findById(id);
      if (!studio) {
        return res.status(404).json({ message: 'Studio not found' });
      }

      if (studio.owner_id !== req.user.userId) {
        return res.status(403).json({ message: 'Access denied' });
      }

      // Update studio
      const updatedStudio = await Studio.update(id, updateData);

      res.json({
        message: 'Studio updated successfully',
        studio: updatedStudio
      });
    } catch (error) {
      console.error('Error updating studio:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  }

  /**
   * Delete studio
   * DELETE /api/v1/studios/:id
   */
  async delete(req, res) {
    try {
      const { id } = req.params;

      // Check if studio exists and user owns it
      const studio = await Studio.findById(id);
      if (!studio) {
        return res.status(404).json({ message: 'Studio not found' });
      }

      if (studio.owner_id !== req.user.userId) {
        return res.status(403).json({ message: 'Access denied' });
      }

      // Delete studio
      const deleted = await Studio.delete(id);

      if (deleted) {
        res.json({ message: 'Studio deleted successfully' });
      } else {
        res.status(404).json({ message: 'Studio not found' });
      }
    } catch (error) {
      console.error('Error deleting studio:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  }

  /**
   * Get all studios (admin only)
   * GET /api/v1/studios
   */
  async getAll(req, res) {
    try {
      const { limit = 50, offset = 0, includeInactive = false } = req.query;

      const studios = await Studio.findAll({
        limit: parseInt(limit),
        offset: parseInt(offset),
        includeInactive: includeInactive === 'true'
      });

      res.json({ studios });
    } catch (error) {
      console.error('Error fetching studios:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  }

  /**
   * Get studio statistics
   * GET /api/v1/studios/:id/stats
   */
  async getStatistics(req, res) {
    try {
      const { id } = req.params;

      // Check if studio exists and user owns it
      const studio = await Studio.findById(id);
      if (!studio) {
        return res.status(404).json({ message: 'Studio not found' });
      }

      if (studio.owner_id !== req.user.userId) {
        return res.status(403).json({ message: 'Access denied' });
      }

      const stats = await Studio.getStatistics(id);

      res.json({ statistics: stats });
    } catch (error) {
      console.error('Error fetching studio statistics:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  }

  /**
   * Generate activation codes for studio
   * POST /api/v1/studios/:id/activation-codes
   */
  async generateActivationCodes(req, res) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { id } = req.params;
      const { count = 10, expiresInDays = 30 } = req.body;

      // Check if studio exists and user owns it
      const studio = await Studio.findById(id);
      if (!studio) {
        return res.status(404).json({ message: 'Studio not found' });
      }

      if (studio.owner_id !== req.user.userId) {
        return res.status(403).json({ message: 'Access denied' });
      }

      // Generate activation codes
      const codes = await activationCodeService.generateCodes(id, count, expiresInDays);

      res.status(201).json({
        message: `${codes.length} activation codes generated successfully`,
        codes
      });
    } catch (error) {
      console.error('Error generating activation codes:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  }

  /**
   * Get activation codes for studio
   * GET /api/v1/studios/:id/activation-codes
   */
  async getActivationCodes(req, res) {
    try {
      const { id } = req.params;
      const { page = 1, limit = 20, showUsed = false } = req.query;

      // Check if studio exists and user owns it
      const studio = await Studio.findById(id);
      if (!studio) {
        return res.status(404).json({ message: 'Studio not found' });
      }

      if (studio.owner_id !== req.user.userId) {
        return res.status(403).json({ message: 'Access denied' });
      }

      // Get activation codes
      const codes = await activationCodeService.getStudioCodes(id, {
        page: parseInt(page),
        limit: parseInt(limit),
        showUsed: showUsed === 'true'
      });

      res.json({ codes });
    } catch (error) {
      console.error('Error fetching activation codes:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  }

  /**
   * Get customers for a studio
   * GET /api/v1/studios/:id/customers
   */
  async getCustomers(req, res) {
    try {
      const { id } = req.params;

      // Check if studio exists and user owns it
      const studio = await Studio.findById(id);
      if (!studio) {
        return res.status(404).json({ message: 'Studio not found' });
      }

      if (studio.owner_id !== req.user.userId) {
        return res.status(403).json({ message: 'Access denied' });
      }

      // Get customers from customers table with contact info
      const customers = await db.all(
        `SELECT 
          u.id, 
          u.email as login_email,
          COALESCE(c.contact_email, u.email) as email,
          COALESCE(c.contact_first_name, u.first_name) as first_name,
          COALESCE(c.contact_last_name, u.last_name) as last_name,
          COALESCE(c.contact_phone, u.phone) as phone,
          u.created_at,
          c.probebehandlung_used,
          c.last_weight,
          c.goal_weight,
          c.initial_weight,
          c.notes as customer_notes
        FROM customers c
        JOIN users u ON c.user_id = u.id
        WHERE c.studio_id = ? AND u.role = 'customer'
        ORDER BY u.created_at DESC`,
        [id]
      );

      // Add status and session count
      const customersWithStatus = customers.map(customer => ({
        ...customer,
        status: 'neu', // This should be calculated based on lead status if applicable
        total_sessions: 0 // This will be calculated from session blocks
      }));

      res.json({ customers: customersWithStatus });
    } catch (error) {
      console.error('Error fetching studio customers:', error);
      res.status(500).json({ 
        message: 'Internal server error', 
        error: error.message,
        details: 'Failed to load customers from database'
      });
    }
  }

  /**
   * Get dashboard statistics for a studio
   * GET /api/v1/studios/:id/dashboard-stats
   */
  async getDashboardStats(req, res) {
    try {
      const { id } = req.params;

      // Check if studio exists and user owns it
      const studio = await Studio.findById(id);
      if (!studio) {
        return res.status(404).json({ message: 'Studio not found' });
      }

      if (studio.owner_id !== req.user.userId) {
        return res.status(403).json({ message: 'Access denied' });
      }

      // Get dashboard statistics
      const stats = await new Promise((resolve, reject) => {
        const today = new Date().toISOString().split('T')[0];
        
        db.get(
          `SELECT 
             COUNT(DISTINCT CASE WHEN cs.remaining_sessions > 0 AND cs.is_active = 1 THEN u.id END) as active_customers,
             COUNT(DISTINCT CASE WHEN a.appointment_date = ? AND a.status IN ('confirmed', 'pending', 'bestätigt') THEN a.id END) as today_remaining_appointments,
             COUNT(DISTINCT CASE WHEN a.appointment_date = ? AND a.status IN ('completed', 'abgeschlossen') THEN a.id END) as today_completed_appointments,
             COUNT(DISTINCT a.id) as total_appointments_this_week
           FROM users u
           JOIN activation_codes ac ON u.id = ac.used_by_user_id
           LEFT JOIN customer_sessions cs ON u.id = cs.customer_id AND cs.studio_id = ?
           LEFT JOIN appointments a ON u.id = a.customer_id AND a.studio_id = ?
           WHERE ac.studio_id = ? AND u.role = 'customer'`,
          [today, today, id, id, id],
          (err, row) => {
            if (err) reject(err);
            else resolve(row);
          }
        );
      });

      // Calculate utilization (simplified - based on appointments vs theoretical capacity)
      const utilization = await new Promise((resolve, reject) => {
        const weekStart = new Date();
        weekStart.setDate(weekStart.getDate() - weekStart.getDay());
        const weekStartStr = weekStart.toISOString().split('T')[0];
        
        db.get(
          `SELECT COUNT(*) as weekly_appointments
           FROM appointments 
           WHERE studio_id = ? 
           AND appointment_date >= ? 
           AND status IN ('confirmed', 'completed', 'bestätigt', 'abgeschlossen')`,
          [id, weekStartStr],
          (err, row) => {
            if (err) reject(err);
            else {
              // 5 working days × 8 appointments + 1 working day × 5 appointments = 45 theoretical capacity
              const theoreticalCapacity = 45;
              const utilizationRate = Math.round((row.weekly_appointments / theoreticalCapacity) * 100);
              resolve(Math.min(utilizationRate, 100)); // Cap at 100%
            }
          }
        );
      });

      res.json({
        stats: {
          activeCustomers: {
            value: stats.active_customers || 0,
            change: `${stats.active_customers || 0} registriert`,
            changeType: 'neutral'
          },
          todayAppointments: {
            value: stats.today_remaining_appointments || 0,
            change: `${stats.today_remaining_appointments || 0} verbleibend`,
            changeType: 'neutral'
          },
          utilization: {
            value: `${utilization}%`,
            change: 'Diese Woche',
            changeType: 'neutral'
          }
        }
      });
    } catch (error) {
      console.error('Error fetching dashboard stats:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  }

  /**
   * Get studio settings
   * GET /api/v1/studios/:id/settings
   */
  async getStudioSettings(req, res) {
    try {
      const { id } = req.params;

      // Authorization check - only studio owner can access their studio settings
      const studio = await new Promise((resolve, reject) => {
        db.get('SELECT * FROM studios WHERE id = ? AND owner_id = ?', [id, req.user.userId], (err, row) => {
          if (err) reject(err);
          else resolve(row);
        });
      });

      if (!studio) {
        return res.status(404).json({ message: 'Studio not found or access denied' });
      }

      res.json({
        settings: {
          cancellation_advance_hours: studio.cancellation_advance_hours || 48,
          postponement_advance_hours: studio.postponement_advance_hours || 48,
          max_advance_booking_days: studio.max_advance_booking_days || 30,
          settings_updated_at: studio.settings_updated_at
        }
      });

    } catch (error) {
      console.error('Error fetching studio settings:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  }

  /**
   * Update studio settings
   * PATCH /api/v1/studios/:id/settings
   */
  async updateStudioSettings(req, res) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { id } = req.params;
      const { 
        cancellation_advance_hours, 
        postponement_advance_hours, 
        max_advance_booking_days 
      } = req.body;

      // Authorization check - only studio owner can update their studio settings
      const studio = await new Promise((resolve, reject) => {
        db.get('SELECT * FROM studios WHERE id = ? AND owner_id = ?', [id, req.user.userId], (err, row) => {
          if (err) reject(err);
          else resolve(row);
        });
      });

      if (!studio) {
        return res.status(404).json({ message: 'Studio not found or access denied' });
      }

      // Build update query dynamically based on provided fields
      const updates = [];
      const values = [];

      if (cancellation_advance_hours !== undefined) {
        updates.push('cancellation_advance_hours = ?');
        values.push(cancellation_advance_hours);
      }

      if (postponement_advance_hours !== undefined) {
        updates.push('postponement_advance_hours = ?');
        values.push(postponement_advance_hours);
      }

      if (max_advance_booking_days !== undefined) {
        updates.push('max_advance_booking_days = ?');
        values.push(max_advance_booking_days);
      }

      if (updates.length === 0) {
        return res.status(400).json({ message: 'No settings provided to update' });
      }

      // Add timestamp and studio ID
      updates.push('settings_updated_at = CURRENT_TIMESTAMP');
      values.push(id);

      const query = `UPDATE studios SET ${updates.join(', ')} WHERE id = ?`;

      await new Promise((resolve, reject) => {
        db.run(query, values, function(err) {
          if (err) reject(err);
          else resolve(this.changes);
        });
      });

      // Fetch updated settings
      const updatedStudio = await new Promise((resolve, reject) => {
        db.get('SELECT * FROM studios WHERE id = ?', [id], (err, row) => {
          if (err) reject(err);
          else resolve(row);
        });
      });

      res.json({
        message: 'Studio settings updated successfully',
        settings: {
          cancellation_advance_hours: updatedStudio.cancellation_advance_hours,
          postponement_advance_hours: updatedStudio.postponement_advance_hours,
          max_advance_booking_days: updatedStudio.max_advance_booking_days,
          settings_updated_at: updatedStudio.settings_updated_at
        }
      });

    } catch (error) {
      console.error('Error updating studio settings:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  }

  /**
   * Update customer data (for studio owners)
   * PATCH /api/v1/studios/:studioId/customers/:customerId
   */
  async updateCustomer(req, res) {
    try {
      const { studioId, customerId } = req.params;
      const { first_name, last_name, email, phone } = req.body;

      // Check if studio exists and user owns it
      const studio = await Studio.findById(studioId);
      if (!studio) {
        return res.status(404).json({ message: 'Studio not found' });
      }

      if (studio.owner_id !== req.user.userId) {
        return res.status(403).json({ message: 'Access denied' });
      }

      // Verify customer exists in customers table for this studio
      const customer = await db.get(
        `SELECT c.*, u.email as login_email FROM customers c
         JOIN users u ON c.user_id = u.id
         WHERE c.user_id = ? AND c.studio_id = ?`,
        [customerId, studioId]
      );

      if (!customer) {
        return res.status(404).json({ message: 'Customer not found or not associated with this studio' });
      }

      // Validate input
      if (!first_name || !last_name || !email) {
        return res.status(400).json({ message: 'First name, last name, and email are required' });
      }

      // Update customer contact information in customers table
      await db.run(
        `UPDATE customers 
         SET contact_first_name = ?, contact_last_name = ?, contact_email = ?, contact_phone = ?, updated_at = NOW() 
         WHERE user_id = ? AND studio_id = ?`,
        [first_name, last_name, email, phone, customerId, studioId]
      );

      // Also update the display name in users table (but NOT the login email)
      await db.run(
        'UPDATE users SET first_name = ?, last_name = ?, phone = ?, updated_at = NOW() WHERE id = ?',
        [first_name, last_name, phone, customerId]
      );

      res.json({ 
        message: 'Customer contact information updated successfully',
        customer: { 
          id: customerId, 
          first_name, 
          last_name, 
          contact_email: email,
          login_email: customer.login_email,
          phone 
        }
      });

    } catch (error) {
      console.error('Error updating customer:', error);
      res.status(500).json({ 
        message: 'Internal server error', 
        error: error.message 
      });
    }
  }
}

module.exports = new StudioController();