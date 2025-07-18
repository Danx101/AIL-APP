const bcrypt = require('bcryptjs');
const db = require('./src/database/connection');

async function createManager() {
  const email = 'manager@abnehmen.com';
  const password = 'Manager123!';
  const firstName = 'System';
  const lastName = 'Manager';
  
  try {
    // Hash password
    const passwordHash = await bcrypt.hash(password, 12);
    
    // Insert manager user
    db.run(
      'INSERT INTO users (email, password_hash, role, first_name, last_name) VALUES (?, ?, ?, ?, ?)',
      [email, passwordHash, 'manager', firstName, lastName],
      function(err) {
        if (err) {
          if (err.code === 'SQLITE_CONSTRAINT') {
            console.log('✅ Manager account already exists');
          } else {
            console.error('Error creating manager:', err.message);
          }
        } else {
          console.log('✅ Manager account created successfully');
          console.log('📧 Email: manager@abnehmen.com');
          console.log('🔑 Password: Manager123!');
        }
        
        // Close database connection
        db.close();
      }
    );
  } catch (error) {
    console.error('Error hashing password:', error);
    db.close();
  }
}

createManager();