const express = require('express');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

// TODO: Temporarily disabled due to callback-style database calls
// All lead routes return simple status messages until fixed

router.use(authenticate);

router.get('/', (req, res) => {
  res.json({ 
    message: 'Leads endpoint temporarily disabled',
    status: 'under_maintenance',
    leads: [] 
  });
});

router.get('/studio/:studioId', (req, res) => {
  res.json({ 
    message: 'Studio leads endpoint temporarily disabled',
    status: 'under_maintenance',
    leads: [] 
  });
});

router.get('/stats', (req, res) => {
  res.json({ 
    message: 'Lead stats temporarily disabled',
    status: 'under_maintenance',
    stats: {
      total: 0,
      new: 0,
      contacted: 0,
      converted: 0
    }
  });
});

module.exports = router;