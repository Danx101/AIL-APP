const express = require('express');
const { authenticate, authorize } = require('../middleware/auth');
const db = require('../database/database-wrapper');

const router = express.Router();

// All routes require authentication
router.use(authenticate);

// Get appointment types for the user's studio (no studio ID needed)
router.get('/', async (req, res) => {
  try {
    // First get the user's studio
    const studio = await db.get(
      'SELECT * FROM studios WHERE owner_id = ? AND is_active = 1',
      [req.user.userId]
    );
    
    if (!studio) {
      return res.status(404).json({ message: 'No studio found for this user' });
    }
    
    // Get appointment types (map duration_minutes to duration for frontend compatibility)
    const appointmentTypes = await db.all(
      'SELECT id, studio_id, name, duration_minutes as duration, consumes_session, is_probebehandlung, max_per_customer, description, color, is_active, created_at, updated_at FROM appointment_types WHERE studio_id = ? AND is_active = 1 ORDER BY name',
      [studio.id]
    );
    
    res.json({ appointmentTypes });
  } catch (error) {
    console.error('Error fetching appointment types:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});


module.exports = router;