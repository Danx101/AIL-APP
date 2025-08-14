const express = require('express');
const searchController = require('../controllers/searchController');
const { authenticate, authorize } = require('../middleware/auth');
const { query } = require('express-validator');

const router = express.Router();

// Validation for search queries
const validateSearch = [
  query('query')
    .trim()
    .isLength({ min: 2 })
    .withMessage('Search query must be at least 2 characters'),
  
  query('type')
    .optional()
    .isIn(['all', 'lead', 'customer'])
    .withMessage('Type must be all, lead, or customer'),
  
  query('studio_id')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Studio ID must be a positive integer')
];

const validateQuickSearch = [
  query('query')
    .trim()
    .isLength({ min: 2 })
    .withMessage('Search query must be at least 2 characters'),
  
  query('studio_id')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Studio ID must be a positive integer')
];

// Unified search across leads and customers
router.get(
  '/persons',
  authenticate,
  authorize(['studio_owner', 'admin']),
  validateSearch,
  searchController.searchPersons
);

// Quick search for appointment booking
router.get(
  '/quick',
  authenticate,
  authorize(['studio_owner', 'admin']),
  validateQuickSearch,
  searchController.quickSearch
);

module.exports = router;