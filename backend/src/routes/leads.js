const express = require('express');
const { authenticate } = require('../middleware/auth');
const leadController = require('../controllers/leadController');
const { 
  validateLeadCreate,
  validateLeadUpdate,
  validateLeadId,
  validateStudioId
} = require('../middleware/validation');

const router = express.Router();

// All lead routes require authentication
router.use(authenticate);

// Get all leads for a studio
router.get('/studio/:studioId', 
  validateStudioId,
  leadController.getStudioLeads
);

// Get lead statistics for a studio
router.get('/studio/:studioId/stats', 
  validateStudioId,
  leadController.getStudioLeadStats
);

// Create a new lead
router.post('/', 
  validateLeadCreate,
  leadController.createLead
);

// Get a specific lead
router.get('/:id', 
  validateLeadId,
  leadController.getLead
);

// Update a lead
router.put('/:id', 
  validateLeadId,
  validateLeadUpdate,
  leadController.updateLead
);

// Update lead status
router.patch('/:id/status', 
  validateLeadId,
  leadController.updateLeadStatus
);

// Delete a lead
router.delete('/:id', 
  validateLeadId,
  leadController.deleteLead
);

// Initiate call to lead
router.post('/:id/call', 
  validateLeadId,
  leadController.initiateCall
);

// Get call history for a lead
router.get('/:id/calls', 
  validateLeadId,
  leadController.getLeadCallLogs
);

module.exports = router;