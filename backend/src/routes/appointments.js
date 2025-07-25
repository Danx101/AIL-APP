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
  appointmentController.getStudioAppointments.bind(appointmentController)
);

router.get('/studio/:studioId/stats',
  validateStudioId,
  appointmentController.getAppointmentStats.bind(appointmentController)
);

router.get('/studio/:studioId/appointment-types',
  validateStudioId,
  appointmentController.getAppointmentTypes.bind(appointmentController)
);

// Get customer's own appointments (must come before /customer/:customerId)
router.get('/customer/me',
  appointmentController.getMyAppointments.bind(appointmentController)
);

// Get customer's associated studio
router.get('/customer/me/studio',
  appointmentController.getCustomerStudio.bind(appointmentController)
);

// Customer-specific appointment routes (must come after specific /customer/me routes)
router.get('/customer/:customerId',
  validateCustomerId,
  appointmentController.getCustomerAppointments.bind(appointmentController)
);

// Core appointment CRUD operations
router.post('/', 
  validateAppointmentCreate,
  appointmentController.createAppointment.bind(appointmentController)
);

router.get('/:id',
  validateAppointmentId,
  appointmentController.getAppointment.bind(appointmentController)
);

router.put('/:id',
  validateAppointmentId,
  validateAppointmentUpdate,
  appointmentController.updateAppointment.bind(appointmentController)
);

router.delete('/:id',
  validateAppointmentId,
  appointmentController.deleteAppointment.bind(appointmentController)
);

// Appointment status management
router.patch('/:id/status',
  validateAppointmentId,
  validateAppointmentStatus,
  appointmentController.updateAppointmentStatus.bind(appointmentController)
);

// Customer appointment cancellation with advance notice validation
router.patch('/:id/cancel',
  validateAppointmentId,
  appointmentController.cancelAppointmentWithNotice.bind(appointmentController)
);

// Check if appointment can be postponed
router.get('/:id/can-postpone',
  validateAppointmentId,
  appointmentController.canPostponeAppointment.bind(appointmentController)
);

module.exports = router;