const express = require('express');
const appointmentController = require('../controllers/appointmentController');
const { authenticate, authorize } = require('../middleware/auth');
const { 
  validateAppointmentCreate, 
  validateAppointmentUpdate, 
  validateAppointmentStatus,
  validateAppointmentId,
  validateStudioId,
  validateCustomerId
} = require('../middleware/validation');

const router = express.Router();

// All appointment routes require authentication
router.use(authenticate);

// Studio-specific appointment routes (must come before generic routes)
router.get('/studio/:studioId',
  validateStudioId,
  appointmentController.getStudioAppointments
);

router.get('/studio/:studioId/stats',
  validateStudioId,
  appointmentController.getAppointmentStats
);

router.get('/studio/:studioId/appointment-types',
  validateStudioId,
  appointmentController.getAppointmentTypes
);

// Customer-specific appointment routes
router.get('/customer/:customerId',
  validateCustomerId,
  appointmentController.getCustomerAppointments
);

// Core appointment CRUD operations
router.post('/', 
  validateAppointmentCreate,
  appointmentController.createAppointment
);

router.get('/:id',
  validateAppointmentId,
  appointmentController.getAppointment
);

router.put('/:id',
  validateAppointmentId,
  validateAppointmentUpdate,
  appointmentController.updateAppointment
);

router.delete('/:id',
  validateAppointmentId,
  appointmentController.deleteAppointment
);

// Appointment status management
router.patch('/:id/status',
  validateAppointmentId,
  validateAppointmentStatus,
  appointmentController.updateAppointmentStatus
);

module.exports = router;