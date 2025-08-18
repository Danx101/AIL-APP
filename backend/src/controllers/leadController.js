const { validationResult } = require('express-validator');
const Lead = require('../models/Lead');
const LeadCallLog = require('../models/LeadCallLog');
const Studio = require('../models/Studio');
const twilioService = require('../services/twilioService');
const googleSheetsService = require('../services/googleSheetsService');
const LeadActivityLogger = require('../utils/LeadActivityLogger');

// TODO: Dialogflow integration temporarily disabled
// Uncomment when Dialogflow is properly configured
// const twilioDialogflowBridge = require('../dialogflow/webhooks/twilioDialogflowBridge');
// const dialogflowConfig = require('../dialogflow/config/dialogflowConfig');

class LeadController {
  /**
   * Get all leads for a studio
   * GET /api/v1/leads/studio/:studioId
   */
  async getStudioLeads(req, res) {
    try {
      const { studioId } = req.params;
      const { status, source, search, sort_by, sort_order, page = 1, limit = 20 } = req.query;

      // Authorization check - verify studio ownership
      const studio = await Studio.findById(studioId);
      if (!studio) {
        return res.status(404).json({ message: 'Studio not found' });
      }

      if (req.user.role !== 'admin' && studio.owner_id !== req.user.userId) {
        return res.status(403).json({ message: 'Access denied' });
      }

      const options = {
        status,
        source,
        search,
        sort_by,
        sort_order,
        limit: parseInt(limit),
        offset: (parseInt(page) - 1) * parseInt(limit)
      };

      const leads = await Lead.findByStudioId(studioId, options);
      const stats = await Lead.getStudioStats(studioId);

      res.json({
        leads,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: stats.total_leads
        },
        stats
      });

    } catch (error) {
      console.error('Error getting studio leads:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  }

  /**
   * Get a specific lead
   * GET /api/v1/leads/:id
   */
  async getLead(req, res) {
    try {
      const { id } = req.params;
      const lead = await Lead.findById(id);

      if (!lead) {
        return res.status(404).json({ message: 'Lead not found' });
      }

      // Authorization check
      if (req.user.role !== 'manager' && req.user.studioId !== lead.studio_id) {
        return res.status(403).json({ message: 'Access denied' });
      }

      // Get call logs for this lead
      const callLogs = await LeadCallLog.findByLeadId(id);

      res.json({
        lead,
        callLogs
      });

    } catch (error) {
      console.error('Error getting lead:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  }

  /**
   * Create a new lead
   * POST /api/v1/leads
   */
  async createLead(req, res) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { studio_id, name, phone_number, email, source, status, notes } = req.body;

      // Authorization check - verify studio ownership
      const studio = await Studio.findById(studio_id);
      if (!studio) {
        return res.status(404).json({ message: 'Studio not found' });
      }

      if (req.user.role !== 'manager' && studio.owner_id !== req.user.userId) {
        return res.status(403).json({ message: 'Access denied' });
      }

      // Check for duplicate phone number in this studio
      const existingLead = await Lead.findByPhoneAndStudio(phone_number, studio_id);
      if (existingLead) {
        return res.status(409).json({ 
          message: 'Lead with this phone number already exists in the studio' 
        });
      }

      const lead = new Lead({
        studio_id,
        name,
        phone_number,
        email,
        source: source || 'manual',
        status: status || 'neu',
        notes,
        source_type: 'manual',
        created_by_user_id: req.user.userId
      });

      const leadId = await lead.save(req.user.userId);
      const createdLead = await Lead.findById(leadId);

      // Trigger Google Sheets sync for this studio if enabled
      this.triggerStudioSync(studio_id);

      res.status(201).json({
        message: 'Lead created successfully',
        lead: createdLead
      });

    } catch (error) {
      console.error('Error creating lead:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  }

  /**
   * Update a lead
   * PUT /api/v1/leads/:id
   */
  async updateLead(req, res) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { id } = req.params;
      const existingLead = await Lead.findById(id);

      if (!existingLead) {
        return res.status(404).json({ message: 'Lead not found' });
      }

      // Authorization check
      if (req.user.role !== 'manager' && req.user.studioId !== existingLead.studio_id) {
        return res.status(403).json({ message: 'Access denied' });
      }

      const {
        name, phone_number, email, source, status, notes,
        next_follow_up, lead_score, conversion_status
      } = req.body;

      // Check for duplicate phone number if phone is being changed
      if (phone_number && phone_number !== existingLead.phone_number) {
        const duplicateLead = await Lead.findByPhoneAndStudio(phone_number, existingLead.studio_id);
        if (duplicateLead) {
          return res.status(409).json({ 
            message: 'Lead with this phone number already exists in the studio' 
          });
        }
      }

      // Update lead object
      Object.assign(existingLead, {
        name: name || existingLead.name,
        phone_number: phone_number || existingLead.phone_number,
        email: email !== undefined ? email : existingLead.email,
        source: source || existingLead.source,
        status: status || existingLead.status,
        notes: notes !== undefined ? notes : existingLead.notes,
        next_follow_up: next_follow_up !== undefined ? next_follow_up : existingLead.next_follow_up,
        lead_score: lead_score !== undefined ? lead_score : existingLead.lead_score,
        conversion_status: conversion_status || existingLead.conversion_status
      });

      await existingLead.save(req.user.userId);
      const updatedLead = await Lead.findById(id);

      // Trigger Google Sheets sync for this studio if enabled
      this.triggerStudioSync(existingLead.studio_id);

      res.json({
        message: 'Lead updated successfully',
        lead: updatedLead
      });

    } catch (error) {
      console.error('Error updating lead:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  }

  /**
   * Delete a lead
   * DELETE /api/v1/leads/:id
   */
  async deleteLead(req, res) {
    try {
      const { id } = req.params;
      const lead = await Lead.findById(id);

      if (!lead) {
        return res.status(404).json({ message: 'Lead not found' });
      }

      // Authorization check
      if (req.user.role !== 'manager' && req.user.studioId !== lead.studio_id) {
        return res.status(403).json({ message: 'Access denied' });
      }

      await lead.delete();

      res.json({ message: 'Lead deleted successfully' });

    } catch (error) {
      console.error('Error deleting lead:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  }

  /**
   * Update lead status
   * PATCH /api/v1/leads/:id/status
   */
  async updateLeadStatus(req, res) {
    try {
      const { id } = req.params;
      const { status, notes } = req.body;

      if (!status) {
        return res.status(400).json({ message: 'Status is required' });
      }

      const lead = await Lead.findById(id);
      if (!lead) {
        return res.status(404).json({ message: 'Lead not found' });
      }

      // Authorization check
      if (req.user.role === 'manager') {
        // Managers have access to all leads
      } else if (req.user.role === 'studio_owner') {
        // Studio owners can only update leads from their studio
        const db = require("../database/database-wrapper");
        const studio = await new Promise((resolve, reject) => {
          db.get('SELECT * FROM studios WHERE owner_id = ?', [req.user.userId], (err, row) => {
            if (err) reject(err);
            else resolve(row);
          });
        });
        
        if (!studio || studio.id !== lead.studio_id) {
          return res.status(403).json({ message: 'Access denied - can only update leads from your studio' });
        }
      } else {
        return res.status(403).json({ message: 'Access denied - insufficient permissions' });
      }

      // Validate status
      const validStatuses = Object.values(Lead.STATUSES);
      if (!validStatuses.includes(status)) {
        return res.status(400).json({ 
          message: `Invalid status. Must be one of: ${validStatuses.join(', ')}` 
        });
      }

      await lead.updateStatus(status, notes, req.user.userId);
      const updatedLead = await Lead.findById(id);

      res.json({
        message: 'Lead status updated successfully',
        lead: updatedLead
      });

    } catch (error) {
      console.error('Error updating lead status:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  }

  /**
   * Initiate a call to a lead
   * POST /api/v1/leads/:id/call
   * Body: { scheduled_at?, notes?, callType?, useDialogflow? }
   */
  async initiateCall(req, res) {
    try {
      const { id } = req.params;
      const { 
        scheduled_at, 
        notes, 
        callType = 'appointment_booking',  // 'cold_calling' or 'appointment_booking'
        useDialogflow = false  // Enable when Dialogflow is configured
      } = req.body;

      const lead = await Lead.findById(id);
      if (!lead) {
        return res.status(404).json({ message: 'Lead not found' });
      }

      // Authorization check
      if (req.user.role !== 'manager' && req.user.studioId !== lead.studio_id) {
        return res.status(403).json({ message: 'Access denied' });
      }

      // Create call log entry with call type
      const callLog = new LeadCallLog({
        lead_id: lead.id,
        studio_id: lead.studio_id,
        initiated_by_user_id: req.user.userId,
        call_status: scheduled_at ? 'scheduled' : 'initiated',
        call_direction: 'outbound',
        scheduled_at,
        notes: notes || `${callType} call initiated by ${req.user.firstName || 'user'}`
      });

      const callLogId = await callLog.save();

      // If not scheduled, initiate the call immediately
      if (!scheduled_at) {
        try {
          // TODO: Enhanced webhook URL with call type when Dialogflow is ready
          const webhookUrl = `${process.env.BASE_URL || 'http://localhost:3001'}/api/v1/twilio/voice/webhook`;
          
          // TODO: Uncomment when Dialogflow is configured
          // const enhancedWebhookUrl = useDialogflow && dialogflowConfig.isConfigured() 
          //   ? `${webhookUrl}?leadId=${lead.id}&callLogId=${callLogId}&callType=${callType}&useDialogflow=true`
          //   : `${webhookUrl}?leadId=${lead.id}&callLogId=${callLogId}&callType=${callType}`;

          const basicWebhookUrl = `${webhookUrl}?leadId=${lead.id}&callLogId=${callLogId}&callType=${callType}`;

          const twilioCall = await twilioService.initiateCall({
            to: lead.phone_number,
            leadId: lead.id,
            callLogId: callLogId,
            twimlUrl: basicWebhookUrl  // Use enhanced URL when Dialogflow is ready
          });

          // Update call log with Twilio SID
          const createdCallLog = await LeadCallLog.findById(callLogId);
          createdCallLog.twilio_call_sid = twilioCall.sid;
          createdCallLog.call_status = 'initiated';
          createdCallLog.started_at = new Date().toISOString();
          await createdCallLog.save();

          // No call activity logging as requested

          res.json({
            message: `${callType === 'cold_calling' ? 'Cold calling' : 'Appointment booking'} call initiated successfully`,
            callLog: createdCallLog,
            twilioCallSid: twilioCall.sid,
            callType: callType,
            useDialogflow: useDialogflow,
            // TODO: Add when Dialogflow is ready
            // dialogflowEnabled: useDialogflow && dialogflowConfig.isConfigured()
          });

        } catch (twilioError) {
          // Update call log with failure status
          const createdCallLog = await LeadCallLog.findById(callLogId);
          await createdCallLog.updateStatus('failed', { 
            notes: `Twilio error: ${twilioError.message}` 
          });

          return res.status(500).json({ 
            message: 'Failed to initiate call',
            error: twilioError.message 
          });
        }
      } else {
        // Scheduled call
        const createdCallLog = await LeadCallLog.findById(callLogId);
        res.json({
          message: 'Call scheduled successfully',
          callLog: createdCallLog
        });
      }

    } catch (error) {
      console.error('Error initiating call:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  }

  /**
   * Get call logs for a lead
   * GET /api/v1/leads/:id/calls
   */
  async getLeadCallLogs(req, res) {
    try {
      const { id } = req.params;
      const lead = await Lead.findById(id);

      if (!lead) {
        return res.status(404).json({ message: 'Lead not found' });
      }

      // Authorization check
      if (req.user.role !== 'manager' && req.user.studioId !== lead.studio_id) {
        return res.status(403).json({ message: 'Access denied' });
      }

      const callLogs = await LeadCallLog.findByLeadId(id);

      res.json({ callLogs });

    } catch (error) {
      console.error('Error getting lead call logs:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  }

  /**
   * Import leads from Google Sheets (Manager Only)
   * POST /api/v1/leads/import/google-sheets
   */
  async importFromGoogleSheets(req, res) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      // Manager-only authorization
      if (req.user.role !== 'manager') {
        return res.status(403).json({ 
          message: 'Access denied. Only managers can import from Google Sheets.' 
        });
      }

      const { studio_id, sheet_url, column_mapping } = req.body;

      try {
        const importResult = await googleSheetsService.importLeads(
          studio_id, 
          sheet_url, 
          column_mapping,
          req.user.userId // Pass manager ID
        );

        res.json({
          message: 'Google Sheets import completed',
          result: importResult
        });

      } catch (importError) {
        console.error('Google Sheets import error:', importError);
        res.status(500).json({ 
          message: 'Failed to import from Google Sheets',
          error: importError.message 
        });
      }

    } catch (error) {
      console.error('Error in Google Sheets import:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  }

  /**
   * Get lead statistics for a studio
   * GET /api/v1/leads/studio/:studioId/stats
   */
  async getStudioLeadStats(req, res) {
    try {
      const { studioId } = req.params;

      // Authorization check - verify studio ownership
      const studio = await Studio.findById(studioId);
      if (!studio) {
        return res.status(404).json({ message: 'Studio not found' });
      }

      if (req.user.role !== 'admin' && studio.owner_id !== req.user.userId) {
        return res.status(403).json({ message: 'Access denied' });
      }

      const leadStats = await Lead.getStudioStats(studioId);
      const callStats = await LeadCallLog.getStudioCallStats(studioId);

      res.json({
        leadStats,
        callStats
      });

    } catch (error) {
      console.error('Error getting lead stats:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  }

  /**
   * Get lead history for a studio
   * GET /api/v1/leads/studio/:studioId/history
   */
  async getStudioHistory(req, res) {
    try {
      const { studioId } = req.params;
      const { 
        page = 1, 
        limit = 50, 
        activity_type, 
        lead_id, 
        date_from, 
        date_to,
        search 
      } = req.query;

      // Authorization check - verify studio ownership
      const studio = await Studio.findById(studioId);
      if (!studio) {
        return res.status(404).json({ message: 'Studio not found' });
      }

      if (req.user.role !== 'admin' && studio.owner_id !== req.user.userId) {
        return res.status(403).json({ message: 'Access denied' });
      }

      const db = require('../database/database-wrapper');
      
      // Build dynamic query
      let query = `
        SELECT 
          la.*,
          l.name as lead_name,
          l.phone_number as lead_phone,
          l.email as lead_email,
          u.first_name,
          u.last_name
        FROM lead_activities la
        LEFT JOIN leads l ON la.lead_id = l.id
        LEFT JOIN users u ON la.created_by = u.id
        WHERE la.studio_id = ?
      `;
      
      const queryParams = [parseInt(studioId)];
      
      // Add filters
      if (activity_type) {
        query += ' AND la.activity_type = ?';
        queryParams.push(activity_type);
      }
      
      if (lead_id) {
        query += ' AND la.lead_id = ?';
        queryParams.push(lead_id);
      }
      
      if (date_from) {
        query += ' AND la.created_at >= ?';
        queryParams.push(date_from);
      }
      
      if (date_to) {
        query += ' AND la.created_at <= ?';
        queryParams.push(date_to);
      }
      
      if (search) {
        query += ' AND (l.name LIKE ? OR l.phone_number LIKE ? OR la.description LIKE ?)';
        const searchPattern = `%${search}%`;
        queryParams.push(searchPattern, searchPattern, searchPattern);
      }
      
      // Add ordering and pagination
      const offset = (parseInt(page) - 1) * parseInt(limit);
      query += ` ORDER BY la.created_at DESC LIMIT ${parseInt(limit)} OFFSET ${offset}`;
      // Don't push LIMIT/OFFSET as parameters since MySQL doesn't support parameterized LIMIT/OFFSET in some configurations

      // Get total count for pagination
      let countQuery = `
        SELECT COUNT(*) as total
        FROM lead_activities la
        LEFT JOIN leads l ON la.lead_id = l.id
        WHERE la.studio_id = ?
      `;
      
      const countParams = [parseInt(studioId)];
      let countParamIndex = 1;
      
      if (activity_type) {
        countQuery += ' AND la.activity_type = ?';
        countParams.push(activity_type);
      }
      
      if (lead_id) {
        countQuery += ' AND la.lead_id = ?';
        countParams.push(lead_id);
      }
      
      if (date_from) {
        countQuery += ' AND la.created_at >= ?';
        countParams.push(date_from);
      }
      
      if (date_to) {
        countQuery += ' AND la.created_at <= ?';
        countParams.push(date_to);
      }
      
      if (search) {
        countQuery += ' AND (l.name LIKE ? OR l.phone_number LIKE ? OR la.description LIKE ?)';
        const searchPattern = `%${search}%`;
        countParams.push(searchPattern, searchPattern, searchPattern);
      }

      // Execute queries
      const [activities, countResult] = await Promise.all([
        new Promise((resolve, reject) => {
          db.all(query, queryParams, (err, rows) => {
            if (err) reject(err);
            else resolve(rows || []);
          });
        }),
        new Promise((resolve, reject) => {
          db.get(countQuery, countParams, (err, row) => {
            if (err) reject(err);
            else resolve(row || { total: 0 });
          });
        })
      ]);

      res.json({
        history: activities,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: countResult.total,
          totalPages: Math.ceil(countResult.total / parseInt(limit))
        },
        filters: {
          activity_type,
          lead_id,
          date_from,
          date_to,
          search
        }
      });

    } catch (error) {
      console.error('Error getting studio history:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  }

  /**
   * Trigger Google Sheets sync for a specific studio
   * @param {number} studioId - Studio ID to sync
   */
  async triggerStudioSync(studioId) {
    try {
      // Import googleSheetsService only when needed to avoid circular dependencies
      const googleSheetsService = require('../services/googleSheetsService');
      
      // Get all Google Sheets integrations for this studio
      const integrations = await new Promise((resolve, reject) => {
        const db = require('../database/database-wrapper');
        db.all(
          'SELECT * FROM google_sheets_integrations WHERE studio_id = ?',
          [studioId],
          (err, rows) => {
            if (err) reject(err);
            else resolve(rows || []);
          }
        );
      });

      // Trigger sync for each active integration
      for (const integration of integrations) {
        console.log(`🔄 Triggering sync for integration ${integration.id} after lead creation`);
        googleSheetsService.syncLeads(integration.id)
          .then((result) => {
            if (result && result.success === false) {
              console.log(`⚠️ Sync skipped for integration ${integration.id}: ${result.message}`);
            } else {
              console.log(`✅ Sync completed for integration ${integration.id}`);
            }
          })
          .catch(error => {
            console.error(`❌ Sync failed for integration ${integration.id}:`, error.message);
          });
      }
    } catch (error) {
      console.error('Error triggering studio sync:', error);
      // Don't throw - this is a background operation
    }
  }
}

module.exports = new LeadController();