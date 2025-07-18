const db = require('./src/database/connection');

async function fixUserRoles() {
  try {
    console.log('🔧 Fixing user roles table...');
    
    // Create new users table with correct constraints
    await new Promise((resolve, reject) => {
      db.run(`
        CREATE TABLE IF NOT EXISTS users_new (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          email TEXT UNIQUE NOT NULL,
          password_hash TEXT NOT NULL,
          role TEXT NOT NULL CHECK (role IN ('manager', 'studio_owner', 'customer')),
          first_name TEXT,
          last_name TEXT,
          phone TEXT,
          is_active BOOLEAN DEFAULT 1,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `, (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
    
    console.log('✅ New users table created');
    
    // Copy existing data to new table
    await new Promise((resolve, reject) => {
      db.run(`
        INSERT INTO users_new (id, email, password_hash, role, first_name, last_name, phone, is_active, created_at, updated_at)
        SELECT id, email, password_hash, role, first_name, last_name, phone, is_active, created_at, updated_at
        FROM users
      `, (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
    
    console.log('✅ Data copied to new table');
    
    // Drop old table and rename new one
    await new Promise((resolve, reject) => {
      db.run('DROP TABLE users', (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
    
    await new Promise((resolve, reject) => {
      db.run('ALTER TABLE users_new RENAME TO users', (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
    
    console.log('✅ Table renamed successfully');
    
    // Now create the manager account
    const bcrypt = require('bcryptjs');
    const email = 'manager@abnehmen.com';
    const password = 'Manager123!';
    const firstName = 'System';
    const lastName = 'Manager';
    
    const passwordHash = await bcrypt.hash(password, 12);
    
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
    console.log('');
    console.log('🔑 Login Credentials:');
    console.log('📧 Email: manager@abnehmen.com');
    console.log('🔐 Password: Manager123!');
    console.log('');
    
  } catch (error) {
    console.error('❌ Error fixing user roles:', error.message);
  } finally {
    db.close();
  }
}

fixUserRoles();