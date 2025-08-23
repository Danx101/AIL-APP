const db = require('../database/database-wrapper');
const { validationResult } = require('express-validator');

class CustomerController {
  // Create a new customer with mandatory session package
  async createCustomer(req, res) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        console.error('Validation errors:', errors.array());
        console.error('Request body:', req.body);
        return res.status(400).json({ errors: errors.array() });
      }

      const { 
        firstName, 
        lastName, 
        phone, 
        email, 
        sessionPackage, 
        paymentMethod, 
        notes 
      } = req.body;
      
      const studioId = req.params.studioId;

      // Validate session package is provided
      if (!sessionPackage || ![10, 20, 30, 40].includes(sessionPackage)) {
        return res.status(400).json({ 
          message: 'Session package is required. Must be 10, 20, 30, or 40 sessions' 
        });
      }

      // Check if customer with same phone already exists in this studio
      const existingCustomer = await db.get(
        'SELECT * FROM customers WHERE studio_id = ? AND contact_phone = ?',
        [studioId, phone]
      );

      if (existingCustomer) {
        return res.status(400).json({ 
          message: 'Customer with this phone number already exists' 
        });
      }

      // Get studio for registration code generation
      const studio = await db.get(
        'SELECT unique_identifier FROM studios WHERE id = ?',
        [studioId]
      );

      if (!studio) {
        return res.status(404).json({ message: 'Studio not found' });
      }

      // For now, skip transactions due to connection management complexity
      // TODO: Implement proper transaction handling with connection passing
      
      try {
        console.log('Creating customer with data:', {
            studioId, firstName, lastName, phone, email, sessionPackage, notes
        });
        
        // Create customer record (without total_sessions_purchased)
        const result = await db.run(
          `INSERT INTO customers (
            studio_id, 
            contact_first_name, 
            contact_last_name, 
            contact_phone, 
            contact_email,
            customer_since,
            acquisition_type,
            notes
          ) VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP, 'direct_purchase', ?)`,
          [studioId, firstName, lastName, phone, email || null, notes || null]
        );
        
        console.log('Customer insert result:', result);
        const customerId = result.insertId;

        // Generate and update registration code
        const registrationCode = `${studio.unique_identifier}-${customerId}`;
        await db.run(
          'UPDATE customers SET registration_code = ? WHERE id = ?',
          [registrationCode, customerId]
        );

        // Create session block with new structure
        await db.run(
          `INSERT INTO customer_sessions (
            customer_id, 
            studio_id, 
            block_type,
            total_sessions, 
            remaining_sessions, 
            status,
            activation_date,
            purchase_date,
            payment_method,
            created_at
          ) VALUES (?, ?, ?, ?, ?, 'active', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, ?, CURRENT_TIMESTAMP)`,
          [customerId, studioId, sessionPackage, sessionPackage, sessionPackage, paymentMethod || 'cash']
        );

        // Transaction commit removed for now

        // Fetch the created customer with session info
        const customer = await db.get(
          `SELECT c.*, 
           (SELECT remaining_sessions 
            FROM customer_sessions cs 
            WHERE cs.customer_id = c.id AND cs.status = 'active'
            LIMIT 1) as remaining_sessions,
           (SELECT SUM(total_sessions) 
            FROM customer_sessions cs 
            WHERE cs.customer_id = c.id) as total_sessions_purchased
           FROM customers c
           WHERE c.id = ?`,
          [customerId]
        );

        res.status(201).json({
          message: `Customer created with ${sessionPackage} sessions`,
          customer: {
            id: customerId,
            registration_code: registrationCode,
            name: `${firstName} ${lastName}`,
            phone,
            email,
            total_sessions_purchased: sessionPackage,
            remaining_sessions: sessionPackage,
            has_app_access: false,
            customer_since: customer.customer_since
          },
          instructions: `Customer can register on app with code: ${registrationCode}`
        });

      } catch (error) {
        // Rollback removed for now
        throw error;
      }

    } catch (error) {
      console.error('Customer creation error:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  }

  // Add sessions to existing customer
  async addSessions(req, res) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const customerId = req.params.id;
      const { total_sessions, payment_method, notes } = req.body;

      // Validate session count
      if (![10, 20, 30, 40].includes(total_sessions)) {
        return res.status(400).json({ 
          message: 'Session count must be 10, 20, 30, or 40' 
        });
      }

      // Check if customer exists
      const customer = await db.get(
        `SELECT c.*, s.unique_identifier 
         FROM customers c
         JOIN studios s ON c.studio_id = s.id
         WHERE c.id = ?`,
        [customerId]
      );

      if (!customer) {
        return res.status(404).json({ message: 'Customer not found' });
      }

      // Check if customer already has a pending block
      const pendingBlock = await db.get(
        `SELECT * FROM customer_sessions 
         WHERE customer_id = ? AND status = 'pending'`,
        [customerId]
      );

      if (pendingBlock) {
        return res.status(400).json({ 
          message: 'Customer already has a pending session block. Cannot add another block until the pending one is used.' 
        });
      }

      // Check if customer has an active block
      const activeBlock = await db.get(
        `SELECT * FROM customer_sessions 
         WHERE customer_id = ? AND status = 'active'`,
        [customerId]
      );

      const blockStatus = activeBlock ? 'pending' : 'active';
      const activationDate = activeBlock ? null : new Date().toISOString().slice(0, 19).replace('T', ' ');

      // Add new session block
      await db.run(
        `INSERT INTO customer_sessions (
          customer_id, 
          studio_id, 
          block_type,
          total_sessions, 
          remaining_sessions, 
          status,
          activation_date,
          payment_method,
          notes,
          purchase_date,
          created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
        [customerId, customer.studio_id, total_sessions, total_sessions, total_sessions, blockStatus, activationDate, payment_method || 'cash', notes]
      );

      // Get updated session information
      const sessionInfo = await db.get(
        `SELECT 
          (SELECT remaining_sessions FROM customer_sessions WHERE customer_id = ? AND status = 'active') as active_sessions,
          (SELECT remaining_sessions FROM customer_sessions WHERE customer_id = ? AND status = 'pending') as pending_sessions,
          (SELECT SUM(total_sessions) FROM customer_sessions WHERE customer_id = ?) as total_purchased
         FROM dual`,
        [customerId, customerId, customerId]
      );

      res.json({
        message: blockStatus === 'active' 
          ? `Added ${total_sessions} sessions as active block`
          : `Added ${total_sessions} sessions as pending block (will activate when current block is consumed)`,
        session_package: {
          total: total_sessions,
          remaining: total_sessions,
          status: blockStatus
        },
        registration_code: customer.registration_code,
        total_sessions_purchased: sessionInfo.total_purchased,
        active_sessions: sessionInfo.active_sessions || 0,
        pending_sessions: sessionInfo.pending_sessions || 0
      });

    } catch (error) {
      console.error('Add sessions error:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  }

  // Get customer registration info
  async getRegistrationInfo(req, res) {
    try {
      const customerId = req.params.id;

      const customer = await db.get(
        `SELECT c.*, s.name as studio_name,
         (SELECT remaining_sessions 
          FROM customer_sessions cs 
          WHERE cs.customer_id = c.id AND cs.status = 'active'
          LIMIT 1) as remaining_sessions,
         (SELECT SUM(total_sessions) 
          FROM customer_sessions cs 
          WHERE cs.customer_id = c.id) as total_sessions_purchased
         FROM customers c
         JOIN studios s ON c.studio_id = s.id
         WHERE c.id = ?`,
        [customerId]
      );

      if (!customer) {
        return res.status(404).json({ message: 'Customer not found' });
      }

      const response = {
        customer_id: customer.id,
        customer_name: `${customer.contact_first_name} ${customer.contact_last_name}`,
        registration_code: customer.registration_code,
        has_app_access: customer.has_app_access,
        total_sessions_purchased: customer.total_sessions_purchased,
        remaining_sessions: customer.remaining_sessions || 0,
        studio_name: customer.studio_name
      };

      if (customer.has_app_access) {
        response.status = 'Already registered on app';
      } else if (customer.total_sessions_purchased > 0) {
        response.status = 'Ready to register';
        response.instructions = `Download the app and register with code: ${customer.registration_code}`;
      } else {
        response.status = 'Needs to purchase sessions first';
      }

      res.json(response);

    } catch (error) {
      console.error('Get registration info error:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  }

  // Get all customers for a studio
  async getStudioCustomers(req, res) {
    console.log('=== getStudioCustomers called ===');
    try {
      const studioId = req.params.studioId;
      const { page = 1, limit = 20, search = '' } = req.query;
      
      console.log('Getting customers for studio:', studioId, 'with params:', { page, limit, search });
      const offset = (page - 1) * limit;

      let query = `
        SELECT c.*, 
          (SELECT SUM(remaining_sessions) 
           FROM customer_sessions cs 
           WHERE cs.customer_id = c.id AND cs.status IN ('active', 'pending')) as remaining_sessions,
          (SELECT SUM(total_sessions) 
           FROM customer_sessions cs 
           WHERE cs.customer_id = c.id) as total_sessions_purchased
        FROM customers c
        WHERE c.studio_id = ?
      `;
      
      const params = [studioId];

      if (search) {
        query += ` AND (
          c.contact_first_name LIKE ? OR 
          c.contact_last_name LIKE ? OR 
          c.contact_phone LIKE ? OR
          c.registration_code LIKE ?
        )`;
        const searchPattern = `%${search}%`;
        params.push(searchPattern, searchPattern, searchPattern, searchPattern);
      }

      query += ` ORDER BY c.customer_since DESC LIMIT ${parseInt(limit)} OFFSET ${parseInt(offset)}`;
      // Remove limit/offset from params since we're using them directly in query

      const customers = await db.all(query, params);
      console.log('Query executed:', query);
      console.log('Query params:', params);
      console.log('Raw customers result:', customers);

      // Get total count
      let countQuery = `
        SELECT COUNT(*) as total 
        FROM customers c
        WHERE c.studio_id = ?
      `;
      const countParams = [studioId];
      
      if (search) {
        countQuery += ` AND (
          c.contact_first_name LIKE ? OR 
          c.contact_last_name LIKE ? OR 
          c.contact_phone LIKE ? OR
          c.registration_code LIKE ?
        )`;
        const searchPattern = `%${search}%`;
        countParams.push(searchPattern, searchPattern, searchPattern, searchPattern);
      }

      const { total } = await db.get(countQuery, countParams);

      res.json({
        customers: customers.map(c => ({
          id: c.id,
          name: `${c.contact_first_name} ${c.contact_last_name}`,
          contact_first_name: c.contact_first_name,  // Add individual fields
          contact_last_name: c.contact_last_name,    // for frontend compatibility
          phone: c.contact_phone,
          contact_phone: c.contact_phone,  // Also include with contact_ prefix
          email: c.contact_email,
          contact_email: c.contact_email,  // Also include with contact_ prefix
          registration_code: c.registration_code,
          has_app_access: c.has_app_access,
          total_sessions_purchased: c.total_sessions_purchased,
          remaining_sessions: c.remaining_sessions || 0,
          customer_since: c.customer_since,
          status_badge: c.has_app_access ? 'App User' : 'Not Registered'
        })),
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / limit)
        }
      });

    } catch (error) {
      console.error('Get studio customers error:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  }

  // Get single customer details
  async getCustomer(req, res) {
    try {
      const customerId = req.params.id;

      const customer = await db.get(
        `SELECT c.*, s.name as studio_name,
         (SELECT remaining_sessions 
          FROM customer_sessions cs 
          WHERE cs.customer_id = c.id AND cs.status = 'active'
          LIMIT 1) as remaining_sessions,
         (SELECT remaining_sessions 
          FROM customer_sessions cs 
          WHERE cs.customer_id = c.id AND cs.status = 'pending'
          LIMIT 1) as pending_sessions,
         (SELECT SUM(total_sessions) 
          FROM customer_sessions cs 
          WHERE cs.customer_id = c.id) as total_sessions_purchased,
         (SELECT COUNT(*) 
          FROM appointments 
          WHERE customer_ref_id = c.id AND person_type = 'customer') as total_appointments,
         (SELECT COUNT(*) 
          FROM appointments 
          WHERE customer_ref_id = c.id AND person_type = 'customer' AND appointment_date >= CURDATE()) as upcoming_appointments
         FROM customers c
         JOIN studios s ON c.studio_id = s.id
         WHERE c.id = ?`,
        [customerId]
      );

      if (!customer) {
        return res.status(404).json({ message: 'Customer not found' });
      }

      // Get session history
      const sessions = await db.all(
        `SELECT * FROM customer_sessions 
         WHERE customer_id = ? 
         ORDER BY created_at DESC`,
        [customerId]
      );

      res.json({
        customer: {
          id: customer.id,
          name: `${customer.contact_first_name} ${customer.contact_last_name}`,
          phone: customer.contact_phone,
          email: customer.contact_email,
          registration_code: customer.registration_code,
          has_app_access: customer.has_app_access,
          total_sessions_purchased: customer.total_sessions_purchased,
          remaining_sessions: customer.remaining_sessions || 0,
          customer_since: customer.customer_since,
          studio_name: customer.studio_name,
          stats: {
            total_appointments: customer.total_appointments,
            upcoming_appointments: customer.upcoming_appointments
          }
        },
        session_history: sessions
      });

    } catch (error) {
      console.error('Get customer error:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  }

  // Update customer information
  async updateCustomer(req, res) {
    try {
      const customerId = req.params.id;
      const { contact_first_name, contact_last_name, contact_phone, contact_email, notes } = req.body;

      const customer = await db.get('SELECT * FROM customers WHERE id = ?', [customerId]);
      if (!customer) {
        return res.status(404).json({ message: 'Customer not found' });
      }

      const updates = [];
      const params = [];

      if (contact_first_name) {
        updates.push('contact_first_name = ?');
        params.push(contact_first_name);
      }
      if (contact_last_name) {
        updates.push('contact_last_name = ?');
        params.push(contact_last_name);
      }
      if (contact_phone) {
        updates.push('contact_phone = ?');
        params.push(contact_phone);
      }
      if (contact_email) {
        updates.push('contact_email = ?');
        params.push(contact_email);
      }
      if (notes !== undefined) {
        updates.push('notes = ?');
        params.push(notes);
      }

      if (updates.length === 0) {
        return res.status(400).json({ message: 'No fields to update' });
      }

      params.push(customerId);
      await db.run(
        `UPDATE customers SET ${updates.join(', ')} WHERE id = ?`,
        params
      );

      res.json({ message: 'Customer updated successfully' });

    } catch (error) {
      console.error('Update customer error:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  }

  // Get session blocks for a customer
  async getSessionBlocks(req, res) {
    try {
      const customerId = req.params.id;

      // Verify customer exists
      const customer = await db.get('SELECT * FROM customers WHERE id = ?', [customerId]);
      if (!customer) {
        return res.status(404).json({ message: 'Customer not found' });
      }

      // Get all session blocks with new structure
      const blocks = await db.all(
        `SELECT * FROM customer_sessions 
         WHERE customer_id = ? 
         ORDER BY 
           CASE status 
             WHEN 'active' THEN 1 
             WHEN 'pending' THEN 2 
             ELSE 3 
           END, 
           created_at DESC`,
        [customerId]
      );

      res.json({
        blocks: blocks.map(block => ({
          id: block.id,
          block_type: block.block_type || block.total_sessions,
          total_sessions: block.total_sessions,
          remaining_sessions: block.remaining_sessions,
          status: block.status,
          is_active: block.status === 'active',  // Frontend compatibility
          activation_date: block.activation_date,
          payment_method: block.payment_method,
          payment_amount: block.payment_amount,
          purchase_date: block.purchase_date || block.created_at,
          notes: block.notes,
          used_sessions: block.total_sessions - block.remaining_sessions
        }))
      });

    } catch (error) {
      console.error('Get session blocks error:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  }

  // Delete a session block
  async deleteSessionBlock(req, res) {
    try {
      const { customerId, blockId } = req.params;

      // Verify customer and block exist
      const block = await db.get(
        'SELECT * FROM customer_sessions WHERE id = ? AND customer_id = ?',
        [blockId, customerId]
      );

      if (!block) {
        return res.status(404).json({ message: 'Session block not found' });
      }

      // Don't allow deletion of blocks with used sessions
      if (block.remaining_sessions < block.total_sessions) {
        return res.status(400).json({ 
          message: 'Cannot delete block with used sessions. Sessions have already been consumed.' 
        });
      }

      // Log the deletion for audit trail
      console.log(`🗑️  Session Block Deletion: Customer ${customerId}, Block ${blockId}, Sessions: ${block.total_sessions}, Status: ${block.status}, User: ${req.user.userId}`);
      
      // Delete the block
      await db.run('DELETE FROM customer_sessions WHERE id = ?', [blockId]);

      res.json({ 
        message: `Session block deleted successfully. ${block.total_sessions} sessions refunded.`,
        refunded_sessions: block.total_sessions,
        block_details: {
          id: blockId,
          total_sessions: block.total_sessions,
          status: block.status,
          purchase_date: block.purchase_date
        }
      });

    } catch (error) {
      console.error('Delete session block error:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  }

  // Consume sessions from active block
  async consumeSessions(req, res) {
    try {
      const customerId = req.params.id;
      const { sessions_to_consume, reason } = req.body;

      if (!sessions_to_consume || sessions_to_consume < 1) {
        return res.status(400).json({ message: 'Invalid number of sessions to consume' });
      }

      // Get active block with remaining sessions
      const activeBlock = await db.get(
        `SELECT * FROM customer_sessions 
         WHERE customer_id = ? AND status = 'active' AND remaining_sessions > 0
         LIMIT 1`,
        [customerId]
      );

      if (!activeBlock) {
        return res.status(400).json({ message: 'No active session block with remaining sessions' });
      }

      if (activeBlock.remaining_sessions < sessions_to_consume) {
        return res.status(400).json({ 
          message: `Only ${activeBlock.remaining_sessions} sessions remaining in active block` 
        });
      }

      // Consume sessions
      const newRemaining = activeBlock.remaining_sessions - sessions_to_consume;
      
      // Update the active block
      if (newRemaining === 0) {
        // Block is exhausted, mark as completed
        await db.run(
          `UPDATE customer_sessions 
           SET remaining_sessions = 0, status = 'completed'
           WHERE id = ?`,
          [activeBlock.id]
        );

        // Activate pending block if available
        const pendingBlock = await db.get(
          `SELECT * FROM customer_sessions 
           WHERE customer_id = ? AND status = 'pending'
           LIMIT 1`,
          [customerId]
        );

        if (pendingBlock) {
          await db.run(
            `UPDATE customer_sessions 
             SET status = 'active', activation_date = CURRENT_TIMESTAMP 
             WHERE id = ?`,
            [pendingBlock.id]
          );
        }
      } else {
        // Just update remaining sessions
        await db.run(
          `UPDATE customer_sessions 
           SET remaining_sessions = ?
           WHERE id = ?`,
          [newRemaining, activeBlock.id]
        );
      }

      // Log the consumption (optional - for history tracking)
      if (reason) {
        console.log(`Customer ${customerId} consumed ${sessions_to_consume} sessions. Reason: ${reason}`);
      }

      res.json({
        message: `Successfully consumed ${sessions_to_consume} session(s)`,
        block_id: activeBlock.id,
        remaining_in_block: newRemaining,
        consumed: sessions_to_consume
      });

    } catch (error) {
      console.error('Consume sessions error:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  }

  // Refund sessions to active block
  async refundSessions(req, res) {
    try {
      console.log('💰 Refund sessions endpoint hit:', req.params.id, req.body);
      const customerId = req.params.id;
      const { sessions_to_refund, block_id, reason } = req.body;

      if (!sessions_to_refund || sessions_to_refund < 1) {
        return res.status(400).json({ message: 'Invalid number of sessions to refund' });
      }

      let targetBlock;
      
      if (block_id) {
        // Refund to specific block
        targetBlock = await db.get(
          'SELECT * FROM customer_sessions WHERE id = ? AND customer_id = ?',
          [block_id, customerId]
        );
      } else {
        // Refund to most recent active block using correct status field
        targetBlock = await db.get(
          `SELECT * FROM customer_sessions 
           WHERE customer_id = ? AND status = 'active'
           ORDER BY created_at DESC
           LIMIT 1`,
          [customerId]
        );
      }

      if (!targetBlock) {
        return res.status(404).json({ message: 'No session block found for refund' });
      }

      // Calculate new remaining (but don't exceed original total)
      const newRemaining = Math.min(
        targetBlock.remaining_sessions + sessions_to_refund,
        targetBlock.total_sessions
      );
      const actualRefunded = newRemaining - targetBlock.remaining_sessions;

      await db.run(
        'UPDATE customer_sessions SET remaining_sessions = ?, status = \'active\' WHERE id = ?',
        [newRemaining, targetBlock.id]
      );

      res.json({
        message: `Successfully refunded ${actualRefunded} session(s)`,
        block_id: targetBlock.id,
        new_remaining: newRemaining,
        refunded: actualRefunded
      });

    } catch (error) {
      console.error('Refund sessions error:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  }
  // Utility function to activate next pending block
  async activateNextBlock(customerId) {
    try {
      const pendingBlock = await db.get(
        `SELECT * FROM customer_sessions 
         WHERE customer_id = ? AND status = 'pending'
         ORDER BY purchase_date ASC
         LIMIT 1`,
        [customerId]
      );

      if (pendingBlock) {
        await db.run(
          `UPDATE customer_sessions 
           SET status = 'active', activation_date = ?
           WHERE id = ?`,
          [new Date().toISOString().slice(0, 19).replace('T', ' '), pendingBlock.id]
        );
        
        console.log(`Activated pending block ${pendingBlock.id} for customer ${customerId}`);
        return pendingBlock;
      }
      
      return null;
    } catch (error) {
      console.error('Error activating next block:', error);
      throw error;
    }
  }

  // Utility function to check and complete exhausted blocks
  async checkAndCompleteBlock(blockId, customerId) {
    try {
      const block = await db.get(
        `SELECT * FROM customer_sessions WHERE id = ?`,
        [blockId]
      );

      if (block && block.remaining_sessions === 0 && block.status === 'active') {
        // Mark block as completed
        await db.run(
          `UPDATE customer_sessions 
           SET status = 'completed'
           WHERE id = ?`,
          [blockId]
        );

        // Activate next pending block
        await this.activateNextBlock(customerId);
        
        console.log(`Completed block ${blockId} and activated next block for customer ${customerId}`);
        return true;
      }
      
      return false;
    } catch (error) {
      console.error('Error checking and completing block:', error);
      throw error;
    }
  }

  // Edit a pending session block (upgrade sessions)
  async editPendingBlock(req, res) {
    try {
      const { customerId, blockId } = req.params;
      const { total_sessions, payment_method, notes } = req.body;

      // Validate input
      if (!total_sessions || ![10, 20, 30, 40].includes(parseInt(total_sessions))) {
        return res.status(400).json({ 
          message: 'Total sessions must be 10, 20, 30, or 40' 
        });
      }

      // Get the existing block
      const existingBlock = await db.get(
        'SELECT * FROM customer_sessions WHERE id = ? AND customer_id = ?',
        [blockId, customerId]
      );

      if (!existingBlock) {
        return res.status(404).json({ message: 'Session block not found' });
      }

      // Only allow editing pending blocks
      if (existingBlock.status !== 'pending') {
        return res.status(400).json({ 
          message: 'Can only edit pending session blocks. This block is ' + existingBlock.status 
        });
      }

      // Prevent downgrading (business rule)
      if (parseInt(total_sessions) < existingBlock.total_sessions) {
        return res.status(400).json({ 
          message: `Cannot downgrade from ${existingBlock.total_sessions} to ${total_sessions} sessions` 
        });
      }

      // Update the pending block
      await db.run(
        `UPDATE customer_sessions 
         SET total_sessions = ?, remaining_sessions = ?, payment_method = ?, notes = ?
         WHERE id = ? AND customer_id = ?`,
        [total_sessions, total_sessions, payment_method || existingBlock.payment_method, notes, blockId, customerId]
      );

      // Log the edit for audit trail
      console.log(`📝 Session Block Edit: Customer ${customerId}, Block ${blockId}, ${existingBlock.total_sessions}→${total_sessions} sessions, User: ${req.user.userId}`);

      res.json({ 
        message: `Pending block updated successfully from ${existingBlock.total_sessions} to ${total_sessions} sessions`,
        old_sessions: existingBlock.total_sessions,
        new_sessions: parseInt(total_sessions),
        block_details: {
          id: blockId,
          status: 'pending',
          total_sessions: parseInt(total_sessions),
          remaining_sessions: parseInt(total_sessions)
        }
      });

    } catch (error) {
      console.error('Edit pending block error:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  }

  // Delete customer (only if no active session blocks)
  async deleteCustomer(req, res) {
    try {
      console.log('🗑️ Delete customer endpoint hit:', req.params.id);
      const customerId = req.params.id;

      // Get customer details
      const customer = await db.get('SELECT * FROM customers WHERE id = ?', [customerId]);
      
      if (!customer) {
        return res.status(404).json({ message: 'Customer not found' });
      }

      // Check if customer has active session blocks or blocks with remaining sessions
      const activeBlocks = await db.all(
        'SELECT * FROM customer_sessions WHERE customer_id = ? AND (status = \'active\' OR remaining_sessions > 0)',
        [customerId]
      );

      if (activeBlocks.length > 0) {
        return res.status(400).json({ 
          message: 'Cannot delete customer with active or pending session blocks. Please consume or refund all sessions first.',
          active_blocks: activeBlocks.length
        });
      }

      // Check if customer has upcoming appointments
      const upcomingAppointments = await db.all(
        'SELECT * FROM appointments WHERE customer_id = ? AND appointment_date >= CURRENT_DATE AND status != \'cancelled\'',
        [customerId]
      );

      if (upcomingAppointments.length > 0) {
        return res.status(400).json({ 
          message: 'Cannot delete customer with upcoming appointments. Please cancel all future appointments first.',
          upcoming_appointments: upcomingAppointments.length
        });
      }

      // Safe to delete - only has completed blocks and no upcoming appointments
      try {
        console.log(`🗑️ Starting deletion process for customer ${customerId}`);
        
        // Delete related data in order (respecting foreign key constraints)
        console.log(`🗑️ Deleting customer sessions for customer ${customerId}`);
        await db.run('DELETE FROM customer_sessions WHERE customer_id = ?', [customerId]);
        
        console.log(`🗑️ Deleting appointments for customer ${customerId}`);
        await db.run('DELETE FROM appointments WHERE customer_id = ?', [customerId]);
        
        console.log(`🗑️ Deleting user record for customer ${customerId}`);
        await db.run('DELETE FROM users WHERE id = ? AND role = \'customer\'', [customerId]);
        
        console.log(`🗑️ Deleting customer record ${customerId}`);
        await db.run('DELETE FROM customers WHERE id = ?', [customerId]);

        console.log(`✅ Customer ${customerId} successfully deleted`);

        res.json({
          message: 'Customer successfully deleted',
          customer_id: customerId,
          customer_name: `${customer.contact_first_name} ${customer.contact_last_name}`
        });

      } catch (deleteError) {
        console.error('❌ Error during customer deletion:', deleteError);
        console.error('❌ Delete error details:', {
          message: deleteError.message,
          code: deleteError.code,
          errno: deleteError.errno,
          sql: deleteError.sql
        });
        throw deleteError;
      }

    } catch (error) {
      console.error('Delete customer error:', error);
      res.status(500).json({ 
        message: 'Internal server error',
        details: error.message
      });
    }
  }
}

module.exports = new CustomerController();