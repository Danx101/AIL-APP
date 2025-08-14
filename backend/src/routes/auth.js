const express = require('express');
const authController = require('../controllers/authController');
const { authenticate, authorize } = require('../middleware/auth');
const { 
  validateRegister, 
  validateLogin, 
  validateProfileUpdate, 
  validateCustomerRegistration,
  validateStudioRegistration 
} = require('../middleware/validation');

const router = express.Router();

// Public routes
router.post('/register', validateRegister, authController.register);
router.post('/login', validateLogin, authController.login);

// Studio registration with email verification
router.post('/register-studio', validateStudioRegistration, authController.registerStudio);
router.get('/verify-email/:token', authController.verifyEmail);

// Customer registration with code
router.get('/validate-code', authController.validateRegistrationCode);
router.post('/register-customer', validateCustomerRegistration, authController.registerCustomer);
router.post('/register-customer-enhanced', validateCustomerRegistration, authController.registerCustomerEnhanced);

// Protected routes
router.get('/profile', authenticate, authController.getProfile);
router.put('/profile', authenticate, validateProfileUpdate, authController.updateProfile);
router.post('/logout', authenticate, authController.logout);

module.exports = router;