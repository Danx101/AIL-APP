require('dotenv').config();
const bcrypt = require('bcryptjs');
const db = require('../src/database/database-wrapper');

async function resetPassword(email, newPassword) {
  try {
    await db.init();
    
    console.log(`🔍 Looking for user: ${email}`);
    
    // Find the user
    const user = await db.get('SELECT * FROM users WHERE email = ?', [email]);
    
    if (!user) {
      console.log('❌ User not found');
      process.exit(1);
    }
    
    console.log(`✅ Found user: ${user.first_name} ${user.last_name} (ID: ${user.id})`);
    console.log(`   Role: ${user.role}`);
    console.log(`   Email Verified: ${user.email_verified ? 'YES' : 'NO'}`);
    console.log(`   Active: ${user.is_active ? 'YES' : 'NO'}`);
    
    // Hash the new password
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    
    // Update password
    await db.run(
      'UPDATE users SET password_hash = ? WHERE id = ?',
      [hashedPassword, user.id]
    );
    
    console.log('✅ Password updated successfully!');
    console.log(`\nYou can now login with:`);
    console.log(`  Email: ${email}`);
    console.log(`  Password: ${newPassword}`);
    
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

// Get email and password from command line arguments
const email = process.argv[2];
const password = process.argv[3];

if (!email || !password) {
  console.log('Usage: node reset-password.js <email> <password>');
  console.log('Example: node reset-password.js maxberger@ail.com NewPassword123!');
  process.exit(1);
}

// Validate password strength
if (password.length < 8) {
  console.log('❌ Password must be at least 8 characters long');
  process.exit(1);
}

if (!/[A-Z]/.test(password) || !/[a-z]/.test(password) || !/[0-9]/.test(password)) {
  console.log('❌ Password must contain at least one uppercase letter, one lowercase letter, and one number');
  process.exit(1);
}

resetPassword(email, password);