const express = require('express');
const leadKanbanController = require('../controllers/leadKanbanController');
const { authenticate, authorize } = require('../middleware/auth');
const { body, param, query } = require('express-validator');

const router = express.Router();

// Validation for lead movement
const validateLeadMove = [
  param('id')
    .isInt({ min: 1 })
    .withMessage('Lead ID must be a positive integer'),
  
  body('to_status')
    .isIn(['new', 'working', 'qualified', 'trial_scheduled', 
           'converted', 'unreachable', 'wrong_number', 'not_interested', 'lost'])
    .withMessage('Invalid status'),
  
  body('appointment_data')
    .optional()
    .isObject()
    .withMessage('Appointment data must be an object'),
  
  body('appointment_data.date')
    .optional()
    .isISO8601()
    .withMessage('Appointment date must be a valid date'),
  
  body('appointment_data.time')
    .optional()
    .matches(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/)
    .withMessage('Start time must be in HH:MM format')
];

// Validation for lead conversion
const validateLeadConversion = [
  param('id')
    .isInt({ min: 1 })
    .withMessage('Lead ID must be a positive integer'),
  
  body('sessionPackage')
    .isInt()
    .isIn([10, 20, 30, 40])
    .withMessage('Session package must be 10, 20, 30, or 40'),
  
  body('paymentMethod')
    .optional()
    .isIn(['cash', 'card', 'transfer'])
    .withMessage('Payment method must be cash, card, or transfer'),
  
  body('notes')
    .optional()
    .isString()
    .isLength({ max: 500 })
    .withMessage('Notes must be less than 500 characters')
];

// Validation for lead reactivation
const validateLeadReactivation = [
  param('id')
    .isInt({ min: 1 })
    .withMessage('Lead ID must be a positive integer'),
  
  body('target_status')
    .optional()
    .isIn(['new', 'working', 'qualified'])
    .withMessage('Target status must be new, working, or qualified')
];

// Validation for adding notes
const validateLeadNote = [
  param('id')
    .isInt({ min: 1 })
    .withMessage('Lead ID must be a positive integer'),
  
  body('note')
    .trim()
    .isLength({ min: 1, max: 1000 })
    .withMessage('Note must be between 1 and 1000 characters')
];

// Validation for contact attempts
const validateContactAttempt = [
  param('id')
    .isInt({ min: 1 })
    .withMessage('Lead ID must be a positive integer'),
  
  body('contact_type')
    .optional()
    .isIn(['call', 'email', 'sms'])
    .withMessage('Contact type must be call, email, or sms')
];

// Get Kanban view with all leads organized by status
router.get(
  '/kanban',
  authenticate,
  authorize(['studio_owner', 'admin']),
  leadKanbanController.getKanbanView
);

// Move lead between Kanban stages
router.put(
  '/leads/:id/move',
  authenticate,
  authorize(['studio_owner', 'admin']),
  validateLeadMove,
  leadKanbanController.moveLead
);

// Convert lead to customer with mandatory session package
router.post(
  '/leads/:id/convert',
  authenticate,
  authorize(['studio_owner', 'admin']),
  validateLeadConversion,
  leadKanbanController.convertLead
);

// Reactivate archived lead
router.post(
  '/leads/:id/reactivate',
  authenticate,
  authorize(['studio_owner', 'admin']),
  validateLeadReactivation,
  leadKanbanController.reactivateLead
);

// Get lead activities
router.get(
  '/leads/:id/activities',
  authenticate,
  authorize(['studio_owner', 'admin']),
  leadKanbanController.getLeadActivities
);

// Add note to lead
router.post(
  '/leads/:id/notes',
  authenticate,
  authorize(['studio_owner', 'admin']),
  validateLeadNote,
  leadKanbanController.addLeadNote
);

// Update contact attempts
router.post(
  '/leads/:id/contact',
  authenticate,
  authorize(['studio_owner', 'admin']),
  validateContactAttempt,
  leadKanbanController.updateContactAttempts
);

// Delete lead (only archived leads can be deleted)
router.delete(
  '/leads/:id',
  authenticate,
  authorize(['studio_owner', 'admin']),
  leadKanbanController.deleteLead
);

module.exports = router;