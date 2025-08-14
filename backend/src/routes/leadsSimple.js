const express = require('express');
const { authenticate } = require('../middleware/auth');
const db = require('../database/database-wrapper');

const router = express.Router();

// All lead routes require authentication
router.use(authenticate);

// Get leads in kanban format
router.get('/studio/:studioId/kanban', async (req, res) => {
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
    
    // Get all active leads grouped by status
    const leads = await db.all(
      `SELECT id, name, phone_number, email, studio_id, status, source, notes, 
              last_contact_date, next_contact_date, created_at, updated_at 
       FROM leads 
       WHERE studio_id = ? 
       AND status IN ('new', 'working', 'qualified', 'trial_scheduled')
       ORDER BY created_at DESC`,
      [studioId]
    );
    
    // Get archived leads
    const archived = await db.all(
      `SELECT id, name, phone_number, email, studio_id, status, source, notes, 
              last_contact_date, next_contact_date, created_at, updated_at 
       FROM leads 
       WHERE studio_id = ? 
       AND status IN ('converted', 'unreachable', 'wrong_number', 'not_interested', 'lost')
       ORDER BY updated_at DESC`,
      [studioId]
    );
    
    // Get metrics
    const metrics = await db.get(
      `SELECT 
        COUNT(CASE WHEN status = 'new' THEN 1 END) as new_count,
        COUNT(CASE WHEN status = 'working' THEN 1 END) as working_count,
        COUNT(CASE WHEN status = 'qualified' THEN 1 END) as qualified_count,
        COUNT(CASE WHEN status = 'trial_scheduled' THEN 1 END) as trial_scheduled_count,
        COUNT(CASE WHEN status = 'converted' THEN 1 END) as converted_count,
        COUNT(*) as total_count,
        ROUND(COUNT(CASE WHEN status = 'converted' THEN 1 END) * 100.0 / NULLIF(COUNT(*), 0), 1) as conversion_rate
      FROM leads 
      WHERE studio_id = ?`,
      [studioId]
    );
    
    // Organize leads by status
    const kanbanData = {
      leads: {
        new: leads.filter(l => l.status === 'new'),
        working: leads.filter(l => l.status === 'working'),
        qualified: leads.filter(l => l.status === 'qualified'),
        trial_scheduled: leads.filter(l => l.status === 'trial_scheduled')
      },
      archived: {
        positive: {
          converted: archived.filter(l => l.status === 'converted')
        },
        negative: {
          unreachable: archived.filter(l => l.status === 'unreachable'),
          wrong_number: archived.filter(l => l.status === 'wrong_number'),
          not_interested: archived.filter(l => l.status === 'not_interested'),
          lost: archived.filter(l => l.status === 'lost')
        }
      },
      metrics: {
        total: metrics.total_count || 0,
        new: metrics.new_count || 0,
        working: metrics.working_count || 0,
        qualified: metrics.qualified_count || 0,
        trial_scheduled: metrics.trial_scheduled_count || 0,
        converted: metrics.converted_count || 0,
        conversionRate: metrics.conversion_rate || 0
      }
    };
    
    res.json(kanbanData);
  } catch (error) {
    console.error('Error fetching kanban data:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

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

// Create a new lead (optimized)
router.post('/', async (req, res) => {
  try {
    const { name, phone_number, email, studio_id, source, notes } = req.body;
    
    // Basic validation
    if (!name || !phone_number || !studio_id) {
      return res.status(400).json({ message: 'Name, phone number, and studio ID are required' });
    }
    
    // Verify user owns this studio (cached if possible)
    const studio = await db.get(
      'SELECT id, unique_identifier FROM studios WHERE id = ? AND owner_id = ?',
      [studio_id, req.user.userId]
    );
    
    if (!studio) {
      return res.status(404).json({ message: 'Studio not found or access denied' });
    }
    
    // Create lead with optimized query
    const result = await db.run(
      `INSERT INTO leads (name, phone_number, email, studio_id, status, source, notes, created_at, updated_at)
       VALUES (?, ?, ?, ?, 'new', ?, ?, NOW(), NOW())`,
      [name, phone_number, email || null, studio_id, source || 'manual', notes || '']
    );
    
    // Return the created lead immediately
    const newLead = {
      id: result.insertId || result.lastID,
      name,
      phone_number,
      email: email || null,
      studio_id,
      status: 'new',
      source: source || 'manual',
      notes: notes || '',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    
    res.status(201).json({ 
      message: 'Lead created successfully',
      lead: newLead
    });
  } catch (error) {
    console.error('Error creating lead:', error);
    res.status(500).json({ message: 'Failed to create lead. Please try again.' });
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
      `UPDATE leads SET name = ?, phone_number = ?, email = ?, status = ?, source = ?, notes = ?, updated_at = NOW()
       WHERE id = ?`,
      [name, phone_number, email, status, source, notes, id]
    );
    
    res.json({ message: 'Lead updated' });
  } catch (error) {
    console.error('Error updating lead:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Get lead details
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    // Get lead details
    const lead = await db.get(
      'SELECT * FROM leads WHERE id = ?',
      [id]
    );
    
    if (!lead) {
      return res.status(404).json({ message: 'Lead not found' });
    }
    
    // Verify user owns the studio
    const studio = await db.get(
      'SELECT * FROM studios WHERE id = ? AND owner_id = ?',
      [lead.studio_id, req.user.userId]
    );
    
    if (!studio) {
      return res.status(403).json({ message: 'Access denied' });
    }
    
    res.json({ lead });
  } catch (error) {
    console.error('Error fetching lead details:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Update lead status only
router.patch('/:id/status', async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    
    // Validate status
    const validStatuses = [
      'new', 'working', 'qualified', 'trial_scheduled', 'converted',
      'unreachable', 'wrong_number', 'not_interested', 'lost'
    ];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ message: 'Invalid status' });
    }
    
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
    
    // Update lead status
    await db.run(
      'UPDATE leads SET status = ?, updated_at = NOW() WHERE id = ?',
      [status, id]
    );
    
    res.json({ message: 'Lead status updated', status });
  } catch (error) {
    console.error('Error updating lead status:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

module.exports = router;