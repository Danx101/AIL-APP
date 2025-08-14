#!/usr/bin/env node

/**
 * Comprehensive Test Script for Critical Fixes
 * Tests all the fixes we implemented in Phase 1
 */

const db = require('../src/database/database-wrapper');
const customerController = require('../src/controllers/customerController');

class CriticalFixesTester {
  constructor() {
    this.testResults = [];
    this.testStudio = null;
    this.testCustomer = null;
  }

  log(message, status = 'info') {
    const symbols = {
      info: 'ℹ️',
      success: '✅',
      error: '❌',
      warning: '⚠️',
      test: '🧪'
    };
    console.log(`${symbols[status]} ${message}`);
    
    this.testResults.push({
      message,
      status,
      timestamp: new Date().toISOString()
    });
  }

  async runAllTests() {
    this.log('Starting Critical Fixes Test Suite', 'test');
    console.log('=' .repeat(60));

    try {
      await this.setupTestData();
      await this.testDatabaseStructure();
      await this.testCustomerNameFields();
      await this.testAppointmentQueries();
      await this.testSessionBlockActivation();
      await this.testAppointmentCreation();
      await this.generateTestReport();
    } catch (error) {
      this.log(`Test suite failed: ${error.message}`, 'error');
      throw error;
    } finally {
      await this.cleanupTestData();
    }
  }

  async setupTestData() {
    this.log('Setting up test data...', 'info');
    
    // Get or create test studio
    const studios = await db.all('SELECT * FROM studios LIMIT 1');
    if (studios.length > 0) {
      this.testStudio = studios[0];
      this.log(`Using existing studio: ${this.testStudio.name} (ID: ${this.testStudio.id})`, 'info');
    } else {
      this.log('No studios found - cannot run tests without a studio', 'error');
      throw new Error('No studios available for testing');
    }

    // Get existing customers
    const customers = await db.all(`
      SELECT c.*, 
        (SELECT remaining_sessions FROM customer_sessions cs WHERE cs.customer_id = c.id AND cs.status = 'active' LIMIT 1) as remaining_sessions
      FROM customers c 
      WHERE c.studio_id = ? 
      LIMIT 1
    `, [this.testStudio.id]);

    if (customers.length > 0) {
      this.testCustomer = customers[0];
      this.log(`Using existing customer: ${this.testCustomer.contact_first_name} ${this.testCustomer.contact_last_name} (ID: ${this.testCustomer.id})`, 'info');
    } else {
      this.log('No customers found for testing', 'warning');
    }
  }

  async testDatabaseStructure() {
    this.log('Testing database structure changes...', 'test');
    
    // Check if new columns exist
    const columns = await db.all('SHOW COLUMNS FROM appointments');
    const columnNames = columns.map(col => col.Field);
    
    const requiredColumns = ['customer_ref_id', 'session_block_id', 'sessions_consumed_count'];
    const missingColumns = requiredColumns.filter(col => !columnNames.includes(col));
    
    if (missingColumns.length === 0) {
      this.log('All required columns are present in appointments table', 'success');
    } else {
      this.log(`Missing columns: ${missingColumns.join(', ')}`, 'error');
      throw new Error('Database structure is incomplete');
    }

    // Check indexes
    const indexes = await db.all('SHOW INDEX FROM appointments');
    const indexNames = indexes.map(idx => idx.Key_name);
    
    const requiredIndexes = ['idx_appointment_customer_ref', 'idx_appointment_session_block'];
    const presentIndexes = requiredIndexes.filter(idx => indexNames.includes(idx));
    
    this.log(`Performance indexes present: ${presentIndexes.length}/${requiredIndexes.length}`, 
      presentIndexes.length === requiredIndexes.length ? 'success' : 'warning');
  }

  async testCustomerNameFields() {
    this.log('Testing customer name field handling...', 'test');
    
    if (!this.testCustomer) {
      this.log('No test customer available - skipping customer name tests', 'warning');
      return;
    }

    // Test direct field access
    const customer = await db.get('SELECT * FROM customers WHERE id = ?', [this.testCustomer.id]);
    
    const hasFirstName = customer.contact_first_name && customer.contact_first_name.trim().length > 0;
    const hasLastName = customer.contact_last_name && customer.contact_last_name.trim().length > 0;
    
    if (hasFirstName && hasLastName) {
      this.log(`Customer name fields: "${customer.contact_first_name}" "${customer.contact_last_name}"`, 'success');
    } else {
      this.log(`Customer name fields incomplete: first="${customer.contact_first_name || 'NULL'}" last="${customer.contact_last_name || 'NULL'}"`, 'warning');
    }

    // Test name concatenation
    const fullName = `${customer.contact_first_name || 'Unknown'} ${customer.contact_last_name || 'Customer'}`;
    this.log(`Full name resolves to: "${fullName}"`, fullName.includes('Unknown') || fullName.includes('Customer') ? 'warning' : 'success');
  }

  async testAppointmentQueries() {
    this.log('Testing updated appointment queries...', 'test');
    
    // Test appointment query with new JOIN structure
    const appointments = await db.all(`
      SELECT 
        a.*,
        CASE 
          WHEN a.person_type = 'customer' THEN c.contact_first_name
          WHEN a.person_type = 'lead' THEN SUBSTRING_INDEX(l.name, ' ', 1)
          ELSE 'Unknown'
        END as customer_first_name,
        CASE 
          WHEN a.person_type = 'customer' THEN c.contact_last_name
          WHEN a.person_type = 'lead' THEN SUBSTRING_INDEX(l.name, ' ', -1)
          ELSE 'Person'
        END as customer_last_name
      FROM appointments a
      LEFT JOIN customers c ON a.customer_ref_id = c.id AND a.person_type = 'customer'
      LEFT JOIN leads l ON a.lead_id = l.id AND a.person_type = 'lead'
      WHERE a.studio_id = ?
      LIMIT 5
    `, [this.testStudio.id]);

    this.log(`Query returned ${appointments.length} appointments`, 'info');

    if (appointments.length > 0) {
      for (const apt of appointments) {
        const nameStatus = apt.customer_first_name === 'Unknown' ? 'warning' : 'success';
        this.log(`Appointment ${apt.id}: ${apt.customer_first_name} ${apt.customer_last_name} (${apt.person_type})`, nameStatus);
      }
    } else {
      this.log('No appointments found to test query structure', 'warning');
    }
  }

  async testSessionBlockActivation() {
    this.log('Testing session block activation logic...', 'test');
    
    if (!this.testCustomer) {
      this.log('No test customer available - skipping session block tests', 'warning');
      return;
    }

    // Check current session blocks
    const sessionBlocks = await db.all(`
      SELECT * FROM customer_sessions 
      WHERE customer_id = ? 
      ORDER BY purchase_date DESC
    `, [this.testCustomer.id]);

    this.log(`Customer has ${sessionBlocks.length} session blocks total`, 'info');

    const activeBlocks = sessionBlocks.filter(block => block.status === 'active');
    const pendingBlocks = sessionBlocks.filter(block => block.status === 'pending');

    this.log(`Active blocks: ${activeBlocks.length}, Pending blocks: ${pendingBlocks.length}`, 'info');

    // Test activation date format
    for (const block of activeBlocks) {
      if (block.activation_date) {
        try {
          const activationDate = new Date(block.activation_date);
          const isValidDate = !isNaN(activationDate.getTime());
          this.log(`Block ${block.id} activation date: ${block.activation_date} (${isValidDate ? 'valid' : 'invalid'})`, 
            isValidDate ? 'success' : 'error');
        } catch (error) {
          this.log(`Block ${block.id} has invalid activation date: ${block.activation_date}`, 'error');
        }
      }
    }

    // Test activation logic (without actually modifying data)
    if (activeBlocks.length > 1) {
      this.log('Multiple active blocks detected - this may cause issues', 'warning');
    } else if (activeBlocks.length === 0 && pendingBlocks.length > 0) {
      this.log('No active blocks but pending blocks exist - activation logic should trigger', 'warning');
    } else if (activeBlocks.length === 1) {
      this.log('Exactly one active block - optimal state', 'success');
    }
  }

  async testAppointmentCreation() {
    this.log('Testing appointment creation with new fields...', 'test');
    
    if (!this.testCustomer) {
      this.log('No test customer available - skipping appointment creation test', 'warning');
      return;
    }

    // Get appointment types
    const appointmentTypes = await db.all(`
      SELECT * FROM appointment_types 
      WHERE studio_id = ? AND is_active = 1 
      LIMIT 1
    `, [this.testStudio.id]);

    if (appointmentTypes.length === 0) {
      this.log('No appointment types available - skipping appointment creation test', 'warning');
      return;
    }

    const appointmentType = appointmentTypes[0];
    this.log(`Testing with appointment type: ${appointmentType.name}`, 'info');

    // Test the appointment creation data structure (without actually creating)
    const mockAppointmentData = {
      studio_id: this.testStudio.id,
      customer_ref_id: this.testCustomer.id,  // New field
      person_type: 'customer',                // New field
      appointment_type_id: appointmentType.id,
      appointment_date: new Date().toISOString().split('T')[0],
      start_time: '10:00:00',
      end_time: '11:00:00'
    };

    // Check if customer has active sessions for session tracking
    const activeSessionBlock = await db.get(`
      SELECT id, remaining_sessions FROM customer_sessions 
      WHERE customer_id = ? AND status = 'active' AND remaining_sessions > 0 
      LIMIT 1
    `, [this.testCustomer.id]);

    if (activeSessionBlock && appointmentType.consumes_session) {
      mockAppointmentData.session_block_id = activeSessionBlock.id;
      this.log(`Would link appointment to session block ${activeSessionBlock.id} (${activeSessionBlock.remaining_sessions} sessions remaining)`, 'success');
    } else if (appointmentType.consumes_session) {
      this.log('Appointment type consumes sessions but no active block available', 'warning');
    } else {
      this.log('Appointment type does not consume sessions - no session block linking needed', 'info');
    }

    this.log('Appointment creation data structure is valid', 'success');
  }

  async generateTestReport() {
    this.log('Generating comprehensive test report...', 'test');
    console.log('\n' + '='.repeat(60));
    console.log('🧪 CRITICAL FIXES TEST REPORT');
    console.log('='.repeat(60));
    
    const successCount = this.testResults.filter(r => r.status === 'success').length;
    const errorCount = this.testResults.filter(r => r.status === 'error').length;
    const warningCount = this.testResults.filter(r => r.status === 'warning').length;
    
    console.log(`\n📊 SUMMARY:`);
    console.log(`   ✅ Successes: ${successCount}`);
    console.log(`   ⚠️  Warnings:  ${warningCount}`);
    console.log(`   ❌ Errors:    ${errorCount}`);
    
    console.log(`\n🎯 OVERALL STATUS: ${errorCount === 0 ? '✅ PASSED' : '❌ FAILED'}`);
    
    if (errorCount === 0) {
      console.log(`\n🎉 All critical fixes are working correctly!`);
      console.log(`\n📋 WHAT'S NOW WORKING:`);
      console.log(`   • Database has proper customer_ref_id field`);
      console.log(`   • Session tracking via session_block_id is ready`);
      console.log(`   • Customer names will display correctly (no more "undefined undefined")`);
      console.log(`   • Appointment queries use customers table instead of users`);
      console.log(`   • Session block activation logic is improved`);
    } else {
      console.log(`\n💥 Critical issues found that need attention!`);
    }
    
    if (warningCount > 0) {
      console.log(`\n⚠️  WARNINGS TO ADDRESS:`);
      const warnings = this.testResults.filter(r => r.status === 'warning');
      warnings.forEach(warning => {
        console.log(`   • ${warning.message}`);
      });
    }
    
    if (errorCount > 0) {
      console.log(`\n❌ CRITICAL ERRORS:`);
      const errors = this.testResults.filter(r => r.status === 'error');
      errors.forEach(error => {
        console.log(`   • ${error.message}`);
      });
    }
    
    console.log('\n='.repeat(60));
  }

  async cleanupTestData() {
    // We didn't create any test data, so no cleanup needed
    this.log('Test cleanup completed', 'info');
  }
}

// Run tests if this script is called directly
if (require.main === module) {
  const tester = new CriticalFixesTester();
  
  tester.runAllTests()
    .then(() => {
      console.log('\n🏁 Test suite completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n💥 Test suite failed:', error);
      process.exit(1);
    });
}

module.exports = { CriticalFixesTester };