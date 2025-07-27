const { validationResult } = require('express-validator');
const Studio = require('../models/Studio');
const activationCodeService = require('../services/activationCodeService');
const db = require('../database/connection');

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
   * Create a new studio
   * POST /api/v1/studios
   */
  async create(req, res) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { name, address, phone, email, business_hours, city } = req.body;
      const owner_id = req.user.userId;

      // Check if user already has a studio
      const existingStudio = await Studio.findByOwnerId(owner_id);
      if (existingStudio) {
        return res.status(400).json({ message: 'User already owns a studio' });
      }

      // Get manager code information for pre-filling
      const managerCodeInfo = await new Promise((resolve, reject) => {
        db.get(
          'SELECT intended_city, intended_studio_name FROM manager_codes WHERE used_by_user_id = ?',
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

      // Create studio
      const studio = await Studio.create({
        name: finalName,
        owner_id,
        address,
        phone,
        email,
        business_hours,
        city: finalCity
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
   * Get current user's studio
   * GET /api/v1/studios/my-studio
   */
  async getMyStudio(req, res) {
    try {
      const studio = await Studio.findByOwnerId(req.user.userId);

      if (!studio) {
        return res.status(404).json({ message: 'No studio found for this user' });
      }

      res.json({ studio });
    } catch (error) {
      console.error('Error fetching user studio:', error);
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

      // Get customers who have used activation codes from this studio
      const customers = await new Promise((resolve, reject) => {
        db.all(
          `SELECT DISTINCT u.id, u.email, u.first_name, u.last_name, u.phone, u.created_at
           FROM users u
           JOIN activation_codes ac ON u.id = ac.used_by_user_id
           WHERE ac.studio_id = ? AND u.role = 'customer'
           ORDER BY u.created_at DESC`,
          [id],
          (err, rows) => {
            if (err) {
              console.error('Database error fetching customers:', err);
              reject(err);
            } else {
              // Add status calculation for each customer
              const customersWithStatus = rows.map(customer => ({
                ...customer,
                status: 'neu', // For now, we'll calculate this separately if needed
                total_sessions: 0 // Will be calculated in session blocks
              }));
              resolve(customersWithStatus);
            }
          }
        );
      });

      res.json({ customers });
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

      // Verify customer belongs to this studio (has used activation code from this studio)
      const customerStudioLink = await new Promise((resolve, reject) => {
        db.get(
          `SELECT u.id FROM users u
           JOIN activation_codes ac ON u.id = ac.used_by_user_id
           WHERE u.id = ? AND ac.studio_id = ? AND u.role = 'customer'`,
          [customerId, studioId],
          (err, row) => {
            if (err) reject(err);
            else resolve(row);
          }
        );
      });

      if (!customerStudioLink) {
        return res.status(404).json({ message: 'Customer not found or not associated with this studio' });
      }

      // Validate input
      if (!first_name || !last_name || !email) {
        return res.status(400).json({ message: 'First name, last name, and email are required' });
      }

      // Check if email is already taken by another user
      const existingUser = await new Promise((resolve, reject) => {
        db.get(
          'SELECT id FROM users WHERE email = ? AND id != ?',
          [email, customerId],
          (err, row) => {
            if (err) reject(err);
            else resolve(row);
          }
        );
      });

      if (existingUser) {
        return res.status(400).json({ message: 'Email address already exists' });
      }

      // Update customer data
      await new Promise((resolve, reject) => {
        db.run(
          'UPDATE users SET first_name = ?, last_name = ?, email = ?, phone = ?, updated_at = datetime("now") WHERE id = ?',
          [first_name, last_name, email, phone, customerId],
          (err) => {
            if (err) reject(err);
            else resolve();
          }
        );
      });

      res.json({ 
        message: 'Customer updated successfully',
        customer: { id: customerId, first_name, last_name, email, phone }
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