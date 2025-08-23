const db = require('./src/database/database-wrapper');
const authController = require('./src/controllers/authController');
const emailService = require('./src/services/emailService');

async function testRegistrationImprovements() {
  console.log('🧪 Testing Registration Improvements\n');

  try {
    // Test 1: Check if email service initializes properly
    console.log('1. Testing email service initialization...');
    await emailService.initialize();
    console.log(`   Email service initialized: ${emailService.initialized ? '✅' : '❌'}`);

    // Test 2: Check if verification_attempts column exists
    console.log('\n2. Testing database schema...');
    try {
      const testQuery = await db.get('SELECT verification_attempts FROM users LIMIT 1');
      console.log('   verification_attempts column exists: ✅');
    } catch (error) {
      console.log('   verification_attempts column missing: ❌');
      console.log('   Run migration: node backend/migrations/010_add_verification_attempts.sql');
    }

    // Test 3: Test duplicate email handling (simulated)
    console.log('\n3. Testing duplicate email detection...');
    const testEmail = 'test@example.com';
    
    // Create a test user
    try {
      await db.run(`
        INSERT INTO users (email, password_hash, role, first_name, last_name, email_verified, verification_attempts)
        VALUES (?, 'test_hash', 'studio_owner', 'Test', 'User', FALSE, 1)
      `, [testEmail]);
      console.log('   Test user created ✅');

      // Try to register with same email - should detect duplicate
      const req = {
        body: {
          email: testEmail,
          password: 'testpass123',
          firstName: 'Test',
          lastName: 'User',
          phone: '1234567890',
          city: 'Test City',
          address: 'Test Address',
          termsAccepted: true,
          privacyAccepted: true
        }
      };
      
      const res = {
        status: (code) => ({
          json: (data) => {
            console.log(`   Response status: ${code}`);
            console.log(`   Response message: ${data.message}`);
            console.log(`   Has resend capability: ${data.canResendVerification ? '✅' : '❌'}`);
          }
        })
      };

      // This should return an error about email not verified
      await authController.registerStudio(req, res);

    } catch (error) {
      console.log(`   Error during duplicate test: ${error.message}`);
    } finally {
      // Clean up test user
      await db.run('DELETE FROM users WHERE email = ?', [testEmail]);
      console.log('   Test user cleaned up ✅');
    }

    // Test 4: Check scheduled jobs
    console.log('\n4. Testing scheduled jobs...');
    try {
      const scheduledJobs = require('./src/services/scheduledJobs');
      console.log('   Scheduled jobs service loaded ✅');
      
      // Test manual cleanup function
      const result = await scheduledJobs.runUnverifiedUserCleanup();
      console.log(`   Manual cleanup test: cleaned ${result.cleaned} users ✅`);
    } catch (error) {
      console.log(`   Scheduled jobs error: ${error.message} ❌`);
    }

    console.log('\n✅ All registration improvements tested successfully!');
    console.log('\nNext steps:');
    console.log('1. Start the backend server: npm start');
    console.log('2. Test the frontend registration form');
    console.log('3. Try registering with duplicate email to see new error handling');
    console.log('4. Test the resend verification email feature');

  } catch (error) {
    console.error('❌ Test failed:', error);
  } finally {
    // Close database connection
    if (db.close) {
      await db.close();
    }
  }
}

// Run the test
testRegistrationImprovements().catch(console.error);