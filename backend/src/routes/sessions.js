const express = require('express');
const sessionController = require('../controllers/sessionController');
const { authenticate, authorize } = require('../middleware/auth');
const { 
  validateCustomerId,
  validateSessionTopup,
  validateSessionId,
  validateStudioId,
  validateSessionEdit,
  validateSessionDeactivate
} = require('../middleware/validation');

const router = express.Router();

// All session routes require authentication
router.use(authenticate);

// Customer's own session info
router.get('/customers/me/sessions',
  sessionController.getMySessionInfo
);

// Studio owner view of customer sessions
router.get('/customers/:customerId/sessions',
  validateCustomerId,
  sessionController.getCustomerSessionInfo
);

// Add sessions to customer (top-up)
router.post('/customers/:customerId/sessions/topup',
  validateCustomerId,
  validateSessionTopup,
  sessionController.topupCustomerSessions
);

// Get session transaction history
router.get('/sessions/transactions/:sessionId',
  validateSessionId,
  sessionController.getSessionTransactions
);

// Complete appointment and deduct session
router.patch('/appointments/:id/complete',
  sessionController.completeAppointment
);

// Studio session statistics
router.get('/studios/:studioId/sessions/stats',
  validateStudioId,
  sessionController.getStudioSessionStats
);

// Get all customers with session info for studio
router.get('/studios/:studioId/customers/sessions',
  validateStudioId,
  sessionController.getStudioCustomersWithSessions
);

// Edit session package
router.patch('/sessions/:id/edit',
  validateSessionEdit,
  sessionController.editSession
);

// Deactivate session package
router.patch('/sessions/:id/deactivate',
  validateSessionDeactivate,
  sessionController.deactivateSession
);

module.exports = router;