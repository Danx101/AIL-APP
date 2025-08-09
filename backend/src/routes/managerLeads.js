const express = require('express');
const managerLeadController = require('../controllers/managerLeadController');
const { authenticate, authorize } = require('../middleware/auth');
const { 
  validateGoogleSheetsConnect,
  validateGoogleSheetsPreview,
  validateIntegrationId
} = require('../middleware/validation');

const router = express.Router();

// All manager lead routes require authentication and manager role
router.use(authenticate);
router.use(authorize(['manager']));

// Google Sheets management routes
router.post('/google-sheets/connect',
  validateGoogleSheetsConnect,
  managerLeadController.connectGoogleSheets.bind(managerLeadController)
);

router.post('/google-sheets/preview',
  validateGoogleSheetsPreview,
  managerLeadController.previewGoogleSheets.bind(managerLeadController)
);

router.get('/google-sheets',
  managerLeadController.getGoogleSheetsIntegrations.bind(managerLeadController)
);

router.get('/google-sheets/:id',
  validateIntegrationId,
  managerLeadController.getGoogleSheetsIntegration.bind(managerLeadController)
);

router.put('/google-sheets/:id',
  validateIntegrationId,
  managerLeadController.updateGoogleSheetsIntegration.bind(managerLeadController)
);

router.delete('/google-sheets/:id',
  validateIntegrationId,
  managerLeadController.deleteGoogleSheetsIntegration.bind(managerLeadController)
);

router.post('/google-sheets/:id/sync',
  validateIntegrationId,
  managerLeadController.triggerManualSync.bind(managerLeadController)
);

// Manager lead statistics
router.get('/leads/stats',
  managerLeadController.getAllLeadStats.bind(managerLeadController)
);

// Get leads for a specific studio
router.get('/studios/:studioId/leads',
  managerLeadController.getStudioLeads.bind(managerLeadController)
);

module.exports = router;