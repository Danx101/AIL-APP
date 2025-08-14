require('dotenv').config();
const db = require('../src/database/database-wrapper');
const bcrypt = require('bcryptjs');

async function findAllGevelAccounts() {
  try {
    await db.init();
    
    console.log('🔍 Finding ALL users with "gevel" in email\n');
    
    // Get ALL users
    const allUsers = await db.all(
      `SELECT id, email, first_name, last_name, role, is_active, email_verified, created_at, password_hash
       FROM users 
       ORDER BY created_at DESC`
    );
    
    console.log(`Total users in database: ${allUsers.length}\n`);
    
    // Filter for gevel-related emails
    const gevelEmails = allUsers.filter(u => 
      u.email.toLowerCase().includes('gevel') || 
      u.email.toLowerCase().includes('gevel.vie')
    );
    
    console.log(`Found ${gevelEmails.length} users with 'gevel' in email:\n`);
    
    for (const user of gevelEmails) {
      console.log(`\n========================================`);
      console.log(`ID: ${user.id}`);
      console.log(`Email: "${user.email}"`);
      console.log(`Name: ${user.first_name} ${user.last_name}`);
      console.log(`Role: ${user.role}`);
      console.log(`Active: ${user.is_active ? 'YES' : 'NO'}`);
      console.log(`Email Verified: ${user.email_verified ? 'YES' : 'NO'}`);
      console.log(`Created: ${user.created_at}`);
      console.log(`Has Password: ${user.password_hash ? 'YES' : 'NO'}`);
      
      // Check if password "12345678Aa" works
      if (user.password_hash) {
        try {
          const matches = await bcrypt.compare('12345678Aa', user.password_hash);
          console.log(`Password "12345678Aa" works: ${matches ? 'YES ✅' : 'NO ❌'}`);
        } catch (e) {
          console.log(`Password check error: ${e.message}`);
        }
      }
      
      // Check for studios
      const studios = await db.all(
        'SELECT id, name, is_active FROM studios WHERE owner_id = ?',
        [user.id]
      );
      
      if (studios.length > 0) {
        console.log(`Studios: ${studios.length}`);
        studios.forEach(s => {
          console.log(`  - ${s.name} (ID: ${s.id}, Active: ${s.is_active ? 'YES' : 'NO'})`);
        });
      } else {
        console.log(`Studios: None`);
      }
    }
    
    // Also check if somehow the email with dot exists
    console.log('\n\n=== Direct check for "gevel.vie@gmail.com" ===');
    const dotEmail = await db.get(
      'SELECT * FROM users WHERE email = ?',
      ['gevel.vie@gmail.com']
    );
    
    if (dotEmail) {
      console.log('✅ FOUND! User with dot in email exists!');
      console.log(`   ID: ${dotEmail.id}`);
      console.log(`   Full email: "${dotEmail.email}"`);
    } else {
      console.log('❌ No user with "gevel.vie@gmail.com" found');
    }
    
    // Check with LIKE to catch any variations
    console.log('\n=== Fuzzy search for gevel.vie ===');
    const fuzzySearch = await db.all(
      `SELECT id, email FROM users WHERE email LIKE '%gevel%vie%'`
    );
    
    console.log(`Found ${fuzzySearch.length} users:`);
    fuzzySearch.forEach(u => {
      console.log(`  - ID: ${u.id}, Email: "${u.email}"`);
    });
    
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

findAllGevelAccounts();