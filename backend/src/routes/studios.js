const express = require('express');
const studioController = require('../controllers/studioController');
const { authenticate, authorize } = require('../middleware/auth');
const { body, param, query } = require('express-validator');

const router = express.Router();

// Validation middleware
const validateStudioCreate = [
  body('name').optional().isString(),
  body('address').optional().isString(),
  body('phone').optional().isString(),
  body('email').optional().isEmail().withMessage('Valid email is required'),
  body('business_hours').optional().isString(),
  body('city').optional().isString()
];

const validateStudioUpdate = [
  body('name').optional().isString().notEmpty(),
  body('address').optional().isString(),
  body('phone').optional().isString(),
  body('email').optional().isEmail().withMessage('Valid email is required'),
  body('business_hours').optional().isString(),
  body('city').optional().isString()
];

const validateActivationCodeGeneration = [
  body('count').optional().isInt({ min: 1, max: 100 }).withMessage('Count must be between 1 and 100'),
  body('expiresInDays').optional().isInt({ min: 1, max: 365 }).withMessage('Expiry days must be between 1 and 365')
];

// Studio management routes (studio owners only)
router.post('/', 
  authenticate, 
  authorize(['studio_owner']), 
  validateStudioCreate, 
  studioController.create
);

router.get('/my-studio', 
  authenticate, 
  authorize(['studio_owner']), 
  studioController.getMyStudio
);

router.get('/prefill-info', 
  authenticate, 
  authorize(['studio_owner']), 
  studioController.getPreFillInfo
);

router.get('/:id', 
  authenticate, 
  authorize(['studio_owner']), 
  param('id').isInt().withMessage('Studio ID must be an integer'),
  studioController.getById
);

router.put('/:id', 
  authenticate, 
  authorize(['studio_owner']), 
  param('id').isInt().withMessage('Studio ID must be an integer'),
  validateStudioUpdate, 
  studioController.update
);

router.delete('/:id', 
  authenticate, 
  authorize(['studio_owner']), 
  param('id').isInt().withMessage('Studio ID must be an integer'),
  studioController.delete
);

// Studio statistics
router.get('/:id/stats', 
  authenticate, 
  authorize(['studio_owner']), 
  param('id').isInt().withMessage('Studio ID must be an integer'),
  studioController.getStatistics
);

// Activation code management
router.post('/:id/activation-codes', 
  authenticate, 
  authorize(['studio_owner']), 
  param('id').isInt().withMessage('Studio ID must be an integer'),
  validateActivationCodeGeneration,
  studioController.generateActivationCodes
);

router.get('/:id/activation-codes', 
  authenticate, 
  authorize(['studio_owner']), 
  param('id').isInt().withMessage('Studio ID must be an integer'),
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 100 }),
  query('showUsed').optional().isBoolean(),
  studioController.getActivationCodes
);

// Studio customers
router.get('/:id/customers', 
  authenticate, 
  authorize(['studio_owner']), 
  param('id').isInt().withMessage('Studio ID must be an integer'),
  studioController.getCustomers
);

// Studio dashboard statistics
router.get('/:id/dashboard-stats', 
  authenticate, 
  authorize(['studio_owner']), 
  param('id').isInt().withMessage('Studio ID must be an integer'),
  studioController.getDashboardStats
);

// Update customer data
router.patch('/:studioId/customers/:customerId',
  authenticate,
  authorize(['studio_owner']),
  param('studioId').isInt().withMessage('Studio ID must be an integer'),
  param('customerId').isInt().withMessage('Customer ID must be an integer'),
  studioController.updateCustomer
);

// Admin routes (if needed in future)
router.get('/', 
  authenticate, 
  authorize(['admin']), 
  query('limit').optional().isInt({ min: 1, max: 100 }),
  query('offset').optional().isInt({ min: 0 }),
  query('includeInactive').optional().isBoolean(),
  studioController.getAll
);

// Studio settings management
const validateStudioSettings = [
  body('cancellation_advance_hours').optional().isInt({ min: 1, max: 168 }).withMessage('Cancellation advance notice must be between 1 and 168 hours'),
  body('postponement_advance_hours').optional().isInt({ min: 1, max: 168 }).withMessage('Postponement advance notice must be between 1 and 168 hours'),
  body('max_advance_booking_days').optional().isInt({ min: 1, max: 365 }).withMessage('Max advance booking must be between 1 and 365 days')
];

router.get('/:id/settings',
  authenticate,
  authorize(['studio_owner']),
  param('id').isInt().withMessage('Studio ID must be an integer'),
  studioController.getStudioSettings
);

router.patch('/:id/settings',
  authenticate,
  authorize(['studio_owner']),
  param('id').isInt().withMessage('Studio ID must be an integer'),
  validateStudioSettings,
  studioController.updateStudioSettings
);

module.exports = router;