const db = require("../database/database-wrapper");

/**
 * LeadAppointment Model
 * Handles lead appointment data operations and business logic
 * Mirrors customer appointment functionality but for leads/trials
 */
class LeadAppointment {
  constructor(data = {}) {
    this.id = data.id || null;
    this.studio_id = data.studio_id || null;
    this.lead_id = data.lead_id || null;
    this.appointment_type_id = data.appointment_type_id || null;
    this.appointment_date = data.appointment_date || null;
    this.start_time = data.start_time || null;
    this.end_time = data.end_time || null;
    this.status = data.status || 'geplant';
    this.cancelled_by = data.cancelled_by || null;
    this.cancelled_at = data.cancelled_at || null;
    this.notes = data.notes || null;
    this.created_by_user_id = data.created_by_user_id || null;
    this.created_at = data.created_at || null;
    this.updated_at = data.updated_at || null;
  }

  /**
   * Validate lead appointment data
   */
  validate() {
    const errors = [];

    if (!this.studio_id) errors.push('Studio ID is required');
    if (!this.lead_id) errors.push('Lead ID is required');
    if (!this.appointment_date) errors.push('Appointment date is required');
    if (!this.start_time) errors.push('Start time is required');
    if (!this.end_time) errors.push('End time is required');
    if (!this.created_by_user_id) errors.push('Created by user ID is required');

    // Validate date format (YYYY-MM-DD)
    if (this.appointment_date && !/^\d{4}-\d{2}-\d{2}$/.test(this.appointment_date)) {
      errors.push('Invalid appointment date format. Expected YYYY-MM-DD');
    }

    // Validate time format (HH:MM)
    if (this.start_time && !/^\d{2}:\d{2}$/.test(this.start_time)) {
      errors.push('Invalid start time format. Expected HH:MM');
    }

    if (this.end_time && !/^\d{2}:\d{2}$/.test(this.end_time)) {
      errors.push('Invalid end time format. Expected HH:MM');
    }

    // Validate status
    const validStatuses = ['geplant', 'abgeschlossen', 'nicht_erschienen', 'abgesagt'];
    if (this.status && !validStatuses.includes(this.status)) {
      errors.push(`Invalid status. Must be one of: ${validStatuses.join(', ')}`);
    }

    // Validate start time is before end time
    if (this.start_time && this.end_time && this.start_time >= this.end_time) {
      errors.push('Start time must be before end time');
    }

    // Validate date is not in the past (only for new appointments)
    if (!this.id && this.appointment_date) {
      const appointmentDate = new Date(this.appointment_date);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      if (appointmentDate < today) {
        errors.push('Appointment date cannot be in the past');
      }
    }

    return errors;
  }

  /**
   * Create a new lead appointment
   */
  async create() {
    const errors = this.validate();
    if (errors.length > 0) {
      throw new Error(`Validation failed: ${errors.join(', ')}`);
    }

    const query = `
      INSERT INTO lead_appointments (
        studio_id, lead_id, appointment_type_id, appointment_date, 
        start_time, end_time, status, notes, created_by_user_id
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    const result = await db.run(query, [
      this.studio_id,
      this.lead_id,
      this.appointment_type_id,
      this.appointment_date,
      this.start_time,
      this.end_time,
      this.status,
      this.notes,
      this.created_by_user_id
    ]);

    return result.insertId || result.lastID;
  }

  /**
   * Update an existing lead appointment
   */
  async update() {
    if (!this.id) {
      throw new Error('Cannot update appointment without ID');
    }

    const errors = this.validate();
    if (errors.length > 0) {
      throw new Error(`Validation failed: ${errors.join(', ')}`);
    }

    const query = `
      UPDATE lead_appointments SET 
        studio_id = ?, lead_id = ?, appointment_type_id = ?, appointment_date = ?,
        start_time = ?, end_time = ?, status = ?, notes = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `;

    const result = await db.run(query, [
      this.studio_id,
      this.lead_id,
      this.appointment_type_id,
      this.appointment_date,
      this.start_time,
      this.end_time,
      this.status,
      this.notes,
      this.id
    ]);

    return result.changes;
  }

  /**
   * Delete a lead appointment
   */
  async delete() {
    if (!this.id) {
      throw new Error('Cannot delete appointment without ID');
    }

    const result = await db.run('DELETE FROM lead_appointments WHERE id = ?', [this.id]);
    return result.changes;
  }

  /**
   * Find lead appointment by ID
   */
  static async findById(id) {
    const query = `
      SELECT la.*, 
             l.name as lead_name, l.phone_number as lead_phone, l.email as lead_email,
             s.name as studio_name,
             at.name as appointment_type_name, at.duration_minutes as appointment_type_duration,
             at.color as appointment_type_color
      FROM lead_appointments la
      LEFT JOIN leads l ON la.lead_id = l.id
      LEFT JOIN studios s ON la.studio_id = s.id
      LEFT JOIN appointment_types at ON la.appointment_type_id = at.id
      WHERE la.id = ?
    `;

    const row = await db.get(query, [id]);
    return row;
  }

  /**
   * Find lead appointments by studio ID
   */
  static async findByStudio(studioId, filters = {}) {
    let query = `
      SELECT la.*, 
             l.name as lead_name, l.phone_number as lead_phone, l.email as lead_email,
             s.name as studio_name,
             at.name as appointment_type_name, at.duration_minutes as appointment_type_duration,
             at.color as appointment_type_color
      FROM lead_appointments la
      LEFT JOIN leads l ON la.lead_id = l.id
      LEFT JOIN studios s ON la.studio_id = s.id
      LEFT JOIN appointment_types at ON la.appointment_type_id = at.id
      WHERE la.studio_id = ?
    `;

    const params = [studioId];

    // Add filters
    if (filters.date) {
      query += ' AND la.appointment_date = ?';
      params.push(filters.date);
    }

    if (filters.status) {
      query += ' AND la.status = ?';
      params.push(filters.status);
    }

    if (filters.lead_id) {
      query += ' AND la.lead_id = ?';
      params.push(filters.lead_id);
    }

    if (filters.from_date && filters.to_date) {
      query += ' AND la.appointment_date BETWEEN ? AND ?';
      params.push(filters.from_date, filters.to_date);
    }

    query += ' ORDER BY la.appointment_date, la.start_time';

    const rows = await db.all(query, params);
    return rows;
  }

  /**
   * Find lead appointments by lead ID
   */
  static async findByLead(leadId, filters = {}) {
    let query = `
      SELECT la.*, 
             l.name as lead_name, l.phone_number as lead_phone, l.email as lead_email,
             s.name as studio_name,
             at.name as appointment_type_name, at.duration_minutes as appointment_type_duration,
             at.color as appointment_type_color
      FROM lead_appointments la
      LEFT JOIN leads l ON la.lead_id = l.id
      LEFT JOIN studios s ON la.studio_id = s.id
      LEFT JOIN appointment_types at ON la.appointment_type_id = at.id
      WHERE la.lead_id = ?
    `;

    const params = [leadId];

    // Add filters
    if (filters.status) {
      query += ' AND la.status = ?';
      params.push(filters.status);
    }

    if (filters.from_date && filters.to_date) {
      query += ' AND la.appointment_date BETWEEN ? AND ?';
      params.push(filters.from_date, filters.to_date);
    }

    query += ' ORDER BY la.appointment_date, la.start_time';

    const rows = await db.all(query, params);
    return rows;
  }

  /**
   * Check for time conflicts considering studio machine count and appointment types
   * Checks conflicts across BOTH customer appointments AND lead appointments
   */
  static async checkConflicts(studioId, appointmentDate, startTime, endTime, excludeId = null, appointmentSource = 'lead') {
    try {
      // Get the studio's machine count
      const studio = await db.get('SELECT machine_count FROM studios WHERE id = ?', [studioId]);
      const machineCount = studio?.machine_count || 1;

      // Count overlapping customer appointments (Behandlung only)
      let customerQuery = `
        SELECT COUNT(*) as count
        FROM appointments a
        JOIN appointment_types at ON a.appointment_type_id = at.id
        WHERE a.studio_id = ? 
          AND a.appointment_date = ? 
          AND at.name = 'Behandlung'
          AND a.status NOT IN ('cancelled', 'storniert', 'no_show', 'nicht_erschienen')
          AND (
            (a.start_time < ? AND a.end_time > ?) OR
            (a.start_time < ? AND a.end_time > ?) OR
            (a.start_time >= ? AND a.end_time <= ?)
          )
      `;
      
      const customerParams = [studioId, appointmentDate, startTime, startTime, endTime, endTime, startTime, endTime];
      const customerResult = await db.get(customerQuery, customerParams);

      // Count overlapping lead appointments (Probebehandlung only)
      let leadQuery = `
        SELECT COUNT(*) as count
        FROM lead_appointments la
        JOIN appointment_types at ON la.appointment_type_id = at.id
        WHERE la.studio_id = ? 
          AND la.appointment_date = ? 
          AND at.name = 'Probebehandlung'
          AND la.status NOT IN ('abgesagt', 'nicht_erschienen')
          AND (
            (la.start_time < ? AND la.end_time > ?) OR
            (la.start_time < ? AND la.end_time > ?) OR
            (la.start_time >= ? AND la.end_time <= ?)
          )
      `;

      const leadParams = [studioId, appointmentDate, startTime, startTime, endTime, endTime, startTime, endTime];
      
      // Exclude current appointment if updating
      if (excludeId && appointmentSource === 'lead') {
        leadQuery += ' AND la.id != ?';
        leadParams.push(excludeId);
      }

      const leadResult = await db.get(leadQuery, leadParams);

      // Total overlapping appointments
      const totalOverlapping = (customerResult?.count || 0) + (leadResult?.count || 0);
      
      // Conflict if total exceeds machine capacity
      return totalOverlapping >= machineCount;

    } catch (error) {
      console.error('Error checking lead appointment conflicts:', error);
      throw error;
    }
  }

  /**
   * Auto-update lead appointment statuses based on date and current status
   * Changes past 'geplant' appointments to 'abgeschlossen' when appointment end time has passed
   */
  static async updatePastAppointmentStatuses() {
    try {
      const now = new Date();
      const currentDate = now.toISOString().split('T')[0];
      const currentTime = now.toTimeString().split(' ')[0].substring(0, 8);

      console.log(`[AUTO-UPDATE] Checking for past lead appointments. Current: ${currentDate} ${currentTime}`);

      // Get all geplant appointments that have ended
      const appointmentsToComplete = await db.all(`
        SELECT la.* 
        FROM lead_appointments la
        WHERE (
          DATE(la.appointment_date) < CURDATE() 
          OR (DATE(la.appointment_date) = CURDATE() AND la.end_time <= CURTIME())
        )
          AND la.status = 'geplant'
      `);

      if (appointmentsToComplete.length === 0) {
        console.log('No lead appointments to auto-complete');
        return 0;
      }

      console.log(`Found ${appointmentsToComplete.length} lead appointments to auto-complete`);

      // Update appointment statuses to 'abgeschlossen'
      const result = await db.run(`
        UPDATE lead_appointments 
        SET status = 'abgeschlossen', updated_at = CURRENT_TIMESTAMP
        WHERE (
          DATE(appointment_date) < CURDATE() 
          OR (DATE(appointment_date) = CURDATE() AND end_time <= CURTIME())
        )
          AND status = 'geplant'
      `);

      console.log(`✅ Updated ${appointmentsToComplete.length} past lead appointments to abgeschlossen`);
      return appointmentsToComplete.length;

    } catch (error) {
      console.error('Error updating past lead appointment statuses:', error);
      throw error;
    }
  }

  /**
   * Get lead appointment statistics for a studio
   */
  static async getStudioStats(studioId, fromDate, toDate) {
    const query = `
      SELECT 
        COUNT(*) as total_appointments,
        COUNT(CASE WHEN status = 'geplant' THEN 1 END) as planned_appointments,
        COUNT(CASE WHEN status = 'abgeschlossen' THEN 1 END) as completed_appointments,
        COUNT(CASE WHEN status = 'abgesagt' THEN 1 END) as cancelled_appointments,
        COUNT(CASE WHEN status = 'nicht_erschienen' THEN 1 END) as no_show_appointments
      FROM lead_appointments 
      WHERE studio_id = ? 
        AND appointment_date BETWEEN ? AND ?
    `;

    const row = await db.get(query, [studioId, fromDate, toDate]);
    return row;
  }

  /**
   * Create lead appointment with automatic lead creation for walk-ins
   * Atomic operation: creates lead and appointment in single transaction
   */
  static async createWithLead(studioId, leadData, appointmentData, createdByUserId) {
    console.log('[createWithLead] Starting transaction with data:', {
      studioId,
      leadData,
      appointmentData,
      createdByUserId
    });
    
    let connection = null;
    try {
      // Begin MySQL transaction using database wrapper
      console.log('[createWithLead] Beginning transaction...');
      connection = await db.beginTransaction();
      console.log('[createWithLead] Transaction started successfully');

      // Execute queries using the transaction connection
      // Note: For MySQL transactions, we need to use direct connection queries
      
      // 1. Create lead
      console.log('[createWithLead] Creating lead...');
      const [leadResult] = await connection.execute(
        'INSERT INTO leads (studio_id, name, phone_number, email, status, created_at, updated_at) VALUES (?, ?, ?, ?, "new", CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)',
        [studioId, leadData.name, leadData.phone_number, leadData.email || null]
      );

      const leadId = leadResult.insertId;
      console.log('[createWithLead] Lead created with ID:', leadId);

      // 2. Create lead appointment
      console.log('[createWithLead] Creating appointment with data:', {
        studioId,
        leadId,
        appointment_type_id: appointmentData.appointment_type_id,
        appointment_date: appointmentData.appointment_date,
        start_time: appointmentData.start_time,
        end_time: appointmentData.end_time,
        notes: appointmentData.notes,
        createdByUserId
      });
      
      const [appointmentResult] = await connection.execute(`
        INSERT INTO lead_appointments (
          studio_id, lead_id, appointment_type_id, appointment_date, 
          start_time, end_time, status, notes, created_by_user_id
        ) VALUES (?, ?, ?, ?, ?, ?, 'geplant', ?, ?)
      `, [
        studioId,
        leadId,
        appointmentData.appointment_type_id,
        appointmentData.appointment_date,
        appointmentData.start_time,
        appointmentData.end_time,
        appointmentData.notes || null,
        createdByUserId
      ]);

      const appointmentId = appointmentResult.insertId;
      console.log('[createWithLead] Appointment created with ID:', appointmentId);

      // 3. Update lead status to "trial_scheduled" (closest match in existing ENUM)
      console.log('[createWithLead] Updating lead status to trial_scheduled...');
      await connection.execute(
        'UPDATE leads SET status = "trial_scheduled", updated_at = CURRENT_TIMESTAMP WHERE id = ?',
        [leadId]
      );
      console.log('[createWithLead] Lead status updated');

      // Commit transaction
      console.log('[createWithLead] Committing transaction...');
      await db.commit(connection);
      console.log('[createWithLead] Transaction committed successfully');

      return { leadId, appointmentId };

    } catch (error) {
      console.error('[createWithLead] Error occurred:', error);
      console.error('[createWithLead] Error details:', {
        message: error.message,
        code: error.code,
        errno: error.errno,
        sql: error.sql,
        sqlMessage: error.sqlMessage
      });
      
      // Rollback transaction on error
      if (connection) {
        console.log('[createWithLead] Rolling back transaction...');
        await db.rollback(connection);
        console.log('[createWithLead] Transaction rolled back');
      }
      
      throw error;
    }
  }
}

module.exports = LeadAppointment;