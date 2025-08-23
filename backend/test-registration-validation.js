const express = require('express');
const { validateStudioRegistration } = require('./src/middleware/validation');
const { validationResult } = require('express-validator');

// Create a mock Express app for testing
const app = express();
app.use(express.json());

// Test middleware
app.post('/test-validation', validateStudioRegistration, (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ 
      success: false,
      errors: errors.array() 
    });
  }
  res.json({ success: true, message: 'Validation passed!' });
});

async function testValidation() {
  console.log('🧪 Testing Studio Registration Validation\n');

  // Test cases
  const testCases = [
    {
      name: 'Valid Registration Data',
      data: {
        email: 'test@example.com',
        password: 'TestPass123!',
        confirmPassword: 'TestPass123!',
        firstName: 'Max',
        lastName: 'Mustermann',
        phone: '+43123456789',
        country: 'Österreich',
        postalCode: '1010',
        city: 'Wien',
        street: 'Teststraße',
        houseNumber: '12/A',
        doorApartment: '5',
        termsAccepted: true,
        privacyAccepted: true
      },
      expectValid: true
    },
    {
      name: 'Missing Required Address Fields',
      data: {
        email: 'test@example.com',
        password: 'TestPass123!',
        confirmPassword: 'TestPass123!',
        firstName: 'Max',
        lastName: 'Mustermann',
        phone: '+43123456789',
        termsAccepted: true,
        privacyAccepted: true
        // Missing address fields
      },
      expectValid: false
    },
    {
      name: 'Empty Door/Apartment (Should be Valid)',
      data: {
        email: 'test@example.com',
        password: 'TestPass123!',
        confirmPassword: 'TestPass123!',
        firstName: 'Max',
        lastName: 'Mustermann',
        phone: '+43123456789',
        country: 'Deutschland',
        postalCode: '10115',
        city: 'Berlin',
        street: 'Teststraße',
        houseNumber: '42',
        doorApartment: '', // Empty but optional
        termsAccepted: true,
        privacyAccepted: true
      },
      expectValid: true
    },
    {
      name: 'Invalid Postal Code Format',
      data: {
        email: 'test@example.com',
        password: 'TestPass123!',
        confirmPassword: 'TestPass123!',
        firstName: 'Max',
        lastName: 'Mustermann',
        phone: '+43123456789',
        country: 'Österreich',
        postalCode: 'INVALID_CODE_123!!!', // Invalid characters
        city: 'Wien',
        street: 'Teststraße',
        houseNumber: '12',
        termsAccepted: true,
        privacyAccepted: true
      },
      expectValid: false
    },
    {
      name: 'Too Short House Number',
      data: {
        email: 'test@example.com',
        password: 'TestPass123!',
        confirmPassword: 'TestPass123!',
        firstName: 'Max',
        lastName: 'Mustermann',
        phone: '+43123456789',
        country: 'Österreich',
        postalCode: '1010',
        city: 'Wien',
        street: 'Teststraße',
        houseNumber: '', // Too short
        termsAccepted: true,
        privacyAccepted: true
      },
      expectValid: false
    }
  ];

  // Run tests
  for (let i = 0; i < testCases.length; i++) {
    const testCase = testCases[i];
    console.log(`${i + 1}. Testing: ${testCase.name}`);

    try {
      // Simulate validation by creating a mock request
      const mockReq = {
        body: testCase.data
      };

      // Run validation manually
      const validationPromises = validateStudioRegistration.map(validation => {
        return validation.run(mockReq);
      });

      await Promise.all(validationPromises);

      const errors = validationResult(mockReq);
      const isValid = errors.isEmpty();

      if (isValid === testCase.expectValid) {
        console.log(`   ✅ PASS - Validation ${isValid ? 'passed' : 'failed'} as expected`);
        if (!isValid) {
          console.log(`   📋 Validation errors:`);
          errors.array().forEach(error => {
            console.log(`      - ${error.msg} (field: ${error.param})`);
          });
        }
      } else {
        console.log(`   ❌ FAIL - Expected ${testCase.expectValid ? 'valid' : 'invalid'}, got ${isValid ? 'valid' : 'invalid'}`);
        if (!isValid) {
          console.log(`   📋 Unexpected validation errors:`);
          errors.array().forEach(error => {
            console.log(`      - ${error.msg} (field: ${error.param})`);
          });
        }
      }
    } catch (error) {
      console.log(`   ❌ ERROR - ${error.message}`);
    }

    console.log(''); // Empty line for readability
  }

  console.log('✅ Validation testing completed!');
  console.log('\nSummary of Fixed Issues:');
  console.log('📝 Updated validateStudioRegistration middleware:');
  console.log('   - Removed old "address" field validation');
  console.log('   - Added validation for new address components:');
  console.log('     • country (required, 2-100 chars)');
  console.log('     • postalCode (required, 3-20 chars, alphanumeric)');
  console.log('     • city (required, 2-100 chars)');
  console.log('     • street (required, 2-200 chars)');
  console.log('     • houseNumber (required, 1-50 chars)');
  console.log('     • doorApartment (optional, max 50 chars)');
  console.log('   - Maintained all other existing validations');
}

// Run the test
testValidation().catch(console.error);