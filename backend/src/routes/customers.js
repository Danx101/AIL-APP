const express = require('express');
const customerController = require('../controllers/customerController');
const { authenticate, authorize } = require('../middleware/auth');
const { body, param, validationResult } = require('express-validator');

const router = express.Router();

// Validation middleware for customer creation
const validateCustomerCreate = [
  body('firstName')
    .trim()
    .isLength({ min: 2, max: 50 })
    .withMessage('First name must be between 2 and 50 characters'),
  
  body('lastName')
    .trim()
    .isLength({ min: 2, max: 50 })
    .withMessage('Last name must be between 2 and 50 characters'),
  
  body('phone')
    .trim()
    .matches(/^[\+]?[0-9\s\-\(\)]{7,20}$/)
    .withMessage('Please provide a valid phone number'),
  
  body('email')
    .optional({ nullable: true, checkFalsy: true })
    .isEmail()
    .normalizeEmail({ gmail_remove_dots: false })
    .withMessage('Please provide a valid email address'),
  
  body('sessionPackage')
    .isInt()
    .isIn([10, 20, 30, 40])
    .withMessage('Session package must be 10, 20, 30, or 40'),
  
  body('paymentMethod')
    .optional()
    .isIn(['cash', 'card', 'transfer'])
    .withMessage('Payment method must be cash, card, or transfer'),
  
  body('notes')
    .optional({ nullable: true, checkFalsy: true })
    .isString()
    .isLength({ max: 500 })
    .withMessage('Notes must be less than 500 characters')
];

// Validation for adding sessions
const validateAddSessions = [
  body('total_sessions')
    .isInt()
    .isIn([10, 20, 30, 40])
    .withMessage('Session count must be 10, 20, 30, or 40'),
  
  body('payment_method')
    .optional()
    .isIn(['cash', 'card', 'transfer'])
    .withMessage('Payment method must be cash, card, or transfer'),
  
  body('notes')
    .optional({ nullable: true, checkFalsy: true })
    .isString()
    .isLength({ max: 500 })
    .withMessage('Notes must be less than 500 characters')
];

// Validation for customer update
const validateCustomerUpdate = [
  body('contact_first_name')
    .optional()
    .trim()
    .isLength({ min: 2, max: 50 })
    .withMessage('First name must be between 2 and 50 characters'),
  
  body('contact_last_name')
    .optional()
    .trim()
    .isLength({ min: 2, max: 50 })
    .withMessage('Last name must be between 2 and 50 characters'),
  
  body('contact_phone')
    .optional()
    .trim()
    .matches(/^[\+]?[0-9\s\-\(\)]{7,20}$/)
    .withMessage('Please provide a valid phone number'),
  
  body('contact_email')
    .optional({ nullable: true, checkFalsy: true })
    .isEmail()
    .normalizeEmail()
    .withMessage('Please provide a valid email address'),
  
  body('notes')
    .optional({ nullable: true, checkFalsy: true })
    .isString()
    .isLength({ max: 500 })
    .withMessage('Notes must be less than 500 characters')
];

// Create customer with mandatory session package (studio owner only)
router.post(
  '/studios/:studioId/customers',
  authenticate,
  authorize(['studio_owner', 'admin']),
  validateCustomerCreate,
  customerController.createCustomer
);

// Add sessions to existing customer
router.post(
  '/customers/:id/sessions',
  authenticate,
  authorize(['studio_owner', 'admin']),
  validateAddSessions,
  customerController.addSessions
);

// Get customer registration info
router.get(
  '/customers/:id/registration-info',
  authenticate,
  authorize(['studio_owner', 'admin']),
  customerController.getRegistrationInfo
);

// Get all customers for a studio
router.get(
  '/studios/:studioId/customers',
  authenticate,
  authorize(['studio_owner', 'admin']),
  customerController.getStudioCustomers
);

// Get single customer details
router.get(
  '/customers/:id',
  authenticate,
  authorize(['studio_owner', 'admin', 'customer']),
  customerController.getCustomer
);

// Update customer information
router.put(
  '/customers/:id',
  authenticate,
  authorize(['studio_owner', 'admin']),
  validateCustomerUpdate,
  customerController.updateCustomer
);

// Session block management routes

// Get all session blocks for a customer
router.get(
  '/customers/:id/session-blocks',
  authenticate,
  authorize(['studio_owner', 'admin']),
  customerController.getSessionBlocks
);

// Delete a session block (only if unused)
router.delete(
  '/customers/:customerId/session-blocks/:blockId',
  authenticate,
  authorize(['studio_owner', 'admin']),
  customerController.deleteSessionBlock
);

// Edit a pending session block (upgrade sessions)
router.put(
  '/customers/:customerId/session-blocks/:blockId',
  authenticate,
  authorize(['studio_owner', 'admin']),
  [
    body('total_sessions')
      .isInt()
      .isIn([10, 20, 30, 40])
      .withMessage('Total sessions must be 10, 20, 30, or 40'),
    body('payment_method')
      .optional()
      .isIn(['cash', 'card', 'transfer'])
      .withMessage('Payment method must be cash, card, or transfer'),
    body('notes')
      .optional({ nullable: true, checkFalsy: true })
      .isString()
      .isLength({ max: 500 })
      .withMessage('Notes must be less than 500 characters')
  ],
  customerController.editPendingBlock
);

// Consume sessions from active block
router.post(
  '/customers/:id/consume-sessions',
  authenticate,
  authorize(['studio_owner', 'admin']),
  [
    body('sessions_to_consume')
      .isInt({ min: 1, max: 10 })
      .withMessage('Sessions to consume must be between 1 and 10'),
    body('reason')
      .optional()
      .isString()
      .isLength({ max: 200 })
      .withMessage('Reason must be less than 200 characters')
  ],
  customerController.consumeSessions
);

// Refund sessions to a block
router.post(
  '/customers/:id/refund-sessions',
  authenticate,
  authorize(['studio_owner', 'admin']),
  [
    body('sessions_to_refund')
      .isInt({ min: 1, max: 10 })
      .withMessage('Sessions to refund must be between 1 and 10'),
    body('block_id')
      .optional()
      .isInt()
      .withMessage('Block ID must be a valid integer'),
    body('reason')
      .optional()
      .isString()
      .isLength({ max: 200 })
      .withMessage('Reason must be less than 200 characters')
  ],
  customerController.refundSessions
);

// Delete customer (only if no active session blocks)
router.delete(
  '/customers/:id',
  (req, res, next) => {
    console.log('🔥 DELETE /customers/:id route matched, starting middleware chain for ID:', req.params.id);
    console.log('🔥 Request headers:', req.headers.authorization ? 'Auth token present' : 'No auth token');
    next();
  },
  authenticate,
  (req, res, next) => {
    console.log('✅ Authentication passed for customer delete:', req.params.id);
    console.log('✅ User:', req.user ? `${req.user.userId} (${req.user.role})` : 'No user set');
    next();
  },
  authorize(['studio_owner', 'admin']),
  (req, res, next) => {
    console.log('✅ Authorization passed for customer delete:', req.params.id);
    next();
  },
  param('id').isInt().withMessage('Customer ID must be an integer'),
  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      console.log('❌ Validation failed for customer delete:', errors.array());
      return res.status(400).json({ errors: errors.array() });
    }
    console.log('✅ Validation passed for customer delete:', req.params.id);
    next();
  },
  (req, res, next) => {
    console.log('🚨 DELETE /customers/:id about to call controller for ID:', req.params.id);
    next();
  },
  customerController.deleteCustomer
);

// Log route registration for debugging
console.log('🚀 Customer routes registered:');
console.log('   - DELETE /customers/:id (customer deletion)');
console.log('   - POST /customers/:id/sessions (add sessions)');  
console.log('   - POST /customers/:id/refund-sessions (refund sessions)');
console.log('   - GET /customers/:id (get customer details)');
console.log('   - All customer routes ready for requests');

module.exports = router;