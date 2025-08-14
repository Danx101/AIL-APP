require('dotenv').config();
const db = require('../src/database/database-wrapper');

async function fixStudioOwnership() {
  try {
    await db.init();
    
    // Check if gevel.vie@gmail.com already owns a studio
    // Note: The email might be stored as gevelvie@gmail.com (without dot) due to previous normalization
    let user = await db.get('SELECT * FROM users WHERE email = ?', ['gevel.vie@gmail.com']);
    if (!user) {
      // Try without the dot
      user = await db.get('SELECT * FROM users WHERE email = ?', ['gevelvie@gmail.com']);
    }
    console.log('User ID:', user.id, 'Role:', user.role);
    
    // Check if studio 5 has an owner
    const studio = await db.get('SELECT * FROM studios WHERE id = 5');
    console.log('Studio 5 current owner_id:', studio.owner_id);
    
    if (!studio.owner_id || studio.owner_id !== user.id) {
      // Update studio 5 to be owned by gevel.vie@gmail.com
      await db.run('UPDATE studios SET owner_id = ? WHERE id = 5', [user.id]);
      console.log('✅ Updated studio 5 owner to user', user.id);
    } else {
      console.log('✅ Studio already owned by user');
    }
    
    // Verify the update
    const updated = await db.get('SELECT * FROM studios WHERE id = 5');
    console.log('Updated studio owner_id:', updated.owner_id);
    
    // Also verify login will work now
    let loginCheck = await db.get(`
      SELECT u.*, s.id as studio_id, s.name as studio_name 
      FROM users u 
      LEFT JOIN studios s ON s.owner_id = u.id 
      WHERE u.email = 'gevel.vie@gmail.com'
    `);
    
    if (!loginCheck) {
      loginCheck = await db.get(`
        SELECT u.*, s.id as studio_id, s.name as studio_name 
        FROM users u 
        LEFT JOIN studios s ON s.owner_id = u.id 
        WHERE u.email = 'gevelvie@gmail.com'
      `);
    }
    
    console.log('\n✅ Login check:');
    console.log('  User:', loginCheck.email);
    console.log('  Studio ID:', loginCheck.studio_id);
    console.log('  Studio Name:', loginCheck.studio_name);
    
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

fixStudioOwnership();