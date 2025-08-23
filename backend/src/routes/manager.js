const express = require('express');
const managerController = require('../controllers/managerController');
const { authenticate, authorize } = require('../middleware/auth');
const { body, param, query } = require('express-validator');

const router = express.Router();

// Validation middleware
const validateStudioOwnerCodeGeneration = [
  body('intendedOwnerName').notEmpty().withMessage('Intended owner name is required'),
  body('intendedCity').notEmpty().withMessage('Intended city is required'),
  body('intendedStudioName').optional().isString(),
  body('count').optional().isInt({ min: 1, max: 10 }).withMessage('Count must be between 1 and 10'),
  body('expiresInDays').optional().isInt({ min: 1, max: 365 }).withMessage('Expiry days must be between 1 and 365')
];

const validatePagination = [
  query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
  query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100'),
  query('showUsed').optional().isBoolean().withMessage('showUsed must be a boolean'),
  query('includeExpired').optional().isBoolean().withMessage('includeExpired must be a boolean'),
  query('city').optional().isString().withMessage('City must be a string')
];

// All manager routes require authentication and manager role
router.use(authenticate);
router.use(authorize(['manager']));

// OBSOLETE: Studio owner code management - No longer used
// Managers don't issue codes for studio registration anymore
// Keeping endpoints commented for reference only
// router.post('/studio-owner-codes', 
//   validateStudioOwnerCodeGeneration,
//   managerController.generateStudioOwnerCodes
// );

// router.get('/studio-owner-codes', 
//   validatePagination,
//   managerController.getStudioOwnerCodes
// );

// Manager statistics and overview
router.get('/stats', 
  managerController.getStatistics
);

// Subscription management for managers
router.get('/subscriptions',
  query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100'),
  query('offset').optional().isInt({ min: 0 }).withMessage('Offset must be non-negative'),
  query('status').optional().isIn(['trial', 'active', 'expired', 'cancelled', 'payment_failed']).withMessage('Invalid status'),
  managerController.getSubscriptionsOverview
);

// Enhanced studios endpoint with search and Google Sheets integration status
router.get('/studios', 
  query('search').optional().isString(),
  query('address').optional().isString(),
  query('city').optional().isString(),
  query('hasSheet').optional().isIn(['true', 'false']),
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 100 }),
  managerController.getStudiosOverview
);

// Get studio-specific Google Sheets integration details
router.get('/studios/:studioId/integration',
  param('studioId').isInt(),
  managerController.getStudioIntegration
);

// Get comprehensive studio details including subscription and payment history
router.get('/studios/:studioId/details',
  param('studioId').isInt(),
  managerController.getStudioDetails
);

router.get('/cities', 
  managerController.getCitiesOverview
);

module.exports = router;