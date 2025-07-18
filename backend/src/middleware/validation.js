const { body, param, query } = require('express-validator');

// User registration validation
const validateRegister = [
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Please provide a valid email address'),
  
  body('password')
    .isLength({ min: 8 })
    .withMessage('Password must be at least 8 characters long')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
    .withMessage('Password must contain at least one lowercase letter, one uppercase letter, and one number'),
  
  body('firstName')
    .trim()
    .isLength({ min: 2, max: 50 })
    .withMessage('First name must be between 2 and 50 characters'),
  
  body('lastName')
    .trim()
    .isLength({ min: 2, max: 50 })
    .withMessage('Last name must be between 2 and 50 characters'),
  
  body('phone')
    .optional({ nullable: true, checkFalsy: true })
    .isMobilePhone('de-DE')
    .withMessage('Please provide a valid German phone number'),
  
  body('activationCode')
    .optional()
    .isLength({ min: 6, max: 20 })
    .withMessage('Activation code must be between 6 and 20 characters'),
  
  body('managerCode')
    .optional()
    .isLength({ min: 6, max: 20 })
    .withMessage('Manager code must be between 6 and 20 characters'),
  
  body('role')
    .optional()
    .isIn(['customer', 'studio_owner'])
    .withMessage('Role must be either customer or studio_owner')
];

// User login validation
const validateLogin = [
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Please provide a valid email address'),
  
  body('password')
    .notEmpty()
    .withMessage('Password is required')
];

// Profile update validation
const validateProfileUpdate = [
  body('firstName')
    .optional()
    .trim()
    .isLength({ min: 2, max: 50 })
    .withMessage('First name must be between 2 and 50 characters'),
  
  body('lastName')
    .optional()
    .trim()
    .isLength({ min: 2, max: 50 })
    .withMessage('Last name must be between 2 and 50 characters'),
  
  body('phone')
    .optional()
    .isMobilePhone('de-DE')
    .withMessage('Please provide a valid German phone number')
];

// Studio creation validation
const validateStudioCreate = [
  body('name')
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage('Studio name must be between 2 and 100 characters'),
  
  body('address')
    .trim()
    .isLength({ min: 5, max: 200 })
    .withMessage('Address must be between 5 and 200 characters'),
  
  body('phone')
    .optional()
    .isMobilePhone('de-DE')
    .withMessage('Please provide a valid German phone number'),
  
  body('email')
    .optional()
    .isEmail()
    .normalizeEmail()
    .withMessage('Please provide a valid email address'),
  
  body('businessHours')
    .optional()
    .isJSON()
    .withMessage('Business hours must be valid JSON')
];

// Activation code generation validation
const validateActivationCodeGenerate = [
  body('count')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Count must be between 1 and 100'),
  
  body('expiresAt')
    .optional()
    .isISO8601()
    .withMessage('Expiration date must be a valid ISO 8601 date'),
  
  body('studioId')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Studio ID must be a positive integer')
];

// Parameter validation
const validateUserId = [
  param('userId')
    .isInt({ min: 1 })
    .withMessage('User ID must be a positive integer')
];

const validateStudioId = [
  param('studioId')
    .isInt({ min: 1 })
    .withMessage('Studio ID must be a positive integer')
];

const validateActivationCode = [
  param('code')
    .isLength({ min: 6, max: 20 })
    .withMessage('Activation code must be between 6 and 20 characters')
];

// Query validation
const validatePagination = [
  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Page must be a positive integer'),
  
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be between 1 and 100'),
  
  query('sortBy')
    .optional()
    .isIn(['createdAt', 'updatedAt', 'name', 'email'])
    .withMessage('Sort by must be one of: createdAt, updatedAt, name, email'),
  
  query('sortOrder')
    .optional()
    .isIn(['asc', 'desc'])
    .withMessage('Sort order must be either asc or desc')
];

module.exports = {
  validateRegister,
  validateLogin,
  validateProfileUpdate,
  validateStudioCreate,
  validateActivationCodeGenerate,
  validateUserId,
  validateStudioId,
  validateActivationCode,
  validatePagination
};