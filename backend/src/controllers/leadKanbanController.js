const db = require('../database/database-wrapper');
const { validationResult } = require('express-validator');

class LeadKanbanController {
  // Get leads organized by Kanban status
  async getKanbanView(req, res) {
    try {
      const studioId = req.query.studio_id || req.user.studio_id;
      
      if (!studioId) {
        return res.status(400).json({ message: 'Studio ID is required' });
      }

      // Get active leads (not archived)
      const activeSql = `
        SELECT 
          l.*,
          COUNT(a.id) as appointment_count,
          MAX(a.appointment_date) as last_appointment
        FROM leads l
        LEFT JOIN appointments a ON l.id = a.lead_id
        WHERE l.studio_id = ? AND l.is_archived = FALSE
        GROUP BY l.id
        ORDER BY l.stage_entered_at DESC
      `;
      
      const activeLeads = await db.all(activeSql, [studioId]);

      // Get archived leads
      const archivedSql = `
        SELECT 
          l.*,
          c.id as customer_id,
          c.registration_code,
          (SELECT SUM(total_sessions) 
           FROM customer_sessions cs 
           WHERE cs.customer_id = c.id) as total_sessions_purchased
        FROM leads l
        LEFT JOIN customers c ON l.converted_to_customer_id = c.id
        WHERE l.studio_id = ? AND l.is_archived = TRUE
        ORDER BY l.stage_entered_at DESC
        LIMIT 100
      `;
      
      const archivedLeads = await db.all(archivedSql, [studioId]);

      // Organize active leads by status
      const active = {
        new: [],
        working: [],
        qualified: [],
        trial_scheduled: []
      };

      activeLeads.forEach(lead => {
        if (active[lead.status]) {
          active[lead.status].push(lead);
        }
      });

      // Organize archived leads by outcome
      const archived = {
        positive: {
          converted: []
        },
        negative: {
          unreachable: [],
          wrong_number: [],
          not_interested: [],
          lost: []
        }
      };

      archivedLeads.forEach(lead => {
        if (lead.status === 'converted') {
          archived.positive.converted.push(lead);
        } else if (archived.negative[lead.status]) {
          archived.negative[lead.status].push(lead);
        }
      });

      // Calculate metrics
      const totalActive = activeLeads.length;
      const totalArchived = archivedLeads.length;
      const totalConverted = archived.positive.converted.length;
      const conversionRate = totalArchived > 0 
        ? (totalConverted / totalArchived).toFixed(2) 
        : 0;

      // Calculate average time to convert
      // Using DATEDIFF for MySQL compatibility
      const convertedWithTime = await db.all(`
        SELECT 
          DATEDIFF(conversion_date, created_at) as days_to_convert
        FROM leads
        WHERE studio_id = ? 
          AND status = 'converted' 
          AND conversion_date IS NOT NULL
          AND created_at IS NOT NULL
      `, [studioId]);

      const avgDaysToConvert = convertedWithTime.length > 0
        ? Math.round(convertedWithTime.reduce((sum, l) => sum + (l.days_to_convert || 0), 0) / convertedWithTime.length)
        : 0;

      res.json({
        active,
        archived,
        metrics: {
          conversion_rate: parseFloat(conversionRate),
          avg_time_to_convert: `${avgDaysToConvert} days`,
          total_active: totalActive,
          total_archived: totalArchived,
          total_converted: totalConverted
        }
      });

    } catch (error) {
      console.error('Get Kanban view error:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  }

  // Move lead between Kanban stages
  async moveLead(req, res) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const leadId = req.params.id;
      const { to_status, appointment_data } = req.body;

      console.log(`Moving lead ${leadId} to status: ${to_status}`);

      // Get current lead
      const lead = await db.get('SELECT * FROM leads WHERE id = ?', [leadId]);
      
      if (!lead) {
        console.error(`Lead ${leadId} not found`);
        return res.status(404).json({ message: 'Lead not found' });
      }

      console.log(`Current lead status: ${lead.status}, moving to: ${to_status}`);

      // Define valid transitions
      const validTransitions = {
        // Active states can move forward and to archive states
        'new': ['working', 'qualified', 'trial_scheduled', 'unreachable', 'wrong_number', 'not_interested'],
        'working': ['new', 'qualified', 'trial_scheduled', 'not_interested', 'unreachable', 'wrong_number', 'lost'],
        'qualified': ['new', 'working', 'trial_scheduled', 'not_interested', 'unreachable', 'wrong_number', 'lost'],
        'trial_scheduled': ['new', 'working', 'qualified', 'converted', 'lost', 'not_interested'],
        // Archive states can be reactivated to any active state or move to trial if they become interested
        'unreachable': ['new', 'working', 'qualified', 'trial_scheduled'],
        'wrong_number': ['new', 'working', 'qualified'],
        'not_interested': ['new', 'working', 'qualified', 'trial_scheduled'], // Allow direct scheduling if they become interested
        'lost': ['working', 'qualified', 'trial_scheduled'],
        // Converted can also be reactivated if needed
        'converted': ['working', 'qualified']
      };

      // Check if transition is valid (skip for same status)
      if (lead.status !== to_status) {
        if (!validTransitions[lead.status] || !validTransitions[lead.status].includes(to_status)) {
          return res.status(400).json({ 
            message: `Cannot move from ${lead.status} to ${to_status}` 
          });
        }
      }

      // For now, skip transactions due to connection management complexity
      // TODO: Implement proper transaction handling with connection passing
      
      try {
        // Update lead status
        const isArchived = ['converted', 'unreachable', 'wrong_number', 'not_interested', 'lost'].includes(to_status);
        
        await db.run(`
          UPDATE leads 
          SET status = ?,
              stage_entered_at = CURRENT_TIMESTAMP,
              is_archived = ?,
              archive_reason = ?
          WHERE id = ?
        `, [to_status, isArchived, isArchived ? to_status : null, leadId]);

        // If moving to trial_scheduled and appointment data provided, create appointment
        if (to_status === 'trial_scheduled' && appointment_data) {
          const result = await db.run(`
            INSERT INTO appointments (
              studio_id,
              lead_id,
              person_type,
              appointment_type_id,
              appointment_date,
              start_time,
              end_time,
              status,
              notes
            ) VALUES (?, ?, 'lead', ?, ?, ?, ?, 'confirmed', ?)
          `, [
            lead.studio_id,
            leadId,
            3, // Probebehandlung
            appointment_data.date,
            appointment_data.time,
            appointment_data.end_time || appointment_data.time,
            'Trial appointment scheduled from Kanban'
          ]);

          // Get the inserted appointment ID
          const appointmentId = result.insertId;

          // Update lead with trial appointment ID
          await db.run(
            'UPDATE leads SET trial_appointment_id = ? WHERE id = ?',
            [appointmentId, leadId]
          );
        }

        // Log activity
        await db.run(`
          INSERT INTO lead_activities (
            lead_id,
            studio_id,
            activity_type,
            description,
            from_status,
            to_status,
            created_by
          ) VALUES (?, ?, 'status_change', ?, ?, ?, ?)
        `, [
          leadId,
          lead.studio_id,
          `Status changed from ${lead.status} to ${to_status}`,
          lead.status,
          to_status,
          req.user.userId || req.user.id || null
        ]);

        // Transaction commit removed for now
        
        res.json({
          message: 'Lead moved successfully',
          lead: {
            id: leadId,
            status: to_status,
            is_archived: isArchived
          }
        });

      } catch (error) {
        // Rollback removed for now
        console.error('Database operation error in moveLead:', error);
        throw error;
      }

    } catch (error) {
      console.error('Move lead error:', error);
      console.error('Error stack:', error.stack);
      
      // Provide more specific error messages
      if (error.code === 'ETIMEDOUT') {
        res.status(500).json({ 
          message: 'Database connection timeout. Please try again.',
          code: 'TIMEOUT'
        });
      } else if (error.message && error.message.includes('Cannot move from')) {
        res.status(400).json({ 
          message: error.message,
          code: 'INVALID_TRANSITION'
        });
      } else {
        res.status(500).json({ 
          message: 'Internal server error. Please try again.',
          code: 'UNKNOWN',
          details: error.message
        });
      }
    }
  }

  // Convert lead to customer with mandatory session package
  async convertLead(req, res) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const leadId = req.params.id;
      const { sessionPackage, paymentMethod, notes } = req.body;

      // Validate session package is provided
      if (!sessionPackage || ![10, 20, 30, 40].includes(sessionPackage)) {
        return res.status(400).json({ 
          error: 'Cannot convert lead to customer without session package purchase',
          code: 'SESSION_REQUIRED',
          message: 'Session package is required. Must be 10, 20, 30, or 40 sessions'
        });
      }

      // Get lead details
      const lead = await db.get('SELECT * FROM leads WHERE id = ?', [leadId]);
      
      if (!lead) {
        return res.status(404).json({ message: 'Lead not found' });
      }

      if (lead.status === 'converted') {
        return res.status(400).json({ message: 'Lead already converted' });
      }

      // Get studio for registration code generation
      const studio = await db.get(
        'SELECT unique_identifier FROM studios WHERE id = ?',
        [lead.studio_id]
      );

      if (!studio) {
        return res.status(404).json({ message: 'Studio not found' });
      }

      // For now, skip transactions due to connection management complexity
      // TODO: Implement proper transaction handling with connection passing
      
      try {
        // Parse lead name
        const nameParts = (lead.name || '').split(' ');
        const firstName = nameParts[0] || 'Unknown';
        const lastName = nameParts.slice(1).join(' ') || '';

        // Create customer record
        const customerResult = await db.run(`
          INSERT INTO customers (
            studio_id,
            contact_first_name,
            contact_last_name,
            contact_phone,
            contact_email,
            total_sessions_purchased,
            customer_since,
            created_from_lead_id,
            acquisition_type,
            notes
          ) VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, ?, 'lead_conversion', ?)
        `, [
          lead.studio_id,
          firstName,
          lastName,
          lead.phone_number,
          lead.email,
          sessionPackage,
          leadId,
          notes
        ]);
        
        const customerId = customerResult.insertId;

        // Generate and update registration code
        const registrationCode = `${studio.unique_identifier}-${customerId}`;
        await db.run(
          'UPDATE customers SET registration_code = ? WHERE id = ?',
          [registrationCode, customerId]
        );

        // Create session package (mandatory)
        await db.run(`
          INSERT INTO customer_sessions (
            customer_id,
            studio_id,
            total_sessions,
            remaining_sessions,
            payment_method,
            is_active,
            created_at
          ) VALUES (?, ?, ?, ?, ?, 1, CURRENT_TIMESTAMP)
        `, [customerId, lead.studio_id, sessionPackage, sessionPackage, paymentMethod || 'cash']);

        // Update lead status to converted
        await db.run(`
          UPDATE leads 
          SET status = 'converted',
              is_archived = TRUE,
              archive_reason = 'converted',
              converted_to_customer_id = ?,
              conversion_date = CURRENT_TIMESTAMP,
              initial_package_size = ?
          WHERE id = ?
        `, [customerId, sessionPackage, leadId]);

        // Log conversion activity
        await db.run(`
          INSERT INTO lead_activities (
            lead_id,
            studio_id,
            activity_type,
            description,
            from_status,
            to_status,
            metadata,
            created_by
          ) VALUES (?, ?, 'conversion', ?, ?, 'converted', ?, ?)
        `, [
          leadId,
          lead.studio_id,
          `Converted to customer with ${sessionPackage} sessions. Registration code: ${registrationCode}`,
          lead.status,
          JSON.stringify({ 
            customer_id: customerId, 
            registration_code: registrationCode,
            session_package: sessionPackage 
          }),
          req.user.userId || req.user.id || null
        ]);

        // Transaction commit removed for now

        // Get the created customer
        const customer = await db.get(`
          SELECT c.*, 
            (SELECT remaining_sessions 
             FROM customer_sessions cs 
             WHERE cs.customer_id = c.id AND cs.status = 'active'
             LIMIT 1) as remaining_sessions
          FROM customers c
          WHERE c.id = ?
        `, [customerId]);

        res.status(201).json({
          customer: {
            id: customerId,
            registration_code: registrationCode,
            name: `${firstName} ${lastName}`,
            total_sessions_purchased: sessionPackage,
            remaining_sessions: sessionPackage,
            has_app_access: false,
            customer_since: customer.customer_since,
            acquisition_type: 'lead_conversion'
          },
          session_package: { 
            total: sessionPackage, 
            remaining: sessionPackage 
          },
          message: `Lead converted to customer with ${sessionPackage} sessions. Registration code: ${registrationCode}`
        });

      } catch (error) {
        // Rollback removed for now
        throw error;
      }

    } catch (error) {
      console.error('Convert lead error:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  }

  // Reactivate archived lead
  async reactivateLead(req, res) {
    try {
      const leadId = req.params.id;
      const { target_status } = req.body;

      console.log(`Reactivating lead ${leadId} to status: ${target_status || 'working'}`);

      const lead = await db.get('SELECT * FROM leads WHERE id = ?', [leadId]);
      
      if (!lead) {
        console.error(`Lead ${leadId} not found for reactivation`);
        return res.status(404).json({ message: 'Lead not found' });
      }

      console.log(`Lead ${leadId} current status: ${lead.status}, is_archived: ${lead.is_archived}`);

      if (!lead.is_archived) {
        return res.status(400).json({ message: 'Lead is not archived' });
      }

      // Allow all archived leads to be reactivated, including converted ones
      // This gives flexibility to undo conversions if needed

      // Default to 'working' status if not specified
      const newStatus = target_status || 'working';
      
      if (!['new', 'working', 'qualified'].includes(newStatus)) {
        return res.status(400).json({ message: 'Invalid target status for reactivation' });
      }

      await db.run(`
        UPDATE leads 
        SET is_archived = FALSE,
            archive_reason = NULL,
            status = ?,
            stage_entered_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `, [newStatus, leadId]);

      // Log reactivation
      await db.run(`
        INSERT INTO lead_activities (
          lead_id,
          studio_id,
          activity_type,
          description,
          from_status,
          to_status,
          created_by
        ) VALUES (?, ?, 'status_change', ?, ?, ?, ?)
      `, [
        leadId,
        lead.studio_id,
        `Lead reactivated from ${lead.status} to ${newStatus}`,
        lead.status,
        newStatus,
        req.user.userId || req.user.id || null
      ]);

      res.json({
        message: 'Lead reactivated successfully',
        lead: {
          id: leadId,
          status: newStatus,
          is_archived: false
        }
      });

    } catch (error) {
      console.error('Reactivate lead error:', error);
      console.error('Error stack:', error.stack);
      
      // Provide more specific error messages
      if (error.code === 'ETIMEDOUT') {
        res.status(500).json({ 
          message: 'Database connection timeout. Please try again.',
          code: 'TIMEOUT'
        });
      } else {
        res.status(500).json({ 
          message: 'Internal server error. Please try again.',
          code: 'UNKNOWN',
          details: error.message
        });
      }
    }
  }

  // Get lead activities
  async getLeadActivities(req, res) {
    try {
      const leadId = req.params.id;
      const { limit = 50 } = req.query;

      const activities = await db.all(`
        SELECT 
          la.*,
          u.first_name,
          u.last_name
        FROM lead_activities la
        LEFT JOIN users u ON la.created_by = u.id
        WHERE la.lead_id = ?
        ORDER BY la.created_at DESC
        LIMIT ?
      `, [leadId, limit]);

      res.json({ activities });

    } catch (error) {
      console.error('Get lead activities error:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  }

  // Add note to lead
  async addLeadNote(req, res) {
    try {
      const leadId = req.params.id;
      const { note } = req.body;

      if (!note || note.trim().length === 0) {
        return res.status(400).json({ message: 'Note content is required' });
      }

      const lead = await db.get('SELECT * FROM leads WHERE id = ?', [leadId]);
      
      if (!lead) {
        return res.status(404).json({ message: 'Lead not found' });
      }

      // Add note to lead
      const currentNotes = lead.notes || '';
      const timestamp = new Date().toISOString();
      const newNote = `[${timestamp}] ${note}`;
      const updatedNotes = currentNotes ? `${currentNotes}\n\n${newNote}` : newNote;

      await db.run(
        'UPDATE leads SET notes = ? WHERE id = ?',
        [updatedNotes, leadId]
      );

      // Log activity
      await db.run(`
        INSERT INTO lead_activities (
          lead_id,
          studio_id,
          activity_type,
          description,
          created_by
        ) VALUES (?, ?, 'note', ?, ?)
      `, [leadId, lead.studio_id, note, req.user.userId || req.user.id || null]);

      res.json({
        message: 'Note added successfully',
        note: newNote
      });

    } catch (error) {
      console.error('Add lead note error:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  }

  // Update contact attempts
  async updateContactAttempts(req, res) {
    try {
      const leadId = req.params.id;
      const { contact_type } = req.body;

      const lead = await db.get('SELECT * FROM leads WHERE id = ?', [leadId]);
      
      if (!lead) {
        return res.status(404).json({ message: 'Lead not found' });
      }

      // Update contact attempts
      await db.run(`
        UPDATE leads 
        SET contact_attempts = contact_attempts + 1,
            last_contact_attempt = CURRENT_TIMESTAMP
        WHERE id = ?
      `, [leadId]);

      // Log activity
      await db.run(`
        INSERT INTO lead_activities (
          lead_id,
          studio_id,
          activity_type,
          description,
          created_by
        ) VALUES (?, ?, ?, ?, ?)
      `, [
        leadId,
        lead.studio_id,
        contact_type || 'call',
        `Contact attempt #${lead.contact_attempts + 1}`,
        req.user.userId || req.user.id || null
      ]);

      // Suggest archiving if too many attempts
      const shouldArchive = lead.contact_attempts >= 4 && lead.status === 'new';

      res.json({
        message: 'Contact attempt recorded',
        contact_attempts: lead.contact_attempts + 1,
        suggest_archive: shouldArchive,
        suggested_status: shouldArchive ? 'unreachable' : null
      });

    } catch (error) {
      console.error('Update contact attempts error:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  }

  // Delete lead permanently
  async deleteLead(req, res) {
    try {
      const leadId = req.params.id;

      const lead = await db.get('SELECT * FROM leads WHERE id = ?', [leadId]);
      
      if (!lead) {
        return res.status(404).json({ message: 'Lead not found' });
      }

      // Only allow deletion of archived leads for safety
      if (!lead.is_archived) {
        return res.status(400).json({ 
          message: 'Only archived leads can be deleted. Please archive the lead first.' 
        });
      }

      // Delete related activities first (foreign key constraint)
      await db.run('DELETE FROM lead_activities WHERE lead_id = ?', [leadId]);
      
      // Delete the lead
      await db.run('DELETE FROM leads WHERE id = ?', [leadId]);

      res.json({
        message: 'Lead deleted successfully',
        deletedId: leadId
      });

    } catch (error) {
      console.error('Delete lead error:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  }
}

module.exports = new LeadKanbanController();