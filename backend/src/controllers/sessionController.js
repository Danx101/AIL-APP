const { validationResult } = require('express-validator');
const CustomerSession = require('../models/CustomerSession');
const SessionTransaction = require('../models/SessionTransaction');
const db = require('../database/connection');

class SessionController {
  /**
   * Get customer's own session info
   * GET /api/v1/customers/me/sessions
   */
  async getMySessionInfo(req, res) {
    try {
      // Only customers can access this endpoint
      if (req.user.role !== 'customer') {
        return res.status(403).json({ message: 'Access denied - not a customer' });
      }

      const customerId = req.user.userId;

      // Get customer's associated studio
      const studio = await new Promise((resolve, reject) => {
        db.get(`
          SELECT s.id
          FROM studios s
          INNER JOIN activation_codes ac ON s.id = ac.studio_id
          WHERE ac.used_by_user_id = ? AND ac.is_used = 1
          LIMIT 1
        `, [customerId], (err, row) => {
          if (err) reject(err);
          else resolve(row);
        });
      });

      if (!studio) {
        return res.status(404).json({ message: 'No associated studio found' });
      }

      // Get active session
      const activeSession = await CustomerSession.getActiveSession(customerId, studio.id);
      
      // Get recent transactions
      const recentTransactions = await SessionTransaction.findByCustomer(customerId, {
        studio_id: studio.id,
        limit: 10
      });

      res.json({
        session: activeSession,
        transactions: recentTransactions,
        hasActiveSessions: activeSession && activeSession.remaining_sessions > 0,
        remainingSessions: activeSession ? activeSession.remaining_sessions : 0
      });

    } catch (error) {
      console.error('Error getting customer session info:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  }

  /**
   * Get customer's session info (studio owner view)
   * GET /api/v1/customers/:customerId/sessions
   */
  async getCustomerSessionInfo(req, res) {
    try {
      const { customerId } = req.params;

      // Authorization check: Only studio owners can access this
      if (req.user.role !== 'studio_owner') {
        return res.status(403).json({ message: 'Access denied - studio owner only' });
      }

      // Get studio owner's studio
      const studio = await new Promise((resolve, reject) => {
        db.get('SELECT * FROM studios WHERE owner_id = ?', [req.user.userId], (err, row) => {
          if (err) reject(err);
          else resolve(row);
        });
      });

      if (!studio) {
        return res.status(404).json({ message: 'Studio not found' });
      }

      // Verify customer is associated with this studio
      const customerStudio = await new Promise((resolve, reject) => {
        db.get(`
          SELECT s.id
          FROM studios s
          INNER JOIN activation_codes ac ON s.id = ac.studio_id
          WHERE ac.used_by_user_id = ? AND ac.is_used = 1 AND s.id = ?
          LIMIT 1
        `, [customerId, studio.id], (err, row) => {
          if (err) reject(err);
          else resolve(row);
        });
      });

      if (!customerStudio) {
        return res.status(403).json({ message: 'Customer not associated with your studio' });
      }

      // Get customer's sessions
      const sessions = await CustomerSession.findByCustomer(customerId, {
        studio_id: studio.id
      });

      // Get recent transactions
      const recentTransactions = await SessionTransaction.findByCustomer(customerId, {
        studio_id: studio.id,
        limit: 20
      });

      // Get active session
      const activeSession = await CustomerSession.getActiveSession(customerId, studio.id);

      res.json({
        sessions,
        activeSession,
        transactions: recentTransactions,
        hasActiveSessions: activeSession && activeSession.remaining_sessions > 0,
        remainingSessions: activeSession ? activeSession.remaining_sessions : 0
      });

    } catch (error) {
      console.error('Error getting customer session info:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  }

  /**
   * Add sessions to customer (top-up)
   * POST /api/v1/customers/:customerId/sessions/topup
   */
  async topupCustomerSessions(req, res) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { customerId } = req.params;
      const { sessionCount, notes } = req.body;

      // Authorization check: Only studio owners can access this
      if (req.user.role !== 'studio_owner') {
        return res.status(403).json({ message: 'Access denied - studio owner only' });
      }

      // Validate session count
      if (![10, 20].includes(sessionCount)) {
        return res.status(400).json({ message: 'Session count must be 10 or 20' });
      }

      // Get studio owner's studio
      const studio = await new Promise((resolve, reject) => {
        db.get('SELECT * FROM studios WHERE owner_id = ?', [req.user.userId], (err, row) => {
          if (err) reject(err);
          else resolve(row);
        });
      });

      if (!studio) {
        return res.status(404).json({ message: 'Studio not found' });
      }

      // Verify customer is associated with this studio
      const customerStudio = await new Promise((resolve, reject) => {
        db.get(`
          SELECT s.id
          FROM studios s
          INNER JOIN activation_codes ac ON s.id = ac.studio_id
          WHERE ac.used_by_user_id = ? AND ac.is_used = 1 AND s.id = ?
          LIMIT 1
        `, [customerId, studio.id], (err, row) => {
          if (err) reject(err);
          else resolve(row);
        });
      });

      if (!customerStudio) {
        return res.status(403).json({ message: 'Customer not associated with your studio' });
      }

      // Add sessions
      const result = await CustomerSession.addSessions(
        customerId,
        studio.id,
        sessionCount,
        req.user.userId,
        notes || `Studio owner added ${sessionCount} sessions`
      );

      res.json({
        message: `Successfully added ${sessionCount} sessions`,
        sessionId: result.sessionId,
        transactionId: result.transactionId,
        remainingSessions: result.remainingSessions
      });

    } catch (error) {
      console.error('Error topping up customer sessions:', error);
      res.status(500).json({ message: 'Internal server error', error: error.message });
    }
  }

  /**
   * Get session transaction history
   * GET /api/v1/sessions/transactions/:sessionId
   */
  async getSessionTransactions(req, res) {
    try {
      const { sessionId } = req.params;
      const { limit } = req.query;

      // Get session details first
      const session = await CustomerSession.findById(sessionId);
      
      if (!session) {
        return res.status(404).json({ message: 'Session not found' });
      }

      // Authorization check
      const canAccess = await this.canAccessSession(req.user, session);
      if (!canAccess) {
        return res.status(403).json({ message: 'Access denied' });
      }

      // Get transactions
      const transactions = await SessionTransaction.findByCustomerSession(sessionId, {
        limit: limit ? parseInt(limit) : 50
      });

      res.json({
        session,
        transactions
      });

    } catch (error) {
      console.error('Error getting session transactions:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  }

  /**
   * Complete appointment and deduct session
   * PATCH /api/v1/appointments/:id/complete
   */
  async completeAppointment(req, res) {
    try {
      const { id } = req.params;
      const { notes } = req.body;

      // Get appointment details
      const Appointment = require('../models/Appointment');
      const appointment = await Appointment.findById(id);

      if (!appointment) {
        return res.status(404).json({ message: 'Appointment not found' });
      }

      // Authorization check
      const canUpdate = await this.canAccessAppointment(req.user, appointment);
      if (!canUpdate) {
        return res.status(403).json({ message: 'Access denied' });
      }

      // Check if appointment is in the past and confirmed
      const appointmentDate = new Date(appointment.appointment_date);
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      if (appointmentDate >= today) {
        return res.status(400).json({ message: 'Cannot complete future appointments' });
      }

      if (appointment.status !== 'bestätigt' && appointment.status !== 'confirmed') {
        return res.status(400).json({ message: 'Can only complete confirmed appointments' });
      }

      // Update appointment status to completed
      const updatedAppointment = new Appointment({
        id: parseInt(id),
        studio_id: appointment.studio_id,
        customer_id: appointment.customer_id,
        appointment_type_id: appointment.appointment_type_id,
        appointment_date: appointment.appointment_date,
        start_time: appointment.start_time,
        end_time: appointment.end_time,
        status: 'abgeschlossen',
        notes: appointment.notes,
        created_by_user_id: appointment.created_by_user_id
      });

      await updatedAppointment.update();

      // Deduct session
      try {
        const sessionResult = await CustomerSession.deductSession(
          appointment.customer_id,
          appointment.studio_id,
          appointment.id,
          req.user.userId,
          notes || 'Session deducted for completed appointment'
        );

        res.json({
          message: 'Appointment completed and session deducted successfully',
          appointment: await Appointment.findById(id),
          sessionDeducted: true,
          remainingSessions: sessionResult.remainingSessions
        });

      } catch (sessionError) {
        // If session deduction fails, still mark appointment as completed
        console.error('Session deduction failed:', sessionError);
        
        res.json({
          message: 'Appointment completed, but session deduction failed',
          appointment: await Appointment.findById(id),
          sessionDeducted: false,
          error: sessionError.message
        });
      }

    } catch (error) {
      console.error('Error completing appointment:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  }

  /**
   * Get studio session statistics
   * GET /api/v1/studios/:studioId/sessions/stats
   */
  async getStudioSessionStats(req, res) {
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

      // Get transaction stats
      const transactionStats = await SessionTransaction.getStudioStats(studioId, fromDate, toDate);

      // Get active sessions count
      const activeSessions = await CustomerSession.findByStudio(studioId, { is_active: 1 });
      const totalActiveSessions = activeSessions.reduce((sum, session) => sum + session.remaining_sessions, 0);

      res.json({
        transactionStats,
        activeSessionsCount: activeSessions.length,
        totalRemainingSessions: totalActiveSessions,
        period: { from_date: fromDate, to_date: toDate }
      });

    } catch (error) {
      console.error('Error getting studio session stats:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  }

  /**
   * Get all customers with session info for studio
   * GET /api/v1/studios/:studioId/customers/sessions
   */
  async getStudioCustomersWithSessions(req, res) {
    try {
      const { studioId } = req.params;

      // Authorization check: Studio owners can only view their own studio's customers
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

      // Get all customers associated with the studio and their session info
      const customersWithSessions = await new Promise((resolve, reject) => {
        const query = `
          SELECT DISTINCT
            u.id as customer_id,
            u.first_name,
            u.last_name,
            u.email,
            cs.id as session_id,
            cs.total_sessions,
            cs.remaining_sessions,
            cs.purchase_date,
            cs.is_active,
            CASE WHEN cs.remaining_sessions > 0 THEN 1 ELSE 0 END as has_active_sessions
          FROM users u
          INNER JOIN activation_codes ac ON u.id = ac.used_by_user_id
          LEFT JOIN customer_sessions cs ON u.id = cs.customer_id AND cs.studio_id = ? AND cs.is_active = 1
          WHERE ac.studio_id = ? AND ac.is_used = 1 AND u.role = 'customer'
          ORDER BY u.last_name, u.first_name
        `;

        db.all(query, [studioId, studioId], (err, rows) => {
          if (err) reject(err);
          else resolve(rows);
        });
      });

      res.json({ customers: customersWithSessions });

    } catch (error) {
      console.error('Error getting studio customers with sessions:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  }

  /**
   * Check if user can access session
   * Private helper method
   */
  async canAccessSession(user, session) {
    try {
      if (user.role === 'manager') {
        return true;
      }

      if (user.role === 'studio_owner') {
        const studio = await new Promise((resolve, reject) => {
          db.get('SELECT * FROM studios WHERE id = ? AND owner_id = ?', [session.studio_id, user.userId], (err, row) => {
            if (err) reject(err);
            else resolve(row);
          });
        });
        return !!studio;
      }

      if (user.role === 'customer') {
        return user.userId === session.customer_id;
      }

      return false;
    } catch (error) {
      console.error('Error checking session access:', error);
      return false;
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

module.exports = new SessionController();