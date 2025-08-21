const express = require('express');
const { authenticate } = require('../middleware/auth');
const db = require('../database/database-wrapper');
const LeadAppointment = require('../models/LeadAppointment');

const router = express.Router();

router.use(authenticate);

// Get lead appointments for a studio
router.get('/studio/:studioId', async (req, res) => {
  try {
    const { studioId } = req.params;
    const { date, from_date, to_date } = req.query;
    
    const filters = {};
    if (date) filters.date = date;
    if (from_date && to_date) {
      filters.from_date = from_date;
      filters.to_date = to_date;
    }
    
    const leadAppointments = await LeadAppointment.findByStudio(studioId, filters);
    
    res.json({ leadAppointments });
  } catch (error) {
    console.error('Error fetching studio lead appointments:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Get single lead appointment by ID
router.get('/:appointmentId', async (req, res) => {
  try {
    const { appointmentId } = req.params;
    
    const leadAppointment = await LeadAppointment.findById(appointmentId);
    
    if (!leadAppointment) {
      return res.status(404).json({ message: 'Lead appointment not found' });
    }
    
    // Verify user has access (studio owner)
    const isStudioOwner = await db.get(
      'SELECT * FROM studios WHERE id = ? AND owner_id = ?',
      [leadAppointment.studio_id, req.user.userId]
    );
    
    if (!isStudioOwner) {
      return res.status(403).json({ message: 'Access denied' });
    }
    
    res.json({ leadAppointment });
  } catch (error) {
    console.error('Error fetching lead appointment:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Create a new lead appointment
router.post('/', async (req, res) => {
  try {
    const {
      studio_id,
      lead_id,
      appointment_type_id,
      appointment_date,
      start_time,
      end_time,
      notes
    } = req.body;

    // Validate required fields
    if (!studio_id || !lead_id || !appointment_type_id || !appointment_date || !start_time) {
      return res.status(400).json({ 
        message: 'Missing required fields: studio_id, lead_id, appointment_type_id, appointment_date, start_time' 
      });
    }

    // Validate appointment date is not in the past
    const appointmentDate = new Date(appointment_date);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    if (appointmentDate < today) {
      return res.status(400).json({ 
        message: 'Termine können nicht in der Vergangenheit geplant werden' 
      });
    }

    // Validate appointment type exists and belongs to studio
    const appointmentType = await db.get(
      'SELECT * FROM appointment_types WHERE id = ? AND studio_id = ?',
      [appointment_type_id, studio_id]
    );
    
    if (!appointmentType) {
      return res.status(400).json({ 
        message: 'Invalid appointment type for this studio' 
      });
    }

    // Calculate end time if not provided
    let calculatedEndTime = end_time;
    if (!end_time) {
      const [hours, minutes] = start_time.split(':').map(Number);
      const startMinutes = hours * 60 + minutes;
      const endMinutes = startMinutes + appointmentType.duration_minutes;
      const endHours = Math.floor(endMinutes / 60);
      const endMins = endMinutes % 60;
      calculatedEndTime = `${String(endHours).padStart(2, '0')}:${String(endMins).padStart(2, '0')}:00`;
    }

    // Check for time conflicts
    const hasConflict = await LeadAppointment.checkConflicts(
      studio_id, 
      appointment_date, 
      start_time, 
      calculatedEndTime, 
      null, 
      'lead'
    );

    if (hasConflict) {
      return res.status(409).json({ 
        message: 'Terminkonflikt: Zur gewählten Zeit sind bereits alle Plätze belegt' 
      });
    }

    // Validate lead exists and belongs to studio
    const lead = await db.get(
      'SELECT * FROM leads WHERE id = ? AND studio_id = ?',
      [lead_id, studio_id]
    );
    
    if (!lead) {
      return res.status(400).json({ message: 'Lead not found or does not belong to this studio' });
    }

    // Create lead appointment
    const leadAppointment = new LeadAppointment({
      studio_id,
      lead_id,
      appointment_type_id,
      appointment_date,
      start_time,
      end_time: calculatedEndTime,
      notes,
      created_by_user_id: req.user.userId
    });

    const appointmentId = await leadAppointment.create();

    // Update lead status to "trial_scheduled"
    await db.run(
      'UPDATE leads SET status = "trial_scheduled", updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [lead_id]
    );

    res.status(201).json({
      message: 'Lead appointment created successfully',
      leadAppointmentId: appointmentId
    });

  } catch (error) {
    console.error('Error creating lead appointment:', error);
    res.status(500).json({ message: 'Internal server error', error: error.message });
  }
});

// Create walk-in trial appointment (atomic lead + appointment creation)
router.post('/walk-in', async (req, res) => {
  console.log('[WALK-IN] Request received:', JSON.stringify(req.body, null, 2));
  
  try {
    const {
      studio_id,
      lead_data, // { name, phone_number, email }
      appointment_data // { appointment_type_id, appointment_date, start_time, end_time, notes }
    } = req.body;

    console.log('[WALK-IN] Parsed data:', {
      studio_id,
      lead_data,
      appointment_data
    });

    // Validate required fields
    if (!studio_id || !lead_data?.name || !lead_data?.phone_number || !appointment_data?.appointment_type_id || !appointment_data?.appointment_date || !appointment_data?.start_time) {
      console.log('[WALK-IN] Validation failed - missing fields');
      return res.status(400).json({ 
        message: 'Missing required fields: studio_id, lead_data (name, phone_number), appointment_data (appointment_type_id, appointment_date, start_time)',
        received: { studio_id, lead_data, appointment_data }
      });
    }

    // Validate appointment date is not in the past
    const appointmentDate = new Date(appointment_data.appointment_date);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    if (appointmentDate < today) {
      return res.status(400).json({ 
        message: 'Termine können nicht in der Vergangenheit geplant werden' 
      });
    }

    // Validate appointment type exists and belongs to studio
    const appointmentType = await db.get(
      'SELECT * FROM appointment_types WHERE id = ? AND studio_id = ?',
      [appointment_data.appointment_type_id, studio_id]
    );
    
    if (!appointmentType) {
      return res.status(400).json({ 
        message: 'Invalid appointment type for this studio' 
      });
    }

    // Calculate end time if not provided
    let calculatedEndTime = appointment_data.end_time;
    if (!calculatedEndTime) {
      const [hours, minutes] = appointment_data.start_time.split(':').map(Number);
      const startMinutes = hours * 60 + minutes;
      const endMinutes = startMinutes + appointmentType.duration_minutes;
      const endHours = Math.floor(endMinutes / 60);
      const endMins = endMinutes % 60;
      calculatedEndTime = `${String(endHours).padStart(2, '0')}:${String(endMins).padStart(2, '0')}:00`;
    }

    // Check for time conflicts
    const hasConflict = await LeadAppointment.checkConflicts(
      studio_id, 
      appointment_data.appointment_date, 
      appointment_data.start_time, 
      calculatedEndTime, 
      null, // excludeId 
      'lead' // appointmentSource
    );

    if (hasConflict) {
      return res.status(409).json({ 
        message: 'Terminkonflikt: Zur gewählten Zeit sind bereits alle Plätze belegt' 
      });
    }

    console.log('[WALK-IN] About to create lead and appointment atomically');
    console.log('[WALK-IN] Data being sent to createWithLead:', {
      studio_id,
      lead_data,
      appointment_data: {
        ...appointment_data,
        end_time: calculatedEndTime
      },
      userId: req.user?.userId
    });

    // Create lead and appointment atomically
    const result = await LeadAppointment.createWithLead(
      studio_id,
      lead_data,
      {
        ...appointment_data,
        end_time: calculatedEndTime
      },
      req.user?.userId || 16 // Fallback to test user if no auth
    );

    console.log('[WALK-IN] Success! Result:', result);

    res.status(201).json({
      message: 'Walk-in trial appointment created successfully',
      leadId: result.leadId,
      leadAppointmentId: result.appointmentId
    });

  } catch (error) {
    console.error('[WALK-IN] Error creating walk-in lead appointment:', error);
    console.error('[WALK-IN] Error details:', {
      message: error.message,
      stack: error.stack,
      code: error.code,
      errno: error.errno,
      sql: error.sql,
      sqlMessage: error.sqlMessage
    });
    res.status(500).json({ 
      message: 'Internal server error', 
      error: error.message,
      details: error.sqlMessage || error.code
    });
  }
});

// Update lead appointment status
router.patch('/:appointmentId/status', async (req, res) => {
  try {
    const { appointmentId } = req.params;
    const { status } = req.body;

    if (!status) {
      return res.status(400).json({ message: 'Status is required' });
    }

    const validStatuses = ['geplant', 'abgeschlossen', 'nicht_erschienen', 'abgesagt'];
    
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ 
        message: `Invalid status. Must be one of: ${validStatuses.join(', ')}` 
      });
    }

    // Get the lead appointment
    const leadAppointment = await LeadAppointment.findById(appointmentId);

    if (!leadAppointment) {
      return res.status(404).json({ message: 'Lead appointment not found' });
    }

    // Verify user has access (studio owner)
    const isStudioOwner = await db.get(
      'SELECT * FROM studios WHERE id = ? AND owner_id = ?',
      [leadAppointment.studio_id, req.user.userId]
    );

    if (!isStudioOwner) {
      return res.status(403).json({ message: 'Access denied' });
    }

    // Time-based validation for 'nicht erschienen' status
    if (status === 'nicht_erschienen' && leadAppointment.status === 'geplant') {
      const now = new Date();
      
      // Handle MySQL date format properly
      let appointmentDateStr = leadAppointment.appointment_date;
      if (appointmentDateStr instanceof Date) {
        appointmentDateStr = appointmentDateStr.toISOString().split('T')[0];
      } else if (appointmentDateStr.includes('T')) {
        appointmentDateStr = appointmentDateStr.split('T')[0];
      }
      
      // Parse time properly (remove any seconds if present)
      const startTimeStr = leadAppointment.start_time.split(':').slice(0, 2).join(':');
      
      const appointmentStart = new Date(`${appointmentDateStr}T${startTimeStr}:00`);
      const hasStarted = now >= appointmentStart;
      
      if (!hasStarted) {
        return res.status(400).json({
          message: 'Cannot mark as no-show before appointment start time',
          appointmentStart: appointmentStart.toISOString(),
          currentTime: now.toISOString()
        });
      }
    }

    // Update appointment status
    await db.run(
      'UPDATE lead_appointments SET status = ?, updated_at = NOW() WHERE id = ?',
      [status, appointmentId]
    );

    // Update lead status based on appointment status
    let newLeadStatus = null;
    if (status === 'abgeschlossen') {
      newLeadStatus = 'converted';
    } else if (status === 'nicht_erschienen') {
      newLeadStatus = 'not_interested';
    } else if (status === 'abgesagt') {
      newLeadStatus = 'working'; // Back to working status
    }

    if (newLeadStatus) {
      await db.run(
        'UPDATE leads SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
        [newLeadStatus, leadAppointment.lead_id]
      );
    }

    res.json({ 
      message: 'Lead appointment status updated successfully'
    });

  } catch (error) {
    console.error('Error updating lead appointment status:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Update lead appointment (reschedule or change details)
router.put('/:appointmentId', async (req, res) => {
  try {
    const { appointmentId } = req.params;
    const {
      appointment_date,
      start_time,
      end_time,
      status,
      notes
    } = req.body;

    // Get the lead appointment to verify ownership
    const leadAppointment = await LeadAppointment.findById(appointmentId);

    if (!leadAppointment) {
      return res.status(404).json({ message: 'Lead appointment not found' });
    }

    // Verify user has access (studio owner)
    const isStudioOwner = await db.get(
      'SELECT * FROM studios WHERE id = ? AND owner_id = ?',
      [leadAppointment.studio_id, req.user.userId]
    );

    if (!isStudioOwner) {
      return res.status(403).json({ message: 'Access denied' });
    }

    // Build update query
    const updates = [];
    const values = [];

    if (appointment_date) {
      updates.push('appointment_date = ?');
      values.push(appointment_date);
    }

    if (start_time) {
      updates.push('start_time = ?');
      values.push(start_time);
      
      // Calculate new end time if not provided
      if (!end_time) {
        const appointmentType = await db.get(
          'SELECT duration_minutes FROM appointment_types WHERE id = ?',
          [leadAppointment.appointment_type_id]
        );
        
        if (appointmentType) {
          const [hours, minutes] = start_time.split(':').map(Number);
          const startMinutes = hours * 60 + minutes;
          const endMinutes = startMinutes + appointmentType.duration_minutes;
          const endHours = Math.floor(endMinutes / 60);
          const endMins = endMinutes % 60;
          const calculatedEndTime = `${String(endHours).padStart(2, '0')}:${String(endMins).padStart(2, '0')}:00`;
          updates.push('end_time = ?');
          values.push(calculatedEndTime);
        }
      }
    }

    if (end_time) {
      updates.push('end_time = ?');
      values.push(end_time);
    }

    if (status) {
      const validStatuses = ['geplant', 'abgeschlossen', 'nicht_erschienen', 'abgesagt'];
      if (!validStatuses.includes(status)) {
        return res.status(400).json({ 
          message: `Invalid status. Must be one of: ${validStatuses.join(', ')}` 
        });
      }
      
      updates.push('status = ?');
      values.push(status);
    }

    if (notes !== undefined) {
      updates.push('notes = ?');
      values.push(notes);
    }

    if (updates.length === 0) {
      return res.status(400).json({ message: 'No fields to update' });
    }

    // Check for conflicts if date/time is being changed
    if (appointment_date || start_time || end_time) {
      const checkDate = appointment_date || leadAppointment.appointment_date;
      const checkStartTime = start_time || leadAppointment.start_time;
      const checkEndTime = end_time || leadAppointment.end_time;
      
      const hasConflict = await LeadAppointment.checkConflicts(
        leadAppointment.studio_id,
        checkDate,
        checkStartTime,
        checkEndTime,
        appointmentId,
        'lead'
      );

      if (hasConflict) {
        return res.status(409).json({ 
          message: 'Terminkonflikt: Zur gewählten Zeit sind bereits alle Plätze belegt' 
        });
      }
    }

    updates.push('updated_at = NOW()');
    values.push(appointmentId);

    await db.run(
      `UPDATE lead_appointments SET ${updates.join(', ')} WHERE id = ?`,
      values
    );

    res.json({ message: 'Lead appointment updated successfully' });

  } catch (error) {
    console.error('Error updating lead appointment:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Cancel lead appointment
router.delete('/:appointmentId', async (req, res) => {
  try {
    const { appointmentId } = req.params;

    // Get the lead appointment
    const leadAppointment = await LeadAppointment.findById(appointmentId);

    if (!leadAppointment) {
      return res.status(404).json({ message: 'Lead appointment not found' });
    }

    // Verify user has access (studio owner)
    const isStudioOwner = await db.get(
      'SELECT * FROM studios WHERE id = ? AND owner_id = ?',
      [leadAppointment.studio_id, req.user.userId]
    );

    if (!isStudioOwner) {
      return res.status(403).json({ message: 'Access denied' });
    }

    // Update appointment status to cancelled
    await db.run(
      'UPDATE lead_appointments SET status = "abgesagt", cancelled_by = "studio", cancelled_at = NOW(), updated_at = NOW() WHERE id = ?',
      [appointmentId]
    );

    // Update lead status back to "working"
    await db.run(
      'UPDATE leads SET status = "working", updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [leadAppointment.lead_id]
    );

    res.json({ 
      message: 'Lead appointment cancelled successfully'
    });

  } catch (error) {
    console.error('Error cancelling lead appointment:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Get lead appointment statistics for a studio
router.get('/studio/:studioId/stats', async (req, res) => {
  try {
    const { studioId } = req.params;
    const { from_date, to_date } = req.query;
    
    // Default to current month if no dates provided
    const fromDate = from_date || new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0];
    const toDate = to_date || new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).toISOString().split('T')[0];
    
    const stats = await LeadAppointment.getStudioStats(studioId, fromDate, toDate);
    
    res.json({ stats });
  } catch (error) {
    console.error('Error fetching lead appointment stats:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

module.exports = router;