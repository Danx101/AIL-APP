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
    
    // Get appointment types
    const appointmentTypes = await db.all(
      'SELECT * FROM appointment_types WHERE studio_id = ? AND is_active = 1 ORDER BY name',
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
       VALUES (?, ?, ?, ?, ?, 1, datetime('now'), datetime('now'))`,
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

// Get session blocks for a studio
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
    
    // Get session blocks
    const blocks = await db.all(
      'SELECT * FROM session_blocks WHERE studio_id = ? AND is_active = 1 ORDER BY display_order, name',
      [studioId]
    );
    
    res.json({ blocks });
  } catch (error) {
    console.error('Error fetching session blocks:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Create session block
router.post('/:studioId/blocks', async (req, res) => {
  try {
    const { studioId } = req.params;
    const { name, sessions, price, display_order } = req.body;
    
    // Verify user owns this studio
    const studio = await db.get(
      'SELECT * FROM studios WHERE id = ? AND owner_id = ?',
      [studioId, req.user.userId]
    );
    
    if (!studio) {
      return res.status(404).json({ message: 'Studio not found or access denied' });
    }
    
    // Create session block
    const result = await db.run(
      `INSERT INTO session_blocks (studio_id, name, sessions, price, display_order, is_active, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, 1, datetime('now'), datetime('now'))`,
      [studioId, name, sessions, price, display_order || 0]
    );
    
    res.status(201).json({ 
      message: 'Session block created',
      id: result.lastID 
    });
  } catch (error) {
    console.error('Error creating session block:', error);
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