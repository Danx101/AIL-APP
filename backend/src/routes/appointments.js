const express = require('express');
const { authenticate } = require('../middleware/auth');
const db = require('../database/database-wrapper');

const router = express.Router();

// TODO: Temporarily disabled due to callback-style database calls
// All appointment routes return simple status messages until fixed

router.use(authenticate);

router.get('/', (req, res) => {
  res.json({ 
    message: 'Appointments endpoint temporarily disabled',
    status: 'under_maintenance',
    appointments: [] 
  });
});

// Get appointments for a studio
router.get('/studio/:studioId', async (req, res) => {
  try {
    const { studioId } = req.params;
    const { date, from_date, to_date } = req.query;
    
    let query = `
      SELECT 
        a.*,
        CASE 
          WHEN a.person_type = 'customer' THEN c.contact_first_name
          WHEN a.person_type = 'lead' THEN SUBSTRING_INDEX(l.name, ' ', 1)
          ELSE 'Unknown'
        END as customer_first_name,
        CASE 
          WHEN a.person_type = 'customer' THEN c.contact_last_name
          WHEN a.person_type = 'lead' THEN SUBSTRING_INDEX(l.name, ' ', -1)
          ELSE 'Person'
        END as customer_last_name,
        CASE 
          WHEN a.person_type = 'customer' THEN c.contact_email
          WHEN a.person_type = 'lead' THEN l.email
          ELSE NULL
        END as customer_email,
        CASE 
          WHEN a.person_type = 'customer' THEN c.contact_phone
          WHEN a.person_type = 'lead' THEN l.phone_number
          ELSE NULL
        END as customer_phone,
        at.name as appointment_type_name,
        at.duration_minutes,
        at.color as appointment_type_color,
        at.consumes_session,
        cs.remaining_sessions,
        s.machine_count
      FROM appointments a
      LEFT JOIN customers c ON a.customer_ref_id = c.id AND a.person_type = 'customer'
      LEFT JOIN leads l ON a.lead_id = l.id AND a.person_type = 'lead'
      LEFT JOIN appointment_types at ON a.appointment_type_id = at.id
      LEFT JOIN customer_sessions cs ON cs.customer_id = c.id AND cs.status = 'active'
      LEFT JOIN studios s ON a.studio_id = s.id
      WHERE a.studio_id = ?
    `;
    
    const params = [studioId];
    
    // Handle date filtering
    if (date) {
      query += ' AND a.appointment_date = ?';
      params.push(date);
    } else if (from_date && to_date) {
      query += ' AND a.appointment_date >= ? AND a.appointment_date <= ?';
      params.push(from_date, to_date);
    }
    
    query += ' ORDER BY a.appointment_date, a.start_time';
    
    const appointments = await db.all(query, params);
    
    res.json({ appointments });
  } catch (error) {
    console.error('Error fetching studio appointments:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Get single appointment by ID
router.get('/:appointmentId', async (req, res) => {
  try {
    const { appointmentId } = req.params;
    
    const appointment = await db.get(`
      SELECT 
        a.*,
        CASE 
          WHEN a.person_type = 'customer' THEN c.contact_first_name
          WHEN a.person_type = 'lead' THEN SUBSTRING_INDEX(l.name, ' ', 1)
          ELSE 'Unknown'
        END as customer_first_name,
        CASE 
          WHEN a.person_type = 'customer' THEN c.contact_last_name
          WHEN a.person_type = 'lead' THEN SUBSTRING_INDEX(l.name, ' ', -1)
          ELSE 'Person'
        END as customer_last_name,
        CASE 
          WHEN a.person_type = 'customer' THEN c.contact_email
          WHEN a.person_type = 'lead' THEN l.email
          ELSE NULL
        END as customer_email,
        CASE 
          WHEN a.person_type = 'customer' THEN c.contact_phone
          WHEN a.person_type = 'lead' THEN l.phone_number
          ELSE NULL
        END as customer_phone,
        at.name as appointment_type_name,
        at.duration_minutes,
        at.color as appointment_type_color,
        at.consumes_session,
        s.name as studio_name,
        cs.remaining_sessions
      FROM appointments a
      LEFT JOIN customers c ON a.customer_ref_id = c.id AND a.person_type = 'customer'
      LEFT JOIN leads l ON a.lead_id = l.id AND a.person_type = 'lead'
      LEFT JOIN appointment_types at ON a.appointment_type_id = at.id
      LEFT JOIN studios s ON a.studio_id = s.id
      LEFT JOIN customer_sessions cs ON cs.customer_id = c.id AND cs.status = 'active'
      WHERE a.id = ?
    `, [appointmentId]);
    
    if (!appointment) {
      return res.status(404).json({ message: 'Appointment not found' });
    }
    
    // Verify user has access (studio owner or the customer)
    const isStudioOwner = await db.get(
      'SELECT * FROM studios WHERE id = ? AND owner_id = ?',
      [appointment.studio_id, req.user.userId]
    );
    
    const isCustomer = appointment.customer_id === req.user.userId;
    
    if (!isStudioOwner && !isCustomer) {
      return res.status(403).json({ message: 'Access denied' });
    }
    
    res.json({ appointment });
  } catch (error) {
    console.error('Error fetching appointment:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Get appointment types for a studio - Frontend compatibility route
router.get('/studio/:studioId/appointment-types', async (req, res) => {
  try {
    const { studioId } = req.params;
    
    // Get appointment types (map duration_minutes to duration for frontend compatibility)
    const appointmentTypes = await db.all(
      'SELECT id, studio_id, name, duration_minutes as duration, consumes_session, is_probebehandlung, max_per_customer, description, color, is_active, created_at, updated_at FROM appointment_types WHERE studio_id = ? AND is_active = 1 ORDER BY name',
      [studioId]
    );
    
    res.json({ appointmentTypes });
  } catch (error) {
    console.error('Error fetching appointment types:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Get appointments for a specific customer
router.get('/customer/:customerId', async (req, res) => {
  try {
    const { customerId } = req.params;
    
    const appointments = await db.all(`
      SELECT 
        a.*,
        at.name as appointment_type_name,
        at.duration_minutes,
        at.color as appointment_type_color,
        at.consumes_session,
        s.name as studio_name
      FROM appointments a
      LEFT JOIN appointment_types at ON a.appointment_type_id = at.id
      LEFT JOIN studios s ON a.studio_id = s.id
      WHERE a.customer_ref_id = ? AND a.person_type = 'customer'
      ORDER BY a.appointment_date DESC, a.start_time DESC
    `, [customerId]);
    
    res.json({ 
      appointments: appointments.map(apt => ({
        ...apt,
        customer_name: 'Customer', // Will be filled by frontend
        duration: apt.duration_minutes,
        appointment_time: `${apt.start_time?.substring(0,5)} - ${apt.end_time?.substring(0,5)}` // Format: "10:00 - 11:00"
      }))
    });
  } catch (error) {
    console.error('Error fetching customer appointments:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

router.get('/stats', (req, res) => {
  res.json({ 
    message: 'Appointment stats temporarily disabled',
    status: 'under_maintenance',
    stats: {
      total: 0,
      upcoming: 0,
      completed: 0
    }
  });
});

// Create a new appointment
router.post('/', async (req, res) => {
  try {
    const {
      studio_id,
      customer_id,      // For backward compatibility
      customer_ref_id,  // New field for customers table
      lead_id,
      person_type,
      appointment_type_id,
      appointment_date,
      start_time,
      end_time
    } = req.body;

    // Determine person type and validate
    let actualPersonType = person_type || 'customer'; // Default to customer
    let actualCustomerId = customer_ref_id || customer_id; // Support both for migration
    let actualLeadId = lead_id;

    if (!actualPersonType) {
      // Auto-detect person type if not provided
      actualPersonType = actualLeadId ? 'lead' : 'customer';
    }

    // Convert string IDs to integers
    const studioId = parseInt(studio_id);
    let appointmentTypeId = parseInt(appointment_type_id);  // Changed to let to allow reassignment
    
    console.log('Appointment creation data:', {
      studioId,
      actualCustomerId,
      actualPersonType,
      appointmentTypeId,
      appointment_date,
      start_time,
      calculatedEndTime: end_time
    });
    
    // Basic validation
    if (!studioId || !appointmentTypeId || !appointment_date || !start_time) {
      return res.status(400).json({ 
        message: 'Missing required fields: studio_id, appointment_type_id, appointment_date, start_time' 
      });
    }

    if (actualPersonType === 'customer' && !actualCustomerId) {
      return res.status(400).json({ message: 'customer_ref_id is required for customer appointments' });
    }

    if (actualPersonType === 'lead' && !actualLeadId) {
      return res.status(400).json({ message: 'lead_id is required for lead appointments' });
    }

    // Validate appointment date is not in the past
    const appointmentDate = new Date(appointment_date);
    const today = new Date();
    today.setHours(0, 0, 0, 0); // Start of today
    
    if (appointmentDate < today) {
      return res.status(400).json({ 
        message: 'Termine können nicht in der Vergangenheit geplant werden' 
      });
    }

    // Validate appointment type exists for this studio
    console.log('Checking appointment type:', appointmentTypeId, 'for studio:', studioId);
    const appointmentTypeCheck = await db.get(
      'SELECT * FROM appointment_types WHERE id = ? AND studio_id = ?',
      [appointmentTypeId, studioId]
    );
    
    if (!appointmentTypeCheck) {
      // Try to find default appointment type for this studio
      const defaultType = await db.get(
        'SELECT * FROM appointment_types WHERE studio_id = ? LIMIT 1',
        [studioId]
      );
      
      if (!defaultType) {
        return res.status(400).json({ 
          message: `No appointment types found for studio ${studioId}. Please create appointment types first.` 
        });
      }
      
      console.log('Using default appointment type:', defaultType.id);
      // Override with the studio's actual appointment type
      appointmentTypeId = defaultType.id;
    }
    
    // Calculate end time if not provided
    let calculatedEndTime = end_time;
    if (!end_time) {
      // Get appointment type to determine duration
      const appointmentType = await db.get(
        'SELECT duration_minutes FROM appointment_types WHERE id = ? AND studio_id = ?',
        [appointmentTypeId, studioId]
      );
      
      if (!appointmentType) {
        return res.status(400).json({ message: 'Invalid appointment type' });
      }

      // Calculate end time based on duration
      const [hours, minutes] = start_time.split(':').map(Number);
      const startMinutes = hours * 60 + minutes;
      const endMinutes = startMinutes + appointmentType.duration_minutes;
      const endHours = Math.floor(endMinutes / 60);
      const endMins = endMinutes % 60;
      calculatedEndTime = `${String(endHours).padStart(2, '0')}:${String(endMins).padStart(2, '0')}:00`;
    }

    // Get the user_id for the customer (needed for the foreign key constraint)
    let customerUserId = null;
    if (actualPersonType === 'customer' && actualCustomerId) {
      console.log('Looking up customer with ID:', actualCustomerId);
      const customer = await db.get(
        'SELECT * FROM customers WHERE id = ?',
        [actualCustomerId]
      );
      console.log('Customer lookup result:', customer);
      
      if (!customer) {
        return res.status(400).json({ message: `Customer not found with ID: ${actualCustomerId}` });
      }
      
      customerUserId = customer.user_id;
      
      if (!customerUserId) {
        // Customer exists but has no user_id - this is valid for customers created without app access
        // Use the creating user's ID as a fallback to satisfy the trigger
        console.log('Customer has no user_id (not registered in app), using creating user ID as fallback');
        customerUserId = req.user.userId;
      }
    }

    // Get active session block for customer appointments that consume sessions
    let sessionBlockId = null;
    if (actualPersonType === 'customer') {
      const appointmentType = await db.get(
        'SELECT consumes_session FROM appointment_types WHERE id = ?',
        [appointmentTypeId]
      );
      
      if (appointmentType && appointmentType.consumes_session) {
        const activeBlock = await db.get(
          'SELECT id FROM customer_sessions WHERE customer_id = ? AND status = "active" AND remaining_sessions > 0 LIMIT 1',
          [actualCustomerId]
        );
        sessionBlockId = activeBlock ? activeBlock.id : null;
      }
    }

    // Insert the appointment (include customer_id for backward compatibility)
    const result = await db.run(
      `INSERT INTO appointments (
        studio_id, customer_id, customer_ref_id, lead_id, person_type, appointment_type_id, 
        appointment_date, start_time, end_time, session_block_id,
        status, created_by_user_id, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'confirmed', ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
      [
        studioId,
        actualPersonType === 'customer' ? customerUserId : null,  // customer_id references users table
        actualPersonType === 'customer' ? actualCustomerId : null,  // customer_ref_id references customers table
        actualPersonType === 'lead' ? actualLeadId : null,
        actualPersonType,
        appointmentTypeId,
        appointment_date,
        start_time,
        calculatedEndTime,
        sessionBlockId,
        req.user.userId
      ]
    );

    res.status(201).json({
      message: 'Appointment created successfully',
      appointmentId: result.insertId || result.lastID
    });

  } catch (error) {
    console.error('Error creating appointment:', error);
    console.error('Error stack:', error.stack);
    console.error('Error details:', {
      message: error.message,
      code: error.code,
      errno: error.errno,
      sql: error.sql
    });
    res.status(500).json({ message: 'Internal server error', error: error.message });
  }
});

// Update appointment status endpoint
router.patch('/:appointmentId/status', async (req, res) => {
  try {
    const { appointmentId } = req.params;
    const { status } = req.body;

    if (!status) {
      return res.status(400).json({ message: 'Status is required' });
    }

    const validStatuses = [
      'pending', 'confirmed', 'cancelled', 'completed', 'no_show',
      'bestätigt', 'abgesagt', 'abgeschlossen', 'nicht erschienen', 'storniert'
    ];
    
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ 
        message: `Invalid status. Must be one of: ${validStatuses.join(', ')}` 
      });
    }

    // Get the appointment with appointment type info
    const appointment = await db.get(
      `SELECT a.*, at.duration_minutes, at.consumes_session 
       FROM appointments a
       LEFT JOIN appointment_types at ON a.appointment_type_id = at.id
       WHERE a.id = ?`,
      [appointmentId]
    );

    if (!appointment) {
      return res.status(404).json({ message: 'Appointment not found' });
    }

    // Verify user has access (studio owner or the customer)
    const isStudioOwner = await db.get(
      'SELECT * FROM studios WHERE id = ? AND owner_id = ?',
      [appointment.studio_id, req.user.userId]
    );

    const isCustomer = appointment.customer_id === req.user.userId;

    if (!isStudioOwner && !isCustomer) {
      return res.status(403).json({ message: 'Access denied' });
    }

    // Check if session should be consumed when marking as completed
    const oldStatus = appointment.status;
    console.log(`Appointment ${appointmentId} old status: ${oldStatus}, new status: ${status}`);
    
    // Check if the status is changing to completed (handle both German and English)
    // MySQL stores: scheduled, confirmed, completed, cancelled, no_show
    // Frontend uses: bestätigt, abgeschlossen, abgesagt, nicht erschienen
    const isCompleted = status === 'abgeschlossen' || status === 'completed';
    const wasCompleted = oldStatus === 'completed';  // MySQL only stores English
    const isBecomingCompleted = isCompleted && !wasCompleted;
    
    // Check if the status is changing to no-show
    const isNoShow = status === 'nicht erschienen' || status === 'no_show';
    const wasNoShow = oldStatus === 'no_show';  // MySQL only stores English
    const isBecomingNoShow = isNoShow && !wasNoShow;
    
    
    // Time-based validation for 'nicht erschienen' status
    if (isBecomingNoShow && (oldStatus === 'confirmed' || oldStatus === 'bestätigt')) {
      const now = new Date();
      
      // Handle MySQL date format properly
      let appointmentDateStr = appointment.appointment_date;
      if (appointmentDateStr instanceof Date) {
        appointmentDateStr = appointmentDateStr.toISOString().split('T')[0];
      } else if (appointmentDateStr.includes('T')) {
        appointmentDateStr = appointmentDateStr.split('T')[0];
      }
      
      // Parse time properly (remove any seconds if present)
      const startTimeStr = appointment.start_time.split(':').slice(0, 2).join(':');
      
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
    
    let sessionDeducted = false;
    
    console.log(`Consumes session: ${appointment.consumes_session}, Session consumed: ${appointment.session_consumed}, Becoming completed: ${isBecomingCompleted}, Becoming no-show: ${isBecomingNoShow}`);
    
    // Handle session consumption
    if (appointment.consumes_session && !appointment.session_consumed && (isBecomingCompleted || isBecomingNoShow)) {
      try {
        await consumeSession(appointment.customer_id, appointment.studio_id);
        sessionDeducted = true;
        
        // Mark session as consumed in appointments table
        await db.run(
          'UPDATE appointments SET session_consumed = 1 WHERE id = ?',
          [appointmentId]
        );
        
        console.log(`✅ Session deducted for appointment ${appointmentId} (status: ${status})`);
      } catch (sessionError) {
        console.error(`❌ Failed to deduct session for appointment ${appointmentId}:`, sessionError.message);
        // Don't fail the status update if session deduction fails
      }
    }

    // Map German status to English for MySQL
    let mysqlStatus = status;
    const statusMap = {
      'bestätigt': 'confirmed',
      'abgesagt': 'cancelled',
      'abgeschlossen': 'completed',
      'nicht erschienen': 'no_show',
      'storniert': 'cancelled'
    };
    if (statusMap[status]) {
      mysqlStatus = statusMap[status];
    }
    
    console.log(`Updating appointment ${appointmentId} status from ${oldStatus} to ${status} (MySQL: ${mysqlStatus})`);
    
    // Update appointment status
    await db.run(
      'UPDATE appointments SET status = ?, updated_at = NOW() WHERE id = ?',
      [mysqlStatus, appointmentId]
    );

    res.json({ 
      message: 'Appointment status updated successfully',
      sessionDeducted
    });

  } catch (error) {
    console.error('Error updating appointment status:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Update appointment (reschedule or change status)
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

    // Get the appointment to verify ownership
    const appointment = await db.get(
      `SELECT a.*, at.duration_minutes, at.consumes_session 
       FROM appointments a
       LEFT JOIN appointment_types at ON a.appointment_type_id = at.id
       WHERE a.id = ?`,
      [appointmentId]
    );

    if (!appointment) {
      return res.status(404).json({ message: 'Appointment not found' });
    }

    // Verify user has access (studio owner or the customer)
    const isStudioOwner = await db.get(
      'SELECT * FROM studios WHERE id = ? AND owner_id = ?',
      [appointment.studio_id, req.user.userId]
    );

    const isCustomer = appointment.customer_id === req.user.userId;

    if (!isStudioOwner && !isCustomer) {
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
      if (!end_time && appointment.duration_minutes) {
        const [hours, minutes] = start_time.split(':').map(Number);
        const startMinutes = hours * 60 + minutes;
        const endMinutes = startMinutes + appointment.duration_minutes;
        const endHours = Math.floor(endMinutes / 60);
        const endMins = endMinutes % 60;
        const calculatedEndTime = `${String(endHours).padStart(2, '0')}:${String(endMins).padStart(2, '0')}:00`;
        updates.push('end_time = ?');
        values.push(calculatedEndTime);
      }
    }

    if (end_time) {
      updates.push('end_time = ?');
      values.push(end_time);
    }

    if (status) {
      // Map German status to English for MySQL
      let mysqlStatus = status;
      const statusMap = {
        'bestätigt': 'confirmed',
        'abgesagt': 'cancelled',
        'abgeschlossen': 'completed',
        'absolviert': 'completed',
        'nicht erschienen': 'no_show',
        'storniert': 'cancelled'
      };
      if (statusMap[status]) {
        mysqlStatus = statusMap[status];
      }
      
      updates.push('status = ?');
      values.push(mysqlStatus);

      // Handle session consumption based on status change
      if (appointment.consumes_session && !appointment.session_consumed) {
        if (status === 'abgeschlossen' || status === 'absolviert' || status === 'completed' || 
            status === 'nicht erschienen' || status === 'no_show') {
          // Consume a session
          await consumeSession(appointment.customer_id, appointment.studio_id);
          updates.push('session_consumed = 1');
        }
      }
    }

    if (notes !== undefined) {
      updates.push('notes = ?');
      values.push(notes);
    }

    if (updates.length === 0) {
      return res.status(400).json({ message: 'No fields to update' });
    }

    updates.push('updated_at = NOW()');
    values.push(appointmentId);

    await db.run(
      `UPDATE appointments SET ${updates.join(', ')} WHERE id = ?`,
      values
    );

    res.json({ message: 'Appointment updated successfully' });

  } catch (error) {
    console.error('Error updating appointment:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Cancel appointment
router.delete('/:appointmentId', async (req, res) => {
  try {
    const { appointmentId } = req.params;

    // Get the appointment
    const appointment = await db.get(
      `SELECT a.*, at.consumes_session 
       FROM appointments a
       LEFT JOIN appointment_types at ON a.appointment_type_id = at.id
       WHERE a.id = ?`,
      [appointmentId]
    );

    if (!appointment) {
      return res.status(404).json({ message: 'Appointment not found' });
    }

    // Verify user has access
    const isStudioOwner = await db.get(
      'SELECT * FROM studios WHERE id = ? AND owner_id = ?',
      [appointment.studio_id, req.user.userId]
    );

    const isCustomer = appointment.customer_id === req.user.userId;

    if (!isStudioOwner && !isCustomer) {
      return res.status(403).json({ message: 'Access denied' });
    }

    // Determine who is cancelling
    const cancelledBy = isStudioOwner ? 'studio' : 'customer';

    // Check if session should be consumed (customer cancellation within 48 hours)
    let consumeSession = false;
    if (cancelledBy === 'customer' && appointment.consumes_session && !appointment.session_consumed) {
      const appointmentDateTime = new Date(`${appointment.appointment_date} ${appointment.start_time}`);
      const now = new Date();
      const hoursUntilAppointment = (appointmentDateTime - now) / (1000 * 60 * 60);
      
      if (hoursUntilAppointment < 48) {
        consumeSession = true;
      }
    }

    // Update appointment status (use English status)
    await db.run(
      `UPDATE appointments 
       SET status = 'cancelled', 
           cancelled_by = ?, 
           cancelled_at = NOW(),
           session_consumed = ?,
           updated_at = NOW()
       WHERE id = ?`,
      [cancelledBy, consumeSession ? 1 : 0, appointmentId]
    );

    // Consume session if needed
    if (consumeSession) {
      await consumeSessionFromCustomer(appointment.customer_id, appointment.studio_id);
    }

    res.json({ 
      message: 'Appointment cancelled successfully',
      sessionConsumed: consumeSession
    });

  } catch (error) {
    console.error('Error cancelling appointment:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Helper function to consume a session
async function consumeSession(customerId, studioId) {
  // Get active session block
  const activeBlock = await db.get(
    'SELECT * FROM customer_sessions WHERE customer_id = ? AND studio_id = ? AND is_active = 1',
    [customerId, studioId]
  );

  if (!activeBlock || activeBlock.remaining_sessions <= 0) {
    throw new Error('No active sessions available');
  }

  // Consume one session
  const newRemaining = activeBlock.remaining_sessions - 1;
  await db.run(
    'UPDATE customer_sessions SET remaining_sessions = ?, updated_at = NOW() WHERE id = ?',
    [newRemaining, activeBlock.id]
  );

  // If block is empty, activate next block
  if (newRemaining === 0) {
    await db.run(
      'UPDATE customer_sessions SET is_active = 0 WHERE id = ?',
      [activeBlock.id]
    );

    const nextBlock = await db.get(
      'SELECT * FROM customer_sessions WHERE customer_id = ? AND studio_id = ? AND is_active = 0 AND remaining_sessions > 0 ORDER BY queue_position ASC, id ASC LIMIT 1',
      [customerId, studioId]
    );

    if (nextBlock) {
      await db.run(
        'UPDATE customer_sessions SET is_active = 1 WHERE id = ?',
        [nextBlock.id]
      );
    }
  }
}

// Helper function to consume session (alias for consistency)
async function consumeSessionFromCustomer(customerId, studioId) {
  return consumeSession(customerId, studioId);
}

// Get appointment history for a specific customer
router.get('/customer/:customerId/history', async (req, res) => {
  try {
    const { customerId } = req.params;
    const { studioId } = req.query;
    
    // Verify the user has access to this customer's data
    if (req.user.role === 'customer' && req.user.id !== parseInt(customerId)) {
      return res.status(403).json({ message: 'Access denied' });
    }
    
    let query = `
      SELECT 
        a.*,
        at.name as appointment_type_name,
        at.duration_minutes,
        at.color as appointment_type_color,
        s.name as studio_name
      FROM appointments a
      LEFT JOIN appointment_types at ON a.appointment_type_id = at.id
      LEFT JOIN studios s ON a.studio_id = s.id
      WHERE a.customer_id = ?
    `;
    
    const params = [customerId];
    
    // Add studio filter if provided
    if (studioId) {
      query += ' AND a.studio_id = ?';
      params.push(studioId);
    }
    
    // Order by date and time
    query += ' ORDER BY a.appointment_date DESC, a.start_time DESC';
    
    const appointments = await db.all(query, params);
    
    // Separate past and upcoming appointments
    const now = new Date();
    const today = now.toISOString().split('T')[0];
    const currentTime = now.toTimeString().split(' ')[0];
    
    const pastAppointments = [];
    const upcomingAppointments = [];
    
    appointments.forEach(apt => {
      const aptDate = apt.appointment_date;
      const aptTime = apt.start_time;
      
      if (aptDate < today || (aptDate === today && aptTime < currentTime)) {
        pastAppointments.push(apt);
      } else {
        upcomingAppointments.push(apt);
      }
    });
    
    res.json({
      success: true,
      pastAppointments,
      upcomingAppointments,
      totalAppointments: appointments.length
    });
    
  } catch (error) {
    console.error('Error fetching customer appointment history:', error);
    res.status(500).json({ 
      success: false,
      message: 'Error fetching appointment history',
      error: error.message 
    });
  }
});

module.exports = router;