const { validationResult } = require('express-validator');
const googleSheetsService = require('../services/googleSheetsService');
const Lead = require('../models/Lead');
const db = require('../database/connection');

class ManagerLeadController {
  /**
   * Connect Google Sheets to a studio (Manager Only)
   * POST /api/v1/manager/google-sheets/connect
   */
  async connectGoogleSheets(req, res) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      // Manager-only authorization
      if (req.user.role !== 'manager') {
        return res.status(403).json({ 
          message: 'Access denied. Only managers can manage Google Sheets integrations.' 
        });
      }

      const { studio_id, sheet_url, column_mapping, auto_sync_enabled = true } = req.body;

      try {
        // Test connection and preview data
        const previewResult = await googleSheetsService.previewSheetData(sheet_url, 0, 5);
        
        // Validate column mapping against available headers
        const requiredFields = ['name', 'phone_number'];
        for (const field of requiredFields) {
          if (!column_mapping[field] || !previewResult.headers.includes(column_mapping[field])) {
            return res.status(400).json({
              message: `Required field '${field}' is not properly mapped or column not found`,
              availableColumns: previewResult.headers
            });
          }
        }

        // Save integration record
        const integrationId = await this.saveGoogleSheetsIntegration({
          studio_id,
          sheet_url,
          sheet_name: previewResult.worksheetTitle,
          column_mapping,
          auto_sync_enabled,
          manager_id: req.user.userId
        });

        // Perform initial import
        const importResult = await googleSheetsService.importLeads(
          studio_id,
          sheet_url,
          column_mapping,
          req.user.userId
        );

        res.status(201).json({
          message: 'Google Sheets integration created successfully',
          integration: {
            id: integrationId,
            studio_id,
            sheet_name: previewResult.worksheetTitle,
            auto_sync_enabled,
            totalRows: previewResult.totalRows
          },
          importResult
        });

      } catch (connectionError) {
        console.error('Google Sheets connection error:', connectionError);
        res.status(500).json({
          message: 'Failed to connect to Google Sheets',
          error: connectionError.message
        });
      }

    } catch (error) {
      console.error('Error connecting Google Sheets:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  }

  /**
   * Preview Google Sheets data before connecting
   * POST /api/v1/manager/google-sheets/preview
   */
  async previewGoogleSheets(req, res) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      // Manager-only authorization
      if (req.user.role !== 'manager') {
        return res.status(403).json({ 
          message: 'Access denied. Only managers can preview Google Sheets.' 
        });
      }

      const { sheet_url, worksheet_index = 0 } = req.body;

      try {
        const previewResult = await googleSheetsService.previewSheetData(
          sheet_url, 
          worksheet_index, 
          10
        );

        res.json({
          message: 'Google Sheets preview loaded successfully',
          preview: previewResult
        });

      } catch (previewError) {
        console.error('Google Sheets preview error:', previewError);
        res.status(500).json({
          message: 'Failed to preview Google Sheets',
          error: previewError.message
        });
      }

    } catch (error) {
      console.error('Error previewing Google Sheets:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  }

  /**
   * Get all Google Sheets integrations (Manager Only)
   * GET /api/v1/manager/google-sheets
   */
  async getGoogleSheetsIntegrations(req, res) {
    try {
      // Manager-only authorization
      if (req.user.role !== 'manager') {
        return res.status(403).json({ 
          message: 'Access denied. Only managers can view Google Sheets integrations.' 
        });
      }

      const integrations = await this.getAllIntegrations(req.user.userId);

      res.json({
        integrations
      });

    } catch (error) {
      console.error('Error getting Google Sheets integrations:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  }

  /**
   * Get Google Sheets integration by ID
   * GET /api/v1/manager/google-sheets/:id
   */
  async getGoogleSheetsIntegration(req, res) {
    try {
      const { id } = req.params;

      // Manager-only authorization
      if (req.user.role !== 'manager') {
        return res.status(403).json({ 
          message: 'Access denied. Only managers can view Google Sheets integrations.' 
        });
      }

      const integration = await googleSheetsService.getIntegrationById(id);
      
      if (!integration) {
        return res.status(404).json({ message: 'Integration not found' });
      }

      // Ensure manager owns this integration
      if (integration.manager_id !== req.user.userId) {
        return res.status(403).json({ message: 'Access denied' });
      }

      res.json({ integration });

    } catch (error) {
      console.error('Error getting Google Sheets integration:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  }

  /**
   * Update Google Sheets integration
   * PUT /api/v1/manager/google-sheets/:id
   */
  async updateGoogleSheetsIntegration(req, res) {
    try {
      const { id } = req.params;
      const { auto_sync_enabled, sync_frequency_minutes, column_mapping } = req.body;

      // Manager-only authorization
      if (req.user.role !== 'manager') {
        return res.status(403).json({ 
          message: 'Access denied. Only managers can update Google Sheets integrations.' 
        });
      }

      const integration = await googleSheetsService.getIntegrationById(id);
      
      if (!integration) {
        return res.status(404).json({ message: 'Integration not found' });
      }

      // Ensure manager owns this integration
      if (integration.manager_id !== req.user.userId) {
        return res.status(403).json({ message: 'Access denied' });
      }

      // Update integration
      await this.updateIntegration(id, {
        auto_sync_enabled,
        sync_frequency_minutes,
        column_mapping: column_mapping ? JSON.stringify(column_mapping) : integration.column_mapping
      });

      const updatedIntegration = await googleSheetsService.getIntegrationById(id);

      res.json({
        message: 'Integration updated successfully',
        integration: updatedIntegration
      });

    } catch (error) {
      console.error('Error updating Google Sheets integration:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  }

  /**
   * Delete Google Sheets integration
   * DELETE /api/v1/manager/google-sheets/:id
   */
  async deleteGoogleSheetsIntegration(req, res) {
    try {
      const { id } = req.params;

      // Manager-only authorization
      if (req.user.role !== 'manager') {
        return res.status(403).json({ 
          message: 'Access denied. Only managers can delete Google Sheets integrations.' 
        });
      }

      const integration = await googleSheetsService.getIntegrationById(id);
      
      if (!integration) {
        return res.status(404).json({ message: 'Integration not found' });
      }

      // Ensure manager owns this integration
      if (integration.manager_id !== req.user.userId) {
        return res.status(403).json({ message: 'Access denied' });
      }

      // Delete integration
      await this.deleteIntegration(id);

      res.json({ message: 'Integration deleted successfully' });

    } catch (error) {
      console.error('Error deleting Google Sheets integration:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  }

  /**
   * Manually trigger sync for an integration
   * POST /api/v1/manager/google-sheets/:id/sync
   */
  async triggerManualSync(req, res) {
    try {
      const { id } = req.params;

      // Manager-only authorization
      if (req.user.role !== 'manager') {
        return res.status(403).json({ 
          message: 'Access denied. Only managers can trigger syncs.' 
        });
      }

      const integration = await googleSheetsService.getIntegrationById(id);
      
      if (!integration) {
        return res.status(404).json({ message: 'Integration not found' });
      }

      // Ensure manager owns this integration
      if (integration.manager_id !== req.user.userId) {
        return res.status(403).json({ message: 'Access denied' });
      }

      // Trigger sync
      const syncResult = await googleSheetsService.syncLeads(id);

      res.json({
        message: 'Manual sync completed',
        result: syncResult
      });

    } catch (error) {
      console.error('Error triggering manual sync:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  }

  /**
   * Get lead statistics across all studios (Manager Only)
   * GET /api/v1/manager/leads/stats
   */
  async getAllLeadStats(req, res) {
    try {
      // Manager-only authorization
      if (req.user.role !== 'manager') {
        return res.status(403).json({ 
          message: 'Access denied. Only managers can view all lead statistics.' 
        });
      }

      const stats = await this.getManagerLeadStats(req.user.userId);

      res.json({ stats });

    } catch (error) {
      console.error('Error getting manager lead stats:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  }

  // Helper methods

  async saveGoogleSheetsIntegration(data) {
    return new Promise((resolve, reject) => {
      const sql = `
        INSERT INTO google_sheets_integrations 
        (studio_id, sheet_id, sheet_name, column_mapping, auto_sync_enabled, manager_id)
        VALUES (?, ?, ?, ?, ?, ?)
      `;
      
      const sheetId = googleSheetsService.extractSheetId(data.sheet_url);
      
      db.run(sql, [
        data.studio_id,
        sheetId,
        data.sheet_name,
        JSON.stringify(data.column_mapping),
        data.auto_sync_enabled ? 1 : 0,
        data.manager_id
      ], function(err) {
        if (err) {
          reject(err);
        } else {
          resolve(this.lastID);
        }
      });
    });
  }

  async getAllIntegrations(managerId) {
    return new Promise((resolve, reject) => {
      const sql = `
        SELECT gsi.*, s.name as studio_name, s.city
        FROM google_sheets_integrations gsi
        LEFT JOIN studios s ON gsi.studio_id = s.id
        WHERE gsi.manager_id = ?
        ORDER BY gsi.updated_at DESC
      `;
      
      db.all(sql, [managerId], (err, rows) => {
        if (err) {
          reject(err);
        } else {
          const integrations = rows.map(row => ({
            ...row,
            column_mapping: JSON.parse(row.column_mapping)
          }));
          resolve(integrations);
        }
      });
    });
  }

  async updateIntegration(id, updates) {
    return new Promise((resolve, reject) => {
      const fields = Object.keys(updates).map(key => `${key} = ?`).join(', ');
      const values = Object.values(updates);
      
      const sql = `
        UPDATE google_sheets_integrations 
        SET ${fields}, updated_at = CURRENT_TIMESTAMP 
        WHERE id = ?
      `;
      
      db.run(sql, [...values, id], function(err) {
        if (err) {
          reject(err);
        } else {
          resolve(this.changes);
        }
      });
    });
  }

  async deleteIntegration(id) {
    return new Promise((resolve, reject) => {
      const sql = 'DELETE FROM google_sheets_integrations WHERE id = ?';
      db.run(sql, [id], function(err) {
        if (err) {
          reject(err);
        } else {
          resolve(this.changes);
        }
      });
    });
  }

  async getManagerLeadStats(managerId) {
    return new Promise((resolve, reject) => {
      const sql = `
        SELECT 
          COUNT(*) as total_leads,
          COUNT(CASE WHEN l.source_type = 'imported' THEN 1 END) as imported_leads,
          COUNT(CASE WHEN l.source_type = 'manual' THEN 1 END) as manual_leads,
          COUNT(CASE WHEN l.status = 'new' THEN 1 END) as new_leads,
          COUNT(CASE WHEN l.status = 'converted' THEN 1 END) as converted_leads,
          COUNT(DISTINCT l.studio_id) as studios_with_leads,
          COUNT(DISTINCT gsi.id) as active_integrations
        FROM leads l
        LEFT JOIN google_sheets_integrations gsi ON l.studio_id = gsi.studio_id AND gsi.manager_id = ?
        WHERE l.created_by_manager_id = ? OR l.created_by_user_id IN (
          SELECT u.id FROM users u 
          JOIN studios s ON u.id = s.owner_id 
          WHERE s.id IN (SELECT studio_id FROM google_sheets_integrations WHERE manager_id = ?)
        )
      `;
      
      db.get(sql, [managerId, managerId, managerId], (err, row) => {
        if (err) {
          reject(err);
        } else {
          resolve(row);
        }
      });
    });
  }
}

module.exports = new ManagerLeadController();