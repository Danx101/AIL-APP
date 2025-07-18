const bcrypt = require('bcryptjs');
const db = require('./src/database/connection');

async function createManagerAccount() {
  const email = 'manager@abnehmen.com';
  const password = 'Manager123!';
  const firstName = 'System';
  const lastName = 'Manager';
  
  try {
    // Hash password with same settings as auth controller
    const passwordHash = await bcrypt.hash(password, 12);
    
    // First, check if account already exists
    const existingUser = await new Promise((resolve, reject) => {
      db.get('SELECT * FROM users WHERE email = ?', [email], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });
    
    if (existingUser) {
      console.log('❌ Manager account already exists with ID:', existingUser.id);
      console.log('📧 Email:', existingUser.email);
      console.log('👤 Name:', existingUser.first_name, existingUser.last_name);
      console.log('🔐 Role:', existingUser.role);
      
      // Update password if needed
      await new Promise((resolve, reject) => {
        db.run(
          'UPDATE users SET password_hash = ? WHERE email = ?',
          [passwordHash, email],
          (err) => {
            if (err) reject(err);
            else resolve();
          }
        );
      });
      
      console.log('✅ Password updated for existing manager account');
    } else {
      // Create new manager account
      await new Promise((resolve, reject) => {
        db.run(
          'INSERT INTO users (email, password_hash, role, first_name, last_name) VALUES (?, ?, ?, ?, ?)',
          [email, passwordHash, 'manager', firstName, lastName],
          function(err) {
            if (err) reject(err);
            else resolve(this.lastID);
          }
        );
      });
      
      console.log('✅ Manager account created successfully');
    }
    
    console.log('');
    console.log('🔑 Login Credentials:');
    console.log('📧 Email: manager@abnehmen.com');
    console.log('🔐 Password: Manager123!');
    console.log('');
    
  } catch (error) {
    console.error('❌ Error creating manager account:', error.message);
  } finally {
    db.close();
  }
}

createManagerAccount();