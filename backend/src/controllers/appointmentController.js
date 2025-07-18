const { validationResult } = require('express-validator');
const Appointment = require('../models/Appointment');
const db = require('../database/connection');

class AppointmentController {
  /**
   * Create a new appointment
   * POST /api/v1/appointments
   */
  async createAppointment(req, res) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const {
        studio_id,
        customer_id,
        appointment_type_id,
        appointment_date,
        start_time,
        end_time,
        notes
      } = req.body;

      const created_by_user_id = req.user.userId;

      // Authorization check: Studio owners can only create appointments for their studios
      if (req.user.role === 'studio_owner') {
        const studio = await new Promise((resolve, reject) => {
          db.get('SELECT * FROM studios WHERE id = ? AND owner_id = ?', [studio_id, req.user.userId], (err, row) => {
            if (err) reject(err);
            else resolve(row);
          });
        });

        if (!studio) {
          return res.status(403).json({ message: 'You can only create appointments for your own studio' });
        }
      }

      // Check for time conflicts
      const hasConflict = await Appointment.checkConflicts(
        studio_id,
        appointment_date,
        start_time,
        end_time
      );

      if (hasConflict) {
        return res.status(409).json({ 
          message: 'Time conflict detected. Another appointment exists at this time.' 
        });
      }

      // Create the appointment
      const appointment = new Appointment({
        studio_id,
        customer_id,
        appointment_type_id,
        appointment_date,
        start_time,
        end_time,
        notes,
        created_by_user_id,
        status: 'pending'
      });

      const appointmentId = await appointment.create();
      const createdAppointment = await Appointment.findById(appointmentId);

      res.status(201).json({
        message: 'Appointment created successfully',
        appointment: createdAppointment
      });

    } catch (error) {
      console.error('Error creating appointment:', error);
      res.status(500).json({ message: 'Internal server error', error: error.message });
    }
  }

  /**
   * Get appointment by ID
   * GET /api/v1/appointments/:id
   */
  async getAppointment(req, res) {
    try {
      const { id } = req.params;
      const appointment = await Appointment.findById(id);

      if (!appointment) {
        return res.status(404).json({ message: 'Appointment not found' });
      }

      // Authorization check
      const canView = await this.canAccessAppointment(req.user, appointment);
      if (!canView) {
        return res.status(403).json({ message: 'Access denied' });
      }

      res.json({ appointment });

    } catch (error) {
      console.error('Error getting appointment:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  }

  /**
   * Update an appointment
   * PUT /api/v1/appointments/:id
   */
  async updateAppointment(req, res) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { id } = req.params;
      const existingAppointment = await Appointment.findById(id);

      if (!existingAppointment) {
        return res.status(404).json({ message: 'Appointment not found' });
      }

      // Authorization check
      const canUpdate = await this.canAccessAppointment(req.user, existingAppointment);
      if (!canUpdate) {
        return res.status(403).json({ message: 'Access denied' });
      }

      const {
        appointment_type_id,
        appointment_date,
        start_time,
        end_time,
        status,
        notes
      } = req.body;

      // Check for time conflicts if time/date is changing
      if (
        appointment_date !== existingAppointment.appointment_date ||
        start_time !== existingAppointment.start_time ||
        end_time !== existingAppointment.end_time
      ) {
        const hasConflict = await Appointment.checkConflicts(
          existingAppointment.studio_id,
          appointment_date,
          start_time,
          end_time,
          id
        );

        if (hasConflict) {
          return res.status(409).json({ 
            message: 'Time conflict detected. Another appointment exists at this time.' 
          });
        }
      }

      // Update the appointment
      const updatedAppointment = new Appointment({
        id: parseInt(id),
        studio_id: existingAppointment.studio_id,
        customer_id: existingAppointment.customer_id,
        appointment_type_id: appointment_type_id || existingAppointment.appointment_type_id,
        appointment_date: appointment_date || existingAppointment.appointment_date,
        start_time: start_time || existingAppointment.start_time,
        end_time: end_time || existingAppointment.end_time,
        status: status || existingAppointment.status,
        notes: notes !== undefined ? notes : existingAppointment.notes,
        created_by_user_id: existingAppointment.created_by_user_id
      });

      await updatedAppointment.update();
      const result = await Appointment.findById(id);

      res.json({
        message: 'Appointment updated successfully',
        appointment: result
      });

    } catch (error) {
      console.error('Error updating appointment:', error);
      res.status(500).json({ message: 'Internal server error', error: error.message });
    }
  }

  /**
   * Delete an appointment
   * DELETE /api/v1/appointments/:id
   */
  async deleteAppointment(req, res) {
    try {
      const { id } = req.params;
      const appointment = await Appointment.findById(id);

      if (!appointment) {
        return res.status(404).json({ message: 'Appointment not found' });
      }

      // Authorization check
      const canDelete = await this.canAccessAppointment(req.user, appointment);
      if (!canDelete) {
        return res.status(403).json({ message: 'Access denied' });
      }

      const appointmentToDelete = new Appointment({ id: parseInt(id) });
      await appointmentToDelete.delete();

      res.json({ message: 'Appointment deleted successfully' });

    } catch (error) {
      console.error('Error deleting appointment:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  }

  /**
   * Get appointments by studio
   * GET /api/v1/studios/:studioId/appointments
   */
  async getStudioAppointments(req, res) {
    try {
      const { studioId } = req.params;
      const { date, status, customer_id, from_date, to_date } = req.query;

      // Authorization check: Studio owners can only view their own studio's appointments
      if (req.user.role === 'studio_owner') {
        const studio = await new Promise((resolve, reject) => {
          db.get('SELECT * FROM studios WHERE id = ? AND owner_id = ?', [studioId, req.user.userId], (err, row) => {
            if (err) reject(err);
            else resolve(row);
          });
        });

        if (!studio) {
          return res.status(403).json({ message: 'Access denied' });
        }
      }

      const filters = {};
      if (date) filters.date = date;
      if (status) filters.status = status;
      if (customer_id) filters.customer_id = customer_id;
      if (from_date && to_date) {
        filters.from_date = from_date;
        filters.to_date = to_date;
      }

      const appointments = await Appointment.findByStudio(studioId, filters);

      res.json({ appointments });

    } catch (error) {
      console.error('Error getting studio appointments:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  }

  /**
   * Get appointments by customer
   * GET /api/v1/customers/:customerId/appointments
   */
  async getCustomerAppointments(req, res) {
    try {
      const { customerId } = req.params;
      const { status, from_date, to_date } = req.query;

      // Authorization check: Customers can only view their own appointments
      if (req.user.role === 'customer' && req.user.userId !== parseInt(customerId)) {
        return res.status(403).json({ message: 'Access denied' });
      }

      const filters = {};
      if (status) filters.status = status;
      if (from_date && to_date) {
        filters.from_date = from_date;
        filters.to_date = to_date;
      }

      const appointments = await Appointment.findByCustomer(customerId, filters);

      res.json({ appointments });

    } catch (error) {
      console.error('Error getting customer appointments:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  }

  /**
   * Get appointment statistics
   * GET /api/v1/studios/:studioId/appointments/stats
   */
  async getAppointmentStats(req, res) {
    try {
      const { studioId } = req.params;
      const { from_date, to_date } = req.query;

      // Authorization check: Studio owners can only view their own studio's stats
      if (req.user.role === 'studio_owner') {
        const studio = await new Promise((resolve, reject) => {
          db.get('SELECT * FROM studios WHERE id = ? AND owner_id = ?', [studioId, req.user.userId], (err, row) => {
            if (err) reject(err);
            else resolve(row);
          });
        });

        if (!studio) {
          return res.status(403).json({ message: 'Access denied' });
        }
      }

      const fromDate = from_date || new Date(new Date().setDate(new Date().getDate() - 30)).toISOString().split('T')[0];
      const toDate = to_date || new Date().toISOString().split('T')[0];

      const stats = await Appointment.getStudioStats(studioId, fromDate, toDate);

      res.json({ 
        stats,
        period: { from_date: fromDate, to_date: toDate }
      });

    } catch (error) {
      console.error('Error getting appointment stats:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  }

  /**
   * Update appointment status
   * PATCH /api/v1/appointments/:id/status
   */
  async updateAppointmentStatus(req, res) {
    try {
      const { id } = req.params;
      const { status } = req.body;

      if (!status) {
        return res.status(400).json({ message: 'Status is required' });
      }

      const validStatuses = ['pending', 'confirmed', 'cancelled', 'completed', 'no_show'];
      if (!validStatuses.includes(status)) {
        return res.status(400).json({ 
          message: `Invalid status. Must be one of: ${validStatuses.join(', ')}` 
        });
      }

      const appointment = await Appointment.findById(id);

      if (!appointment) {
        return res.status(404).json({ message: 'Appointment not found' });
      }

      // Authorization check
      const canUpdate = await this.canAccessAppointment(req.user, appointment);
      if (!canUpdate) {
        return res.status(403).json({ message: 'Access denied' });
      }

      const updatedAppointment = new Appointment({
        id: parseInt(id),
        studio_id: appointment.studio_id,
        customer_id: appointment.customer_id,
        appointment_type_id: appointment.appointment_type_id,
        appointment_date: appointment.appointment_date,
        start_time: appointment.start_time,
        end_time: appointment.end_time,
        status: status,
        notes: appointment.notes,
        created_by_user_id: appointment.created_by_user_id
      });

      await updatedAppointment.update();
      const result = await Appointment.findById(id);

      res.json({
        message: 'Appointment status updated successfully',
        appointment: result
      });

    } catch (error) {
      console.error('Error updating appointment status:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  }

  /**
   * Get appointment types for a studio
   * GET /api/v1/studios/:studioId/appointment-types
   */
  async getAppointmentTypes(req, res) {
    try {
      const { studioId } = req.params;

      // Authorization check: Studio owners can only view their own studio's appointment types
      if (req.user.role === 'studio_owner') {
        const studio = await new Promise((resolve, reject) => {
          db.get('SELECT * FROM studios WHERE id = ? AND owner_id = ?', [studioId, req.user.userId], (err, row) => {
            if (err) reject(err);
            else resolve(row);
          });
        });

        if (!studio) {
          return res.status(403).json({ message: 'Access denied' });
        }
      }

      const appointmentTypes = await new Promise((resolve, reject) => {
        db.all(
          'SELECT * FROM appointment_types WHERE studio_id = ? AND is_active = 1 ORDER BY name',
          [studioId],
          (err, rows) => {
            if (err) reject(err);
            else resolve(rows);
          }
        );
      });

      res.json({ appointmentTypes });

    } catch (error) {
      console.error('Error getting appointment types:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  }

  /**
   * Check if user can access appointment
   * Private helper method
   */
  async canAccessAppointment(user, appointment) {
    try {
      if (user.role === 'manager') {
        return true;
      }

      if (user.role === 'studio_owner') {
        const studio = await new Promise((resolve, reject) => {
          db.get('SELECT * FROM studios WHERE id = ? AND owner_id = ?', [appointment.studio_id, user.userId], (err, row) => {
            if (err) reject(err);
            else resolve(row);
          });
        });
        return !!studio;
      }

      if (user.role === 'customer') {
        return user.userId === appointment.customer_id;
      }

      return false;
    } catch (error) {
      console.error('Error checking appointment access:', error);
      return false;
    }
  }
}

module.exports = new AppointmentController();