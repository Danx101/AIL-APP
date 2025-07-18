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
            if (err) reject(err);
            else resolve(rows);
          }
        );
      });

      res.json({ customers });
    } catch (error) {
      console.error('Error fetching studio customers:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  }
}

module.exports = new StudioController();