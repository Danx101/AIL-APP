const express = require('express');
const leadController = require('../controllers/leadController');
const { authenticate, authorize } = require('../middleware/auth');
const { 
  validateLeadCreate,
  validateLeadUpdate,
  validateLeadId,
  validateStudioId,
  validateGoogleSheetsImport
} = require('../middleware/validation');

const router = express.Router();

// All lead routes require authentication
router.use(authenticate);

// Studio-specific lead routes
router.get('/studio/:studioId',
  validateStudioId,
  leadController.getStudioLeads.bind(leadController)
);

router.get('/studio/:studioId/stats',
  validateStudioId,
  leadController.getStudioLeadStats.bind(leadController)
);

// Core lead CRUD operations
router.post('/', 
  validateLeadCreate,
  leadController.createLead.bind(leadController)
);

router.get('/:id',
  validateLeadId,
  leadController.getLead.bind(leadController)
);

router.put('/:id',
  validateLeadId,
  validateLeadUpdate,
  leadController.updateLead.bind(leadController)
);

router.delete('/:id',
  validateLeadId,
  leadController.deleteLead.bind(leadController)
);

// Lead status management
router.patch('/:id/status',
  validateLeadId,
  leadController.updateLeadStatus.bind(leadController)
);

// Lead calling functionality
router.post('/:id/call',
  validateLeadId,
  leadController.initiateCall.bind(leadController)
);

router.get('/:id/calls',
  validateLeadId,
  leadController.getLeadCallLogs.bind(leadController)
);

// Google Sheets integration
router.post('/import/google-sheets',
  validateGoogleSheetsImport,
  leadController.importFromGoogleSheets.bind(leadController)
);

module.exports = router;