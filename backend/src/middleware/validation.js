const { body, param, query } = require('express-validator');

// User registration validation
const validateRegister = [
  body('email')
    .isEmail()
    .normalizeEmail({ gmail_remove_dots: false })
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
    .custom((value) => {
      if (!value || value.trim() === '') return true;
      return /^[\+]?[0-9\s\-\(\)]{7,20}$/.test(value.trim());
    })
    .withMessage('Please provide a valid phone number'),
  
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
    .normalizeEmail({ gmail_remove_dots: false })
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
    .optional({ nullable: true, checkFalsy: true })
    .custom((value) => {
      if (!value || value.trim() === '') return true;
      return /^[\+]?[0-9\s\-\(\)]{7,20}$/.test(value.trim());
    })
    .withMessage('Please provide a valid phone number')
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
    .optional({ nullable: true, checkFalsy: true })
    .custom((value) => {
      if (!value || value.trim() === '') return true;
      return /^[\+]?[0-9\s\-\(\)]{7,20}$/.test(value.trim());
    })
    .withMessage('Please provide a valid phone number'),
  
  body('email')
    .optional()
    .isEmail()
    .normalizeEmail({ gmail_remove_dots: false })
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

// Appointment validation
const validateAppointmentCreate = [
  body('studio_id')
    .isInt({ min: 1 })
    .withMessage('Studio ID must be a positive integer'),
  
  body('customer_id')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Customer ID must be a positive integer'),
  
  body('appointment_type_id')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Appointment type ID must be a positive integer'),
  
  body('appointment_date')
    .isISO8601()
    .withMessage('Appointment date must be a valid date (YYYY-MM-DD)'),
  
  body('start_time')
    .matches(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/)
    .withMessage('Start time must be in HH:MM format'),
  
  body('end_time')
    .optional()
    .matches(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/)
    .withMessage('End time must be in HH:MM format'),
  
  body('notes')
    .optional()
    .isString()
    .withMessage('Notes must be a string')
];

const validateAppointmentUpdate = [
  body('appointment_type_id')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Appointment type ID must be a positive integer'),
  
  body('appointment_date')
    .optional()
    .isISO8601()
    .withMessage('Appointment date must be a valid date (YYYY-MM-DD)'),
  
  body('start_time')
    .optional()
    .matches(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/)
    .withMessage('Start time must be in HH:MM format'),
  
  body('end_time')
    .optional()
    .matches(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/)
    .withMessage('End time must be in HH:MM format'),
  
  body('status')
    .optional()
    .isIn(['pending', 'confirmed', 'cancelled', 'completed', 'no_show'])
    .withMessage('Status must be one of: pending, confirmed, cancelled, completed, no_show'),
  
  body('notes')
    .optional()
    .isString()
    .withMessage('Notes must be a string')
];

const validateAppointmentStatus = [
  body('status')
    .isIn([
      'pending', 'confirmed', 'cancelled', 'completed', 'no_show',
      'bestätigt', 'abgesagt', 'abgeschlossen', 'nicht erschienen'
    ])
    .withMessage('Status must be one of: pending, confirmed, cancelled, completed, no_show, bestätigt, abgesagt, abgeschlossen, nicht erschienen')
];

const validateAppointmentId = [
  param('id')
    .isInt({ min: 1 })
    .withMessage('Appointment ID must be a positive integer')
];

const validateCustomerId = [
  param('customerId')
    .isInt({ min: 1 })
    .withMessage('Customer ID must be a positive integer')
];

// Session validation
const validateSessionTopup = [
  body('sessionCount')
    .isInt({ min: 1 })
    .isIn([10, 20])
    .withMessage('Session count must be 10 or 20'),
  
  body('notes')
    .optional()
    .isString()
    .withMessage('Notes must be a string')
];

const validateSessionId = [
  param('sessionId')
    .isInt({ min: 1 })
    .withMessage('Session ID must be a positive integer')
];

// Session edit validation
const validateSessionEdit = [
  param('id')
    .isInt({ min: 1 })
    .withMessage('Session ID must be a positive integer'),
  
  body('remaining_sessions')
    .optional()
    .isInt({ min: 0 })
    .withMessage('Remaining sessions must be a non-negative integer'),
  
  body('notes')
    .optional()
    .isString()
    .isLength({ max: 500 })
    .withMessage('Notes must be a string with maximum 500 characters')
];

// Session deactivate validation
const validateSessionDeactivate = [
  param('id')
    .isInt({ min: 1 })
    .withMessage('Session ID must be a positive integer'),
  
  body('reason')
    .notEmpty()
    .isString()
    .isLength({ min: 3, max: 200 })
    .withMessage('Deactivation reason is required and must be between 3 and 200 characters'),
  
  body('notes')
    .optional()
    .isString()
    .isLength({ max: 500 })
    .withMessage('Notes must be a string with maximum 500 characters')
];

// Lead validation
const validateLeadCreate = [
  body('studio_id')
    .isInt({ min: 1 })
    .withMessage('Studio ID must be a positive integer'),
  
  body('name')
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage('Name must be between 2 and 100 characters'),
  
  body('phone_number')
    .trim()
    .matches(/^[\+]?[0-9\s\-\(\)]{7,20}$/)
    .withMessage('Please provide a valid phone number'),
  
  body('email')
    .optional({ nullable: true, checkFalsy: true })
    .isEmail()
    .normalizeEmail({ gmail_remove_dots: false })
    .withMessage('Please provide a valid email address'),
  
  body('source')
    .optional()
    .isIn(['manual', 'google_sheets', 'website', 'referral', 'advertisement', 'social_media'])
    .withMessage('Invalid source'),
  
  body('status')
    .optional()
    .isIn(['neu', 'kontaktiert', 'konvertiert'])
    .withMessage('Invalid status'),
  
  body('notes')
    .optional()
    .isString()
    .isLength({ max: 1000 })
    .withMessage('Notes must be a string with maximum 1000 characters')
];

const validateLeadUpdate = [
  body('name')
    .optional()
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage('Name must be between 2 and 100 characters'),
  
  body('phone_number')
    .optional()
    .trim()
    .matches(/^[\+]?[0-9\s\-\(\)]{7,20}$/)
    .withMessage('Please provide a valid phone number'),
  
  body('email')
    .optional({ nullable: true, checkFalsy: true })
    .isEmail()
    .normalizeEmail({ gmail_remove_dots: false })
    .withMessage('Please provide a valid email address'),
  
  body('source')
    .optional()
    .isIn(['manual', 'google_sheets', 'website', 'referral', 'advertisement', 'social_media'])
    .withMessage('Invalid source'),
  
  body('status')
    .optional()
    .isIn(['neu', 'kontaktiert', 'konvertiert'])
    .withMessage('Invalid status'),
  
  body('notes')
    .optional()
    .isString()
    .isLength({ max: 1000 })
    .withMessage('Notes must be a string with maximum 1000 characters'),
  
  body('next_follow_up')
    .optional({ nullable: true, checkFalsy: true })
    .isISO8601()
    .withMessage('Next follow up must be a valid date'),
  
  body('lead_score')
    .optional()
    .isInt({ min: 0, max: 100 })
    .withMessage('Lead score must be between 0 and 100'),
  
  body('conversion_status')
    .optional()
    .isIn(['lead', 'prospect', 'customer', 'lost'])
    .withMessage('Invalid conversion status')
];

const validateLeadId = [
  param('id')
    .isInt({ min: 1 })
    .withMessage('Lead ID must be a positive integer')
];

const validateGoogleSheetsImport = [
  body('studio_id')
    .isInt({ min: 1 })
    .withMessage('Studio ID must be a positive integer'),
  
  body('sheet_url')
    .trim()
    .matches(/^(https:\/\/docs\.google\.com\/spreadsheets\/d\/[a-zA-Z0-9-_]+|[a-zA-Z0-9-_]+)/)
    .withMessage('Please provide a valid Google Sheets URL or sheet ID'),
  
  body('column_mapping')
    .isObject()
    .withMessage('Column mapping must be an object'),
  
  body('column_mapping.name')
    .notEmpty()
    .withMessage('Name column mapping is required'),
  
  body('column_mapping.phone_number')
    .notEmpty()
    .withMessage('Phone number column mapping is required')
];

const validateGoogleSheetsConnect = [
  body('studio_id')
    .isInt({ min: 1 })
    .withMessage('Studio ID must be a positive integer'),
  
  body('sheet_url')
    .trim()
    .matches(/^(https:\/\/docs\.google\.com\/spreadsheets\/d\/[a-zA-Z0-9-_]+|[a-zA-Z0-9-_]+)/)
    .withMessage('Please provide a valid Google Sheets URL or sheet ID'),
  
  body('column_mapping')
    .isObject()
    .withMessage('Column mapping must be an object'),
  
  body('column_mapping.name')
    .notEmpty()
    .withMessage('Name column mapping is required'),
  
  body('column_mapping.phone_number')
    .notEmpty()
    .withMessage('Phone number column mapping is required'),
  
  body('auto_sync_enabled')
    .optional()
    .isBoolean()
    .withMessage('Auto sync enabled must be a boolean')
];

const validateGoogleSheetsPreview = [
  body('sheet_url')
    .trim()
    .matches(/^(https:\/\/docs\.google\.com\/spreadsheets\/d\/[a-zA-Z0-9-_]+|[a-zA-Z0-9-_]+)/)
    .withMessage('Please provide a valid Google Sheets URL or sheet ID'),
  
  body('worksheet_index')
    .optional()
    .isInt({ min: 0 })
    .withMessage('Worksheet index must be a non-negative integer')
];

const validateIntegrationId = [
  param('id')
    .isInt({ min: 1 })
    .withMessage('Integration ID must be a positive integer')
];

// Customer registration with code validation
const validateCustomerRegistration = [
  body('registrationCode')
    .trim()
    .notEmpty()
    .withMessage('Registration code is required')
    .matches(/^[A-Z]{3}-\d+$/)
    .withMessage('Invalid registration code format'),
  
  body('email')
    .isEmail()
    .normalizeEmail({ gmail_remove_dots: false })
    .withMessage('Please provide a valid email address'),
  
  body('password')
    .isLength({ min: 8 })
    .withMessage('Password must be at least 8 characters long')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
    .withMessage('Password must contain at least one lowercase letter, one uppercase letter, and one number'),
  
  body('sendVerificationEmail')
    .optional()
    .isBoolean()
    .withMessage('Send verification email must be a boolean')
];

// Studio registration validation
const validateStudioRegistration = [
  body('email')
    .isEmail()
    .normalizeEmail({ gmail_remove_dots: false })
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
    .custom((value) => {
      if (!value || value.trim() === '') return true;
      return /^[\+]?[0-9\s\-\(\)]{7,20}$/.test(value.trim());
    })
    .withMessage('Please provide a valid phone number'),
  
  body('studioName')
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage('Studio name must be between 2 and 100 characters'),
  
  body('studioAddress')
    .trim()
    .isLength({ min: 5, max: 200 })
    .withMessage('Studio address must be between 5 and 200 characters'),
  
  body('studioCity')
    .trim()
    .isLength({ min: 2, max: 50 })
    .withMessage('Studio city must be between 2 and 50 characters'),
  
  body('studioPhone')
    .optional({ nullable: true, checkFalsy: true })
    .custom((value) => {
      if (!value || value.trim() === '') return true;
      return /^[\+]?[0-9\s\-\(\)]{7,20}$/.test(value.trim());
    })
    .withMessage('Please provide a valid studio phone number')
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
  validatePagination,
  validateAppointmentCreate,
  validateAppointmentUpdate,
  validateAppointmentStatus,
  validateAppointmentId,
  validateCustomerId,
  validateSessionTopup,
  validateSessionId,
  validateSessionEdit,
  validateSessionDeactivate,
  validateLeadCreate,
  validateLeadUpdate,
  validateLeadId,
  validateGoogleSheetsImport,
  validateGoogleSheetsConnect,
  validateGoogleSheetsPreview,
  validateIntegrationId,
  validateCustomerRegistration,
  validateStudioRegistration
};