const db = require('../database/connection');

/**
 * Appointment Model
 * Handles appointment data operations and business logic
 */
class Appointment {
  constructor(data = {}) {
    this.id = data.id || null;
    this.studio_id = data.studio_id || null;
    this.customer_id = data.customer_id || null;
    this.appointment_type_id = data.appointment_type_id || null;
    this.appointment_date = data.appointment_date || null;
    this.start_time = data.start_time || null;
    this.end_time = data.end_time || null;
    this.status = data.status || 'pending';
    this.notes = data.notes || null;
    this.created_by_user_id = data.created_by_user_id || null;
    this.created_at = data.created_at || null;
    this.updated_at = data.updated_at || null;
  }

  /**
   * Validate appointment data
   */
  validate() {
    const errors = [];

    if (!this.studio_id) errors.push('Studio ID is required');
    if (!this.customer_id) errors.push('Customer ID is required');
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

    // Validate status (supporting both English and German terms)
    const validStatuses = [
      'pending', 'confirmed', 'cancelled', 'completed', 'no_show',
      'bestätigt', 'abgesagt', 'abgeschlossen', 'nicht erschienen'
    ];
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
   * Create a new appointment
   */
  async create() {
    const errors = this.validate();
    if (errors.length > 0) {
      throw new Error(`Validation failed: ${errors.join(', ')}`);
    }

    return new Promise((resolve, reject) => {
      const query = `
        INSERT INTO appointments (
          studio_id, customer_id, appointment_type_id, appointment_date, 
          start_time, end_time, status, notes, created_by_user_id
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `;

      db.run(query, [
        this.studio_id,
        this.customer_id,
        this.appointment_type_id,
        this.appointment_date,
        this.start_time,
        this.end_time,
        this.status,
        this.notes,
        this.created_by_user_id
      ], function(err) {
        if (err) {
          reject(err);
        } else {
          resolve(this.lastID);
        }
      });
    });
  }

  /**
   * Update an existing appointment
   */
  async update() {
    if (!this.id) {
      throw new Error('Cannot update appointment without ID');
    }

    const errors = this.validate();
    if (errors.length > 0) {
      throw new Error(`Validation failed: ${errors.join(', ')}`);
    }

    return new Promise((resolve, reject) => {
      const query = `
        UPDATE appointments SET 
          studio_id = ?, customer_id = ?, appointment_type_id = ?, appointment_date = ?,
          start_time = ?, end_time = ?, status = ?, notes = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `;

      db.run(query, [
        this.studio_id,
        this.customer_id,
        this.appointment_type_id,
        this.appointment_date,
        this.start_time,
        this.end_time,
        this.status,
        this.notes,
        this.id
      ], function(err) {
        if (err) {
          reject(err);
        } else {
          resolve(this.changes);
        }
      });
    });
  }

  /**
   * Delete an appointment
   */
  async delete() {
    if (!this.id) {
      throw new Error('Cannot delete appointment without ID');
    }

    return new Promise((resolve, reject) => {
      db.run('DELETE FROM appointments WHERE id = ?', [this.id], function(err) {
        if (err) {
          reject(err);
        } else {
          resolve(this.changes);
        }
      });
    });
  }

  /**
   * Find appointment by ID
   */
  static async findById(id) {
    return new Promise((resolve, reject) => {
      const query = `
        SELECT a.*, 
               u.first_name as customer_first_name, u.last_name as customer_last_name, u.email as customer_email,
               s.name as studio_name,
               at.name as appointment_type_name, at.duration as appointment_type_duration
        FROM appointments a
        LEFT JOIN users u ON a.customer_id = u.id
        LEFT JOIN studios s ON a.studio_id = s.id
        LEFT JOIN appointment_types at ON a.appointment_type_id = at.id
        WHERE a.id = ?
      `;

      db.get(query, [id], (err, row) => {
        if (err) {
          reject(err);
        } else {
          resolve(row ? new Appointment(row) : null);
        }
      });
    });
  }

  /**
   * Find appointments by studio ID
   */
  static async findByStudio(studioId, filters = {}) {
    return new Promise((resolve, reject) => {
      let query = `
        SELECT a.*, 
               u.first_name as customer_first_name, u.last_name as customer_last_name, u.email as customer_email,
               s.name as studio_name,
               at.name as appointment_type_name, at.duration as appointment_type_duration
        FROM appointments a
        LEFT JOIN users u ON a.customer_id = u.id
        LEFT JOIN studios s ON a.studio_id = s.id
        LEFT JOIN appointment_types at ON a.appointment_type_id = at.id
        WHERE a.studio_id = ?
      `;

      const params = [studioId];

      // Add filters
      if (filters.date) {
        query += ' AND a.appointment_date = ?';
        params.push(filters.date);
      }

      if (filters.status) {
        query += ' AND a.status = ?';
        params.push(filters.status);
      }

      if (filters.customer_id) {
        query += ' AND a.customer_id = ?';
        params.push(filters.customer_id);
      }

      if (filters.from_date && filters.to_date) {
        query += ' AND a.appointment_date BETWEEN ? AND ?';
        params.push(filters.from_date, filters.to_date);
      }

      query += ' ORDER BY a.appointment_date, a.start_time';

      db.all(query, params, (err, rows) => {
        if (err) {
          reject(err);
        } else {
          // Return raw rows to preserve joined fields like customer_first_name, etc.
          resolve(rows);
        }
      });
    });
  }

  /**
   * Find appointments by customer ID
   */
  static async findByCustomer(customerId, filters = {}) {
    return new Promise((resolve, reject) => {
      let query = `
        SELECT a.*, 
               u.first_name as customer_first_name, u.last_name as customer_last_name, u.email as customer_email,
               s.name as studio_name,
               at.name as appointment_type_name, at.duration as appointment_type_duration
        FROM appointments a
        LEFT JOIN users u ON a.customer_id = u.id
        LEFT JOIN studios s ON a.studio_id = s.id
        LEFT JOIN appointment_types at ON a.appointment_type_id = at.id
        WHERE a.customer_id = ?
      `;

      const params = [customerId];

      // Add filters
      if (filters.status) {
        query += ' AND a.status = ?';
        params.push(filters.status);
      }

      if (filters.from_date && filters.to_date) {
        query += ' AND a.appointment_date BETWEEN ? AND ?';
        params.push(filters.from_date, filters.to_date);
      }

      query += ' ORDER BY a.appointment_date, a.start_time';

      db.all(query, params, (err, rows) => {
        if (err) {
          reject(err);
        } else {
          // Return raw rows to preserve joined fields like customer_first_name, etc.
          resolve(rows);
        }
      });
    });
  }

  /**
   * Check for time conflicts
   */
  static async checkConflicts(studioId, appointmentDate, startTime, endTime, excludeId = null) {
    return new Promise((resolve, reject) => {
      let query = `
        SELECT COUNT(*) as count
        FROM appointments 
        WHERE studio_id = ? 
          AND appointment_date = ? 
          AND status NOT IN ('cancelled', 'no_show')
          AND (
            (start_time < ? AND end_time > ?) OR
            (start_time < ? AND end_time > ?) OR
            (start_time >= ? AND end_time <= ?)
          )
      `;

      const params = [studioId, appointmentDate, startTime, startTime, endTime, endTime, startTime, endTime];

      if (excludeId) {
        query += ' AND id != ?';
        params.push(excludeId);
      }

      db.get(query, params, (err, row) => {
        if (err) {
          reject(err);
        } else {
          resolve(row.count > 0);
        }
      });
    });
  }

  /**
   * Auto-update appointment statuses based on date and current status
   * Changes past 'bestätigt' appointments to 'abgeschlossen' and deducts sessions
   */
  static async updatePastAppointmentStatuses() {
    return new Promise(async (resolve, reject) => {
      try {
        const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD format
        
        // First, get all past confirmed appointments that need to be completed
        const appointmentsToComplete = await new Promise((resolveQuery, rejectQuery) => {
          const query = `
            SELECT * FROM appointments 
            WHERE appointment_date < ? 
              AND status = 'bestätigt'
          `;

          db.all(query, [today], (err, rows) => {
            if (err) rejectQuery(err);
            else resolveQuery(rows);
          });
        });

        if (appointmentsToComplete.length === 0) {
          return resolve(0);
        }

        // Update appointment statuses
        const updateQuery = `
          UPDATE appointments 
          SET status = 'abgeschlossen', updated_at = CURRENT_TIMESTAMP
          WHERE appointment_date < ? 
            AND status = 'bestätigt'
        `;

        db.run(updateQuery, [today], async (err) => {
          if (err) {
            return reject(err);
          }

          // Deduct sessions for each completed appointment
          const CustomerSession = require('./CustomerSession');
          let sessionDeductions = 0;

          for (const appointment of appointmentsToComplete) {
            try {
              await CustomerSession.deductSession(
                appointment.customer_id,
                appointment.studio_id,
                appointment.id,
                appointment.created_by_user_id, // Use original creator as deductor
                'Automatic session deduction for completed past appointment'
              );
              sessionDeductions++;
            } catch (sessionError) {
              console.error(`Failed to deduct session for appointment ${appointment.id}:`, sessionError.message);
              // Continue with other appointments even if one fails
            }
          }

          console.log(`✅ Auto-completed ${appointmentsToComplete.length} past appointments, deducted ${sessionDeductions} sessions`);
          resolve(appointmentsToComplete.length);
        });

      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Get appointment statistics for a studio
   */
  static async getStudioStats(studioId, fromDate, toDate) {
    return new Promise((resolve, reject) => {
      const query = `
        SELECT 
          COUNT(*) as total_appointments,
          COUNT(CASE WHEN status = 'confirmed' THEN 1 END) as confirmed_appointments,
          COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed_appointments,
          COUNT(CASE WHEN status = 'cancelled' THEN 1 END) as cancelled_appointments,
          COUNT(CASE WHEN status = 'no_show' THEN 1 END) as no_show_appointments
        FROM appointments 
        WHERE studio_id = ? 
          AND appointment_date BETWEEN ? AND ?
      `;

      db.get(query, [studioId, fromDate, toDate], (err, row) => {
        if (err) {
          reject(err);
        } else {
          resolve(row);
        }
      });
    });
  }
}

module.exports = Appointment;