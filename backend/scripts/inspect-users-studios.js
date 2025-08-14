require('dotenv').config();
const db = require('../src/database/database-wrapper');

async function inspectDatabase() {
  try {
    await db.init();
    console.log('🔍 Database Inspection\n');
    
    // Check all users
    console.log('=== ALL USERS ===');
    const users = await db.all(`
      SELECT id, email, role, first_name, last_name, 
             email_verified, is_active, created_at
      FROM users
      ORDER BY created_at DESC
    `);
    
    for (const user of users) {
      console.log(`\n👤 User: ${user.email}`);
      console.log(`   ID: ${user.id}`);
      console.log(`   Name: ${user.first_name} ${user.last_name}`);
      console.log(`   Role: ${user.role}`);
      console.log(`   Email Verified: ${user.email_verified ? 'YES ✅' : 'NO ❌'}`);
      console.log(`   Active: ${user.is_active ? 'YES ✅' : 'NO ❌'}`);
      console.log(`   Created: ${user.created_at}`);
    }
    
    // Check all studios
    console.log('\n\n=== ALL STUDIOS ===');
    const studios = await db.all(`
      SELECT s.*, u.email as owner_email
      FROM studios s
      LEFT JOIN users u ON s.owner_id = u.id
      ORDER BY s.created_at DESC
    `);
    
    for (const studio of studios) {
      console.log(`\n🏢 Studio: ${studio.name}`);
      console.log(`   ID: ${studio.id}`);
      console.log(`   Owner ID: ${studio.owner_id}`);
      console.log(`   Owner Email: ${studio.owner_email || 'UNKNOWN'}`);
      console.log(`   City: ${studio.city}`);
      console.log(`   Address: ${studio.address}`);
      console.log(`   Active: ${studio.is_active ? 'YES ✅' : 'NO ❌'}`);
      console.log(`   Unique ID: ${studio.unique_identifier}`);
      console.log(`   Created: ${studio.created_at}`);
    }
    
    // Check specific users
    console.log('\n\n=== SPECIFIC USER CHECKS ===');
    
    const checkEmails = ['maxberger@ail.com', 'gevel.vie@gmail.com'];
    for (const email of checkEmails) {
      console.log(`\n📧 Checking: ${email}`);
      const user = await db.get('SELECT * FROM users WHERE email = ?', [email]);
      
      if (user) {
        console.log(`   Found user with ID: ${user.id}`);
        console.log(`   Password hash exists: ${user.password_hash ? 'YES' : 'NO'}`);
        console.log(`   Email verified: ${user.email_verified}`);
        console.log(`   Is active: ${user.is_active}`);
        
        // Check for studios
        const userStudios = await db.all(
          'SELECT * FROM studios WHERE owner_id = ?',
          [user.id]
        );
        
        if (userStudios.length > 0) {
          console.log(`   Studios owned: ${userStudios.length}`);
          userStudios.forEach(s => {
            console.log(`      - ${s.name} (ID: ${s.id}, Active: ${s.is_active})`);
          });
        } else {
          console.log(`   No studios found for this user`);
        }
      } else {
        console.log(`   ❌ User not found in database`);
      }
    }
    
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

inspectDatabase();