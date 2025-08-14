require('dotenv').config();
const db = require('../src/database/database-wrapper');

async function activateStudio(email) {
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
    
    // Update user to be verified
    await db.run(
      `UPDATE users 
       SET email_verified = TRUE, is_active = TRUE 
       WHERE id = ?`,
      [user.id]
    );
    console.log('✅ User email marked as verified');
    
    // Find and activate their studio
    const studio = await db.get('SELECT * FROM studios WHERE owner_id = ?', [user.id]);
    
    if (studio) {
      console.log(`🏢 Found studio: ${studio.name} (ID: ${studio.id})`);
      
      await db.run(
        'UPDATE studios SET is_active = TRUE WHERE id = ?',
        [studio.id]
      );
      
      console.log('✅ Studio activated successfully!');
      console.log('\nStudio Details:');
      console.log(`  Name: ${studio.name}`);
      console.log(`  City: ${studio.city}`);
      console.log(`  Address: ${studio.address}`);
      console.log(`  Unique ID: ${studio.unique_identifier}`);
    } else {
      console.log('⚠️  No studio found for this user');
    }
    
    console.log('\n✅ All done! User can now login and access their studio dashboard.');
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

// Get email from command line argument
const email = process.argv[2];

if (!email) {
  console.log('Usage: node activate-studio.js <email>');
  console.log('Example: node activate-studio.js gevelvie@gmail.com');
  process.exit(1);
}

activateStudio(email);