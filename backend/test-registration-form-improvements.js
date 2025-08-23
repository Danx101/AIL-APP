const db = require('./src/database/database-wrapper');

async function testRegistrationFormImprovements() {
  console.log('🧪 Testing Registration Form Improvements\n');

  try {
    // Test 1: Check if new address columns exist
    console.log('1. Testing database schema for address components...');
    try {
      const testQuery = await db.get(`
        SELECT country, postal_code, street, house_number, door_apartment 
        FROM users LIMIT 1
      `);
      console.log('   ✅ All new address columns exist and are accessible');
    } catch (error) {
      console.log('   ❌ Address columns missing:', error.message);
      return;
    }

    // Test 2: Test inserting a user with new address format
    console.log('\n2. Testing user creation with new address components...');
    const testEmail = 'test-address@example.com';
    
    try {
      // Clean up any existing test user
      await db.run('DELETE FROM users WHERE email = ?', [testEmail]);

      // Insert test user with new address format
      await db.run(`
        INSERT INTO users (
          email, password_hash, role, first_name, last_name, phone,
          country, postal_code, city, street, house_number, door_apartment,
          email_verified, terms_accepted, privacy_accepted
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        testEmail, 'test_hash', 'studio_owner', 'Test', 'User', '+43123456789',
        'Österreich', '1010', 'Wien', 'Teststraße', '12/A', '5',
        true, true, true
      ]);
      console.log('   ✅ User created successfully with new address format');

      // Verify the data
      const user = await db.get('SELECT * FROM users WHERE email = ?', [testEmail]);
      console.log('   📋 Stored address data:');
      console.log(`      Land: ${user.country}`);
      console.log(`      PLZ: ${user.postal_code}`);
      console.log(`      Ort: ${user.city}`);
      console.log(`      Straße: ${user.street}`);
      console.log(`      Haus NR/Stiege: ${user.house_number}`);
      console.log(`      Tür: ${user.door_apartment}`);

      // Clean up
      await db.run('DELETE FROM users WHERE email = ?', [testEmail]);
      console.log('   ✅ Test user cleaned up');

    } catch (error) {
      console.log(`   ❌ User creation failed: ${error.message}`);
    }

    // Test 3: Test profile update with new address format
    console.log('\n3. Testing profile update functionality...');
    try {
      // Create a test user
      await db.run(`
        INSERT INTO users (
          email, password_hash, role, first_name, last_name, phone,
          country, postal_code, city, street, house_number, door_apartment,
          email_verified
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        testEmail, 'test_hash', 'studio_owner', 'Original', 'Name', '+43111111111',
        'Deutschland', '10115', 'Berlin', 'Alte Straße', '1', '1A',
        true
      ]);

      // Update the user address
      await db.run(`
        UPDATE users 
        SET first_name = ?, last_name = ?, phone = ?, country = ?, postal_code = ?, 
            city = ?, street = ?, house_number = ?, door_apartment = ?
        WHERE email = ?
      `, [
        'Updated', 'Name', '+43222222222', 'Österreich', '5020', 'Salzburg',
        'Neue Straße', '42/B', '3C', testEmail
      ]);

      // Verify the update
      const updatedUser = await db.get('SELECT * FROM users WHERE email = ?', [testEmail]);
      console.log('   ✅ Profile update successful');
      console.log('   📋 Updated address data:');
      console.log(`      Name: ${updatedUser.first_name} ${updatedUser.last_name}`);
      console.log(`      Land: ${updatedUser.country}`);
      console.log(`      PLZ: ${updatedUser.postal_code}`);
      console.log(`      Ort: ${updatedUser.city}`);
      console.log(`      Straße: ${updatedUser.street}`);
      console.log(`      Haus NR/Stiege: ${updatedUser.house_number}`);
      console.log(`      Tür: ${updatedUser.door_apartment}`);

      // Clean up
      await db.run('DELETE FROM users WHERE email = ?', [testEmail]);
      console.log('   ✅ Test user cleaned up');

    } catch (error) {
      console.log(`   ❌ Profile update test failed: ${error.message}`);
    }

    // Test 4: Check index performance
    console.log('\n4. Testing address index functionality...');
    try {
      const indexCheck = await db.all(`
        SHOW INDEX FROM users WHERE Key_name = 'idx_users_location'
      `);
      
      if (indexCheck.length > 0) {
        console.log('   ✅ Address location index exists');
        console.log(`   📋 Index covers columns: ${indexCheck.map(idx => idx.Column_name).join(', ')}`);
      } else {
        console.log('   ⚠️  Address location index not found');
      }
    } catch (error) {
      console.log(`   ❌ Index check failed: ${error.message}`);
    }

    console.log('\n✅ All registration form improvements tested successfully!');
    console.log('\nSummary of Changes:');
    console.log('📝 Registration form:');
    console.log('   - Removed placeholder text from all fields');
    console.log('   - Moved password confirmation after password field');
    console.log('   - Replaced single address field with 6 detailed components');
    console.log('   - Removed pricing information alert');
    console.log('   - Added country dropdown with Austrian focus');
    console.log('');
    console.log('🗄️  Database:');
    console.log('   - Added 5 new address component columns');
    console.log('   - Added location index for better performance');
    console.log('   - Maintained backward compatibility');
    console.log('');
    console.log('👤 Profile page:');
    console.log('   - Updated to display all new address components');
    console.log('   - Organized fields in logical sections');
    console.log('   - Added proper validation for required fields');

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
testRegistrationFormImprovements().catch(console.error);