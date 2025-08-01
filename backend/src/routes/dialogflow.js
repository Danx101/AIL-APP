const express = require('express');
const router = express.Router();

// TODO: Dialogflow integration temporarily disabled
// All routes commented out until proper configuration is complete
// 
// Issues to fix:
// 1. Missing DIALOGFLOW_PROJECT_ID and DIALOGFLOW_AGENT_ID
// 2. Missing dialogflow service implementations
// 3. Incomplete webhook handlers
//
// Uncomment and implement when ready

router.get('/status', (req, res) => {
  res.json({ 
    message: 'Dialogflow integration disabled',
    status: 'not_configured' 
  });
});

module.exports = router;