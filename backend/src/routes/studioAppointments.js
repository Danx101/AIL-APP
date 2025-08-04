const express = require('express');
const { authenticate, authorize } = require('../middleware/auth');
const db = require('../database/database-wrapper');

const router = express.Router();

// All routes require authentication
router.use(authenticate);
router.use(authorize(['studio_owner']));

// Get appointment types for a studio
router.get('/:studioId/appointment-types', async (req, res) => {
  try {
    const { studioId } = req.params;
    
    // Verify user owns this studio
    const studio = await db.get(
      'SELECT * FROM studios WHERE id = ? AND owner_id = ?',
      [studioId, req.user.userId]
    );
    
    if (!studio) {
      return res.status(404).json({ message: 'Studio not found or access denied' });
    }
    
    // Get appointment types (map duration_minutes to duration for frontend compatibility)
    const appointmentTypes = await db.all(
      'SELECT id, studio_id, name, duration_minutes as duration, consumes_session, is_probebehandlung, max_per_customer, description, color, is_active, created_at, updated_at FROM appointment_types WHERE studio_id = ? AND is_active = 1 ORDER BY name',
      [studioId]
    );
    
    res.json({ appointmentTypes });
  } catch (error) {
    console.error('Error fetching appointment types:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Create appointment type
router.post('/:studioId/appointment-types', async (req, res) => {
  try {
    const { studioId } = req.params;
    const { name, duration, description, color } = req.body;
    
    // Verify user owns this studio
    const studio = await db.get(
      'SELECT * FROM studios WHERE id = ? AND owner_id = ?',
      [studioId, req.user.userId]
    );
    
    if (!studio) {
      return res.status(404).json({ message: 'Studio not found or access denied' });
    }
    
    // Create appointment type
    const result = await db.run(
      `INSERT INTO appointment_types (name, duration, description, studio_id, color, is_active, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, 1, NOW(), NOW())`,
      [name, duration || 60, description || '', studioId, color || '#007bff']
    );
    
    res.status(201).json({ 
      message: 'Appointment type created',
      id: result.lastID 
    });
  } catch (error) {
    console.error('Error creating appointment type:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Get customer session blocks for a studio (updated for new schema)
router.get('/:studioId/blocks', async (req, res) => {
  try {
    const { studioId } = req.params;
    
    // Verify user owns this studio
    const studio = await db.get(
      'SELECT * FROM studios WHERE id = ? AND owner_id = ?',
      [studioId, req.user.userId]
    );
    
    if (!studio) {
      return res.status(404).json({ message: 'Studio not found or access denied' });
    }
    
    // Get customer session blocks (updated for new schema)
    const blocks = await db.all(`
      SELECT 
        cs.id,
        u.first_name,
        u.last_name,
        u.email,
        cs.total_sessions as sessions,
        cs.remaining_sessions,
        cs.is_active,
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
      JOIN users u ON cs.customer_id = u.id
      WHERE cs.studio_id = ?
      ORDER BY cs.is_active DESC, cs.created_at DESC
    `, [studioId]);
    
    res.json({ blocks });
  } catch (error) {
    console.error('Error fetching customer session blocks:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Create customer session block (add sessions to a customer)
router.post('/:studioId/blocks', async (req, res) => {
  try {
    const { studioId } = req.params;
    const { customer_id, sessions, notes } = req.body;
    
    // Verify user owns this studio
    const studio = await db.get(
      'SELECT * FROM studios WHERE id = ? AND owner_id = ?',
      [studioId, req.user.userId]
    );
    
    if (!studio) {
      return res.status(404).json({ message: 'Studio not found or access denied' });
    }
    
    // Verify customer exists and belongs to this studio
    const customer = await db.get(
      'SELECT * FROM customers WHERE user_id = ? AND studio_id = ?',
      [customer_id, studioId]
    );
    
    if (!customer) {
      return res.status(404).json({ message: 'Customer not found for this studio' });
    }
    
    // Get current queue position
    const maxPosition = await db.get(
      'SELECT COALESCE(MAX(queue_position), -1) as max_pos FROM customer_sessions WHERE customer_id = ? AND studio_id = ?',
      [customer_id, studioId]
    );
    
    const queuePosition = (maxPosition.max_pos || -1) + 1;
    
    // Check if customer has no active sessions (first block should be active)
    const activeBlock = await db.get(
      'SELECT * FROM customer_sessions WHERE customer_id = ? AND studio_id = ? AND is_active = 1',
      [customer_id, studioId]
    );
    
    const isActive = !activeBlock;
    
    // Create session block for customer
    const result = await db.run(
      `INSERT INTO customer_sessions (customer_id, studio_id, total_sessions, remaining_sessions, is_active, queue_position, purchase_date, notes, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, CURDATE(), ?, NOW(), NOW())`,
      [customer_id, studioId, sessions, sessions, isActive ? 1 : 0, queuePosition, notes || '']
    );
    
    res.status(201).json({ 
      message: 'Session block added to customer',
      id: result.lastID,
      is_active: isActive
    });
  } catch (error) {
    console.error('Error creating customer session block:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Update session block
router.put('/:studioId/blocks/:blockId', async (req, res) => {
  try {
    const { studioId, blockId } = req.params;
    const { name, sessions, price, display_order, is_active } = req.body;
    
    // Verify user owns this studio
    const studio = await db.get(
      'SELECT * FROM studios WHERE id = ? AND owner_id = ?',
      [studioId, req.user.userId]
    );
    
    if (!studio) {
      return res.status(404).json({ message: 'Studio not found or access denied' });
    }
    
    // Update session block
    const updates = [];
    const values = [];
    
    if (name !== undefined) {
      updates.push('name = ?');
      values.push(name);
    }
    if (sessions !== undefined) {
      updates.push('sessions = ?');
      values.push(sessions);
    }
    if (price !== undefined) {
      updates.push('price = ?');
      values.push(price);
    }
    if (display_order !== undefined) {
      updates.push('display_order = ?');
      values.push(display_order);
    }
    if (is_active !== undefined) {
      updates.push('is_active = ?');
      values.push(is_active ? 1 : 0);
    }
    
    if (updates.length === 0) {
      return res.status(400).json({ message: 'No fields to update' });
    }
    
    updates.push('updated_at = datetime(\'now\')');
    values.push(blockId);
    values.push(studioId);
    
    await db.run(
      `UPDATE session_blocks SET ${updates.join(', ')} WHERE id = ? AND studio_id = ?`,
      values
    );
    
    res.json({ message: 'Session block updated' });
  } catch (error) {
    console.error('Error updating session block:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Delete session block
router.delete('/:studioId/blocks/:blockId', async (req, res) => {
  try {
    const { studioId, blockId } = req.params;
    
    // Verify user owns this studio
    const studio = await db.get(
      'SELECT * FROM studios WHERE id = ? AND owner_id = ?',
      [studioId, req.user.userId]
    );
    
    if (!studio) {
      return res.status(404).json({ message: 'Studio not found or access denied' });
    }
    
    // Soft delete by setting is_active = 0
    await db.run(
      'UPDATE session_blocks SET is_active = 0, updated_at = datetime(\'now\') WHERE id = ? AND studio_id = ?',
      [blockId, studioId]
    );
    
    res.json({ message: 'Session block deleted' });
  } catch (error) {
    console.error('Error deleting session block:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

module.exports = router;