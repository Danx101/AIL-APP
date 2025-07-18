const bcrypt = require('bcryptjs');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'database.sqlite');

async function createManagerAccount() {
  const db = new sqlite3.Database(dbPath);
  
  try {
    console.log('🔧 Creating manager account...');
    
    // Disable foreign key constraints temporarily
    await new Promise((resolve, reject) => {
      db.run('PRAGMA foreign_keys = OFF', (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
    
    // Try to insert manager directly (ignoring constraints)
    const email = 'manager@abnehmen.com';
    const password = 'Manager123!';
    const firstName = 'System';
    const lastName = 'Manager';
    
    const passwordHash = await bcrypt.hash(password, 12);
    
    // First delete if exists
    await new Promise((resolve, reject) => {
      db.run('DELETE FROM users WHERE email = ?', [email], (err) => {
        if (err) console.log('Note: No existing manager to delete');
        resolve();
      });
    });
    
    // Insert manager with explicit role
    await new Promise((resolve, reject) => {
      db.run(
        'INSERT INTO users (email, password_hash, role, first_name, last_name, is_active) VALUES (?, ?, ?, ?, ?, ?)',
        [email, passwordHash, 'manager', firstName, lastName, 1],
        function(err) {
          if (err) {
            console.log('❌ Insert failed:', err.message);
            reject(err);
          } else {
            console.log('✅ Manager account created with ID:', this.lastID);
            resolve(this.lastID);
          }
        }
      );
    });
    
    // Re-enable foreign key constraints
    await new Promise((resolve, reject) => {
      db.run('PRAGMA foreign_keys = ON', (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
    
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