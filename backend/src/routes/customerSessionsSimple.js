const express = require('express');
const { authenticate } = require('../middleware/auth');
const db = require('../database/database-wrapper');

const router = express.Router();

// All routes require authentication
router.use(authenticate);

// Get customer's session blocks
router.get('/customers/:customerId/sessions/blocks', async (req, res) => {
  try {
    const { customerId } = req.params;
    
    // Get user's studio
    const studio = await db.get(
      'SELECT * FROM studios WHERE owner_id = ? AND is_active = 1',
      [req.user.userId]
    );
    
    if (!studio) {
      return res.status(404).json({ message: 'No studio found for this user' });
    }
    
    // Verify customer belongs to this studio
    const customer = await db.get(
      'SELECT * FROM customers WHERE user_id = ? AND studio_id = ?',
      [customerId, studio.id]
    );
    
    if (!customer) {
      return res.status(404).json({ message: 'Customer not found for this studio' });
    }
    
    // Get customer's session blocks
    const blocks = await db.all(`
      SELECT 
        cs.id,
        cs.total_sessions,
        cs.remaining_sessions,
        cs.is_active,
        cs.queue_position,
        cs.purchase_date,
        cs.notes,
        cs.created_at,
        cs.updated_at,
        CASE 
          WHEN cs.total_sessions = 10 THEN '10er Block'
          WHEN cs.total_sessions = 20 THEN '20er Block'
          WHEN cs.total_sessions = 30 THEN '30er Block'
          WHEN cs.total_sessions = 40 THEN '40er Block'
          ELSE CONCAT(CAST(cs.total_sessions AS CHAR), 'er Block')
        END as name
      FROM customer_sessions cs
      WHERE cs.customer_id = ? AND cs.studio_id = ?
      ORDER BY cs.is_active DESC, cs.queue_position ASC
    `, [customerId, studio.id]);
    
    res.json({ blocks });
  } catch (error) {
    console.error('Error fetching customer session blocks:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Add sessions to customer (topup)
router.post('/customers/:customerId/sessions/topup', async (req, res) => {
  try {
    const { customerId } = req.params;
    const { sessions, notes } = req.body;
    
    // Validate sessions
    if (!sessions || sessions < 1) {
      return res.status(400).json({ message: 'Invalid session count' });
    }
    
    // Get user's studio
    const studio = await db.get(
      'SELECT * FROM studios WHERE owner_id = ? AND is_active = 1',
      [req.user.userId]
    );
    
    if (!studio) {
      return res.status(404).json({ message: 'No studio found for this user' });
    }
    
    // Verify customer belongs to this studio
    const customer = await db.get(
      'SELECT * FROM customers WHERE user_id = ? AND studio_id = ?',
      [customerId, studio.id]
    );
    
    if (!customer) {
      return res.status(404).json({ message: 'Customer not found for this studio' });
    }
    
    // Get current queue position
    const maxPosition = await db.get(
      'SELECT COALESCE(MAX(queue_position), -1) as max_pos FROM customer_sessions WHERE customer_id = ? AND studio_id = ?',
      [customerId, studio.id]
    );
    
    const queuePosition = (maxPosition.max_pos || -1) + 1;
    
    // Check if customer has no active sessions (first block should be active)
    const activeBlock = await db.get(
      'SELECT * FROM customer_sessions WHERE customer_id = ? AND studio_id = ? AND is_active = 1',
      [customerId, studio.id]
    );
    
    const isActive = !activeBlock;
    
    // Create session block for customer
    const result = await db.run(
      `INSERT INTO customer_sessions (customer_id, studio_id, total_sessions, remaining_sessions, is_active, queue_position, purchase_date, notes, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, CURDATE(), ?, NOW(), NOW())`,
      [customerId, studio.id, sessions, sessions, isActive ? 1 : 0, queuePosition, notes || '']
    );
    
    res.status(201).json({ 
      message: 'Session block added successfully',
      id: result.lastID,
      is_active: isActive,
      sessions_added: sessions
    });
  } catch (error) {
    console.error('Error adding session block:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

module.exports = router;