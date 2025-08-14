require('dotenv').config();
const db = require('../src/database/database-wrapper');

async function checkEmailVariations() {
  try {
    await db.init();
    
    console.log('🔍 Checking email variations in database\n');
    
    // Check different variations
    const variations = [
      'gevel.vie@gmail.com',
      'gevelvie@gmail.com',
      'GEVELVIE@gmail.com',
      'GEVEL.VIE@gmail.com'
    ];
    
    for (const email of variations) {
      console.log(`\n📧 Checking: ${email}`);
      
      // Direct query
      const user = await db.get('SELECT id, email, role FROM users WHERE email = ?', [email]);
      if (user) {
        console.log(`   ✅ Found: ID=${user.id}, Email=${user.email}, Role=${user.role}`);
      } else {
        console.log(`   ❌ Not found`);
      }
      
      // Case-insensitive query
      const userCI = await db.get('SELECT id, email, role FROM users WHERE LOWER(email) = LOWER(?)', [email]);
      if (userCI) {
        console.log(`   ✅ Found (case-insensitive): ID=${userCI.id}, Email=${userCI.email}`);
      }
    }
    
    // Check all emails containing 'gevel'
    console.log('\n\n=== All emails containing "gevel" ===');
    const gevelUsers = await db.all(
      `SELECT id, email, first_name, last_name, role, is_active 
       FROM users 
       WHERE email LIKE '%gevel%'`
    );
    
    for (const u of gevelUsers) {
      console.log(`ID: ${u.id} | Email: "${u.email}" | Name: ${u.first_name} ${u.last_name}`);
      // Show the exact bytes of the email
      console.log(`   Email length: ${u.email.length} characters`);
      console.log(`   Email bytes: ${Buffer.from(u.email).toString('hex')}`);
    }
    
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

checkEmailVariations();