const express = require('express');
const { authenticate } = require('../middleware/auth');
const db = require('../database/database-wrapper');

const router = express.Router();

// All lead routes require authentication
router.use(authenticate);

// Get all leads for a studio (simplified)
router.get('/studio/:studioId', async (req, res) => {
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
    
    // Get leads for this studio (simplified schema)
    const leads = await db.all(
      'SELECT id, name, phone_number, email, studio_id, status, source, notes, last_contact_date, next_contact_date, created_at, updated_at FROM leads WHERE studio_id = ? ORDER BY created_at DESC',
      [studioId]
    );
    
    res.json({ leads });
  } catch (error) {
    console.error('Error fetching leads:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Get lead statistics for a studio (simplified)
router.get('/studio/:studioId/stats', async (req, res) => {
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
    
    // Get simple lead stats
    const stats = await db.all(`
      SELECT 
        status,
        COUNT(*) as count
      FROM leads 
      WHERE studio_id = ? 
      GROUP BY status
    `, [studioId]);
    
    const totalLeads = await db.get(
      'SELECT COUNT(*) as total FROM leads WHERE studio_id = ?',
      [studioId]
    );
    
    res.json({ 
      stats,
      total: totalLeads.total 
    });
  } catch (error) {
    console.error('Error fetching lead stats:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Create a new lead (simplified)
router.post('/', async (req, res) => {
  try {
    const { name, phone_number, email, studio_id, source, notes } = req.body;
    
    // Verify user owns this studio
    const studio = await db.get(
      'SELECT * FROM studios WHERE id = ? AND owner_id = ?',
      [studio_id, req.user.userId]
    );
    
    if (!studio) {
      return res.status(404).json({ message: 'Studio not found or access denied' });
    }
    
    // Create lead
    const result = await db.run(
      `INSERT INTO leads (name, phone_number, email, studio_id, status, source, notes, created_at, updated_at)
       VALUES (?, ?, ?, ?, 'neu', ?, ?, datetime('now'), datetime('now'))`,
      [name, phone_number, email, studio_id, source || 'manual', notes || '']
    );
    
    res.status(201).json({ 
      message: 'Lead created',
      id: result.lastID 
    });
  } catch (error) {
    console.error('Error creating lead:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Update a lead (simplified)
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { name, phone_number, email, status, source, notes } = req.body;
    
    // Get lead to verify studio ownership
    const lead = await db.get('SELECT * FROM leads WHERE id = ?', [id]);
    if (!lead) {
      return res.status(404).json({ message: 'Lead not found' });
    }
    
    // Verify user owns this studio
    const studio = await db.get(
      'SELECT * FROM studios WHERE id = ? AND owner_id = ?',
      [lead.studio_id, req.user.userId]
    );
    
    if (!studio) {
      return res.status(403).json({ message: 'Access denied' });
    }
    
    // Update lead
    await db.run(
      `UPDATE leads SET name = ?, phone_number = ?, email = ?, status = ?, source = ?, notes = ?, updated_at = datetime('now')
       WHERE id = ?`,
      [name, phone_number, email, status, source, notes, id]
    );
    
    res.json({ message: 'Lead updated' });
  } catch (error) {
    console.error('Error updating lead:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

module.exports = router;