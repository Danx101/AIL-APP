const express = require('express');
const fs = require('fs').promises;
const path = require('path');
const db = require('../database/database-wrapper');

const router = express.Router();

// NOTE: These endpoints are temporary and do NOT use authentication for testing
// They should be removed after migration is complete

// Temporary migration endpoint - should be removed after use
router.post('/run-migration/:migrationFile', async (req, res) => {
  try {
    const { migrationFile } = req.params;
    
    // Security check - only allow specific migration files
    const allowedFiles = [
      '016_create_lead_appointments_table.sql',
      '016_simple_lead_appointments.sql'
    ];
    if (!allowedFiles.includes(migrationFile)) {
      return res.status(400).json({ message: 'Migration file not allowed' });
    }
    
    console.log(`Starting migration: ${migrationFile}`);
    
    // Read the migration file
    const migrationPath = path.join(__dirname, '../../migrations', migrationFile);
    const migrationSQL = await fs.readFile(migrationPath, 'utf8');
    
    // Handle MySQL triggers properly - split on $$ delimiter first
    let processedSQL = migrationSQL;
    
    // Extract trigger definitions
    const triggerMatches = processedSQL.match(/CREATE TRIGGER[\s\S]*?END\$\$/g);
    const triggers = triggerMatches || [];
    
    // Remove triggers from main SQL and DELIMITER statements
    processedSQL = processedSQL.replace(/DELIMITER \$\$/g, '');
    processedSQL = processedSQL.replace(/DELIMITER ;/g, '');
    processedSQL = processedSQL.replace(/CREATE TRIGGER[\s\S]*?END\$\$/g, '');
    
    // Split main SQL into statements
    const mainStatements = processedSQL
      .split(';')
      .map(stmt => stmt.trim())
      .filter(stmt => stmt.length > 0 && !stmt.startsWith('--'))
      .filter(stmt => !stmt.match(/^(SELECT|DESCRIBE)/i)); // Skip verification queries
    
    // Clean up trigger SQL (remove $$)
    const cleanTriggers = triggers.map(trigger => 
      trigger.replace(/\$\$/g, '').trim()
    );
    
    // Combine all statements
    const statements = [...mainStatements, ...cleanTriggers];
    
    console.log(`Found ${statements.length} SQL statements to execute`);
    console.log('Statements:', statements.map((s, i) => `${i + 1}: ${s.substring(0, 100)}...`));
    
    let connection;
    try {
      // Get a connection from the pool for the migration
      connection = await db.getPoolConnection();
      
      // Execute each statement
      for (let i = 0; i < statements.length; i++) {
        const statement = statements[i].trim();
        
        if (statement) {
          console.log(`Executing statement ${i + 1}/${statements.length}: ${statement.substring(0, 100)}...`);
          
          try {
            // Handle DELIMITER statements for MySQL triggers
            if (statement.includes('DELIMITER')) {
              continue; // Skip DELIMITER statements - not needed in programmatic execution
            }
            
            // Use .query() for complex statements like triggers, .execute() for simple statements
            if (statement.toUpperCase().includes('CREATE TRIGGER') || statement.toUpperCase().includes('DROP TRIGGER')) {
              await connection.query(statement);
            } else {
              await connection.execute(statement);
            }
            console.log(`✅ Statement ${i + 1} executed successfully`);
          } catch (statementError) {
            // Check if it's a "table already exists" error, which is OK
            if (statementError.code === 'ER_TABLE_EXISTS_ERROR') {
              console.log(`⚠️ Table already exists, continuing...`);
              continue;
            }
            throw statementError;
          }
        }
      }
      
      console.log('✅ Migration completed successfully');
      
      // Verify the table was created
      const [tables] = await connection.execute("SHOW TABLES LIKE 'lead_appointments'");
      
      res.json({
        success: true,
        message: `Migration ${migrationFile} executed successfully`,
        statementsExecuted: statements.length,
        tableExists: tables.length > 0
      });
      
    } finally {
      if (connection) {
        connection.release();
      }
    }
    
  } catch (error) {
    console.error('Migration error:', error);
    res.status(500).json({
      success: false,
      message: 'Migration failed',
      error: error.message,
      code: error.code
    });
  }
});

// Create lead appointments table directly
router.post('/create-lead-appointments-table', async (req, res) => {
  try {
    const createTableSQL = `
      CREATE TABLE IF NOT EXISTS lead_appointments (
        id INT AUTO_INCREMENT PRIMARY KEY,
        studio_id INT NOT NULL,
        lead_id INT NOT NULL,
        appointment_type_id INT NOT NULL,
        appointment_date DATE NOT NULL,
        start_time TIME NOT NULL,
        end_time TIME NOT NULL,
        status ENUM('geplant', 'abgeschlossen', 'nicht_erschienen', 'abgesagt') DEFAULT 'geplant',
        cancelled_by ENUM('lead', 'studio', 'system') NULL,
        cancelled_at TIMESTAMP NULL,
        notes TEXT,
        created_by_user_id INT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        
        INDEX idx_lead_appointment_studio_date (studio_id, appointment_date),
        INDEX idx_lead_appointment_lead (lead_id),
        INDEX idx_lead_appointment_date_time (appointment_date, start_time),
        INDEX idx_lead_appointment_status (status),
        INDEX idx_lead_appointment_type (appointment_type_id),
        
        FOREIGN KEY (studio_id) REFERENCES studios(id) ON DELETE CASCADE,
        FOREIGN KEY (lead_id) REFERENCES leads(id) ON DELETE CASCADE,
        FOREIGN KEY (appointment_type_id) REFERENCES appointment_types(id) ON DELETE RESTRICT,
        FOREIGN KEY (created_by_user_id) REFERENCES users(id) ON DELETE RESTRICT
      )
    `;
    
    const result = await db.run(createTableSQL);
    
    // Verify table was created
    const verification = await db.get("SHOW TABLES LIKE 'lead_appointments'");
    
    res.json({
      success: true,
      message: 'Lead appointments table created successfully',
      tableCreated: verification ? true : false,
      result: {
        affectedRows: result.changes,
        insertId: result.lastID
      }
    });
    
  } catch (error) {
    console.error('Table creation error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create lead_appointments table',
      error: error.message,
      code: error.code
    });
  }
});

// Test unified calendar query
router.get('/test-unified-calendar/:studioId', async (req, res) => {
  try {
    const { studioId } = req.params;
    
    // Test the unified calendar query (similar to what's in appointments.js)
    const unifiedQuery = `
      SELECT 
        'customer' as appointment_source,
        a.id,
        a.studio_id,
        a.customer_id,
        a.customer_ref_id,
        NULL as lead_id,
        'customer' as person_type,
        a.appointment_type_id,
        a.appointment_date,
        a.start_time,
        a.end_time,
        a.status,
        a.notes,
        a.created_at,
        COALESCE(c.contact_first_name, '') as customer_first_name,
        COALESCE(c.contact_last_name, '') as customer_last_name,
        c.contact_email as customer_email,
        c.contact_phone as customer_phone,
        at.name as appointment_type_name,
        at.duration_minutes,
        at.color as appointment_type_color
      FROM appointments a
      LEFT JOIN customers c ON a.customer_ref_id = c.id
      LEFT JOIN appointment_types at ON a.appointment_type_id = at.id
      WHERE a.studio_id = ?

      UNION ALL

      SELECT 
        'lead' as appointment_source,
        la.id,
        la.studio_id,
        NULL as customer_id,
        NULL as customer_ref_id,
        la.lead_id,
        'lead' as person_type,
        la.appointment_type_id,
        la.appointment_date,
        la.start_time,
        la.end_time,
        la.status,
        la.notes,
        la.created_at,
        SUBSTRING_INDEX(l.name, ' ', 1) as customer_first_name,
        SUBSTRING_INDEX(l.name, ' ', -1) as customer_last_name,
        l.email as customer_email,
        l.phone_number as customer_phone,
        at.name as appointment_type_name,
        at.duration_minutes,
        at.color as appointment_type_color
      FROM lead_appointments la
      LEFT JOIN leads l ON la.lead_id = l.id
      LEFT JOIN appointment_types at ON la.appointment_type_id = at.id
      WHERE la.studio_id = ?
      
      ORDER BY appointment_date, start_time
    `;

    const appointments = await db.all(unifiedQuery, [studioId, studioId]);
    
    res.json({
      success: true,
      message: `Found ${appointments.length} appointments (customer + lead combined)`,
      appointments,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('Unified calendar test error:', error);
    res.status(500).json({
      success: false,
      message: 'Unified calendar test failed',
      error: error.message,
      code: error.code
    });
  }
});

// Test lead appointment creation
router.post('/test-lead-appointment', async (req, res) => {
  try {
    const LeadAppointment = require('../models/LeadAppointment');
    
    // Test data
    const studioId = 1;
    const leadData = {
      name: 'Test Walk-in Customer',
      phone_number: '+49123456789',
      email: 'test@example.com'
    };
    const appointmentData = {
      appointment_type_id: 1, // Assuming there's at least one appointment type
      appointment_date: '2025-08-21', // Tomorrow
      start_time: '10:00:00',
      end_time: '11:00:00',
      notes: 'Test walk-in appointment'
    };
    const createdByUserId = 1; // Assuming there's at least one user
    
    console.log('Creating test lead appointment...');
    
    const result = await LeadAppointment.createWithLead(
      studioId,
      leadData,
      appointmentData,
      createdByUserId
    );
    
    res.json({
      success: true,
      message: 'Test lead appointment created successfully',
      result: {
        leadId: result.leadId,
        appointmentId: result.appointmentId
      },
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('Lead appointment creation test error:', error);
    res.status(500).json({
      success: false,
      message: 'Lead appointment creation test failed',
      error: error.message,
      code: error.code,
      details: error.stack
    });
  }
});

// Check leads table structure
router.get('/test-leads-structure', async (req, res) => {
  try {
    const structure = await db.all("DESCRIBE leads");
    res.json({
      success: true,
      leadsTableStructure: structure,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to get leads table structure',
      error: error.message
    });
  }
});

// Get migration status
router.get('/status', async (req, res) => {
  try {
    let connection;
    try {
      connection = await db.getPoolConnection();
      
      // Check if lead_appointments table exists
      const [tables] = await connection.execute("SHOW TABLES LIKE 'lead_appointments'");
      const tableExists = tables.length > 0;
      
      let tableInfo = null;
      if (tableExists) {
        // Get table structure
        const [columns] = await connection.execute("DESCRIBE lead_appointments");
        const [triggers] = await connection.execute("SHOW TRIGGERS LIKE 'lead_appointments'");
        
        tableInfo = {
          columns: columns.length,
          triggers: triggers.length,
          structure: columns
        };
      }
      
      res.json({
        tableExists,
        tableInfo,
        timestamp: new Date().toISOString()
      });
      
    } finally {
      if (connection) {
        connection.release();
      }
    }
    
  } catch (error) {
    console.error('Status check error:', error);
    res.status(500).json({
      success: false,
      message: 'Status check failed',
      error: error.message
    });
  }
});

// Create test data for development
router.post('/create-test-data', async (req, res) => {
  try {
    console.log('Creating test data...');
    
    // Create test user
    const [userResult] = await db.getPoolConnection().then(async (connection) => {
      try {
        const result = await connection.execute(`
          INSERT IGNORE INTO users (email, password_hash, first_name, last_name, role, is_active) 
          VALUES ('test@example.com', '$2b$10$test', 'Test', 'User', 'admin', 1)
        `);
        return [result];
      } finally {
        connection.release();
      }
    });
    
    let userId = userResult.insertId || 1;
    
    // Get existing user if insert was ignored
    if (!userResult.insertId) {
      const existingUser = await db.get('SELECT id FROM users WHERE email = "test@example.com"');
      userId = existingUser?.id || 1;
    }
    
    // Create test studio
    const [studioResult] = await db.getPoolConnection().then(async (connection) => {
      try {
        const result = await connection.execute(`
          INSERT IGNORE INTO studios (name, address, email, owner_id, machine_count, is_active) 
          VALUES ('Test Studio', 'Test Address 1', 'studio@test.com', ?, 2, 1)
        `, [userId]);
        return [result];
      } finally {
        connection.release();
      }
    });
    
    let studioId = studioResult.insertId || 1;
    
    // Get existing studio if insert was ignored
    if (!studioResult.insertId) {
      const existingStudio = await db.get('SELECT id FROM studios WHERE owner_id = ?', [userId]);
      studioId = existingStudio?.id || 1;
    }
    
    // Create appointment types
    const appointmentTypes = [
      ['Behandlung', 60, 1, 'Regular treatment', '#28a745', 1],
      ['Probebehandlung', 60, 0, 'Free trial treatment', '#ffc107', 1],
      ['Beratung', 30, 0, 'Consultation', '#17a2b8', 0]
    ];
    
    for (const [name, duration, consumes, description, color, is_probe] of appointmentTypes) {
      await db.getPoolConnection().then(async (connection) => {
        try {
          await connection.execute(`
            INSERT IGNORE INTO appointment_types (studio_id, name, duration_minutes, consumes_session, description, color, is_probebehandlung) 
            VALUES (?, ?, ?, ?, ?, ?, ?)
          `, [studioId, name, duration, consumes, description, color, is_probe]);
        } finally {
          connection.release();
        }
      });
    }
    
    console.log('✅ Test data created successfully');
    
    res.json({
      success: true,
      message: 'Test data created successfully',
      data: {
        userId,
        studioId,
        appointmentTypesCreated: appointmentTypes.length
      }
    });
    
  } catch (error) {
    console.error('Test data creation error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create test data',
      error: error.message,
      code: error.code
    });
  }
});

// Fix leads status column to include probebehandlung statuses - NO AUTH REQUIRED FOR EMERGENCY FIX
// Investigation endpoint for walk-in debugging
router.post('/investigate-walk-in', async (req, res) => {
  const results = {
    dbConnection: false,
    transactionCreated: false,
    leadCreated: false,
    appointmentCreated: false,
    statusUpdated: false,
    transactionCommitted: false,
    errors: []
  };

  let connection = null;
  let leadId = null;

  try {
    // Step 1: Test database connection
    try {
      connection = await db.beginTransaction();
      results.dbConnection = true;
      results.transactionCreated = true;
    } catch (error) {
      results.errors.push({ step: 'connection', error: error.message });
      return res.json(results);
    }

    // Step 2: Test lead creation
    try {
      const [leadResult] = await connection.execute(
        'INSERT INTO leads (studio_id, name, phone_number, email, status, created_at, updated_at) VALUES (?, ?, ?, ?, "new", CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)',
        [5, 'Test Walk-in Lead', '+43 123 456 7890', 'test@example.com']
      );
      leadId = leadResult.insertId;
      results.leadCreated = true;
      results.leadId = leadId;
    } catch (error) {
      results.errors.push({ 
        step: 'lead_creation', 
        error: error.message,
        code: error.code,
        errno: error.errno,
        sql: error.sql
      });
    }

    // Step 3: Test appointment creation
    if (leadId) {
      try {
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        const dateStr = tomorrow.toISOString().split('T')[0];
        
        const [appointmentResult] = await connection.execute(`
          INSERT INTO lead_appointments (
            studio_id, lead_id, appointment_type_id, appointment_date, 
            start_time, end_time, status, notes, created_by_user_id
          ) VALUES (?, ?, ?, ?, ?, ?, 'geplant', ?, ?)
        `, [
          5,
          leadId,
          15, // Probebehandlung type ID
          dateStr,
          '10:00:00',
          '11:00:00',
          'Investigation test appointment',
          16 // Test user ID
        ]);
        
        results.appointmentCreated = true;
        results.appointmentId = appointmentResult.insertId;
      } catch (error) {
        results.errors.push({ 
          step: 'appointment_creation', 
          error: error.message,
          code: error.code,
          errno: error.errno,
          sql: error.sql,
          sqlMessage: error.sqlMessage
        });
      }
    }

    // Step 4: Test status update
    if (leadId) {
      try {
        await connection.execute(
          'UPDATE leads SET status = "trial_scheduled", updated_at = CURRENT_TIMESTAMP WHERE id = ?',
          [leadId]
        );
        results.statusUpdated = true;
      } catch (error) {
        results.errors.push({ 
          step: 'status_update', 
          error: error.message,
          code: error.code,
          errno: error.errno
        });
      }
    }

    // Step 5: Test commit
    try {
      await db.commit(connection);
      results.transactionCommitted = true;
    } catch (error) {
      results.errors.push({ 
        step: 'commit', 
        error: error.message 
      });
    }

    // Step 6: Verify data was actually saved
    if (leadId && results.transactionCommitted) {
      const verifyLead = await db.get('SELECT * FROM leads WHERE id = ?', [leadId]);
      const verifyAppointment = await db.get('SELECT * FROM lead_appointments WHERE lead_id = ?', [leadId]);
      
      results.verification = {
        leadExists: !!verifyLead,
        leadStatus: verifyLead?.status,
        appointmentExists: !!verifyAppointment,
        appointmentStatus: verifyAppointment?.status
      };
    }

  } catch (error) {
    results.errors.push({ 
      step: 'general', 
      error: error.message,
      stack: error.stack
    });
    
    // Rollback if needed
    if (connection) {
      try {
        await db.rollback(connection);
        results.rolledBack = true;
      } catch (rollbackError) {
        results.errors.push({ 
          step: 'rollback', 
          error: rollbackError.message 
        });
      }
    }
  }

  res.json(results);
});

// Test walk-in without authentication
router.post('/test-walk-in', async (req, res) => {
  console.log('[TEST-WALK-IN] Request received');
  
  try {
    const LeadAppointment = require('../models/LeadAppointment');
    
    const testData = {
      studio_id: 5,
      lead_data: {
        name: 'Direct Test Walk-in',
        phone_number: '+43 999 888 7777',
        email: 'directtest@example.com'
      },
      appointment_data: {
        appointment_type_id: 15,
        appointment_date: '2025-08-23',
        start_time: '15:00:00',
        end_time: '16:00:00',
        notes: 'Direct test without auth'
      }
    };
    
    console.log('[TEST-WALK-IN] Creating with data:', testData);
    
    const result = await LeadAppointment.createWithLead(
      testData.studio_id,
      testData.lead_data,
      testData.appointment_data,
      16 // Test user ID
    );
    
    console.log('[TEST-WALK-IN] Success! Result:', result);
    
    // Verify the data was saved
    const verifyLead = await db.get('SELECT * FROM leads WHERE id = ?', [result.leadId]);
    const verifyAppointment = await db.get('SELECT * FROM lead_appointments WHERE id = ?', [result.appointmentId]);
    
    res.json({
      success: true,
      result,
      verification: {
        lead: verifyLead,
        appointment: verifyAppointment
      }
    });
    
  } catch (error) {
    console.error('[TEST-WALK-IN] Error:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      details: {
        code: error.code,
        errno: error.errno,
        sqlMessage: error.sqlMessage
      }
    });
  }
});

// Check appointment counts
router.get('/check-appointments', async (req, res) => {
  try {
    const customerCount = await db.get('SELECT COUNT(*) as count FROM appointments WHERE studio_id = 5');
    const leadCount = await db.get('SELECT COUNT(*) as count FROM lead_appointments WHERE studio_id = 5');
    
    const customerAppointments = await db.all('SELECT id, appointment_date, start_time, status FROM appointments WHERE studio_id = 5 LIMIT 5');
    const leadAppointments = await db.all('SELECT id, appointment_date, start_time, status FROM lead_appointments WHERE studio_id = 5');
    
    res.json({
      counts: {
        customer: customerCount?.count || 0,
        lead: leadCount?.count || 0
      },
      samples: {
        customer: customerAppointments,
        lead: leadAppointments
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/fix-leads-status-column', async (req, res) => {
  try {
    console.log('Fixing leads status column...');
    
    // Update the ENUM to include the probebehandlung statuses
    const updateStatusSQL = `
      ALTER TABLE leads 
      MODIFY COLUMN status ENUM(
        'new','working','qualified','trial_scheduled','converted',
        'unreachable','wrong_number','not_interested','lost',
        'probebehandlung_geplant','probebehandlung_absolviert',
        'interessiert','nicht_interessiert'
      ) DEFAULT 'new'
    `;
    
    const result = await db.run(updateStatusSQL);
    
    // Verify the change
    const verification = await db.all("DESCRIBE leads");
    const statusField = verification.find(field => field.Field === 'status');
    
    console.log('✅ Leads status column updated successfully');
    console.log('New status ENUM:', statusField?.Type);
    
    res.json({
      success: true,
      message: 'Leads status column updated successfully',
      newStatusType: statusField?.Type,
      result: {
        affectedRows: result.changes
      }
    });
    
  } catch (error) {
    console.error('Leads status fix error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fix leads status column',
      error: error.message,
      code: error.code
    });
  }
});

// Investigation endpoints removed - user 16 studio 5 issues resolved
module.exports = router;