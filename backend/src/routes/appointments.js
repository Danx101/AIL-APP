const express = require('express');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

// TODO: Temporarily disabled due to callback-style database calls
// All appointment routes return simple status messages until fixed

router.use(authenticate);

router.get('/', (req, res) => {
  res.json({ 
    message: 'Appointments endpoint temporarily disabled',
    status: 'under_maintenance',
    appointments: [] 
  });
});

router.get('/studio/:studioId', (req, res) => {
  res.json({ 
    message: 'Studio appointments endpoint temporarily disabled',
    status: 'under_maintenance',
    appointments: [] 
  });
});

router.get('/stats', (req, res) => {
  res.json({ 
    message: 'Appointment stats temporarily disabled',
    status: 'under_maintenance',
    stats: {
      total: 0,
      upcoming: 0,
      completed: 0
    }
  });
});

module.exports = router;